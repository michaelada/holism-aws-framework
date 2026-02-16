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
  FormControl,
  InputLabel,
  Select,
} from '@mui/material';
import { ArrowBack } from '@mui/icons-material';
import { useNavigate, useParams } from 'react-router-dom';
import {
  getOrganizationById,
  getOrganizationTypes,
  getCapabilities,
  updateOrganization,
} from '../services/organizationApi';
import type {
  Organization,
  OrganizationType,
  Capability,
  UpdateOrganizationDto,
} from '../types/organization.types';
import { useNotification } from '../context/NotificationContext';
import { CapabilitySelector } from '../components/CapabilitySelector';

const STATUSES = ['active', 'inactive', 'blocked'];

export const EditOrganizationPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { showSuccess, showError } = useNotification();

  const [organization, setOrganization] = useState<Organization | null>(null);
  const [organizationTypes, setOrganizationTypes] = useState<OrganizationType[]>([]);
  const [capabilities, setCapabilities] = useState<Capability[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState<UpdateOrganizationDto>({
    displayName: '',
    domain: '',
    contactName: '',
    contactEmail: '',
    contactMobile: '',
    status: 'active',
    enabledCapabilities: [],
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
      const [orgData, typesData, capsData] = await Promise.all([
        getOrganizationById(id),
        getOrganizationTypes(),
        getCapabilities(),
      ]);
      setOrganization(orgData);
      setOrganizationTypes(typesData);
      setCapabilities(capsData);
      setFormData({
        displayName: orgData.displayName,
        domain: orgData.domain || '',
        contactName: orgData.contactName || '',
        contactEmail: orgData.contactEmail || '',
        contactMobile: orgData.contactMobile || '',
        status: orgData.status,
        enabledCapabilities: orgData.enabledCapabilities,
      });
    } catch (error) {
      showError('Failed to load organisation');
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
      await updateOrganization(id, formData);
      showSuccess('Organisation updated successfully');
      navigate('/organizations');
    } catch (error: any) {
      showError(error.response?.data?.error || 'Failed to update organisation');
    } finally {
      setSubmitting(false);
    }
  };

  const handleChange = (field: keyof UpdateOrganizationDto, value: any) => {
    setFormData({ ...formData, [field]: value });
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  if (!organization) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <Typography>Organisation not found</Typography>
      </Box>
    );
  }

  const orgType = organizationTypes.find((t) => t.id === organization.organizationTypeId);

  return (
    <Box>
      <Box display="flex" alignItems="center" gap={2} mb={3}>
        <IconButton onClick={() => navigate('/organizations')}>
          <ArrowBack />
        </IconButton>
        <Typography variant="h4">Edit Organisation</Typography>
      </Box>

      <Card>
        <CardContent>
          <form onSubmit={handleSubmit}>
            <Box display="flex" flexDirection="column" gap={3}>
              <TextField
                label="Name (URL-friendly)"
                value={organization.name}
                disabled
                fullWidth
                helperText="Organisation name cannot be changed"
              />

              <TextField
                label="Display Name"
                value={formData.displayName}
                onChange={(e) => handleChange('displayName', e.target.value)}
                required
                fullWidth
              />

              <TextField
                label="Organisation Type"
                value={orgType?.displayName || 'Unknown'}
                disabled
                fullWidth
                helperText="Organisation type cannot be changed"
              />

              <TextField
                label="Domain (optional)"
                value={formData.domain}
                onChange={(e) => handleChange('domain', e.target.value)}
                placeholder="e.g., riverside-swim.example.com"
                fullWidth
              />

              <TextField
                label="Contact Name"
                value={formData.contactName}
                onChange={(e) => handleChange('contactName', e.target.value)}
                placeholder="Primary contact person"
                fullWidth
              />

              <TextField
                label="Contact Email"
                type="email"
                value={formData.contactEmail}
                onChange={(e) => handleChange('contactEmail', e.target.value)}
                placeholder="contact@example.com"
                fullWidth
              />

              <TextField
                label="Contact Mobile Number"
                value={formData.contactMobile}
                onChange={(e) => handleChange('contactMobile', e.target.value)}
                placeholder="+44 7700 900000"
                fullWidth
              />

              <FormControl fullWidth>
                <InputLabel>Status</InputLabel>
                <Select
                  value={formData.status}
                  label="Status"
                  onChange={(e) => handleChange('status', e.target.value)}
                >
                  {STATUSES.map((status) => (
                    <MenuItem key={status} value={status}>
                      {status.charAt(0).toUpperCase() + status.slice(1)}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <Box>
                <Typography variant="h6" gutterBottom>
                  Enabled Capabilities
                </Typography>
                <Typography variant="body2" color="textSecondary" gutterBottom>
                  Select the capabilities available for this organisation.
                </Typography>
                <CapabilitySelector
                  capabilities={capabilities}
                  selectedCapabilities={formData.enabledCapabilities}
                  onChange={(selected) => handleChange('enabledCapabilities', selected)}
                  defaultCapabilities={orgType?.defaultCapabilities}
                />
              </Box>

              <Box display="flex" gap={2} justifyContent="flex-end">
                <Button
                  variant="outlined"
                  onClick={() => navigate('/organizations')}
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
                    formData.enabledCapabilities.length === 0
                  }
                >
                  {submitting ? <CircularProgress size={24} /> : 'Update Organisation'}
                </Button>
              </Box>
            </Box>
          </form>
        </CardContent>
      </Card>
    </Box>
  );
};
