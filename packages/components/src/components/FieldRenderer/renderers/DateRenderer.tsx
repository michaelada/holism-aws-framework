import React from 'react';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { TimePicker } from '@mui/x-date-pickers/TimePicker';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { enGB } from 'date-fns/locale';
import { TextField } from '@mui/material';
import type { FieldDefinition } from '../../../types';

export interface DateRendererProps {
  fieldDefinition: FieldDefinition;
  value: any;
  onChange: (value: any) => void;
  onBlur?: () => void;
  error?: string | null;
  disabled?: boolean;
  required?: boolean;
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
  required = false,
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
      required={required}
      onBlur={onBlur}
    />
  );

  const commonProps = {
    label: fieldDefinition.displayName,
    value: dateValue,
    onChange: handleChange,
    disabled,
    renderInput,
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={enGB}>
      {fieldDefinition.datatype === 'date' && <DatePicker {...commonProps} />}
      {fieldDefinition.datatype === 'time' && <TimePicker {...commonProps} />}
      {fieldDefinition.datatype === 'datetime' && <DateTimePicker {...commonProps} />}
    </LocalizationProvider>
  );
}
