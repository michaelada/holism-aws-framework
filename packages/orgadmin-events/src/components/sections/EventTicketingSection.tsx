/**
 * EventTicketingSection
 *
 * Extracted from CreateEventPage.renderTicketingSettings().
 * Renders the ticketing configuration fields: generate electronic tickets
 * checkbox, and when enabled: ticket header text, ticket instructions,
 * ticket footer text, ticket validity period, ticket background color,
 * and include event logo checkbox.
 */

import React from 'react';
import {
  Card,
  CardContent,
  Checkbox,
  FormControlLabel,
  Grid,
  TextField,
  Typography,
  Tooltip,
  IconButton,
  InputAdornment,
} from '@mui/material';
import { HelpOutline as HelpIcon } from '@mui/icons-material';
import type { EventFormData } from '../../types/event.types';

export interface EventTicketingSectionProps {
  formData: EventFormData;
  onChange: (field: keyof EventFormData, value: any) => void;
}

const EventTicketingSection: React.FC<EventTicketingSectionProps> = ({
  formData,
  onChange,
}) => {
  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Ticketing Settings
        </Typography>
        <Typography variant="body2" color="textSecondary" paragraph>
          Configure electronic tickets with QR codes for this event
        </Typography>

        <Grid container spacing={3}>
          <Grid item xs={12}>
            <Tooltip title="Enable automatic generation of electronic tickets with QR codes for all bookings" arrow placement="right">
              <FormControlLabel
                control={
                  <Checkbox
                    checked={formData.generateElectronicTickets || false}
                    onChange={(e) => onChange('generateElectronicTickets', e.target.checked)}
                  />
                }
                label="Generate Electronic Tickets"
              />
            </Tooltip>
            <Typography variant="caption" color="textSecondary" display="block" sx={{ ml: 4 }}>
              Automatically generate tickets with QR codes for all bookings
            </Typography>
          </Grid>

          {formData.generateElectronicTickets && (
            <>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  multiline
                  rows={2}
                  label="Ticket Header Text"
                  value={formData.ticketHeaderText || ''}
                  onChange={(e) => onChange('ticketHeaderText', e.target.value)}
                  helperText="Text displayed at top of ticket (optional)"
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <Tooltip title="Optional text to display at the top of the ticket" arrow placement="top">
                          <IconButton size="small" edge="end">
                            <HelpIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </InputAdornment>
                    ),
                  }}
                />
              </Grid>

              <Grid item xs={12}>
                <TextField
                  fullWidth
                  multiline
                  rows={3}
                  label="Ticket Instructions"
                  value={formData.ticketInstructions || ''}
                  onChange={(e) => onChange('ticketInstructions', e.target.value)}
                  helperText="Instructions for ticket holders (e.g., 'Please present this QR code at the entrance')"
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <Tooltip title="Instructions for ticket holders, such as 'Please present this QR code at the entrance'" arrow placement="top">
                          <IconButton size="small" edge="end">
                            <HelpIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </InputAdornment>
                    ),
                  }}
                />
              </Grid>

              <Grid item xs={12}>
                <TextField
                  fullWidth
                  multiline
                  rows={2}
                  label="Ticket Footer Text"
                  value={formData.ticketFooterText || ''}
                  onChange={(e) => onChange('ticketFooterText', e.target.value)}
                  helperText="Text displayed at bottom of ticket (optional)"
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <Tooltip title="Optional text to display at the bottom of the ticket" arrow placement="top">
                          <IconButton size="small" edge="end">
                            <HelpIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </InputAdornment>
                    ),
                  }}
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  type="number"
                  label="Ticket Validity Period (hours)"
                  value={formData.ticketValidityPeriod || ''}
                  onChange={(e) => onChange('ticketValidityPeriod', parseInt(e.target.value) || undefined)}
                  helperText="Hours before event start that ticket becomes valid (optional)"
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <Tooltip title="Number of hours before the event starts that the ticket becomes valid" arrow placement="top">
                          <IconButton size="small" edge="end">
                            <HelpIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </InputAdornment>
                    ),
                  }}
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  type="color"
                  label="Ticket Background Color"
                  value={formData.ticketBackgroundColor || '#ffffff'}
                  onChange={(e) => onChange('ticketBackgroundColor', e.target.value)}
                  helperText="Background color for ticket (optional)"
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <Tooltip title="Choose a background color for the ticket" arrow placement="top">
                          <IconButton size="small" edge="end">
                            <HelpIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </InputAdornment>
                    ),
                  }}
                />
              </Grid>

              <Grid item xs={12}>
                <Tooltip title="Display your organisation's logo on the ticket" arrow placement="right">
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={formData.includeEventLogo || false}
                        onChange={(e) => onChange('includeEventLogo', e.target.checked)}
                      />
                    }
                    label="Include Event Logo"
                  />
                </Tooltip>
                <Typography variant="caption" color="textSecondary" display="block" sx={{ ml: 4 }}>
                  Show organisation logo on ticket
                </Typography>
              </Grid>
            </>
          )}
        </Grid>
      </CardContent>
    </Card>
  );
};

export default EventTicketingSection;
