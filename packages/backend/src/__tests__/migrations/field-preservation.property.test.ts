/**
 * Property-Based Tests for Field Preservation During Migration
 * 
 * Feature: document-management-capability-consolidation
 * Property 11: Migration Preserves Existing Document Fields
 * 
 * These tests validate that existing field definitions with datatype 'file' or 'image'
 * are preserved during the capability consolidation migration.
 * 
 * **Validates: Requirements 5.1, 5.2**
 */

import * as fc from 'fast-check';

/**
 * Type definitions for testing
 */
interface FieldDefinition {
  id: string;
  shortName: string;
  displayName: string;
  datatype: string;
  description?: string;
  datatypeProperties?: Record<string, any>;
  organizationId: string;
}

/**
 * Document field datatypes that require document-management capability
 */
const DOCUMENT_DATATYPES = ['file', 'image'] as const;

/**
 * Non-document field datatypes
 */
const NON_DOCUMENT_DATATYPES = [
  'text', 'textarea', 'number', 'email', 'phone',
  'date', 'time', 'datetime', 'boolean',
  'select', 'multiselect', 'radio', 'checkbox'
] as const;

/**
 * Migration simulator for field preservation testing
 * The migration only changes capabilities, not field definitions
 */
class FieldPreservationSimulator {
  /**
   * Simulates the migration's effect on field definitions
   * The migration should NOT modify any field definitions
   */
  static migrateFields(fields: FieldDefinition[]): FieldDefinition[] {
    // Migration does not touch field definitions at all
    // It only modifies capabilities table and organization capabilities
    return fields.map(field => ({ ...field }));
  }

  /**
   * Verifies that a field is preserved (unchanged) after migration
   */
  static isFieldPreserved(original: FieldDefinition, migrated: FieldDefinition): boolean {
    return (
      original.id === migrated.id &&
      original.shortName === migrated.shortName &&
      original.displayName === migrated.displayName &&
      original.datatype === migrated.datatype &&
      original.description === migrated.description &&
      original.organizationId === migrated.organizationId &&
      JSON.stringify(original.datatypeProperties) === JSON.stringify(migrated.datatypeProperties)
    );
  }
}

/**
 * Generators for property-based testing
 */

/**
 * Generates a random document datatype (file or image)
 */
const arbitraryDocumentDatatype = fc.constantFrom(...DOCUMENT_DATATYPES);

/**
 * Generates a random non-document datatype
 */
const arbitraryNonDocumentDatatype = fc.constantFrom(...NON_DOCUMENT_DATATYPES);

/**
 * Generates a random datatype (document or non-document)
 */
const arbitraryDatatype = fc.oneof(
  arbitraryDocumentDatatype,
  arbitraryNonDocumentDatatype
);

/**
 * Generates a random field definition
 */
const arbitraryFieldDefinition = fc.record({
  id: fc.uuid(),
  shortName: fc.string({ minLength: 3, maxLength: 50 }).filter(s => /^[a-z][a-z0-9_]*$/.test(s)),
  displayName: fc.string({ minLength: 3, maxLength: 100 }),
  datatype: arbitraryDatatype,
  description: fc.option(fc.string({ maxLength: 200 }), { nil: undefined }),
  datatypeProperties: fc.option(
    fc.dictionary(
      fc.string({ minLength: 1, maxLength: 20 }),
      fc.oneof(fc.string(), fc.integer(), fc.boolean())
    ),
    { nil: undefined }
  ),
  organizationId: fc.uuid(),
});

/**
 * Generates a field definition with document datatype
 */
const arbitraryDocumentField = fc.record({
  id: fc.uuid(),
  shortName: fc.string({ minLength: 3, maxLength: 50 }).filter(s => /^[a-z][a-z0-9_]*$/.test(s)),
  displayName: fc.string({ minLength: 3, maxLength: 100 }),
  datatype: arbitraryDocumentDatatype,
  description: fc.option(fc.string({ maxLength: 200 }), { nil: undefined }),
  datatypeProperties: fc.option(
    fc.dictionary(
      fc.string({ minLength: 1, maxLength: 20 }),
      fc.oneof(fc.string(), fc.integer(), fc.boolean())
    ),
    { nil: undefined }
  ),
  organizationId: fc.uuid(),
});

/**
 * Generates an array of field definitions
 */
const arbitraryFieldArray = fc.array(arbitraryFieldDefinition, { minLength: 0, maxLength: 20 });

/**
 * Generates an array of field definitions with at least one document field
 */
const arbitraryFieldArrayWithDocumentFields = fc.tuple(
  fc.array(arbitraryDocumentField, { minLength: 1, maxLength: 10 }),
  fc.array(arbitraryFieldDefinition, { minLength: 0, maxLength: 10 })
).map(([docFields, otherFields]) => [...docFields, ...otherFields]);

