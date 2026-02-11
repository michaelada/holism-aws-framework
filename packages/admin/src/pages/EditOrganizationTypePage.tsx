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
import { useNavigate, useParams } from 'react-router-dom';
import {
  getCapabilities,
  getOrganizationTypeById,
  updateOrganizationType,
} from '../services/organizationApi';
import type { Capability, UpdateOrganizationTypeDto } from '../types/organization.types';
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

export const EditOrganizationTypePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { showSuccess, showError } = useNotification();
  
  const [capabilities, setCapabilities] = useState<Capability[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  
  const [formData, setFormData] = useState<UpdateOrganizationTypeDto>({
    displayName: '',
    description: '',
    currency: 'USD',
    language: 'en',
    defaultCapabilities: [],
  });

  useEffect(() => {
    if (id) {
      loadData();
    }
  }, [id]);

  const loadData = async () => {
    if (!id) return;

    try {
      setLoading(true);
      const [capsData, typeData] = await Promise.all([
        getCapabilities(),
        getOrganizationTypeById(id),
      ]);
      setCapabilities(capsData);
      setFormData({
        displayName: typeData.displayName,
        description: typeData.description,
        currency: typeData.currency,
        language: typeData.language,
        defaultCapabilities: typeData.defaultCapabilities,
      });
    } catch (error) {
      showError('Failed to load organisation type');
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    
    try {
      setSubmitting(true);
      await updateOrganizationType(id, formData);
      showSuccess('Organisation type updated successfully');
      navigate('/organization-types');
    } catch (error: any) {
      showError(error.response?.data?.error || 'Failed to update organisation type');
    } finally {
      setSubmitting(false);
    }
  };

  const handleChange = (field: keyof UpdateOrganizationTypeDto, value: any) => {
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
        <Typography variant="h4">Edit Organisation Type</Typography>
      </Box>

      <Card>
        <CardContent>
          <form onSubmit={handleSubmit}>
            <Box display="flex" flexDirection="column" gap={3}>
              <TextField
                label="Display Name"
                value={formData.displayName}
                onChange={(e) => handleChange('displayName', e.target.value)}
                required
                fullWidth
              />

              <TextField
                label="Description"
                value={formData.description}
                onChange={(e) => handleChange('description', e.target.value)}
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
                  selectedCapabilities={formData.defaultCapabilities || []}
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
                    !formData.displayName ||
                    !formData.defaultCapabilities ||
                    formData.defaultCapabilities.length === 0
                  }
                >
                  {submitting ? <CircularProgress size={24} /> : 'Update Organisation Type'}
                </Button>
              </Box>
            </Box>
          </form>
        </CardContent>
      </Card>
    </Box>
  );
};
