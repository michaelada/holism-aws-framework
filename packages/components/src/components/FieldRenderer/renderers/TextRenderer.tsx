import React from 'react';
import { TextField } from '@mui/material';
import type { FieldDefinition } from '../../../types';

export interface TextRendererProps {
  fieldDefinition: FieldDefinition;
  value: any;
  onChange: (value: any) => void;
  onBlur?: () => void;
  error?: string | null;
  disabled?: boolean;
  required?: boolean;
  required?: boolean;
}

/**
 * TextRenderer for text, text_area, email, url and phone datatypes.
 *
 * The `type` is what a phone keypad and an email keyboard hang off on a
 * handset, and what the browser autofills against. It is not the validation —
 * `type="email"` is enforced only by native form submission, which this form
 * does not use; that lives in `ValidationService` and runs on blur and before
 * submit.
 */
export function TextRenderer({
  fieldDefinition,
  value,
  onChange,
  onBlur,
  error,
  disabled = false,
  required = false,
}: TextRendererProps): JSX.Element {
  const isTextArea = fieldDefinition.datatype === 'text_area';
  const isEmail = fieldDefinition.datatype === 'email';
  const isUrl = fieldDefinition.datatype === 'url';
  const isPhone = fieldDefinition.datatype === 'phone';

  return (
    <TextField
      fullWidth
      label={fieldDefinition.displayName}
      helperText={error || fieldDefinition.description}
      error={!!error}
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onBlur}
      disabled={disabled}
      required={required}
      multiline={isTextArea}
      rows={isTextArea ? 4 : undefined}
      type={isEmail ? 'email' : isUrl ? 'url' : isPhone ? 'tel' : 'text'}
      autoComplete={isEmail ? 'email' : isPhone ? 'tel' : undefined}
      inputProps={isPhone ? { inputMode: 'tel' } : undefined}
      placeholder={fieldDefinition.datatypeProperties?.placeholder}
    />
  );
}
