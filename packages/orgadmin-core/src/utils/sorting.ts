/**
 * Comparing two cell values, whatever they happen to be.
 *
 * Every list table in org-admin is sorted through here, so the rules live in
 * one place rather than being re-decided per column. Three of them matter:
 *
 * **Type is read from the value, not declared by the column.** A column holds
 * what the row holds — a number, an ISO date, a time, a string — and a call
 * site that had to name the type for each of two hundred columns would name it
 * wrongly somewhere. The one thing that cannot be inferred is *which* value a
 * column shows, which is why `useTableSort` takes accessors and not types.
 *
 * **Empty always sinks.** A blank cell sorts to the bottom ascending *and*
 * descending. Sorting by "Entries closing" to find the events with no closing
 * date is not what anybody is doing; they are looking for the earliest or the
 * latest, and a column of blanks at the top hides it either way.
 *
 * **Text compares the way the reader's language does.** `localeCompare` with
 * `numeric` so "Item 10" follows "Item 9", and `sensitivity: 'base'` so case
 * and accents do not split a list into two alphabets.
 */

export type SortDirection = 'asc' | 'desc';

/** `2026-09-02`, `2026-09-02T14:30:00.000Z`, `2026-09-02 14:30`. */
const ISO_DATE =
  /^\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2})?(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?)?$/;

/** `14:30`, `09:05:00`. A time of day with no date attached. */
const CLOCK_TIME = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/;

const isEmpty = (value: unknown): boolean =>
  value === null || value === undefined || (typeof value === 'string' && value.trim() === '');

/**
 * A value reduced to something two of which can be compared.
 *
 * Dates and times become numbers so that `2026-09-02` and
 * `2026-09-02T14:30:00Z` — the same column carrying both, which happens where
 * one event has a time and another does not — order against each other rather
 * than as text.
 */
function normalise(value: unknown): number | string | boolean {
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number' || typeof value === 'boolean') return value;

  if (typeof value === 'string') {
    const trimmed = value.trim();

    if (ISO_DATE.test(trimmed)) {
      const parsed = Date.parse(trimmed);
      if (!Number.isNaN(parsed)) return parsed;
    }

    const clock = CLOCK_TIME.exec(trimmed);
    if (clock) {
      // Minutes-and-seconds since midnight. A plain string compare gets
      // `9:30` after `14:00`, which is the one thing a time column must not do.
      return Number(clock[1]) * 3600 + Number(clock[2]) * 60 + Number(clock[3] ?? 0);
    }

    return trimmed;
  }

  // An object or an array in a cell: fall back to how it reads.
  return String(value);
}

/**
 * Order two cell values.
 *
 * Returns the ascending comparison; `sortRows` inverts it for descending,
 * except for the empties, which stay at the bottom either way.
 */
export function compareValues(a: unknown, b: unknown, locale?: string): number {
  const left = normalise(a);
  const right = normalise(b);

  if (typeof left === 'string' || typeof right === 'string') {
    return String(left).localeCompare(String(right), locale, {
      numeric: true,
      sensitivity: 'base',
    });
  }

  const leftNumber = Number(left);
  const rightNumber = Number(right);
  if (leftNumber < rightNumber) return -1;
  if (leftNumber > rightNumber) return 1;
  return 0;
}

/**
 * Rows in the order the reader asked for.
 *
 * A copy: sorting the array in place would mutate the caller's state and, for
 * a list held in `useState`, change it without a render. `Array.sort` is
 * stable, so rows the sort cannot separate keep the order they arrived in —
 * which is what makes a second column's sort read as a tie-break rather than
 * as a shuffle.
 */
export function sortRows<T>(
  rows: readonly T[],
  valueOf: (row: T) => unknown,
  direction: SortDirection,
  locale?: string
): T[] {
  // See `useTableSort`: a state typed `T[]` can hold whatever an endpoint sent.
  if (!Array.isArray(rows)) return [];

  const sign = direction === 'desc' ? -1 : 1;

  return [...rows].sort((a, b) => {
    const left = valueOf(a);
    const right = valueOf(b);

    // Empty sinks in both directions, so it is never what the reader is
    // looking at when they sort a column to find the earliest or the largest.
    const leftEmpty = isEmpty(left);
    const rightEmpty = isEmpty(right);
    if (leftEmpty && rightEmpty) return 0;
    if (leftEmpty) return 1;
    if (rightEmpty) return -1;

    return sign * compareValues(left, right, locale);
  });
}
