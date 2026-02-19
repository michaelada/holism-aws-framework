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
  getPaymentMethods,
  updateOrganization,
} from '../services/organizationApi';
import type {
  Organization,
  OrganizationType,
  Capability,
  UpdateOrganizationDto,
} from '../types/organization.types';
import type { PaymentMethod } from '../types/payment-method.types';
import { useNotification } from '../context/NotificationContext';
import { CapabilitySelector } from '../components/CapabilitySelector';
import { PaymentMethodSelector } from '../components/PaymentMethodSelector';

const STATUSES = ['active', 'inactive', 'blocked'];

export const EditOrganizationPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { showSuccess, showError } = useNotification();

  const [organization, setOrganization] = useState<Organization | null>(null);
  const [organizationTypes, setOrganizationTypes] = useState<OrganizationType[]>([]);
  const [capabilities, setCapabilities] = useState<Capability[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState<UpdateOrganizationDto & { name?: string }>({
    name: '',
    displayName: '',
    domain: '',
    contactName: '',
    contactEmail: '',
    contactMobile: '',
    status: 'active',
    enabledCapabilities: [],
    enabledPaymentMethods: [],
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
      const [orgData, typesData, capsData, paymentMethodsData] = await Promise.all([
        getOrganizationById(id),
        getOrganizationTypes(),
        getCapabilities(),
        getPaymentMethods(),
      ]);
      setOrganization(orgData);
      setOrganizationTypes(typesData);
      setCapabilities(capsData);
      setPaymentMethods(paymentMethodsData);
      
      // Extract payment method names from organization's payment methods
      const selectedPaymentMethodNames = orgData.paymentMethods
        ? orgData.paymentMethods.map((pm: any) => pm.paymentMethod?.name || pm.name).filter(Boolean)
        : [];
      
      setFormData({
        name: orgData.name,
        displayName: orgData.displayName,
        domain: orgData.domain || '',
        contactName: orgData.contactName || '',
        contactEmail: orgData.contactEmail || '',
        contactMobile: orgData.contactMobile || '',
        status: orgData.status,
        enabledCapabilities: orgData.enabledCapabilities,
        enabledPaymentMethods: selectedPaymentMethodNames,
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

  const handleChange = (field: string, value: any) => {
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
                value={formData.name}
                onChange={(e) => handleChange('name', e.target.value)}
                placeholder="e.g., my-org"
                helperText="Lowercase, no spaces, hyphens allowed"
                required
                fullWidth
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
                  selectedCapabilities={formData.enabledCapabilities || []}
                  onChange={(selected) => handleChange('enabledCapabilities', selected)}
                  defaultCapabilities={orgType?.defaultCapabilities}
                />
              </Box>

              <Box>
                <Typography variant="h6" gutterBottom>
                  Payment Methods
                </Typography>
                <Typography variant="body2" color="textSecondary" gutterBottom>
                  Select which payment methods this organisation should have access to.
                </Typography>
                <PaymentMethodSelector
                  paymentMethods={paymentMethods}
                  selectedPaymentMethods={formData.enabledPaymentMethods || []}
                  onChange={(selected) => handleChange('enabledPaymentMethods', selected)}
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
                  disabled={submitting}
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
