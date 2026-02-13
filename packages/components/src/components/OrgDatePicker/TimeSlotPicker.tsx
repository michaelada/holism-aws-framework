import React from 'react';
import {
  Box,
  Typography,
  FormControl,
  FormLabel,
  RadioGroup,
  FormControlLabel,
  Radio,
  Chip,
  Stack,
  Paper,
  FormHelperText,
} from '@mui/material';
import { AccessTime as TimeIcon } from '@mui/icons-material';

export interface TimeSlot {
  id: string;
  startTime: string;
  endTime: string;
  duration: number; // in minutes
  price: number;
  label?: string;
  available: boolean;
  placesRemaining?: number;
}

export interface TimeSlotPickerProps {
  slots: TimeSlot[];
  value: string | null;
  onChange: (slotId: string) => void;
  label?: string;
  disabled?: boolean;
  error?: string;
  helperText?: string;
  required?: boolean;
  currency?: string;
  showPricing?: boolean;
  showAvailability?: boolean;
  timezone?: string;
}

const formatTime = (time: string): string => {
  // Assumes time is in HH:MM format
  return time;
};

const formatDuration = (minutes: number): string => {
  if (minutes < 60) {
    return `${minutes} min`;
  }
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (mins === 0) {
    return `${hours} hr${hours > 1 ? 's' : ''}`;
  }
  return `${hours} hr${hours > 1 ? 's' : ''} ${mins} min`;
};

const formatPrice = (price: number, currency: string = 'EUR'): string => {
  return new Intl.NumberFormat('en-IE', {
    style: 'currency',
    currency,
  }).format(price);
};

/**
 * TimeSlotPicker component for selecting time slots
 * Displays available time slots with pricing and availability information
 * Supports timezone handling
 */
export function TimeSlotPicker({
  slots,
  value,
  onChange,
  label,
  disabled = false,
  error,
  helperText,
  required = false,
  currency = 'EUR',
  showPricing = true,
  showAvailability = true,
  timezone = 'Europe/Dublin',
}: TimeSlotPickerProps): JSX.Element {
  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    onChange(event.target.value);
  };

  const availableSlots = slots.filter((slot) => slot.available);
  const unavailableSlots = slots.filter((slot) => !slot.available);

  return (
    <FormControl component="fieldset" error={!!error} disabled={disabled} fullWidth>
      {label && (
        <FormLabel component="legend" sx={{ mb: 2 }}>
          {label}
          {required && <span style={{ color: 'error.main' }}> *</span>}
        </FormLabel>
      )}

      {availableSlots.length === 0 ? (
        <Paper variant="outlined" sx={{ p: 3, textAlign: 'center' }}>
          <Typography color="textSecondary">No time slots available</Typography>
        </Paper>
      ) : (
        <RadioGroup value={value || ''} onChange={handleChange}>
          <Stack spacing={1}>
            {availableSlots.map((slot) => (
              <Paper
                key={slot.id}
                variant="outlined"
                sx={{
                  p: 2,
                  cursor: disabled ? 'default' : 'pointer',
                  '&:hover': disabled
                    ? {}
                    : {
                        bgcolor: 'action.hover',
                      },
                  border: value === slot.id ? 2 : 1,
                  borderColor: value === slot.id ? 'primary.main' : 'divider',
                }}
              >
                <FormControlLabel
                  value={slot.id}
                  control={<Radio />}
                  label={
                    <Box sx={{ width: '100%', ml: 1 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                        <TimeIcon fontSize="small" color="action" />
                        <Typography variant="body1" fontWeight="medium">
                          {formatTime(slot.startTime)} - {formatTime(slot.endTime)}
                        </Typography>
                        <Chip
                          label={formatDuration(slot.duration)}
                          size="small"
                          variant="outlined"
                        />
                        {slot.label && (
                          <Chip label={slot.label} size="small" color="primary" />
                        )}
                      </Box>

                      <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                        {showPricing && (
                          <Typography variant="body2" color="textSecondary">
                            {formatPrice(slot.price, currency)}
                          </Typography>
                        )}
                        {showAvailability && slot.placesRemaining !== undefined && (
                          <Typography variant="caption" color="textSecondary">
                            {slot.placesRemaining > 0
                              ? `${slot.placesRemaining} place${slot.placesRemaining !== 1 ? 's' : ''} remaining`
                              : 'Last place available'}
                          </Typography>
                        )}
                      </Box>
                    </Box>
                  }
                  sx={{ width: '100%', m: 0 }}
                />
              </Paper>
            ))}
          </Stack>
        </RadioGroup>
      )}

      {unavailableSlots.length > 0 && (
        <Box sx={{ mt: 3 }}>
          <Typography variant="caption" color="textSecondary" gutterBottom>
            Unavailable Time Slots
          </Typography>
          <Stack spacing={1} sx={{ mt: 1 }}>
            {unavailableSlots.map((slot) => (
              <Paper
                key={slot.id}
                variant="outlined"
                sx={{
                  p: 2,
                  bgcolor: 'action.disabledBackground',
                  opacity: 0.6,
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <TimeIcon fontSize="small" color="disabled" />
                  <Typography variant="body2" color="textSecondary">
                    {formatTime(slot.startTime)} - {formatTime(slot.endTime)}
                  </Typography>
                  <Chip label="Unavailable" size="small" disabled />
                </Box>
              </Paper>
            ))}
          </Stack>
        </Box>
      )}

      {(error || helperText) && (
        <FormHelperText sx={{ mt: 1 }}>{error || helperText}</FormHelperText>
      )}

      {timezone && (
        <Typography variant="caption" color="textSecondary" sx={{ mt: 1, display: 'block' }}>
          Times shown in {timezone} timezone
        </Typography>
      )}
    </FormControl>
  );
}
