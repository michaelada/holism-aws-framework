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
import { useTranslation } from '@aws-web-framework/orgadmin-shell';
import { useOrganisation } from '../../context/OrganisationContext';
import { usePageHelp } from '@aws-web-framework/orgadmin-shell';

const InviteAdminUserPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { execute } = useApi();
  const { organisation } = useOrganisation();
  
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [availableRoles, setAvailableRoles] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Register page for contextual help
  usePageHelp('invite');

  useEffect(() => {
    loadAvailableRoles();
  }, []);

  const loadAvailableRoles = async () => {
    if (!organisation?.id) return;
    try {
      const response = await execute({
        method: 'GET',
        url: `/api/orgadmin/users/roles/${organisation.id}`,
      });
      setAvailableRoles((response || []).map((role: any) => ({ id: role.id, name: role.name })));
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

      const result = await execute({
        method: 'POST',
        url: `/api/orgadmin/users/admins/${organisation?.id}`,
        data: {
          email,
          firstName,
          lastName,
          roleIds: selectedRoles,
        },
        retryCount: 0,
        onError: (errorMsg) => setError(errorMsg),
      });

      if (!result) {
        // onError callback already set the error message
        return;
      }

      setSuccess(true);
      
      // Redirect after short delay
      setTimeout(() => {
        navigate('/users/admins');
      }, 2000);
    } catch (error: any) {
      console.error('Failed to invite admin user:', error);
      setError(error.response?.data?.error || 'Failed to invite admin user');
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
          sx={{ textDecoration: 'none', cursor: 'pointer' }}        >
          {t('users.title')}
        </Link>
        <Link
          component="button"
          variant="body1"
          onClick={() => navigate('/users/admins')}
          sx={{ textDecoration: 'none', cursor: 'pointer' }}        >
          {t('users.tabs.admins')}
        </Link>
        <Typography color="text.primary">{t('users.admins.invite')}</Typography>
      </Breadcrumbs>

      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <Button
          startIcon={<BackIcon />}
          onClick={handleCancel}
          sx={{ mr: 2 }}
        >
          {t('common.actions.back')}
        </Button>
        <Typography variant="h4">{t('users.admins.invite')}</Typography>
      </Box>

      {/* Success Message */}
      {success && (
        <Alert severity="success" sx={{ mb: 3 }}>{t('users.admins.inviteSuccess')}</Alert>
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
                  label={t('users.fields.emailAddress')}
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  fullWidth
                  required
                  autoFocus
                  helperText={t('users.admins.emailHelper')}
                  disabled={loading || success}
                />
              </Grid>
              
              <Grid item xs={12} sm={6}>
                <TextField
                  label={t('users.fields.firstName')}
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  fullWidth
                  required
                  disabled={loading || success}
                />
              </Grid>
              
              <Grid item xs={12} sm={6}>
                <TextField
                  label={t('users.fields.lastName')}
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  fullWidth
                  required
                  disabled={loading || success}
                />
              </Grid>

              <Grid item xs={12}>
                <FormControl fullWidth required>
                  <InputLabel id="invite-roles-label">{t('users.fields.roles')}</InputLabel>
                  <Select
                    labelId="invite-roles-label"
                    multiple
                    value={selectedRoles}
                    onChange={(e) => setSelectedRoles(e.target.value as string[])}
                    input={<OutlinedInput label={t('users.fields.roles')} />}
                    renderValue={(selected) => (
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                        {selected.map((roleId) => {
                          const role = availableRoles.find(r => r.id === roleId);
                          return <Chip key={roleId} label={role?.name || roleId} size="small" />;
                        })}
                      </Box>
                    )}
                    disabled={loading || success}
                  >
                    {availableRoles.map((role) => (
                      <MenuItem key={role.id} value={role.id}>
                        {role.name}
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
              {t('common.actions.cancel')}
            </Button>
            <Button
              type="submit"
              variant="contained"
              color="primary"
              disabled={loading || success}
              startIcon={<SendIcon />}
              size="large"
            >
              {loading ? t('users.actions.sendingInvitation') : t('users.actions.sendInvitation')}
            </Button>
          </Box>
        </Box>
      </Paper>
    </Box>
  );
};

export default InviteAdminUserPage;
