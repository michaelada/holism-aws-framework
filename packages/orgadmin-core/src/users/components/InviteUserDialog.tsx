/**
 * Invite User Dialog
 * 
 * Form for inviting admin users or creating account users
 * Supports both admin and account user types
 */

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  OutlinedInput,
  Chip,
  Box,
  Alert,
  Grid,
} from '@mui/material';
import { useApi } from '../../hooks/useApi';
import { useOrganisation } from '../../context/OrganisationContext';
import { useTranslation } from '@itsplainsailing/orgadmin-shell';

interface InviteUserDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  userType: 'admin' | 'account';
}

const InviteUserDialog: React.FC<InviteUserDialogProps> = ({
  open,
  onClose,
  onSuccess,
  userType,
}) => {
  const { t } = useTranslation();
  const { execute } = useApi();
  const { organisation } = useOrganisation();
  
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [availableRoles, setAvailableRoles] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isAdminUser = userType === 'admin';

  useEffect(() => {
    if (open && isAdminUser) {
      loadAvailableRoles();
    }
  }, [open, isAdminUser]);

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

  const handleSubmit = async () => {
    // Validation
    if (!email || !firstName || !lastName) {
      setError('Please fill in all required fields');
      return;
    }

    if (!email.includes('@')) {
      setError('Please enter a valid email address');
      return;
    }

    if (isAdminUser && selectedRoles.length === 0) {
      setError('Please select at least one role for the admin user');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      /*
       * Both creation endpoints take the organisation as a path segment —
       * `/admins/:organizationId` and `/accounts/:organizationId`. Without it
       * the POST matches no route and fails as a 404, which looks like a
       * missing feature rather than a malformed URL.
       */
      const endpoint = isAdminUser
        ? `/api/orgadmin/users/admins/${organisation?.id}`
        : `/api/orgadmin/users/accounts/${organisation?.id}`;

      const payload = isAdminUser
        ? { email, firstName, lastName, roles: selectedRoles }
        : { email, firstName, lastName, phone };

      await execute({
        method: 'POST',
        url: endpoint,
        data: payload,
      });

      // Reset form
      setEmail('');
      setFirstName('');
      setLastName('');
      setPhone('');
      setSelectedRoles([]);
      setError(null);

      onSuccess();
    } catch (error: any) {
      console.error('Failed to create user:', error);
      setError(error.response?.data?.message || 'Failed to create user');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setEmail('');
      setFirstName('');
      setLastName('');
      setPhone('');
      setSelectedRoles([]);
      setError(null);
      onClose();
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        {isAdminUser ? t('users.admins.invite') : t('users.accounts.create')}
      </DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        <Grid container spacing={2} sx={{ mt: 1 }}>
          <Grid item xs={12}>
            <TextField
              label={t('users.fields.email')}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              fullWidth
              required
              autoFocus
            />
          </Grid>
          
          <Grid item xs={12} sm={6}>
            <TextField
              label={t('users.fields.firstName')}
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              fullWidth
              required
            />
          </Grid>
          
          <Grid item xs={12} sm={6}>
            <TextField
              label={t('users.fields.lastName')}
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              fullWidth
              required
            />
          </Grid>

          {!isAdminUser && (
            <Grid item xs={12}>
              <TextField
                label={t('users.fields.phone')}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                fullWidth
              />
            </Grid>
          )}

          {isAdminUser && (
            <Grid item xs={12}>
              <FormControl fullWidth required>
                <InputLabel>{t('users.fields.roles')}</InputLabel>
                <Select
                  multiple
                  value={selectedRoles}
                  onChange={(e) => setSelectedRoles(e.target.value as string[])}
                  input={<OutlinedInput label={t('users.fields.roles')} />}
                  renderValue={(selected) => (
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {selected.map((value) => (
                        <Chip key={value} label={value} size="small" />
                      ))}
                    </Box>
                  )}
                >
                  {availableRoles.map((role) => (
                    <MenuItem key={role} value={role}>
                      {role}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
          )}
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={loading}>
          {t('common.actions.cancel')}
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          color="primary"
          disabled={loading}
        >
          {loading ? 'Creating...' : isAdminUser ? t('users.actions.sendInvitation') : t('users.actions.createUser')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default InviteUserDialog;
