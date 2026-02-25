/**
 * Invite Admin User Page
 * 
 * Dedicated page for inviting admin users to the organization
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  CardContent,
  TextField,
  Typography,
  Alert,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  OutlinedInput,
  Chip,
  Paper,
  Breadcrumbs,
  Link,
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  Send as SendIcon,
} from '@mui/icons-material';
import { useApi } from '../../hooks/useApi';
import { usePageHelp } from '@aws-web-framework/orgadmin-shell';

const InviteAdminUserPage: React.FC = () => {
  const navigate = useNavigate();
  const { execute } = useApi();
  
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [availableRoles, setAvailableRoles] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Register page for contextual help
  usePageHelp('invite');

  useEffect(() => {
    loadAvailableRoles();
  }, []);

  const loadAvailableRoles = async () => {
    try {
      const response = await execute({
        method: 'GET',
        url: '/api/orgadmin/roles',
      });
      setAvailableRoles(response.map((role: any) => role.name) || []);
    } catch (error) {
      console.error('Failed to load roles:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation
    if (!email || !firstName || !lastName) {
      setError('Please fill in all required fields');
      return;
    }

    if (!email.includes('@')) {
      setError('Please enter a valid email address');
      return;
    }

    if (selectedRoles.length === 0) {
      setError('Please select at least one role for the admin user');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      await execute({
        method: 'POST',
        url: '/api/orgadmin/users/admins',
        data: {
          email,
          firstName,
          lastName,
          roles: selectedRoles,
        },
      });

      setSuccess(true);
      
      // Redirect after short delay
      setTimeout(() => {
        navigate('/users/admins');
      }, 2000);
    } catch (error: any) {
      console.error('Failed to invite admin user:', error);
      setError(error.response?.data?.message || 'Failed to invite admin user');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    navigate('/users/admins');
  };

  return (
    <Box sx={{ p: 3 }}>
      {/* Breadcrumbs */}
      <Breadcrumbs sx={{ mb: 2 }}>
        <Link
          component="button"
          variant="body1"
          onClick={() => navigate('/users/admins')}
          sx={{ textDecoration: 'none', cursor: 'pointer' }}
        >
          User Management
        </Link>
        <Link
          component="button"
          variant="body1"
          onClick={() => navigate('/users/admins')}
          sx={{ textDecoration: 'none', cursor: 'pointer' }}
        >
          Admin Users
        </Link>
        <Typography color="text.primary">Invite Admin User</Typography>
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
        <Typography variant="h4">Invite Admin User</Typography>
      </Box>

      {/* Success Message */}
      {success && (
        <Alert severity="success" sx={{ mb: 3 }}>
          Admin user invitation sent successfully! Redirecting...
        </Alert>
      )}

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
              Send an invitation email to a new admin user. They will receive an email with instructions
              to set up their account and access the organization admin portal.
            </Typography>

            <Grid container spacing={3}>
              <Grid item xs={12}>
                <TextField
                  label="Email Address"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  fullWidth
                  required
                  autoFocus
                  helperText="The invitation will be sent to this email address"
                  disabled={loading || success}
                />
              </Grid>
              
              <Grid item xs={12} sm={6}>
                <TextField
                  label="First Name"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  fullWidth
                  required
                  disabled={loading || success}
                />
              </Grid>
              
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Last Name"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  fullWidth
                  required
                  disabled={loading || success}
                />
              </Grid>

              <Grid item xs={12}>
                <FormControl fullWidth required>
                  <InputLabel>Roles</InputLabel>
                  <Select
                    multiple
                    value={selectedRoles}
                    onChange={(e) => setSelectedRoles(e.target.value as string[])}
                    input={<OutlinedInput label="Roles" />}
                    renderValue={(selected) => (
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                        {selected.map((value) => (
                          <Chip key={value} label={value} size="small" />
                        ))}
                      </Box>
                    )}
                    disabled={loading || success}
                  >
                    {availableRoles.map((role) => (
                      <MenuItem key={role} value={role}>
                        {role}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
            </Grid>
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
              disabled={loading || success}
              size="large"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="contained"
              color="primary"
              disabled={loading || success}
              startIcon={<SendIcon />}
              size="large"
            >
              {loading ? 'Sending Invitation...' : 'Send Invitation'}
            </Button>
          </Box>
        </Box>
      </Paper>
    </Box>
  );
};

export default InviteAdminUserPage;
