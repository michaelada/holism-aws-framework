import { useState, useEffect, useCallback } from 'react';
import { Box } from '@mui/material';
import { UserList } from '../components/UserList';
import { UserForm } from '../components/UserForm';
import { PasswordResetDialog } from '../components/PasswordResetDialog';
import { useApi, useNotification } from '../context';
import {
  User,
  CreateUserDto,
  UpdateUserDto,
  ResetPasswordDto,
  Tenant,
  Role,
} from '../types/admin.types';
import { ApiError, NetworkError } from '../services/adminApi';

type ViewMode = 'list' | 'create' | 'edit';

export function UsersPage() {
  const { api } = useApi();
  const { showSuccess, showError } = useNotification();

  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [users, setUsers] = useState<User[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [userForPasswordReset, setUserForPasswordReset] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTenantId, setSelectedTenantId] = useState('');

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const filters = {
        search: searchTerm || undefined,
        tenantId: selectedTenantId || undefined,
      };
      const data = await api.getUsers(filters);
      setUsers(data);
    } catch (error) {
      if (error instanceof ApiError) {
        showError(`Failed to load users: ${error.message}`);
      } else if (error instanceof NetworkError) {
        showError(error.message);
      } else {
        showError('Failed to load users');
      }
    } finally {
      setLoading(false);
    }
  }, [api, showError, searchTerm, selectedTenantId]);

  const loadTenants = useCallback(async () => {
    try {
      const data = await api.getTenants();
      setTenants(data);
    } catch (error) {
      // Silently fail - tenants are optional for user management
      console.error('Failed to load tenants:', error);
    }
  }, [api]);

  const loadRoles = useCallback(async () => {
    try {
      const data = await api.getRoles();
      setRoles(data);
    } catch (error) {
      // Silently fail - roles are optional for user management
      console.error('Failed to load roles:', error);
    }
  }, [api]);

  useEffect(() => {
    loadUsers();
    loadTenants();
    loadRoles();
  }, [loadUsers, loadTenants, loadRoles]);

  const handleSearchChange = (search: string) => {
    setSearchTerm(search);
  };

  const handleTenantFilterChange = (tenantId: string) => {
    setSelectedTenantId(tenantId);
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

  const handleCreateSubmit = async (data: CreateUserDto) => {
    setSubmitting(true);
    try {
      await api.createUser(data);
      showSuccess('User created successfully');
      setViewMode('list');
      await loadUsers();
    } catch (error) {
      if (error instanceof ApiError) {
        showError(`Failed to create user: ${error.message}`);
      } else if (error instanceof NetworkError) {
        showError(error.message);
      } else {
        showError('Failed to create user');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditSubmit = async (data: UpdateUserDto) => {
    if (!selectedUser) return;

    setSubmitting(true);
    try {
      await api.updateUser(selectedUser.id, data);
      showSuccess('User updated successfully');
      setViewMode('list');
      await loadUsers();
    } catch (error) {
      if (error instanceof ApiError) {
        showError(`Failed to update user: ${error.message}`);
      } else if (error instanceof NetworkError) {
        showError(error.message);
      } else {
        showError('Failed to update user');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (userId: string) => {
    setLoading(true);
    try {
      await api.deleteUser(userId);
      showSuccess('User deleted successfully');
      await loadUsers();
    } catch (error) {
      if (error instanceof ApiError) {
        showError(`Failed to delete user: ${error.message}`);
      } else if (error instanceof NetworkError) {
        showError(error.message);
      } else {
        showError('Failed to delete user');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResetPasswordClick = (user: User) => {
    setUserForPasswordReset(user);
  };

  const handleResetPasswordCancel = () => {
    setUserForPasswordReset(null);
  };

  const handleResetPasswordSubmit = async (data: ResetPasswordDto) => {
    if (!userForPasswordReset) return;

    setSubmitting(true);
    try {
      await api.resetPassword(userForPasswordReset.id, data);
      showSuccess('Password reset successfully');
      setUserForPasswordReset(null);
    } catch (error) {
      if (error instanceof ApiError) {
        showError(`Failed to reset password: ${error.message}`);
      } else if (error instanceof NetworkError) {
        showError(error.message);
      } else {
        showError('Failed to reset password');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box>
      {viewMode === 'list' && (
        <UserList
          users={users}
          tenants={tenants}
          loading={loading}
          searchTerm={searchTerm}
          selectedTenantId={selectedTenantId}
          onSearchChange={handleSearchChange}
          onTenantFilterChange={handleTenantFilterChange}
          onCreateClick={handleCreateClick}
          onEditClick={handleEditClick}
          onDeleteClick={handleDelete}
          onResetPasswordClick={handleResetPasswordClick}
        />
      )}

      {viewMode === 'create' && (
        <UserForm
          tenants={tenants}
          roles={roles}
          loading={submitting}
          onSubmit={handleCreateSubmit}
          onCancel={handleCancel}
        />
      )}

      {viewMode === 'edit' && (
        <UserForm
          user={selectedUser}
          tenants={tenants}
          roles={roles}
          loading={submitting}
          onSubmit={handleEditSubmit}
          onCancel={handleCancel}
        />
      )}

      <PasswordResetDialog
        open={!!userForPasswordReset}
        user={userForPasswordReset}
        loading={submitting}
        onSubmit={handleResetPasswordSubmit}
        onCancel={handleResetPasswordCancel}
      />
    </Box>
  );
}
