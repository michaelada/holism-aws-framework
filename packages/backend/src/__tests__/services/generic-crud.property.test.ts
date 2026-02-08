import * as fc from 'fast-check';
import { genericCrudService } from '../../services/generic-crud.service';
import { metadataService } from '../../services/metadata.service';
import { db } from '../../database/pool';
import {
  FieldDefinition,
  ObjectDefinition,
  FieldDatatype
} from '../../types/metadata.types';

describe('Generic CRUD Service - Property Tests', () => {
  beforeAll(async () => {
    await db.initialize();
  });

  afterAll(async () => {
    await db.close();
  });

  beforeEach(async () => {
    // Clean up test data
    await db.query('DELETE FROM object_fields');
    await db.query('DELETE FROM object_definitions');
    await db.query('DELETE FROM field_definitions');
    
    // Drop any test instance tables
    const tables = await db.query(`
      SELECT tablename FROM pg_tables 
      WHERE schemaname = 'public' AND tablename LIKE 'instances_%'
    `);
    for (const row of tables.rows) {
      await db.query(`DROP TABLE IF EXISTS ${row.tablename} CASCADE`);
    }
  });

  // Feature: aws-web-app-framework, Property 9: CRUD Operations Universality
  describe('Property 9: CRUD Operations Universality', () => {
    test('all CRUD operations should be available for any registered object definition', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            shortName: fc.stringMatching(/^[a-z][a-z0-9_]{2,20}$/),
            displayName: fc.string({ minLength: 1, maxLength: 50 }),
            description: fc.string({ maxLength: 200 })
          }),
          async (objectData) => {
            // Use timestamp to ensure uniqueness across all runs
            const timestamp = Date.now() + Math.random();
            const fieldShortName = `test_field_${timestamp}`.replace('.', '_');
            const field: FieldDefinition = {
              shortName: fieldShortName,
              displayName: 'Test Field',
              description: 'A test field',
              datatype: FieldDatatype.TEXT,
              datatypeProperties: {},
              mandatory: false
            };
            await metadataService.registerField(field);

            // Register object definition
            const objectDef: ObjectDefinition = {
              shortName: objectData.shortName,
              displayName: objectData.displayName,
              description: objectData.description,
              fields: [
                {
                  fieldShortName: fieldShortName,
                  mandatory: false,
                  order: 1
                }
              ],
              displayProperties: {}
            };
            await metadataService.registerObject(objectDef);

            // Test CREATE operation
            const createData = { [fieldShortName]: 'test value' };
            const created = await genericCrudService.createInstance(
              objectData.shortName,
              createData
            );
            expect(created).toBeDefined();
            expect(created.id).toBeDefined();
            expect(created[fieldShortName]).toBe('test value');

            // Test GET operation (single instance)
            const retrieved = await genericCrudService.getInstance(
              objectData.shortName,
              created.id
            );
            expect(retrieved).toBeDefined();
            expect(retrieved.id).toBe(created.id);
            expect(retrieved[fieldShortName]).toBe('test value');

            // Test LIST operation
            const listed = await genericCrudService.listInstances(
              objectData.shortName
            );
            expect(listed.data).toBeDefined();
            expect(listed.data.length).toBeGreaterThan(0);
            expect(listed.pagination).toBeDefined();

            // Test UPDATE operation
            const updateData = { [fieldShortName]: 'updated value' };
            const updated = await genericCrudService.updateInstance(
              objectData.shortName,
              created.id,
              updateData
            );
            expect(updated).toBeDefined();
            expect(updated[fieldShortName]).toBe('updated value');

            // Test DELETE operation
            const deleted = await genericCrudService.deleteInstance(
              objectData.shortName,
              created.id
            );
            expect(deleted).toBe(true);

            // Verify deletion
            const afterDelete = await genericCrudService.getInstance(
              objectData.shortName,
              created.id
            );
            expect(afterDelete).toBeNull();
          }
        ),
        { numRuns: 10 }
      );
    });
  });

  // Feature: aws-web-app-framework, Property 10: Instance Retrieval
  describe('Property 10: Instance Retrieval', () => {
    test('retrieving existing instance returns complete data, non-existent returns null', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            fieldValue: fc.string({ minLength: 1, maxLength: 100 })
          }),
          async (testData) => {
            // Setup
            const timestamp = Date.now() + Math.random();
            const fieldShortName = `name_${timestamp}`.replace('.', '_');
            const objectShortName = `test_obj_${timestamp}`.replace('.', '_');
            
            const field: FieldDefinition = {
              shortName: fieldShortName,
              displayName: 'Name',
              description: 'Name field',
              datatype: FieldDatatype.TEXT,
              datatypeProperties: {},
              mandatory: false
            };
            await metadataService.registerField(field);

            const objectDef: ObjectDefinition = {
              shortName: objectShortName,
              displayName: 'Test Object',
              description: 'Test',
              fields: [{ fieldShortName: fieldShortName, mandatory: false, order: 1 }],
              displayProperties: {}
            };
            await metadataService.registerObject(objectDef);

            // Create instance
            const created = await genericCrudService.createInstance(objectShortName, {
              [fieldShortName]: testData.fieldValue
            });

            // Test: Existing instance returns complete data
            const retrieved = await genericCrudService.getInstance(
              objectShortName,
              created.id
            );
            expect(retrieved).not.toBeNull();
            expect(retrieved.id).toBe(created.id);
            expect(retrieved[fieldShortName]).toBe(testData.fieldValue);

            // Test: Non-existent instance returns null
            const nonExistent = await genericCrudService.getInstance(
              objectShortName,
              '00000000-0000-0000-0000-000000000000'
            );
            expect(nonExistent).toBeNull();
          }
        ),
        { numRuns: 10 }
      );
    });
  });

  // Feature: aws-web-app-framework, Property 11: Mandatory Field Validation
  describe('Property 11: Mandatory Field Validation', () => {
    test('creating instance without mandatory fields should fail with validation error', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            withMandatory: fc.boolean()
          }),
          async (testData) => {
            // Setup
            const timestamp = Date.now() + Math.random();
            const fieldShortName = `required_field_${timestamp}`.replace('.', '_');
            const objectShortName = `test_mandatory_${timestamp}`.replace('.', '_');
            
            const field: FieldDefinition = {
              shortName: fieldShortName,
              displayName: 'Required Field',
              description: 'A required field',
              datatype: FieldDatatype.TEXT,
              datatypeProperties: {},
              mandatory: false // Will be overridden at object level
            };
            await metadataService.registerField(field);

            const objectDef: ObjectDefinition = {
              shortName: objectShortName,
              displayName: 'Test Mandatory',
              description: 'Test',
              fields: [
                {
                  fieldShortName: fieldShortName,
                  mandatory: true, // Make it mandatory at object level
                  order: 1
                }
              ],
              displayProperties: {}
            };
            await metadataService.registerObject(objectDef);

            if (testData.withMandatory) {
              // Should succeed with mandatory field
              const created = await genericCrudService.createInstance(
                objectShortName,
                { [fieldShortName]: 'value' }
              );
              expect(created).toBeDefined();
              expect(created[fieldShortName]).toBe('value');
            } else {
              // Should fail without mandatory field
              await expect(
                genericCrudService.createInstance(objectShortName, {})
              ).rejects.toThrow('Validation failed');
            }
          }
        ),
        { numRuns: 10 }
      );
    });
  });

  // Feature: aws-web-app-framework, Property 12: Datatype Validation
  describe('Property 12: Datatype Validation', () => {
    test('providing invalid datatype values should fail validation', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            validNumber: fc.integer(),
            invalidNumber: fc.string().filter(s => isNaN(Number(s)))
          }),
          async (testData) => {
            // Setup
            const timestamp = Date.now() + Math.random();
            const fieldShortName = `number_field_${timestamp}`.replace('.', '_');
            const objectShortName = `test_datatype_${timestamp}`.replace('.', '_');
            
            const field: FieldDefinition = {
              shortName: fieldShortName,
              displayName: 'Number Field',
              description: 'A number field',
              datatype: FieldDatatype.NUMBER,
              datatypeProperties: {},
              mandatory: false
            };
            await metadataService.registerField(field);

            const objectDef: ObjectDefinition = {
              shortName: objectShortName,
              displayName: 'Test Datatype',
              description: 'Test',
              fields: [
                { fieldShortName: fieldShortName, mandatory: false, order: 1 }
              ],
              displayProperties: {}
            };
            await metadataService.registerObject(objectDef);

            // Valid number should succeed
            const created = await genericCrudService.createInstance(
              objectShortName,
              { [fieldShortName]: testData.validNumber }
            );
            expect(created).toBeDefined();
            // PostgreSQL may return numbers as strings, so we need to be flexible
            expect(Number(created[fieldShortName])).toBe(testData.validNumber);

            // Invalid number should fail
            await expect(
              genericCrudService.createInstance(objectShortName, {
                [fieldShortName]: testData.invalidNumber
              })
            ).rejects.toThrow('Validation failed');
          }
        ),
        { numRuns: 10 }
      );
    });
  });

  // Feature: aws-web-app-framework, Property 13: Query Operations
  describe('Property 13: Query Operations', () => {
    test('filtering, sorting, and pagination should return correct subsets', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            values: fc.array(fc.string({ minLength: 1, maxLength: 20 }), {
              minLength: 5,
              maxLength: 10
            })
          }),
          async (testData) => {
            // Setup
            const timestamp = Date.now() + Math.random();
            const fieldShortName = `name_${timestamp}`.replace('.', '_');
            const objectShortName = `test_query_${timestamp}`.replace('.', '_');
            
            const field: FieldDefinition = {
              shortName: fieldShortName,
              displayName: 'Name',
              description: 'Name field',
              datatype: FieldDatatype.TEXT,
              datatypeProperties: {},
              mandatory: false
            };
            await metadataService.registerField(field);

            const objectDef: ObjectDefinition = {
              shortName: objectShortName,
              displayName: 'Test Query',
              description: 'Test',
              fields: [{ fieldShortName: fieldShortName, mandatory: false, order: 1 }],
              displayProperties: {
                searchableFields: [fieldShortName],
                defaultSortField: fieldShortName
              }
            };
            await metadataService.registerObject(objectDef);

            // Create multiple instances
            for (const value of testData.values) {
              await genericCrudService.createInstance(objectShortName, {
                [fieldShortName]: value
              });
            }

            // Test pagination
            const page1 = await genericCrudService.listInstances(objectShortName, {
              page: 1,
              pageSize: 3
            });
            expect(page1.data.length).toBeLessThanOrEqual(3);
            expect(page1.pagination.page).toBe(1);
            expect(page1.pagination.pageSize).toBe(3);
            expect(page1.pagination.totalItems).toBe(testData.values.length);

            // Test sorting
            const sorted = await genericCrudService.listInstances(objectShortName, {
              sortBy: fieldShortName,
              sortOrder: 'asc'
            });
            const sortedNames = sorted.data.map((d: any) => d[fieldShortName]);
            const expectedSorted = [...testData.values].sort();
            expect(sortedNames).toEqual(expectedSorted);
          }
        ),
        { numRuns: 5 }
      );
    });
  });

  // Feature: aws-web-app-framework, Property 14: Invalid Object Type Handling
  describe('Property 14: Invalid Object Type Handling', () => {
    test('operations on non-existent object types should return descriptive errors', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.stringMatching(/^[a-z][a-z0-9_]{2,20}$/),
          async (nonExistentType) => {
            // Ensure the type doesn't exist
            const exists = await metadataService.getObjectByShortName(
              nonExistentType
            );
            if (exists) {
              return; // Skip this test case
            }

            // Test LIST operation
            await expect(
              genericCrudService.listInstances(nonExistentType)
            ).rejects.toThrow(`Object type '${nonExistentType}' not found`);

            // Test GET operation
            await expect(
              genericCrudService.getInstance(
                nonExistentType,
                '00000000-0000-0000-0000-000000000000'
              )
            ).rejects.toThrow(`Object type '${nonExistentType}' not found`);

            // Test CREATE operation
            await expect(
              genericCrudService.createInstance(nonExistentType, {})
            ).rejects.toThrow(`Object type '${nonExistentType}' not found`);

            // Test UPDATE operation
            await expect(
              genericCrudService.updateInstance(
                nonExistentType,
                '00000000-0000-0000-0000-000000000000',
                {}
              )
            ).rejects.toThrow(`Object type '${nonExistentType}' not found`);

            // Test DELETE operation
            await expect(
              genericCrudService.deleteInstance(
                nonExistentType,
                '00000000-0000-0000-0000-000000000000'
              )
            ).rejects.toThrow(`Object type '${nonExistentType}' not found`);
          }
        ),
        { numRuns: 10 }
      );
    });
  });
});
