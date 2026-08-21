import type { Request } from 'express';
import { db } from '../../database/pool';
import { logger } from '../../config/logger';
import { buildSearchText } from './audit.redaction';
import {
  ALL_AUDIT_ACTIONS,
  CATEGORY_FOR_ACTION,
  type ActorUserType,
  type AuditActor,
  type AuditEventInput,
} from './audit.types';

/**
 * Writing the audit trail.
 *
 * Two properties matter more than anything else here, and both are about what
 * this must *not* do.
 *
 * ## 1. It must never break the thing it is auditing
 *
 * The entry is the business; the log is the record of it. A member's entry must
 * not fail because the audit table is full, or because a JSONB value was
 * malformed. `record()` therefore never throws — every path is caught.
 *
 * The service this replaces rethrew, which is backwards, and is why that
 * behaviour is called out rather than quietly changed.
 *
 * ## 2. A failed audit write must not try to audit itself
 *
 * This is the loop: if the table is what is broken, writing "the audit write
 * failed" fails too, which triggers another write, and so on. So the failure
 * path is **forbidden from re-entering** `record()`. It increments a counter
 * and writes to the application log — neither of which touches Postgres — and
 * the Platform Admin screen reads the counter to show a degraded banner.
 *
 * See docs/AUDIT_TRAIL_AND_SESSIONS.md §2.6.
 */

/** Rows waiting to be flushed. */
interface QueuedEvent {
  occurredAt: Date;
  actor: AuditActor;
  organisationId: string | null;
  category: string;
  action: string;
  outcome: string;
  entityType: string | null;
  entityId: string | null;
  entityLabel: string | null;
  changes: unknown;
  context: unknown;
  searchText: string;
}

/**
 * How many rows to hold before flushing, and how long to wait.
 *
 * Small and short: this is an audit trail, and a crash that loses the last two
 * seconds of it is a worse trade than one extra insert per second. The batch
 * exists so a busy endpoint pays one round trip rather than one per request,
 * not to buffer meaningfully.
 */
const BATCH_SIZE = 50;
const FLUSH_INTERVAL_MS = 2000;

class AuditService {
  private queue: QueuedEvent[] = [];
  private timer: NodeJS.Timeout | null = null;

  /**
   * Failures since the process started, and when the last one was.
   *
   * In memory rather than in a table, deliberately — see the note above about
   * the loop. `/api/admin/audit/health` reads this so the gap is surfaced where
   * the log is read, rather than being a silence nobody notices.
   */
  private failures = 0;
  private lastFailureAt: Date | null = null;

  /**
   * Record something that happened. Never throws, never awaits the database.
   *
   * Not `async` by accident: callers are in the middle of doing the real work,
   * and making them `await` an audit write would put the log on the critical
   * path of every mutation.
   */
  record(input: AuditEventInput & { actor: AuditActor }): void {
    try {
      const action = input.action;

      /*
       * An unregistered action is a bug — a typo produces an event nobody can
       * filter for. Recorded anyway, because dropping it would lose the event
       * as well as the typo, but shouted about so it is found.
       */
      if (!ALL_AUDIT_ACTIONS.has(action)) {
        logger.error('Audit action is not in the registry', { action });
      }

      const category = input.category ?? CATEGORY_FOR_ACTION.get(action) ?? 'platform';

      this.queue.push({
        occurredAt: new Date(),
        actor: input.actor,
        organisationId: input.organisationId ?? null,
        category,
        action,
        outcome: input.outcome ?? 'success',
        entityType: input.entityType ?? null,
        entityId: input.entityId ?? null,
        entityLabel: input.entityLabel ?? null,
        changes: input.changes ?? null,
        context: input.context ?? null,
        searchText: buildSearchText({
          actorDisplay: input.actor.display,
          actorEmail: input.actor.email,
          action,
          entityType: input.entityType,
          entityLabel: input.entityLabel,
          changes: input.changes,
        }),
      });

      if (this.queue.length >= BATCH_SIZE) {
        void this.flush();
      } else {
        this.scheduleFlush();
      }
    } catch (error) {
      this.noteFailure(error, 'queue');
    }
  }

  /** The same thing, taking the actor from the request. */
  fromRequest(req: Request, input: AuditEventInput): void {
    this.record({ ...input, actor: input.actor ?? actorFromRequest(req), context: {
      ...contextFromRequest(req),
      ...(input.context ?? {}),
    } });
  }

