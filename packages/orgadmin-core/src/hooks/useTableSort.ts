import { useCallback, useMemo, useState } from 'react';
import { sortRows, type SortDirection } from '../utils/sorting';

/**
 * Sorting for a list table.
 *
 * ## Use
 *
 * ```tsx
 * const sort = useTableSort(filteredEvents);
 * …
 * <SortableTableCell sort={sort} field="name">{t('events.table.eventName')}</SortableTableCell>
 * …
 * {sort.rows.map((event) => …)}
 * ```
 *
 * Two changes per table: the header cells that should sort become
 * `SortableTableCell`, and the array the body maps over becomes `sort.rows`.
 *
 * ## Why the hook holds the rows
 *
 * The alternative — a hook that returns only the state, leaving each page to
 * sort for itself — is one line of sorting per table repeated forty times, and
 * forty chances to compare a date as a string. Passing the rows in means the
 * comparison happens once, in `utils/sorting`, and a page cannot get it wrong
 * by not thinking about it.
 *
 * ## Fields that are not fields
 *
 * `field` is a property name by default, which covers most columns. A column
 * showing something derived — a count, a joined name, a formatted total —
 * names an **accessor** instead:
 *
 * ```tsx
 * const sort = useTableSort(members, {
 *   accessors: { name: (m) => `${m.lastName} ${m.firstName}` },
 * });
 * ```
 *
 * Sort by the **value**, not by what is on screen. A money column formatted
 * `€1,240.00` sorts as text into a nonsense order; the number behind it does
 * not. The same goes for a status chip whose label is translated: sorting the
 * raw status keeps the order the same in every language, which is the point of
 * having one.
 */

export interface TableSort<T> {
  /** The column being sorted by, or `null` before the reader has chosen one. */
  field: string | null;
  direction: SortDirection;
  /** Click a heading: first ascending, again descending. */
  toggle: (field: string) => void;
  /** The rows, in that order. */
  rows: T[];
}

export interface UseTableSortOptions<T> {
  /** For columns that are not a plain property of the row. */
  accessors?: Record<string, (row: T) => unknown>;
  /** The column a table opens on, where one is more useful than none. */
  initial?: { field: string; direction?: SortDirection };
  /**
   * The reader's language, for `localeCompare`. Left undefined the browser's
   * own is used, which is right almost everywhere; pass `i18n.language` where a
   * page already has it and the two could disagree.
   */
  locale?: string;
}

export function useTableSort<T>(
  rows: readonly T[],
  options: UseTableSortOptions<T> = {}
): TableSort<T> {
  const { accessors, initial, locale } = options;

  const [field, setField] = useState<string | null>(initial?.field ?? null);
  const [direction, setDirection] = useState<SortDirection>(initial?.direction ?? 'asc');

  const toggle = useCallback((next: string) => {
    setField((current) => {
      if (current === next) {
        setDirection((previous) => (previous === 'asc' ? 'desc' : 'asc'));
        return current;
      }
      /*
       * A new column starts ascending, always. Carrying the previous column's
       * direction over means clicking a heading sometimes sorts the other way
       * for no reason the reader can see.
       */
      setDirection('asc');
      return next;
    });
  }, []);

  const sorted = useMemo(() => {
    /*
     * A list that is not a list is an empty one.
     *
     * Several pages set their rows from `useApi.execute`, which answers `null`
     * on an error and whatever the endpoint sent otherwise — so a state typed
     * `T[]` can hold an object. Before sorting, that read as an empty table;
     * spreading it throws and takes the page down. Sorting is a display
     * concern and should not be the thing that turns a bad response into a
     * white screen.
     */
    if (!Array.isArray(rows)) return [];

    if (!field) return [...rows];

    const accessor = accessors?.[field];
    const valueOf = accessor ?? ((row: T) => (row as Record<string, unknown>)?.[field]);

    return sortRows(rows, valueOf, direction, locale);
    /*
     * `accessors` is an object literal at most call sites, so a new identity
     * every render. Depending on it would re-sort on every render; depending on
     * the field name instead re-sorts when the answer could actually differ.
     */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, field, direction, locale]);

  return { field, direction, toggle, rows: sorted };
}
