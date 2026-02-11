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
import { getCapabilities, createOrganizationType } from '../services/organizationApi';
import type { Capability, CreateOrganizationTypeDto } from '../types/organization.types';
import { useNotification } from '../context/NotificationContext';
import { CapabilitySelector } from '../components/CapabilitySelector';

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

export const CreateOrganizationTypePage: React.FC = () => {
  const navigate = useNavigate();
  const { showSuccess, showError } = useNotification();
  
  const [capabilities, setCapabilities] = useState<Capability[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  
  const [formData, setFormData] = useState<CreateOrganizationTypeDto>({
    name: '',
    displayName: '',
    description: '',
    currency: 'USD',
    language: 'en',
    defaultCapabilities: [],
  });

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      setSubmitting(true);
      await createOrganizationType(formData);
      showSuccess('Organisation type created successfully');
      navigate('/organization-types');
    } catch (error: any) {
      showError(error.response?.data?.error || 'Failed to create organisation type');
    } finally {
      setSubmitting(false);
    }
  };

  const handleChange = (field: keyof CreateOrganizationTypeDto, value: any) => {
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
