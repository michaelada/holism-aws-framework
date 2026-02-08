import React from 'react';
import {
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Checkbox,
  ListItemText,
  FormHelperText,
  Chip,
  Box,
} from '@mui/material';
import type { FieldDefinition } from '../../../types';

export interface MultiSelectRendererProps {
  fieldDefinition: FieldDefinition;
  value: any;
  onChange: (value: any) => void;
  onBlur?: () => void;
  error?: string | null;
  disabled?: boolean;
  required?: boolean;
}

/**
 * MultiSelectRenderer for multi_select datatype
 */
export function MultiSelectRenderer({
  fieldDefinition,
  value,
  onChange,
  onBlur,
  error,
  disabled = false,
  required = false,
}: MultiSelectRendererProps): JSX.Element {
  const options = fieldDefinition.datatypeProperties?.options || [];
  const selectedValues = Array.isArray(value) ? value : [];

  const handleChange = (event: any) => {
    const newValue = event.target.value;
    onChange(typeof newValue === 'string' ? newValue.split(',') : newValue);
  };

  const getOptionLabel = (optionValue: string) => {
    const option = options.find((opt: any) => opt.value === optionValue);
    return option?.label || optionValue;
  };

  return (
    <FormControl fullWidth error={!!error} disabled={disabled}>
      <InputLabel required={required}>
        {fieldDefinition.displayName}
      </InputLabel>
      <Select
        multiple
        value={selectedValues}
        onChange={handleChange}
        onBlur={onBlur}
        label={fieldDefinition.displayName}
        renderValue={(selected) => (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
            {(selected as string[]).map((val) => (
              <Chip key={val} label={getOptionLabel(val)} size="small" />
            ))}
          </Box>
        )}
      >
        {options.map((option: any) => (
          <MenuItem key={option.value} value={option.value}>
            <Checkbox checked={selectedValues.indexOf(option.value) > -1} />
            <ListItemText primary={option.label} />
          </MenuItem>
        ))}
      </Select>
      {(error || fieldDefinition.description) && (
        <FormHelperText>{error || fieldDefinition.description}</FormHelperText>
      )}
    </FormControl>
  );
}
