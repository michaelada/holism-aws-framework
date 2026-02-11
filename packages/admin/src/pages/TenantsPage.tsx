import { useState, useEffect, useCallback } from 'react';
import { Box } from '@mui/material';
import { TenantList } from '../components/TenantList';
import { TenantForm } from '../components/TenantForm';
import { RetryDialog } from '../components/RetryDialog';
import { useApi } from '../context';
import { Tenant, CreateTenantDto, UpdateTenantDto } from '../types/admin.types';
import { useApiCall } from '../hooks/useApiCall';

type ViewMode = 'list' | 'create' | 'edit';

export function TenantsPage() {
  const { api } = useApi();
  const executeApiCall = useApiCall();

  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);
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

  const loadTenants = useCallback(async () => {
    setLoading(true);
    const result = await executeApiCall(
      () => api.getTenants(),
      {
        errorMessage: 'Failed to load tenants',
        showSuccess: false,
      }
    );
    setLoading(false);

    if (result.data) {
      setTenants(result.data);
    } else if (result.isNetworkError && result.retry) {
      setRetryDialog({
        open: true,
        message: 'Unable to load tenants. Please check your connection.',
        onRetry: async () => {
          setRetryDialog((prev) => ({ ...prev, open: false }));
          await loadTenants();
        },
      });
    }
  }, [api, executeApiCall]);

  useEffect(() => {
    loadTenants();
  }, [loadTenants]);

  const handleCreateClick = () => {
    setSelectedTenant(null);
    setViewMode('create');
  };

  const handleEditClick = (tenant: Tenant) => {
    setSelectedTenant(tenant);
    setViewMode('edit');
  };

  const handleCancel = () => {
    setSelectedTenant(null);
    setViewMode('list');
  };

  const handleCreateSubmit = async (data: CreateTenantDto) => {
    setSubmitting(true);
    const result = await executeApiCall(
      () => api.createTenant(data),
      {
        successMessage: 'Tenant created successfully',
        errorMessage: 'Failed to create tenant',
      }
    );
    setSubmitting(false);

    if (result.data) {
      setViewMode('list');
      await loadTenants();
    } else if (result.isNetworkError && result.retry) {
      setRetryDialog({
        open: true,
        message: 'Unable to create tenant. Please check your connection.',
        onRetry: async () => {
          setRetryDialog((prev) => ({ ...prev, open: false }));
          await handleCreateSubmit(data);
        },
      });
    }
  };

  const handleEditSubmit = async (data: UpdateTenantDto) => {
    if (!selectedTenant) return;

    setSubmitting(true);
    const result = await executeApiCall(
      () => api.updateTenant(selectedTenant.id, data),
      {
        successMessage: 'Tenant updated successfully',
        errorMessage: 'Failed to update tenant',
      }
    );
    setSubmitting(false);

    if (result.data) {
      setViewMode('list');
      await loadTenants();
    } else if (result.isNetworkError && result.retry) {
      setRetryDialog({
        open: true,
        message: 'Unable to update tenant. Please check your connection.',
        onRetry: async () => {
          setRetryDialog((prev) => ({ ...prev, open: false }));
          await handleEditSubmit(data);
        },
      });
    }
  };

  const handleDelete = async (tenantId: string) => {
    setLoading(true);
    const result = await executeApiCall(
      () => api.deleteTenant(tenantId),
      {
        successMessage: 'Tenant deleted successfully',
        errorMessage: 'Failed to delete tenant',
      }
    );
    setLoading(false);

    if (result.data !== null) {
      await loadTenants();
    } else if (result.isNetworkError && result.retry) {
      setRetryDialog({
        open: true,
        message: 'Unable to delete tenant. Please check your connection.',
        onRetry: async () => {
          setRetryDialog((prev) => ({ ...prev, open: false }));
          await handleDelete(tenantId);
        },
      });
    }
  };

  return (
    <Box>
      {viewMode === 'list' && (
        <TenantList
          tenants={tenants}
          loading={loading}
          onCreateClick={handleCreateClick}
          onEditClick={handleEditClick}
          onDeleteClick={handleDelete}
        />
      )}

      {viewMode === 'create' && (
        <TenantForm
          loading={submitting}
          onSubmit={handleCreateSubmit}
          onCancel={handleCancel}
        />
      )}

      {viewMode === 'edit' && (
        <TenantForm
          tenant={selectedTenant}
          loading={submitting}
          onSubmit={handleEditSubmit}
          onCancel={handleCancel}
        />
      )}

      <RetryDialog
        open={retryDialog.open}
        message={retryDialog.message}
        onRetry={retryDialog.onRetry}
        onCancel={() => setRetryDialog((prev) => ({ ...prev, open: false }))}
      />
    </Box>
  );
}
