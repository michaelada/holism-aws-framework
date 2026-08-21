import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  CircularProgress,
  MenuItem,
  IconButton,
} from '@mui/material';
import { ArrowBack } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import {
  getCapabilities,
  createOrganizationType,
  uploadOrganizationTypeLogo,
  getCardPaymentMethodDefaults,
  setOrganizationTypePaymentFees,
} from '../services/organizationApi';
import type { Capability, CreateOrganizationTypeDto } from '../types/organization.types';
import { useNotification } from '../context/NotificationContext';
import { CapabilitySelector } from '../components/CapabilitySelector';
import { TypeLogoSection } from '../components/TypeLogoSection';
import { PaymentFeeEditor } from '../components/PaymentFeeEditor';
import type { PaymentFeeEditorMethod } from '../components/PaymentFeeEditor';
import type { CardPaymentMethodDefault } from '../types/organization.types';

const CURRENCIES = ['USD', 'EUR', 'GBP', 'AUD', 'CAD', 'JPY', 'CNY'];
const LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'es', name: 'Spanish' },
  { code: 'fr', name: 'French' },
  { code: 'de', name: 'German' },
  { code: 'it', name: 'Italian' },
  { code: 'pt', name: 'Portuguese' },
  { code: 'zh', name: 'Chinese' },
  { code: 'ja', name: 'Japanese' },
];

const LOCALES = [
  { code: 'en-GB', name: 'English (UK)' },
  { code: 'fr-FR', name: 'Français (France)' },
  { code: 'es-ES', name: 'Español (España)' },
  { code: 'it-IT', name: 'Italiano (Italia)' },
  { code: 'de-DE', name: 'Deutsch (Deutschland)' },
  { code: 'pt-PT', name: 'Português (Portugal)' },
];

