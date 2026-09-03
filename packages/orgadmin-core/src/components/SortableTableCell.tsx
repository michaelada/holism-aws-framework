import React from 'react';
import { TableCell, TableSortLabel, type TableCellProps } from '@mui/material';
import type { TableSort } from '../hooks/useTableSort';

export interface SortableTableCellProps extends Omit<TableCellProps, 'sortDirection'> {
  /** The `useTableSort` result this table shares. */
  sort: TableSort<any>;
  /** The row property, or the accessor name, this column shows. */
  field: string;
}

/**
 * A column heading the reader can sort by.
 *
 * A drop-in replacement for `TableCell` in a `TableHead`, taking the same
 * props:
 *
 * ```tsx
 * <SortableTableCell sort={sort} field="name" align="right">
 *   {t('events.table.eventName')}
 * </SortableTableCell>
 * ```
 *
 * **`TableSortLabel` rather than an onClick and an arrow of our own.** It is a
 * button, so the heading is reachable by keyboard and announced as one; the
 * arrow appears on hover before a column is sorted, which is how a reader
 * discovers that any of this is possible; and the active column's direction is
 * read out rather than only drawn.
 *
 * `sortDirection` on the cell is what becomes `aria-sort`, and it is set on the
 * active column **only** — every column claiming a direction tells a screen
 * reader the table is sorted six ways at once.
 */
export const SortableTableCell: React.FC<SortableTableCellProps> = ({
  sort,
  field,
  children,
  ...rest
}) => {
  const active = sort.field === field;

  return (
    <TableCell {...rest} sortDirection={active ? sort.direction : false}>
      <TableSortLabel
        active={active}
        direction={active ? sort.direction : 'asc'}
        onClick={() => sort.toggle(field)}
      >
        {children}
      </TableSortLabel>
    </TableCell>
  );
};

export default SortableTableCell;
