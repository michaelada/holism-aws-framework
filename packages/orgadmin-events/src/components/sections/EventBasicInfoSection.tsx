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
  Alert,
  Box,
  Checkbox,
  FormControlLabel,
  FormHelperText,
  FormLabel,
  Grid,
  Radio,
  RadioGroup,
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

  /**
   * The Yes/No toggle is derived, never stored.
   *
   * "Public" means at least one destination is chosen, so unticking both turns
   * the toggle off by itself. There is no state where it says Yes and nothing
   * is selected, and therefore no validation message to write, translate and
   * explain. See docs/PUBLIC_EVENTS.md §2.
   */
  const isPublic = Boolean(formData.showOnOrganisationPage || formData.showOnPlatformPage);

  const publicPageUrl = `${window.location.origin}/account/${organisation?.urlCode ?? ''}/whats-on`;

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
    <>
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


          {/*
            Who can see this event at all.
            
            Placed with the discount selector at the foot of Basic Information
            rather than beside a date, because it is the same kind of question
            as the event's status: not *when* it happens but *who it is for*.
          */}
          <Grid item xs={12}>
            <FormControl component="fieldset" sx={{ width: '100%' }}>
              <FormLabel component="legend">
                {t('events.public.legend')}
              </FormLabel>
              <RadioGroup
                row
                value={isPublic ? 'yes' : 'no'}
                onChange={(e) => {
                  /*
                   * Turning it on selects the club's own page, which is the
                   * safer of the two — it publishes to the club's own visitors
                   * rather than to the whole platform. Turning it off clears
                   * both, so the stored state always matches what is shown.
                   */
                  const on = e.target.value === 'yes';
                  onChange('showOnOrganisationPage', on);
                  if (!on) onChange('showOnPlatformPage', false);
                }}
              >
                <FormControlLabel value="no" control={<Radio />} label={t('events.public.no')} />
                <FormControlLabel value="yes" control={<Radio />} label={t('events.public.yes')} />
              </RadioGroup>
              <FormHelperText sx={{ ml: 0 }}>
                {t('events.public.helper')}
              </FormHelperText>

              {isPublic && (
                <Box sx={{ mt: 1.5, pl: { xs: 0, sm: 2 } }}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={formData.showOnOrganisationPage ?? false}
                        onChange={(e) => onChange('showOnOrganisationPage', e.target.checked)}
                      />
                    }
                    label={
                      <Box>
                        <Typography variant="body2">
                          {t('events.public.onOurPage')}
                        </Typography>
                        {/*
                          The address, because the first thing a club does after
                          switching this on is paste the link somewhere. Making
                          them hunt for it is the difference between a feature
                          used and a feature asked about.
                        */}
                        <Typography variant="caption" color="text.secondary">
                          {publicPageUrl}
                        </Typography>
                      </Box>
                    }
                  />

                  {hasCapability('public-search') && (
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={formData.showOnPlatformPage ?? false}
                          onChange={(e) => onChange('showOnPlatformPage', e.target.checked)}
                        />
                      }
                      label={
                        <Box>
                          <Typography variant="body2">
                            {t('events.public.onPlatformPage')}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {t('events.public.onPlatformPageHint')}
                          </Typography>
                        </Box>
                      }
                    />
                  )}

                  {/*
                    Factual, not cautionary. It names what becomes visible —
                    including prices, which an administrator will not have
                    thought about — without discouraging the choice.
                  */}
                  <Alert severity="info" sx={{ mt: 1 }}>
                    {t('events.public.note')}
                  </Alert>
                </Box>
              )}
            </FormControl>
          </Grid>

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
    </>
  );
};

export default EventBasicInfoSection;
