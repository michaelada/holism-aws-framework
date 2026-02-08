import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useFieldValidation } from '../useFieldValidation';
import type { FieldDefinition } from '../../types';

describe('useFieldValidation', () => {
  let textField: FieldDefinition;
  let emailField: FieldDefinition;
  let numberField: FieldDefinition;

  beforeEach(() => {
    textField = {
      shortName: 'name',
      displayName: 'Name',
      description: 'Name field',
      datatype: 'text',
      datatypeProperties: {},
      mandatory: true,
      validationRules: [
        { type: 'min_length', value: 3, message: 'Name must be at least 3 characters' },
      ],
    };

    emailField = {
      shortName: 'email',
      displayName: 'Email',
      description: 'Email field',
      datatype: 'email',
      datatypeProperties: {},
      mandatory: true,
      validationRules: [{ type: 'email', message: 'Must be a valid email' }],
    };

    numberField = {
      shortName: 'age',
      displayName: 'Age',
      description: 'Age field',
      datatype: 'number',
      datatypeProperties: {},
      mandatory: false,
      validationRules: [
        { type: 'min_value', value: 0, message: 'Age must be positive' },
        { type: 'max_value', value: 150, message: 'Age must be less than 150' },
      ],
    };
  });

  it('should validate a valid text field', async () => {
    const { result } = renderHook(() => useFieldValidation(textField));

    let isValid: boolean = false;
    await act(async () => {
      isValid = await result.current.validate('John Doe');
    });

    expect(isValid).toBe(true);
    expect(result.current.error).toBeNull();
  });

  it('should fail validation for text field that is too short', async () => {
    const { result } = renderHook(() => useFieldValidation(textField));

    let isValid: boolean = true;
    await act(async () => {
      isValid = await result.current.validate('Jo');
    });

    expect(isValid).toBe(false);
    expect(result.current.error).toBeTruthy();
  });

  it('should fail validation for mandatory field with empty value', async () => {
    const { result } = renderHook(() => useFieldValidation(textField));

    let isValid: boolean = true;
    await act(async () => {
      isValid = await result.current.validate('');
    });

    expect(isValid).toBe(false);
    // Yup validates min_length before required, so we get the min_length error
    expect(result.current.error).toBeTruthy();
  });

  it('should validate a valid email', async () => {
    const { result } = renderHook(() => useFieldValidation(emailField));

    let isValid: boolean = false;
    await act(async () => {
      isValid = await result.current.validate('test@example.com');
    });

    expect(isValid).toBe(true);
    expect(result.current.error).toBeNull();
  });

  it('should fail validation for invalid email', async () => {
    const { result } = renderHook(() => useFieldValidation(emailField));

    let isValid: boolean = true;
    await act(async () => {
      isValid = await result.current.validate('invalid-email');
    });

    expect(isValid).toBe(false);
    expect(result.current.error).toBeTruthy();
  });

  it('should validate a valid number within range', async () => {
    const { result } = renderHook(() => useFieldValidation(numberField));

    let isValid: boolean = false;
    await act(async () => {
      isValid = await result.current.validate(25);
    });

    expect(isValid).toBe(true);
    expect(result.current.error).toBeNull();
  });

  it('should fail validation for number below minimum', async () => {
    const { result } = renderHook(() => useFieldValidation(numberField));

    let isValid: boolean = true;
    await act(async () => {
      isValid = await result.current.validate(-5);
    });

    expect(isValid).toBe(false);
    expect(result.current.error).toBeTruthy();
  });

  it('should fail validation for number above maximum', async () => {
    const { result } = renderHook(() => useFieldValidation(numberField));

    let isValid: boolean = true;
    await act(async () => {
      isValid = await result.current.validate(200);
    });

    expect(isValid).toBe(false);
    expect(result.current.error).toBeTruthy();
  });

  it('should clear error', async () => {
    const { result } = renderHook(() => useFieldValidation(textField));

    await act(async () => {
      await result.current.validate('Jo'); // Invalid
    });

    expect(result.current.error).toBeTruthy();

    act(() => {
      result.current.clearError();
    });

    expect(result.current.error).toBeNull();
  });

  it('should allow null for non-mandatory field', async () => {
    const { result } = renderHook(() => useFieldValidation(numberField));

    let isValid: boolean = false;
    await act(async () => {
      isValid = await result.current.validate(null);
    });

    expect(isValid).toBe(true);
    expect(result.current.error).toBeNull();
  });
});
