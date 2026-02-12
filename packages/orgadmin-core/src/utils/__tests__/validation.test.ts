import { describe, it, expect } from 'vitest';
import {
  required,
  email,
  minLength,
  maxLength,
  min,
  max,
  pattern,
  url,
  phone,
  date,
  validate,
  validateObject,
} from '../validation';

describe('validation utilities', () => {
  describe('required', () => {
    it('should validate required fields', () => {
      const validator = required();

      expect(validator('test').valid).toBe(true);
      expect(validator('').valid).toBe(false);
      expect(validator(null).valid).toBe(false);
      expect(validator(undefined).valid).toBe(false);
    });

    it('should use custom error message', () => {
      const validator = required('Custom error');
      const result = validator('');

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Custom error');
    });
  });

  describe('email', () => {
    it('should validate email addresses', () => {
      const validator = email();

      expect(validator('test@example.com').valid).toBe(true);
      expect(validator('invalid-email').valid).toBe(false);
      expect(validator('').valid).toBe(true); // Empty is valid unless required
    });
  });

  describe('minLength', () => {
    it('should validate minimum length', () => {
      const validator = minLength(5);

      expect(validator('12345').valid).toBe(true);
      expect(validator('123').valid).toBe(false);
      expect(validator('').valid).toBe(true); // Empty is valid unless required
    });
  });

  describe('maxLength', () => {
    it('should validate maximum length', () => {
      const validator = maxLength(5);

      expect(validator('123').valid).toBe(true);
      expect(validator('123456').valid).toBe(false);
    });
  });

  describe('min', () => {
    it('should validate minimum value', () => {
      const validator = min(10);

      expect(validator(15).valid).toBe(true);
      expect(validator(5).valid).toBe(false);
      expect(validator('').valid).toBe(true); // Empty is valid unless required
    });
  });

  describe('max', () => {
    it('should validate maximum value', () => {
      const validator = max(10);

      expect(validator(5).valid).toBe(true);
      expect(validator(15).valid).toBe(false);
    });
  });

  describe('pattern', () => {
    it('should validate against regex pattern', () => {
      const validator = pattern(/^\d{3}-\d{3}$/);

      expect(validator('123-456').valid).toBe(true);
      expect(validator('123456').valid).toBe(false);
    });
  });

  describe('url', () => {
    it('should validate URLs', () => {
      const validator = url();

      expect(validator('https://example.com').valid).toBe(true);
      expect(validator('not-a-url').valid).toBe(false);
      expect(validator('').valid).toBe(true); // Empty is valid unless required
    });
  });

  describe('phone', () => {
    it('should validate phone numbers', () => {
      const validator = phone();

      expect(validator('1234567890').valid).toBe(true);
      expect(validator('(123) 456-7890').valid).toBe(true);
      expect(validator('123').valid).toBe(false);
    });
  });

  describe('date', () => {
    it('should validate dates', () => {
      const validator = date();

      expect(validator(new Date()).valid).toBe(true);
      expect(validator('2024-01-01').valid).toBe(true);
      expect(validator('invalid-date').valid).toBe(false);
    });
  });

  describe('validate', () => {
    it('should validate against multiple rules', () => {
      const rules = [required(), minLength(5), maxLength(10)];

      expect(validate('12345', rules).valid).toBe(true);
      expect(validate('', rules).valid).toBe(false);
      expect(validate('123', rules).valid).toBe(false);
      expect(validate('12345678901', rules).valid).toBe(false);
    });
  });

  describe('validateObject', () => {
    it('should validate object against schema', () => {
      const schema = {
        name: [required(), minLength(3)],
        email: [required(), email()],
        age: [min(18)],
      };

      const validObj = {
        name: 'John',
        email: 'john@example.com',
        age: 25,
      };

      const invalidObj = {
        name: 'Jo',
        email: 'invalid',
        age: 15,
      };

      expect(Object.keys(validateObject(validObj, schema))).toHaveLength(0);
      expect(Object.keys(validateObject(invalidObj, schema)).length).toBeGreaterThan(0);
    });
  });
});
