/**
 * Validation utilities for form inputs
 */

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validation rule
 */
export type ValidationRule = (value: any) => ValidationResult;

/**
 * Required field validator
 */
export const required = (message = 'This field is required'): ValidationRule => {
  return (value: any): ValidationResult => {
    if (value === null || value === undefined || value === '') {
      return { valid: false, error: message };
    }
    if (typeof value === 'string' && value.trim() === '') {
      return { valid: false, error: message };
    }
    if (Array.isArray(value) && value.length === 0) {
      return { valid: false, error: message };
    }
    return { valid: true };
  };
};

/**
 * Email validator
 */
export const email = (message = 'Please enter a valid email address'): ValidationRule => {
  return (value: any): ValidationResult => {
    if (!value) return { valid: true }; // Allow empty unless required
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(value)) {
      return { valid: false, error: message };
    }
    return { valid: true };
  };
};

/**
 * Minimum length validator
 */
export const minLength = (min: number, message?: string): ValidationRule => {
  return (value: any): ValidationResult => {
    if (!value) return { valid: true }; // Allow empty unless required
    
    const length = typeof value === 'string' ? value.length : 0;
    if (length < min) {
      return {
        valid: false,
        error: message || `Must be at least ${min} characters`,
      };
    }
    return { valid: true };
  };
};

/**
 * Maximum length validator
 */
export const maxLength = (max: number, message?: string): ValidationRule => {
  return (value: any): ValidationResult => {
    if (!value) return { valid: true }; // Allow empty unless required
    
    const length = typeof value === 'string' ? value.length : 0;
    if (length > max) {
      return {
        valid: false,
        error: message || `Must be no more than ${max} characters`,
      };
    }
    return { valid: true };
  };
};

/**
 * Minimum value validator (for numbers)
 */
export const min = (minValue: number, message?: string): ValidationRule => {
  return (value: any): ValidationResult => {
    if (value === null || value === undefined || value === '') return { valid: true };
    
    const numValue = typeof value === 'number' ? value : parseFloat(value);
    if (isNaN(numValue) || numValue < minValue) {
      return {
        valid: false,
        error: message || `Must be at least ${minValue}`,
      };
    }
    return { valid: true };
  };
};

/**
 * Maximum value validator (for numbers)
 */
export const max = (maxValue: number, message?: string): ValidationRule => {
  return (value: any): ValidationResult => {
    if (value === null || value === undefined || value === '') return { valid: true };
    
    const numValue = typeof value === 'number' ? value : parseFloat(value);
    if (isNaN(numValue) || numValue > maxValue) {
      return {
        valid: false,
        error: message || `Must be no more than ${maxValue}`,
      };
    }
    return { valid: true };
  };
};

/**
 * Pattern validator (regex)
 */
export const pattern = (regex: RegExp, message = 'Invalid format'): ValidationRule => {
  return (value: any): ValidationResult => {
    if (!value) return { valid: true }; // Allow empty unless required
    
    if (!regex.test(value)) {
      return { valid: false, error: message };
    }
    return { valid: true };
  };
};

/**
 * URL validator
 */
export const url = (message = 'Please enter a valid URL'): ValidationRule => {
  return (value: any): ValidationResult => {
    if (!value) return { valid: true }; // Allow empty unless required
    
    try {
      new URL(value);
      return { valid: true };
    } catch {
      return { valid: false, error: message };
    }
  };
};

/**
 * Phone number validator (basic)
 */
export const phone = (message = 'Please enter a valid phone number'): ValidationRule => {
  return (value: any): ValidationResult => {
    if (!value) return { valid: true }; // Allow empty unless required
    
    // Basic phone validation - digits, spaces, dashes, parentheses, plus
    const phoneRegex = /^[\d\s\-\(\)\+]+$/;
    if (!phoneRegex.test(value) || value.replace(/\D/g, '').length < 10) {
      return { valid: false, error: message };
    }
    return { valid: true };
  };
};

/**
 * Date validator
 */
export const date = (message = 'Please enter a valid date'): ValidationRule => {
  return (value: any): ValidationResult => {
    if (!value) return { valid: true }; // Allow empty unless required
    
    const dateValue = value instanceof Date ? value : new Date(value);
    if (isNaN(dateValue.getTime())) {
      return { valid: false, error: message };
    }
    return { valid: true };
  };
};

/**
 * Custom validator
 */
export const custom = (
  validator: (value: any) => boolean,
  message = 'Invalid value'
): ValidationRule => {
  return (value: any): ValidationResult => {
    if (!validator(value)) {
      return { valid: false, error: message };
    }
    return { valid: true };
  };
};

/**
 * Validate a value against multiple rules
 */
export const validate = (value: any, rules: ValidationRule[]): ValidationResult => {
  for (const rule of rules) {
    const result = rule(value);
    if (!result.valid) {
      return result;
    }
  }
  return { valid: true };
};

/**
 * Validate an object against a schema
 */
export const validateObject = (
  obj: Record<string, any>,
  schema: Record<string, ValidationRule[]>
): Record<string, string> => {
  const errors: Record<string, string> = {};

  for (const [field, rules] of Object.entries(schema)) {
    const result = validate(obj[field], rules);
    if (!result.valid && result.error) {
      errors[field] = result.error;
    }
  }

  return errors;
};
