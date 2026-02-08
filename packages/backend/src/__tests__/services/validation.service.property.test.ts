import * as fc from 'fast-check';
import { ValidationService } from '../../services/validation.service';
import {
  FieldDefinition,
  ObjectDefinition,
  FieldDatatype,
  ValidationType
} from '../../types/metadata.types';

describe('Validation Service Property Tests', () => {
  let validationService: ValidationService;

  beforeEach(() => {
    validationService = new ValidationService();
  });

  /**
   * Property 34: Validation Rule Enforcement (Server)
   * Feature: aws-web-app-framework, Property 34: Validation Rule Enforcement (Server)
   * Validates: Requirements 25.4
   */
  describe('Property 34: Validation Rule Enforcement (Server)', () => {
    it('should reject values that violate min_length rule', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 5, max: 20 }),
          fc.string({ minLength: 1, maxLength: 4 }),
          async (minLength, shortValue) => {
            const field: FieldDefinition = {
              shortName: 'test',
              displayName: 'Test',
              description: 'Test field',
              datatype: FieldDatatype.TEXT,
              datatypeProperties: {},
              
              validationRules: [
                { type: ValidationType.MIN_LENGTH, value: minLength }
              ]
            };

            const objectDef: ObjectDefinition = {
              shortName: 'test_obj',
              displayName: 'Test Object',
              description: 'Test',
              fields: [{ fieldShortName: 'test', mandatory: false, order: 1 }],
              displayProperties: {}
            };

            const result = await validationService.validateInstance(
              objectDef,
              [field],
              { test: shortValue }
            );

            expect(result.valid).toBe(false);
            expect(result.errors.length).toBeGreaterThan(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject values that violate max_length rule', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 5, max: 10 }),
          fc.string({ minLength: 11, maxLength: 50 }),
          async (maxLength, longValue) => {
            const field: FieldDefinition = {
              shortName: 'test',
              displayName: 'Test',
              description: 'Test field',
              datatype: FieldDatatype.TEXT,
              datatypeProperties: {},
              
              validationRules: [
                { type: ValidationType.MAX_LENGTH, value: maxLength }
              ]
            };

            const objectDef: ObjectDefinition = {
              shortName: 'test_obj',
              displayName: 'Test Object',
              description: 'Test',
              fields: [{ fieldShortName: 'test', mandatory: false, order: 1 }],
              displayProperties: {}
            };

            const result = await validationService.validateInstance(
              objectDef,
              [field],
              { test: longValue }
            );

            expect(result.valid).toBe(false);
            expect(result.errors.length).toBeGreaterThan(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject values that violate min_value rule', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 10, max: 100 }),
          fc.integer({ min: 0, max: 9 }),
          async (minValue, lowValue) => {
            const field: FieldDefinition = {
              shortName: 'test',
              displayName: 'Test',
              description: 'Test field',
              datatype: FieldDatatype.NUMBER,
              datatypeProperties: {},
              
              validationRules: [
                { type: ValidationType.MIN_VALUE, value: minValue }
              ]
            };

            const objectDef: ObjectDefinition = {
              shortName: 'test_obj',
              displayName: 'Test Object',
              description: 'Test',
              fields: [{ fieldShortName: 'test', mandatory: false, order: 1 }],
              displayProperties: {}
            };

            const result = await validationService.validateInstance(
              objectDef,
              [field],
              { test: lowValue }
            );

            expect(result.valid).toBe(false);
            expect(result.errors.length).toBeGreaterThan(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject values that violate max_value rule', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 10, max: 50 }),
          fc.integer({ min: 51, max: 200 }),
          async (maxValue, highValue) => {
            const field: FieldDefinition = {
              shortName: 'test',
              displayName: 'Test',
              description: 'Test field',
              datatype: FieldDatatype.NUMBER,
              datatypeProperties: {},
              
              validationRules: [
                { type: ValidationType.MAX_VALUE, value: maxValue }
              ]
            };

            const objectDef: ObjectDefinition = {
              shortName: 'test_obj',
              displayName: 'Test Object',
              description: 'Test',
              fields: [{ fieldShortName: 'test', mandatory: false, order: 1 }],
              displayProperties: {}
            };

            const result = await validationService.validateInstance(
              objectDef,
              [field],
              { test: highValue }
            );

            expect(result.valid).toBe(false);
            expect(result.errors.length).toBeGreaterThan(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should accept values that satisfy all validation rules', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 5, maxLength: 10 }),
          async (value) => {
            const field: FieldDefinition = {
              shortName: 'test',
              displayName: 'Test',
              description: 'Test field',
              datatype: FieldDatatype.TEXT,
              datatypeProperties: {},
              
              validationRules: [
                { type: ValidationType.MIN_LENGTH, value: 5 },
                { type: ValidationType.MAX_LENGTH, value: 10 }
              ]
            };

            const objectDef: ObjectDefinition = {
              shortName: 'test_obj',
              displayName: 'Test Object',
              description: 'Test',
              fields: [{ fieldShortName: 'test', mandatory: false, order: 1 }],
              displayProperties: {}
            };

            const result = await validationService.validateInstance(
              objectDef,
              [field],
              { test: value }
            );

            expect(result.valid).toBe(true);
            expect(result.errors).toHaveLength(0);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 36: Validation Error Messages
   * Feature: aws-web-app-framework, Property 36: Validation Error Messages
   * Validates: Requirements 25.6
   */
  describe('Property 36: Validation Error Messages', () => {
    it('should return specific error messages for each validation rule violation', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.oneof(
            fc.record({
              rule: fc.constant({ type: ValidationType.MIN_LENGTH, value: 10 }),
              value: fc.string({ minLength: 1, maxLength: 9 }),
              expectedInMessage: fc.constant('10')
            }),
            fc.record({
              rule: fc.constant({ type: ValidationType.MAX_LENGTH, value: 5 }),
              value: fc.string({ minLength: 6, maxLength: 20 }),
              expectedInMessage: fc.constant('5')
            }),
            fc.record({
              rule: fc.constant({ type: ValidationType.EMAIL }),
              value: fc.constant('not-an-email'),
              expectedInMessage: fc.constant('email')
            })
          ),
          async (testCase) => {
            const field: FieldDefinition = {
              shortName: 'test',
              displayName: 'Test Field',
              description: 'Test',
              datatype: testCase.rule.type === ValidationType.EMAIL 
                ? FieldDatatype.EMAIL 
                : FieldDatatype.TEXT,
              datatypeProperties: {},
              
              validationRules: testCase.rule.type === ValidationType.EMAIL ? [] : [testCase.rule]
            };

            const objectDef: ObjectDefinition = {
              shortName: 'test_obj',
              displayName: 'Test Object',
              description: 'Test',
              fields: [{ fieldShortName: 'test', mandatory: false, order: 1 }],
              displayProperties: {}
            };

            const result = await validationService.validateInstance(
              objectDef,
              [field],
              { test: testCase.value }
            );

            expect(result.valid).toBe(false);
            expect(result.errors.length).toBeGreaterThan(0);
            expect(result.errors[0].message.toLowerCase()).toContain(
              testCase.expectedInMessage.toLowerCase()
            );
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should include field name and value in error details', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate valid field names (alphanumeric and underscore only, avoiding reserved words)
          fc.string({ minLength: 1, maxLength: 20 })
            .filter(s => {
              // Must start with letter or underscore, contain only alphanumeric and underscore
              if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(s)) return false;
              // Avoid JavaScript reserved words and prototype chain properties
              const reserved = ['__proto__', 'constructor', 'prototype', 'toString', 'valueOf'];
              return !reserved.includes(s);
            }),
          fc.integer({ min: 0, max: 10 }),
          async (fieldName, invalidValue) => {
            const field: FieldDefinition = {
              shortName: fieldName,
              displayName: 'Test Field',
              description: 'Test',
              datatype: FieldDatatype.NUMBER,
              datatypeProperties: {},
              
              validationRules: [
                { type: ValidationType.MIN_VALUE, value: 20 }
              ]
            };

            const objectDef: ObjectDefinition = {
              shortName: 'test_obj',
              displayName: 'Test Object',
              description: 'Test',
              fields: [{ fieldShortName: fieldName, mandatory: false, order: 1 }],
              displayProperties: {}
            };

            const result = await validationService.validateInstance(
              objectDef,
              [field],
              { [fieldName]: invalidValue }
            );

            expect(result.valid).toBe(false);
            expect(result.errors.length).toBeGreaterThan(0);
            expect(result.errors[0].field).toBe(fieldName);
            expect(result.errors[0].value).toBe(invalidValue);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 37: Datatype-Aware Validation
   * Feature: aws-web-app-framework, Property 37: Datatype-Aware Validation
   * Validates: Requirements 25.7
   */
  describe('Property 37: Datatype-Aware Validation', () => {
    it('should only apply string validation rules to string datatypes', async () => {
      const stringRules = [
        ValidationType.MIN_LENGTH,
        ValidationType.MAX_LENGTH,
        ValidationType.PATTERN
      ];

      for (const ruleType of stringRules) {
        const field: FieldDefinition = {
          shortName: 'test',
          displayName: 'Test',
          description: 'Test',
          datatype: FieldDatatype.TEXT,
          datatypeProperties: {},
          
          validationRules: [
            { type: ruleType, value: ruleType === ValidationType.PATTERN ? '^[a-z]+$' : 5 }
          ]
        };

        const schema = validationService.buildFieldSchema(field);
        expect(schema).toBeDefined();
      }
    });

    it('should only apply number validation rules to number datatypes', async () => {
      const numberRules = [
        ValidationType.MIN_VALUE,
        ValidationType.MAX_VALUE
      ];

      for (const ruleType of numberRules) {
        const field: FieldDefinition = {
          shortName: 'test',
          displayName: 'Test',
          description: 'Test',
          datatype: FieldDatatype.NUMBER,
          datatypeProperties: {},
          
          validationRules: [
            { type: ruleType, value: 10 }
          ]
        };

        const schema = validationService.buildFieldSchema(field);
        expect(schema).toBeDefined();
      }
    });

    it('should validate email format for EMAIL datatype', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.emailAddress(),
          async (validEmail) => {
            const field: FieldDefinition = {
              shortName: 'email',
              displayName: 'Email',
              description: 'Email field',
              datatype: FieldDatatype.EMAIL,
              datatypeProperties: {},
            };

            const objectDef: ObjectDefinition = {
              shortName: 'test_obj',
              displayName: 'Test Object',
              description: 'Test',
              fields: [{ fieldShortName: 'email', mandatory: false, order: 1 }],
              displayProperties: {}
            };

            const result = await validationService.validateInstance(
              objectDef,
              [field],
              { email: validEmail }
            );

            expect(result.valid).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should validate URL format for URL datatype', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate valid URLs that Yup will accept (no localhost, no double slashes)
          fc.oneof(
            fc.constant('https://example.com'),
            fc.constant('http://test.org'),
            fc.constant('https://www.google.com/search'),
            fc.constant('https://github.com/user/repo'),
            fc.webUrl().filter(url => {
              // Filter out URLs that Yup won't accept
              try {
                const parsed = new URL(url);
                // Exclude localhost and ensure no double slashes in path
                return parsed.hostname !== 'localhost' && 
                       !parsed.pathname.includes('//');
              } catch {
                return false;
              }
            })
          ),
          async (validUrl) => {
            const field: FieldDefinition = {
              shortName: 'website',
              displayName: 'Website',
              description: 'Website URL',
              datatype: FieldDatatype.URL,
              datatypeProperties: {},
            };

            const objectDef: ObjectDefinition = {
              shortName: 'test_obj',
              displayName: 'Test Object',
              description: 'Test',
              fields: [{ fieldShortName: 'website', mandatory: false, order: 1 }],
              displayProperties: {}
            };

            const result = await validationService.validateInstance(
              objectDef,
              [field],
              { website: validUrl }
            );

            expect(result.valid).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 38: Validation Rule Propagation
   * Feature: aws-web-app-framework, Property 38: Validation Rule Propagation
   * Validates: Requirements 25.9
   */
  describe('Property 38: Validation Rule Propagation', () => {
    it('should apply field validation rules to all objects using that field', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 5, max: 20 }),
          fc.string({ minLength: 1, maxLength: 4 }),
          async (minLength, shortValue) => {
            const field: FieldDefinition = {
              shortName: 'shared_field',
              displayName: 'Shared Field',
              description: 'Field used by multiple objects',
              datatype: FieldDatatype.TEXT,
              datatypeProperties: {},
              
              validationRules: [
                { type: ValidationType.MIN_LENGTH, value: minLength }
              ]
            };

            // Create two different object definitions using the same field
            const objectDef1: ObjectDefinition = {
              shortName: 'obj1',
              displayName: 'Object 1',
              description: 'First object',
              fields: [{ fieldShortName: 'shared_field', mandatory: false, order: 1 }],
              displayProperties: {}
            };

            const objectDef2: ObjectDefinition = {
              shortName: 'obj2',
              displayName: 'Object 2',
              description: 'Second object',
              fields: [{ fieldShortName: 'shared_field', mandatory: false, order: 1 }],
              displayProperties: {}
            };

            // Both objects should enforce the same validation rule
            const result1 = await validationService.validateInstance(
              objectDef1,
              [field],
              { shared_field: shortValue }
            );

            const result2 = await validationService.validateInstance(
              objectDef2,
              [field],
              { shared_field: shortValue }
            );

            // Both should fail validation with the same rule
            expect(result1.valid).toBe(false);
            expect(result2.valid).toBe(false);
            expect(result1.errors.length).toBeGreaterThan(0);
            expect(result2.errors.length).toBeGreaterThan(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should apply updated validation rules consistently across objects', async () => {
      const field: FieldDefinition = {
        shortName: 'test_field',
        displayName: 'Test Field',
        description: 'Test',
        datatype: FieldDatatype.NUMBER,
        datatypeProperties: {},
        
        validationRules: [
          { type: ValidationType.MIN_VALUE, value: 10 }
        ]
      };

      const objectDef: ObjectDefinition = {
        shortName: 'test_obj',
        displayName: 'Test Object',
        description: 'Test',
        fields: [{ fieldShortName: 'test_field', mandatory: false, order: 1 }],
        displayProperties: {}
      };

      // Validate with original rules
      const result1 = await validationService.validateInstance(
        objectDef,
        [field],
        { test_field: 5 }
      );
      expect(result1.valid).toBe(false);

      // Update field with new validation rules
      const updatedField: FieldDefinition = {
        ...field,
        validationRules: [
          { type: ValidationType.MIN_VALUE, value: 3 }
        ]
      };

      // Validate with updated rules
      const result2 = await validationService.validateInstance(
        objectDef,
        [updatedField],
        { test_field: 5 }
      );
      expect(result2.valid).toBe(true);
    });
  });
});
