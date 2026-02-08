import React from 'react';
import { DatePicker, TimePicker, DateTimePicker } from '@mui/x-date-pickers';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFnsV3';
import { TextField } from '@mui/material';
import type { FieldDefinition } from '../../../types';

export interface DateRendererProps {
  fieldDefinition: FieldDefinition;
  value: any;
  onChange: (value: any) => void;
  onBlur?: () => void;
  error?: string | null;
  disabled?: boolean;
}

/**
 * DateRenderer for date, time, and datetime datatypes using MUI DatePicker
 */
export function DateRenderer({
  fieldDefinition,
  value,
  onChange,
  onBlur,
  error,
  disabled = false,
}: DateRendererProps): JSX.Element {
  const dateValue = value ? new Date(value) : null;

  const handleChange = (newValue: Date | null) => {
    onChange(newValue ? newValue.toISOString() : null);
  };

  const renderInput = (params: any) => (
    <TextField
      {...params}
      fullWidth
      error={!!error}
      helperText={error || fieldDefinition.description}
      required={fieldDefinition.mandatory}
      onBlur={onBlur}
    />
  );

  const commonProps = {
    label: fieldDefinition.displayName,
    value: dateValue,
    onChange: handleChange,
    disabled,
    slotProps: {
      textField: {
        fullWidth: true,
        error: !!error,
        helperText: error || fieldDefinition.description,
        required: fieldDefinition.mandatory,
        onBlur,
      },
    },
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      {fieldDefinition.datatype === 'date' && <DatePicker {...commonProps} />}
      {fieldDefinition.datatype === 'time' && <TimePicker {...commonProps} />}
      {fieldDefinition.datatype === 'datetime' && <DateTimePicker {...commonProps} />}
    </LocalizationProvider>
  );
}
