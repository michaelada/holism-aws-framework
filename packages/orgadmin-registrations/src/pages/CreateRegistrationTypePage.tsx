/**
 * Create/Edit Registration Type Page
 * 
 * Form for creating or editing registration types
 */

import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
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
  Autocomplete,
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { enGB } from 'date-fns/locale';
import { Save as SaveIcon, Cancel as CancelIcon, Publish as PublishIcon } from '@mui/icons-material';
import { useTranslation } from '@aws-web-framework/orgadmin-shell';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import type { RegistrationTypeFormData } from '../types/registration.types';

// Mock API hook - will be replaced with actual implementation
const useApi = () => ({
  execute: async ({ method, url, data }: { method: string; url: string; data?: any }) => {
    console.log('API call:', method, url, data);
    return { id: '1', ...data };
  },
});

interface ApplicationForm {
  id: string;
  name: string;
}

interface PaymentMethod {
  id: string;
  name: string;
}

const CreateRegistrationTypePage: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { execute } = useApi();
  const { t } = useTranslation();
  const isEditMode = Boolean(id);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [applicationForms, setApplicationForms] = useState<ApplicationForm[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  
  const [formData, setFormData] = useState<RegistrationTypeFormData>({
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
    useTermsAndConditions: false,
    termsAndConditions: undefined,
  });

  const [labelInput, setLabelInput] = useState('');

  useEffect(() => {
    loadApplicationForms();
    loadPaymentMethods();
    if (isEditMode && id) {
      loadRegistrationType(id);
    }
  }, [id, isEditMode]);

  const loadApplicationForms = async () => {
    try {
      const response = await execute({
        method: 'GET',
        url: '/api/orgadmin/application-forms',
      });
      setApplicationForms(response || []);
    } catch (error) {
      console.error('Failed to load application forms:', error);
    }
  };

  const loadPaymentMethods = async () => {
    try {
      const response = await execute({
        method: 'GET',
        url: '/api/orgadmin/payment-methods',
      });
      setPaymentMethods(response || [
        { id: 'pay-offline', name: 'Pay Offline' },
        { id: 'stripe', name: 'Card Payment (Stripe)' },
      ]);
    } catch (error) {
      console.error('Failed to load payment methods:', error);
      // Set default payment methods
      setPaymentMethods([
        { id: 'pay-offline', name: 'Pay Offline' },
        { id: 'stripe', name: 'Card Payment (Stripe)' },
      ]);
    }
  };

  const loadRegistrationType = async (typeId: string) => {
    try {
      setLoading(true);
      const response = await execute({
        method: 'GET',
        url: `/api/orgadmin/registration-types/${typeId}`,
      });
      setFormData(response);
    } catch (error) {
      console.error('Failed to load registration type:', error);
      setError('Failed to load registration type');
    } finally {
      setLoading(false);
    }
  };

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
      
      const dataToSave = {
        ...formData,
        registrationStatus: publish ? 'open' : formData.registrationStatus,
      };

      if (isEditMode && id) {
        await execute({
          method: 'PUT',
          url: `/api/orgadmin/registration-types/${id}`,
          data: dataToSave,
        });
      } else {
        await execute({
          method: 'POST',
          url: '/api/orgadmin/registration-types',
          data: dataToSave,
        });
      }

      navigate('/registrations/types');
    } catch (error) {
      console.error('Failed to save registration type:', error);
      setError(t('registrations.failedToSave'));
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    navigate('/registrations/types');
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={enGB}>
      <Box sx={{ p: 3 }}>
        <Typography variant="h4" gutterBottom>
          {isEditMode ? t('registrations.editRegistrationType') : t('registrations.createRegistrationType')}
        </Typography>

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

          {/* Payment Methods */}
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Payment Configuration
                </Typography>
                <FormControl fullWidth required>
                  <InputLabel>Supported Payment Methods</InputLabel>
                  <Select
                    multiple
                    value={formData.supportedPaymentMethods}
                    label="Supported Payment Methods"
                    onChange={(e) => handleChange('supportedPaymentMethods', e.target.value)}
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
              </CardContent>
            </Card>
          </Grid>

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
                onClick={handleCancel}
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
                {isEditMode ? t('registrations.actions.update') : t('registrations.actions.saveAndPublish')}
              </Button>
            </Box>
          </Grid>
        </Grid>
      </Box>
    </LocalizationProvider>
  );
};

export default CreateRegistrationTypePage;
