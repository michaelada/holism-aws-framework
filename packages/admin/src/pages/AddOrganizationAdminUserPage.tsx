/**
 * Add Organization Admin User Page
 * 
 * Dedicated page for adding administrator users to an organization
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
  PersonAdd as AddIcon,
} from '@mui/icons-material';
import {
  getOrganizationById,
  getOrganizationRoles,
  createOrganizationAdminUser,
  assignRoleToUser,
} from '../services/organizationApi';
import type {
  Organization,
  OrganizationAdminRole,
  CreateOrganizationAdminUserDto,
} from '../types/organization.types';
import { useNotification } from '../context/NotificationContext';
import { RoleSelector } from '../components/RoleSelector';

export const AddOrganizationAdminUserPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { showSuccess, showError } = useNotification();
  
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [roles, setRoles] = useState<OrganizationAdminRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>([]);
  
  const [formData, setFormData] = useState<CreateOrganizationAdminUserDto>({
    email: '',
    firstName: '',
    lastName: '',
    temporaryPassword: '',
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
      const [orgData, rolesData] = await Promise.all([
        getOrganizationById(id),
        getOrganizationRoles(id),
      ]);
      
      setOrganization(orgData);
      setRoles(rolesData);
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
    if (!formData.email || !formData.firstName || !formData.lastName || !formData.temporaryPassword) {
      setError('Please fill in all required fields');
      return;
    }

    if (!formData.email.includes('@')) {
      setError('Please enter a valid email address');
      return;
    }

    if (formData.temporaryPassword.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      // Create user
      const newUser = await createOrganizationAdminUser(id, formData);
      
      // Assign roles to new user
      if (selectedRoleIds.length > 0) {
        await Promise.all(
          selectedRoleIds.map(roleId => assignRoleToUser(id, newUser.id, roleId))
        );
      }

      showSuccess('Administrator user added successfully');
      
      // Redirect back to organization details
      navigate(`/organizations/${id}`);
    } catch (error: any) {
      console.error('Failed to create user:', error);
      setError(error.response?.data?.message || 'Failed to create administrator user');
      showError('Failed to create administrator user');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = () => {
    navigate(`/organizations/${id}`);
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
        <Typography color="text.primary">Add Administrator User</Typography>
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
        <Typography variant="h4">Add Administrator User</Typography>
      </Box>

      {/* Error Message */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Form */}
      <Paper sx={{ maxWidth: 800 }}>
        <Box component="form" onSubmit={handleSubmit} noValidate>
          <CardContent sx={{ p: 3 }}>
            <Typography variant="body2" color="textSecondary" paragraph>
              Create a new administrator user for <strong>{organization.displayName}</strong>.
              The user will receive their credentials and be required to change their password on first login.
            </Typography>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <TextField
                label="Email Address"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                fullWidth
                required
                autoFocus
                disabled={submitting}
                helperText="The user's login email address"
              />
              
              <TextField
                label="First Name"
                value={formData.firstName}
                onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                fullWidth
                required
                disabled={submitting}
              />
              
              <TextField
                label="Last Name"
                value={formData.lastName}
                onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                fullWidth
                required
                disabled={submitting}
              />

              <TextField
                label="Temporary Password"
                type="password"
                value={formData.temporaryPassword}
                onChange={(e) => setFormData({ ...formData, temporaryPassword: e.target.value })}
                fullWidth
                required
                disabled={submitting}
                helperText="User will be required to change this password on first login (minimum 8 characters)"
              />

              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  Roles
                </Typography>
                <RoleSelector
                  roles={roles}
                  selectedRoleIds={selectedRoleIds}
                  onChange={setSelectedRoleIds}
                  multiple={true}
                />
                <Typography variant="caption" color="textSecondary" sx={{ mt: 1, display: 'block' }}>
                  Select one or more roles to assign to this user
                </Typography>
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
              {submitting ? 'Creating User...' : 'Create User'}
            </Button>
          </Box>
        </Box>
      </Paper>
    </Box>
  );
};
