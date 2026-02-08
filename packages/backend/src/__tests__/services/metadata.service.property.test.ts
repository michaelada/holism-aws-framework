import * as fc from 'fast-check';
import { MetadataService } from '../../services/metadata.service';
import { FieldDefinition, FieldDatatype } from '../../types/metadata.types';
import { db } from '../../database/pool';

describe('Metadata Service Property Tests', () => {
  let metadataService: MetadataService;

  beforeAll(async () => {
    await db.initialize();
    metadataService = new MetadataService();
  });

  afterAll(async () => {
    await db.close();
  });

  beforeEach(async () => {
    // Clean up tables before each test - handle errors gracefully
    try {
      await db.query('DELETE FROM object_fields');
      await db.query('DELETE FROM object_definitions');
      await db.query('DELETE FROM field_definitions');
    } catch (error) {
      // Ignore cleanup errors - tables might not exist yet
    }
  });

  afterEach(async () => {
    // Clean up tables after each test to ensure no leftover data
    try {
      await db.query('DELETE FROM object_fields');
      await db.query('DELETE FROM object_definitions');
      await db.query('DELETE FROM field_definitions');
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  // Arbitraries for generating test data with guaranteed uniqueness
  const fieldShortNameArbitrary = () =>
    fc.uuid().map(uuid => `fld_${uuid.replace(/-/g, '').substring(0, 20)}`);

  const fieldDatatypeArbitrary = () =>
    fc.constantFrom(...Object.values(FieldDatatype));

  const fieldDefinitionArbitrary = () =>
    fc.record({
      shortName: fieldShortNameArbitrary(),
      displayName: fc.string({ minLength: 1, maxLength: 100 }),
      description: fc.string({ maxLength: 500 }),
      datatype: fieldDatatypeArbitrary(),
      datatypeProperties: fc.dictionary(fc.string({ maxLength: 20 }), fc.oneof(
        fc.string({ maxLength: 50 }),
        fc.integer(),
        fc.boolean()
      )),
      mandatory: fc.boolean(),
      validationRules: fc.constant([])
    });

  /**
   * Property 1: Metadata Persistence Round-Trip
   * Feature: aws-web-app-framework, Property 1: Metadata Persistence Round-Trip
   * Validates: Requirements 11.3, 12.3
   */
  describe('Property 1: Metadata Persistence Round-Trip', () => {
    it('should preserve all field definition properties through register and retrieve', async () => {
      await fc.assert(
        fc.asyncProperty(fieldDefinitionArbitrary(), async (fieldDef) => {
          // Register the field
          await metadataService.registerField(fieldDef);

          // Retrieve the field
          const retrieved = await metadataService.getFieldByShortName(fieldDef.shortName);

          // Verify all properties are preserved
          expect(retrieved).not.toBeNull();
          expect(retrieved!.shortName).toBe(fieldDef.shortName);
          expect(retrieved!.displayName).toBe(fieldDef.displayName);
          expect(retrieved!.description).toBe(fieldDef.description);
          expect(retrieved!.datatype).toBe(fieldDef.datatype);
          expect(retrieved!.mandatory).toBe(fieldDef.mandatory);
          expect(retrieved!.datatypeProperties).toEqual(fieldDef.datatypeProperties);
          expect(retrieved!.validationRules).toEqual(fieldDef.validationRules);

          // Verify metadata fields are present
          expect(retrieved!.id).toBeDefined();
          expect(retrieved!.createdAt).toBeDefined();
          expect(retrieved!.updatedAt).toBeDefined();

          // Clean up
          await metadataService.deleteField(fieldDef.shortName);
        }),
        { numRuns: 10 }
      );
    });

    it('should preserve all object definition properties through register and retrieve', async () => {
      // Create a simple test with fixed fields
      const field1: FieldDefinition = {
        shortName: `fld_${Date.now()}_1`,
        displayName: 'Test Field 1',
        description: 'Test',
        datatype: FieldDatatype.TEXT,
        datatypeProperties: {},
        mandatory: false
      };

      const field2: FieldDefinition = {
        shortName: `fld_${Date.now()}_2`,
        displayName: 'Test Field 2',
        description: 'Test',
        datatype: FieldDatatype.NUMBER,
        datatypeProperties: {},
        mandatory: false
      };

      await metadataService.registerField(field1);
      await metadataService.registerField(field2);

      const objectDef = {
        shortName: `obj_${Date.now()}`,
        displayName: 'Test Object',
        description: 'Test object',
        fields: [
          { fieldShortName: field1.shortName, mandatory: true, order: 1 },
          { fieldShortName: field2.shortName, mandatory: false, order: 2 }
        ],
        displayProperties: {
          defaultSortField: field1.shortName,
          defaultSortOrder: 'asc' as const,
          searchableFields: [field1.shortName],
          tableColumns: [field1.shortName, field2.shortName]
        }
      };

      await metadataService.registerObject(objectDef);
      const retrieved = await metadataService.getObjectByShortName(objectDef.shortName);

      expect(retrieved).not.toBeNull();
      expect(retrieved!.shortName).toBe(objectDef.shortName);
      expect(retrieved!.displayName).toBe(objectDef.displayName);
      expect(retrieved!.fields).toHaveLength(2);

      // Clean up
      await metadataService.deleteObject(objectDef.shortName);
      await metadataService.deleteField(field1.shortName);
      await metadataService.deleteField(field2.shortName);
    });
  });

  /**
   * Property 2: Field Reference Validation
   * Feature: aws-web-app-framework, Property 2: Field Reference Validation
   * Validates: Requirements 11.4
   */
  describe('Property 2: Field Reference Validation', () => {
    it('should reject object registration when referenced fields do not exist', async () => {
      const objectDef = {
        shortName: `obj_${Date.now()}`,
        displayName: 'Test Object',
        description: 'Test',
        fields: [{ fieldShortName: 'nonexistent_field', mandatory: true, order: 1 }],
        displayProperties: {}
      };

      await expect(metadataService.registerObject(objectDef)).rejects.toThrow(/does not exist/);
    });

    it('should accept object registration when all referenced fields exist', async () => {
      const field: FieldDefinition = {
        shortName: `fld_${Date.now()}`,
        displayName: 'Test Field',
        description: 'Test',
        datatype: FieldDatatype.TEXT,
        datatypeProperties: {},
        mandatory: false
      };

      await metadataService.registerField(field);

      const objectDef = {
        shortName: `obj_${Date.now()}`,
        displayName: 'Test Object',
        description: 'Test',
        fields: [{ fieldShortName: field.shortName, mandatory: true, order: 1 }],
        displayProperties: {}
      };

      await metadataService.registerObject(objectDef);
      const retrieved = await metadataService.getObjectByShortName(objectDef.shortName);
      expect(retrieved).toBeDefined();

      // Clean up
      await metadataService.deleteObject(objectDef.shortName);
      await metadataService.deleteField(field.shortName);
    });
  });

  /**
   * Property 3: Object Definition Completeness
   * Feature: aws-web-app-framework, Property 3: Object Definition Completeness
   * Validates: Requirements 11.5, 11.6, 11.7
   */
  describe('Property 3: Object Definition Completeness', () => {
    it('should include all required fields in registered object definition', async () => {
      const field: FieldDefinition = {
        shortName: `fld_${Date.now()}`,
        displayName: 'Test Field',
        description: 'Test',
        datatype: FieldDatatype.TEXT,
        datatypeProperties: {},
        mandatory: false
      };

      await metadataService.registerField(field);

      const objectDef = {
        shortName: `obj_${Date.now()}`,
        displayName: 'Test Object',
        description: 'Test description',
        fields: [{ fieldShortName: field.shortName, mandatory: true, order: 1 }],
        displayProperties: {
          defaultSortField: field.shortName,
          searchableFields: [field.shortName]
        }
      };

      const registered = await metadataService.registerObject(objectDef);

      expect(registered.shortName).toBeDefined();
      expect(registered.displayName).toBeDefined();
      expect(registered.description).toBeDefined();
      expect(registered.fields).toBeDefined();
      expect(registered.fields.length).toBeGreaterThan(0);
      expect(registered.displayProperties).toBeDefined();

      for (const fieldRef of registered.fields) {
        expect(fieldRef.fieldShortName).toBeDefined();
        expect(typeof fieldRef.mandatory).toBe('boolean');
        expect(typeof fieldRef.order).toBe('number');
      }

      // Clean up
      await metadataService.deleteObject(objectDef.shortName);
      await metadataService.deleteField(field.shortName);
    });
  });

  /**
   * Property 4: Field Definition Completeness
   * Feature: aws-web-app-framework, Property 4: Field Definition Completeness
   * Validates: Requirements 12.4, 12.5
   */
  describe('Property 4: Field Definition Completeness', () => {
    it('should include all required fields in registered field definition', async () => {
      await fc.assert(
        fc.asyncProperty(fieldDefinitionArbitrary(), async (fieldDef) => {
          await metadataService.registerField(fieldDef);
          const registered = await metadataService.getFieldByShortName(fieldDef.shortName);

          expect(registered!.shortName).toBeDefined();
          expect(registered!.displayName).toBeDefined();
          expect(registered!.description).toBeDefined();
          expect(registered!.datatype).toBeDefined();
          expect(registered!.datatypeProperties).toBeDefined();
          expect(typeof registered!.mandatory).toBe('boolean');

          await metadataService.deleteField(fieldDef.shortName);
        }),
        { numRuns: 10 }
      );
    });
  });

  /**
   * Property 5: Datatype Support
   * Feature: aws-web-app-framework, Property 5: Datatype Support
   * Validates: Requirements 12.6
   */
  describe('Property 5: Datatype Support', () => {
    it('should accept all supported datatypes', async () => {
      const supportedDatatypes = Object.values(FieldDatatype);

      for (const datatype of supportedDatatypes) {
        const fieldDef: FieldDefinition = {
          shortName: `test_field_${datatype}_${Date.now()}`,
          displayName: `Test Field ${datatype}`,
          description: 'Test field',
          datatype: datatype,
          datatypeProperties: {},
          mandatory: false
        };

        const registered = await metadataService.registerField(fieldDef);
        expect(registered.datatype).toBe(datatype);

        await metadataService.deleteField(fieldDef.shortName);
      }
    });
  });

  /**
   * Property 6: Conditional Field Properties
   * Feature: aws-web-app-framework, Property 6: Conditional Field Properties
   * Validates: Requirements 12.7
   */
  describe('Property 6: Conditional Field Properties', () => {
    it('should preserve displayMode property for single_select datatype', async () => {
      const displayModes = ['radio', 'dropdown'];

      for (const displayMode of displayModes) {
        const fieldDef: FieldDefinition = {
          shortName: `test_select_${displayMode}_${Date.now()}`,
          displayName: 'Test Select Field',
          description: 'Test field',
          datatype: FieldDatatype.SINGLE_SELECT,
          datatypeProperties: { displayMode, options: ['option1', 'option2'] },
          mandatory: false
        };

        const registered = await metadataService.registerField(fieldDef);
        expect(registered.datatypeProperties.displayMode).toBe(displayMode);

        await metadataService.deleteField(fieldDef.shortName);
      }
    });
  });

  /**
   * Property 7: Metadata Uniqueness
   * Feature: aws-web-app-framework, Property 7: Metadata Uniqueness
   * Validates: Requirements 16.6, 16.7
   */
  describe('Property 7: Metadata Uniqueness', () => {
    it('should reject duplicate field short names', async () => {
      await fc.assert(
        fc.asyncProperty(fieldDefinitionArbitrary(), async (fieldDef) => {
          await metadataService.registerField(fieldDef);
          await expect(metadataService.registerField(fieldDef)).rejects.toThrow();
          await metadataService.deleteField(fieldDef.shortName);
        }),
        { numRuns: 10 }
      );
    });

    it('should reject duplicate object short names', async () => {
      const field: FieldDefinition = {
        shortName: `fld_${Date.now()}`,
        displayName: 'Test Field',
        description: 'Test',
        datatype: FieldDatatype.TEXT,
        datatypeProperties: {},
        mandatory: false
      };

      await metadataService.registerField(field);

      const objectDef = {
        shortName: `obj_${Date.now()}`,
        displayName: 'Test Object',
        description: 'Test',
        fields: [{ fieldShortName: field.shortName, mandatory: true, order: 1 }],
        displayProperties: {}
      };

      await metadataService.registerObject(objectDef);
      await expect(metadataService.registerObject(objectDef)).rejects.toThrow();

      // Clean up
      await metadataService.deleteObject(objectDef.shortName);
      await metadataService.deleteField(field.shortName);
    });
  });

  /**
   * Property 8: Cascading Deletes
   * Feature: aws-web-app-framework, Property 8: Cascading Deletes
   * Validates: Requirements 16.5
   */
  describe('Property 8: Cascading Deletes', () => {
    it('should delete object-field relationships when object is deleted', async () => {
      const field: FieldDefinition = {
        shortName: `fld_${Date.now()}`,
        displayName: 'Test Field',
        description: 'Test',
        datatype: FieldDatatype.TEXT,
        datatypeProperties: {},
        mandatory: false
      };

      await metadataService.registerField(field);

      const objectDef = {
        shortName: `obj_${Date.now()}`,
        displayName: 'Test Object',
        description: 'Test',
        fields: [{ fieldShortName: field.shortName, mandatory: true, order: 1 }],
        displayProperties: {}
      };

      await metadataService.registerObject(objectDef);
      const deleted = await metadataService.deleteObject(objectDef.shortName);
      expect(deleted).toBe(true);

      const retrieved = await metadataService.getObjectByShortName(objectDef.shortName);
      expect(retrieved).toBeNull();

      const retrievedField = await metadataService.getFieldByShortName(field.shortName);
      expect(retrievedField).not.toBeNull();

      await metadataService.deleteField(field.shortName);
    });

    it('should prevent field deletion when referenced by objects', async () => {
      const field: FieldDefinition = {
        shortName: `fld_${Date.now()}`,
        displayName: 'Test Field',
        description: 'Test',
        datatype: FieldDatatype.TEXT,
        datatypeProperties: {},
        mandatory: false
      };

      await metadataService.registerField(field);

      const objectDef = {
        shortName: `obj_${Date.now()}`,
        displayName: 'Test Object',
        description: 'Test',
        fields: [{ fieldShortName: field.shortName, mandatory: true, order: 1 }],
        displayProperties: {}
      };

      await metadataService.registerObject(objectDef);
      await expect(metadataService.deleteField(field.shortName)).rejects.toThrow();

      // Clean up
      await metadataService.deleteObject(objectDef.shortName);
      await metadataService.deleteField(field.shortName);
    });
  });
});
