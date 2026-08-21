import type { Request, Response, NextFunction } from 'express';
import { db } from '../database/pool';
import { auditService, actorFromRequest, contextFromRequest } from '../services/audit/audit.service';
import { diff, created, deleted, redactObject } from '../services/audit/audit.redaction';
import { organisationFromRequest } from '../services/audit/with-audit';
import type { AuditCategory, AuditChanges } from '../services/audit/audit.types';

/**
 * Recording a route, without touching the route.
 *
 * ## Why this and not the wrapper
 *
 * `withAudit` straddles one call: it is exact, and it is an edit inside a
 * handler. There are roughly 180 mutating endpoints here, and they nearly all
 * have the same shape — a service call whose result is the response body. Going
 * into 180 handler bodies to wrap that call would be 180 chances to change the
 * behaviour of a working endpoint.
 *
 * This sits in the middleware chain instead, beside the guards that are already
 * there:
 *
 * ```ts
 * router.put('/events/:id',
 *   authenticateToken(),
 *   byResource('event', 'id'),
 *   audited({ action: 'event.updated', resource: 'event', label: 'name' }),
 *   handler)
 * ```
 *
 * The handler is untouched. What the middleware sees is the response — which,
 * for these routes, *is* the new row.
 *
 * ## The before-state
 *
 * The one thing a response cannot show is what the values used to be, so for an
 * update or a delete this loads the row first, by the same id the guard just
 * authorised. That is one extra `SELECT` on mutations only, on routes the
 * caller has already been authorised for.
 *
 * ## Outcome
 *
 * Recorded on `finish`, so it reflects what the client actually got. A handler
 * that 400s on validation records a `failure` with the reason — a rejected
 * change is part of the trail, and often the interesting part.
 *
 * `withAudit` remains the right tool where the values are not a table row: the
 * entry basket, a payment method changing mid-checkout, a report being opened.
 *
 * See docs/AUDIT_TRAIL_AND_SESSIONS.md §3.
 */

/**
 * How to read a row back for the before-state.
 *
 * Deliberately a fixed map rather than a table name passed in at the call site:
 * the identifier goes into SQL, and a map means no route can ever put anything
 * else there.
 */
const ROW_SQL: Record<string, string> = {
  event: 'SELECT * FROM events WHERE id = $1',
  eventActivity: 'SELECT * FROM event_activities WHERE id = $1',
  eventType: 'SELECT * FROM event_types WHERE id = $1',
  venue: 'SELECT * FROM venues WHERE id = $1',
  discount: 'SELECT * FROM discounts WHERE id = $1',
  membershipType: 'SELECT * FROM membership_types WHERE id = $1',
  member: 'SELECT * FROM members WHERE id = $1',
  merchandiseType: 'SELECT * FROM merchandise_types WHERE id = $1',
  merchandiseOrder: 'SELECT * FROM merchandise_orders WHERE id = $1',
  calendar: 'SELECT * FROM calendars WHERE id = $1',
  booking: 'SELECT * FROM bookings WHERE id = $1',
  registrationType: 'SELECT * FROM registration_types WHERE id = $1',
  registration: 'SELECT * FROM registrations WHERE id = $1',
  applicationForm: 'SELECT * FROM application_forms WHERE id = $1',
  applicationField: 'SELECT * FROM application_fields WHERE id = $1',
  formSubmission: 'SELECT * FROM form_submissions WHERE id = $1',
  payment: 'SELECT * FROM payments WHERE id = $1',
  userGroup: 'SELECT * FROM user_groups WHERE id = $1',
  organisationUser: 'SELECT * FROM organization_users WHERE id = $1',
  adminRole: 'SELECT * FROM organization_admin_roles WHERE id = $1',
  organisation: 'SELECT * FROM organizations WHERE id = $1',
  organisationType: 'SELECT * FROM organization_types WHERE id = $1',
  post: 'SELECT * FROM platform_posts WHERE id = $1',
};

export type AuditResource = keyof typeof ROW_SQL;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Plumbing, not content.
 *
 * A surrogate key, the timestamps that move on every write, the soft-delete
 * flags, the organisation the reader is already looking at. None of it answers
 * "what changed" or "what was this created with", and on a create — where the
 * whole row is recorded — it was most of what a reader saw.
 *
 * Applied to creates and deletes as well as diffs, which it was not at first:
 * a new form field listed its uuid and both timestamps above its actual label.
 */
const HOUSEKEEPING = new Set([
  'id',
  'createdAt',
  'updatedAt',
  'createdBy',
  'updatedBy',
  'deletedAt',
  'deleted',
  'searchVector',
  'organisationId',
  'organizationId',
]);

export interface AuditedOptions {
  action: string;
  category?: AuditCategory;

  /** Which table to read the before-state from. Omit when there is none to read. */
  resource?: AuditResource;

