/**
 * Create/Edit Event Page
 * 
 * Multi-step wizard for creating or editing events
 * Steps: Basic Info -> Dates -> Ticketing -> Activities -> Confirm
 */

import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  FormControlLabel,
  Grid,
  TextField,
  Typography,
  Divider,
  Alert,
  Stepper,
  Step,
  StepLabel,
  Tooltip,
  IconButton,
  InputAdornment,
} from '@mui/material';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { enGB } from 'date-fns/locale';
import { 
  Save as SaveIcon, 
  Cancel as CancelIcon,
  NavigateNext as NextIcon,
  NavigateBefore as BackIcon,
  HelpOutline as HelpIcon,
} from '@mui/icons-material';
import { useApi } from '@aws-web-framework/orgadmin-core';
import { useTranslation } from '@aws-web-framework/orgadmin-shell';
import type { EventFormData, EventActivityFormData } from '../types/event.types';
import EventActivityForm from '../components/EventActivityForm';

const CreateEventPage: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { execute } = useApi();
  const { t } = useTranslation();
  const isEditMode = Boolean(id);

  const steps = [
    t('events.wizard.steps.basicInfo'),
    t('events.wizard.steps.eventDates'),
    t('events.wizard.steps.ticketingSettings'),
    t('events.wizard.steps.activities'),
    t('events.wizard.steps.reviewConfirm')
  ];

  const [activeStep, setActiveStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formData, setFormData] = useState<EventFormData>({
    name: '',
    description: '',
    eventOwner: '', // Will be set to current user
    emailNotifications: '',
    startDate: new Date(),
    endDate: new Date(),
    openDateEntries: new Date(),
    entriesClosingDate: new Date(),
    limitEntries: false,
    entriesLimit: undefined,
    addConfirmationMessage: false,
    confirmationMessage: undefined,
    status: 'draft',
    activities: [],
    // Ticketing configuration
    generateElectronicTickets: false,
    ticketHeaderText: undefined,
    ticketInstructions: undefined,
    ticketFooterText: undefined,
    ticketValidityPeriod: undefined,
    includeEventLogo: false,
    ticketBackgroundColor: '#ffffff',
  });

  useEffect(() => {
    if (isEditMode && id) {
      loadEvent(id);
    }
  }, [id, isEditMode]);

  const loadEvent = async (eventId: string) => {
    try {
      setLoading(true);
      const response = await execute({
        method: 'GET',
        url: `/api/orgadmin/events/${eventId}`,
      });
      setFormData(response);
    } catch (error) {
      console.error(t('events.failedToLoad'), error);
      setError(t('events.failedToLoad'));
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field: keyof EventFormData, value: any) => {
    setFormData(prev => {
      const updated = { ...prev, [field]: value };
      
      // When start date changes, update end date to match if end date is before start date
      if (field === 'startDate' && value) {
        if (!updated.endDate || updated.endDate < value) {
          updated.endDate = value;
        }
      }
      
      // Prevent end date from being before start date
      if (field === 'endDate' && value && updated.startDate) {
        if (value < updated.startDate) {
          updated.endDate = updated.startDate;
          return updated;
        }
      }
      
      // When entries opening date changes, update closing date to match if closing date is before opening date
      if (field === 'openDateEntries' && value) {
        if (!updated.entriesClosingDate || updated.entriesClosingDate <= value) {
          // Set closing date to 1 hour after opening date
          const newClosingDate = new Date(value);
          newClosingDate.setHours(newClosingDate.getHours() + 1);
          updated.entriesClosingDate = newClosingDate;
        }
      }
      
      // Prevent entries closing date from being before or equal to opening date
      if (field === 'entriesClosingDate' && value && updated.openDateEntries) {
        if (value <= updated.openDateEntries) {
          // Set to 1 hour after opening date
          const newClosingDate = new Date(updated.openDateEntries);
          newClosingDate.setHours(newClosingDate.getHours() + 1);
          updated.entriesClosingDate = newClosingDate;
          return updated;
        }
      }
      
      return updated;
    });
  };

  const handleAddActivity = () => {
    const newActivity: EventActivityFormData = {
      name: '',
      description: '',
      showPublicly: true,
      applicationFormId: undefined,
      limitApplicants: false,
      applicantsLimit: undefined,
      allowSpecifyQuantity: false,
      useTermsAndConditions: false,
      termsAndConditions: undefined,
      fee: 0,
      allowedPaymentMethod: 'both',
      handlingFeeIncluded: false,
      chequePaymentInstructions: undefined,
    };
    setFormData(prev => ({
      ...prev,
      activities: [...prev.activities, newActivity],
    }));
    // Clear activities error when adding an activity
    if (fieldErrors.activities) {
      setFieldErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors.activities;
        return newErrors;
      });
    }
  };

  const handleUpdateActivity = (index: number, activity: EventActivityFormData) => {
    setFormData(prev => ({
      ...prev,
      activities: prev.activities.map((a, i) => i === index ? activity : a),
    }));
  };

  const handleRemoveActivity = (index: number) => {
    setFormData(prev => ({
      ...prev,
      activities: prev.activities.filter((_, i) => i !== index),
    }));
  };

  const handleSave = async (status: 'draft' | 'published') => {
    try {
      setLoading(true);
      setError(null);
      setFieldErrors({});

      // Final validation
      const errors: Record<string, string> = {};
      
      if (!formData.name.trim()) {
        errors.name = t('events.basicInfo.validation.nameRequired');
      }
      if (!formData.description.trim()) {
        errors.description = t('events.basicInfo.validation.descriptionRequired');
      }
      if (formData.activities.length === 0) {
        errors.activities = t('events.activities.validation.atLeastOne');
      }

      if (Object.keys(errors).length > 0) {
        setFieldErrors(errors);
        setError(t('events.fixValidationErrors'));
        // Navigate to the first step with errors
        if (errors.name || errors.description) {
          setActiveStep(0);
        } else if (errors.activities) {
          setActiveStep(3);
        }
        return;
      }

      const dataToSave = { ...formData, status };

      if (isEditMode && id) {
        await execute({
          method: 'PUT',
          url: `/api/orgadmin/events/${id}`,
          data: dataToSave,
        });
      } else {
        await execute({
          method: 'POST',
          url: '/api/orgadmin/events',
          data: dataToSave,
        });
      }

      navigate('/events');
    } catch (error) {
      console.error(t('events.failedToSave'), error);
      setError(t('events.failedToSave'));
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    navigate('/events');
  };

  const handleNext = () => {
    // Validate current step before proceeding
    const errors: Record<string, string> = {};
    
    if (activeStep === 0) {
      if (!formData.name.trim()) {
        errors.name = t('events.basicInfo.validation.nameRequired');
      }
      if (!formData.description.trim()) {
        errors.description = t('events.basicInfo.validation.descriptionRequired');
      }
    }
    
    if (activeStep === 3) {
      if (formData.activities.length === 0) {
        errors.activities = t('events.activities.validation.atLeastOne');
      }
    }
    
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }
    
    setFieldErrors({});
    setError(null);
    setActiveStep((prev) => prev + 1);
  };

  const handleBack = () => {
    setFieldErrors({});
    setError(null);
    setActiveStep((prev) => prev - 1);
  };

  const renderStepContent = (step: number) => {
    switch (step) {
      case 0:
        return renderBasicInformation();
      case 1:
        return renderEventDates();
      case 2:
        return renderTicketingSettings();
      case 3:
        return renderActivities();
      case 4:
        return renderConfirmation();
      default:
        return null;
    }
  };

  const renderBasicInformation = () => (
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
                handleChange('name', e.target.value);
                if (fieldErrors.name) {
                  setFieldErrors(prev => {
                    const newErrors = { ...prev };
                    delete newErrors.name;
                    return newErrors;
                  });
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
                handleChange('description', e.target.value);
                if (fieldErrors.description) {
                  setFieldErrors(prev => {
                    const newErrors = { ...prev };
                    delete newErrors.description;
                    return newErrors;
                  });
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
              onChange={(e) => handleChange('emailNotifications', e.target.value)}
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
                    onChange={(e) => handleChange('limitEntries', e.target.checked)}
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
                onChange={(e) => handleChange('entriesLimit', parseInt(e.target.value) || undefined)}
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
                    onChange={(e) => handleChange('addConfirmationMessage', e.target.checked)}
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
                onChange={(e) => handleChange('confirmationMessage', e.target.value)}
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
        </Grid>
      </CardContent>
    </Card>
  );

  const renderEventDates = () => (
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
              onChange={(date) => handleChange('startDate', date)}
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
              onChange={(date) => handleChange('endDate', date)}
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
              onChange={(date) => handleChange('openDateEntries', date)}
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
              onChange={(date) => handleChange('entriesClosingDate', date)}
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

  const renderTicketingSettings = () => (
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
                    onChange={(e) => handleChange('generateElectronicTickets', e.target.checked)}
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
                  onChange={(e) => handleChange('ticketHeaderText', e.target.value)}
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
                  onChange={(e) => handleChange('ticketInstructions', e.target.value)}
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
                  onChange={(e) => handleChange('ticketFooterText', e.target.value)}
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
                  onChange={(e) => handleChange('ticketValidityPeriod', parseInt(e.target.value) || undefined)}
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
                  onChange={(e) => handleChange('ticketBackgroundColor', e.target.value)}
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
                        onChange={(e) => handleChange('includeEventLogo', e.target.checked)}
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

  const renderActivities = () => (
    <Card>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Box>
            <Typography variant="h6">
              Event Activities
            </Typography>
            <Typography variant="body2" color="textSecondary">
              Add activities that people can register for
            </Typography>
          </Box>
          <Button
            variant="outlined"
            onClick={handleAddActivity}
          >
            Add Activity
          </Button>
        </Box>

        {fieldErrors.activities && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {fieldErrors.activities}
          </Alert>
        )}

        {formData.activities.length === 0 ? (
          <Alert severity="info">
            Add at least one activity to complete your event setup
          </Alert>
        ) : (
          formData.activities.map((activity, index) => (
            <Box key={index} sx={{ mb: 2 }}>
              {index > 0 && <Divider sx={{ my: 3 }} />}
              <EventActivityForm
                activity={activity}
                index={index}
                onChange={(updatedActivity) => {
                  handleUpdateActivity(index, updatedActivity);
                  if (fieldErrors.activities) {
                    setFieldErrors(prev => {
                      const newErrors = { ...prev };
                      delete newErrors.activities;
                      return newErrors;
                    });
                  }
                }}
                onRemove={() => handleRemoveActivity(index)}
              />
            </Box>
          ))
        )}
      </CardContent>
    </Card>
  );

  const renderConfirmation = () => (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Review & Confirm
        </Typography>
        <Typography variant="body2" color="textSecondary" paragraph>
          Please review your event details before publishing
        </Typography>

        <Box sx={{ mt: 3 }}>
          <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 'bold' }}>
            Basic Information
          </Typography>
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={12} sm={4}>
              <Typography variant="body2" color="textSecondary">Event Name:</Typography>
            </Grid>
            <Grid item xs={12} sm={8}>
              <Typography variant="body2">{formData.name}</Typography>
            </Grid>
            <Grid item xs={12} sm={4}>
              <Typography variant="body2" color="textSecondary">Description:</Typography>
            </Grid>
            <Grid item xs={12} sm={8}>
              <Typography variant="body2">{formData.description}</Typography>
            </Grid>
            {formData.emailNotifications && (
              <>
                <Grid item xs={12} sm={4}>
                  <Typography variant="body2" color="textSecondary">Email Notifications:</Typography>
                </Grid>
                <Grid item xs={12} sm={8}>
                  <Typography variant="body2">{formData.emailNotifications}</Typography>
                </Grid>
              </>
            )}
            {formData.limitEntries && (
              <>
                <Grid item xs={12} sm={4}>
                  <Typography variant="body2" color="textSecondary">Entry Limit:</Typography>
                </Grid>
                <Grid item xs={12} sm={8}>
                  <Typography variant="body2">{formData.entriesLimit} entries</Typography>
                </Grid>
              </>
            )}
          </Grid>

          <Divider sx={{ my: 2 }} />

          <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 'bold' }}>
            Event Dates
          </Typography>
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={12} sm={4}>
              <Typography variant="body2" color="textSecondary">Event Period:</Typography>
            </Grid>
            <Grid item xs={12} sm={8}>
              <Typography variant="body2">
                {formData.startDate?.toLocaleDateString('en-GB')} - {formData.endDate?.toLocaleDateString('en-GB')}
              </Typography>
            </Grid>
            <Grid item xs={12} sm={4}>
              <Typography variant="body2" color="textSecondary">Entries Open:</Typography>
            </Grid>
            <Grid item xs={12} sm={8}>
              <Typography variant="body2">
                {formData.openDateEntries?.toLocaleString('en-GB')}
              </Typography>
            </Grid>
            <Grid item xs={12} sm={4}>
              <Typography variant="body2" color="textSecondary">Entries Close:</Typography>
            </Grid>
            <Grid item xs={12} sm={8}>
              <Typography variant="body2">
                {formData.entriesClosingDate?.toLocaleString('en-GB')}
              </Typography>
            </Grid>
          </Grid>

          <Divider sx={{ my: 2 }} />

          <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 'bold' }}>
            Ticketing
          </Typography>
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={12} sm={4}>
              <Typography variant="body2" color="textSecondary">Electronic Tickets:</Typography>
            </Grid>
            <Grid item xs={12} sm={8}>
              <Typography variant="body2">
                {formData.generateElectronicTickets ? 'Enabled' : 'Disabled'}
              </Typography>
            </Grid>
          </Grid>

          <Divider sx={{ my: 2 }} />

          <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 'bold' }}>
            Activities
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <Typography variant="body2">
                {formData.activities.length} {formData.activities.length === 1 ? 'activity' : 'activities'} configured
              </Typography>
              {formData.activities.map((activity, index) => (
                <Box key={index} sx={{ ml: 2, mt: 1 }}>
                  <Typography variant="body2">
                    • {activity.name} {activity.fee > 0 ? `(£${activity.fee.toFixed(2)})` : '(Free)'}
                  </Typography>
                </Box>
              ))}
            </Grid>
          </Grid>
        </Box>
      </CardContent>
    </Card>
  );

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={enGB}>
      <Box sx={{ p: 3 }}>
        <Typography variant="h4" gutterBottom>
          {isEditMode ? t('events.editEvent') : t('events.createEvent')}
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* Stepper */}
        <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
          {steps.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>

        {/* Step Content */}
        <Box sx={{ mb: 3 }}>
          {renderStepContent(activeStep)}
        </Box>

        {/* Navigation Buttons */}
        <Box sx={{ display: 'flex', gap: 2, justifyContent: 'space-between' }}>
          <Button
            variant="outlined"
            startIcon={<CancelIcon />}
            onClick={handleCancel}
            disabled={loading}
          >
            {t('common.actions.cancel')}
          </Button>

          <Box sx={{ display: 'flex', gap: 2 }}>
            {activeStep > 0 && (
              <Button
                variant="outlined"
                startIcon={<BackIcon />}
                onClick={handleBack}
                disabled={loading}
              >
                {t('common.actions.back')}
              </Button>
            )}

            {activeStep < steps.length - 1 ? (
              <Button
                variant="contained"
                endIcon={<NextIcon />}
                onClick={handleNext}
                disabled={loading}
              >
                {t('common.actions.next')}
              </Button>
            ) : (
              <>
                <Button
                  variant="outlined"
                  onClick={() => handleSave('draft')}
                  disabled={loading}
                >
                  {t('events.actions.saveAsDraft')}
                </Button>
                <Button
                  variant="contained"
                  color="primary"
                  startIcon={<SaveIcon />}
                  onClick={() => handleSave('published')}
                  disabled={loading}
                >
                  {t('events.actions.publishEvent')}
                </Button>
              </>
            )}
          </Box>
        </Box>
      </Box>
    </LocalizationProvider>
  );
};

export default CreateEventPage;
