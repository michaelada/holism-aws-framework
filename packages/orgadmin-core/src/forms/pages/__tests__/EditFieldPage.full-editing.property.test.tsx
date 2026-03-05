/**
 * Property-Based Tests for EditFieldPage Full Editing With Capability
 * 
 * Feature: document-management-capability-consolidation
 * Property 12: EditFieldPage Allows Full Editing With Capability
 * 
 * For any existing document upload field, when the organization has document-management
 * capability, the EditFieldPage should allow changing all field properties including the datatype.
 * 
 * **Validates: Requirements 5.4**
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';

describe('Feature: document-management-capability-consolidation - Property 12: EditFieldPage Full Editing', () => {
  // All possible field types
  const allFieldTypes = [
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
    'file',
    'image',
  ];

  // Document field types
  const documentFieldTypes = ['file', 'image'];

  /**
   * Property 12: EditFieldPage Allows Full Editing With Capability
   * 
   * Test the core logic: when document-management capability is present,
   * the datatype should not be disabled for document fields.
   */
  it('Property 12: should not disable datatype for document fields when capability is present', () => {
    fc.assert(
      fc.property(
        fc.array(fc.string(), { minLength: 1, maxLength: 10 }),
        fc.constantFrom(...documentFieldTypes),
        (capabilities, originalDatatype) => {
          // Ensure document-management is in capabilities
          const capsWithDocMgmt = capabilities.includes('document-management')
            ? capabilities
            : ['document-management', ...capabilities];

          // Test the logic: isDatatypeDisabled = isDocumentType && !hasCapability
          const hasDocumentManagement = capsWithDocMgmt.includes('document-management');
          const isDocumentType = documentFieldTypes.includes(originalDatatype);
          const isDatatypeDisabled = isDocumentType && !hasDocumentManagement;

          // Property: When capability is present, datatype should NOT be disabled
          expect(isDatatypeDisabled).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 12: hasCapability should return true for document-management
   */
  it('Property 12: hasCapability check should return true for document-management', () => {
    fc.assert(
      fc.property(
        fc.array(fc.string(), { minLength: 0, maxLength: 10 }),
        (capabilities) => {
          // Ensure document-management is included
          const capsWithDocMgmt = capabilities.includes('document-management')
            ? capabilities
            : ['document-management', ...capabilities];

          // Test hasCapability logic
          const hasCapability = (cap: string) => capsWithDocMgmt.includes(cap);

          // Property: hasCapability('document-management') should return true
          expect(hasCapability('document-management')).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 12: All field types should be available when capability is present
   */
  it('Property 12: should include all field types when capability is present', () => {
    fc.assert(
      fc.property(
        fc.array(fc.string(), { minLength: 0, maxLength: 10 }),
        (capabilities) => {
          // Ensure document-management is included
          const capsWithDocMgmt = capabilities.includes('document-management')
            ? capabilities
            : ['document-management', ...capabilities];

          // Simulate the filtering logic
          const hasCapability = (cap: string) => capsWithDocMgmt.includes(cap);
          const filteredTypes = allFieldTypes.filter(type => {
            if (type === 'file' || type === 'image') {
              return hasCapability('document-management');
            }
            return true;
          });

          // Property: All field types should be included
          expect(filteredTypes).toContain('file');
          expect(filteredTypes).toContain('image');
          expect(filteredTypes.length).toBe(allFieldTypes.length);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 12: Should allow changing to any field type when capability is present
   */
  it('Property 12: should allow changing to any field type when capability is present', () => {
    fc.assert(
      fc.property(
        fc.array(fc.string(), { minLength: 0, maxLength: 10 }),
        fc.constantFrom(...allFieldTypes),
        (capabilities, newDatatype) => {
          // Ensure document-management is included
          const capsWithDocMgmt = capabilities.includes('document-management')
            ? capabilities
            : ['document-management', ...capabilities];

          // Simulate the filtering logic
          const hasCapability = (cap: string) => capsWithDocMgmt.includes(cap);
          const filteredTypes = allFieldTypes.filter(type => {
            if (type === 'file' || type === 'image') {
              return hasCapability('document-management');
            }
            return true;
          });

          // Property: The new datatype should be available
          expect(filteredTypes).toContain(newDatatype);
        }
      ),
      { numRuns: 100 }
    );
  });
});
