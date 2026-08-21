import { db } from '../../database/pool';
import type { AuditEvent, ActorUserType, AuditCategory, AuditOutcome } from './audit.types';

/**
 * Reading the audit trail.
 *
 * One query layer for both viewers. The Platform Admin screen sees everything;
 * the org-admin screen sees one organisation. That difference is a single
 * **mandatory** parameter rather than a filter the caller may forget — see
 * `organisationId` below, which is the whole tenancy story for this feature.
 *
 * See docs/AUDIT_TRAIL_AND_SESSIONS.md §2.7.
 */

export interface AuditQuery {
  /**
   * Which organisation's events to return.
   *
   * `'all'` is only reachable from the platform routes, and is spelled out
   * rather than expressed as `undefined`: a missing filter and "deliberately
   * every organisation" must not look the same at a call site, or an org-admin
   * route that forgets to pass one silently returns the whole platform.
   */
  organisationId: string | 'all';
  actorKeycloakUserId?: string;
  actorUserType?: ActorUserType[];
  category?: AuditCategory[];
  action?: string[];
  outcome?: AuditOutcome[];
  entityType?: string;
  entityId?: string;
  from?: Date;
  to?: Date;
  /** Free text over actor, entity and the values that changed. */
  search?: string;
  limit?: number;
  /**
   * Keyset cursor — the last row seen, as `occurred_at|id`.
   *
   * Not an offset. `OFFSET 50000` re-reads fifty thousand rows to skip them,
   * and gets slower the further back you look, which is exactly where an
   * investigation goes.
   */
  cursor?: string;
}

export interface AuditPage {
  events: AuditEvent[];
  /** Pass back as `cursor` to continue. Null when there is no more. */
  nextCursor: string | null;
}

const MAX_LIMIT = 200;
const DEFAULT_LIMIT = 50;

function rowToEvent(row: any): AuditEvent {
  return {
    id: row.id,
    occurredAt: row.occurred_at,
    actorKeycloakUserId: row.actor_kc_user_id,
    actorUserType: row.actor_user_type,
    actorDisplay: row.actor_display,
    actorEmail: row.actor_email,
    organisationId: row.organisation_id,
    category: row.category,
    action: row.action,
    outcome: row.outcome,
    entityType: row.entity_type,
    entityId: row.entity_id,
    entityLabel: row.entity_label,
    changes: row.changes,
    context: row.context,
    organisationName: row.organisation_name ?? null,
  } as AuditEvent & { organisationName: string | null };
}

