import type { Request } from 'express';
import { auditService, actorFromRequest, contextFromRequest } from './audit.service';
import { diff, created, deleted } from './audit.redaction';
import type { AuditCategory, AuditChanges } from './audit.types';

/**
 * Wrapping a mutation so it records itself.
 *
 * ## Why a wrapper rather than middleware
 *
 * Middleware can see the request and the response, which is enough for "who
 * called what". It is not enough for the thing the audit trail is actually for:
 * **what the values were before the change**. By the time a response is on its
 * way out, the old row is gone.
 *
 * So the capture has to straddle the mutation, which is what this does — load
 * `before`, run the operation, diff against `after`. One call per site, and the
 * before-load only happens for the kinds that need it.
 *
 * ## The four kinds
 *
 * | kind     | recorded                                        |
 * |----------|-------------------------------------------------|
 * | `create` | the whole new row, redacted                     |
 * | `update` | only the fields that changed, before → after    |
 * | `delete` | the whole row as it was — the point of a delete |
 * | `action` | no values, or exactly the ones passed in        |
 *
 * `action` is for the things that are not row edits: a form opened, a report
 * viewed, a payment method chosen. The user asked for those to be in the trail
 * too, and they carry context rather than a diff.
 *
 * ## Failure
 *
 * If the operation throws, a `failure` event is recorded and the error is
 * **rethrown unchanged** — the caller's error handling is untouched, and a
 * failed delete is as interesting to an auditor as a successful one.
 *
 * The audit write itself can never fail the operation; `auditService.record`
 * swallows everything. See docs/AUDIT_TRAIL_AND_SESSIONS.md §2.6.
 */

export type AuditKind = 'create' | 'update' | 'delete' | 'action';

export interface WithAuditOptions<T> {
  action: string;
  category?: AuditCategory;
  entityType: string;

  /**
   * Which row. A function when only the result knows — a create does not have
   * an id until it has run.
   */
  entityId?: string | null | ((result: T) => string | null | undefined);

  /**
   * What a reader sees in the list instead of a UUID: an event's name, a
   * member's name, a form's title. Worth setting on everything — a trail of
   * bare identifiers is a trail nobody reads.
   */
  label?: string | null | ((result: T, before: unknown) => string | null | undefined);

  /** Defaults to `req.organisationId`, which the scope middleware sets. */
  organisationId?: string | null;

  /** Inferred from the action suffix when not given. */
  kind?: AuditKind;

  /**
   * The row as it was. Only called for `update` and `delete`, and only when the
   * caller supplies it — an update with no loader records the new values alone,
   * which is worth having but is not the full record.
   */
  before?: () => Promise<unknown> | unknown;

  /** The row as it now is. Defaults to whatever the operation returned. */
  after?: (result: T) => unknown;

  /** For `action`: the values worth keeping, e.g. the answers on a form. */
  values?: Record<string, unknown>;

  /**
   * Fields to record as present-but-hidden.
   *
   * On top of the always-redacted list in audit.redaction — this is for fields
   * that are sensitive in one context and ordinary in another, such as a form
   * answer whose field was marked sensitive by the club that designed it.
   */
  sensitiveFields?: ReadonlySet<string>;

  /** Fields to leave out of a diff entirely: derived columns, timestamps. */
  ignore?: ReadonlySet<string>;
}

/**
 * The suffix says what happened, so the common case needs no `kind`.
 *
 * Anything unrecognised is an `action` rather than a guess — a mislabelled
 * diff would put values in the log under the wrong heading, which is worse than
 * recording no values at all.
 */
function inferKind(action: string): AuditKind {
  const verb = action.split('.')[1] ?? '';
  if (/^(created|registered|placed|issued|recorded|submitted|applied)$/.test(verb)) return 'create';
  if (/^(updated|changed|status-changed|renewed|reordered)$/.test(verb)) return 'update';
  if (/^(deleted|cancelled|removed|revoked)$/.test(verb)) return 'delete';
  return 'action';
}

const resolve = <V,>(value: V | ((...args: any[]) => V), ...args: any[]): V =>
  typeof value === 'function' ? (value as (...a: any[]) => V)(...args) : value;

/** Plain objects only. A row is a record; an array or a scalar is not a diff. */
const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

