/**
 * Property-Based Tests for MetadataTable Filtering
 * Feature: aws-web-app-framework, Property 22: Table Filtering
 * Validates: Requirements 14.8
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

describe('MetadataTable - Property 22: Table Filtering', () => {
  const mockUseMetadata = useMetadata as any;
  const mockUseObjectInstances = useObjectInstances as any;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  /**
   * Property 22: Table Filtering
   * For any MetadataTable with a search input, entering a search term should filter
   * the displayed rows to only those matching the search term in searchable fields.
   */
  it('should filter instances based on search term', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 20 }).filter(s => {
          // Filter out special characters that cause userEvent.type() to fail
          // Only allow alphanumeric characters, spaces, and basic punctuation
          return /^[a-zA-Z0-9\s\-_.]+$/.test(s);
        }),
        async (searchTerm) => {
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
              searchableFields: ['name'],
              tableColumns: ['name'],
            },
          };

          let capturedSearchTerm: string | undefined;

          mockUseMetadata.mockReturnValue({
            objectDef,
            fields: [field],
            loading: false,
            error: null,
          });

          const mockFetchInstances = vi.fn((params?: any) => {
            capturedSearchTerm = params?.search;
          });

          mockUseObjectInstances.mockReturnValue({
            instances: [],
            pagination: null,
            loading: false,
            error: null,
            fetchInstances: mockFetchInstances,
          });

          const user = userEvent.setup();
          const { container } = render(<MetadataTable objectType="test_object" />);

          // Wait for initial render - use container to find search input
          await waitFor(() => {
            const searchInput = container.querySelector('input[placeholder*="Search"]');
            expect(searchInput).toBeTruthy();
          });

          // Enter search term
          const searchInput = container.querySelector('input[placeholder*="Search"]') as HTMLInputElement;
          if (searchInput) {
            await user.type(searchInput, searchTerm);

            // Wait for debounced search to trigger (300ms debounce + buffer)
            await waitFor(
              () => {
                expect(capturedSearchTerm).toBe(searchTerm);
              },
              { timeout: 1000 }
            );
          }
          
          // Clean up after test
          cleanup();
        }
      ),
      { numRuns: 5, timeout: 10000 }
    );
  });

  it('should only show search input when searchableFields are defined', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.boolean(),
        async (hasSearchableFields) => {
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
              searchableFields: hasSearchableFields ? ['name'] : undefined,
              tableColumns: ['name'],
            },
          };

          mockUseMetadata.mockReturnValue({
            objectDef,
            fields: [field],
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

          const { container } = render(<MetadataTable objectType="test_object" />);

          await waitFor(() => {
            const headers = container.querySelectorAll('th');
            expect(headers.length).toBeGreaterThan(0);
          });

          const searchInput = container.querySelector('input[placeholder*="Search"]');
          
          if (hasSearchableFields) {
            expect(searchInput).toBeTruthy();
          } else {
            expect(searchInput).toBeFalsy();
          }
          
          // Clean up after test
          cleanup();
        }
      ),
      { numRuns: 5, timeout: 10000 }
    );
  });
});
