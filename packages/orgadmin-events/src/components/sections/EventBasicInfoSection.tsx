/**
 * EventBasicInfoSection
 *
 * Extracted from CreateEventPage.renderBasicInformation().
 * Renders the basic information form fields for an event:
 * name, description, email notifications, entry limits,
 * confirmation message, event type, venue, and discounts.
 */

import React, { useState, useEffect } from 'react';
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
  Select,
  MenuItem,
  FormControl,
  InputLabel,
} from '@mui/material';
import { HelpOutline as HelpIcon } from '@mui/icons-material';
import { useOrganisation } from '@aws-web-framework/orgadmin-core';
import { useTranslation, useCapabilities } from '@aws-web-framework/orgadmin-shell';
import { DiscountSelector } from '@aws-web-framework/components';
import type { Discount } from '@aws-web-framework/components';
import type { EventFormData } from '../../types/event.types';

export interface EventBasicInfoSectionProps {
  formData: EventFormData;
  fieldErrors: Record<string, string>;
  onChange: (field: keyof EventFormData, value: any) => void;
  onClearFieldError: (field: string) => void;
  eventTypes: Array<{ id: string; name: string }>;
  venues: Array<{ id: string; name: string }>;
  discounts: Discount[];
  fetchDiscounts: (organisationId: string, moduleType: string) => Promise<Discount[]>;
}

