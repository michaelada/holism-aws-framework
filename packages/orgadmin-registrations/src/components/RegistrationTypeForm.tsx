/**
 * Registration Type Form Component
 *
 * Self-contained, reusable form for creating and editing registration types.
 * Manages its own form state, validation, and loads application forms / payment methods via useApi.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  FormControl,
  FormControlLabel,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Typography,
  Alert,
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { enGB } from 'date-fns/locale';
import { Save as SaveIcon, Cancel as CancelIcon, Publish as PublishIcon } from '@mui/icons-material';
import { useTranslation, useCapabilities } from '@aws-web-framework/orgadmin-shell';
import { DiscountSelector } from '@aws-web-framework/components';
import { useOrganisation, useApi } from '@aws-web-framework/orgadmin-core';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import type { RegistrationTypeFormData } from '../types/registration.types';

interface ApplicationForm {
  id: string;
  name: string;
}

interface PaymentMethod {
  id: string;
  name: string;
}

export interface RegistrationTypeFormProps {
  initialValues?: RegistrationTypeFormData;
  onSubmit: (data: RegistrationTypeFormData) => Promise<void>;
  onCancel: () => void;
  isEditing?: boolean;
}

const DEFAULT_FORM_DATA: RegistrationTypeFormData = {
  name: '',
  description: '',
  entityName: '',
  registrationFormId: '',
  registrationStatus: 'open',
  isRollingRegistration: false,
  validUntil: undefined,
  numberOfMonths: undefined,
  automaticallyApprove: false,
  registrationLabels: [],
  supportedPaymentMethods: [],
  fee: 0,
  handlingFeeIncluded: false,
  useTermsAndConditions: false,
  termsAndConditions: undefined,
  discountIds: [],
};

const RegistrationTypeForm: React.FC<RegistrationTypeFormProps> = ({
  initialValues,
  onSubmit,
  onCancel,
  isEditing = false,
}) => {
  const { execute } = useApi();
  const { t } = useTranslation();
  const { hasCapability } = useCapabilities();
  const { organisation } = useOrganisation();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [applicationForms, setApplicationForms] = useState<ApplicationForm[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [formData, setFormData] = useState<RegistrationTypeFormData>(
    initialValues || { ...DEFAULT_FORM_DATA },
  );
  const [labelInput, setLabelInput] = useState('');

  const fee = formData.fee ?? 0;
  const isCardPaymentMethod = (methodId: string) => {
    const method = paymentMethods.find(pm => pm.id === methodId);
    if (!method) return methodId === 'stripe' || methodId === 'card';
    const name = (method.name || '').toLowerCase();
    return name.includes('card') || name.includes('stripe') || name.includes('helix');
  };
  const hasCardPayment = (formData.supportedPaymentMethods || []).some(isCardPaymentMethod);
  const showHandlingFee = hasCardPayment && fee > 0;

  // Sync initialValues when they arrive (e.g. after async fetch in edit mode)
  useEffect(() => {
    if (initialValues) {
      setFormData(initialValues);
    }
  }, [initialValues]);

  useEffect(() => {
    loadApplicationForms();
    loadPaymentMethods();
  }, []);

  const loadApplicationForms = async () => {
    try {
      const response = await execute({
        method: 'GET',
        url: '/api/orgadmin/application-forms',
      });
      const forms: ApplicationForm[] = response || [];
      setApplicationForms(forms);
      // Auto-select when only one form available and not editing
      if (forms.length === 1 && !isEditing && !formData.registrationFormId) {
        setFormData(prev => ({ ...prev, registrationFormId: forms[0].id }));
      }
    } catch (err) {
      console.error('Failed to load application forms:', err);
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
      // Auto-select first payment method when not editing
      if (methods.length > 0 && !isEditing && formData.supportedPaymentMethods.length === 0) {
        setFormData(prev => ({ ...prev, supportedPaymentMethods: [methods[0].id] }));
      }
    } catch (err) {
      console.error('Failed to load payment methods:', err);
      const defaults: PaymentMethod[] = [
        { id: 'pay-offline', name: 'Pay Offline' },
        { id: 'stripe', name: 'Card Payment (Stripe)' },
      ];
      setPaymentMethods(defaults);
    }
  };

  const fetchDiscounts = useCallback(async (organisationId: string, moduleType: string) => {
    try {
      const response = await execute({
        method: 'GET',
        url: `/api/orgadmin/organisations/${organisationId}/discounts/${moduleType}`,
      });
      return response.discounts || [];
    } catch (err) {
      console.error('Failed to fetch discounts:', err);
      return [];
    }
  }, [execute]);

  const handleChange = (field: keyof RegistrationTypeFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleAddLabel = () => {
    if (labelInput.trim() && !formData.registrationLabels.includes(labelInput.trim())) {
      setFormData(prev => ({
        ...prev,
        registrationLabels: [...prev.registrationLabels, labelInput.trim()],
      }));
      setLabelInput('');
    }
  };

  const handleRemoveLabel = (label: string) => {
    setFormData(prev => ({
      ...prev,
      registrationLabels: prev.registrationLabels.filter(l => l !== label),
    }));
  };

  const handlePaymentMethodsChange = (value: any) => {
    const newMethods = value as string[];
    const newHasCard = newMethods.some(isCardPaymentMethod);
    if (!newHasCard && formData.handlingFeeIncluded) {
      setFormData(prev => ({ ...prev, handlingFeeIncluded: false, supportedPaymentMethods: newMethods }));
    } else {
      setFormData(prev => ({ ...prev, supportedPaymentMethods: newMethods }));
    }
  };

  const validateForm = (): boolean => {
    if (!formData.name.trim()) {
      setError(t('registrations.validation.nameRequired'));
      return false;
    }
    if (!formData.description.trim()) {
      setError(t('registrations.validation.descriptionRequired'));
      return false;
    }
    if (!formData.entityName.trim()) {
      setError(t('registrations.validation.entityNameRequired'));
      return false;
    }
    if (!formData.registrationFormId) {
      setError(t('registrations.validation.formRequired'));
      return false;
    }
    if (!formData.isRollingRegistration && !formData.validUntil) {
      setError(t('registrations.validation.validUntilRequired'));
      return false;
    }
    if (formData.isRollingRegistration && !formData.numberOfMonths) {
      setError(t('registrations.validation.numberOfMonthsRequired'));
      return false;
    }
    if (formData.supportedPaymentMethods.length === 0) {
      setError(t('registrations.validation.paymentMethodRequired'));
      return false;
    }
    if (formData.useTermsAndConditions && !formData.termsAndConditions?.trim()) {
      setError(t('registrations.validation.termsRequired'));
      return false;
    }
    return true;
  };

  const handleSave = async (publish: boolean = false) => {
    setError(null);

    if (!validateForm()) {
      return;
    }

    try {
      setLoading(true);

      const dataToSave: RegistrationTypeFormData = {
        ...formData,
        registrationStatus: publish ? 'open' : formData.registrationStatus,
      };

      await onSubmit(dataToSave);
    } catch (err) {
      console.error('Failed to save registration type:', err);
      setError(t('registrations.failedToSave'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={enGB}>
      <Box>
        {error && (
          <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        <Grid container spacing={3}>
          {/* Basic Information */}
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  {t('registrations.sections.basicInfo')}
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="Name"
                      required
                      value={formData.name}
                      onChange={(e) => handleChange('name', e.target.value)}
                      helperText="Display name for this registration type (e.g., '2026 Horse Registration')"
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="Description"
                      required
                      multiline
                      rows={3}
                      value={formData.description}
                      onChange={(e) => handleChange('description', e.target.value)}
                      helperText="Detailed description displayed to account users"
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      label="Entity Name"
                      required
                      value={formData.entityName}
                      onChange={(e) => handleChange('entityName', e.target.value)}
                      helperText="Name of the thing being registered (e.g., 'Horse', 'Boat', 'Equipment')"
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <FormControl fullWidth required>
                      <InputLabel>Registration Status</InputLabel>
                      <Select
                        value={formData.registrationStatus}
                        label="Registration Status"
                        onChange={(e) => handleChange('registrationStatus', e.target.value)}
                      >
                        <MenuItem value="open">Open (Accepting Applications)</MenuItem>
                        <MenuItem value="closed">Closed (Visible but Not Accepting)</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>

          {/* Registration Form */}
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Registration Form
                </Typography>
                <FormControl fullWidth required>
                  <InputLabel>Application Form</InputLabel>
                  <Select
                    value={formData.registrationFormId}
                    label="Application Form"
                    onChange={(e) => handleChange('registrationFormId', e.target.value)}
                  >
                    {applicationForms.map((form) => (
                      <MenuItem key={form.id} value={form.id}>
                        {form.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                  Select the form that defines required fields for entity registration
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          {/* Duration Settings */}
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Duration Settings
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12}>
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={formData.isRollingRegistration}
                          onChange={(e) => handleChange('isRollingRegistration', e.target.checked)}
                        />
                      }
                      label="Is Rolling Registration"
                    />
                    <Typography variant="caption" color="text.secondary" display="block">
                      Rolling registrations are valid for a specified number of months from payment date.
                      Fixed-period registrations have a specific end date.
                    </Typography>
                  </Grid>
                  {!formData.isRollingRegistration ? (
                    <Grid item xs={12} md={6}>
                      <DatePicker
                        label="Valid Until"
                        value={formData.validUntil || null}
                        onChange={(date) => handleChange('validUntil', date)}
                        renderInput={(params) => (
                          <TextField
                            {...params}
                            fullWidth
                            required
                            helperText="End date for fixed-period registrations"
                          />
                        )}
                      />
                    </Grid>
                  ) : (
                    <Grid item xs={12} md={6}>
                      <TextField
                        fullWidth
                        label="Number of Months"
                        type="number"
                        required
                        value={formData.numberOfMonths || ''}
                        onChange={(e) => handleChange('numberOfMonths', parseInt(e.target.value) || undefined)}
                        helperText="Duration in months for rolling registrations"
                        inputProps={{ min: 1 }}
                      />
                    </Grid>
                  )}
                </Grid>
              </CardContent>
            </Card>
          </Grid>

          {/* Approval Settings */}
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Approval Settings
                </Typography>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={formData.automaticallyApprove}
                      onChange={(e) => handleChange('automaticallyApprove', e.target.checked)}
                    />
                  }
                  label="Automatically Approve Applications"
                />
                <Typography variant="caption" color="text.secondary" display="block">
                  When enabled, new applications are automatically marked as "Active".
                  When disabled, applications require manual review and are marked as "Pending".
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          {/* Labels */}
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Registration Labels
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                  <TextField
                    fullWidth
                    label="Add Label"
                    value={labelInput}
                    onChange={(e) => setLabelInput(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddLabel();
                      }
                    }}
                    helperText="Tags automatically assigned to registrations using this type"
                  />
                  <Button variant="outlined" onClick={handleAddLabel}>
                    Add
                  </Button>
                </Box>
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  {formData.registrationLabels.map((label) => (
                    <Chip
                      key={label}
                      label={label}
                      onDelete={() => handleRemoveLabel(label)}
                    />
                  ))}
                </Box>
              </CardContent>
            </Card>
          </Grid>

          {/* Payment Configuration */}
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Payment Configuration
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      type="number"
                      label={t('payment.fee', { currency: organisation?.currency || 'EUR' })}
                      value={formData.fee ?? 0}
                      onChange={(e) => handleChange('fee', parseFloat(e.target.value) || 0)}
                      helperText={t('payment.feeHelper')}
                      inputProps={{ min: 0, step: 0.01 }}
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <FormControl fullWidth required>
                      <InputLabel>Supported Payment Methods</InputLabel>
                      <Select
                        multiple
                        value={formData.supportedPaymentMethods}
                        label="Supported Payment Methods"
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
                  </Grid>
                  {showHandlingFee && (
                    <Grid item xs={12}>
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
                    </Grid>
                  )}
                </Grid>
              </CardContent>
            </Card>
          </Grid>

          {/* Discounts */}
          {hasCapability('registration-discounts') && (
            <Grid item xs={12}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    {t('registrations.sections.discounts')}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    {t('registrations.discounts.selectorHelperText')}
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={12}>
                      <DiscountSelector
                        selectedDiscountIds={formData.discountIds || []}
                        onChange={(discountIds) => handleChange('discountIds', discountIds)}
                        organisationId={organisation?.id || ''}
                        moduleType="registrations"
                        fetchDiscounts={fetchDiscounts}
                        label={t('registrations.discounts.selectLabel')}
                        helperText={t('registrations.discounts.selectHelperText')}
                        currencyCode={organisation?.currency || 'EUR'}
                      />
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>
            </Grid>
          )}

          {/* Terms and Conditions */}
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Terms and Conditions
                </Typography>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={formData.useTermsAndConditions}
                      onChange={(e) => handleChange('useTermsAndConditions', e.target.checked)}
                    />
                  }
                  label="Use Terms and Conditions"
                />
                {formData.useTermsAndConditions && (
                  <Box sx={{ mt: 2 }}>
                    <ReactQuill
                      theme="snow"
                      value={formData.termsAndConditions || ''}
                      onChange={(value) => handleChange('termsAndConditions', value)}
                      placeholder="Enter terms and conditions..."
                      style={{ height: '200px', marginBottom: '50px' }}
                    />
                  </Box>
                )}
              </CardContent>
            </Card>
          </Grid>

          {/* Action Buttons */}
          <Grid item xs={12}>
            <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
              <Button
                variant="outlined"
                startIcon={<CancelIcon />}
                onClick={onCancel}
                disabled={loading}
              >
                {t('common.actions.cancel')}
              </Button>
              <Button
                variant="outlined"
                startIcon={<SaveIcon />}
                onClick={() => handleSave(false)}
                disabled={loading}
              >
                {t('registrations.actions.saveAsDraft')}
              </Button>
              <Button
                variant="contained"
                startIcon={<PublishIcon />}
                onClick={() => handleSave(true)}
                disabled={loading}
              >
                {isEditing ? t('registrations.actions.update') : t('registrations.actions.saveAndPublish')}
              </Button>
            </Box>
          </Grid>
        </Grid>
      </Box>
    </LocalizationProvider>
  );
};

export default RegistrationTypeForm;