class AuditQueryService {
  async search(query: AuditQuery): Promise<AuditPage> {
    const where: string[] = [];
    const params: unknown[] = [];
    const add = (sql: string, value: unknown) => {
      params.push(value);
      where.push(sql.replace('?', `$${params.length}`));
    };

    /*
     * Tenancy first, and unconditionally. Everything below is a convenience;
     * this is the line that stops one club reading another's trail.
     */
    if (query.organisationId !== 'all') {
      add('a.organisation_id = ?', query.organisationId);
    }

    if (query.actorKeycloakUserId) add('a.actor_kc_user_id = ?', query.actorKeycloakUserId);
    if (query.actorUserType?.length) add('a.actor_user_type = ANY(?)', query.actorUserType);
    if (query.category?.length) add('a.category = ANY(?)', query.category);
    if (query.action?.length) add('a.action = ANY(?)', query.action);
    if (query.outcome?.length) add('a.outcome = ANY(?)', query.outcome);
    if (query.entityType) add('a.entity_type = ?', query.entityType);
    if (query.entityId) add('a.entity_id = ?', query.entityId);
    if (query.from) add('a.occurred_at >= ?', query.from);
    if (query.to) add('a.occurred_at <= ?', query.to);

    /*
     * Free text. `ILIKE '%…%'` against the generated `search_text`, which the
     * trigram index makes usable — without it this table-scans, and the search
     * this exists for ("find the row mentioning KHP-0241") is exactly the one
     * that would.
     */
    if (query.search?.trim()) {
      add('a.search_text ILIKE ?', `%${query.search.trim()}%`);
    }

    /*
     * Keyset pagination on `(occurred_at, id)` — the same pair the primary key
     * uses, so the order is total and a row is never skipped or repeated when
     * two events share a timestamp.
     */
    if (query.cursor) {
      const [at, id] = query.cursor.split('|');
      params.push(at, id);
      where.push(`(a.occurred_at, a.id) < ($${params.length - 1}::timestamptz, $${params.length}::uuid)`);
    }

    const limit = Math.min(Math.max(query.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT);
    params.push(limit + 1); // one extra, to know whether there is a next page

    const result = await db.query(
      `SELECT a.*, o.display_name AS organisation_name
         FROM audit_events a
         LEFT JOIN organizations o ON o.id = a.organisation_id
        ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
        ORDER BY a.occurred_at DESC, a.id DESC
        LIMIT $${params.length}`,
      params
    );

    const rows = result.rows.slice(0, limit);
    const hasMore = result.rows.length > limit;
    const last = rows[rows.length - 1];

    return {
      events: rows.map(rowToEvent),
      nextCursor:
        hasMore && last ? `${new Date(last.occurred_at).toISOString()}|${last.id}` : null,
    };
  }

  /**
   * The values a reader can filter by, for the filter panel.
   *
   * Taken from the data rather than from the registry, so the dropdown offers
   * what actually happened in this organisation rather than every action the
   * platform could theoretically emit — a list of eighty actions, most of which
   * return nothing, is not a filter.
   */
  async filterOptions(organisationId: string | 'all'): Promise<{
    categories: string[];
    actions: string[];
    userTypes: string[];
    actors: Array<{ keycloakUserId: string; display: string | null; email: string | null }>;
    earliest: Date | null;
  }> {
    const scope = organisationId === 'all' ? '' : 'WHERE organisation_id = $1';
    const params = organisationId === 'all' ? [] : [organisationId];

    const [facets, actors, earliest] = await Promise.all([
      db.query(
        `SELECT DISTINCT category, action, actor_user_type FROM audit_events ${scope}`,
        params
      ),
      db.query(
        `SELECT DISTINCT ON (actor_kc_user_id) actor_kc_user_id, actor_display, actor_email
           FROM audit_events
          ${scope ? `${scope} AND` : 'WHERE'} actor_kc_user_id IS NOT NULL
          ORDER BY actor_kc_user_id, occurred_at DESC
          LIMIT 500`,
        params
      ),
      db.query(`SELECT MIN(occurred_at) AS earliest FROM audit_events ${scope}`, params),
    ]);

    return {
      categories: [...new Set(facets.rows.map((r) => r.category))].sort(),
      actions: [...new Set(facets.rows.map((r) => r.action))].sort(),
      userTypes: [...new Set(facets.rows.map((r) => r.actor_user_type))].sort(),
      actors: actors.rows.map((r) => ({
        keycloakUserId: r.actor_kc_user_id,
        display: r.actor_display,
        email: r.actor_email,
      })),
      /*
       * The earliest event, so an empty result can say "nothing matched" rather
       * than leaving a reader unsure whether auditing was even running then —
       * a real question, since the log starts on a particular day.
       */
      earliest: earliest.rows[0]?.earliest ?? null,
    };
  }

  /** One event, scoped, for the detail screen. */
  async findById(id: string, organisationId: string | 'all'): Promise<AuditEvent | null> {
    const scope = organisationId === 'all' ? '' : 'AND a.organisation_id = $2';
    const params = organisationId === 'all' ? [id] : [id, organisationId];

    const result = await db.query(
      `SELECT a.*, o.display_name AS organisation_name
         FROM audit_events a
         LEFT JOIN organizations o ON o.id = a.organisation_id
        WHERE a.id = $1 ${scope}
        LIMIT 1`,
      params
    );

    return result.rows.length ? rowToEvent(result.rows[0]) : null;
  }
}

export const auditQueryService = new AuditQueryService();
