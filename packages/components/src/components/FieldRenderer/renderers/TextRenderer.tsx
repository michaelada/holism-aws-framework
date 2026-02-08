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
 * TextRenderer for text, text_area, email, and url datatypes
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
      type={isEmail ? 'email' : isUrl ? 'url' : 'text'}
      placeholder={fieldDefinition.datatypeProperties?.placeholder}
    />
  );
}
