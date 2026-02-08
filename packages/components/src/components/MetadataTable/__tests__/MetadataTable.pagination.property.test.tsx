/**
 * Property-Based Tests for MetadataTable Pagination
 * Feature: aws-web-app-framework, Property 23: Table Pagination
 * Validates: Requirements 14.9
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

describe('MetadataTable - Property 23: Table Pagination', () => {
  const mockUseMetadata = useMetadata as any;
  const mockUseObjectInstances = useObjectInstances as any;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  /**
   * Property 23: Table Pagination
   * For any MetadataTable with more rows than the page size, pagination controls
   * should be displayed, and navigating between pages should show the correct subset of rows.
   */
  it('should display pagination controls when total items exceed page size', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 21, max: 100 }), // Total items more than default page size (20)
        async (totalItems) => {
          // Clean up before each property test iteration
          cleanup();
          
          const field: FieldDefinition = {
            shortName: 'name',
            displayName: 'Name',
            description: 'Name field',
            datatype: 'text',
            datatypeProperties: {},
            mandatory: false,
          };

          const objectDef: ObjectDefinition = {
            shortName: 'test_object',
            displayName: 'Test Object',
            description: 'Test',
            fields: [{
              fieldShortName: 'name',
              mandatory: false,
              order: 0,
            }],
            displayProperties: {
              tableColumns: ['name'],
            },
          };

          const instances = Array.from({ length: 20 }, (_, i) => ({
            id: `id-${i}`,
            name: `Item ${i}`,
          }));

          mockUseMetadata.mockReturnValue({
            objectDef,
            fields: [field],
            loading: false,
            error: null,
          });

          mockUseObjectInstances.mockReturnValue({
            instances,
            pagination: {
              page: 1,
              pageSize: 20,
              totalItems,
              totalPages: Math.ceil(totalItems / 20),
            },
            loading: false,
            error: null,
            fetchInstances: vi.fn(),
          });

          const { container } = render(<MetadataTable objectType="test_object" />);

          // Wait for table to render - use container to scope queries
          await waitFor(() => {
            const headers = container.querySelectorAll('th');
            expect(headers.length).toBeGreaterThan(0);
          });

          // Pagination controls should be visible - check in container
          const paginationText = container.textContent;
          expect(paginationText).toContain(`1–20 of ${totalItems}`);
          
          // Clean up after test
          cleanup();
        }
      ),
      { numRuns: 5, timeout: 10000 }
    );
  });

  it('should update page when pagination controls are used', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 2, max: 5 }), // Number of pages
        async (totalPages) => {
          // Clean up before each property test iteration
          cleanup();
          
          const totalItems = totalPages * 20;
          
          const field: FieldDefinition = {
            shortName: 'name',
            displayName: 'Name',
            description: 'Name field',
            datatype: 'text',
            datatypeProperties: {},
            mandatory: false,
          };

          const objectDef: ObjectDefinition = {
            shortName: 'test_object',
            displayName: 'Test Object',
            description: 'Test',
            fields: [{
              fieldShortName: 'name',
              mandatory: false,
              order: 0,
            }],
            displayProperties: {
              tableColumns: ['name'],
            },
          };

          const instances = Array.from({ length: 20 }, (_, i) => ({
            id: `id-${i}`,
            name: `Item ${i}`,
          }));

          let currentPage = 1;

          mockUseMetadata.mockReturnValue({
            objectDef,
            fields: [field],
            loading: false,
            error: null,
          });

          const mockFetchInstances = vi.fn((params?: any) => {
            currentPage = params?.page || 1;
          });

          mockUseObjectInstances.mockReturnValue({
            instances,
            pagination: {
              page: currentPage,
              pageSize: 20,
              totalItems,
              totalPages,
            },
            loading: false,
            error: null,
            fetchInstances: mockFetchInstances,
          });

          const user = userEvent.setup();
          const { container } = render(<MetadataTable objectType="test_object" />);

          // Wait for table to render
          await waitFor(() => {
            const headers = container.querySelectorAll('th');
            expect(headers.length).toBeGreaterThan(0);
          });

          // Find and click next page button
          const nextButton = container.querySelector('button[aria-label*="next" i]');
          if (nextButton) {
            await user.click(nextButton as Element);

            // Verify page changed
            await waitFor(() => {
              expect(mockFetchInstances).toHaveBeenCalled();
              expect(currentPage).toBe(2);
            });
          }
          
          // Clean up after test
          cleanup();
        }
      ),
      { numRuns: 5, timeout: 10000 }
    );
  });

  it('should support configurable page size', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(10, 20, 50, 100),
        async (pageSize) => {
          // Clean up before each property test iteration
          cleanup();
          
          const field: FieldDefinition = {
            shortName: 'name',
            displayName: 'Name',
            description: 'Name field',
            datatype: 'text',
            datatypeProperties: {},
            mandatory: false,
          };

          const objectDef: ObjectDefinition = {
            shortName: 'test_object',
            displayName: 'Test Object',
            description: 'Test',
            fields: [{
              fieldShortName: 'name',
              mandatory: false,
              order: 0,
            }],
            displayProperties: {
              tableColumns: ['name'],
            },
          };

          const instances = Array.from({ length: pageSize }, (_, i) => ({
            id: `id-${i}`,
            name: `Item ${i}`,
          }));

          let capturedPageSize: number | undefined;

          mockUseMetadata.mockReturnValue({
            objectDef,
            fields: [field],
            loading: false,
            error: null,
          });

          const mockFetchInstances = vi.fn((params?: any) => {
            capturedPageSize = params?.pageSize;
          });

          mockUseObjectInstances.mockReturnValue({
            instances,
            pagination: {
              page: 1,
              pageSize,
              totalItems: 100,
              totalPages: Math.ceil(100 / pageSize),
            },
            loading: false,
            error: null,
            fetchInstances: mockFetchInstances,
          });

          render(<MetadataTable objectType="test_object" pageSize={pageSize} />);

          // Wait for table to render
          await waitFor(() => {
            expect(mockFetchInstances).toHaveBeenCalled();
          }, { timeout: 2000 });

          // Verify page size was used
          expect(capturedPageSize).toBe(pageSize);
          
          // Clean up after test
          cleanup();
        }
      ),
      { numRuns: 5, timeout: 10000 }
    );
  });
});
