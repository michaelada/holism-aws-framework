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

/**
 * What counts as a phone number.
 *
 * Deliberately permissive about *shape* and strict about *content*: an
 * international number may be written `+353 (0)1 234 5678` or `01-234 5678`,
 * and a club has no business rejecting either. What it must reject is text —
 * letters in a phone field mean the answer is not a phone number. Hence
 * "digits and the punctuation people write numbers with, at least six digits".
 */
const PHONE_PATTERN = /^[+()\-.\s\d]*\d[+()\-.\s\d]*$/;
const PHONE_MIN_DIGITS = 6;

/**
 * Email, deliberately not Yup's `.email()`.
 *
 * Yup accepts `member@club` — a hostname with no dot, which is a valid address
 * on an intranet and a typo on a club entry form. The backend's check (see
 * `backend/src/utils/application-field-validation.ts`) requires the dot, and
 * the two **must** agree: a client that accepts what the server rejects sends
 * the member to a 400 after they have committed to entering, with an error
 * against a field they were told was fine.
 */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export class ValidationService {
  private customValidators: Map<string, (value: any) => boolean> = new Map();

  /**
   * Build a Yup schema for a single field.
   *
   * **The datatype constrains the value on its own**, before any configured
   * rule is applied. A field declared as an email is a promise that what comes
   * back is an email; requiring the form builder to *also* attach an "email"
   * validation rule made that promise optional, and in practice the rule was
   * never attached — so an email field accepted `not an email` and a phone
   * field accepted a sentence. Configured rules narrow further; they are no
   * longer what makes a datatype mean anything.
   */
  buildFieldSchema(field: FieldDefinition): yup.Schema {
    let schema: yup.Schema;
    const options: any[] = field.datatypeProperties?.options ?? [];
    const allowedValues = options
      .map((option: any) => (typeof option === 'string' ? option : option?.value))
      .filter((option: any) => option !== undefined && option !== null)
      .map((option: any) => String(option));

    // Base schema by datatype
    switch (field.datatype) {
      case 'text':
      case 'text_area':
        schema = yup.string();
        break;
      case 'email':
        schema = yup.string().matches(EMAIL_PATTERN, {
          message: 'Must be a valid email address',
          excludeEmptyString: true,
        });
        break;
      case 'url':
        schema = yup.string().url('Must be a valid web address');
        break;
      case 'phone':
        schema = yup
          .string()
          .matches(PHONE_PATTERN, {
            message: 'Must be a valid phone number',
            excludeEmptyString: true,
          })
          .test(
            'phone-digits',
            `Must contain at least ${PHONE_MIN_DIGITS} digits`,
            (value) => !value || (value.match(/\d/g) ?? []).length >= PHONE_MIN_DIGITS
          );
        break;
      case 'number':
        schema = yup.number().typeError('Must be a number');
        break;
      case 'boolean':
        schema = yup.boolean();
        break;
      case 'date':
      case 'datetime':
      case 'time':
        schema = yup.date().typeError('Must be a valid date');
        break;
      case 'single_select':
        schema = yup.string();
        /*
         * An answer outside the offered choices is not an answer. It cannot be
         * produced by using the control, so it means stale options, a renamed
         * choice, or a request that did not come from the form.
         */
        if (allowedValues.length > 0) {
          schema = (schema as yup.StringSchema).oneOf(
            [...allowedValues, '', null, undefined] as any,
            'Choose one of the offered options'
          );
        }
        break;
      case 'multi_select':
        schema = yup
          .array()
          .of(
            allowedValues.length > 0
              ? yup.string().oneOf(allowedValues, 'Choose from the offered options')
              : yup.string()
          )
          .typeError('Must be a list of choices');
        break;
      case 'document_upload':
        schema = yup.array().typeError('Must be a list of files');
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

    // Note: Mandatory constraint is now handled at the object field reference level,
    // not at the field definition level. This method builds the base schema.
    // The caller should apply .required() if the field is mandatory in the object context.
    schema = schema.nullable().optional();

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
   * Validate a single field value synchronously.
   *
   * The async form is what a renderer wants on blur; this is what a *form*
   * wants, which has to answer "may this be submitted?" on every keystroke, in
   * render, for every field at once. Awaiting one promise per field per render
   * to decide whether a button is enabled means the button lags the answer it
   * describes.
   */
  validateFieldSync(field: FieldDefinition, value: any): { valid: boolean; error?: string } {
    const schema = this.buildFieldSchema(field);

    try {
      schema.validateSync(value);
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
