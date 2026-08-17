import { db } from '../database/pool';

/**
 * Turning stored form answers back into something a member recognises.
 *
 * A `form_submissions.submission_data` blob is keyed by field *name* and holds
 * raw values — booleans, arrays, numbers. On its own it is unreadable: the
 * labels live on the form, and only joining the two produces "Pony height:
 * 14.2hh" rather than `{"pony_height": 14.2}`.
 *
 * Shared because the basket and the member's own records both have to do it,
 * and two implementations would eventually disagree about how an unanswered
 * optional field looks — which is exactly the kind of difference a member
 * notices and cannot explain.
 */

export interface FormAnswer {
  label: string;
  value: string;
}

/** One stored answer as display text. Empty means "not answered". */
export function formatAnswer(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (Array.isArray(value)) return value.filter((v) => v !== null && v !== '').join(', ');
  return String(value).trim();
}

/**
 * The answers behind a set of submissions, by submission id.
 *
 * **One query for the whole set**, not one per record: the answers and the
 * labels have to be read together, and a lookup per row is a query per row to
 * ask the same question.
 *
 * Fields are returned in the form's own order, so the summary reads the way the
 * form did. Unanswered optional fields are left out rather than shown blank — a
 * summary is for confirming what was said, and a list of blanks buries it.
 */
export async function formSummariesFor(
  submissionIds: Array<string | null | undefined>
): Promise<Map<string, FormAnswer[]>> {
  const ids = [...new Set(submissionIds.filter(Boolean))] as string[];
  if (ids.length === 0) return new Map();

  const result = await db.query(
    `SELECT fs.id AS submission_id, fs.submission_data,
            af.name AS field_name, af.label, af.datatype, aff."order"
     FROM form_submissions fs
     JOIN application_form_fields aff ON aff.form_id = fs.form_id
     JOIN application_fields af ON af.id = aff.field_id
     WHERE fs.id = ANY($1::uuid[])
     ORDER BY fs.id, aff."order"`,
    [ids]
  );

  const summaries = new Map<string, FormAnswer[]>();
  for (const row of result.rows) {
    const data = row.submission_data ?? {};
    const display = formatAnswer(data[row.field_name]);
    if (!display) continue;

    const existing = summaries.get(row.submission_id) ?? [];
    existing.push({ label: row.label || row.field_name, value: display });
    summaries.set(row.submission_id, existing);
  }
  return summaries;
}
