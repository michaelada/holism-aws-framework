import React, { useState, useEffect } from 'react';
import {
  Alert,
  AlertTitle,
  Box,
  Card,
  CardContent,
  Typography,
  Tabs,
  Tab,
  CircularProgress,
  Chip,
  Grid,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
} from '@mui/material';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowBack, Edit as EditIcon, Delete as DeleteIcon, Add as AddIcon } from '@mui/icons-material';
import {
  getOrganizationById,
  getOrganizationUsers,
  getOrganizationRoles,
  getCapabilities,
  updateOrganizationUser,
  updateOrganizationRole,
  deleteOrganizationUser,
  deleteOrganizationRole,
  assignRoleToUser,
  removeRoleFromUser,
} from '../services/organizationApi';
import type {
  Capability,
  Organization,
  OrganizationUser,
  OrganizationAdminRole,
  CreateOrganizationAdminUserDto,
  CreateOrganizationAdminRoleDto,
} from '../types/organization.types';
import { PageHeader } from '../components/PageHeader';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { useNotification } from '../context/NotificationContext';
import { CapabilityPermissionSelector } from '../components/CapabilityPermissionSelector';
import { RoleSelector } from '../components/RoleSelector';

export const OrganizationDetailsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { showSuccess, showError } = useNotification();
  
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [users, setUsers] = useState<OrganizationUser[]>([]);
  const [roles, setRoles] = useState<OrganizationAdminRole[]>([]);
  const [capabilities, setCapabilities] = useState<Capability[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [userToDelete, setUserToDelete] = useState<{ id: string; name: string } | null>(null);
  const [roleToDelete, setRoleToDelete] = useState<{ id: string; name: string } | null>(null);
  const [currentTab, setCurrentTab] = useState(0);
  const [userDialogOpen, setUserDialogOpen] = useState(false);
  const [roleDialogOpen, setRoleDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<OrganizationUser | null>(null);
  const [editingRole, setEditingRole] = useState<OrganizationAdminRole | null>(null);
  const [selectedUserRoles, setSelectedUserRoles] = useState<string[]>([]);
  
  const [userFormData, setUserFormData] = useState<CreateOrganizationAdminUserDto>({
    email: '',
    firstName: '',
    lastName: '',
    temporaryPassword: '',
  });
  
  const [roleFormData, setRoleFormData] = useState<CreateOrganizationAdminRoleDto>({
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
      setLoadFailed(false);
      const [orgData, usersData, rolesData, capsData] = await Promise.all([
        getOrganizationById(id),
        getOrganizationUsers(id, 'org-admin'),
        getOrganizationRoles(id),
        getCapabilities(),
      ]);
      setOrganization(orgData);
      setUsers(usersData);
      setRoles(rolesData);
      setCapabilities(capsData);
    } catch (error) {
      setLoadFailed(true);
      showError('Failed to load organisation details');
      console.error('Error loading organisation:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateUser = async () => {
    if (!id || !editingUser) return;

    try {
      // Update existing user
      await updateOrganizationUser(id, editingUser.id, {
        firstName: userFormData.firstName,
        lastName: userFormData.lastName,
        status: editingUser.status,
      });

      // Sync roles - remove old roles and add new ones
      const oldRoles = editingUser.roles || [];
      const rolesToRemove = oldRoles.filter((roleId) => !selectedUserRoles.includes(roleId));
      const rolesToAdd = selectedUserRoles.filter((roleId) => !oldRoles.includes(roleId));

      // Remove roles that are no longer assigned
      for (const roleId of rolesToRemove) {
        await removeRoleFromUser(id, editingUser.id, roleId);
      }

      // Add new roles
      for (const roleId of rolesToAdd) {
        await assignRoleToUser(id, editingUser.id, roleId);
      }

      showSuccess('User updated successfully');
      setUserDialogOpen(false);
      setEditingUser(null);
      setSelectedUserRoles([]);
      setUserFormData({
        email: '',
        firstName: '',
        lastName: '',
        temporaryPassword: '',
      });
      loadData();
    } catch (error: any) {
      showError(error.response?.data?.error || 'Failed to update user');
    }
  };

  const handleEditUser = (user: OrganizationUser) => {
    setEditingUser(user);
    setUserFormData({
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      temporaryPassword: '',
    });
    // Load user's current roles
    setSelectedUserRoles(user.roles || []);
    setUserDialogOpen(true);
  };

  const handleDeleteUser = async () => {
    if (!id || !userToDelete) return;
    const userId = userToDelete.id;
    setUserToDelete(null);

    try {
      await deleteOrganizationUser(id, userId);
      showSuccess('User deleted successfully');
      loadData();
    } catch (error: any) {
      showError(error.response?.data?.error || 'Failed to delete user');
    }
  };

  const handleUpdateRole = async () => {
    if (!id || !editingRole) return;

    try {
      // Update existing role
      await updateOrganizationRole(id, editingRole.id, {
        displayName: roleFormData.displayName,
        description: roleFormData.description,
        capabilityPermissions: roleFormData.capabilityPermissions,
      });
      showSuccess('Role updated successfully');
      setRoleDialogOpen(false);
      setEditingRole(null);
      setRoleFormData({
        name: '',
        displayName: '',
        description: '',
        capabilityPermissions: {},
      });
      loadData();
    } catch (error: any) {
      showError(error.response?.data?.error || 'Failed to update role');
    }
  };

  const handleEditRole = (role: OrganizationAdminRole) => {
    setEditingRole(role);
    setRoleFormData({
      name: role.name,
      displayName: role.displayName,
      description: role.description || '',
      capabilityPermissions: role.capabilityPermissions,
    });
    setRoleDialogOpen(true);
  };

  const handleDeleteRole = async () => {
    if (!id || !roleToDelete) return;
    const roleId = roleToDelete.id;
    setRoleToDelete(null);

    try {
      await deleteOrganizationRole(id, roleId);
      showSuccess('Role deleted successfully');
      loadData();
    } catch (error: any) {
      showError(error.response?.data?.error || 'Failed to delete role');
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
        <Typography variant="body2" color="text.secondary" sx={{ ml: 2 }}>
          Loading organisation…
        </Typography>
      </Box>
    );
  }

  // `loading || !organization` used to gate this spinner, so a 404 or a 500 —
  // which clears `loading` but leaves `organization` null — span forever. The
  // operator could not tell a slow network from a deleted organisation, and had
  // no way out but the browser's own back button.
  if (loadFailed || !organization) {
    return (
      <Box>
        <PageHeader title="Organisation" onBack={() => navigate('/organizations')} />
        <Alert
          severity="error"
          action={
            <Button color="inherit" size="small" onClick={loadData}>
              Try again
            </Button>
          }
        >
          <AlertTitle>This organisation could not be loaded</AlertTitle>
          It may have been deleted, or the server may be unreachable.
        </Alert>
      </Box>
    );
  }

  return (
    <Box>
      <Box display="flex" alignItems="center" gap={2} mb={3}>
        <IconButton onClick={() => navigate('/organizations')}>
          <ArrowBack />
        </IconButton>
        <Typography variant="h4">{organization.displayName}</Typography>
        <Chip
          label={organization.status}
          color={organization.status === 'active' ? 'success' : 'default'}
        />
      </Box>

      <Card>
        <Tabs value={currentTab} onChange={(_, newValue) => setCurrentTab(newValue)}>
          <Tab label="Overview" />
          <Tab label="Capabilities" />
          <Tab label={`Administrator Users (${users.length})`} />
          <Tab label={`Roles (${roles.length})`} />
        </Tabs>

        <CardContent>
          {/* Overview Tab */}
          {currentTab === 0 && (
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle2" color="textSecondary">
                  Name
                </Typography>
                <Typography variant="body1" gutterBottom>
                  {organization.name}
                </Typography>
              </Grid>
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle2" color="textSecondary">
                  Display Name
                </Typography>
                <Typography variant="body1" gutterBottom>
                  {organization.displayName}
                </Typography>
              </Grid>
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle2" color="textSecondary">
                  Domain
                </Typography>
                <Typography variant="body1" gutterBottom>
                  {organization.domain || 'Not set'}
                </Typography>
              </Grid>
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle2" color="textSecondary">
                  Contact Name
                </Typography>
                <Typography variant="body1" gutterBottom>
                  {organization.contactName || 'Not set'}
                </Typography>
              </Grid>
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle2" color="textSecondary">
                  Contact Email
                </Typography>
                <Typography variant="body1" gutterBottom>
                  {organization.contactEmail || 'Not set'}
                </Typography>
              </Grid>
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle2" color="textSecondary">
                  Contact Mobile
                </Typography>
                <Typography variant="body1" gutterBottom>
                  {organization.contactMobile || 'Not set'}
                </Typography>
              </Grid>
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle2" color="textSecondary">
                  Currency
                </Typography>
                <Typography variant="body1" gutterBottom>
                  {organization.currency}
                </Typography>
              </Grid>
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle2" color="textSecondary">
                  Language
                </Typography>
                <Typography variant="body1" gutterBottom>
                  {organization.language}
                </Typography>
              </Grid>
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle2" color="textSecondary">
                  Status
                </Typography>
                <Typography variant="body1" gutterBottom>
                  {organization.status}
                </Typography>
              </Grid>
              <Grid item xs={12}>
                <Typography variant="subtitle2" color="textSecondary">
                  Statistics
                </Typography>
                <Box display="flex" gap={2} mt={1}>
                  <Chip label={`${organization.adminUserCount || 0} Administrator Users`} />
                  <Chip label={`${organization.accountUserCount || 0} Account Users`} />
                  <Chip label={`${organization.enabledCapabilities.length} Capabilities`} />
                </Box>
              </Grid>
            </Grid>
          )}

          {/* Capabilities Tab */}
          {currentTab === 1 && (
            <Box>
              <Typography variant="h6" gutterBottom>
                Enabled Capabilities
              </Typography>
              <Box display="flex" flexWrap="wrap" gap={1}>
                {organization.enabledCapabilities.map((cap) => (
                  <Chip key={cap} label={cap} color="primary" />
                ))}
              </Box>
            </Box>
          )}

          {/* Admin Users Tab */}
          {currentTab === 2 && (
            <Box>
              <Box display="flex" justifyContent="space-between" mb={2}>
                <Typography variant="h6">Administrator Users</Typography>
                <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={() => navigate(`/organizations/${id}/users/add`)}
                >
                  Add Administrator User
                </Button>
              </Box>
              <TableContainer component={Paper} elevation={0}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Name</TableCell>
                      <TableCell>Email</TableCell>
                      <TableCell>Roles</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Last Login</TableCell>
                      <TableCell align="right">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {users.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} align="center">
                          <Typography variant="body2" color="textSecondary">
                            No administrator users found.
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ) : (
                      users.map((user) => (
                        <TableRow key={user.id}>
                          <TableCell>
                            {user.firstName} {user.lastName}
                          </TableCell>
                          <TableCell>{user.email}</TableCell>
                          <TableCell>
                            {user.roles && user.roles.length > 0 ? (
                              <Box display="flex" flexWrap="wrap" gap={0.5}>
                                {user.roles.map((roleId) => {
                                  const role = roles.find((r) => r.id === roleId);
                                  return (
                                    <Chip
                                      key={roleId}
                                      label={role?.displayName || roleId}
                                      size="small"
                                      variant="outlined"
                                    />
                                  );
                                })}
                              </Box>
                            ) : (
                              <Typography variant="body2" color="textSecondary">
                                No roles
                              </Typography>
                            )}
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={user.status}
                              color={user.status === 'active' ? 'success' : 'default'}
                              size="small"
                            />
                          </TableCell>
                          <TableCell>
                            {user.lastLogin
                              ? new Date(user.lastLogin).toLocaleDateString()
                              : 'Never'}
                          </TableCell>
                          <TableCell align="right">
                            <IconButton 
                              size="small" 
                              aria-label={`Edit ${user.firstName} ${user.lastName}`}
                              onClick={() => handleEditUser(user)}
                            >
                              <EditIcon />
                            </IconButton>
                            <IconButton 
                              size="small" 
                              color="error" 
                              aria-label={`Delete ${user.firstName} ${user.lastName}`}
                              onClick={() =>
                                setUserToDelete({
                                  id: user.id,
                                  name: `${user.firstName} ${user.lastName}`,
                                })
                              }
                            >
                              <DeleteIcon />
                            </IconButton>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          )}

          {/* Roles Tab */}
          {currentTab === 3 && (
            <Box>
              <Box display="flex" justifyContent="space-between" mb={2}>
                <Typography variant="h6">Roles</Typography>
                <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={() => navigate(`/organizations/${id}/roles/create`)}
                >
                  Create Role
                </Button>
              </Box>
              <TableContainer component={Paper} elevation={0}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Name</TableCell>
                      <TableCell>Description</TableCell>
                      <TableCell>Permissions</TableCell>
                      <TableCell>System Role</TableCell>
                      <TableCell align="right">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {roles.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} align="center">
                          <Typography variant="body2" color="textSecondary">
                            No roles found.
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ) : (
                      roles.map((role) => (
                        <TableRow key={role.id}>
                          <TableCell>
                            <Typography variant="body1" fontWeight="medium">
                              {role.displayName}
                            </Typography>
                            <Typography variant="caption" color="textSecondary">
                              {role.name}
                            </Typography>
                          </TableCell>
                          <TableCell>{role.description || '-'}</TableCell>
                          <TableCell>
                            {Object.keys(role.capabilityPermissions).length} capabilities
                          </TableCell>
                          <TableCell>
                            {role.isSystemRole ? (
                              <Chip label="System" size="small" color="primary" />
                            ) : (
                              <Chip label="Custom" size="small" />
                            )}
                          </TableCell>
                          <TableCell align="right">
                            {!role.isSystemRole && (
                              <>
                                <IconButton 
                                  size="small" 
                                  aria-label={`Edit role ${role.displayName}`}
                                  onClick={() => handleEditRole(role)}
                                >
                                  <EditIcon />
                                </IconButton>
                                <IconButton 
                                  size="small" 
                                  color="error" 
                                  aria-label={`Delete role ${role.displayName}`}
                                  onClick={() =>
                                    setRoleToDelete({ id: role.id, name: role.displayName })
                                  }
                                >
                                  <DeleteIcon />
                                </IconButton>
                              </>
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Edit User Dialog */}
      <Dialog open={userDialogOpen} onClose={() => {
        setUserDialogOpen(false);
        setEditingUser(null);
        setSelectedUserRoles([]);
        setUserFormData({
          email: '',
          firstName: '',
          lastName: '',
          temporaryPassword: '',
        });
      }} maxWidth="sm" fullWidth>
        <DialogTitle>Edit Administrator User</DialogTitle>
        <DialogContent>
          <Box display="flex" flexDirection="column" gap={2} mt={1}>
            <TextField
              label="Email"
              type="email"
              value={userFormData.email}
              onChange={(e) => setUserFormData({ ...userFormData, email: e.target.value })}
              disabled={!!editingUser}
              fullWidth
              helperText={editingUser ? 'Email cannot be changed' : ''}
            />
            <TextField
              label="First Name"
              value={userFormData.firstName}
              onChange={(e) => setUserFormData({ ...userFormData, firstName: e.target.value })}
              fullWidth
            />
            <TextField
              label="Last Name"
              value={userFormData.lastName}
              onChange={(e) => setUserFormData({ ...userFormData, lastName: e.target.value })}
              fullWidth
            />
            <RoleSelector
              roles={roles}
              selectedRoleIds={selectedUserRoles}
              onChange={setSelectedUserRoles}
              multiple={true}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setUserDialogOpen(false);
            setEditingUser(null);
            setSelectedUserRoles([]);
            setUserFormData({
              email: '',
              firstName: '',
              lastName: '',
              temporaryPassword: '',
            });
          }}>Cancel</Button>
          <Button
            onClick={handleUpdateUser}
            variant="contained"
            disabled={
              !userFormData.email ||
              !userFormData.firstName ||
              !userFormData.lastName
            }
          >
            Update User
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Role Dialog */}
      <Dialog open={roleDialogOpen} onClose={() => {
        setRoleDialogOpen(false);
        setEditingRole(null);
        setRoleFormData({
          name: '',
          displayName: '',
          description: '',
          capabilityPermissions: {},
        });
      }} maxWidth="md" fullWidth>
        <DialogTitle>Edit Role</DialogTitle>
        <DialogContent>
          <Box display="flex" flexDirection="column" gap={3} mt={1}>
            <TextField
              label="Name (URL-friendly)"
              value={roleFormData.name}
              onChange={(e) => setRoleFormData({ ...roleFormData, name: e.target.value })}
              placeholder="e.g., event-manager"
              disabled
              fullWidth
              helperText="Role name cannot be changed"
            />
            <TextField
              label="Display Name"
              value={roleFormData.displayName}
              onChange={(e) => setRoleFormData({ ...roleFormData, displayName: e.target.value })}
              placeholder="e.g., Event Manager"
              fullWidth
            />
            <TextField
              label="Description"
              value={roleFormData.description}
              onChange={(e) => setRoleFormData({ ...roleFormData, description: e.target.value })}
              multiline
              rows={3}
              fullWidth
            />
            <CapabilityPermissionSelector
              capabilities={capabilities}
              selectedPermissions={roleFormData.capabilityPermissions}
              onChange={(permissions) =>
                setRoleFormData({ ...roleFormData, capabilityPermissions: permissions })
              }
              availableCapabilities={organization?.enabledCapabilities}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setRoleDialogOpen(false);
            setEditingRole(null);
            setRoleFormData({
              name: '',
              displayName: '',
              description: '',
              capabilityPermissions: {},
            });
          }}>Cancel</Button>
          <Button
            onClick={handleUpdateRole}
            variant="contained"
            disabled={!roleFormData.name || !roleFormData.displayName}
          >
            Update Role
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        open={Boolean(userToDelete)}
        title="Remove this administrator?"
        severity="error"
        confirmLabel="Remove administrator"
        message={
          <>
            <strong>{userToDelete?.name}</strong> will lose access to {organization.displayName}.
          </>
        }
        consequences="Their roles here are removed with them. Anything they created — events, forms, members — stays with the organisation."
        onConfirm={handleDeleteUser}
        onCancel={() => setUserToDelete(null)}
      />

      <ConfirmDialog
        open={Boolean(roleToDelete)}
        title="Delete this role?"
        severity="error"
        confirmLabel="Delete role"
        message={
          <>
            <strong>{roleToDelete?.name}</strong> will be removed from {organization.displayName}.
          </>
        }
        consequences={(() => {
          const affected = users.filter((u) =>
            (u.roles || []).some((r: { id?: string } | string) =>
              typeof r === 'string' ? r === roleToDelete?.id : r.id === roleToDelete?.id
            )
          ).length;
          return affected > 0 ? (
            <>
              {affected} administrator{affected === 1 ? '' : 's'} currently hold
              {affected === 1 ? 's' : ''} this role and will lose the permissions it grants.
            </>
          ) : (
            'No administrators currently hold this role.'
          );
        })()}
        onConfirm={handleDeleteRole}
        onCancel={() => setRoleToDelete(null)}
      />
    </Box>
  );
};
