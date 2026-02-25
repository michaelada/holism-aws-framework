import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Typography,
  TextField,
  Grid,
  IconButton,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import { ArrowBack } from '@mui/icons-material';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  getOrganizationTypes,
  getCapabilities,
  createOrganization,
  getPaymentMethods,
} from '../services/organizationApi';
import type {
  OrganizationType,
  Capability,
  CreateOrganizationDto,
} from '../types/organization.types';
import type { PaymentMethod } from '../types/payment-method.types';
import { useNotification } from '../context/NotificationContext';
import { CapabilitySelector } from '../components/CapabilitySelector';
import { PaymentMethodSelector } from '../components/PaymentMethodSelector';

const LANGUAGES = [
  { code: 'en-GB', label: 'English (UK)' },
  { code: 'en-US', label: 'English (US)' },
  { code: 'fr-FR', label: 'French (France)' },
  { code: 'de-DE', label: 'German (Germany)' },
  { code: 'es-ES', label: 'Spanish (Spain)' },
  { code: 'it-IT', label: 'Italian (Italy)' },
  { code: 'pt-PT', label: 'Portuguese (Portugal)' },
];

const CURRENCIES = [
  { code: 'GBP', label: 'British Pound (£)' },
  { code: 'USD', label: 'US Dollar ($)' },
  { code: 'EUR', label: 'Euro (€)' },
  { code: 'AUD', label: 'Australian Dollar (A$)' },
  { code: 'CAD', label: 'Canadian Dollar (C$)' },
  { code: 'NZD', label: 'New Zealand Dollar (NZ$)' },
];