const EventBasicInfoSection: React.FC<EventBasicInfoSectionProps> = ({
  formData,
  fieldErrors,
  onChange,
  onClearFieldError,
  eventTypes,
  venues,
  fetchDiscounts,
}) => {
  const { t } = useTranslation();
  const { hasCapability } = useCapabilities();
  const { organisation } = useOrganisation();

  // Local UI-only state for toggling event type/venue selection
  const [addEventType, setAddEventType] = useState(!!formData.eventTypeId);
  const [addVenue, setAddVenue] = useState(!!formData.venueId);

  // Sync checkboxes when formData changes externally (e.g. loading an event)
  useEffect(() => {
    setAddEventType(!!formData.eventTypeId);
  }, [formData.eventTypeId]);

  useEffect(() => {
    setAddVenue(!!formData.venueId);
  }, [formData.venueId]);

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          {t('events.basicInfo.title')}
        </Typography>
        <Typography variant="body2" color="textSecondary" paragraph>
          {t('events.basicInfo.description')}
        </Typography>

        <Grid container spacing={3}>
          <Grid item xs={12}>
            <TextField
              fullWidth
              required
              label={t('events.basicInfo.eventName')}
              value={formData.name}
              onChange={(e) => {
                onChange('name', e.target.value);
                if (fieldErrors.name) {
                  onClearFieldError('name');
                }
              }}
              error={!!fieldErrors.name}
              helperText={fieldErrors.name || t('events.basicInfo.eventNameHelper')}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <Tooltip title={t('events.basicInfo.eventNameTooltip')} arrow placement="top">
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
              required
              multiline
              rows={4}
              label={t('events.basicInfo.eventDescription')}
              value={formData.description}
              onChange={(e) => {
                onChange('description', e.target.value);
                if (fieldErrors.description) {
                  onClearFieldError('description');
                }
              }}
              error={!!fieldErrors.description}
              helperText={fieldErrors.description || t('events.basicInfo.eventDescriptionHelper')}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <Tooltip title={t('events.basicInfo.eventDescriptionTooltip')} arrow placement="top">
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
              label={t('events.basicInfo.emailNotifications')}
              value={formData.emailNotifications}
              onChange={(e) => onChange('emailNotifications', e.target.value)}
              helperText={t('events.basicInfo.emailNotificationsHelper')}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <Tooltip title={t('events.basicInfo.emailNotificationsTooltip')} arrow placement="top">
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
            <Tooltip title={t('events.basicInfo.limitEntriesTooltip')} arrow placement="right">
              <FormControlLabel
                control={
                  <Checkbox
                    checked={formData.limitEntries}
                    onChange={(e) => onChange('limitEntries', e.target.checked)}
                  />
                }
                label={t('events.basicInfo.limitEntries')}
              />
            </Tooltip>
          </Grid>

          {formData.limitEntries && (
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                type="number"
                label={t('events.basicInfo.entriesLimit')}
                value={formData.entriesLimit || ''}
                onChange={(e) => onChange('entriesLimit', parseInt(e.target.value) || undefined)}
                helperText={t('events.basicInfo.entriesLimitHelper')}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <Tooltip title={t('events.basicInfo.entriesLimitTooltip')} arrow placement="top">
                        <IconButton size="small" edge="end">
                          <HelpIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>
          )}

          <Grid item xs={12}>
            <Tooltip title={t('events.basicInfo.addConfirmationMessageTooltip')} arrow placement="right">
              <FormControlLabel
                control={
                  <Checkbox
                    checked={formData.addConfirmationMessage}
                    onChange={(e) => onChange('addConfirmationMessage', e.target.checked)}
                  />
                }
                label={t('events.basicInfo.addConfirmationMessage')}
              />
            </Tooltip>
          </Grid>

          {formData.addConfirmationMessage && (
            <Grid item xs={12}>
              <TextField
                fullWidth
                multiline
                rows={3}
                label={t('events.basicInfo.confirmationMessage')}
                value={formData.confirmationMessage || ''}
                onChange={(e) => onChange('confirmationMessage', e.target.value)}
                helperText={t('events.basicInfo.confirmationMessageHelper')}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <Tooltip title={t('events.basicInfo.confirmationMessageTooltip')} arrow placement="top">
                        <IconButton size="small" edge="end">
                          <HelpIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>
          )}

          {/* Event Type Selection */}
          {eventTypes.length > 0 && (
            <>
              <Grid item xs={12}>
                <Tooltip title="Categorize your event by selecting an event type" arrow placement="right">
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={addEventType}
                        onChange={(e) => {
                          setAddEventType(e.target.checked);
                          if (!e.target.checked) {
                            onChange('eventTypeId', undefined);
                          }
                        }}
                      />
                    }
                    label="Add Event Type"
                  />
                </Tooltip>
              </Grid>

              {addEventType && (
                <Grid item xs={12} md={6}>
                  <FormControl fullWidth>
                    <InputLabel>Event Type</InputLabel>
                    <Select
                      value={formData.eventTypeId || ''}
                      onChange={(e) => onChange('eventTypeId', e.target.value || undefined)}
                      label="Event Type"
                    >
                      <MenuItem value="">
                        <em>None</em>
                      </MenuItem>
                      {eventTypes.map((type) => (
                        <MenuItem key={type.id} value={type.id}>
                          {type.name}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
              )}
            </>
          )}

          {/* Venue Selection */}
          {venues.length > 0 && (
            <>
              <Grid item xs={12}>
                <Tooltip title="Specify the location where your event will take place" arrow placement="right">
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={addVenue}
                        onChange={(e) => {
                          setAddVenue(e.target.checked);
                          if (!e.target.checked) {
                            onChange('venueId', undefined);
                          }
                        }}
                      />
                    }
                    label="Add Venue"
                  />
                </Tooltip>
              </Grid>

              {addVenue && (
                <Grid item xs={12} md={6}>
                  <FormControl fullWidth>
                    <InputLabel>Venue</InputLabel>
                    <Select
                      value={formData.venueId || ''}
                      onChange={(e) => onChange('venueId', e.target.value || undefined)}
                      label="Venue"
                    >
                      <MenuItem value="">
                        <em>None</em>
                      </MenuItem>
                      {venues.map((venue) => (
                        <MenuItem key={venue.id} value={venue.id}>
                          {venue.name}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
              )}
            </>
          )}

          {/* Discount Selection */}
          {hasCapability('entry-discounts') && (
            <Grid item xs={12}>
              <DiscountSelector
                selectedDiscountIds={formData.discountIds || []}
                onChange={(discountIds) => onChange('discountIds', discountIds)}
                organisationId={organisation?.id || ''}
                moduleType="events"
                fetchDiscounts={fetchDiscounts}
                label="Apply Discounts to Event"
                helperText="Choose which discounts can be applied to this event"
                currencyCode={organisation?.currency || 'EUR'}
              />
            </Grid>
          )}
        </Grid>
      </CardContent>
    </Card>
  );
};

export default EventBasicInfoSection;
