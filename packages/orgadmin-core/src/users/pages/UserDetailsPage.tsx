/**
 * User Details Page
 * 
 * Shows user details and allows editing roles (for admin users)
 * Supports both admin and account user types
 */

import React, { useState, useEffect } from 'react';
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
} from '@mui/icons-material';
import { useApi } from '../../hooks/useApi';
import { usePageHelp } from '@aws-web-framework/orgadmin-shell';

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  roles?: string[];
  status: 'active' | 'inactive';
  lastLogin?: string;
  createdAt: string;
}

const UserDetailsPage: React.FC = () => {
  const navigate = useNavigate();
  const { type, id } = useParams<{ type: string; id: string }>();
  const { execute } = useApi();
  
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [availableRoles, setAvailableRoles] = useState<string[]>([]);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deactivateDialogOpen, setDeactivateDialogOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isAdminUser = type === 'admins';

  // Register page for contextual help
  usePageHelp('detail');

  useEffect(() => {
    loadUser();
    if (isAdminUser) {
      loadAvailableRoles();
    }
  }, [id, type]);

  const loadUser = async () => {
    try {
      setLoading(true);
      const endpoint = isAdminUser
        ? `/api/orgadmin/users/admins/${id}`
        : `/api/orgadmin/users/accounts/${id}`;
      
      const response = await execute({
        method: 'GET',
        url: endpoint,
      });
      setUser(response);
      if (isAdminUser && response.roles) {
        setSelectedRoles(response.roles);
      }
    } catch (error) {
      console.error('Failed to load user:', error);
      setError('Failed to load user details');
    } finally {
      setLoading(false);
    }
  };

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

  const handleSave = async () => {
    if (!user) return;

    try {
      setSaving(true);
      setError(null);
      
      const endpoint = isAdminUser
        ? `/api/orgadmin/users/admins/${id}`
        : `/api/orgadmin/users/accounts/${id}`;
      
      const payload = isAdminUser
        ? { roles: selectedRoles }
        : { firstName: user.firstName, lastName: user.lastName, phone: user.phone };

      await execute({
        method: 'PUT',
        url: endpoint,
        data: payload,
      });

      navigate(isAdminUser ? '/orgadmin/users/admins' : '/orgadmin/users/accounts');
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
      navigate(isAdminUser ? '/orgadmin/users/admins' : '/orgadmin/users/accounts');
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
      navigate(isAdminUser ? '/orgadmin/users/admins' : '/orgadmin/users/accounts');
    } catch (error) {
      console.error('Failed to delete user:', error);
      setError('Failed to delete user');
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
        <Typography>Loading user details...</Typography>
      </Box>
    );
  }

  if (!user) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography color="error">User not found</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Button
            startIcon={<BackIcon />}
            onClick={() => navigate(isAdminUser ? '/orgadmin/users/admins' : '/orgadmin/users/accounts')}
          >
            Back
          </Button>
          <Typography variant="h4">
            {isAdminUser ? 'Admin User Details' : 'Account User Details'}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="outlined"
            color="warning"
            startIcon={<DeactivateIcon />}
            onClick={() => setDeactivateDialogOpen(true)}
            disabled={user.status === 'inactive'}
          >
            Deactivate
          </Button>
          <Button
            variant="outlined"
            color="error"
            startIcon={<DeleteIcon />}
            onClick={() => setDeleteDialogOpen(true)}
          >
            Delete
          </Button>
          <Button
            variant="contained"
            color="primary"
            startIcon={<SaveIcon />}
            onClick={handleSave}
            disabled={saving}
          >
            Save Changes
          </Button>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Grid container spacing={3}>
        <Grid item xs={12} md={8}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                User Information
              </Typography>
              <Divider sx={{ mb: 2 }} />
              
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="First Name"
                    value={user.firstName}
                    onChange={(e) => setUser({ ...user, firstName: e.target.value })}
                    fullWidth
                    disabled={isAdminUser}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="Last Name"
                    value={user.lastName}
                    onChange={(e) => setUser({ ...user, lastName: e.target.value })}
                    fullWidth
                    disabled={isAdminUser}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    label="Email"
                    value={user.email}
                    fullWidth
                    disabled
                  />
                </Grid>
                {!isAdminUser && (
                  <Grid item xs={12}>
                    <TextField
                      label="Phone"
                      value={user.phone || ''}
                      onChange={(e) => setUser({ ...user, phone: e.target.value })}
                      fullWidth
                    />
                  </Grid>
                )}
              </Grid>

              {isAdminUser && (
                <>
                  <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>
                    Role Assignment
                  </Typography>
                  <Divider sx={{ mb: 2 }} />
                  
                  <FormControl fullWidth>
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
                </>
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Status
              </Typography>
              <Divider sx={{ mb: 2 }} />
              
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="textSecondary" gutterBottom>
                  Current Status
                </Typography>
                <Chip
                  label={user.status}
                  color={user.status === 'active' ? 'success' : 'default'}
                />
              </Box>

              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="textSecondary" gutterBottom>
                  Last Login
                </Typography>
                <Typography variant="body1">
                  {formatDate(user.lastLogin)}
                </Typography>
              </Box>

              <Box>
                <Typography variant="body2" color="textSecondary" gutterBottom>
                  Created
                </Typography>
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
        <DialogTitle>Deactivate User</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to deactivate {user.firstName} {user.lastName}? 
            They will no longer be able to access the system.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeactivateDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleDeactivate} color="warning" variant="contained">
            Deactivate
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Delete User</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to permanently delete {user.firstName} {user.lastName}? 
            This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleDelete} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default UserDetailsPage;
