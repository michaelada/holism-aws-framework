import { db } from '../../database/pool';
import { logger } from '../../config/logger';

/**
 * Which of a club's form fields must never have their answers logged.
 *
 * The redaction list in audit.redaction.ts catches what can be named in
 * advance — password, token, card number. It cannot catch a field a club
 * invented and called "Any medical conditions we should know about?", and
 * that is exactly the answer that must not end up in a searchable log.
 *
 * So the club marks the field, and this reads the marks.
 *
 * ## Cached, and why that is safe here
 *
 * An audit write must not add a query to every submission. This is a small,
 * rarely-changing set per organisation, so it is held for a minute — which
 * means a field marked sensitive can take up to a minute to take effect.
 *
 * That direction is the safe one to be wrong in only if the *other* direction
 * is also handled: un-marking a field is what the cache could delay into
 * logging something that should be logged, which is harmless. Marking one is
 * the dangerous direction, so the form-field routes clear the entry for their
 * organisation on write rather than waiting for it to expire.
 *
 * See docs/AUDIT_TRAIL_AND_SESSIONS.md §4.
 */

interface Entry {
  fields: ReadonlySet<string>;
  readAt: number;
}

const TTL_MS = 60_000;
const cache = new Map<string, Entry>();

/**
 * The names *and* labels of every sensitive field in an organisation.
 *
 * Both, because a submission's answers are keyed by whichever the form used —
 * `medicalConditions` in one place and "Any medical conditions?" in another —
 * and a redaction that only matched one of the two would be a redaction that
 * silently did nothing.
 */
export async function sensitiveFieldsFor(
  organisationId: string | null | undefined
): Promise<ReadonlySet<string>> {
  if (!organisationId) return EMPTY;

  const cached = cache.get(organisationId);
  if (cached && Date.now() - cached.readAt < TTL_MS) return cached.fields;

  try {
    const result = await db.query(
      `SELECT name, label FROM application_fields
        WHERE organisation_id = $1 AND is_sensitive = true`,
      [organisationId]
    );

    const fields = new Set<string>();
    for (const row of result.rows) {
      if (row.name) fields.add(row.name);
      if (row.label) fields.add(row.label);
    }

    cache.set(organisationId, { fields, readAt: Date.now() });
    return fields;
  } catch (error) {
    /*
     * Failing closed would mean redacting everything, which destroys the trail;
     * failing open would mean logging a medical note. Neither is acceptable as
     * a silent default, so the failure is shouted about and treated as "no
     * marks known" — the same as an organisation that has marked nothing.
     */
    logger.error('Could not read the sensitive-field marks', { organisationId, error });
    return EMPTY;
  }
}

const EMPTY: ReadonlySet<string> = new Set();

/** Called by the field routes on write, so a new mark takes effect at once. */
export function forgetSensitiveFields(organisationId: string | null | undefined): void {
  if (organisationId) cache.delete(organisationId);
  else cache.clear();
}