export const CreateOrganizationPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { showSuccess, showError } = useNotification();

  const [organizationTypes, setOrganizationTypes] = useState<OrganizationType[]>([]);
  const [capabilities, setCapabilities] = useState<Capability[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const preselectedTypeId = searchParams.get('typeId');

  const [formData, setFormData] = useState<CreateOrganizationDto>({
    organizationTypeId: preselectedTypeId || '',
    name: '',
    displayName: '',
    domain: '',
    contactName: '',
    contactEmail: '',
    contactMobile: '',
    currency: 'GBP',
    language: 'en-GB',
    enabledCapabilities: [],
    enabledPaymentMethods: ['pay-offline'], // Default to pay-offline
  });

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    // Update form data if typeId is provided in URL
    if (preselectedTypeId && formData.organizationTypeId === '') {
      setFormData((prev) => ({
        ...prev,
        organizationTypeId: preselectedTypeId,
      }));
    }
  }, [preselectedTypeId, organizationTypes]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [typesData, capsData, paymentMethodsData] = await Promise.all([
        getOrganizationTypes(),
        getCapabilities(),
        getPaymentMethods(),
      ]);
      setOrganizationTypes(typesData);
      setCapabilities(capsData);
      setPaymentMethods(paymentMethodsData);
    } catch (error) {
      showError('Failed to load data');
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.organizationTypeId) {
      showError('Please select an organisation type');
      return;
    }

    if (!formData.name.trim()) {
      showError('Please enter an organisation name');
      return;
    }

    if (!formData.displayName.trim()) {
      showError('Please enter a display name');
      return;
    }

    try {
      setSubmitting(true);
      await createOrganization(formData);
      showSuccess('Organisation created successfully');
      
      // Navigate back to the organization type details page if we came from there
      if (preselectedTypeId) {
        navigate(`/organization-types/${preselectedTypeId}`);
      } else {
        navigate('/organizations');
      }
    } catch (error: any) {
      showError(error.response?.data?.error || 'Failed to create organisation');
    } finally {
      setSubmitting(false);
    }
  };

  const handleChange = (field: keyof CreateOrganizationDto, value: any) => {
    // Sanitize name field to be URL-friendly
    if (field === 'name') {
      value = value
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, '-') // Replace non-alphanumeric chars with hyphens
        .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
        .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens
    }
    setFormData({ ...formData, [field]: value });
  };

  const handleCancel = () => {
    if (preselectedTypeId) {
      navigate(`/organization-types/${preselectedTypeId}`);
    } else {
      navigate('/organizations');
    }
  };

  const selectedType = organizationTypes.find((t) => t.id === formData.organizationTypeId);

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box display="flex" alignItems="center" gap={2} mb={3}>
        <IconButton onClick={handleCancel}>
          <ArrowBack />
        </IconButton>
        <Typography variant="h4">Create Organisation</Typography>
      </Box>

      <form onSubmit={handleSubmit}>
        <Card>
          <CardContent>
            <Grid container spacing={3}>
              <Grid item xs={12}>
                <FormControl fullWidth required>
                  <InputLabel>Organisation Type</InputLabel>
                  <Select
                    value={formData.organizationTypeId}
                    label="Organisation Type"
                    onChange={(e) => handleChange('organizationTypeId', e.target.value)}
                    disabled={!!preselectedTypeId}
                  >
                    {organizationTypes.map((type) => (
                      <MenuItem key={type.id} value={type.id}>
                        {type.displayName}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  required
                  label="Name (URL-friendly)"
                  value={formData.name}
                  onChange={(e) => handleChange('name', e.target.value)}
                  placeholder="e.g., my-org"
                  helperText="Lowercase, no spaces, hyphens allowed"
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  required
                  label="Display Name"
                  value={formData.displayName}
                  onChange={(e) => handleChange('displayName', e.target.value)}
                  helperText="Public-facing name"
                />
              </Grid>

              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Domain"
                  value={formData.domain}
                  onChange={(e) => handleChange('domain', e.target.value)}
                  helperText="Optional: Organisation domain (e.g., 'example.com')"
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Contact Name"
                  value={formData.contactName}
                  onChange={(e) => handleChange('contactName', e.target.value)}
                  helperText="Primary contact person for this organisation"
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Contact Email"
                  type="email"
                  value={formData.contactEmail}
                  onChange={(e) => handleChange('contactEmail', e.target.value)}
                  helperText="Primary contact email address"
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Contact Mobile Number"
                  value={formData.contactMobile}
                  onChange={(e) => handleChange('contactMobile', e.target.value)}
                  helperText="Primary contact mobile number"
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel>Language</InputLabel>
                  <Select
                    value={formData.language}
                    label="Language"
                    onChange={(e) => handleChange('language', e.target.value)}
                  >
                    {LANGUAGES.map((lang) => (
                      <MenuItem key={lang.code} value={lang.code}>
                        {lang.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel>Currency</InputLabel>
                  <Select
                    value={formData.currency}
                    label="Currency"
                    onChange={(e) => handleChange('currency', e.target.value)}
                  >
                    {CURRENCIES.map((curr) => (
                      <MenuItem key={curr.code} value={curr.code}>
                        {curr.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              {selectedType && (
                <Grid item xs={12}>
                  <Typography variant="subtitle2" gutterBottom>
                    Enabled Capabilities
                  </Typography>
                  <Typography variant="body2" color="textSecondary" gutterBottom>
                    Select which capabilities this organisation should have access to.
                    Default capabilities from the organisation type are pre-selected.
                  </Typography>
                  <CapabilitySelector
                    capabilities={capabilities}
                    selectedCapabilities={formData.enabledCapabilities}
                    defaultCapabilities={selectedType.defaultCapabilities}
                    onChange={(selected) => handleChange('enabledCapabilities', selected)}
                  />
                </Grid>
              )}

              <Grid item xs={12}>
                <Typography variant="subtitle2" gutterBottom>
                  Payment Methods
                </Typography>
                <Typography variant="body2" color="textSecondary" gutterBottom>
                  Select which payment methods this organisation should have access to.
                  "Pay Offline" is selected by default.
                </Typography>
                <PaymentMethodSelector
                  paymentMethods={paymentMethods}
                  selectedPaymentMethods={formData.enabledPaymentMethods || []}
                  onChange={(selected) => handleChange('enabledPaymentMethods', selected)}
                />
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        <Box display="flex" gap={2} mt={3} justifyContent="flex-end">
          <Button
            variant="outlined"
            onClick={handleCancel}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={submitting}
          >
            {submitting ? 'Creating...' : 'Create Organisation'}
          </Button>
        </Box>
      </form>
    </Box>
  );
};
