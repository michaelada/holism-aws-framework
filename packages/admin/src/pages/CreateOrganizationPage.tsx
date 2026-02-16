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
} from '../services/organizationApi';
import type {
  OrganizationType,
  Capability,
  CreateOrganizationDto,
} from '../types/organization.types';
import { useNotification } from '../context/NotificationContext';
import { CapabilitySelector } from '../components/CapabilitySelector';

export const CreateOrganizationPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { showSuccess, showError } = useNotification();

  const [organizationTypes, setOrganizationTypes] = useState<OrganizationType[]>([]);
  const [capabilities, setCapabilities] = useState<Capability[]>([]);
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
    enabledCapabilities: [],
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
      const [typesData, capsData] = await Promise.all([
        getOrganizationTypes(),
        getCapabilities(),
      ]);
      setOrganizationTypes(typesData);
      setCapabilities(capsData);
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
                  label="Name"
                  value={formData.name}
                  onChange={(e) => handleChange('name', e.target.value)}
                  helperText="Internal name (lowercase, no spaces, e.g., 'my-org')"
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
