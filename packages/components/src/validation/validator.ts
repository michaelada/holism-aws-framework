/**
 * Validation service using Yup for client-side validation
 * Mirrors the backend validation logic
 */

import * as yup from 'yup';
import type {
  FieldDefinition,
  ObjectDefinition,
  ValidationRule,
  FieldDatatype,
  ValidationResult,
} from '../types';

export class ValidationService {
  private customValidators: Map<string, (value: any) => boolean> = new Map();

  /**
   * Build a Yup schema for a single field
   */
  buildFieldSchema(field: FieldDefinition): yup.Schema {
    let schema: yup.Schema;

    // Base schema by datatype
    switch (field.datatype) {
      case 'text':
      case 'text_area':
      case 'email':
      case 'url':
        schema = yup.string();
        break;
      case 'number':
        schema = yup.number();
        break;
      case 'boolean':
        schema = yup.boolean();
        break;
      case 'date':
      case 'datetime':
      case 'time':
        schema = yup.date();
        break;
      case 'single_select':
        schema = yup.string();
        break;
      case 'multi_select':
        schema = yup.array().of(yup.string());
        break;
      default:
        schema = yup.mixed();
    }

    // Apply validation rules
    if (field.validationRules) {
      for (const rule of field.validationRules) {
        schema = this.applyRule(schema, rule, field.datatype);
      }
    }

    // Apply mandatory constraint
    if (field.mandatory) {
      schema = schema.required(`${field.displayName} is required`);
    } else {
      schema = schema.nullable().optional();
    }

    return schema;
  }

  /**
   * Apply a validation rule to a schema
   */
  private applyRule(
    schema: yup.Schema,
    rule: ValidationRule,
    _datatype: FieldDatatype
  ): yup.Schema {
    switch (rule.type) {
      case 'min_length':
        if (schema instanceof yup.StringSchema) {
          return schema.min(
            rule.value,
            rule.message || `Minimum length is ${rule.value}`
          );
        }
        break;

      case 'max_length':
        if (schema instanceof yup.StringSchema) {
          return schema.max(
            rule.value,
            rule.message || `Maximum length is ${rule.value}`
          );
        }
        break;

      case 'pattern':
        if (schema instanceof yup.StringSchema) {
          return schema.matches(
            new RegExp(rule.value),
            rule.message || 'Invalid format'
          );
        }
        break;

      case 'min_value':
        if (schema instanceof yup.NumberSchema) {
          return schema.min(
            rule.value,
            rule.message || `Minimum value is ${rule.value}`
          );
        }
        break;

      case 'max_value':
        if (schema instanceof yup.NumberSchema) {
          return schema.max(
            rule.value,
            rule.message || `Maximum value is ${rule.value}`
          );
        }
        break;

      case 'email':
        if (schema instanceof yup.StringSchema) {
          return schema.email(rule.message || 'Must be a valid email');
        }
        break;

      case 'url':
        if (schema instanceof yup.StringSchema) {
          return schema.url(rule.message || 'Must be a valid URL');
        }
        break;

      case 'custom':
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
   * Build complete object schema from Object Definition
   */
  buildObjectSchema(
    objectDef: ObjectDefinition,
    fields: FieldDefinition[]
  ): yup.ObjectSchema<any> {
    const shape: Record<string, yup.Schema> = {};

    for (const fieldRef of objectDef.fields) {
      const field = fields.find((f) => f.shortName === fieldRef.fieldShortName);
      if (field) {
        // Override mandatory setting from object definition
        shape[field.shortName] = this.buildFieldSchema({
          ...field,
          mandatory: fieldRef.mandatory,
        });
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
          errors: error.inner.map((err) => ({
            field: err.path || '',
            message: err.message,
            value: err.value,
          })),
        };
      }
      throw error;
    }
  }

  /**
   * Validate a single field value
   */
  async validateField(
    field: FieldDefinition,
    value: any
  ): Promise<{ valid: boolean; error?: string }> {
    const schema = this.buildFieldSchema(field);

    try {
      await schema.validate(value);
      return { valid: true };
    } catch (error) {
      if (error instanceof yup.ValidationError) {
        return { valid: false, error: error.message };
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
   * Get a custom validator by name
   */
  private getCustomValidator(name: string): (value: any) => boolean {
    const validator = this.customValidators.get(name);
    if (!validator) {
      throw new Error(`Custom validator '${name}' not found`);
    }
    return validator;
  }
}

// Default validation service instance
export const defaultValidationService = new ValidationService();
