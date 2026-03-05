/**
 * Property-Based Tests for CreateFieldPage Field Type Visibility
 * 
 * Feature: document-management-capability-consolidation
 * Property 4: CreateFieldPage Shows Document Types With Capability
 * Property 5: CreateFieldPage Hides Document Types Without Capability
 * Property 8: Non-Document Field Types Always Visible
 * 
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.9**
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import fc from 'fast-check';
import { useFilteredFieldTypes } from '../../hooks/useFilteredFieldTypes';

// Mock the dependencies
vi.mock('@aws-web-framework/orgadmin-shell', () => ({
  useCapabilities: vi.fn(),
}));

import { useCapabilities } from '@aws-web-framework/orgadmin-shell';

describe('Feature: document-management-capability-consolidation - CreateFieldPage Field Type Visibility', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // Non-document field types that should always be visible
  const nonDocumentFieldTypes = [
    'text',
    'textarea',
    'number',
    'email',
    'phone',
    'date',
    'time',
    'datetime',
    'boolean',
    'select',
    'multiselect',
    'radio',
    'checkbox',
  ];

  // Document field types that require capability
  const documentFieldTypes = ['file', 'image'];

  // Arbitrary for generating capability arrays
  const capabilitiesWithDocumentManagementArb = fc.array(
    fc.string(),
    { minLength: 0, maxLength: 10 }
  ).map(caps => {
    // Ensure 'document-management' is included
    if (!caps.includes('document-management')) {
      return ['document-management', ...caps];
    }
    return caps;
  });

  const capabilitiesWithoutDocumentManagementArb = fc.array(
    fc.string().filter(s => s !== 'document-management'),
    { minLength: 0, maxLength: 10 }
  );

  /**
   * Property 4: CreateFieldPage Shows Document Types With Capability
   * 
   * For any capability set that includes 'document-management',
   * when rendering CreateFieldPage, the field type dropdown should
   * include both 'file' and 'image' options.
   */
  it('Property 4: should show file and image field types when document-management capability is present', async () => {
    await fc.assert(
      fc.asyncProperty(
        capabilitiesWithDocumentManagementArb,
        async (capabilities) => {
          // Mock the capabilities hook
          vi.mocked(useCapabilities).mockReturnValue({
            capabilities,
            loading: false,
            error: null,
            hasCapability: (cap: string) => capabilities.includes(cap),
            refetch: vi.fn(),
          });

          // Render the hook
          const { result } = renderHook(() => useFilteredFieldTypes());

          // Property: Both file and image should be present
          expect(result.current).toContain('file');
          expect(result.current).toContain('image');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 5: CreateFieldPage Hides Document Types Without Capability
   * 
   * For any capability set that does not include 'document-management',
   * when rendering CreateFieldPage, the field type dropdown should not
   * include 'file' or 'image' options.
   */
  it('Property 5: should hide file and image field types when document-management capability is absent', async () => {
    await fc.assert(
      fc.asyncProperty(
        capabilitiesWithoutDocumentManagementArb,
        async (capabilities) => {
          // Mock the capabilities hook
          vi.mocked(useCapabilities).mockReturnValue({
            capabilities,
            loading: false,
            error: null,
            hasCapability: (cap: string) => capabilities.includes(cap),
            refetch: vi.fn(),
          });

          // Render the hook
          const { result } = renderHook(() => useFilteredFieldTypes());

          // Property: Neither file nor image should be present
          expect(result.current).not.toContain('file');
          expect(result.current).not.toContain('image');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 8: Non-Document Field Types Always Visible
   * 
   * For any capability set (including empty), when rendering CreateFieldPage,
   * all non-document field types (text, number, email, date, etc.) should
   * always be present in the field type dropdown.
   */
  it('Property 8: should always show non-document field types regardless of capabilities', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.string(), { minLength: 0, maxLength: 10 }),
        async (capabilities) => {
          // Mock the capabilities hook
          vi.mocked(useCapabilities).mockReturnValue({
            capabilities,
            loading: false,
            error: null,
            hasCapability: (cap: string) => capabilities.includes(cap),
            refetch: vi.fn(),
          });

          // Render the hook
          const { result } = renderHook(() => useFilteredFieldTypes());

          // Check that all non-document field types are present
          for (const fieldType of nonDocumentFieldTypes) {
            // Property: All non-document field types should be present
            expect(result.current).toContain(fieldType);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Additional test: Verify capability check is consistent
   * 
   * This test ensures that the presence/absence of document field types
   * is directly correlated with the document-management capability.
   */
  it('should consistently apply capability check for document field types', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.boolean(),
        fc.array(fc.string().filter(s => s !== 'document-management'), { minLength: 0, maxLength: 10 }),
        async (hasDocumentManagement, otherCapabilities) => {
          // Build capability array based on the boolean
          const capabilities = hasDocumentManagement
            ? ['document-management', ...otherCapabilities]
            : otherCapabilities;

          // Mock the capabilities hook
          vi.mocked(useCapabilities).mockReturnValue({
            capabilities,
            loading: false,
            error: null,
            hasCapability: (cap: string) => capabilities.includes(cap),
            refetch: vi.fn(),
          });

          // Render the hook
          const { result } = renderHook(() => useFilteredFieldTypes());

          // Check for document field types
          const hasFile = result.current.includes('file');
          const hasImage = result.current.includes('image');

          // Property: Document types should be present if and only if capability is present
          if (hasDocumentManagement) {
            expect(hasFile).toBe(true);
            expect(hasImage).toBe(true);
          } else {
            expect(hasFile).toBe(false);
            expect(hasImage).toBe(false);
          }

          // Property: Both document types should have the same visibility
          expect(hasFile).toBe(hasImage);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Additional test: Verify non-document types are unaffected by capability
   * 
   * This test ensures that non-document field types remain visible
   * regardless of whether document-management capability is present.
   */
  it('should not affect non-document field types based on document-management capability', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.boolean(),
        async (hasDocumentManagement) => {
          // Build capability array
          const capabilities = hasDocumentManagement ? ['document-management'] : [];

          // Mock the capabilities hook
          vi.mocked(useCapabilities).mockReturnValue({
            capabilities,
            loading: false,
            error: null,
            hasCapability: (cap: string) => capabilities.includes(cap),
            refetch: vi.fn(),
          });

          // Render the hook
          const { result } = renderHook(() => useFilteredFieldTypes());

          // Sample a few non-document field types to verify they're present
          const sampleTypes = ['text', 'number', 'email', 'date', 'boolean'];
          
          for (const fieldType of sampleTypes) {
            // Property: Non-document types should always be present
            expect(result.current).toContain(fieldType);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
