import * as yup from 'yup';
import {
  FieldDefinition,
  ObjectDefinition,
  ValidationRule,
  ValidationType,
  FieldDatatype,
  FieldError
} from '../types/metadata.types';

/**
 * Result of validation operation
 */
export interface ValidationResult {
  valid: boolean;
  errors: FieldError[];
}

/**
 * Service for validating instance data against metadata definitions using Yup
 */
export class ValidationService {
  private customValidators: Map<string, (value: any) => boolean> = new Map();

  /**
   * Build a Yup schema for a single field definition
   */
  buildFieldSchema(field: FieldDefinition): yup.Schema {
    let schema: yup.Schema;

    // Base schema by datatype
    switch (field.datatype) {
      case FieldDatatype.TEXT:
      case FieldDatatype.TEXT_AREA:
        schema = yup.string();
        break;
      case FieldDatatype.EMAIL:
        schema = yup.string().email('Must be a valid email address');
        break;
      case FieldDatatype.URL:
        schema = yup.string().url('Must be a valid URL');
        break;
      case FieldDatatype.NUMBER:
        schema = yup.number().typeError('Must be a valid number');
        break;
      case FieldDatatype.BOOLEAN:
        schema = yup.boolean();
        break;
      case FieldDatatype.DATE:
      case FieldDatatype.TIME:
      case FieldDatatype.DATETIME:
        schema = yup.date().typeError('Must be a valid date');
        break;
      case FieldDatatype.SINGLE_SELECT:
        schema = yup.string();
        break;
      case FieldDatatype.MULTI_SELECT:
        schema = yup.array().of(yup.string());
        break;
      default:
        schema = yup.mixed();
    }

    // Apply validation rules
    if (field.validationRules && field.validationRules.length > 0) {
      for (const rule of field.validationRules) {
        schema = this.applyRule(schema, rule, field.datatype);
      }
    }

    // Note: Mandatory constraint is now handled at the object field reference level,
    // not at the field definition level. This method builds the base schema.
    // The caller should apply .required() if the field is mandatory in the object context.
    schema = schema.nullable().optional();

    return schema;
  }

  /**
   * Apply a single validation rule to a schema
   */
  private applyRule(
    schema: yup.Schema,
    rule: ValidationRule,
    _datatype: FieldDatatype
  ): yup.Schema {
    switch (rule.type) {
      case ValidationType.MIN_LENGTH:
        if (schema instanceof yup.StringSchema) {
          return schema.min(
            rule.value,
            rule.message || `Minimum length is ${rule.value}`
          );
        }
        break;

      case ValidationType.MAX_LENGTH:
        if (schema instanceof yup.StringSchema) {
          return schema.max(
            rule.value,
            rule.message || `Maximum length is ${rule.value}`
          );
        }
        break;

      case ValidationType.PATTERN:
        if (schema instanceof yup.StringSchema) {
          return schema.matches(
            new RegExp(rule.value),
            rule.message || 'Invalid format'
          );
        }
        break;

      case ValidationType.MIN_VALUE:
        if (schema instanceof yup.NumberSchema) {
          return schema.min(
            rule.value,
            rule.message || `Minimum value is ${rule.value}`
          );
        }
        break;

      case ValidationType.MAX_VALUE:
        if (schema instanceof yup.NumberSchema) {
          return schema.max(
            rule.value,
            rule.message || `Maximum value is ${rule.value}`
          );
        }
        break;

      case ValidationType.EMAIL:
        if (schema instanceof yup.StringSchema) {
          return schema.email(rule.message || 'Must be a valid email');
        }
        break;

      case ValidationType.URL:
        if (schema instanceof yup.StringSchema) {
          return schema.url(rule.message || 'Must be a valid URL');
        }
        break;

      case ValidationType.CUSTOM:
        if (rule.customFunction) {
          const customFn = this.getCustomValidator(rule.customFunction);
          return schema.test(
            'custom',
            rule.message || 'Validation failed',
            customFn
          );
        }
        break;
    }

    return schema;
  }

  /**
   * Build a complete object schema from object definition and field definitions
   */
  buildObjectSchema(
    objectDef: ObjectDefinition,
    fields: FieldDefinition[]
  ): yup.ObjectSchema<any> {
    const shape: Record<string, yup.Schema> = {};

    for (const fieldRef of objectDef.fields) {
      const field = fields.find(f => f.shortName === fieldRef.fieldShortName);
      if (field) {
        // Build base schema from field definition
        let fieldSchema = this.buildFieldSchema(field);
        
        // Apply mandatory constraint from object-level setting
        if (fieldRef.mandatory) {
          fieldSchema = fieldSchema.required(`${field.displayName} is required`);
        }
        
        shape[field.shortName] = fieldSchema;
      }
    }

    return yup.object().shape(shape);
  }

  /**
   * Validate instance data against object definition
   */
  async validateInstance(
    objectDef: ObjectDefinition,
    fields: FieldDefinition[],
    data: any
  ): Promise<ValidationResult> {
    const schema = this.buildObjectSchema(objectDef, fields);

    try {
      await schema.validate(data, { abortEarly: false });
      return { valid: true, errors: [] };
    } catch (error) {
      if (error instanceof yup.ValidationError) {
        return {
          valid: false,
          errors: error.inner.map(err => ({
            field: err.path || '',
            message: err.message,
            value: err.value
          }))
        };
      }
      throw error;
    }
  }

  /**
   * Register a custom validation function
   */
  registerCustomValidator(name: string, fn: (value: any) => boolean): void {
    this.customValidators.set(name, fn);
  }

  /**
   * Get a custom validation function by name
   */
  private getCustomValidator(name: string): (value: any) => boolean {
    const validator = this.customValidators.get(name);
    if (!validator) {
      throw new Error(`Custom validator '${name}' not found`);
    }
    return validator;
  }
}

export const validationService = new ValidationService();
