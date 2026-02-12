/**
 * Organisation Details Tab
 * 
 * Form for managing organisation name, address, contact info, and basic settings
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Grid,
  TextField,
  Typography,
  Alert,
  CircularProgress,
  MenuItem,
} from '@mui/material';
import { Save as SaveIcon } from '@mui/icons-material';
import { useApi } from '../../hooks/useApi';

interface OrganisationDetails {
  id: string;
  name: string;
  displayName: string;
  domain?: string;
  currency?: string;
  language?: string;
  settings: {
    address?: string;
    city?: string;
    postcode?: string;
    country?: string;
    phone?: string;
    email?: string;
    website?: string;
  };
}

const CURRENCIES = [
  { value: 'GBP', label: '£ GBP - British Pound' },
  { value: 'EUR', label: '€ EUR - Euro' },
  { value: 'USD', label: '$ USD - US Dollar' },
  { value: 'AUD', label: '$ AUD - Australian Dollar' },
  { value: 'CAD', label: '$ CAD - Canadian Dollar' },
];

const LANGUAGES = [
  { value: 'en-GB', label: 'English (UK)' },
  { value: 'en-US', label: 'English (US)' },
  { value: 'fr-FR', label: 'French' },
  { value: 'de-DE', label: 'German' },
  { value: 'es-ES', label: 'Spanish' },
];

const OrganisationDetailsTab: React.FC = () => {
  const { execute } = useApi();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  
  const [formData, setFormData] = useState<OrganisationDetails>({
    id: '',
    name: '',
    displayName: '',
    domain: '',
    currency: 'GBP',
    language: 'en-GB',
    settings: {
      address: '',
      city: '',
      postcode: '',
      country: '',
      phone: '',
      email: '',
      website: '',
    },
  });

  useEffect(() => {
    loadOrganisationDetails();
  }, []);

  const loadOrganisationDetails = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Get current organisation from context/API
      const response = await execute({
        method: 'GET',
        url: '/api/orgadmin/organisation',
      });
      
      setFormData({
        id: response.id,
        name: response.name,
        displayName: response.displayName,
        domain: response.domain || '',
        currency: response.currency || 'GBP',
        language: response.language || 'en-GB',
        settings: {
          address: response.settings?.address || '',
          city: response.settings?.city || '',
          postcode: response.settings?.postcode || '',
          country: response.settings?.country || '',
          phone: response.settings?.phone || '',
          email: response.settings?.email || '',
          website: response.settings?.website || '',
        },
      });
    } catch (err: any) {
      setError(err.message || 'Failed to load organisation details');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field: string, value: string) => {
    if (field.startsWith('settings.')) {
      const settingField = field.replace('settings.', '');
      setFormData(prev => ({
        ...prev,
        settings: {
          ...prev.settings,
          [settingField]: value,
        },
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [field]: value,
      }));
    }
    setSuccess(false);
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      setSuccess(false);

      await execute({
        method: 'PUT',
        url: `/api/orgadmin/organisation/${formData.id}`,
        data: {
          displayName: formData.displayName,
          domain: formData.domain,
          currency: formData.currency,
          language: formData.language,
          settings: formData.settings,
        },
      });

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to save organisation details');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Organisation Details
      </Typography>
      <Typography variant="body2" color="textSecondary" paragraph>
        Manage your organisation's basic information and contact details
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 3 }}>
          Organisation details saved successfully
        </Alert>
      )}

      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            label="Organisation Name"
            value={formData.name}
            disabled
            helperText="Organisation name cannot be changed"
          />
        </Grid>

        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            label="Display Name"
            value={formData.displayName}
            onChange={(e) => handleChange('displayName', e.target.value)}
            required
          />
        </Grid>

        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            label="Domain"
            value={formData.domain}
            onChange={(e) => handleChange('domain', e.target.value)}
            placeholder="example.com"
          />
        </Grid>

        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            select
            label="Currency"
            value={formData.currency}
            onChange={(e) => handleChange('currency', e.target.value)}
          >
            {CURRENCIES.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </TextField>
        </Grid>

        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            select
            label="Language"
            value={formData.language}
            onChange={(e) => handleChange('language', e.target.value)}
          >
            {LANGUAGES.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </TextField>
        </Grid>

        <Grid item xs={12}>
          <Typography variant="subtitle1" gutterBottom sx={{ mt: 2 }}>
            Contact Information
          </Typography>
        </Grid>

        <Grid item xs={12}>
          <TextField
            fullWidth
            label="Address"
            value={formData.settings.address}
            onChange={(e) => handleChange('settings.address', e.target.value)}
            multiline
            rows={2}
          />
        </Grid>

        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            label="City"
            value={formData.settings.city}
            onChange={(e) => handleChange('settings.city', e.target.value)}
          />
        </Grid>

        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            label="Postcode"
            value={formData.settings.postcode}
            onChange={(e) => handleChange('settings.postcode', e.target.value)}
          />
        </Grid>

        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            label="Country"
            value={formData.settings.country}
            onChange={(e) => handleChange('settings.country', e.target.value)}
          />
        </Grid>

        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            label="Phone"
            value={formData.settings.phone}
            onChange={(e) => handleChange('settings.phone', e.target.value)}
            type="tel"
          />
        </Grid>

        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            label="Email"
            value={formData.settings.email}
            onChange={(e) => handleChange('settings.email', e.target.value)}
            type="email"
          />
        </Grid>

        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            label="Website"
            value={formData.settings.website}
            onChange={(e) => handleChange('settings.website', e.target.value)}
            type="url"
            placeholder="https://example.com"
          />
        </Grid>

        <Grid item xs={12}>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
            <Button
              variant="contained"
              color="primary"
              startIcon={<SaveIcon />}
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </Box>
        </Grid>
      </Grid>
    </Box>
  );
};

export default OrganisationDetailsTab;
