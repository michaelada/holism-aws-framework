import { MetadataService } from '../../services/metadata.service';
import { db } from '../../database/pool';
import { FieldDatatype, FieldDefinition, ObjectDefinition } from '../../types/metadata.types';

describe('Metadata Service - Table Generation Integration', () => {
  let metadataService: MetadataService;
  const createdTables: string[] = [];

  beforeAll(async () => {
    await db.initialize();
    metadataService = new MetadataService();
  });

  afterEach(async () => {
    // Clean up test data
    await db.query('DELETE FROM object_definitions WHERE short_name LIKE $1', ['test_%']);
    await db.query('DELETE FROM field_definitions WHERE short_name LIKE $1', ['test_%']);
    
    // Drop any tracked instance tables
    for (const tableName of createdTables) {
      await db.query(`DROP TABLE IF EXISTS ${tableName} CASCADE`);
    }
    createdTables.length = 0; // Clear the array
    
    // Drop any test instance tables
    const tables = await db.query(`
      SELECT tablename FROM pg_tables 
      WHERE schemaname = 'public' AND tablename LIKE 'instances_test_%'
    `);
    
    for (const row of tables.rows) {
      await db.query(`DROP TABLE IF EXISTS ${row.tablename} CASCADE`);
    }
  });

  afterAll(async () => {
    await db.close();
  });

  describe('registerObject', () => {
    it('should create instance table when object is registered', async () => {
      // Register field definitions
      const nameField: FieldDefinition = {
        shortName: 'test_name',
        displayName: 'Name',
        description: 'Test name field',
        datatype: FieldDatatype.TEXT,
        datatypeProperties: {},
      };

      const emailField: FieldDefinition = {
        shortName: 'test_email',
        displayName: 'Email',
        description: 'Test email field',
        datatype: FieldDatatype.EMAIL,
        datatypeProperties: {},
      };

      await metadataService.registerField(nameField);
      await metadataService.registerField(emailField);

      // Register object definition
      const objectDef: ObjectDefinition = {
        shortName: 'test_customer',
        displayName: 'Test Customer',
        description: 'Test customer object',
        fields: [
          { fieldShortName: 'test_name', mandatory: true, order: 1 },
          { fieldShortName: 'test_email', mandatory: true, order: 2 }
        ],
        displayProperties: {}
      };

      createdTables.push(`instances_${objectDef.shortName}`);
      await metadataService.registerObject(objectDef);

      // Verify instance table was created
      const tableCheck = await db.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'instances_test_customer'
        )
      `);

      expect(tableCheck.rows[0].exists).toBe(true);

      // Verify columns exist
      const columnsCheck = await db.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = 'instances_test_customer'
        ORDER BY ordinal_position
      `);

      const columnNames = columnsCheck.rows.map(r => r.column_name);
      expect(columnNames).toContain('id');
      expect(columnNames).toContain('test_name');
      expect(columnNames).toContain('test_email');
      expect(columnNames).toContain('created_at');
      expect(columnNames).toContain('updated_at');
      expect(columnNames).toContain('created_by');
      expect(columnNames).toContain('updated_by');

      // Verify NOT NULL constraints
      const nameColumn = columnsCheck.rows.find(r => r.column_name === 'test_name');
      const emailColumn = columnsCheck.rows.find(r => r.column_name === 'test_email');
      expect(nameColumn?.is_nullable).toBe('NO');
      expect(emailColumn?.is_nullable).toBe('NO');
    });

    it('should create indexes for searchable fields', async () => {
      // Register field
      const nameField: FieldDefinition = {
        shortName: 'test_searchable_name',
        displayName: 'Name',
        description: 'Test name field',
        datatype: FieldDatatype.TEXT,
        datatypeProperties: {},
      };

      await metadataService.registerField(nameField);

      // Register object with searchable fields
      const objectDef: ObjectDefinition = {
        shortName: 'test_searchable',
        displayName: 'Test Searchable',
        description: 'Test searchable object',
        fields: [
          { fieldShortName: 'test_searchable_name', mandatory: true, order: 1 }
        ],
        displayProperties: {
          searchableFields: ['test_searchable_name']
        }
      };

      createdTables.push(`instances_${objectDef.shortName}`);
      await metadataService.registerObject(objectDef);

      // Verify index was created
      const indexCheck = await db.query(`
        SELECT indexname
        FROM pg_indexes
        WHERE tablename = 'instances_test_searchable'
        AND indexname = 'idx_instances_test_searchable_test_searchable_name'
      `);

      expect(indexCheck.rows.length).toBe(1);
    });
  });

  describe('updateObject', () => {
    it('should execute migration when fields are added', async () => {
      // Setup: Register initial object
      const nameField: FieldDefinition = {
        shortName: 'test_update_name',
        displayName: 'Name',
        description: 'Test name field',
        datatype: FieldDatatype.TEXT,
        datatypeProperties: {},
      };

      await metadataService.registerField(nameField);

      const objectDef: ObjectDefinition = {
        shortName: 'test_update',
        displayName: 'Test Update',
        description: 'Test update object',
        fields: [
          { fieldShortName: 'test_update_name', mandatory: true, order: 1 }
        ],
        displayProperties: {}
      };

      createdTables.push(`instances_${objectDef.shortName}`);
      await metadataService.registerObject(objectDef);

      // Add new field
      const emailField: FieldDefinition = {
        shortName: 'test_update_email',
        displayName: 'Email',
        description: 'Test email field',
        datatype: FieldDatatype.EMAIL,
        datatypeProperties: {},
      };

      await metadataService.registerField(emailField);

      // Update object to include new field
      await metadataService.updateObject('test_update', {
        fields: [
          { fieldShortName: 'test_update_name', mandatory: true, order: 1 },
          { fieldShortName: 'test_update_email', mandatory: false, order: 2 }
        ]
      });

      // Verify new column was added
      const columnsCheck = await db.query(`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name = 'instances_test_update'
      `);

      const columnNames = columnsCheck.rows.map(r => r.column_name);
      expect(columnNames).toContain('test_update_email');
    });

    it('should execute migration when fields are removed', async () => {
      // Setup: Register object with two fields
      const nameField: FieldDefinition = {
        shortName: 'test_remove_name',
        displayName: 'Name',
        description: 'Test name field',
        datatype: FieldDatatype.TEXT,
        datatypeProperties: {},
      };

      const emailField: FieldDefinition = {
        shortName: 'test_remove_email',
        displayName: 'Email',
        description: 'Test email field',
        datatype: FieldDatatype.EMAIL,
        datatypeProperties: {},
      };

      await metadataService.registerField(nameField);
      await metadataService.registerField(emailField);

      const objectDef: ObjectDefinition = {
        shortName: 'test_remove',
        displayName: 'Test Remove',
        description: 'Test remove object',
        fields: [
          { fieldShortName: 'test_remove_name', mandatory: true, order: 1 },
          { fieldShortName: 'test_remove_email', mandatory: false, order: 2 }
        ],
        displayProperties: {}
      };

      createdTables.push(`instances_${objectDef.shortName}`);
      await metadataService.registerObject(objectDef);

      // Update object to remove email field
      await metadataService.updateObject('test_remove', {
        fields: [
          { fieldShortName: 'test_remove_name', mandatory: true, order: 1 }
        ]
      });

      // Verify column was removed
      const columnsCheck = await db.query(`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name = 'instances_test_remove'
      `);

      const columnNames = columnsCheck.rows.map(r => r.column_name);
      expect(columnNames).not.toContain('test_remove_email');
    });

    it('should add indexes when searchable fields are added', async () => {
      // Setup: Register object without searchable fields
      const nameField: FieldDefinition = {
        shortName: 'test_index_name',
        displayName: 'Name',
        description: 'Test name field',
        datatype: FieldDatatype.TEXT,
        datatypeProperties: {},
      };

      await metadataService.registerField(nameField);

      const objectDef: ObjectDefinition = {
        shortName: 'test_index',
        displayName: 'Test Index',
        description: 'Test index object',
        fields: [
          { fieldShortName: 'test_index_name', mandatory: true, order: 1 }
        ],
        displayProperties: {}
      };

      createdTables.push(`instances_${objectDef.shortName}`);
      await metadataService.registerObject(objectDef);

      // Update to add searchable field
      await metadataService.updateObject('test_index', {
        displayProperties: {
          searchableFields: ['test_index_name']
        }
      });

      // Verify index was created
      const indexCheck = await db.query(`
        SELECT indexname
        FROM pg_indexes
        WHERE tablename = 'instances_test_index'
        AND indexname = 'idx_instances_test_index_test_index_name'
      `);

      expect(indexCheck.rows.length).toBe(1);
    });
  });
});
