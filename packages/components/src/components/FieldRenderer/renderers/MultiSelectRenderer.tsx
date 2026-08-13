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
 * MultiSelectRenderer for multi_select datatype.
 *
 * Two presentations, chosen by `datatypeProperties.displayMode` — the same
 * arrangement `SelectRenderer` has for radio vs dropdown:
 *
 * - `'checkbox'` — the choices laid out as checkboxes in a row, all visible at
 *   once. This is what the form builder's **checkbox** field type asks for, and
 *   for the handful of choices such a field usually carries it is the better
 *   control: no click to discover what is on offer, and the answer is readable
 *   without opening anything.
 * - anything else — a dropdown with checkboxes inside it, which stays the right
 *   answer for a long option list that would otherwise fill the form.
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
  const displayMode = fieldDefinition.datatypeProperties?.displayMode || 'dropdown';
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

  if (displayMode === 'checkbox') {
    /*
     * Ticking is a set operation, not an index one: the option order and the
     * order the member ticked in are unrelated, so the new value is built by
     * filtering or appending rather than by splicing at a position.
     */
    const toggle = (optionValue: string) => {
      const next = selectedValues.includes(optionValue)
        ? selectedValues.filter((selected: string) => selected !== optionValue)
        : [...selectedValues, optionValue];
      onChange(next);
    };

    return (
      <FormControl component="fieldset" error={!!error} disabled={disabled} fullWidth>
        <FormLabel component="legend" id={labelId} required={required}>
          {fieldDefinition.displayName}
        </FormLabel>
        {/*
          `row` with wrapping rather than a fixed row: a club may write six
          options or two long ones, and a row that cannot wrap either overflows
          the form or squeezes the labels on a phone.
        */}
        <FormGroup row aria-labelledby={labelId} sx={{ flexWrap: 'wrap', gap: 1 }} onBlur={onBlur}>
          {options.map((option: any) => (
            <FormControlLabel
              key={option.value}
              control={
                <Checkbox
                  checked={selectedValues.includes(option.value)}
                  onChange={() => toggle(option.value)}
                />
              }
              label={option.label}
            />
          ))}
        </FormGroup>
        {(error || fieldDefinition.description) && (
          <FormHelperText>{error || fieldDefinition.description}</FormHelperText>
        )}
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
      {(error || fieldDefinition.description) && (
        <FormHelperText>{error || fieldDefinition.description}</FormHelperText>
      )}
    </FormControl>
  );
}
