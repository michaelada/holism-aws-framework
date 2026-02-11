import React from 'react';
import { TextField } from '@mui/material';
import type { FieldDefinition } from '../../../types';

export interface NumberRendererProps {
  fieldDefinition: FieldDefinition;
  value: any;
  onChange: (value: any) => void;
  onBlur?: () => void;
  error?: string | null;
  disabled?: boolean;
  required?: boolean;
}

/**
 * NumberRenderer for number datatype
 * Supports precision property to control decimal places display
 */
export function NumberRenderer({
  fieldDefinition,
  value,
  onChange,
  onBlur,
  error,
  disabled = false,
  required = false,
}: NumberRendererProps): JSX.Element {
  const precision = fieldDefinition.datatypeProperties?.precision ?? 0;
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    // Allow empty string or valid numbers
    if (newValue === '') {
      onChange(null);
    } else {
      const numValue = Number(newValue);
      if (!isNaN(numValue)) {
        onChange(numValue);
      }
    }
  };

  // Format display value with precision
  const displayValue = value !== null && value !== undefined && value !== ''
    ? Number(value).toFixed(precision)
    : '';

  return (
    <TextField
      fullWidth
      type="number"
      label={fieldDefinition.displayName}
      helperText={error || fieldDefinition.description}
      error={!!error}
      value={displayValue}
      onChange={handleChange}
      onBlur={onBlur}
      disabled={disabled}
      required={required}
      inputProps={{
        step: fieldDefinition.datatypeProperties?.step || (precision > 0 ? Math.pow(10, -precision) : 1),
        min: fieldDefinition.datatypeProperties?.min,
        max: fieldDefinition.datatypeProperties?.max,
      }}
    />
  );
}
