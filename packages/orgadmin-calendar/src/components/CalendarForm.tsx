/**
 * Calendar Form Component
 * 
 * Reusable form component for creating/editing calendars with all configuration sections.
 */

import React, { useCallback } from 'react';
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
import { useCapabilities } from '@aws-web-framework/orgadmin-shell';
import { useApi } from '@aws-web-framework/orgadmin-core';
import { DiscountSelector } from '@aws-web-framework/components';
import type { CalendarFormData } from '../types/calendar.types';
import ScheduleRulesSection from './ScheduleRulesSection';
import TimeSlotConfigurationSection from './TimeSlotConfigurationSection';
import BlockedPeriodsSection from './BlockedPeriodsSection';

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
  applicationForms?: Array<{ id: string; name: string }>;
  organisation?: Organisation | null;
}

const CalendarForm: React.FC<CalendarFormProps> = ({ formData, onChange, paymentMethods = [], applicationForms = [], organisation }) => {
  const { t } = useTranslation();
  const { execute } = useApi();
  const { hasCapability } = useCapabilities();

  const fetchDiscounts = useCallback(async (organisationId: string, moduleType: string) => {
    try {
      const response = await execute({
        method: 'GET',
        url: `/api/orgadmin/organisations/${organisationId}/discounts/${moduleType}`,
      });
      return response.discounts || [];
    } catch (error) {
      console.error('Failed to fetch discounts:', error);
      return [];
    }
  }, []);

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
            <FormControl fullWidth>
              <InputLabel>{t('calendar.fields.applicationForm')}</InputLabel>
              <Select
                value={formData.applicationFormId || ''}
                label={t('calendar.fields.applicationForm')}
                onChange={(e) => handleChange('applicationFormId', e.target.value || undefined)}
              >
                <MenuItem value="">
                  <em>None</em>
                </MenuItem>
                {applicationForms.map((form) => (
                  <MenuItem key={form.id} value={form.id}>
                    {form.name}
                  </MenuItem>
                ))}
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
              value={formData.minDaysInAdvance ?? 0}
              onChange={(e) => handleChange('minDaysInAdvance', Math.max(0, parseInt(e.target.value) || 0))}
              fullWidth
              inputProps={{ min: 0 }}
            />
            <TextField
              label={t('calendar.fields.maxDaysInAdvance')}
              type="number"
              value={formData.maxDaysInAdvance ?? 90}
              onChange={(e) => handleChange('maxDaysInAdvance', Math.max(0, parseInt(e.target.value) || 0))}
              fullWidth
              inputProps={{ min: 0 }}
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

      {/* Discounts */}
      {hasCapability('calendar-discounts') && (
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>{t('calendar.sections.discounts')}</Typography>
            <DiscountSelector
              selectedDiscountIds={formData.discountIds || []}
              onChange={(discountIds) => handleChange('discountIds', discountIds)}
              organisationId={organisation?.id || ''}
              moduleType="calendar"
              fetchDiscounts={fetchDiscounts}
              label={t('calendar.fields.selectDiscounts')}
              helperText={t('calendar.fields.selectDiscountsHelper')}
              currencyCode={organisation?.currency || 'EUR'}
            />
          </CardContent>
        </Card>
      )}

      {/* Time Slot Configuration */}
      <Card>
        <CardContent>
          <TimeSlotConfigurationSection
            configurations={formData.timeSlotConfigurations || []}
            onChange={(configs) => handleChange('timeSlotConfigurations', configs)}
          />
        </CardContent>
      </Card>

      {/* Blocked Periods */}
      <Card>
        <CardContent>
          <BlockedPeriodsSection
            blockedPeriods={formData.blockedPeriods || []}
            onChange={(periods) => handleChange('blockedPeriods', periods)}
          />
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
