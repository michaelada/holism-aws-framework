import React from 'react';
import {
  FormControl,
  FormLabel,
  RadioGroup,
  Radio,
  FormControlLabel,
  Select,
  MenuItem,
  InputLabel,
  FormHelperText,
} from '@mui/material';
import type { FieldDefinition } from '../../../types';

export interface SelectRendererProps {
  fieldDefinition: FieldDefinition;
  value: any;
  onChange: (value: any) => void;
  onBlur?: () => void;
  error?: string | null;
  disabled?: boolean;
  required?: boolean;
}

/**
 * SelectRenderer for single_select datatype
 * Renders as Radio or Select based on displayMode property
 */
export function SelectRenderer({
  fieldDefinition,
  value,
  onChange,
  onBlur,
  error,
  disabled = false,
  required = false,
}: SelectRendererProps): JSX.Element {
  const displayMode = fieldDefinition.datatypeProperties?.displayMode || 'dropdown';
  const options = fieldDefinition.datatypeProperties?.options || [];

  if (displayMode === 'radio') {
    return (
      <FormControl component="fieldset" error={!!error} disabled={disabled} fullWidth>
        <FormLabel component="legend" required={required}>
          {fieldDefinition.displayName}
        </FormLabel>
        <RadioGroup
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
        >
          {options.map((option: any) => (
            <FormControlLabel
              key={option.value}
              value={option.value}
              control={<Radio />}
              label={option.label}
            />
          ))}
        </RadioGroup>
        {(error || fieldDefinition.description) && (
          <FormHelperText>{error || fieldDefinition.description}</FormHelperText>
        )}
      </FormControl>
    );
  }

  // Default to dropdown
  return (
    <FormControl fullWidth error={!!error} disabled={disabled}>
      <InputLabel required={required}>
        {fieldDefinition.displayName}
      </InputLabel>
      <Select
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        label={fieldDefinition.displayName}
      >
        {options.map((option: any) => (
          <MenuItem key={option.value} value={option.value}>
            {option.label}
          </MenuItem>
        ))}
      </Select>
      {(error || fieldDefinition.description) && (
        <FormHelperText>{error || fieldDefinition.description}</FormHelperText>
      )}
    </FormControl>
  );
}
