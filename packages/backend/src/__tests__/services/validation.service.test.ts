import { ValidationService } from '../../services/validation.service';
import {
  FieldDefinition,
  ObjectDefinition,
  FieldDatatype,
  ValidationType
} from '../../types/metadata.types';

describe('ValidationService', () => {
  let validationService: ValidationService;

  beforeEach(() => {
    validationService = new ValidationService();
  });

  describe('buildFieldSchema', () => {
    it('should create string schema for TEXT datatype', () => {
      const field: FieldDefinition = {
        shortName: 'name',
        displayName: 'Name',
        description: 'User name',
        datatype: FieldDatatype.TEXT,
        datatypeProperties: {},
        mandatory: false
      };

      const schema = validationService.buildFieldSchema(field);
      expect(schema).toBeDefined();
    });

    it('should create number schema for NUMBER datatype', () => {
      const field: FieldDefinition = {
        shortName: 'age',
        displayName: 'Age',
        description: 'User age',
        datatype: FieldDatatype.NUMBER,
        datatypeProperties: {},
        mandatory: false
      };

      const schema = validationService.buildFieldSchema(field);
      expect(schema).toBeDefined();
    });

    it('should apply mandatory constraint', async () => {
      const field: FieldDefinition = {
        shortName: 'email',
        displayName: 'Email',
        description: 'User email',
        datatype: FieldDatatype.EMAIL,
        datatypeProperties: {},
        mandatory: true
      };

      const schema = validationService.buildFieldSchema(field);
      
      await expect(schema.validate(null)).rejects.toThrow();
      await expect(schema.validate('')).rejects.toThrow();
      await expect(schema.validate('test@example.com')).resolves.toBe('test@example.com');
    });

    it('should apply min_length validation rule', async () => {
      const field: FieldDefinition = {
        shortName: 'username',
        displayName: 'Username',
        description: 'Username',
        datatype: FieldDatatype.TEXT,
        datatypeProperties: {},
        mandatory: false,
        validationRules: [
          { type: ValidationType.MIN_LENGTH, value: 3 }
        ]
      };

      const schema = validationService.buildFieldSchema(field);
      
      await expect(schema.validate('ab')).rejects.toThrow();
      await expect(schema.validate('abc')).resolves.toBe('abc');
    });

    it('should apply max_length validation rule', async () => {
      const field: FieldDefinition = {
        shortName: 'username',
        displayName: 'Username',
        description: 'Username',
        datatype: FieldDatatype.TEXT,
        datatypeProperties: {},
        mandatory: false,
        validationRules: [
          { type: ValidationType.MAX_LENGTH, value: 10 }
        ]
      };

      const schema = validationService.buildFieldSchema(field);
      
      await expect(schema.validate('12345678901')).rejects.toThrow();
      await expect(schema.validate('1234567890')).resolves.toBe('1234567890');
    });

    it('should apply pattern validation rule', async () => {
      const field: FieldDefinition = {
        shortName: 'code',
        displayName: 'Code',
        description: 'Product code',
        datatype: FieldDatatype.TEXT,
        datatypeProperties: {},
        mandatory: false,
        validationRules: [
          { type: ValidationType.PATTERN, value: '^[A-Z]{3}\\d{3}$' }
        ]
      };

      const schema = validationService.buildFieldSchema(field);
      
      await expect(schema.validate('ABC123')).resolves.toBe('ABC123');
      await expect(schema.validate('abc123')).rejects.toThrow();
      await expect(schema.validate('AB123')).rejects.toThrow();
    });

    it('should apply min_value validation rule', async () => {
      const field: FieldDefinition = {
        shortName: 'age',
        displayName: 'Age',
        description: 'User age',
        datatype: FieldDatatype.NUMBER,
        datatypeProperties: {},
        mandatory: false,
        validationRules: [
          { type: ValidationType.MIN_VALUE, value: 18 }
        ]
      };

      const schema = validationService.buildFieldSchema(field);
      
      await expect(schema.validate(17)).rejects.toThrow();
      await expect(schema.validate(18)).resolves.toBe(18);
    });

    it('should apply max_value validation rule', async () => {
      const field: FieldDefinition = {
        shortName: 'age',
        displayName: 'Age',
        description: 'User age',
        datatype: FieldDatatype.NUMBER,
        datatypeProperties: {},
        mandatory: false,
        validationRules: [
          { type: ValidationType.MAX_VALUE, value: 100 }
        ]
      };

      const schema = validationService.buildFieldSchema(field);
      
      await expect(schema.validate(101)).rejects.toThrow();
      await expect(schema.validate(100)).resolves.toBe(100);
    });

    it('should validate email datatype', async () => {
      const field: FieldDefinition = {
        shortName: 'email',
        displayName: 'Email',
        description: 'User email',
        datatype: FieldDatatype.EMAIL,
        datatypeProperties: {},
        mandatory: false
      };

      const schema = validationService.buildFieldSchema(field);
      
      await expect(schema.validate('test@example.com')).resolves.toBe('test@example.com');
      await expect(schema.validate('invalid-email')).rejects.toThrow();
    });

    it('should validate url datatype', async () => {
      const field: FieldDefinition = {
        shortName: 'website',
        displayName: 'Website',
        description: 'Website URL',
        datatype: FieldDatatype.URL,
        datatypeProperties: {},
        mandatory: false
      };

      const schema = validationService.buildFieldSchema(field);
      
      await expect(schema.validate('https://example.com')).resolves.toBe('https://example.com');
      await expect(schema.validate('not-a-url')).rejects.toThrow();
    });
  });

  describe('buildObjectSchema', () => {
    it('should build schema for object with multiple fields', () => {
      const fields: FieldDefinition[] = [
        {
          shortName: 'name',
          displayName: 'Name',
          description: 'User name',
          datatype: FieldDatatype.TEXT,
          datatypeProperties: {},
          mandatory: false
        },
        {
          shortName: 'email',
          displayName: 'Email',
          description: 'User email',
          datatype: FieldDatatype.EMAIL,
          datatypeProperties: {},
          mandatory: false
        }
      ];

      const objectDef: ObjectDefinition = {
        shortName: 'user',
        displayName: 'User',
        description: 'User object',
        fields: [
          { fieldShortName: 'name', mandatory: true, order: 1 },
          { fieldShortName: 'email', mandatory: true, order: 2 }
        ],
        displayProperties: {}
      };

      const schema = validationService.buildObjectSchema(objectDef, fields);
      expect(schema).toBeDefined();
    });

    it('should override field mandatory with object-level mandatory', async () => {
      const fields: FieldDefinition[] = [
        {
          shortName: 'name',
          displayName: 'Name',
          description: 'User name',
          datatype: FieldDatatype.TEXT,
          datatypeProperties: {},
          mandatory: false // Field level: not mandatory
        }
      ];

      const objectDef: ObjectDefinition = {
        shortName: 'user',
        displayName: 'User',
        description: 'User object',
        fields: [
          { fieldShortName: 'name', mandatory: true, order: 1 } // Object level: mandatory
        ],
        displayProperties: {}
      };

      const schema = validationService.buildObjectSchema(objectDef, fields);
      
      await expect(schema.validate({})).rejects.toThrow();
      await expect(schema.validate({ name: 'John' })).resolves.toEqual({ name: 'John' });
    });
  });

  describe('validateInstance', () => {
    it('should validate valid instance data', async () => {
      const fields: FieldDefinition[] = [
        {
          shortName: 'name',
          displayName: 'Name',
          description: 'User name',
          datatype: FieldDatatype.TEXT,
          datatypeProperties: {},
          mandatory: false
        },
        {
          shortName: 'email',
          displayName: 'Email',
          description: 'User email',
          datatype: FieldDatatype.EMAIL,
          datatypeProperties: {},
          mandatory: false
        }
      ];

      const objectDef: ObjectDefinition = {
        shortName: 'user',
        displayName: 'User',
        description: 'User object',
        fields: [
          { fieldShortName: 'name', mandatory: true, order: 1 },
          { fieldShortName: 'email', mandatory: true, order: 2 }
        ],
        displayProperties: {}
      };

      const data = {
        name: 'John Doe',
        email: 'john@example.com'
      };

      const result = await validationService.validateInstance(objectDef, fields, data);
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should return errors for invalid instance data', async () => {
      const fields: FieldDefinition[] = [
        {
          shortName: 'name',
          displayName: 'Name',
          description: 'User name',
          datatype: FieldDatatype.TEXT,
          datatypeProperties: {},
          mandatory: false
        },
        {
          shortName: 'email',
          displayName: 'Email',
          description: 'User email',
          datatype: FieldDatatype.EMAIL,
          datatypeProperties: {},
          mandatory: false
        }
      ];

      const objectDef: ObjectDefinition = {
        shortName: 'user',
        displayName: 'User',
        description: 'User object',
        fields: [
          { fieldShortName: 'name', mandatory: true, order: 1 },
          { fieldShortName: 'email', mandatory: true, order: 2 }
        ],
        displayProperties: {}
      };

      const data = {
        name: '',
        email: 'invalid-email'
      };

      const result = await validationService.validateInstance(objectDef, fields, data);
      
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should return field-level error details', async () => {
      const fields: FieldDefinition[] = [
        {
          shortName: 'age',
          displayName: 'Age',
          description: 'User age',
          datatype: FieldDatatype.NUMBER,
          datatypeProperties: {},
          mandatory: false,
          validationRules: [
            { type: ValidationType.MIN_VALUE, value: 18, message: 'Must be at least 18' }
          ]
        }
      ];

      const objectDef: ObjectDefinition = {
        shortName: 'user',
        displayName: 'User',
        description: 'User object',
        fields: [
          { fieldShortName: 'age', mandatory: true, order: 1 }
        ],
        displayProperties: {}
      };

      const data = { age: 15 };

      const result = await validationService.validateInstance(objectDef, fields, data);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].field).toBe('age');
      expect(result.errors[0].message).toContain('18');
      expect(result.errors[0].value).toBe(15);
    });
  });

  describe('custom validators', () => {
    it('should register and use custom validator', async () => {
      validationService.registerCustomValidator('isEven', (value: any) => {
        return typeof value === 'number' && value % 2 === 0;
      });

      const field: FieldDefinition = {
        shortName: 'evenNumber',
        displayName: 'Even Number',
        description: 'Must be even',
        datatype: FieldDatatype.NUMBER,
        datatypeProperties: {},
        mandatory: false,
        validationRules: [
          { type: ValidationType.CUSTOM, customFunction: 'isEven', message: 'Must be even' }
        ]
      };

      const schema = validationService.buildFieldSchema(field);
      
      await expect(schema.validate(4)).resolves.toBe(4);
      await expect(schema.validate(3)).rejects.toThrow('Must be even');
    });

    it('should throw error for non-existent custom validator', () => {
      const field: FieldDefinition = {
        shortName: 'test',
        displayName: 'Test',
        description: 'Test field',
        datatype: FieldDatatype.TEXT,
        datatypeProperties: {},
        mandatory: false,
        validationRules: [
          { type: ValidationType.CUSTOM, customFunction: 'nonExistent' }
        ]
      };

      expect(() => validationService.buildFieldSchema(field)).toThrow(
        "Custom validator 'nonExistent' not found"
      );
    });
  });
});
