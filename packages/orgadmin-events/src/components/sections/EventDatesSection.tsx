/**
 * EventDatesSection
 *
 * Extracted from CreateEventPage.renderEventDates().
 * Renders the event date form fields: start date, end date,
 * open date entries, and entries closing date.
 *
 * All four are required — see `validateDates` in useEventValidation. The
 * pickers are the only place a club can supply them, so each one shows its own
 * error rather than leaving the reader to match a message at the top of the
 * page to a field further down.
 */

import React from 'react';
import {
  Grid,
  TextField,
  Typography,
  Tooltip,
  IconButton,
  InputAdornment,
} from '@mui/material';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { HelpOutline as HelpIcon } from '@mui/icons-material';
import type { EventFormData } from '../../types/event.types';

export interface EventDatesSectionProps {
  formData: EventFormData;
  onChange: (field: keyof EventFormData, value: any) => void;
  /** Keyed by field name. Absent when the parent does not track errors. */
  fieldErrors?: Record<string, string>;
  onClearFieldError?: (field: string) => void;
}

const EventDatesSection: React.FC<EventDatesSectionProps> = ({
  formData,
  onChange,
  fieldErrors = {},
  onClearFieldError,
}) => {
  /*
   * Choosing a date is the correction, so the message goes as soon as it
   * happens. Left until the next save, a field the club has just fixed still
   * reads as wrong.
   */
  const change = (field: keyof EventFormData, value: unknown) => {
    onChange(field, value);
    if (fieldErrors[field as string]) onClearFieldError?.(field as string);
  };

  /** The error if there is one, otherwise the field's standing helper text. */
  const helper = (field: string, standing?: string) => fieldErrors[field] || standing;

  const withHelp = (params: any, field: string, tooltip: string, standing?: string) => (
    <TextField
      {...params}
      fullWidth
      required
      error={Boolean(fieldErrors[field])}
      helperText={helper(field, standing)}
      InputProps={{
        ...params.InputProps,
        endAdornment: (
          <>
            {params.InputProps?.endAdornment}
            <InputAdornment position="end">
              <Tooltip title={tooltip} arrow placement="top">
                <IconButton size="small" edge="end">
                  <HelpIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </InputAdornment>
          </>
        ),
      }}
    />
  );

  return (
    <>
      <Typography variant="body2" color="textSecondary" paragraph>
        Set the event dates and entry opening/closing times
      </Typography>

      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <DatePicker
            label="Event Start Date"
            value={formData.startDate ?? null}
            onChange={(date) => change('startDate', date)}
            renderInput={(params) =>
              withHelp(params, 'startDate', 'The first day of your event')
            }
          />
        </Grid>

        <Grid item xs={12} md={6}>
          <DatePicker
            label="Event End Date"
            value={formData.endDate ?? null}
            onChange={(date) => change('endDate', date)}
            minDate={formData.startDate}
            renderInput={(params) =>
              withHelp(
                params,
                'endDate',
                'The last day of your event (must be on or after the start date)',
                'Must be on or after start date',
              )
            }
          />
        </Grid>

        <Grid item xs={12} md={6}>
          <DateTimePicker
            label="Open Date Entries"
            value={formData.openDateEntries || null}
            onChange={(date) => change('openDateEntries', date)}
            renderInput={(params) =>
              withHelp(
                params,
                'openDateEntries',
                'The date and time when registration opens - people cannot submit entries before this time',
                'Date and time before which people may not submit entries',
              )
            }
          />
        </Grid>

        <Grid item xs={12} md={6}>
          <DateTimePicker
            label="Entries Closing Date"
            value={formData.entriesClosingDate || null}
            onChange={(date) => change('entriesClosingDate', date)}
            minDate={formData.openDateEntries}
            renderInput={(params) =>
              withHelp(
                params,
                'entriesClosingDate',
                'The date and time when registration closes - entries will automatically close at this time',
                'Must be after entries opening date',
              )
            }
          />
        </Grid>
      </Grid>
    </>
  );
};

export default EventDatesSection;
