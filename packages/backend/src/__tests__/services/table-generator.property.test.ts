import * as fc from 'fast-check';
import { MetadataService } from '../../services/metadata.service';
import { db } from '../../database/pool';
import { FieldDatatype } from '../../types/metadata.types';

// Feature: aws-web-app-framework, Property 15: Dynamic Table Creation
// Feature: aws-web-app-framework, Property 16: Searchable Field Indexing
// Feature: aws-web-app-framework, Property 17: Schema Migration Generation

describe('Table Generator Property Tests', () => {
  let metadataService: MetadataService;
  
  // Global counter to ensure unique IDs across all test runs and shrinking iterations
  let uniqueCounter = 0;

  beforeAll(async () => {
    await db.initialize();
    metadataService = new MetadataService();
  });

  afterEach(async () => {
    // Clean up test data
    try {
      // Drop any test instance tables first
      const tables = await db.query(`
        SELECT tablename FROM pg_tables 
        WHERE schemaname = 'public' AND tablename LIKE 'instances_pbt_%'
      `);
      
      for (const row of tables.rows) {
        await db.query(`DROP TABLE IF EXISTS ${row.tablename} CASCADE`);
      }
      
      // Then clean up metadata
      await db.query('DELETE FROM object_fields WHERE object_id IN (SELECT id FROM object_definitions WHERE short_name LIKE $1)', ['pbt_%']);
      await db.query('DELETE FROM object_definitions WHERE short_name LIKE $1', ['pbt_%']);
      await db.query('DELETE FROM field_definitions WHERE short_name LIKE $1', ['pbt_%']);
    } catch (err) {
      // Ignore cleanup errors
      const error = err as Error;
      console.error('Cleanup error (ignored):', error.message);
    }
  });

  afterAll(async () => {
    await db.close();
  });

  // Helper to generate field datatype arbitrary
  const fieldDatatypeArbitrary = () =>
    fc.constantFrom(...Object.values(FieldDatatype));

  // Property 15: Dynamic Table Creation
  // For any newly registered Object_Definition, the Framework should create a corresponding 
  // database table named `instances_{shortName}` with columns matching the referenced Field_Definitions.
  test('Property 15: Dynamic Table Creation', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.nat({ max: 3 }).chain(numFields => {
          // Generate unique field short names upfront
          const fieldShortNames = Array.from({ length: numFields + 1 }, () => `pbt_field_${++uniqueCounter}`);
          
          // Create field definitions with those names
          const fields = fieldShortNames.map((shortName) =>
            fc.record({
              shortName: fc.constant(shortName),
              displayName: fc.string({ minLength: 1, maxLength: 50 }),
              description: fc.string({ maxLength: 200 }),
              datatype: fieldDatatypeArbitrary(),
              datatypeProperties: fc.constant({}),
              mandatory: fc.boolean()
            })
          );
          
          // Create object definition that references those field names
          const objectDef = fc.record({
            shortName: fc.constant(`pbt_obj_${++uniqueCounter}`),
            displayName: fc.string({ minLength: 1, maxLength: 50 }),
            description: fc.string({ maxLength: 200 }),
            fields: fc.array(
              fc.record({
                fieldShortName: fc.constantFrom(...fieldShortNames),
                mandatory: fc.boolean(),
                order: fc.nat({ max: 100 })
              }),
              { minLength: 1, maxLength: fieldShortNames.length }
            ),
            displayProperties: fc.constant({
              searchableFields: []
            })
          }).map(obj => {
            // Remove duplicate field references
            const seen = new Set();
            const uniqueFields = obj.fields.filter(f => {
              if (seen.has(f.fieldShortName)) return false;
              seen.add(f.fieldShortName);
              return true;
            });
            
            // Select searchable fields from the actual fields
            const actualFieldNames = uniqueFields.map(f => f.fieldShortName);
            const numSearchable = Math.min(Math.floor(Math.random() * 4), actualFieldNames.length);
            const shuffled = [...actualFieldNames].sort(() => Math.random() - 0.5);
            const searchableFields = shuffled.slice(0, numSearchable);
            
            return {
              shortName: obj.shortName,
              displayName: obj.displayName,
              description: obj.description,
              fields: uniqueFields,
              displayProperties: {
                searchableFields
              }
            };
          });
          
          return fc.tuple(
            fc.tuple(...fields),
            objectDef
          );
        }),
        async ([fields, objectDef]) => {
          // Register fields
          for (const field of fields) {
            await metadataService.registerField(field);
          }

          // Register object
          await metadataService.registerObject(objectDef);

          // Verify table exists
          const tableCheck = await db.query(`
            SELECT EXISTS (
              SELECT FROM information_schema.tables 
              WHERE table_schema = 'public' 
              AND table_name = $1
            )
          `, [`instances_${objectDef.shortName}`]);

          expect(tableCheck.rows[0].exists).toBe(true);

          // Verify all field columns exist
          const columnsCheck = await db.query(`
            SELECT column_name
            FROM information_schema.columns
            WHERE table_name = $1
          `, [`instances_${objectDef.shortName}`]);

          const columnNames = columnsCheck.rows.map(r => r.column_name);
          
          // Check standard columns
          expect(columnNames).toContain('id');
          expect(columnNames).toContain('created_at');
          expect(columnNames).toContain('updated_at');
          expect(columnNames).toContain('created_by');
          expect(columnNames).toContain('updated_by');

          // Check field columns
          for (const fieldRef of objectDef.fields) {
            expect(columnNames).toContain(fieldRef.fieldShortName);
          }
        }
      ),
      { numRuns: 10, endOnFailure: true }
    );
  }, 30000);

  // Property 16: Searchable Field Indexing
  // For any Object_Definition with searchable fields specified in display properties, 
  // the Framework should create database indexes on those columns in the instance table.
  test('Property 16: Searchable Field Indexing', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.nat({ max: 3 }).chain(numFields => {
          // Generate unique field short names upfront
          const fieldShortNames = Array.from({ length: numFields + 1 }, () => `pbt_field_${++uniqueCounter}`);
          
          // Create field definitions with those names
          const fields = fieldShortNames.map((shortName) =>
            fc.record({
              shortName: fc.constant(shortName),
              displayName: fc.string({ minLength: 1, maxLength: 50 }),
              description: fc.string({ maxLength: 200 }),
              datatype: fieldDatatypeArbitrary(),
              datatypeProperties: fc.constant({}),
              mandatory: fc.boolean()
            })
          );
          
          // Create object definition that references those field names
          const objectDef = fc.record({
            shortName: fc.constant(`pbt_obj_${++uniqueCounter}`),
            displayName: fc.string({ minLength: 1, maxLength: 50 }),
            description: fc.string({ maxLength: 200 }),
            fields: fc.array(
              fc.record({
                fieldShortName: fc.constantFrom(...fieldShortNames),
                mandatory: fc.boolean(),
                order: fc.nat({ max: 100 })
              }),
              { minLength: 1, maxLength: fieldShortNames.length }
            ),
            displayProperties: fc.constant({
              searchableFields: []
            })
          }).map(obj => {
            // Remove duplicate field references
            const seen = new Set();
            const uniqueFields = obj.fields.filter(f => {
              if (seen.has(f.fieldShortName)) return false;
              seen.add(f.fieldShortName);
              return true;
            });
            
            // Select searchable fields from the actual fields
            const actualFieldNames = uniqueFields.map(f => f.fieldShortName);
            const numSearchable = Math.min(Math.floor(Math.random() * 4), actualFieldNames.length);
            const shuffled = [...actualFieldNames].sort(() => Math.random() - 0.5);
            const searchableFields = shuffled.slice(0, numSearchable);
            
            return {
              shortName: obj.shortName,
              displayName: obj.displayName,
              description: obj.description,
              fields: uniqueFields,
              displayProperties: {
                searchableFields
              }
            };
          });
          
          return fc.tuple(
            fc.tuple(...fields),
            objectDef
          );
        }),
        async ([fields, objectDef]) => {
          // Register fields
          for (const field of fields) {
            await metadataService.registerField(field);
          }

          // Register object
          await metadataService.registerObject(objectDef);

          // Verify indexes for searchable fields
          if (objectDef.displayProperties.searchableFields && 
              objectDef.displayProperties.searchableFields.length > 0) {
            for (const fieldName of objectDef.displayProperties.searchableFields) {
              const indexCheck = await db.query(`
                SELECT indexname
                FROM pg_indexes
                WHERE tablename = $1
                AND indexname = $2
              `, [
                `instances_${objectDef.shortName}`,
                `idx_instances_${objectDef.shortName}_${fieldName}`
              ]);

              expect(indexCheck.rows.length).toBe(1);
            }
          }
        }
      ),
      { numRuns: 10, endOnFailure: true }
    );
  }, 30000);

  // Property 17: Schema Migration Generation
  // For any modification to an Object_Definition (adding/removing/changing fields), 
  // the Framework should generate appropriate ALTER TABLE statements to update the instance table schema.
  test('Property 17: Schema Migration Generation', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 2, max: 4 }).chain(numFields => {
          // Generate unique field short names upfront
          const fieldShortNames = Array.from({ length: numFields }, () => `pbt_field_${++uniqueCounter}`);
          
          // Create field definitions with those names
          const fields = fieldShortNames.map((shortName) =>
            fc.record({
              shortName: fc.constant(shortName),
              displayName: fc.string({ minLength: 1, maxLength: 50 }),
              description: fc.string({ maxLength: 200 }),
              datatype: fieldDatatypeArbitrary(),
              datatypeProperties: fc.constant({}),
              mandatory: fc.boolean()
            })
          );
          
          // Create object definition that references those field names
          const objectDef = fc.record({
            shortName: fc.constant(`pbt_obj_${++uniqueCounter}`),
            displayName: fc.string({ minLength: 1, maxLength: 50 }),
            description: fc.string({ maxLength: 200 }),
            fields: fc.array(
              fc.record({
                fieldShortName: fc.constantFrom(...fieldShortNames),
                mandatory: fc.boolean(),
                order: fc.nat({ max: 100 })
              }),
              { minLength: 1, maxLength: fieldShortNames.length }
            ),
            displayProperties: fc.constant({
              searchableFields: []
            })
          }).map(obj => {
            // Remove duplicate field references
            const seen = new Set();
            const uniqueFields = obj.fields.filter(f => {
              if (seen.has(f.fieldShortName)) return false;
              seen.add(f.fieldShortName);
              return true;
            });
            
            // Select searchable fields from the actual fields
            const actualFieldNames = uniqueFields.map(f => f.fieldShortName);
            const numSearchable = Math.min(Math.floor(Math.random() * 4), actualFieldNames.length);
            const shuffled = [...actualFieldNames].sort(() => Math.random() - 0.5);
            const searchableFields = shuffled.slice(0, numSearchable);
            
            return {
              shortName: obj.shortName,
              displayName: obj.displayName,
              description: obj.description,
              fields: uniqueFields,
              displayProperties: {
                searchableFields
              }
            };
          });
          
          return fc.tuple(
            fc.tuple(...fields),
            objectDef,
            fc.nat({ max: numFields - 1 })
          );
        }),
        async ([fields, objectDef, removeIndex]) => {
          // Register all fields
          for (const field of fields) {
            await metadataService.registerField(field);
          }

          // Register object with all fields
          await metadataService.registerObject(objectDef);

          // Get initial columns
          await db.query(`
            SELECT column_name
            FROM information_schema.columns
            WHERE table_name = $1
          `, [`instances_${objectDef.shortName}`]);

          // Ensure removeIndex is valid for the actual number of fields
          if (removeIndex >= objectDef.fields.length) {
            return; // Skip this test case if removeIndex is out of bounds
          }

          // Update object to remove one field
          const fieldToRemove = objectDef.fields[removeIndex];
          const updatedFields = objectDef.fields.filter((_, i) => i !== removeIndex);

          if (updatedFields.length > 0) {
            await metadataService.updateObject(objectDef.shortName, {
              fields: updatedFields
            });

            // Verify column was removed
            const updatedColumns = await db.query(`
              SELECT column_name
              FROM information_schema.columns
              WHERE table_name = $1
            `, [`instances_${objectDef.shortName}`]);

            const updatedColumnNames = updatedColumns.rows.map(r => r.column_name);

            // Removed field should not exist
            expect(updatedColumnNames).not.toContain(fieldToRemove.fieldShortName);

            // Remaining fields should still exist
            for (const fieldRef of updatedFields) {
              expect(updatedColumnNames).toContain(fieldRef.fieldShortName);
            }
          }
        }
      ),
      { numRuns: 10, endOnFailure: true }
    );
  }, 30000);
});
