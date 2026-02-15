import React from 'react';
import { Box, TextField, Typography } from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { enGB } from 'date-fns/locale';

export interface DateRange {
  startDate: Date | null;
  endDate: Date | null;
}

export interface DateRangePickerProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
  label?: string;
  startLabel?: string;
  endLabel?: string;
  minDate?: Date;
  maxDate?: Date;
  disabled?: boolean;
  error?: string;
  helperText?: string;
  required?: boolean;
  timezone?: string;
}

/**
 * DateRangePicker component for selecting date ranges
 * Supports timezone handling and validation
 */
export function DateRangePicker({
  value,
  onChange,
  label,
  startLabel = 'Start Date',
  endLabel = 'End Date',
  minDate,
  maxDate,
  disabled = false,
  error,
  helperText,
  required = false,
  timezone = 'Europe/Dublin',
}: DateRangePickerProps): JSX.Element {
  const handleStartDateChange = (date: Date | null) => {
    onChange({
      ...value,
      startDate: date,
    });
  };

  const handleEndDateChange = (date: Date | null) => {
    onChange({
      ...value,
      endDate: date,
    });
  };

  // Validate that end date is after start date
  const getEndDateError = (): string | undefined => {
    if (value.startDate && value.endDate && value.endDate < value.startDate) {
      return 'End date must be after start date';
    }
    return error;
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={enGB}>
      <Box>
        {label && (
          <Typography variant="body2" gutterBottom>
            {label}
            {required && <span style={{ color: 'error.main' }}> *</span>}
          </Typography>
        )}

        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          <Box sx={{ flex: 1, minWidth: 200 }}>
            <DatePicker
              label={startLabel}
              value={value.startDate}
              onChange={handleStartDateChange}
              disabled={disabled}
              minDate={minDate}
              maxDate={maxDate}
              renderInput={(params) => (
                <TextField
                  {...params}
                  fullWidth
                  required={required}
                  error={!!error}
                  helperText={error || helperText}
                />
              )}
            />
          </Box>

          <Box sx={{ flex: 1, minWidth: 200 }}>
            <DatePicker
              label={endLabel}
              value={value.endDate}
              onChange={handleEndDateChange}
              disabled={disabled}
              minDate={value.startDate || minDate}
              maxDate={maxDate}
              renderInput={(params) => (
                <TextField
                  {...params}
                  fullWidth
                  required={required}
                  error={!!getEndDateError()}
                  helperText={getEndDateError() || helperText}
                />
              )}
            />
          </Box>
        </Box>

        {helperText && !error && (
          <Typography variant="caption" color="textSecondary" sx={{ mt: 1, display: 'block' }}>
            {helperText}
          </Typography>
        )}
      </Box>
    </LocalizationProvider>
  );
}
