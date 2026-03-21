/**
 * EventDatesSection
 *
 * Extracted from CreateEventPage.renderEventDates().
 * Renders the event date form fields: start date, end date,
 * open date entries, and entries closing date.
 */

import React from 'react';
import {
  Card,
  CardContent,
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
}

const EventDatesSection: React.FC<EventDatesSectionProps> = ({
  formData,
  onChange,
}) => {
  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Event Dates
        </Typography>
        <Typography variant="body2" color="textSecondary" paragraph>
          Set the event dates and entry opening/closing times
        </Typography>

        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <DatePicker
              label="Event Start Date"
              value={formData.startDate}
              onChange={(date) => onChange('startDate', date)}
              renderInput={(params) => (
                <TextField
                  {...params}
                  fullWidth
                  required
                  InputProps={{
                    ...params.InputProps,
                    endAdornment: (
                      <>
                        {params.InputProps?.endAdornment}
                        <InputAdornment position="end">
                          <Tooltip title="The first day of your event" arrow placement="top">
                            <IconButton size="small" edge="end">
                              <HelpIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </InputAdornment>
                      </>
                    ),
                  }}
                />
              )}
            />
          </Grid>

          <Grid item xs={12} md={6}>
            <DatePicker
              label="Event End Date"
              value={formData.endDate}
              onChange={(date) => onChange('endDate', date)}
              minDate={formData.startDate}
              renderInput={(params) => (
                <TextField
                  {...params}
                  fullWidth
                  required
                  helperText="Must be on or after start date"
                  InputProps={{
                    ...params.InputProps,
                    endAdornment: (
                      <>
                        {params.InputProps?.endAdornment}
                        <InputAdornment position="end">
                          <Tooltip title="The last day of your event (must be on or after the start date)" arrow placement="top">
                            <IconButton size="small" edge="end">
                              <HelpIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </InputAdornment>
                      </>
                    ),
                  }}
                />
              )}
            />
          </Grid>

          <Grid item xs={12} md={6}>
            <DateTimePicker
              label="Open Date Entries"
              value={formData.openDateEntries || null}
              onChange={(date) => onChange('openDateEntries', date)}
              renderInput={(params) => (
                <TextField
                  {...params}
                  fullWidth
                  required
                  helperText="Date and time before which people may not submit entries"
                  InputProps={{
                    ...params.InputProps,
                    endAdornment: (
                      <>
                        {params.InputProps?.endAdornment}
                        <InputAdornment position="end">
                          <Tooltip title="The date and time when registration opens - people cannot submit entries before this time" arrow placement="top">
                            <IconButton size="small" edge="end">
                              <HelpIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </InputAdornment>
                      </>
                    ),
                  }}
                />
              )}
            />
          </Grid>

          <Grid item xs={12} md={6}>
            <DateTimePicker
              label="Entries Closing Date"
              value={formData.entriesClosingDate || null}
              onChange={(date) => onChange('entriesClosingDate', date)}
              minDate={formData.openDateEntries}
              renderInput={(params) => (
                <TextField
                  {...params}
                  fullWidth
                  required
                  helperText="Must be after entries opening date"
                  InputProps={{
                    ...params.InputProps,
                    endAdornment: (
                      <>
                        {params.InputProps?.endAdornment}
                        <InputAdornment position="end">
                          <Tooltip title="The date and time when registration closes - entries will automatically close at this time" arrow placement="top">
                            <IconButton size="small" edge="end">
                              <HelpIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </InputAdornment>
                      </>
                    ),
                  }}
                />
              )}
            />
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  );
};

export default EventDatesSection;
