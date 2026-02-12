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
  const { execute } = useApi();
  
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

      const endpoint = isAdminUser
        ? '/api/orgadmin/users/admins'
        : '/api/orgadmin/users/accounts';

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
        {isAdminUser ? 'Invite Admin User' : 'Create Account User'}
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
              label="Email"
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
              label="First Name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              fullWidth
              required
            />
          </Grid>
          
          <Grid item xs={12} sm={6}>
            <TextField
              label="Last Name"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              fullWidth
              required
            />
          </Grid>

          {!isAdminUser && (
            <Grid item xs={12}>
              <TextField
                label="Phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                fullWidth
              />
            </Grid>
          )}

          {isAdminUser && (
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
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          color="primary"
          disabled={loading}
        >
          {loading ? 'Creating...' : isAdminUser ? 'Send Invitation' : 'Create User'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default InviteUserDialog;
