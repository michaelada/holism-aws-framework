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
  Card,
  CardContent,
  Typography,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Switch,
  Divider,
} from '@mui/material';
import { Save as SaveIcon, Cancel as CancelIcon } from '@mui/icons-material';
import type { CalendarFormData, CalendarStatus } from '../types/calendar.types';
import CalendarForm from '../components/CalendarForm';

const CreateCalendarPage: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEditMode = Boolean(id);

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
    allowCancellations: false,
    cancelDaysInAdvance: 2,
    refundPaymentAutomatically: false,
    adminNotificationEmails: '',
    sendReminderEmails: false,
    reminderHoursBefore: 24,
  });

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isEditMode && id) {
      loadCalendar(id);
    }
  }, [id, isEditMode]);

  const loadCalendar = async (calendarId: string) => {
    try {
      setLoading(true);
      // API call to load calendar
      // const calendar = await api.get(`/api/orgadmin/calendars/${calendarId}`);
      // setFormData(calendar);
    } catch (error) {
      console.error('Failed to load calendar:', error);
    } finally {
      setLoading(false);
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
        // await api.put(`/api/orgadmin/calendars/${id}`, formData);
      } else {
        // await api.post('/api/orgadmin/calendars', formData);
      }

      navigate('/orgadmin/calendar');
    } catch (error) {
      console.error('Failed to save calendar:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    navigate('/orgadmin/calendar');
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
      />
    </Box>
  );
};

export default CreateCalendarPage;
