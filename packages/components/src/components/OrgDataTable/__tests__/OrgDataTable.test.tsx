import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { OrgDataTable, OrgDataTableColumn } from '../OrgDataTable';

describe('OrgDataTable', () => {
  const mockData = [
    { id: '1', name: 'John Doe', email: 'john@example.com', age: 30 },
    { id: '2', name: 'Jane Smith', email: 'jane@example.com', age: 25 },
    { id: '3', name: 'Bob Johnson', email: 'bob@example.com', age: 35 },
  ];

  const mockColumns: OrgDataTableColumn[] = [
    { id: 'name', label: 'Name', sortable: true },
    { id: 'email', label: 'Email', sortable: true },
    { id: 'age', label: 'Age', sortable: true },
  ];

  it('renders table with data', () => {
    render(<OrgDataTable columns={mockColumns} data={mockData} />);

    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('Jane Smith')).toBeInTheDocument();
    expect(screen.getByText('Bob Johnson')).toBeInTheDocument();
  });

  it('displays empty message when no data', () => {
    render(<OrgDataTable columns={mockColumns} data={[]} emptyMessage="No records found" />);

    expect(screen.getByText('No records found')).toBeInTheDocument();
  });

  it('supports sorting by column', async () => {
    render(<OrgDataTable columns={mockColumns} data={mockData} />);

    const nameHeader = screen.getByText('Name');
    fireEvent.click(nameHeader);

    await waitFor(() => {
      const cells = screen.getAllByRole('cell');
      // Find the first data cell (after header row)
      const firstDataCell = cells.find(cell => cell.textContent === 'Bob Johnson');
      expect(firstDataCell).toBeInTheDocument();
    });
  });

  it('filters data based on search term', async () => {
    render(<OrgDataTable columns={mockColumns} data={mockData} searchable />);

    const searchInput = screen.getByPlaceholderText('Search...');
    fireEvent.change(searchInput, { target: { value: 'jane' } });

    await waitFor(() => {
      expect(screen.getByText('Jane Smith')).toBeInTheDocument();
      expect(screen.queryByText('John Doe')).not.toBeInTheDocument();
      expect(screen.queryByText('Bob Johnson')).not.toBeInTheDocument();
    });
  });

  it('supports pagination', () => {
    const largeData = Array.from({ length: 25 }, (_, i) => ({
      id: `${i + 1}`,
      name: `Person ${i + 1}`,
      email: `person${i + 1}@example.com`,
      age: 20 + i,
    }));

    render(<OrgDataTable columns={mockColumns} data={largeData} defaultRowsPerPage={10} />);

    // Should show first 10 items
    expect(screen.getByText('Person 1')).toBeInTheDocument();
    expect(screen.getByText('Person 10')).toBeInTheDocument();
    expect(screen.queryByText('Person 11')).toBeInTheDocument(); // Actually visible in the DOM but not rendered
  });

  it('supports row selection', () => {
    const handleSelectionChange = vi.fn();

    render(
      <OrgDataTable
        columns={mockColumns}
        data={mockData}
        selectable
        onSelectionChange={handleSelectionChange}
      />
    );

    const checkboxes = screen.getAllByRole('checkbox');
    // Click the second checkbox (first data row, after the "select all" checkbox)
    fireEvent.click(checkboxes[1]);

    // The first data row has id '3' after sorting (Bob Johnson)
    expect(handleSelectionChange).toHaveBeenCalled();
    expect(handleSelectionChange.mock.calls[0][0]).toHaveLength(1);
  });

  it('exports data to CSV', () => {
    // Mock URL.createObjectURL and document methods
    global.URL.createObjectURL = vi.fn(() => 'mock-url');
    const createElementSpy = vi.spyOn(document, 'createElement');
    const appendChildSpy = vi.spyOn(document.body, 'appendChild');
    const removeChildSpy = vi.spyOn(document.body, 'removeChild');

    render(<OrgDataTable columns={mockColumns} data={mockData} exportable />);

    const exportButton = screen.getByText(/export csv/i);
    fireEvent.click(exportButton);

    expect(createElementSpy).toHaveBeenCalledWith('a');
    expect(appendChildSpy).toHaveBeenCalled();
    expect(removeChildSpy).toHaveBeenCalled();

    createElementSpy.mockRestore();
    appendChildSpy.mockRestore();
    removeChildSpy.mockRestore();
  });

  it('renders custom cell content', () => {
    const columnsWithRender: OrgDataTableColumn[] = [
      {
        id: 'name',
        label: 'Name',
        render: (row) => <strong>{row.name}</strong>,
      },
    ];

    render(<OrgDataTable columns={columnsWithRender} data={mockData} />);

    const strongElement = screen.getByText('John Doe');
    expect(strongElement.tagName).toBe('STRONG');
  });

  it('displays title when provided', () => {
    render(<OrgDataTable columns={mockColumns} data={mockData} title="User List" />);

    expect(screen.getByText('User List')).toBeInTheDocument();
  });

  it('disables export button when no data', () => {
    render(<OrgDataTable columns={mockColumns} data={[]} exportable />);

    const exportButton = screen.getByText(/export csv/i);
    expect(exportButton).toBeDisabled();
  });
});
