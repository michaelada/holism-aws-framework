/**
 * Create Organization Role Page
 * 
 * Dedicated page for creating roles for an organization with bulk capability assignment
 */

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  CardContent,
  TextField,
  Typography,
  Alert,
  Paper,
  Breadcrumbs,
  Link,
  CircularProgress,
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  Add as AddIcon,
} from '@mui/icons-material';
import {
  getOrganizationById,
  getCapabilities,
  createOrganizationRole,
} from '../services/organizationApi';
import type {
  Organization,
  Capability,
  CreateOrganizationAdminRoleDto,
} from '../types/organization.types';
import { useNotification } from '../context/NotificationContext';
import { BulkCapabilityPermissionSelector } from '../components/BulkCapabilityPermissionSelector';

export const CreateOrganizationRolePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { showSuccess, showError } = useNotification();
  
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [capabilities, setCapabilities] = useState<Capability[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [formData, setFormData] = useState<CreateOrganizationAdminRoleDto>({
    name: '',
    displayName: '',
    description: '',
    capabilityPermissions: {},
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
      const [orgData, capsData] = await Promise.all([
        getOrganizationById(id),
        getCapabilities(),
      ]);
      
      setOrganization(orgData);
      setCapabilities(capsData);
    } catch (error) {
      console.error('Failed to load data:', error);
      showError('Failed to load organization data');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!id) return;

    // Validation
    if (!formData.name || !formData.displayName) {
      setError('Please fill in all required fields');
      return;
    }

    // Validate name format (URL-friendly)
    if (!/^[a-z0-9-]+$/.test(formData.name)) {
      setError('Role name must be lowercase letters, numbers, and hyphens only');
      return;
    }

    if (Object.keys(formData.capabilityPermissions).length === 0) {
      setError('Please configure at least one capability permission');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      await createOrganizationRole(id, formData);

      showSuccess('Role created successfully');
      
      // Redirect back to organization details
      navigate(`/organizations/${id}`);
    } catch (error: any) {
      console.error('Failed to create role:', error);
      setError(error.response?.data?.message || 'Failed to create role');
      showError('Failed to create role');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = () => {
    navigate(`/organizations/${id}`);
  };

  const handleNameChange = (displayName: string) => {
    // Auto-generate URL-friendly name from display name
    const urlFriendlyName = displayName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    
    setFormData({
      ...formData,
      displayName,
      name: urlFriendlyName,
    });
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!organization) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">Organization not found</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Breadcrumbs */}
      <Breadcrumbs sx={{ mb: 2 }}>
        <Link
          component="button"
          variant="body1"
          onClick={() => navigate('/organizations')}
          sx={{ textDecoration: 'none', cursor: 'pointer' }}
        >
          Organizations
        </Link>
        <Link
          component="button"
          variant="body1"
          onClick={() => navigate(`/organizations/${id}`)}
          sx={{ textDecoration: 'none', cursor: 'pointer' }}
        >
          {organization.displayName}
        </Link>
        <Typography color="text.primary">Create Role</Typography>
      </Breadcrumbs>

      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <Button
          startIcon={<BackIcon />}
          onClick={handleCancel}
          sx={{ mr: 2 }}
        >
          Back
        </Button>
        <Typography variant="h4">Create Role</Typography>
      </Box>

      {/* Error Message */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Form */}
      <Paper sx={{ maxWidth: 1200 }}>
        <Box component="form" onSubmit={handleSubmit} noValidate>
          <CardContent sx={{ p: 3 }}>
            <Typography variant="body2" color="textSecondary" paragraph>
              Create a new role for <strong>{organization.displayName}</strong> and configure
              which capabilities this role can access and at what permission level.
            </Typography>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <TextField
                label="Display Name"
                value={formData.displayName}
                onChange={(e) => handleNameChange(e.target.value)}
                fullWidth
                required
                autoFocus
                disabled={submitting}
                placeholder="e.g., Event Manager"
                helperText="A friendly name for this role"
              />
              
              <TextField
                label="Role Name (URL-friendly)"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                fullWidth
                required
                disabled={submitting}
                placeholder="e.g., event-manager"
                helperText="Lowercase letters, numbers, and hyphens only. Auto-generated from display name."
              />
              
              <TextField
                label="Description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                fullWidth
                multiline
                rows={3}
                disabled={submitting}
                placeholder="Describe what this role is for and what permissions it should have"
              />

              <Box sx={{ mt: 2 }}>
                <BulkCapabilityPermissionSelector
                  capabilities={capabilities}
                  selectedPermissions={formData.capabilityPermissions}
                  onChange={(permissions) =>
                    setFormData({ ...formData, capabilityPermissions: permissions })
                  }
                  availableCapabilities={organization.enabledCapabilities}
                />
              </Box>
            </Box>
          </CardContent>

          {/* Actions */}
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: 2,
              p: 3,
              borderTop: 1,
              borderColor: 'divider',
            }}
          >
            <Button
              onClick={handleCancel}
              disabled={submitting}
              size="large"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="contained"
              color="primary"
              disabled={submitting}
              startIcon={<AddIcon />}
              size="large"
            >
              {submitting ? 'Creating Role...' : 'Create Role'}
            </Button>
          </Box>
        </Box>
      </Paper>
    </Box>
  );
};
