/**
 * Property-Based Tests for MetadataTable Sorting
 * Feature: aws-web-app-framework, Property 21: Table Sorting
 * Validates: Requirements 14.7
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as fc from 'fast-check';
import { MetadataTable } from '../MetadataTable';
import type { ObjectDefinition, FieldDefinition } from '../../../types';

// Mock hooks
vi.mock('../../../hooks', () => ({
  useMetadata: vi.fn(),
  useObjectInstances: vi.fn(),
}));

import { useMetadata, useObjectInstances } from '../../../hooks';

describe('MetadataTable - Property 21: Table Sorting', () => {
  const mockUseMetadata = useMetadata as any;
  const mockUseObjectInstances = useObjectInstances as any;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  /**
   * Property 21: Table Sorting
   * For any MetadataTable displaying instances, clicking a column header should toggle
   * the sort order (ascending/descending) for that column, and the displayed rows
   * should reflect the new sort order.
   */
  it('should toggle sort order when clicking column headers', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate field definitions
        fc.array(
          fc.record({
            shortName: fc.stringMatching(/^[a-z_][a-z0-9_]*$/),
            displayName: fc.string({ minLength: 1, maxLength: 50 }),
            description: fc.string({ maxLength: 100 }),
            datatype: fc.constantFrom('text', 'number', 'date'),
            datatypeProperties: fc.constant({}),
            mandatory: fc.boolean(),
          }),
          { minLength: 1, maxLength: 3 }
        ),
        // Generate instances
        fc.integer({ min: 2, max: 10 }),
        async (fields, instanceCount) => {
          // Clean up before each property test iteration
          cleanup();
          
          // Create object definition
          const objectDef: ObjectDefinition = {
            shortName: 'test_object',
            displayName: 'Test Object',
            description: 'Test',
            fields: fields.map((f, i) => ({
              fieldShortName: f.shortName,
              mandatory: f.mandatory,
              order: i,
            })),
            displayProperties: {
              tableColumns: fields.map(f => f.shortName),
            },
          };

          // Generate instances with sortable values
          const instances = Array.from({ length: instanceCount }, (_, i) => {
            const instance: any = { id: `id-${i}` };
            fields.forEach(field => {
              if (field.datatype === 'number') {
                instance[field.shortName] = i * 10;
              } else if (field.datatype === 'date') {
                instance[field.shortName] = new Date(2024, 0, i + 1).toISOString();
              } else {
                instance[field.shortName] = `value-${String(i).padStart(3, '0')}`;
              }
            });
            return instance;
          });

          let currentSortBy: string | undefined;
          let currentSortOrder: 'asc' | 'desc' = 'asc';

          // Mock hooks
          mockUseMetadata.mockReturnValue({
            objectDef,
            fields: fields as FieldDefinition[],
            loading: false,
            error: null,
          });

          const mockFetchInstances = vi.fn((params?: any) => {
            currentSortBy = params?.sortBy;
            currentSortOrder = params?.sortOrder || 'asc';
          });

          mockUseObjectInstances.mockReturnValue({
            instances,
            pagination: {
              page: 1,
              pageSize: 20,
              totalItems: instances.length,
              totalPages: 1,
            },
            loading: false,
            error: null,
            fetchInstances: mockFetchInstances,
          });

          const user = userEvent.setup();
          const { container } = render(<MetadataTable objectType="test_object" />);

          // Wait for initial render - use container to scope queries
          await waitFor(() => {
            const headers = container.querySelectorAll('th');
            expect(headers.length).toBeGreaterThan(0);
          });

          // Click first column header to sort
          const firstColumnHeader = container.querySelector('th .MuiTableSortLabel-root');
          if (firstColumnHeader) {
            await user.click(firstColumnHeader as Element);

            // Verify sort was triggered
            await waitFor(() => {
              expect(mockFetchInstances).toHaveBeenCalled();
              expect(currentSortBy).toBe(fields[0].shortName);
              expect(currentSortOrder).toBe('asc');
            });

            // Click again to toggle sort order
            await user.click(firstColumnHeader as Element);

            await waitFor(() => {
              expect(currentSortOrder).toBe('desc');
            });
          }
          
          // Clean up after test
          cleanup();
        }
      ),
      { numRuns: 5, timeout: 10000 }
    );
  });

  it('should use default sort field from object definition', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          shortName: fc.stringMatching(/^[a-z_][a-z0-9_]*$/),
          displayName: fc.string({ minLength: 1, maxLength: 50 }),
          description: fc.string({ maxLength: 100 }),
          datatype: fc.constantFrom('text', 'number'),
          datatypeProperties: fc.constant({}),
          mandatory: fc.boolean(),
        }),
        fc.constantFrom('asc', 'desc'),
        async (field, defaultSortOrder) => {
          // Clean up before each property test iteration
          cleanup();
          
          const objectDef: ObjectDefinition = {
            shortName: 'test_object',
            displayName: 'Test Object',
            description: 'Test',
            fields: [{
              fieldShortName: field.shortName,
              mandatory: field.mandatory,
              order: 0,
            }],
            displayProperties: {
              defaultSortField: field.shortName,
              defaultSortOrder: defaultSortOrder as 'asc' | 'desc',
              tableColumns: [field.shortName],
            },
          };

          let capturedSortBy: string | undefined;
          let capturedSortOrder: 'asc' | 'desc' | undefined;

          mockUseMetadata.mockReturnValue({
            objectDef,
            fields: [field] as FieldDefinition[],
            loading: false,
            error: null,
          });

          const mockFetchInstances = vi.fn((params?: any) => {
            capturedSortBy = params?.sortBy;
            capturedSortOrder = params?.sortOrder;
          });

          mockUseObjectInstances.mockReturnValue({
            instances: [],
            pagination: null,
            loading: false,
            error: null,
            fetchInstances: mockFetchInstances,
          });

          render(<MetadataTable objectType="test_object" />);

          // Wait for component to initialize and apply default sort
          await waitFor(() => {
            expect(mockFetchInstances).toHaveBeenCalled();
          }, { timeout: 2000 });

          // Verify default sort was applied
          expect(capturedSortBy).toBe(field.shortName);
          expect(capturedSortOrder).toBe(defaultSortOrder);
          
          // Clean up after test
          cleanup();
        }
      ),
      { numRuns: 5, timeout: 10000 }
    );
  });
});
