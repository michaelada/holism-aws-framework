import React from 'react';
import {
  FormControl,
  FormControlLabel,
  FormGroup,
  FormLabel,
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

  /*
   * Without `labelId` the visible label is not the control's accessible name —
   * see SelectRenderer for the same link and why it matters.
   */
  const labelId = `${React.useId()}-label`;

  const handleChange = (event: any) => {
    const newValue = event.target.value;
    onChange(typeof newValue === 'string' ? newValue.split(',') : newValue);
  };

  const getOptionLabel = (optionValue: string) => {
    const option = options.find((opt: any) => opt.value === optionValue);
    return option?.label || optionValue;
  };

  const helperText = error || fieldDefinition.description;

  /*
   * A club that writes three choices should not make the member open something
   * to see them. The form builder's `checkbox` field maps to this renderer, and
   * asks for the choices laid out rather than hidden behind a dropdown; without
   * this branch a checkbox list and a dropdown were the same control.
   */
  if (fieldDefinition.datatypeProperties?.displayMode === 'checkbox') {
    const toggle = (optionValue: string, checked: boolean) => {
      onChange(
        checked
          ? [...selectedValues, optionValue]
          : selectedValues.filter((selected) => selected !== optionValue)
      );
    };

    return (
      <FormControl
        component="fieldset"
        fullWidth
        error={!!error}
        disabled={disabled}
        required={required}
      >
        {/* `component="legend"` is what names the group for a screen reader —
            a plain label leaves the checkboxes announced one by one with no
            sense of the question they answer. */}
        <FormLabel component="legend">{fieldDefinition.displayName}</FormLabel>
        <FormGroup row onBlur={onBlur}>
          {options.map((option: any) => (
            <FormControlLabel
              key={option.value}
              control={
                <Checkbox
                  checked={selectedValues.indexOf(option.value) > -1}
                  onChange={(event) => toggle(option.value, event.target.checked)}
                />
              }
              label={option.label}
            />
          ))}
        </FormGroup>
        {helperText && <FormHelperText>{helperText}</FormHelperText>}
      </FormControl>
    );
  }

  return (
    <FormControl fullWidth error={!!error} disabled={disabled}>
      <InputLabel id={labelId} required={required}>
        {fieldDefinition.displayName}
      </InputLabel>
      <Select
        labelId={labelId}
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
      {helperText && <FormHelperText>{helperText}</FormHelperText>}
    </FormControl>
  );
}