  private scheduleFlush(): void {
    if (this.timer) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.flush();
    }, FLUSH_INTERVAL_MS);
    // Never hold the process open for an audit flush.
    this.timer.unref?.();
  }

  /**
   * Write the queued rows.
   *
   * One multi-row INSERT rather than one per event. On failure the batch is
   * **dropped**, not retried: a retry loop against a table that is refusing
   * writes grows the queue without bound, and the honest outcome of "the audit
   * store is down" is a recorded gap, not unbounded memory.
   */
  async flush(): Promise<void> {
    if (this.queue.length === 0) return;

    const batch = this.queue;
    this.queue = [];

    try {
      await this.insertBatch(batch);
    } catch (error) {
      this.noteFailure(error, 'flush', batch.length);
    }
  }

  private async insertBatch(batch: QueuedEvent[]): Promise<void> {
    const columns = 15;
    const params: unknown[] = [];
    const tuples = batch.map((event, index) => {
      const base = index * columns;
      params.push(
        event.occurredAt,
        event.actor.keycloakUserId ?? null,
        event.actor.userType,
        event.actor.display ?? null,
        event.actor.email ?? null,
        event.organisationId,
        event.category,
        event.action,
        event.outcome,
        event.entityType,
        event.entityId,
        event.entityLabel,
        event.searchText,
        event.changes ? JSON.stringify(event.changes) : null,
        event.context ? JSON.stringify(event.context) : null
      );
      const p = (offset: number) => `$${base + offset}`;
      return `(${p(1)}, ${p(2)}, ${p(3)}, ${p(4)}, ${p(5)}, ${p(6)}, ${p(7)}, ${p(8)}, ${p(9)},
               ${p(10)}, ${p(11)}, ${p(12)}, ${p(13)}, ${p(14)}::jsonb, ${p(15)}::jsonb)`;
    });

    await db.query(
      `INSERT INTO audit_events (
         occurred_at, actor_kc_user_id, actor_user_type, actor_display, actor_email,
         organisation_id, category, action, outcome, entity_type, entity_id,
         entity_label, search_text, changes, context
       ) VALUES ${tuples.join(', ')}`,
      params
    );
  }

  /**
   * The failure path, which must not touch the audit table.
   *
   * This is the whole answer to "would recording the failure loop?" — it would,
   * if the record went through `record()`. It does not: a counter and the
   * application logger, both of which are unaffected by whatever broke the
   * write.
   */
  private noteFailure(error: unknown, stage: string, dropped = 0): void {
    this.failures += 1;
    this.lastFailureAt = new Date();
    logger.error('Audit write failed', {
      stage,
      dropped,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  /** For the degraded banner, and for tests. */
  health(): { failures: number; lastFailureAt: Date | null; queued: number } {
    return { failures: this.failures, lastFailureAt: this.lastFailureAt, queued: this.queue.length };
  }

  /** Tests need a deterministic write; production never calls this. */
  async flushNow(): Promise<void> {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    await this.flush();
  }
}

/**
 * Who is acting, from the request.
 *
 * The Keycloak subject is the identity: it is the same person across all three
 * applications, where our own tables are per-organisation. The display name and
 * email are copied from the token rather than looked up, because an audit write
 * must not add a query to every mutation — and because the token is what the
 * person actually presented.
 */
export function actorFromRequest(req: Request): AuditActor {
  const user = (req as any).user;
  if (!user?.userId) {
    return { keycloakUserId: null, userType: 'anonymous', display: null, email: null };
  }

  const roles: string[] = user.roles ?? [];
  const account = (req as any).account;

  let userType: ActorUserType = 'account-user';
  if (roles.includes('super-admin')) userType = 'super-admin';
  else if (!account && roles.includes('admin')) userType = 'org-admin';
  else if (!account) userType = 'org-admin';

  return {
    keycloakUserId: user.userId,
    userType,
    display:
      [user.firstName, user.lastName].filter(Boolean).join(' ') ||
      user.username ||
      user.email ||
      null,
    email: user.email ?? null,
  };
}

export function contextFromRequest(req: Request): Record<string, unknown> {
  const forwarded = req.headers['x-forwarded-for'];
  const ip =
    (typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : undefined) ||
    req.socket?.remoteAddress ||
    undefined;

  return {
    ip,
    userAgent: req.headers['user-agent'],
    // From the token, so an event can be tied to a row on the Sessions screen.
    sessionId: (req as any).user?.sessionId,
    method: req.method,
    path: req.originalUrl?.split('?')[0],
  };
}

export const auditService = new AuditService();