export const CreateOrganizationTypePage: React.FC = () => {
  const navigate = useNavigate();
  const { showSuccess, showError } = useNotification();
  
  const [capabilities, setCapabilities] = useState<Capability[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [paymentFees, setPaymentFees] = useState<PaymentFeeEditorMethod[]>([]);
  const [feeDefaults, setFeeDefaults] = useState<CardPaymentMethodDefault[]>([]);
  
  const [formData, setFormData] = useState<CreateOrganizationTypeDto>({
    name: '',
    displayName: '',
    description: '',
    currency: 'USD',
    language: 'en',
    defaultLocale: 'en-GB',
    defaultCapabilities: [],
    allowLogoOverride: true,
    membershipNumbering: 'internal',
    membershipNumberUniqueness: 'organization',
    initialMembershipNumber: 1000000,
  });
  // Uploaded after the type is created; see the save handler.
  const [logoFile, setLogoFile] = useState<File | null>(null);

  useEffect(() => {
    loadCapabilities();
  }, []);

  const loadCapabilities = async () => {
    try {
      setLoading(true);
      const data = await getCapabilities();
      setCapabilities(data);
    } catch (error) {
      showError('Failed to load capabilities');
      console.error('Error loading capabilities:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    (async () => {
      try {
        // Guarded: a response of an unexpected shape should leave the fee
        // editor empty, not break the page it sits on.
        const defaults = (await getCardPaymentMethodDefaults()) ?? [];
        setFeeDefaults(defaults);
        setPaymentFees(
          defaults.map((d) => ({
            paymentMethodId: d.paymentMethodId,
            displayName: d.displayName,
            fixedFee: d.fixedFee,
            percentageFee: d.percentageFee,
            taxPercentage: d.taxPercentage,
          }))
        );
      } catch (error) {
        console.error('Error loading default handling fees:', error);
      }
    })();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      setSubmitting(true);
      
      // Prepare form data - only include conditional fields for internal mode
      const submitData: CreateOrganizationTypeDto = {
        ...formData,
      };
      
      // Remove conditional fields if external mode
      if (formData.membershipNumbering === 'external') {
        delete submitData.membershipNumberUniqueness;
        delete submitData.initialMembershipNumber;
      }
      
      const created = await createOrganizationType(submitData);

      /*
       * The logo is addressed by id, so it can only be attached once the type
       * exists. A failure here leaves a created type with no logo rather than
       * failing the whole save — the operator is told, and can add it from the
       * edit screen.
       */
      if (logoFile && created?.id) {
        try {
          await uploadOrganizationTypeLogo(created.id, logoFile);
        } catch (error) {
          console.error('Error uploading the organisation type logo:', error);
          showError('The organisation type was created, but the logo could not be uploaded');
        }
      }

      // The type has to exist before fees can hang off it, so this is a second
      // call rather than part of the create payload. A failure here leaves the
      // type on the platform defaults, which is a safe place to land.
      if (paymentFees.length > 0) {
        try {
          await setOrganizationTypePaymentFees(
            created.id,
            paymentFees.map((f) => ({
              paymentMethodId: f.paymentMethodId,
              fixedFee: Number(f.fixedFee) || 0,
              percentageFee: Number(f.percentageFee) || 0,
              taxPercentage: Number(f.taxPercentage) || 0,
            }))
          );
        } catch (feeError) {
          showError(
            'Organisation type created, but the handling fees could not be saved. Please set them from the edit page.'
          );
          console.error('Error saving handling fees:', feeError);
        }
      }

      showSuccess('Organisation type created successfully');
      navigate('/organization-types');
    } catch (error: any) {
      showError(error.response?.data?.error || 'Failed to create organisation type');
    } finally {
      setSubmitting(false);
    }
  };

  const handleChange = (field: keyof CreateOrganizationTypeDto, value: any) => {
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
        <IconButton onClick={() => navigate('/organization-types')}>
          <ArrowBack />
        </IconButton>
        <Typography variant="h4">Create Organisation Type</Typography>
      </Box>

      <Card>
        <CardContent>
          <form onSubmit={handleSubmit}>
            <Box display="flex" flexDirection="column" gap={3}>
              <TextField
                label="Name (URL-friendly)"
                value={formData.name}
                onChange={(e) => handleChange('name', e.target.value)}
                placeholder="e.g., swimming-club"
                helperText="Lowercase, no spaces, hyphens allowed"
                required
                fullWidth
              />

              <TextField
                label="Display Name"
                value={formData.displayName}
                onChange={(e) => handleChange('displayName', e.target.value)}
                placeholder="e.g., Swimming Club"
                required
                fullWidth
              />

              <TextField
                label="Description"
                value={formData.description}
                onChange={(e) => handleChange('description', e.target.value)}
                placeholder="Brief description of this organisation type"
                multiline
                rows={3}
                fullWidth
              />

              <TextField
                select
                label="Currency"
                value={formData.currency}
                onChange={(e) => handleChange('currency', e.target.value)}
                required
                fullWidth
              >
                {CURRENCIES.map((currency) => (
                  <MenuItem key={currency} value={currency}>
                    {currency}
                  </MenuItem>
                ))}
              </TextField>

              <TextField
                select
                label="Language"
                value={formData.language}
                onChange={(e) => handleChange('language', e.target.value)}
                required
                fullWidth
              >
                {LANGUAGES.map((lang) => (
                  <MenuItem key={lang.code} value={lang.code}>
                    {lang.name}
                  </MenuItem>
                ))}
              </TextField>

              <TextField
                select
                label="Default Locale"
                value={formData.defaultLocale}
                onChange={(e) => handleChange('defaultLocale', e.target.value)}
                helperText="The default language and regional format for organisations of this type"
                required
                fullWidth
              >
                {LOCALES.map((locale) => (
                  <MenuItem key={locale.code} value={locale.code}>
                    {locale.name}
                  </MenuItem>
                ))}
              </TextField>

              <TextField
                select
                label="Membership Numbering"
                value={formData.membershipNumbering}
                onChange={(e) => handleChange('membershipNumbering', e.target.value)}
                helperText="Choose how membership numbers are generated"
                required
                fullWidth
              >
                <MenuItem value="internal">Internal (System Generated)</MenuItem>
                <MenuItem value="external">External (User Provided)</MenuItem>
              </TextField>

              {formData.membershipNumbering === 'internal' && (
                <>
                  <TextField
                    select
                    label="Membership Number Uniqueness"
                    value={formData.membershipNumberUniqueness}
                    onChange={(e) => handleChange('membershipNumberUniqueness', e.target.value)}
                    helperText="Define the scope for membership number uniqueness"
                    required
                    fullWidth
                  >
                    <MenuItem value="organization_type">Organization Type Level</MenuItem>
                    <MenuItem value="organization">Organization Level</MenuItem>
                  </TextField>

                  <TextField
                    type="number"
                    label="Initial Membership Number"
                    value={formData.initialMembershipNumber}
                    onChange={(e) => handleChange('initialMembershipNumber', parseInt(e.target.value) || 1000000)}
                    helperText="The starting number for sequential membership number generation"
                    inputProps={{ min: 1 }}
                    required
                    fullWidth
                  />
                </>
              )}

              <PaymentFeeEditor

                methods={paymentFees}

                currency={formData.currency}

                defaults={feeDefaults}

                onChange={setPaymentFees}

                disabled={submitting}

              />


              <Box>
                <Typography variant="h6" gutterBottom>
                  Shared Logo
                </Typography>
                <Typography variant="body2" color="textSecondary" gutterBottom>
                  Inherited by every organisation of this type. A federation has one mark; without
                  this each branch uploads its own copy of it.
                </Typography>
                <TypeLogoSection
                  pendingFile={logoFile}
                  allowOverride={formData.allowLogoOverride !== false}
                  onChooseFile={setLogoFile}
                  onAllowOverrideChange={(allow) => handleChange('allowLogoOverride', allow)}
                  deferred
                  busy={submitting}
                />
              </Box>

              <Box>
                <Typography variant="h6" gutterBottom>
                  Default Capabilities
                </Typography>
                <Typography variant="body2" color="textSecondary" gutterBottom>
                  Select the capabilities that will be enabled by default for all organisations of this type.
                </Typography>
                <CapabilitySelector
                  capabilities={capabilities}
                  selectedCapabilities={formData.defaultCapabilities}
                  onChange={(selected) => handleChange('defaultCapabilities', selected)}
                />
              </Box>

              <Box display="flex" gap={2} justifyContent="flex-end">
                <Button
                  variant="outlined"
                  onClick={() => navigate('/organization-types')}
                  disabled={submitting}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="contained"
                  disabled={
                    submitting ||
                    !formData.name ||
                    !formData.displayName ||
                    formData.defaultCapabilities.length === 0
                  }
                >
                  {submitting ? <CircularProgress size={24} /> : 'Create Organisation Type'}
                </Button>
              </Box>
            </Box>
          </form>
        </CardContent>
      </Card>
    </Box>
  );
};
