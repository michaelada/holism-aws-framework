/**
 * Calendar Form Component
 * 
 * Reusable form component for creating/editing calendars with all configuration sections.
 */

import React from 'react';
import {
  Box,
  Card,
  CardContent,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Switch,
  Typography,
  Divider,
} from '@mui/material';
import type { CalendarFormData } from '../types/calendar.types';
import ScheduleRulesSection from './ScheduleRulesSection';

interface CalendarFormProps {
  formData: CalendarFormData;
  onChange: (data: CalendarFormData) => void;
}

const CalendarForm: React.FC<CalendarFormProps> = ({ formData, onChange }) => {
  const handleChange = (field: keyof CalendarFormData, value: any) => {
    onChange({ ...formData, [field]: value });
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* Basic Information */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>Basic Information</Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              label="Calendar Name"
              value={formData.name}
              onChange={(e) => handleChange('name', e.target.value)}
              required
              fullWidth
            />
            <TextField
              label="Description"
              value={formData.description}
              onChange={(e) => handleChange('description', e.target.value)}
              required
              multiline
              rows={3}
              fullWidth
            />
            <TextField
              label="Display Colour"
              type="color"
              value={formData.displayColour}
              onChange={(e) => handleChange('displayColour', e.target.value)}
              fullWidth
            />
            <FormControl fullWidth>
              <InputLabel>Status</InputLabel>
              <Select
                value={formData.status}
                label="Status"
                onChange={(e) => handleChange('status', e.target.value)}
              >
                <MenuItem value="open">Open</MenuItem>
                <MenuItem value="closed">Closed</MenuItem>
              </Select>
            </FormControl>
          </Box>
        </CardContent>
      </Card>

      {/* Automated Opening/Closing */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>Automated Opening/Closing</Typography>
          <FormControlLabel
            control={
              <Switch
                checked={formData.enableAutomatedSchedule}
                onChange={(e) => handleChange('enableAutomatedSchedule', e.target.checked)}
              />
            }
            label="Enable Automated Schedule"
          />
          {formData.enableAutomatedSchedule && (
            <Box sx={{ mt: 2 }}>
              <ScheduleRulesSection
                rules={formData.scheduleRules}
                onChange={(rules) => handleChange('scheduleRules', rules)}
              />
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Booking Window Configuration */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>Booking Window Configuration</Typography>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField
              label="Minimum Days In Advance"
              type="number"
              value={formData.minDaysInAdvance}
              onChange={(e) => handleChange('minDaysInAdvance', parseInt(e.target.value))}
              fullWidth
            />
            <TextField
              label="Maximum Days In Advance"
              type="number"
              value={formData.maxDaysInAdvance}
              onChange={(e) => handleChange('maxDaysInAdvance', parseInt(e.target.value))}
              fullWidth
            />
          </Box>
        </CardContent>
      </Card>

      {/* Terms and Conditions */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>Terms and Conditions</Typography>
          <FormControlLabel
            control={
              <Switch
                checked={formData.useTermsAndConditions}
                onChange={(e) => handleChange('useTermsAndConditions', e.target.checked)}
              />
            }
            label="Use Terms and Conditions"
          />
          {formData.useTermsAndConditions && (
            <TextField
              label="Terms and Conditions"
              value={formData.termsAndConditions}
              onChange={(e) => handleChange('termsAndConditions', e.target.value)}
              multiline
              rows={6}
              fullWidth
              sx={{ mt: 2 }}
            />
          )}
        </CardContent>
      </Card>

      {/* Cancellation Policy */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>Cancellation Policy</Typography>
          <FormControlLabel
            control={
              <Switch
                checked={formData.allowCancellations}
                onChange={(e) => handleChange('allowCancellations', e.target.checked)}
              />
            }
            label="Allow Cancellations"
          />
          {formData.allowCancellations && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
              <TextField
                label="Cancel Days In Advance"
                type="number"
                value={formData.cancelDaysInAdvance}
                onChange={(e) => handleChange('cancelDaysInAdvance', parseInt(e.target.value))}
                fullWidth
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={formData.refundPaymentAutomatically}
                    onChange={(e) => handleChange('refundPaymentAutomatically', e.target.checked)}
                  />
                }
                label="Refund Payment Automatically"
              />
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Email Notifications */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>Email Notifications</Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              label="Admin Notification Emails"
              value={formData.adminNotificationEmails}
              onChange={(e) => handleChange('adminNotificationEmails', e.target.value)}
              placeholder="email1@example.com, email2@example.com"
              fullWidth
            />
            <FormControlLabel
              control={
                <Switch
                  checked={formData.sendReminderEmails}
                  onChange={(e) => handleChange('sendReminderEmails', e.target.checked)}
                />
              }
              label="Send Reminder Emails"
            />
            {formData.sendReminderEmails && (
              <TextField
                label="Reminder Hours Before"
                type="number"
                value={formData.reminderHoursBefore}
                onChange={(e) => handleChange('reminderHoursBefore', parseInt(e.target.value))}
                fullWidth
              />
            )}
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
};

export default CalendarForm;