export function organisationFromRequest(req: Request): string | null {
  const scoped = req as any;
  return (
    scoped.organisationId ??
    /*
     * The account-user routes are addressed by org code — `/:orgCode/cart` —
     * and their middleware resolves the organisation onto `req.account`. Left
     * out, every member action in the trail would be unattributed to a club,
     * which is the one thing the org-admin viewer filters on.
     */
    scoped.account?.organisationId ??
    scoped.params?.organisationId ??
    scoped.params?.organizationId ??
    scoped.body?.organisationId ??
    scoped.body?.organizationId ??
    null
  );
}

export async function withAudit<T>(
  req: Request,
  options: WithAuditOptions<T>,
  operation: () => Promise<T>
): Promise<T> {
  const kind = options.kind ?? inferKind(options.action);

  /*
   * Loading `before` must not be able to fail the mutation either. A row that
   * cannot be read is recorded as a change with no before-state, which is
   * honest — rather than a 500 on a delete that would otherwise have worked.
   */
  let before: unknown = null;
  if (options.before && (kind === 'update' || kind === 'delete')) {
    try {
      before = await options.before();
    } catch {
      before = null;
    }
  }

  try {
    const result = await operation();
    const after = options.after ? options.after(result) : result;

    auditService.record({
      actor: actorFromRequest(req),
      context: contextFromRequest(req),
      organisationId: options.organisationId ?? organisationFromRequest(req),
      action: options.action,
      category: options.category,
      entityType: options.entityType,
      entityId: resolve(options.entityId ?? null, result) ?? null,
      entityLabel: resolve(options.label ?? null, result, before) ?? null,
      changes: changesFor(kind, before, after, options),
      outcome: 'success',
    });

    return result;
  } catch (error) {
    auditService.record({
      actor: actorFromRequest(req),
      context: {
        ...contextFromRequest(req),
        error: error instanceof Error ? error.message : String(error),
      },
      organisationId: options.organisationId ?? organisationFromRequest(req),
      action: options.action,
      category: options.category,
      entityType: options.entityType,
      /*
       * Only the literal forms survive a failure: the function forms are given
       * a result, and on this path there is none.
       */
      entityId: typeof options.entityId === 'string' ? options.entityId : null,
      entityLabel: typeof options.label === 'string' ? options.label : null,
      changes: options.values ? { attempted: options.values } : null,
      outcome: 'failure',
    });

    throw error;
  }
}

function changesFor<T>(
  kind: AuditKind,
  before: unknown,
  after: unknown,
  options: WithAuditOptions<T>
): AuditChanges | null {
  const sensitiveFields = options.sensitiveFields;

  switch (kind) {
    case 'create': {
      const values = asRecord(after);
      return values ? created(values, sensitiveFields) : null;
    }
    case 'delete': {
      const values = asRecord(before) ?? asRecord(after);
      return values ? deleted(values, sensitiveFields) : null;
    }
    case 'update': {
      const changes = diff(asRecord(before), asRecord(after), {
        sensitiveFields,
        ignore: options.ignore,
      });
      /*
       * An update that changed nothing still happened — somebody pressed Save.
       * Recorded with an empty diff rather than dropped, so "who touched this"
       * stays answerable.
       */
      return changes;
    }
    default:
      return options.values ? created(options.values, sensitiveFields) : null;
  }
}

/**
 * Record something that is not a mutation: a report opened, an export taken, a
 * payment method chosen.
 *
 * Fire-and-forget, like `auditService.record` itself — nothing here is on the
 * critical path of a response.
 */
export function recordAudit(
  req: Request,
  input: {
    action: string;
    category?: AuditCategory;
    entityType: string;
    entityId?: string | null;
    label?: string | null;
    organisationId?: string | null;
    values?: Record<string, unknown>;
    sensitiveFields?: ReadonlySet<string>;
    outcome?: 'success' | 'failure' | 'denied';
  }
): void {
  auditService.record({
    actor: actorFromRequest(req),
    context: contextFromRequest(req),
    organisationId: input.organisationId ?? organisationFromRequest(req),
    action: input.action,
    category: input.category,
    entityType: input.entityType,
    entityId: input.entityId ?? null,
    entityLabel: input.label ?? null,
    changes: input.values ? created(input.values, input.sensitiveFields) : null,
    outcome: input.outcome ?? 'success',
  });
}
