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
  Checkbox,
  Chip,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Switch,
  Typography,
} from '@mui/material';
import { useTranslation } from '@aws-web-framework/orgadmin-shell';
import type { CalendarFormData } from '../types/calendar.types';
import ScheduleRulesSection from './ScheduleRulesSection';

interface Organisation {
  id: string;
  currency?: string;
  [key: string]: any;
}

interface PaymentMethod {
  id: string;
  name: string;
}

interface CalendarFormProps {
  formData: CalendarFormData;
  onChange: (data: CalendarFormData) => void;
  paymentMethods?: PaymentMethod[];
  organisation?: Organisation | null;
}

const CalendarForm: React.FC<CalendarFormProps> = ({ formData, onChange, paymentMethods = [], organisation }) => {
  const { t } = useTranslation();

  const handleChange = (field: keyof CalendarFormData, value: any) => {
    onChange({ ...formData, [field]: value });
  };

  const isCardPaymentMethod = (methodId: string) => {
    const method = (paymentMethods || []).find(pm => pm.id === methodId);
    if (!method) return methodId === 'stripe' || methodId === 'card';
    const name = (method.name || '').toLowerCase();
    return name.includes('card') || name.includes('stripe') || name.includes('helix');
  };
  const hasCardPayment = (formData.supportedPaymentMethods || []).some(isCardPaymentMethod);
  const showHandlingFee = hasCardPayment; // Calendar has inherent pricing (time slot prices)

  const handlePaymentMethodsChange = (value: any) => {
    const newMethods = value as string[];
    const newHasCard = newMethods.some(isCardPaymentMethod);
    if (!newHasCard && formData.handlingFeeIncluded) {
      onChange({ ...formData, handlingFeeIncluded: false, supportedPaymentMethods: newMethods });
    } else {
      onChange({ ...formData, supportedPaymentMethods: newMethods });
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* Basic Information */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>{t('calendar.sections.basicInfo')}</Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              label={t('calendar.fields.calendarName')}
              value={formData.name}
              onChange={(e) => handleChange('name', e.target.value)}
              required
              fullWidth
            />
            <TextField
              label={t('calendar.fields.description')}
              value={formData.description}
              onChange={(e) => handleChange('description', e.target.value)}
              required
              multiline
              rows={3}
              fullWidth
            />
            <TextField
              label={t('calendar.fields.displayColour')}
              type="color"
              value={formData.displayColour}
              onChange={(e) => handleChange('displayColour', e.target.value)}
              fullWidth
            />
            <FormControl fullWidth>
              <InputLabel>{t('calendar.fields.status')}</InputLabel>
              <Select
                value={formData.status}
                label={t('calendar.fields.status')}
                onChange={(e) => handleChange('status', e.target.value)}
              >
                <MenuItem value="open">{t('calendar.statusOptions.open')}</MenuItem>
                <MenuItem value="closed">{t('calendar.statusOptions.closed')}</MenuItem>
              </Select>
            </FormControl>
          </Box>
        </CardContent>
      </Card>

      {/* Automated Opening/Closing */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>{t('calendar.sections.automatedSchedule')}</Typography>
          <FormControlLabel
            control={
              <Switch
                checked={formData.enableAutomatedSchedule}
                onChange={(e) => handleChange('enableAutomatedSchedule', e.target.checked)}
              />
            }
            label={t('calendar.fields.enableAutomatedSchedule')}
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
          <Typography variant="h6" gutterBottom>{t('calendar.sections.bookingWindow')}</Typography>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField
              label={t('calendar.fields.minDaysInAdvance')}
              type="number"
              value={formData.minDaysInAdvance}
              onChange={(e) => handleChange('minDaysInAdvance', parseInt(e.target.value))}
              fullWidth
            />
            <TextField
              label={t('calendar.fields.maxDaysInAdvance')}
              type="number"
              value={formData.maxDaysInAdvance}
              onChange={(e) => handleChange('maxDaysInAdvance', parseInt(e.target.value))}
              fullWidth
            />
          </Box>
        </CardContent>
      </Card>

      {/* Payment Configuration */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>{t('calendar.sections.paymentConfiguration')}</Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <FormControl fullWidth>
              <InputLabel>{t('calendar.fields.supportedPaymentMethods')}</InputLabel>
              <Select
                multiple
                value={formData.supportedPaymentMethods}
                label={t('calendar.fields.supportedPaymentMethods')}
                onChange={(e) => handlePaymentMethodsChange(e.target.value)}
                renderValue={(selected) => (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {selected.map((value) => {
                      const method = paymentMethods.find(m => m.id === value);
                      return <Chip key={value} label={method?.name || value} size="small" />;
                    })}
                  </Box>
                )}
              >
                {paymentMethods.map((method) => (
                  <MenuItem key={method.id} value={method.id}>
                    {method.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            {showHandlingFee && (
              <Box>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={formData.handlingFeeIncluded ?? false}
                      onChange={(e) => handleChange('handlingFeeIncluded', e.target.checked)}
                    />
                  }
                  label={t('payment.handlingFeeIncluded')}
                />
                <Typography variant="body2" color="text.secondary">
                  {t('payment.handlingFeeIncludedHelper')}
                </Typography>
              </Box>
            )}
          </Box>
        </CardContent>
      </Card>

      {/* Terms and Conditions */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>{t('calendar.sections.termsAndConditions')}</Typography>
          <FormControlLabel
            control={
              <Switch
                checked={formData.useTermsAndConditions}
                onChange={(e) => handleChange('useTermsAndConditions', e.target.checked)}
              />
            }
            label={t('calendar.fields.useTermsAndConditions')}
          />
          {formData.useTermsAndConditions && (
            <TextField
              label={t('calendar.fields.termsAndConditions')}
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
          <Typography variant="h6" gutterBottom>{t('calendar.sections.cancellationPolicy')}</Typography>
          <FormControlLabel
            control={
              <Switch
                checked={formData.allowCancellations}
                onChange={(e) => handleChange('allowCancellations', e.target.checked)}
              />
            }
            label={t('calendar.fields.allowCancellations')}
          />
          {formData.allowCancellations && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
              <TextField
                label={t('calendar.fields.cancelDaysInAdvance')}
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
                label={t('calendar.fields.refundPaymentAutomatically')}
              />
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Email Notifications */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>{t('calendar.sections.emailNotifications')}</Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              label={t('calendar.fields.adminNotificationEmails')}
              value={formData.adminNotificationEmails}
              onChange={(e) => handleChange('adminNotificationEmails', e.target.value)}
              placeholder={t('calendar.fields.adminNotificationEmailsPlaceholder')}
              fullWidth
            />
            <FormControlLabel
              control={
                <Switch
                  checked={formData.sendReminderEmails}
                  onChange={(e) => handleChange('sendReminderEmails', e.target.checked)}
                />
              }
              label={t('calendar.fields.sendReminderEmails')}
            />
            {formData.sendReminderEmails && (
              <TextField
                label={t('calendar.fields.reminderHoursBefore')}
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