  /**
   * What the event is *about*, for the reader and for the entity filter.
   * Defaults to `resource`.
   */
  entityType?: string;

  /** The route parameter holding the id. Defaults to `id`. */
  param?: string;

  /**
   * Which property of the row to show instead of a uuid — `name`, `title`,
   * `email`. Tried against the response body first, then the row that was
   * there before.
   */
  label?: string | ((row: Record<string, unknown>) => string | null | undefined);

  kind?: 'create' | 'update' | 'delete' | 'action';

  /**
   * What to record instead of the request body.
   *
   * A report view is a GET with an empty body and everything interesting in the
   * query string — the date range, the filters. "Which report" is barely worth
   * recording; "which slice of the members list did they take away with them"
   * is the question this answers.
   */
  values?: (req: Request) => Record<string, unknown> | null;

  /**
   * Extra fields to record as present-but-hidden on top of the global list.
   *
   * A function when the answer depends on the request — a club marks its own
   * form fields sensitive, so which ones they are is a per-organisation lookup.
   * Resolved once, before the handler runs.
   */
  sensitiveFields?: ReadonlySet<string> | ((req: Request) => Promise<ReadonlySet<string>>);

  /**
   * Fields this entity treats as internal, on top of the housekeeping list.
   *
   * For the ones only the route knows about: an application field's `name` is
   * generated from its label and never typed by anybody, so recording both says
   * the same thing twice and the machine-readable one first.
   */
  exclude?: ReadonlySet<string>;

  /**
   * Skip entirely. For routes that are only sometimes interesting — a PUT used
   * as an idempotent no-op, say.
   */
  skip?: (req: Request) => boolean;
}

/**
 * `AuditedOptions` after the per-request lookup has been done.
 *
 * A separate type rather than a cast: everything downstream of the resolve
 * point works with a plain set, and saying so is what stops a future edit from
 * quietly passing the unresolved function into `redactObject`, where it would
 * match nothing and redact nothing.
 */
type ResolvedOptions = Omit<AuditedOptions, 'sensitiveFields'> & {
  sensitiveFields?: ReadonlySet<string>;
};

const kindFromMethod = (method: string): 'create' | 'update' | 'delete' | 'action' => {
  if (method === 'POST') return 'create';
  if (method === 'PUT' || method === 'PATCH') return 'update';
  if (method === 'DELETE') return 'delete';
  return 'action';
};

/**
 * The two sides of a diff arrive in different spellings.
 *
 * `before` is `SELECT *`, so its keys are the column names — `entry_fee`.
 * `after` is the response body, which the services have already mapped to
 * `entryFee`. Diffed as they are, every field reads as removed and re-added,
 * and the trail becomes useless precisely on the updates it exists to record.
 *
 * So both sides are put into one spelling first. camelCase, because that is
 * what a reader of this application sees everywhere else.
 */
const camel = (key: string): string => key.replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase());

const camelKeys = (row: Record<string, unknown> | null): Record<string, unknown> | null => {
  if (!row) return null;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) out[camel(key)] = value;
  return out;
};

/** Plain objects only — an array response is a list, not a row. */
const asRow = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

/**
 * A response body is not always the row. A great many handlers here answer
 * `{ success: true, data: {...} }` or `{ event: {...} }`, and recording the
 * envelope instead of the row would produce a trail of `{success: true}`.
 */
const unwrap = (body: unknown): Record<string, unknown> | null => {
  const row = asRow(body);
  if (!row) return null;

  if (asRow(row.data)) return asRow(row.data);

  const keys = Object.keys(row);
  if (keys.length === 1 && asRow(row[keys[0]])) return asRow(row[keys[0]]);

  return row;
};

function labelOf(
  option: AuditedOptions['label'],
  ...rows: Array<Record<string, unknown> | null>
): string | null {
  for (const row of rows) {
    if (!row) continue;

    if (typeof option === 'function') {
      const value = option(row);
      if (value) return String(value);
      continue;
    }

    const candidates = option
      ? [option]
      : ['name', 'title', 'display_name', 'displayName', 'email', 'reference'];

    for (const key of candidates) {
      const value = row[key];
      if (typeof value === 'string' && value) return value;
    }

    // A person is two columns more often than one.
    const person = [row.first_name ?? row.firstName, row.last_name ?? row.lastName]
      .filter((part) => typeof part === 'string' && part)
      .join(' ');
    if (person) return person;
  }

  return null;
}

