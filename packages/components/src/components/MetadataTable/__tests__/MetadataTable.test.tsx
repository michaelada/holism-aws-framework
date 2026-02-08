/**
 * Unit Tests for MetadataTable Component
 * Tests table rendering, sorting, filtering, and pagination interactions
 * Validates: Requirements 22.2
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MetadataTable } from '../MetadataTable';
import type { ObjectDefinition, FieldDefinition } from '../../../types';

// Mock hooks
vi.mock('../../../hooks', () => ({
  useMetadata: vi.fn(),
  useObjectInstances: vi.fn(),
}));

import { useMetadata, useObjectInstances } from '../../../hooks';

describe('MetadataTable', () => {
  const mockUseMetadata = useMetadata as any;
  const mockUseObjectInstances = useObjectInstances as any;

  const mockField: FieldDefinition = {
    shortName: 'name',
    displayName: 'Name',
    description: 'Name field',
    datatype: 'text',
    datatypeProperties: {},
    mandatory: false,
  };

  const mockObjectDef: ObjectDefinition = {
    shortName: 'test_object',
    displayName: 'Test Object',
    description: 'Test object description',
    fields: [{
      fieldShortName: 'name',
      mandatory: false,
      order: 0,
    }],
    displayProperties: {
      tableColumns: ['name'],
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Table Rendering', () => {
    it('should render table with columns from object definition', async () => {
      mockUseMetadata.mockReturnValue({
        objectDef: mockObjectDef,
        fields: [mockField],
        loading: false,
        error: null,
      });

      mockUseObjectInstances.mockReturnValue({
        instances: [],
        pagination: null,
        loading: false,
        error: null,
        fetchInstances: vi.fn(),
      });

      render(<MetadataTable objectType="test_object" />);

      await waitFor(() => {
        expect(screen.getByText('Name')).toBeInTheDocument();
      });
    });

    it('should display instances in table rows', async () => {
      const instances = [
        { id: '1', name: 'Item 1' },
        { id: '2', name: 'Item 2' },
      ];

      mockUseMetadata.mockReturnValue({
        objectDef: mockObjectDef,
        fields: [mockField],
        loading: false,
        error: null,
      });

      mockUseObjectInstances.mockReturnValue({
        instances,
        pagination: null,
        loading: false,
        error: null,
        fetchInstances: vi.fn(),
      });

      render(<MetadataTable objectType="test_object" />);

      await waitFor(() => {
        expect(screen.getByText('Item 1')).toBeInTheDocument();
        expect(screen.getByText('Item 2')).toBeInTheDocument();
      });
    });

    it('should show loading state', () => {
      mockUseMetadata.mockReturnValue({
        objectDef: null,
        fields: [],
        loading: true,
        error: null,
      });

      mockUseObjectInstances.mockReturnValue({
        instances: [],
        pagination: null,
        loading: false,
        error: null,
        fetchInstances: vi.fn(),
      });

      render(<MetadataTable objectType="test_object" />);

      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });

    it('should show error state', async () => {
      mockUseMetadata.mockReturnValue({
        objectDef: null,
        fields: [],
        loading: false,
        error: new Error('Failed to load'),
      });

      mockUseObjectInstances.mockReturnValue({
        instances: [],
        pagination: null,
        loading: false,
        error: null,
        fetchInstances: vi.fn(),
      });

      render(<MetadataTable objectType="test_object" />);

      await waitFor(() => {
        expect(screen.getByText(/Failed to load metadata/)).toBeInTheDocument();
      });
    });

    it('should show "No data available" when no instances', async () => {
      mockUseMetadata.mockReturnValue({
        objectDef: mockObjectDef,
        fields: [mockField],
        loading: false,
        error: null,
      });

      mockUseObjectInstances.mockReturnValue({
        instances: [],
        pagination: null,
        loading: false,
        error: null,
        fetchInstances: vi.fn(),
      });

      render(<MetadataTable objectType="test_object" />);

      await waitFor(() => {
        expect(screen.getByText('No data available')).toBeInTheDocument();
      });
    });
  });

  describe('Sorting', () => {
    it('should trigger sort when clicking column header', async () => {
      const mockFetchInstances = vi.fn();

      mockUseMetadata.mockReturnValue({
        objectDef: mockObjectDef,
        fields: [mockField],
        loading: false,
        error: null,
      });

      mockUseObjectInstances.mockReturnValue({
        instances: [],
        pagination: null,
        loading: false,
        error: null,
        fetchInstances: mockFetchInstances,
      });

      const user = userEvent.setup();
      render(<MetadataTable objectType="test_object" />);

      await waitFor(() => {
        expect(screen.getByText('Name')).toBeInTheDocument();
      });

      const columnHeader = screen.getByText('Name');
      await user.click(columnHeader);

      await waitFor(() => {
        expect(mockFetchInstances).toHaveBeenCalled();
      });
    });
  });

  describe('Filtering', () => {
    it('should show search input when searchableFields are defined', async () => {
      const objectDefWithSearch: ObjectDefinition = {
        ...mockObjectDef,
        displayProperties: {
          ...mockObjectDef.displayProperties,
          searchableFields: ['name'],
        },
      };

      mockUseMetadata.mockReturnValue({
        objectDef: objectDefWithSearch,
        fields: [mockField],
        loading: false,
        error: null,
      });

      mockUseObjectInstances.mockReturnValue({
        instances: [],
        pagination: null,
        loading: false,
        error: null,
        fetchInstances: vi.fn(),
      });

      render(<MetadataTable objectType="test_object" />);

      await waitFor(() => {
        expect(screen.getByLabelText('Search')).toBeInTheDocument();
      });
    });

    it('should not show search input when searchableFields are not defined', async () => {
      mockUseMetadata.mockReturnValue({
        objectDef: mockObjectDef,
        fields: [mockField],
        loading: false,
        error: null,
      });

      mockUseObjectInstances.mockReturnValue({
        instances: [],
        pagination: null,
        loading: false,
        error: null,
        fetchInstances: vi.fn(),
      });

      render(<MetadataTable objectType="test_object" />);

      await waitFor(() => {
        expect(screen.getByText('Name')).toBeInTheDocument();
      });

      expect(screen.queryByLabelText('Search')).not.toBeInTheDocument();
    });
  });

  describe('Pagination', () => {
    it('should display pagination controls when pagination data is available', async () => {
      mockUseMetadata.mockReturnValue({
        objectDef: mockObjectDef,
        fields: [mockField],
        loading: false,
        error: null,
      });

      mockUseObjectInstances.mockReturnValue({
        instances: Array.from({ length: 20 }, (_, i) => ({ id: `${i}`, name: `Item ${i}` })),
        pagination: {
          page: 1,
          pageSize: 20,
          totalItems: 100,
          totalPages: 5,
        },
        loading: false,
        error: null,
        fetchInstances: vi.fn(),
      });

      render(<MetadataTable objectType="test_object" />);

      await waitFor(() => {
        expect(screen.getByText('1–20 of 100')).toBeInTheDocument();
      });
    });
  });

  describe('Row Actions', () => {
    it('should call onRowClick when row is clicked', async () => {
      const onRowClick = vi.fn();
      const instances = [{ id: '1', name: 'Item 1' }];

      mockUseMetadata.mockReturnValue({
        objectDef: mockObjectDef,
        fields: [mockField],
        loading: false,
        error: null,
      });

      mockUseObjectInstances.mockReturnValue({
        instances,
        pagination: null,
        loading: false,
        error: null,
        fetchInstances: vi.fn(),
      });

      const user = userEvent.setup();
      render(<MetadataTable objectType="test_object" onRowClick={onRowClick} />);

      await waitFor(() => {
        expect(screen.getByText('Item 1')).toBeInTheDocument();
      });

      const row = screen.getByText('Item 1').closest('tr');
      if (row) {
        await user.click(row);
      }

      expect(onRowClick).toHaveBeenCalledWith(instances[0]);
    });

    it('should display action buttons when handlers are provided', async () => {
      const instances = [{ id: '1', name: 'Item 1' }];

      mockUseMetadata.mockReturnValue({
        objectDef: mockObjectDef,
        fields: [mockField],
        loading: false,
        error: null,
      });

      mockUseObjectInstances.mockReturnValue({
        instances,
        pagination: null,
        loading: false,
        error: null,
        fetchInstances: vi.fn(),
      });

      render(
        <MetadataTable
          objectType="test_object"
          onEdit={vi.fn()}
          onDelete={vi.fn()}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Actions')).toBeInTheDocument();
      });
    });
  });
});
