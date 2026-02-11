import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Box, Typography, Button, Paper, Tabs, Tab, CircularProgress } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { UserList } from '../components/UserList';
import { UserForm } from '../components/UserForm';
import { PasswordResetDialog } from '../components/PasswordResetDialog';
import { RetryDialog } from '../components/RetryDialog';
import { useApi } from '../context';
import { Tenant, User, CreateUserDto, UpdateUserDto, Role, ResetPasswordDto } from '../types/admin.types';
import { useApiCall } from '../hooks/useApiCall';

type ViewMode = 'list' | 'create' | 'edit';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`tenant-tabpanel-${index}`}
      aria-labelledby={`tenant-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

export function TenantDetailsPage() {
  const { tenantId } = useParams<{ tenantId: string }>();
  const navigate = useNavigate();
  const { api } = useApi();
  const executeApiCall = useApiCall();

  const [tabValue, setTabValue] = useState(0);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [resetPasswordUser, setResetPasswordUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [retryDialog, setRetryDialog] = useState<{
    open: boolean;
    message: string;
    onRetry: () => Promise<void>;
  }>({
    open: false,
    message: '',
    onRetry: async () => {},
  });

  const loadTenant = useCallback(async () => {
    if (!tenantId) return;

    setLoading(true);
    const result = await executeApiCall(
      () => api.getTenant(tenantId),
      {
        errorMessage: 'Failed to load tenant',
        showSuccess: false,
      }
    );
    setLoading(false);

    if (result.data) {
      setTenant(result.data);
    } else if (result.isNetworkError && result.retry) {
      setRetryDialog({
        open: true,
        message: 'Unable to load tenant. Please check your connection.',
        onRetry: async () => {
          setRetryDialog((prev) => ({ ...prev, open: false }));
          await loadTenant();
        },
      });
    }
  }, [tenantId, api, executeApiCall]);

  const loadUsers = useCallback(async () => {
    if (!tenantId) return;

    setLoading(true);
    const result = await executeApiCall(
      () => api.getUsers({ tenantId }),
      {
        errorMessage: 'Failed to load users',
        showSuccess: false,
      }
    );
    setLoading(false);

    if (result.data) {
      setUsers(result.data);
    } else if (result.isNetworkError && result.retry) {
      setRetryDialog({
        open: true,
        message: 'Unable to load users. Please check your connection.',
        onRetry: async () => {
          setRetryDialog((prev) => ({ ...prev, open: false }));
          await loadUsers();
        },
      });
    }
  }, [tenantId, api, executeApiCall]);

  const loadRoles = useCallback(async () => {
    const result = await executeApiCall(
      () => api.getRoles(),
      {
        errorMessage: 'Failed to load roles',
        showSuccess: false,
      }
    );

    if (result.data) {
      setRoles(result.data);
    }
  }, [api, executeApiCall]);

  useEffect(() => {
    loadTenant();
    loadUsers();
    loadRoles();
  }, [loadTenant, loadUsers, loadRoles]);

  const handleBack = () => {
    navigate('/tenants');
  };

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const handleCreateClick = () => {
    setSelectedUser(null);
    setViewMode('create');
  };

  const handleEditClick = (user: User) => {
    setSelectedUser(user);
    setViewMode('edit');
  };

  const handleCancel = () => {
    setSelectedUser(null);
    setViewMode('list');
  };

  const handleCreateSubmit = async (data: CreateUserDto | UpdateUserDto) => {
    if (!tenantId) return;

    // For create mode, ensure we have a CreateUserDto with username
    if (!('username' in data)) {
      console.error('Username is required for creating a user');
      return;
    }

    // Ensure the user is assigned to this tenant
    const userData: CreateUserDto = {
      ...(data as CreateUserDto),
      tenantIds: [tenantId],
    };

    setSubmitting(true);
    const result = await executeApiCall(
      () => api.createUser(userData),
      {
        successMessage: 'User created successfully',
        errorMessage: 'Failed to create user',
      }
    );
    setSubmitting(false);

    if (result.data) {
      setViewMode('list');
      await loadUsers();
    } else if (result.isNetworkError && result.retry) {
      setRetryDialog({
        open: true,
        message: 'Unable to create user. Please check your connection.',
        onRetry: async () => {
          setRetryDialog((prev) => ({ ...prev, open: false }));
          await handleCreateSubmit(data);
        },
      });
    }
  };

  const handleEditSubmit = async (data: CreateUserDto | UpdateUserDto) => {
    if (!selectedUser) return;

    setSubmitting(true);
    const result = await executeApiCall(
      () => api.updateUser(selectedUser.id, data as UpdateUserDto),
      {
        successMessage: 'User updated successfully',
        errorMessage: 'Failed to update user',
      }
    );
    setSubmitting(false);

    if (result.data) {
      setViewMode('list');
      await loadUsers();
    } else if (result.isNetworkError && result.retry) {
      setRetryDialog({
        open: true,
        message: 'Unable to update user. Please check your connection.',
        onRetry: async () => {
          setRetryDialog((prev) => ({ ...prev, open: false }));
          await handleEditSubmit(data);
        },
      });
    }
  };

  const handleDelete = async (userId: string) => {
    setLoading(true);
    const result = await executeApiCall(
      () => api.deleteUser(userId),
      {
        successMessage: 'User deleted successfully',
        errorMessage: 'Failed to delete user',
      }
    );
    setLoading(false);

    if (result.data !== null) {
      await loadUsers();
    } else if (result.isNetworkError && result.retry) {
      setRetryDialog({
        open: true,
        message: 'Unable to delete user. Please check your connection.',
        onRetry: async () => {
          setRetryDialog((prev) => ({ ...prev, open: false }));
          await handleDelete(userId);
        },
      });
    }
  };

  const handleResetPasswordClick = (user: User) => {
    setResetPasswordUser(user);
  };

  const handleResetPasswordSubmit = async (data: ResetPasswordDto) => {
    if (!resetPasswordUser) return;

    const result = await executeApiCall(
      () => api.resetPassword(resetPasswordUser.id, data),
      {
        successMessage: 'Password reset successfully',
        errorMessage: 'Failed to reset password',
      }
    );

    if (result.data !== null) {
      setResetPasswordUser(null);
    } else if (result.isNetworkError && result.retry) {
      setRetryDialog({
        open: true,
        message: 'Unable to reset password. Please check your connection.',
        onRetry: async () => {
          setRetryDialog((prev) => ({ ...prev, open: false }));
          await handleResetPasswordSubmit(data);
        },
      });
    }
  };

  if (loading && !tenant) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  if (!tenant) {
    return (
      <Box>
        <Typography variant="h6" color="error">
          Tenant not found
        </Typography>
        <Button startIcon={<ArrowBackIcon />} onClick={handleBack} sx={{ mt: 2 }}>
          Back to Tenants
        </Button>
      </Box>
    );
  }

  return (
    <Box>
      <Box display="flex" alignItems="center" mb={3}>
        <Button startIcon={<ArrowBackIcon />} onClick={handleBack} sx={{ mr: 2 }}>
          Back
        </Button>
        <Typography variant="h4">{tenant.displayName || tenant.name}</Typography>
      </Box>

      <Paper sx={{ mb: 3 }}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={tabValue} onChange={handleTabChange}>
            <Tab label="Overview" />
            <Tab label="Members" />
          </Tabs>
        </Box>

        <TabPanel value={tabValue} index={0}>
          <Box>
            <Typography variant="h6" gutterBottom>
              Tenant Information
            </Typography>
            <Box sx={{ mt: 2 }}>
              <Typography variant="body2" color="text.secondary">
                Name
              </Typography>
              <Typography variant="body1" gutterBottom>
                {tenant.name}
              </Typography>

              <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                Display Name
              </Typography>
              <Typography variant="body1" gutterBottom>
                {tenant.displayName || '-'}
              </Typography>

              {tenant.domain && (
                <>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                    Domain
                  </Typography>
                  <Typography variant="body1" gutterBottom>
                    {tenant.domain}
                  </Typography>
                </>
              )}

              <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                Member Count
              </Typography>
              <Typography variant="body1" gutterBottom>
                {tenant.memberCount || 0}
              </Typography>

              <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                Status
              </Typography>
              <Typography variant="body1" gutterBottom>
                {tenant.status === 'active' ? 'Active' : 'Inactive'}
              </Typography>
            </Box>
          </Box>
        </TabPanel>

        <TabPanel value={tabValue} index={1}>
          {viewMode === 'list' && (
            <UserList
              users={users}
              loading={loading}
              onCreateClick={handleCreateClick}
              onEditClick={handleEditClick}
              onDeleteClick={handleDelete}
              onResetPasswordClick={handleResetPasswordClick}
              hideTenantFilter={true}
            />
          )}

          {viewMode === 'create' && (
            <UserForm
              roles={roles}
              loading={submitting}
              onSubmit={handleCreateSubmit}
              onCancel={handleCancel}
              hideTenantSelection={true}
            />
          )}

          {viewMode === 'edit' && (
            <UserForm
              user={selectedUser}
              roles={roles}
              loading={submitting}
              onSubmit={handleEditSubmit}
              onCancel={handleCancel}
              hideTenantSelection={true}
            />
          )}
        </TabPanel>
      </Paper>

      <PasswordResetDialog
        open={!!resetPasswordUser}
        user={resetPasswordUser}
        loading={submitting}
        onSubmit={handleResetPasswordSubmit}
        onCancel={() => setResetPasswordUser(null)}
      />

      <RetryDialog
        open={retryDialog.open}
        message={retryDialog.message}
        onRetry={retryDialog.onRetry}
        onCancel={() => setRetryDialog((prev) => ({ ...prev, open: false }))}
      />
    </Box>
  );
}
