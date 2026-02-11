import { useState, useEffect, useCallback } from 'react';
import { Box } from '@mui/material';
import { RoleList } from '../components/RoleList';
import { RoleForm } from '../components/RoleForm';
import { useApi, useNotification } from '../context';
import { Role, CreateRoleDto } from '../types/admin.types';
import { ApiError, NetworkError } from '../services/adminApi';

type ViewMode = 'list' | 'create';

export function RolesPage() {
  const { api } = useApi();
  const { showSuccess, showError } = useNotification();

  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const loadRoles = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getRoles();
      setRoles(data);
    } catch (error) {
      if (error instanceof ApiError) {
        showError(`Failed to load roles: ${error.message}`);
      } else if (error instanceof NetworkError) {
        showError(error.message);
      } else {
        showError('Failed to load roles');
      }
    } finally {
      setLoading(false);
    }
  }, [api, showError]);

  useEffect(() => {
    loadRoles();
  }, [loadRoles]);

  const handleCreateClick = () => {
    setViewMode('create');
  };

  const handleCancel = () => {
    setViewMode('list');
  };

  const handleCreateSubmit = async (data: CreateRoleDto) => {
    setSubmitting(true);
    try {
      await api.createRole(data);
      showSuccess('Role created successfully');
      setViewMode('list');
      await loadRoles();
    } catch (error) {
      if (error instanceof ApiError) {
        showError(`Failed to create role: ${error.message}`);
      } else if (error instanceof NetworkError) {
        showError(error.message);
      } else {
        showError('Failed to create role');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (roleId: string) => {
    setLoading(true);
    try {
      await api.deleteRole(roleId);
      showSuccess('Role deleted successfully');
      await loadRoles();
    } catch (error) {
      if (error instanceof ApiError) {
        showError(`Failed to delete role: ${error.message}`);
      } else if (error instanceof NetworkError) {
        showError(error.message);
      } else {
        showError('Failed to delete role');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box>
      {viewMode === 'list' && (
        <RoleList
          roles={roles}
          loading={loading}
          onCreateClick={handleCreateClick}
          onDeleteClick={handleDelete}
        />
      )}

      {viewMode === 'create' && (
        <RoleForm
          loading={submitting}
          onSubmit={handleCreateSubmit}
          onCancel={handleCancel}
        />
      )}
    </Box>
  );
}
