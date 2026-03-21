/**
 * Create/Edit Calendar Page
 * 
 * Comprehensive form for creating or editing calendars with all configuration sections.
 */

import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Box,
  Button,
  Typography
  // Card,
  // CardContent,
  // Typography,
  // TextField,
  // FormControl,
  // InputLabel,
  // Select,
  // MenuItem,
  // FormControlLabel,
  // Switch,
  // Divider,
} from '@mui/material';
import { Save as SaveIcon, Cancel as CancelIcon } from '@mui/icons-material';
import type { CalendarFormData } from '../types/calendar.types';
import CalendarForm from '../components/CalendarForm';
import { usePageHelp } from '@aws-web-framework/orgadmin-shell';
import { useOrganisation, useApi } from '@aws-web-framework/orgadmin-core';

interface PaymentMethod {
  id: string;
  name: string;
}

const CreateCalendarPage: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEditMode = Boolean(id);
  const { organisation } = useOrganisation();
  const { execute } = useApi();

  const [formData, setFormData] = useState<CalendarFormData>({
    name: '',
    description: '',
    displayColour: '#1976d2',
    status: 'open',
    enableAutomatedSchedule: false,
    scheduleRules: [],
    minDaysInAdvance: 0,
    maxDaysInAdvance: 90,
    useTermsAndConditions: false,
    termsAndConditions: '',
    supportedPaymentMethods: [],
    handlingFeeIncluded: false,
    discountIds: [],
    allowCancellations: false,
    cancelDaysInAdvance: 2,
    refundPaymentAutomatically: false,
    adminNotificationEmails: '',
    sendReminderEmails: false,
    reminderHoursBefore: 24,
    applicationFormId: undefined,
    timeSlotConfigurations: [],
    blockedPeriods: [],
  });

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [applicationForms, setApplicationForms] = useState<Array<{ id: string; name: string }>>([]);

  // Register page for contextual help
  usePageHelp(isEditMode ? 'edit' : 'create');

  useEffect(() => {
    loadPaymentMethods();
    loadApplicationForms();
  }, []);

  useEffect(() => {
    if (isEditMode && id) {
      loadCalendar(id);
    }
  }, [id, isEditMode]);

  const loadCalendar = async (calendarId: string) => {
    try {
      setLoading(true);
      const calendar = await execute({
        method: 'GET',
        url: `/api/orgadmin/calendars/${calendarId}`,
      });
      if (calendar) {
        setFormData(prev => ({
          ...prev,
          ...calendar,
          scheduleRules: calendar.scheduleRules || [],
          timeSlotConfigurations: calendar.timeSlotConfigurations || [],
          blockedPeriods: calendar.blockedPeriods || [],
        }));
      }
    } catch (error) {
      console.error('Failed to load calendar:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadPaymentMethods = async () => {
    try {
      const response = await execute({
        method: 'GET',
        url: '/api/orgadmin/payment-methods',
      });
      const methods: PaymentMethod[] = response || [
        { id: 'pay-offline', name: 'Pay Offline' },
        { id: 'stripe', name: 'Card Payment (Stripe)' },
      ];
      setPaymentMethods(methods);
    } catch (err) {
      console.error('Failed to load payment methods:', err);
      setPaymentMethods([
        { id: 'pay-offline', name: 'Pay Offline' },
        { id: 'stripe', name: 'Card Payment (Stripe)' },
      ]);
    }
  };

  const loadApplicationForms = async () => {
    try {
      const response = await execute({
        method: 'GET',
        url: `/api/orgadmin/organisations/${organisation?.id}/application-forms`,
      });
      setApplicationForms(response || []);
    } catch (err) {
      console.error('Failed to load application forms:', err);
      setApplicationForms([]);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      
      // Validate form
      if (!formData.name || !formData.description) {
        alert('Please fill in all required fields');
        return;
      }

      // API call to save calendar
      if (isEditMode) {
        await execute({
          method: 'PUT',
          url: `/api/orgadmin/calendars/${id}`,
          data: { ...formData, organisationId: organisation?.id },
        });
      } else {
        await execute({
          method: 'POST',
          url: '/api/orgadmin/calendars',
          data: { ...formData, organisationId: organisation?.id },
        });
      }

      navigate('/calendar');
    } catch (error) {
      console.error('Failed to save calendar:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    navigate('/calendar');
  };

  if (loading) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography>Loading calendar...</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">
          {isEditMode ? 'Edit Calendar' : 'Create Calendar'}
        </Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            variant="outlined"
            startIcon={<CancelIcon />}
            onClick={handleCancel}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            color="primary"
            startIcon={<SaveIcon />}
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? 'Saving...' : 'Save Calendar'}
          </Button>
        </Box>
      </Box>

      <CalendarForm
        formData={formData}
        onChange={setFormData}
        paymentMethods={paymentMethods}
        applicationForms={applicationForms}
        organisation={organisation}
      />
    </Box>
  );
};

export default CreateCalendarPage;
