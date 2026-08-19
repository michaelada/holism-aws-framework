/**
 * User Details Page
 * 
 * Shows user details and allows editing roles (for admin users)
 * Supports both admin and account user types
 */

import React, { useState, useEffect, useContext, useMemo } from 'react';
import { useTranslation } from '@aws-web-framework/orgadmin-shell';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  OutlinedInput,
  Select,
  TextField,
  Typography,
  Alert,
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  Save as SaveIcon,
  Delete as DeleteIcon,
  Block as DeactivateIcon,
  Send as ResendIcon,
} from '@mui/icons-material';
import { useApi, AuthTokenContext } from '../../hooks/useApi';
import { useOrganisation } from '../../context/OrganisationContext';
import { usePageHelp } from '@aws-web-framework/orgadmin-shell';

interface User {
  id: string;
  keycloakUserId?: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  roles?: string[];
  roleIds?: string[];
  status: 'active' | 'inactive';
  lastLogin?: string;
  createdAt: string;
}

const UserDetailsPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { type, id } = useParams<{ type: string; id: string }>();
  const { execute } = useApi();
  const { organisation } = useOrganisation();
  const getToken = useContext(AuthTokenContext);
  
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [availableRoles, setAvailableRoles] = useState<{ id: string; name: string }[]>([]);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deactivateDialogOpen, setDeactivateDialogOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resending, setResending] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);

  const isAdminUser = type === 'admins';

  // Determine if the user being viewed is the currently logged-in user
  const currentKeycloakUserId = useMemo(() => {
    try {
      const token = getToken?.();
      if (!token) return null;
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.sub as string;
    } catch {
      return null;
    }
  }, [getToken]);

  const isCurrentUser = Boolean(
    user?.keycloakUserId && currentKeycloakUserId && user.keycloakUserId === currentKeycloakUserId
  );

  // Register page for contextual help
  usePageHelp('detail');

  useEffect(() => {
    loadUser();
    if (isAdminUser) {
      loadAvailableRoles();
    }
  }, [id, type]);

  const loadUser = async () => {
    if (!organisation?.id) return;
    try {
      setLoading(true);
      const endpoint = isAdminUser
        ? `/api/orgadmin/users/admins/${organisation.id}`
        : `/api/orgadmin/users/accounts/${organisation.id}`;
      
      const response = await execute({
        method: 'GET',
        url: endpoint,
      });
      const users = response?.data || [];
      const found = users.find((u: any) => u.id === id);
      setUser(found || null);
      if (isAdminUser && found?.roleIds) {
        setSelectedRoles(found.roleIds);
      }
    } catch (error) {
      console.error('Failed to load user:', error);
      setError('Failed to load user details');
    } finally {
      setLoading(false);
    }
  };

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

  const handleSave = async () => {
    if (!user) return;

    try {
      setSaving(true);
      setError(null);
      
      if (isAdminUser) {
        // Update roles via dedicated endpoint
        await execute({
          method: 'POST',
          url: `/api/orgadmin/users/admins/${id}/roles`,
          data: { roleIds: selectedRoles },
        });
      } else {
        await execute({
          method: 'PUT',
          url: `/api/orgadmin/users/accounts/${id}`,
          data: { firstName: user.firstName, lastName: user.lastName, phone: user.phone },
        });
      }

      navigate(isAdminUser ? '/users/admins' : '/users/accounts');
    } catch (error) {
      console.error('Failed to save user:', error);
      setError('Failed to save user details');
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async () => {
    if (!user) return;

    try {
      const endpoint = isAdminUser
        ? `/api/orgadmin/users/admins/${id}`
        : `/api/orgadmin/users/accounts/${id}`;
      
      await execute({
        method: 'PUT',
        url: endpoint,
        data: { status: 'inactive' },
      });

      setDeactivateDialogOpen(false);
      navigate(isAdminUser ? '/users/admins' : '/users/accounts');
    } catch (error) {
      console.error('Failed to deactivate user:', error);
      setError('Failed to deactivate user');
    }
  };

  const handleDelete = async () => {
    if (!user) return;

    try {
      const endpoint = isAdminUser
        ? `/api/orgadmin/users/admins/${id}`
        : `/api/orgadmin/users/accounts/${id}`;
      
      await execute({
        method: 'DELETE',
        url: endpoint,
      });

      setDeleteDialogOpen(false);
      navigate(isAdminUser ? '/users/admins' : '/users/accounts');
    } catch (error) {
      console.error('Failed to delete user:', error);
      setError('Failed to delete user');
    }
  };

  const handleResendInvite = async () => {
    if (!user) return;
    try {
      setResending(true);
      setError(null);
      const result = await execute({
        method: 'POST',
        url: `/api/orgadmin/users/admins/${id}/resend-invite`,
        retryCount: 0,
        onError: (errorMsg) => setError(errorMsg),
      });
      if (result) {
        setResendSuccess(true);
        setTimeout(() => setResendSuccess(false), 4000);
      }
    } catch (err) {
      console.error('Failed to resend invite:', err);
      setError('Failed to resend invitation');
    } finally {
      setResending(false);
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography>{t('users.loading.details')}</Typography>
      </Box>
    );
  }

  if (!user) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography color="error">{t('users.details.notFound')}</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3,
        // Wraps rather than overflowing: a non-wrapping header row pushed
        // page actions past the right edge of a phone, with nothing on
        // screen to show the page had scrolled.
        flexWrap: 'wrap', gap: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Button
            startIcon={<BackIcon />}
            onClick={() => navigate(isAdminUser ? '/users/admins' : '/users/accounts')}
          >
            {t('common.actions.back')}
          </Button>
          <Typography variant="h4">
            {isAdminUser ? t('users.details.adminDetails') : t('users.details.accountDetails')}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          {isAdminUser && !user.lastLogin && (
            <Button
              variant="outlined"
              startIcon={<ResendIcon />}
              onClick={handleResendInvite}
              disabled={resending || isCurrentUser}
            >
              {resending ? t('users.actions.sending') : t('users.actions.resendInvite')}
            </Button>
          )}
          <Button
            variant="outlined"
            color="warning"
            startIcon={<DeactivateIcon />}
            onClick={() => setDeactivateDialogOpen(true)}
            disabled={user.status === 'inactive' || isCurrentUser}          >
            {t('users.details.deactivate')}
          </Button>
          <Button
            variant="outlined"
            color="error"
            startIcon={<DeleteIcon />}
            onClick={() => setDeleteDialogOpen(true)}
            disabled={isCurrentUser}
          >
            {t('common.actions.delete')}
          </Button>
          <Button
            variant="contained"
            color="primary"
            startIcon={<SaveIcon />}
            onClick={handleSave}
            disabled={saving}
          >
            {t('users.details.saveChanges')}
          </Button>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {resendSuccess && (
        <Alert severity="success" sx={{ mb: 3 }} onClose={() => setResendSuccess(false)}>{t('users.details.resendSuccess')}</Alert>
      )}

      {isCurrentUser && (
        <Alert severity="info" sx={{ mb: 3 }}>{t('users.details.cannotChangeOwn')}</Alert>
      )}

      <Grid container spacing={3}>
        <Grid item xs={12} md={8}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>{t('users.details.information')}</Typography>
              <Divider sx={{ mb: 2 }} />
              
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label={t('users.fields.firstName')}
                    value={user.firstName}
                    onChange={(e) => setUser({ ...user, firstName: e.target.value })}
                    fullWidth
                    disabled={isAdminUser}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label={t('users.fields.lastName')}
                    value={user.lastName}
                    onChange={(e) => setUser({ ...user, lastName: e.target.value })}
                    fullWidth
                    disabled={isAdminUser}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    label={t('users.fields.email')}
                    value={user.email}
                    fullWidth
                    disabled
                  />
                </Grid>
                {!isAdminUser && (
                  <Grid item xs={12}>
                    <TextField
                      label={t('users.fields.phone')}
                      value={user.phone || ''}
                      onChange={(e) => setUser({ ...user, phone: e.target.value })}
                      fullWidth
                    />
                  </Grid>
                )}
              </Grid>

              {isAdminUser && (
                <>
                  <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>{t('users.details.roleAssignment')}</Typography>
                  <Divider sx={{ mb: 2 }} />
                  
                  <FormControl fullWidth disabled={isCurrentUser}>
                    <InputLabel>{t('users.fields.roles')}</InputLabel>
                    <Select
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
                    >
                      {availableRoles.map((role) => (
                        <MenuItem key={role.id} value={role.id}>
                          {role.name}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </>
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>{t('users.fields.status')}</Typography>
              <Divider sx={{ mb: 2 }} />
              
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="textSecondary" gutterBottom>{t('users.details.currentStatus')}</Typography>
                <Chip
                  label={user.status}
                  color={user.status === 'active' ? 'success' : 'default'}
                />
              </Box>

              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="textSecondary" gutterBottom>{t('users.fields.lastLogin')}</Typography>
                <Typography variant="body1">
                  {formatDate(user.lastLogin)}
                </Typography>
              </Box>

              <Box>
                <Typography variant="body2" color="textSecondary" gutterBottom>{t('users.fields.created')}</Typography>
                <Typography variant="body1">
                  {formatDate(user.createdAt)}
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Deactivate Dialog */}
      <Dialog open={deactivateDialogOpen} onClose={() => setDeactivateDialogOpen(false)}>
        <DialogTitle>{t('users.details.deactivateUser')}</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to deactivate {user.firstName} {user.lastName}? 
            They will no longer be able to access the system.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeactivateDialogOpen(false)}>{t('common.actions.cancel')}</Button>
          <Button onClick={handleDeactivate} color="warning" variant="contained">{t('users.details.deactivate')}</Button>
        </DialogActions>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>{t('users.details.deleteUser')}</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to permanently delete {user.firstName} {user.lastName}? 
            This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>{t('common.actions.cancel')}</Button>
          <Button onClick={handleDelete} color="error" variant="contained">
            {t('common.actions.delete')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default UserDetailsPage;
