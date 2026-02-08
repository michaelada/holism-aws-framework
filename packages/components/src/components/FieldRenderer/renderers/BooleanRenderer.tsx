import React from 'react';
import { FormControlLabel, Checkbox, FormHelperText, Box } from '@mui/material';
import type { FieldDefinition } from '../../../types';

export interface BooleanRendererProps {
  fieldDefinition: FieldDefinition;
  value: any;
  onChange: (value: any) => void;
  onBlur?: () => void;
  error?: string | null;
  disabled?: boolean;
}

/**
 * BooleanRenderer for boolean datatype
 */
export function BooleanRenderer({
  fieldDefinition,
  value,
  onChange,
  onBlur,
  error,
  disabled = false,
}: BooleanRendererProps): JSX.Element {
  return (
    <Box>
      <FormControlLabel
        control={
          <Checkbox
            checked={!!value}
            onChange={(e) => onChange(e.target.checked)}
            onBlur={onBlur}
            disabled={disabled}
            color={error ? 'error' : 'primary'}
          />
        }
        label={fieldDefinition.displayName}
      />
      {(error || fieldDefinition.description) && (
        <FormHelperText error={!!error}>
          {error || fieldDefinition.description}
        </FormHelperText>
      )}
    </Box>
  );
}