export function audited(options: AuditedOptions) {
  const entityType = options.entityType ?? options.resource ?? 'record';

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (options.skip?.(req)) return next();

    const kind = options.kind ?? kindFromMethod(req.method);
    const id = (req.params as Record<string, string>)?.[options.param ?? 'id'];

    /*
     * Resolved here rather than on `finish`, because the marks must be known
     * before anything is written down — and because a failure to read them
     * must not be able to leave an unredacted value in the record.
     */
    let sensitiveFields: ReadonlySet<string> | undefined;
    try {
      sensitiveFields =
        typeof options.sensitiveFields === 'function'
          ? await options.sensitiveFields(req)
          : options.sensitiveFields;
    } catch {
      sensitiveFields = undefined;
    }

    const resolved: ResolvedOptions = { ...options, sensitiveFields };

    /*
     * The before-load must never be able to fail the request. A row that cannot
     * be read is recorded with no before-state — honest, and far better than a
     * 500 on a delete that would otherwise have worked.
     */
    let before: Record<string, unknown> | null = null;
    if (options.resource && id && UUID.test(id) && (kind === 'update' || kind === 'delete')) {
      try {
        const result = await db.query(ROW_SQL[options.resource], [id]);
        before = camelKeys(result.rows[0] ?? null);
      } catch {
        before = null;
      }
    }

    /*
     * `res.json` is where the row passes through. Captured rather than
     * re-derived, because it is exactly what the client was told.
     */
    let body: unknown;
    const json = res.json.bind(res);
    res.json = (value: unknown) => {
      body = value;
      return json(value);
    };

    // `finish` rather than the handler returning: it fires however the response
    // ended, including from an error handler further down the chain.
    res.on('finish', () => {
      const failed = res.statusCode >= 400;
      const after = camelKeys(unwrap(body));

      auditService.record({
        actor: actorFromRequest(req),
        context: {
          ...contextFromRequest(req),
          status: res.statusCode,
          ...(failed ? { error: errorMessage(body) } : {}),
        },
        organisationId: organisationFromRequest(req),
        action: options.action,
        category: options.category,
        entityType,
        entityId: id ?? idFrom(after),
        entityLabel: labelOf(options.label, after, before),
        changes: failed
          ? attempted(req, resolved)
          : changesFor(kind, before, after, req, resolved),
        outcome: failed ? (res.statusCode === 403 ? 'denied' : 'failure') : 'success',
      });
    });

    next();
  };
}

const idFrom = (row: Record<string, unknown> | null): string | null =>
  row && typeof row.id === 'string' ? row.id : null;

const errorMessage = (body: unknown): string | undefined => {
  const row = asRow(body);
  if (!row) return undefined;
  if (typeof row.error === 'string') return row.error;
  const nested = asRow(row.error);
  if (nested && typeof nested.message === 'string') return nested.message;
  if (typeof row.message === 'string') return row.message;
  return undefined;
};

/** What the caller sent, whether or not it was accepted. */
const submitted = (req: Request, options: ResolvedOptions): Record<string, unknown> | null =>
  options.values ? options.values(req) : camelKeys(asRow(req.body));

/**
 * A refused change is still worth the record — often more so than an accepted one.
 *
 * Blanks are kept here, unlike in a snapshot: an empty name is very often the
 * reason the save was refused, and dropping it would leave a failure record
 * that does not show the failure.
 */
const attempted = (req: Request, options: ResolvedOptions): AuditChanges | null => {
  const sent = submitted(req, options);
  if (!sent) return null;
  return { attempted: redactObject(sent, options.sensitiveFields, HOUSEKEEPING, false) };
};

function changesFor(
  kind: string,
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null,
  req: Request,
  options: ResolvedOptions
): AuditChanges | null {
  const { sensitiveFields } = options;

  const omit = options.exclude ? new Set([...HOUSEKEEPING, ...options.exclude]) : HOUSEKEEPING;

  switch (kind) {
    case 'create': {
      const values = options.values ? submitted(req, options) : (after ?? submitted(req, options));
      return values ? created(values, sensitiveFields, omit) : null;
    }

    case 'delete':
      // The response to a delete is 204; the record is the row that is gone.
      return before ? deleted(before, sensitiveFields, omit) : null;

    case 'update': {
      /*
       * A handler that answers 204 leaves nothing to diff against. What the
       * caller sent is the next best truth — merged onto the old row, so a
       * partial update does not read as every absent field being cleared.
       */
      const sent = camelKeys(asRow(req.body));
      const next = after ?? (sent ? { ...before, ...sent } : null);

      /*
       * The before-row came from `SELECT *`, so its keys are exactly this
       * table's columns. The response usually carries more — joined children,
       * computed fields — and none of that is a stored value of this row.
       *
       * Reported as changes they were noise of the worst kind: an event edit
       * showed its entire list of activities going from nothing to a wall of
       * JSON, every single save, having not been touched.
       */
      const columns = before ? new Set(Object.keys(before)) : undefined;
      return diff(before, next, { sensitiveFields, ignore: omit, only: columns });
    }

    default: {
      const values = submitted(req, options);
      return values ? created(values, sensitiveFields, omit) : null;
    }
  }
}