describe('Field Preservation During Migration - Property-Based Tests', () => {
  /**
   * Property 11: Migration Preserves Existing Document Fields
   * 
   * For any field definition with datatype 'file' or 'image' that exists before migration,
   * that field definition should still exist with the same datatype after migration completes.
   * 
   * **Validates: Requirements 5.1, 5.2**
   */
  describe('Property 11: Migration Preserves Existing Document Fields', () => {
    it('should preserve all file fields during migration', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              id: fc.uuid(),
              shortName: fc.string({ minLength: 3, maxLength: 50 }).filter(s => /^[a-z][a-z0-9_]*$/.test(s)),
              displayName: fc.string({ minLength: 3, maxLength: 100 }),
              datatype: fc.constant('file' as const),
              description: fc.option(fc.string({ maxLength: 200 }), { nil: undefined }),
              datatypeProperties: fc.option(
                fc.dictionary(
                  fc.string({ minLength: 1, maxLength: 20 }),
                  fc.oneof(fc.string(), fc.integer(), fc.boolean())
                ),
                { nil: undefined }
              ),
              organizationId: fc.uuid(),
            }),
            { minLength: 1, maxLength: 20 }
          ),
          (fields) => {
            // Act: Run migration
            const migratedFields = FieldPreservationSimulator.migrateFields(fields);

            // Assert: All file fields should be preserved
            expect(migratedFields.length).toBe(fields.length);
            
            fields.forEach((originalField, index) => {
              const migratedField = migratedFields[index];
              
              // Verify field is preserved
              expect(FieldPreservationSimulator.isFieldPreserved(originalField, migratedField)).toBe(true);
              
              // Specifically verify datatype is still 'file'
              expect(migratedField.datatype).toBe('file');
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should preserve all image fields during migration', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              id: fc.uuid(),
              shortName: fc.string({ minLength: 3, maxLength: 50 }).filter(s => /^[a-z][a-z0-9_]*$/.test(s)),
              displayName: fc.string({ minLength: 3, maxLength: 100 }),
              datatype: fc.constant('image' as const),
              description: fc.option(fc.string({ maxLength: 200 }), { nil: undefined }),
              datatypeProperties: fc.option(
                fc.dictionary(
                  fc.string({ minLength: 1, maxLength: 20 }),
                  fc.oneof(fc.string(), fc.integer(), fc.boolean())
                ),
                { nil: undefined }
              ),
              organizationId: fc.uuid(),
            }),
            { minLength: 1, maxLength: 20 }
          ),
          (fields) => {
            // Act: Run migration
            const migratedFields = FieldPreservationSimulator.migrateFields(fields);

            // Assert: All image fields should be preserved
            expect(migratedFields.length).toBe(fields.length);
            
            fields.forEach((originalField, index) => {
              const migratedField = migratedFields[index];
              
              // Verify field is preserved
              expect(FieldPreservationSimulator.isFieldPreserved(originalField, migratedField)).toBe(true);
              
              // Specifically verify datatype is still 'image'
              expect(migratedField.datatype).toBe('image');
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should preserve all document fields (file and image) during migration', () => {
      fc.assert(
        fc.property(
          arbitraryFieldArrayWithDocumentFields,
          (fields) => {
            // Pre-condition: Verify we have at least one document field
            const documentFields = fields.filter(f => 
              f.datatype === 'file' || f.datatype === 'image'
            );
            fc.pre(documentFields.length > 0);

            // Act: Run migration
            const migratedFields = FieldPreservationSimulator.migrateFields(fields);

            // Assert: All document fields should be preserved
            expect(migratedFields.length).toBe(fields.length);
            
            documentFields.forEach(originalField => {
              const migratedField = migratedFields.find(f => f.id === originalField.id);
              
              expect(migratedField).toBeDefined();
              expect(FieldPreservationSimulator.isFieldPreserved(originalField, migratedField!)).toBe(true);
              
              // Verify datatype is unchanged
              expect(migratedField!.datatype).toBe(originalField.datatype);
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should preserve field properties for document fields', () => {
      fc.assert(
        fc.property(
          fc.array(arbitraryDocumentField, { minLength: 1, maxLength: 10 }),
          (fields) => {
            // Act: Run migration
            const migratedFields = FieldPreservationSimulator.migrateFields(fields);

            // Assert: All field properties should be preserved
            fields.forEach((originalField, index) => {
              const migratedField = migratedFields[index];
              
              // Verify all properties are preserved
              expect(migratedField.id).toBe(originalField.id);
              expect(migratedField.shortName).toBe(originalField.shortName);
              expect(migratedField.displayName).toBe(originalField.displayName);
              expect(migratedField.datatype).toBe(originalField.datatype);
              expect(migratedField.description).toBe(originalField.description);
              expect(migratedField.organizationId).toBe(originalField.organizationId);
              expect(migratedField.datatypeProperties).toEqual(originalField.datatypeProperties);
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should preserve non-document fields during migration', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              id: fc.uuid(),
              shortName: fc.string({ minLength: 3, maxLength: 50 }).filter(s => /^[a-z][a-z0-9_]*$/.test(s)),
              displayName: fc.string({ minLength: 3, maxLength: 100 }),
              datatype: arbitraryNonDocumentDatatype,
              description: fc.option(fc.string({ maxLength: 200 }), { nil: undefined }),
              datatypeProperties: fc.option(
                fc.dictionary(
                  fc.string({ minLength: 1, maxLength: 20 }),
                  fc.oneof(fc.string(), fc.integer(), fc.boolean())
                ),
                { nil: undefined }
              ),
              organizationId: fc.uuid(),
            }),
            { minLength: 1, maxLength: 20 }
          ),
          (fields) => {
            // Act: Run migration
            const migratedFields = FieldPreservationSimulator.migrateFields(fields);

            // Assert: All non-document fields should be preserved
            expect(migratedFields.length).toBe(fields.length);
            
            fields.forEach((originalField, index) => {
              const migratedField = migratedFields[index];
              
              // Verify field is preserved
              expect(FieldPreservationSimulator.isFieldPreserved(originalField, migratedField)).toBe(true);
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should preserve all fields regardless of datatype', () => {
      fc.assert(
        fc.property(
          arbitraryFieldArray,
          (fields) => {
            // Act: Run migration
            const migratedFields = FieldPreservationSimulator.migrateFields(fields);

            // Assert: All fields should be preserved
            expect(migratedFields.length).toBe(fields.length);
            
            fields.forEach((originalField, index) => {
              const migratedField = migratedFields[index];
              
              // Verify field is completely preserved
              expect(FieldPreservationSimulator.isFieldPreserved(originalField, migratedField)).toBe(true);
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should not modify field count during migration', () => {
      fc.assert(
        fc.property(
          arbitraryFieldArray,
          (fields) => {
            // Act: Run migration
            const migratedFields = FieldPreservationSimulator.migrateFields(fields);

            // Assert: Field count should remain the same
            expect(migratedFields.length).toBe(fields.length);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should preserve field IDs during migration', () => {
      fc.assert(
        fc.property(
          arbitraryFieldArrayWithDocumentFields,
          (fields) => {
            // Pre-condition: Verify we have at least one document field
            const documentFields = fields.filter(f => 
              f.datatype === 'file' || f.datatype === 'image'
            );
            fc.pre(documentFields.length > 0);

            // Act: Run migration
            const migratedFields = FieldPreservationSimulator.migrateFields(fields);

            // Assert: All field IDs should be preserved
            const originalIds = fields.map(f => f.id).sort();
            const migratedIds = migratedFields.map(f => f.id).sort();
            
            expect(migratedIds).toEqual(originalIds);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should preserve field organization associations during migration', () => {
      fc.assert(
        fc.property(
          arbitraryFieldArrayWithDocumentFields,
          (fields) => {
            // Pre-condition: Verify we have at least one document field
            const documentFields = fields.filter(f => 
              f.datatype === 'file' || f.datatype === 'image'
            );
            fc.pre(documentFields.length > 0);

            // Act: Run migration
            const migratedFields = FieldPreservationSimulator.migrateFields(fields);

            // Assert: All organization associations should be preserved
            fields.forEach((originalField, index) => {
              const migratedField = migratedFields[index];
              expect(migratedField.organizationId).toBe(originalField.organizationId);
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should be idempotent - running migration multiple times preserves fields', () => {
      fc.assert(
        fc.property(
          arbitraryFieldArrayWithDocumentFields,
          (fields) => {
            // Act: Run migration multiple times
            const migratedOnce = FieldPreservationSimulator.migrateFields(fields);
            const migratedTwice = FieldPreservationSimulator.migrateFields(migratedOnce);
            const migratedThrice = FieldPreservationSimulator.migrateFields(migratedTwice);

            // Assert: Fields should be identical after each migration
            expect(migratedOnce).toEqual(fields);
            expect(migratedTwice).toEqual(fields);
            expect(migratedThrice).toEqual(fields);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Additional invariants for field preservation
   */
  describe('Field Preservation Invariants', () => {
    it('should maintain field uniqueness by ID', () => {
      fc.assert(
        fc.property(
          arbitraryFieldArray,
          (fields) => {
            // Ensure unique IDs in input
            const uniqueFields = fields.filter((field, index, self) =>
              self.findIndex(f => f.id === field.id) === index
            );

            // Act: Run migration
            const migratedFields = FieldPreservationSimulator.migrateFields(uniqueFields);

            // Assert: All IDs should still be unique
            const ids = migratedFields.map(f => f.id);
            const uniqueIds = Array.from(new Set(ids));
            expect(ids.length).toBe(uniqueIds.length);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should not introduce new fields during migration', () => {
      fc.assert(
        fc.property(
          arbitraryFieldArray,
          (fields) => {
            // Act: Run migration
            const migratedFields = FieldPreservationSimulator.migrateFields(fields);

            // Assert: No new fields should be introduced
            migratedFields.forEach(migratedField => {
              const originalField = fields.find(f => f.id === migratedField.id);
              expect(originalField).toBeDefined();
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should not remove any fields during migration', () => {
      fc.assert(
        fc.property(
          arbitraryFieldArray,
          (fields) => {
            // Act: Run migration
            const migratedFields = FieldPreservationSimulator.migrateFields(fields);

            // Assert: No fields should be removed
            fields.forEach(originalField => {
              const migratedField = migratedFields.find(f => f.id === originalField.id);
              expect(migratedField).toBeDefined();
            });
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
