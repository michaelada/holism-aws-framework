import type { AuditChanges } from './audit.types';

/**
 * What must never reach the audit table.
 *
 * An audit log is a copy of your data with none of the access control that
 * protects the original, read by people who may have no business reason to see
 * any particular field. So the question is not "can we log this" but "should
 * this exist twice".
 *
 * See docs/AUDIT_TRAIL_AND_SESSIONS.md §2.5.
 */

/** The marker a reader sees in place of a redacted value. */
export const REDACTED = '[redacted]';

/**
 * Never recorded, at any value, under any key that matches.
 *
 * Matched case-insensitively against the *field name*, as a substring, because
 * these arrive under a dozen spellings — `password`, `newPassword`,
 * `password_confirm`, `currentPassword` — and a list of exact names is a list
 * somebody has to keep complete.
 */
const NEVER_LOG = [
  'password',
  'secret',
  'token',
  'apikey',
  'api_key',
  'authorization',
  'cardnumber',
  'card_number',
  'cvv',
  'cvc',
  'iban',
  'sortcode',
  'sort_code',
  'accountnumber',
  'account_number',
  'clientsecret',
  'client_secret',
  'privatekey',
  'private_key',
];

/**
 * True where a field name should never have its value recorded.
 *
 * Deliberately greedy: a false positive costs a reader one value they could
 * have seen, and a false negative puts a credential in a table that is kept for
 * years and read by administrators.
 */
export function isNeverLogged(fieldName: string): boolean {
  const name = fieldName.toLowerCase();
  return NEVER_LOG.some((needle) => name.includes(needle));
}

/**
 * Redact a value while keeping the fact that it was there.
 *
 * `[redacted]` rather than dropping the key, because "this field was changed
 * and we are not showing you to what" is information, and a missing key reads
 * as "this field was not touched".
 */
export function redactValue(fieldName: string, value: unknown): unknown {
  return isNeverLogged(fieldName) ? REDACTED : value;
}

/**
 * Redact a plain object of values — a created row, a deleted row, form answers.
 *
 * `sensitiveFields` is the caller's own list, used for **form answers**: the
 * form builder marks a field sensitive (medical notes, emergency contacts) and
 * those values are recorded as present-but-hidden rather than copied into a
 * second store. The reader still sees the field was answered, which is usually
 * the audit question.
 */
export function redactObject(
  values: Record<string, unknown>,
  sensitiveFields: ReadonlySet<string> = new Set(),
  omit: ReadonlySet<string> = new Set(),
  omitEmpty = true
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(values ?? {})) {
    if (omit.has(key)) continue;

    /*
     * A whole-row snapshot lists what something was created with, or what it
     * held when deleted. A field nobody filled in is not part of either answer,
     * and a new form field arrived with nine columns of "—" around its label.
     *
     * `false` and `0` are values and stay; only nothing is nothing. This is
     * snapshots only. A diff still shows a field being cleared — that is a
     * change, and the reason diffs exist — and a *rejected* submission keeps
     * its blanks, because a blank is very often why it was rejected.
     */
    if (omitEmpty && (value === null || value === undefined || value === '')) continue;

    out[key] = isNeverLogged(key) || sensitiveFields.has(key) ? REDACTED : value;
  }
  return out;
}

/**
 * The fields that differ between two versions of a row.
 *
 * Field-level rather than two whole objects: the screen's job is to show *what
 * changed*, and a reader handed two thirty-field records has to diff them by
 * eye. Unchanged fields are omitted entirely, so a one-field edit produces a
 * one-field record rather than a wall of identical values.
 *
 * Compared by JSON shape, so `{a:1}` and `{a:1}` are equal and a nested object
 * that was rewritten identically does not show up as a change.
 */
export function diff(
  before: Record<string, unknown> | null | undefined,
  after: Record<string, unknown> | null | undefined,
  options: {
    sensitiveFields?: ReadonlySet<string>;
    ignore?: ReadonlySet<string>;
    only?: ReadonlySet<string>;
  } = {}
): AuditChanges {
  const sensitive = options.sensitiveFields ?? new Set<string>();
  /*
   * `updated_at` and friends change on every write and mean nothing to a
   * reader; left in, every diff would carry a row of noise.
   */
  const ignore = options.ignore ?? new Set(['updated_at', 'updatedAt', 'created_at', 'createdAt']);

  const changes: AuditChanges = {};
  /*
   * `only` narrows the comparison to the fields that belong to this row.
   *
   * Without it, anything the response carries that the row does not — a joined
   * collection, a computed total — appears as a change from nothing to a wall
   * of JSON, on every save, having not changed. An event edit reported its
   * whole list of activities that way.
   */
  const candidates = [...Object.keys(before ?? {}), ...Object.keys(after ?? {})];
  const keys = new Set(options.only ? candidates.filter((key) => options.only!.has(key)) : candidates);

  for (const key of keys) {
    if (ignore.has(key)) continue;

    const from = before?.[key];
    const to = after?.[key];
    if (JSON.stringify(from ?? null) === JSON.stringify(to ?? null)) continue;

    changes[key] =
      isNeverLogged(key) || sensitive.has(key)
        ? { from: REDACTED, to: REDACTED }
        : { from: from ?? null, to: to ?? null };
  }

  return changes;
}

/** A create: the whole row, redacted. */
export const created = (
  values: Record<string, unknown>,
  sensitiveFields?: ReadonlySet<string>,
  omit?: ReadonlySet<string>
): AuditChanges => ({ created: redactObject(values, sensitiveFields, omit) });

/** A delete: the whole row as it was, redacted — the point of a delete record. */
export const deleted = (
  values: Record<string, unknown>,
  sensitiveFields?: ReadonlySet<string>,
  omit?: ReadonlySet<string>
): AuditChanges => ({ deleted: redactObject(values, sensitiveFields, omit) });

/**
 * Everything the free-text filter should match, flattened.
 *
 * Built at write time and stored, because searching inside JSONB with `LIKE`
 * table-scans — and the search this exists for ("find the row mentioning
 * KHP-0241") is exactly the one that would scan the whole table.
 *
 * Redacted values are already `[redacted]` by the time they arrive here, so a
 * password can never be found by searching for it.
 */
export function buildSearchText(parts: {
  actorDisplay?: string | null;
  actorEmail?: string | null;
  action: string;
  entityType?: string | null;
  entityLabel?: string | null;
  changes?: AuditChanges | null;
}): string {
  const values: string[] = [];

  const walk = (value: unknown, depth = 0): void => {
    if (depth > 4 || value === null || value === undefined) return;
    if (typeof value === 'object') {
      for (const nested of Object.values(value as Record<string, unknown>)) walk(nested, depth + 1);
      return;
    }
    const text = String(value);
    // Long blobs — a rich-text body, a base64 image — would bloat the index
    // without making anything findable that a shorter prefix would not.
    if (text.length <= 200) values.push(text);
  };

  walk(parts.changes);

  return [
    parts.actorDisplay,
    parts.actorEmail,
    parts.action,
    parts.entityType,
    parts.entityLabel,
    ...values,
  ]
    .filter(Boolean)
    .join(' ')
    .slice(0, 8000);
}
