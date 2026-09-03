import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { Table, TableBody, TableCell, TableHead, TableRow } from '@mui/material';
import { SortableTableCell } from '../SortableTableCell';
import { useTableSort } from '../../hooks/useTableSort';

/**
 * A column heading the reader can sort by, and the hook behind it.
 *
 * Tested together and through a real table, because the behaviour worth
 * checking is the interaction: clicking a heading twice reverses it, clicking a
 * *different* heading starts again ascending rather than inheriting the last
 * column's direction, and only the active column claims an `aria-sort`.
 */

interface Entry {
  name: string;
  entered: string;
  fee: number;
  activity: string;
}

const ENTRIES: Entry[] = [
  { name: 'Bríd McNamara', entered: '2026-08-22', fee: 40, activity: 'Open class' },
  { name: 'aoife Regan', entered: '2026-09-01', fee: 30, activity: 'Junior class' },
  { name: 'Colm Fitzgerald', entered: '2026-07-14', fee: 125, activity: 'Open class' },
];

const EntriesTable: React.FC<{ initial?: { field: string; direction?: 'asc' | 'desc' } }> = ({
  initial,
}) => {
  const sort = useTableSort(ENTRIES, {
    initial,
    accessors: { fee: (entry) => entry.fee },
    locale: 'en-GB',
  });

  return (
    <Table>
      <TableHead>
        <TableRow>
          <SortableTableCell sort={sort} field="name">
            Name
          </SortableTableCell>
          <SortableTableCell sort={sort} field="entered">
            Entered
          </SortableTableCell>
          <SortableTableCell sort={sort} field="fee" align="right">
            Fee
          </SortableTableCell>
          <TableCell>Actions</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {sort.rows.map((entry) => (
          <TableRow key={entry.name}>
            <TableCell>{entry.name}</TableCell>
            <TableCell>{entry.entered}</TableCell>
            <TableCell align="right">{entry.fee}</TableCell>
            <TableCell>—</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
};

const names = () =>
  screen
    .getAllByRole('row')
    .slice(1)
    .map((row) => within(row).getAllByRole('cell')[0].textContent);

const heading = (label: string) => screen.getByRole('button', { name: label });

describe('sorting a table by its column headings', () => {
  it('leaves the rows as they came until a heading is clicked', () => {
    render(<EntriesTable />);

    expect(names()).toEqual(['Bríd McNamara', 'aoife Regan', 'Colm Fitzgerald']);
  });

  it('sorts ascending on the first click and descending on the second', () => {
    render(<EntriesTable />);

    fireEvent.click(heading('Entered'));
    expect(names()).toEqual(['Colm Fitzgerald', 'Bríd McNamara', 'aoife Regan']);

    fireEvent.click(heading('Entered'));
    expect(names()).toEqual(['aoife Regan', 'Bríd McNamara', 'Colm Fitzgerald']);
  });

  it('starts a different column ascending rather than inheriting the last one', () => {
    render(<EntriesTable />);

    fireEvent.click(heading('Entered'));
    fireEvent.click(heading('Entered')); // now descending
    fireEvent.click(heading('Fee'));

    expect(names()).toEqual(['aoife Regan', 'Bríd McNamara', 'Colm Fitzgerald']);
  });

  it('sorts a number column by size', () => {
    render(<EntriesTable />);

    fireEvent.click(heading('Fee'));
    expect(names()).toEqual(['aoife Regan', 'Bríd McNamara', 'Colm Fitzgerald']);

    fireEvent.click(heading('Fee'));
    expect(names()).toEqual(['Colm Fitzgerald', 'Bríd McNamara', 'aoife Regan']);
  });

  it('ignores case, so a list is one alphabet rather than two', () => {
    render(<EntriesTable />);

    fireEvent.click(heading('Name'));
    expect(names()).toEqual(['aoife Regan', 'Bríd McNamara', 'Colm Fitzgerald']);
  });

  it('opens on the column a table names, in the direction it asks for', () => {
    render(<EntriesTable initial={{ field: 'entered', direction: 'desc' }} />);

    expect(names()).toEqual(['aoife Regan', 'Bríd McNamara', 'Colm Fitzgerald']);
  });

  it('tells a screen reader which column is sorted, and only that one', () => {
    render(<EntriesTable />);

    fireEvent.click(heading('Entered'));

    const headers = screen.getAllByRole('columnheader');
    expect(headers.map((header) => header.getAttribute('aria-sort'))).toEqual([
      null,
      'ascending',
      null,
      null,
    ]);
  });

  it('leaves a column with no sort alone', () => {
    render(<EntriesTable />);

    // "Actions" is a plain heading: nothing to click, nothing to announce.
    expect(screen.queryByRole('button', { name: 'Actions' })).not.toBeInTheDocument();
  });
});
