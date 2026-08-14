import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AdminTable, AdminTableColumn } from '../AdminTable';

interface Row {
  id: string;
  name: string;
  count: number;
}

const rows: Row[] = [
  { id: 'a', name: 'Bravo Sailing Club', count: 3 },
  { id: 'b', name: 'Alpha Rowing Club', count: 11 },
  { id: 'c', name: 'Charlie Tennis Club', count: 7 },
];

const columns: AdminTableColumn<Row>[] = [
  { id: 'name', label: 'Name', render: (r) => r.name, sortValue: (r) => r.name },
  { id: 'count', label: 'Count', render: (r) => r.count, sortValue: (r) => r.count },
];

const renderTable = (props: Partial<React.ComponentProps<typeof AdminTable>> = {}) =>
  render(
    <MemoryRouter>
      <AdminTable
        rows={rows}
        columns={columns}
        getRowId={(r: Row) => r.id}
        ariaLabel="Clubs"
        searchFields={(r: Row) => [r.name]}
        {...(props as object)}
      />
    </MemoryRouter>
  );

const bodyRowNames = () => {
  const table = screen.getByRole('table', { name: 'Clubs' });
  const rowEls = within(table).getAllByRole('row');
  // Drop the header row.
  return rowEls.slice(1).map((r) => r.textContent ?? '');
};

describe('AdminTable', () => {
  it('names the table so screen readers can identify it', () => {
    renderTable();
    expect(screen.getByRole('table', { name: 'Clubs' })).toBeInTheDocument();
  });

  it('sorts by a column when its header is activated', () => {
    renderTable();
    expect(bodyRowNames()[0]).toContain('Bravo');

    fireEvent.click(screen.getByRole('button', { name: /Name/ }));
    expect(bodyRowNames()[0]).toContain('Alpha');

    // A second activation reverses the direction.
    fireEvent.click(screen.getByRole('button', { name: /Name/ }));
    expect(bodyRowNames()[0]).toContain('Charlie');
  });

  it('sorts numerically, not lexically', () => {
    renderTable();
    fireEvent.click(screen.getByRole('button', { name: /Count/ }));
    expect(bodyRowNames()[0]).toContain('3');
    expect(bodyRowNames()[2]).toContain('11');
  });

  it('filters on the searchable fields', () => {
    renderTable({ searchPlaceholder: 'Search clubs' });
    fireEvent.change(screen.getByLabelText('Search clubs'), { target: { value: 'alpha' } });
    expect(bodyRowNames()).toHaveLength(1);
    expect(bodyRowNames()[0]).toContain('Alpha');
  });

  it('distinguishes "no matches" from "nothing here"', () => {
    renderTable({ searchPlaceholder: 'Search clubs' });
    fireEvent.change(screen.getByLabelText('Search clubs'), { target: { value: 'zzz' } });
    expect(screen.getByText(/No matches for/)).toBeInTheDocument();
    expect(screen.getByText(/all 3 rows/)).toBeInTheDocument();
  });

  it('shows the supplied empty state when there are genuinely no rows', () => {
    renderTable({ rows: [], emptyState: <span>Create the first club</span> });
    expect(screen.getByText('Create the first club')).toBeInTheDocument();
  });

  it('selects rows and offers a bulk action over the selection', () => {
    const onRun = vi.fn();
    renderTable({
      bulkActions: [{ id: 'block', label: 'Block', onRun }],
    });

    fireEvent.click(screen.getByLabelText('Select row 1'));
    expect(screen.getByText('1 selected')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Block' }));
    expect(onRun).toHaveBeenCalledWith([rows[0]]);
  });

  it('selects every row on the page from the header checkbox', () => {
    const onRun = vi.fn();
    renderTable({ bulkActions: [{ id: 'block', label: 'Block', onRun }] });

    fireEvent.click(screen.getByLabelText('Select all rows on this page'));
    fireEvent.click(screen.getByRole('button', { name: 'Block' }));

    expect(onRun.mock.calls[0][0]).toHaveLength(3);
  });

  it('clears the selection when the filter changes, so a bulk action cannot reach hidden rows', () => {
    const onRun = vi.fn();
    renderTable({
      searchPlaceholder: 'Search clubs',
      bulkActions: [{ id: 'block', label: 'Block', onRun }],
    });

    fireEvent.click(screen.getByLabelText('Select row 1'));
    expect(screen.getByText('1 selected')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Search clubs'), { target: { value: 'alpha' } });
    expect(screen.queryByText('1 selected')).not.toBeInTheDocument();
  });

  it('opens the focused row on Enter', () => {
    const onRowOpen = vi.fn();
    renderTable({ onRowOpen });

    const table = screen.getByRole('table', { name: 'Clubs' });
    fireEvent.keyDown(table, { key: 'j' });
    fireEvent.keyDown(table, { key: 'Enter' });

    expect(onRowOpen).toHaveBeenCalledWith(rows[0]);
  });

  it('creates from the keyboard', () => {
    const onCreate = vi.fn();
    renderTable({ onCreate });
    fireEvent.keyDown(screen.getByRole('table', { name: 'Clubs' }), { key: 'n' });
    expect(onCreate).toHaveBeenCalled();
  });

  it('does not fire shortcuts while the operator is typing in the search box', () => {
    const onCreate = vi.fn();
    renderTable({ onCreate, searchPlaceholder: 'Search clubs' });

    fireEvent.keyDown(screen.getByLabelText('Search clubs'), { key: 'n' });
    expect(onCreate).not.toHaveBeenCalled();
  });
});
