import { TableGeneratorService } from '../../services/table-generator.service';
import { FieldDatatype, FieldDefinition, ObjectDefinition } from '../../types/metadata.types';

describe('TableGeneratorService', () => {
  let service: TableGeneratorService;

  beforeEach(() => {
    service = new TableGeneratorService();
  });

  describe('getTableName', () => {
    it('should generate correct table name', () => {
      expect(service.getTableName('customer')).toBe('instances_customer');
      expect(service.getTableName('order')).toBe('instances_order');
    });
  });

  describe('generateTableSchema', () => {
    it('should generate CREATE TABLE statement with all columns', () => {
      const fields: FieldDefinition[] = [
        {
          shortName: 'name',
          displayName: 'Name',
          description: 'Customer name',
          datatype: FieldDatatype.TEXT,
          datatypeProperties: {},
          mandatory: true
        },
        {
          shortName: 'email',
          displayName: 'Email',
          description: 'Customer email',
          datatype: FieldDatatype.EMAIL,
          datatypeProperties: {},
          mandatory: true
        }
      ];

      const objectDef: ObjectDefinition = {
        shortName: 'customer',
        displayName: 'Customer',
        description: 'Customer object',
        fields: [
          { fieldShortName: 'name', mandatory: true, order: 1 },
          { fieldShortName: 'email', mandatory: true, order: 2 }
        ],
        displayProperties: {}
      };

      const sql = service.generateTableSchema(objectDef, fields);

      expect(sql).toContain('CREATE TABLE instances_customer');
      expect(sql).toContain('id UUID PRIMARY KEY DEFAULT gen_random_uuid()');
      expect(sql).toContain('name VARCHAR(255) NOT NULL');
      expect(sql).toContain('email VARCHAR(255) NOT NULL');
      expect(sql).toContain('created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP');
      expect(sql).toContain('updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP');
      expect(sql).toContain('created_by UUID');
      expect(sql).toContain('updated_by UUID');
    });

    it('should handle optional fields without NOT NULL constraint', () => {
      const fields: FieldDefinition[] = [
        {
          shortName: 'phone',
          displayName: 'Phone',
          description: 'Phone number',
          datatype: FieldDatatype.TEXT,
          datatypeProperties: {},
          mandatory: false
        }
      ];

      const objectDef: ObjectDefinition = {
        shortName: 'contact',
        displayName: 'Contact',
        description: 'Contact object',
        fields: [
          { fieldShortName: 'phone', mandatory: false, order: 1 }
        ],
        displayProperties: {}
      };

      const sql = service.generateTableSchema(objectDef, fields);

      expect(sql).toContain('phone VARCHAR(255)');
      expect(sql).not.toContain('phone VARCHAR(255) NOT NULL');
    });

    it('should map all datatypes correctly', () => {
      const fields: FieldDefinition[] = [
        { shortName: 'text_field', displayName: 'Text', description: '', datatype: FieldDatatype.TEXT, datatypeProperties: {}, mandatory: false },
        { shortName: 'textarea_field', displayName: 'TextArea', description: '', datatype: FieldDatatype.TEXT_AREA, datatypeProperties: {}, mandatory: false },
        { shortName: 'number_field', displayName: 'Number', description: '', datatype: FieldDatatype.NUMBER, datatypeProperties: {}, mandatory: false },
        { shortName: 'boolean_field', displayName: 'Boolean', description: '', datatype: FieldDatatype.BOOLEAN, datatypeProperties: {}, mandatory: false },
        { shortName: 'date_field', displayName: 'Date', description: '', datatype: FieldDatatype.DATE, datatypeProperties: {}, mandatory: false },
        { shortName: 'time_field', displayName: 'Time', description: '', datatype: FieldDatatype.TIME, datatypeProperties: {}, mandatory: false },
        { shortName: 'datetime_field', displayName: 'DateTime', description: '', datatype: FieldDatatype.DATETIME, datatypeProperties: {}, mandatory: false },
        { shortName: 'email_field', displayName: 'Email', description: '', datatype: FieldDatatype.EMAIL, datatypeProperties: {}, mandatory: false },
        { shortName: 'url_field', displayName: 'URL', description: '', datatype: FieldDatatype.URL, datatypeProperties: {}, mandatory: false },
        { shortName: 'select_field', displayName: 'Select', description: '', datatype: FieldDatatype.SINGLE_SELECT, datatypeProperties: {}, mandatory: false },
        { shortName: 'multiselect_field', displayName: 'MultiSelect', description: '', datatype: FieldDatatype.MULTI_SELECT, datatypeProperties: {}, mandatory: false }
      ];

      const objectDef: ObjectDefinition = {
        shortName: 'test',
        displayName: 'Test',
        description: 'Test object',
        fields: fields.map((f, i) => ({ fieldShortName: f.shortName, mandatory: false, order: i })),
        displayProperties: {}
      };

      const sql = service.generateTableSchema(objectDef, fields);

      expect(sql).toContain('text_field VARCHAR(255)');
      expect(sql).toContain('textarea_field TEXT');
      expect(sql).toContain('number_field NUMERIC');
      expect(sql).toContain('boolean_field BOOLEAN');
      expect(sql).toContain('date_field DATE');
      expect(sql).toContain('time_field TIME');
      expect(sql).toContain('datetime_field TIMESTAMP');
      expect(sql).toContain('email_field VARCHAR(255)');
      expect(sql).toContain('url_field VARCHAR(2048)');
      expect(sql).toContain('select_field VARCHAR(100)');
      expect(sql).toContain('multiselect_field JSONB');
    });

    it('should throw error if field not found', () => {
      const fields: FieldDefinition[] = [];

      const objectDef: ObjectDefinition = {
        shortName: 'test',
        displayName: 'Test',
        description: 'Test object',
        fields: [
          { fieldShortName: 'missing_field', mandatory: true, order: 1 }
        ],
        displayProperties: {}
      };

      expect(() => service.generateTableSchema(objectDef, fields)).toThrow("Field 'missing_field' not found");
    });
  });

  describe('generateIndexes', () => {
    it('should generate indexes for searchable fields', () => {
      const objectDef: ObjectDefinition = {
        shortName: 'customer',
        displayName: 'Customer',
        description: 'Customer object',
        fields: [],
        displayProperties: {
          searchableFields: ['name', 'email']
        }
      };

      const indexes = service.generateIndexes(objectDef);

      expect(indexes).toHaveLength(2);
      expect(indexes[0]).toBe('CREATE INDEX idx_instances_customer_name ON instances_customer(name);');
      expect(indexes[1]).toBe('CREATE INDEX idx_instances_customer_email ON instances_customer(email);');
    });

    it('should return empty array if no searchable fields', () => {
      const objectDef: ObjectDefinition = {
        shortName: 'customer',
        displayName: 'Customer',
        description: 'Customer object',
        fields: [],
        displayProperties: {}
      };

      const indexes = service.generateIndexes(objectDef);

      expect(indexes).toHaveLength(0);
    });
  });

  describe('generateCompleteTableSQL', () => {
    it('should generate table and indexes', () => {
      const fields: FieldDefinition[] = [
        {
          shortName: 'name',
          displayName: 'Name',
          description: 'Name',
          datatype: FieldDatatype.TEXT,
          datatypeProperties: {},
          mandatory: true
        }
      ];

      const objectDef: ObjectDefinition = {
        shortName: 'customer',
        displayName: 'Customer',
        description: 'Customer object',
        fields: [
          { fieldShortName: 'name', mandatory: true, order: 1 }
        ],
        displayProperties: {
          searchableFields: ['name']
        }
      };

      const statements = service.generateCompleteTableSQL(objectDef, fields);

      expect(statements).toHaveLength(2);
      expect(statements[0]).toContain('CREATE TABLE instances_customer');
      expect(statements[1]).toContain('CREATE INDEX idx_instances_customer_name');
    });
  });

  describe('generateMigration', () => {
    it('should generate ALTER TABLE to add new fields', () => {
      const oldFields: FieldDefinition[] = [
        {
          shortName: 'name',
          displayName: 'Name',
          description: 'Name',
          datatype: FieldDatatype.TEXT,
          datatypeProperties: {},
          mandatory: true
        }
      ];

      const oldDef: ObjectDefinition = {
        shortName: 'customer',
        displayName: 'Customer',
        description: 'Customer object',
        fields: [
          { fieldShortName: 'name', mandatory: true, order: 1 }
        ],
        displayProperties: {}
      };

      const newFields: FieldDefinition[] = [
        ...oldFields,
        {
          shortName: 'email',
          displayName: 'Email',
          description: 'Email',
          datatype: FieldDatatype.EMAIL,
          datatypeProperties: {},
          mandatory: false
        }
      ];

      const newDef: ObjectDefinition = {
        ...oldDef,
        fields: [
          { fieldShortName: 'name', mandatory: true, order: 1 },
          { fieldShortName: 'email', mandatory: false, order: 2 }
        ]
      };

      const statements = service.generateMigration(oldDef, oldFields, newDef, newFields);

      expect(statements).toContain('ALTER TABLE instances_customer ADD COLUMN email VARCHAR(255);');
    });

    it('should generate ALTER TABLE to remove fields', () => {
      const oldFields: FieldDefinition[] = [
        {
          shortName: 'name',
          displayName: 'Name',
          description: 'Name',
          datatype: FieldDatatype.TEXT,
          datatypeProperties: {},
          mandatory: true
        },
        {
          shortName: 'email',
          displayName: 'Email',
          description: 'Email',
          datatype: FieldDatatype.EMAIL,
          datatypeProperties: {},
          mandatory: false
        }
      ];

      const oldDef: ObjectDefinition = {
        shortName: 'customer',
        displayName: 'Customer',
        description: 'Customer object',
        fields: [
          { fieldShortName: 'name', mandatory: true, order: 1 },
          { fieldShortName: 'email', mandatory: false, order: 2 }
        ],
        displayProperties: {}
      };

      const newFields: FieldDefinition[] = [
        {
          shortName: 'name',
          displayName: 'Name',
          description: 'Name',
          datatype: FieldDatatype.TEXT,
          datatypeProperties: {},
          mandatory: true
        }
      ];

      const newDef: ObjectDefinition = {
        ...oldDef,
        fields: [
          { fieldShortName: 'name', mandatory: true, order: 1 }
        ]
      };

      const statements = service.generateMigration(oldDef, oldFields, newDef, newFields);

      expect(statements).toContain('ALTER TABLE instances_customer DROP COLUMN email;');
    });

    it('should generate ALTER TABLE to change datatype', () => {
      const oldFields: FieldDefinition[] = [
        {
          shortName: 'age',
          displayName: 'Age',
          description: 'Age',
          datatype: FieldDatatype.TEXT,
          datatypeProperties: {},
          mandatory: false
        }
      ];

      const oldDef: ObjectDefinition = {
        shortName: 'customer',
        displayName: 'Customer',
        description: 'Customer object',
        fields: [
          { fieldShortName: 'age', mandatory: false, order: 1 }
        ],
        displayProperties: {}
      };

      const newFields: FieldDefinition[] = [
        {
          shortName: 'age',
          displayName: 'Age',
          description: 'Age',
          datatype: FieldDatatype.NUMBER,
          datatypeProperties: {},
          mandatory: false
        }
      ];

      const newDef: ObjectDefinition = {
        ...oldDef,
        fields: [
          { fieldShortName: 'age', mandatory: false, order: 1 }
        ]
      };

      const statements = service.generateMigration(oldDef, oldFields, newDef, newFields);

      expect(statements).toContain('ALTER TABLE instances_customer ALTER COLUMN age TYPE NUMERIC;');
    });

    it('should generate ALTER TABLE to change mandatory constraint', () => {
      const oldFields: FieldDefinition[] = [
        {
          shortName: 'email',
          displayName: 'Email',
          description: 'Email',
          datatype: FieldDatatype.EMAIL,
          datatypeProperties: {},
          mandatory: false
        }
      ];

      const oldDef: ObjectDefinition = {
        shortName: 'customer',
        displayName: 'Customer',
        description: 'Customer object',
        fields: [
          { fieldShortName: 'email', mandatory: false, order: 1 }
        ],
        displayProperties: {}
      };

      const newFields: FieldDefinition[] = [...oldFields];

      const newDef: ObjectDefinition = {
        ...oldDef,
        fields: [
          { fieldShortName: 'email', mandatory: true, order: 1 }
        ]
      };

      const statements = service.generateMigration(oldDef, oldFields, newDef, newFields);

      expect(statements).toContain('ALTER TABLE instances_customer ALTER COLUMN email SET NOT NULL;');
    });

    it('should generate statements to drop NOT NULL constraint', () => {
      const oldFields: FieldDefinition[] = [
        {
          shortName: 'email',
          displayName: 'Email',
          description: 'Email',
          datatype: FieldDatatype.EMAIL,
          datatypeProperties: {},
          mandatory: false
        }
      ];

      const oldDef: ObjectDefinition = {
        shortName: 'customer',
        displayName: 'Customer',
        description: 'Customer object',
        fields: [
          { fieldShortName: 'email', mandatory: true, order: 1 }
        ],
        displayProperties: {}
      };

      const newFields: FieldDefinition[] = [...oldFields];

      const newDef: ObjectDefinition = {
        ...oldDef,
        fields: [
          { fieldShortName: 'email', mandatory: false, order: 1 }
        ]
      };

      const statements = service.generateMigration(oldDef, oldFields, newDef, newFields);

      expect(statements).toContain('ALTER TABLE instances_customer ALTER COLUMN email DROP NOT NULL;');
    });

    it('should add indexes for newly searchable fields', () => {
      const fields: FieldDefinition[] = [
        {
          shortName: 'name',
          displayName: 'Name',
          description: 'Name',
          datatype: FieldDatatype.TEXT,
          datatypeProperties: {},
          mandatory: true
        }
      ];

      const oldDef: ObjectDefinition = {
        shortName: 'customer',
        displayName: 'Customer',
        description: 'Customer object',
        fields: [
          { fieldShortName: 'name', mandatory: true, order: 1 }
        ],
        displayProperties: {}
      };

      const newDef: ObjectDefinition = {
        ...oldDef,
        displayProperties: {
          searchableFields: ['name']
        }
      };

      const statements = service.generateMigration(oldDef, fields, newDef, fields);

      expect(statements).toContain('CREATE INDEX idx_instances_customer_name ON instances_customer(name);');
    });

    it('should drop indexes for fields no longer searchable', () => {
      const fields: FieldDefinition[] = [
        {
          shortName: 'name',
          displayName: 'Name',
          description: 'Name',
          datatype: FieldDatatype.TEXT,
          datatypeProperties: {},
          mandatory: true
        }
      ];

      const oldDef: ObjectDefinition = {
        shortName: 'customer',
        displayName: 'Customer',
        description: 'Customer object',
        fields: [
          { fieldShortName: 'name', mandatory: true, order: 1 }
        ],
        displayProperties: {
          searchableFields: ['name']
        }
      };

      const newDef: ObjectDefinition = {
        ...oldDef,
        displayProperties: {}
      };

      const statements = service.generateMigration(oldDef, fields, newDef, fields);

      expect(statements).toContain('DROP INDEX IF EXISTS idx_instances_customer_name;');
    });

    it('should handle multiple changes in one migration', () => {
      const oldFields: FieldDefinition[] = [
        {
          shortName: 'name',
          displayName: 'Name',
          description: 'Name',
          datatype: FieldDatatype.TEXT,
          datatypeProperties: {},
          mandatory: true
        },
        {
          shortName: 'old_field',
          displayName: 'Old Field',
          description: 'Old',
          datatype: FieldDatatype.TEXT,
          datatypeProperties: {},
          mandatory: false
        }
      ];

      const oldDef: ObjectDefinition = {
        shortName: 'customer',
        displayName: 'Customer',
        description: 'Customer object',
        fields: [
          { fieldShortName: 'name', mandatory: true, order: 1 },
          { fieldShortName: 'old_field', mandatory: false, order: 2 }
        ],
        displayProperties: {}
      };

      const newFields: FieldDefinition[] = [
        {
          shortName: 'name',
          displayName: 'Name',
          description: 'Name',
          datatype: FieldDatatype.TEXT,
          datatypeProperties: {},
          mandatory: true
        },
        {
          shortName: 'email',
          displayName: 'Email',
          description: 'Email',
          datatype: FieldDatatype.EMAIL,
          datatypeProperties: {},
          mandatory: true
        }
      ];

      const newDef: ObjectDefinition = {
        ...oldDef,
        fields: [
          { fieldShortName: 'name', mandatory: true, order: 1 },
          { fieldShortName: 'email', mandatory: true, order: 2 }
        ],
        displayProperties: {
          searchableFields: ['email']
        }
      };

      const statements = service.generateMigration(oldDef, oldFields, newDef, newFields);

      expect(statements).toContain('ALTER TABLE instances_customer ADD COLUMN email VARCHAR(255) NOT NULL;');
      expect(statements).toContain('ALTER TABLE instances_customer DROP COLUMN old_field;');
      expect(statements).toContain('CREATE INDEX idx_instances_customer_email ON instances_customer(email);');
    });
  });
});
