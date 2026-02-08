import { useState, useCallback } from 'react';
import type { FieldDefinition } from '../types';
import { defaultValidationService, ValidationService } from '../validation';

export interface UseFieldValidationOptions {
  validationService?: ValidationService;
}

export interface UseFieldValidationResult {
  error: string | null;
  validate: (value: any) => Promise<boolean>;
  clearError: () => void;
}

/**
 * Hook for client-side field validation
 * 
 * @param field - Field definition with validation rules
 * @param options - Configuration options
 * @returns Validation state and functions
 * 
 * @example
 * ```tsx
 * const { error, validate } = useFieldValidation(fieldDefinition);
 * 
 * const handleBlur = async (e) => {
 *   await validate(e.target.value);
 * };
 * 
 * return (
 *   <TextField
 *     error={!!error}
 *     helperText={error}
 *     onBlur={handleBlur}
 *   />
 * );
 * ```
 */
export function useFieldValidation(
  field: FieldDefinition,
  options: UseFieldValidationOptions = {}
): UseFieldValidationResult {
  const { validationService = defaultValidationService } = options;
  const [error, setError] = useState<string | null>(null);

  const validate = useCallback(
    async (value: any): Promise<boolean> => {
      try {
        const result = await validationService.validateField(field, value);
        
        if (result.valid) {
          setError(null);
          return true;
        } else {
          setError(result.error || 'Validation failed');
          return false;
        }
      } catch (err) {
        setError('Validation error occurred');
        return false;
      }
    },
    [field, validationService]
  );

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    error,
    validate,
    clearError,
  };
}
