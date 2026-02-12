/**
 * Create/Edit Event Page
 * 
 * Form for creating or editing events with comprehensive attributes
 * Includes activities section for adding event activities
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
} from '@mui/material';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { Save as SaveIcon, Cancel as CancelIcon } from '@mui/icons-material';
import type { EventFormData, EventActivityFormData } from '../types/event.types';
import EventActivityForm from '../components/EventActivityForm';

// Mock API hook - will be replaced with actual implementation
const useApi = () => ({
  execute: async ({ method, url, data }: { method: string; url: string; data?: any }) => {
    console.log('API call:', method, url, data);
    return { id: '1', ...data };
  },
});

const CreateEventPage: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { execute } = useApi();
  const isEditMode = Boolean(id);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<EventFormData>({
    name: '',
    description: '',
    eventOwner: '', // Will be set to current user
    emailNotifications: '',
    startDate: new Date(),
    endDate: new Date(),
    openDateEntries: undefined,
    entriesClosingDate: undefined,
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
      console.error('Failed to load event:', error);
      setError('Failed to load event');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field: keyof EventFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
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

      // Validation
      if (!formData.name.trim()) {
        setError('Event name is required');
        return;
      }
      if (!formData.description.trim()) {
        setError('Event description is required');
        return;
      }
      if (formData.activities.length === 0) {
        setError('At least one activity is required');
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

      navigate('/orgadmin/events');
    } catch (error) {
      console.error('Failed to save event:', error);
      setError('Failed to save event');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    navigate('/orgadmin/events');
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Box sx={{ p: 3 }}>
        <Typography variant="h4" gutterBottom>
          {isEditMode ? 'Edit Event' : 'Create Event'}
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Event Details
            </Typography>

            <Grid container spacing={3}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  required
                  label="Event Name"
                  value={formData.name}
                  onChange={(e) => handleChange('name', e.target.value)}
                  helperText="Name as it appears to members on public website"
                />
              </Grid>

              <Grid item xs={12}>
                <TextField
                  fullWidth
                  required
                  multiline
                  rows={4}
                  label="Description"
                  value={formData.description}
                  onChange={(e) => handleChange('description', e.target.value)}
                  helperText="Detailed event information including start time, location, parking, etc."
                />
              </Grid>

              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Email Notifications"
                  value={formData.emailNotifications}
                  onChange={(e) => handleChange('emailNotifications', e.target.value)}
                  helperText="Comma-separated email addresses that receive notifications when someone enters the event"
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <DateTimePicker
                  label="Event Start Date"
                  value={formData.startDate}
                  onChange={(date) => handleChange('startDate', date)}
                  slotProps={{
                    textField: {
                      fullWidth: true,
                      required: true,
                    },
                  }}
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <DateTimePicker
                  label="Event End Date"
                  value={formData.endDate}
                  onChange={(date) => handleChange('endDate', date)}
                  slotProps={{
                    textField: {
                      fullWidth: true,
                      required: true,
                      helperText: 'Defaults to start date for single-day events',
                    },
                  }}
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <DateTimePicker
                  label="Open Date Entries"
                  value={formData.openDateEntries || null}
                  onChange={(date) => handleChange('openDateEntries', date)}
                  slotProps={{
                    textField: {
                      fullWidth: true,
                      helperText: 'Date and time before which people may not submit entries',
                    },
                  }}
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <DateTimePicker
                  label="Entries Closing Date"
                  value={formData.entriesClosingDate || null}
                  onChange={(date) => handleChange('entriesClosingDate', date)}
                  slotProps={{
                    textField: {
                      fullWidth: true,
                      helperText: 'Date and time when entries automatically close',
                    },
                  }}
                />
              </Grid>

              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={formData.limitEntries}
                      onChange={(e) => handleChange('limitEntries', e.target.checked)}
                    />
                  }
                  label="Limit Number Of Event Entries"
                />
              </Grid>

              {formData.limitEntries && (
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    type="number"
                    label="Event Entries Limit"
                    value={formData.entriesLimit || ''}
                    onChange={(e) => handleChange('entriesLimit', parseInt(e.target.value) || undefined)}
                    helperText="Maximum number of entries allowed across all event activities"
                  />
                </Grid>
              )}

              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={formData.addConfirmationMessage}
                      onChange={(e) => handleChange('addConfirmationMessage', e.target.checked)}
                    />
                  }
                  label="Add Message To Confirmation Email"
                />
              </Grid>

              {formData.addConfirmationMessage && (
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    multiline
                    rows={3}
                    label="Confirmation Email Message"
                    value={formData.confirmationMessage || ''}
                    onChange={(e) => handleChange('confirmationMessage', e.target.value)}
                    helperText="Custom text to include in confirmation emails sent to entrants"
                  />
                </Grid>
              )}
            </Grid>
          </CardContent>
        </Card>

        {/* Ticketing Settings Section (conditional on event-ticketing capability) */}
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Ticketing Settings
            </Typography>
            <Typography variant="body2" color="textSecondary" paragraph>
              Configure electronic tickets with QR codes for this event
            </Typography>

            <Grid container spacing={3}>
              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={formData.generateElectronicTickets || false}
                      onChange={(e) => handleChange('generateElectronicTickets', e.target.checked)}
                    />
                  }
                  label="Generate Electronic Tickets"
                />
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
                    />
                  </Grid>

                  <Grid item xs={12}>
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={formData.includeEventLogo || false}
                          onChange={(e) => handleChange('includeEventLogo', e.target.checked)}
                        />
                      }
                      label="Include Event Logo"
                    />
                    <Typography variant="caption" color="textSecondary" display="block" sx={{ ml: 4 }}>
                      Show organisation logo on ticket
                    </Typography>
                  </Grid>
                </>
              )}
            </Grid>
          </CardContent>
        </Card>

        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6">
                Event Activities
              </Typography>
              <Button
                variant="outlined"
                onClick={handleAddActivity}
              >
                Add Activity
              </Button>
            </Box>

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
                    onChange={(updatedActivity) => handleUpdateActivity(index, updatedActivity)}
                    onRemove={() => handleRemoveActivity(index)}
                  />
                </Box>
              ))
            )}
          </CardContent>
        </Card>

        <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
          <Button
            variant="outlined"
            startIcon={<CancelIcon />}
            onClick={handleCancel}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            variant="outlined"
            onClick={() => handleSave('draft')}
            disabled={loading}
          >
            Save as Draft
          </Button>
          <Button
            variant="contained"
            color="primary"
            startIcon={<SaveIcon />}
            onClick={() => handleSave('published')}
            disabled={loading}
          >
            Publish Event
          </Button>
        </Box>
      </Box>
    </LocalizationProvider>
  );
};

export default CreateEventPage;
