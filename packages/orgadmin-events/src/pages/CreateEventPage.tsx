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
  Grid,
  Typography,
  Divider,
  Alert,
  Stepper,
  Step,
  StepLabel,
} from '@mui/material';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { enGB } from 'date-fns/locale';
import { 
  Save as SaveIcon, 
  Cancel as CancelIcon,
  NavigateNext as NextIcon,
  NavigateBefore as BackIcon,
} from '@mui/icons-material';
import { useApi } from '@aws-web-framework/orgadmin-core';
import { useTranslation } from '@aws-web-framework/orgadmin-shell';
import EventBasicInfoSection from '../components/sections/EventBasicInfoSection';
import EventDatesSection from '../components/sections/EventDatesSection';
import EventTicketingSection from '../components/sections/EventTicketingSection';
import EventActivitiesSection from '../components/sections/EventActivitiesSection';
import { useEventForm } from '../hooks/useEventForm';
import { useEventValidation } from '../hooks/useEventValidation';

const CreateEventPage: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { execute } = useApi();
  const { t } = useTranslation();
  const isEditMode = Boolean(id);

  // Use extracted hooks for form state and validation
  const {
    formData,
    fieldErrors,
    setFieldErrors,
    loading,
    error,
    eventTypes,
    venues,
    paymentMethods,
    discounts,
    handleChange,
    handleAddActivity,
    handleUpdateActivity,
    handleRemoveActivity,
    handleClearFieldError,
    fetchDiscounts,
    loadEvent,
  } = useEventForm();

  const { validateAll, validateStep } = useEventValidation();

  const steps = [
    t('events.wizard.steps.basicInfo'),
    t('events.wizard.steps.eventDates'),
    t('events.wizard.steps.ticketingSettings'),
    t('events.wizard.steps.activities'),
    t('events.wizard.steps.reviewConfirm')
  ];

  const [activeStep, setActiveStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Combined loading/error state (hook loading + local saving)
  const isLoading = loading || saving;
  const displayError = saveError || error;

  useEffect(() => {
    if (isEditMode && id) {
      loadEvent(id).then(() => {
        // Set checkboxes based on loaded data after event loads
        // This is handled via the formData state update from loadEvent
      });
    }
  }, [id, isEditMode, loadEvent]);

  const handleSave = async (status: 'draft' | 'published') => {
    try {
      setSaving(true);
      setSaveError(null);
      setFieldErrors({});

      // Final validation using extracted hook
      const errors = validateAll(formData);

      if (Object.keys(errors).length > 0) {
        setFieldErrors(errors);
        setSaveError(t('events.fixValidationErrors'));
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
    } catch (err) {
      console.error(t('events.failedToSave'), err);
      setSaveError(t('events.failedToSave'));
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    navigate('/events');
  };

  const handleNext = () => {
    // Validate current step using extracted hook
    const errors = validateStep(activeStep, formData);
    
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }
    
    setFieldErrors({});
    setSaveError(null);
    setActiveStep((prev) => prev + 1);
  };

  const handleBack = () => {
    setFieldErrors({});
    setSaveError(null);
    setActiveStep((prev) => prev - 1);
  };

  const renderStepContent = (step: number) => {
    switch (step) {
      case 0:
        return (
          <EventBasicInfoSection
            formData={formData}
            fieldErrors={fieldErrors}
            onChange={handleChange}
            onClearFieldError={handleClearFieldError}
            eventTypes={eventTypes}
            venues={venues}
            discounts={discounts}
            fetchDiscounts={fetchDiscounts}
          />
        );
      case 1:
        return (
          <EventDatesSection
            formData={formData}
            onChange={handleChange}
          />
        );
      case 2:
        return (
          <EventTicketingSection
            formData={formData}
            onChange={handleChange}
          />
        );
      case 3:
        return (
          <EventActivitiesSection
            formData={formData}
            fieldErrors={fieldErrors}
            onAddActivity={handleAddActivity}
            onUpdateActivity={handleUpdateActivity}
            onRemoveActivity={handleRemoveActivity}
            onClearFieldError={handleClearFieldError}
            paymentMethods={paymentMethods}
          />
        );
      case 4:
        return renderConfirmation();
      default:
        return null;
    }
  };

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
                {formData.startDate instanceof Date ? formData.startDate.toLocaleDateString('en-GB') : formData.startDate} - {formData.endDate instanceof Date ? formData.endDate.toLocaleDateString('en-GB') : formData.endDate}
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

        {displayError && (
          <Alert severity="error" sx={{ mb: 3 }} onClose={() => setSaveError(null)}>
            {displayError}
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
            disabled={isLoading}
          >
            {t('common.actions.cancel')}
          </Button>

          <Box sx={{ display: 'flex', gap: 2 }}>
            {activeStep > 0 && (
              <Button
                variant="outlined"
                startIcon={<BackIcon />}
                onClick={handleBack}
                disabled={isLoading}
              >
                {t('common.actions.back')}
              </Button>
            )}

            {/* Show Save button on all steps when editing */}
            {isEditMode && activeStep < steps.length - 1 && (
              <Button
                variant="outlined"
                startIcon={<SaveIcon />}
                onClick={() => handleSave(formData.status || 'draft')}
                disabled={isLoading}
              >
                {t('common.actions.save')}
              </Button>
            )}

            {activeStep < steps.length - 1 ? (
              <Button
                variant="contained"
                endIcon={<NextIcon />}
                onClick={handleNext}
                disabled={isLoading}
              >
                {t('common.actions.next')}
              </Button>
            ) : (
              <>
                <Button
                  variant="outlined"
                  onClick={() => handleSave('draft')}
                  disabled={isLoading}
                >
                  {t('events.actions.saveAsDraft')}
                </Button>
                <Button
                  variant="contained"
                  color="primary"
                  startIcon={<SaveIcon />}
                  onClick={() => handleSave('published')}
                  disabled={isLoading}
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
