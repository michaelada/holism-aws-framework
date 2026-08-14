import React, { useMemo, useState, useEffect } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  IconButton,
  Tooltip,
  Typography,
} from '@mui/material';
import { Add as AddIcon, Edit as EditIcon, Visibility as ViewIcon } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { getOrganizationTypes } from '../services/organizationApi';
import type { OrganizationType } from '../types/organization.types';
import { useNotification } from '../context/NotificationContext';
import { AdminTable, AdminTableColumn } from '../components/AdminTable';
import { PageHeader } from '../components/PageHeader';
import { StatusChip } from '../components/StatusChip';

export const OrganizationTypesPage: React.FC = () => {
  const [organizationTypes, setOrganizationTypes] = useState<OrganizationType[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const navigate = useNavigate();
  const { showError } = useNotification();

  useEffect(() => {
    loadOrganizationTypes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadOrganizationTypes = async () => {
    try {
      setLoading(true);
      setLoadFailed(false);
      const data = await getOrganizationTypes();
      setOrganizationTypes(data);
    } catch (error) {
      setLoadFailed(true);
      showError('Failed to load organisation types');
      console.error('Error loading organisation types:', error);
    } finally {
      setLoading(false);
    }
  };

  const columns: AdminTableColumn<OrganizationType>[] = useMemo(
    () => [
      {
        id: 'name',
        label: 'Name',
        width: 260,
        sortValue: (type) => type.displayName,
        render: (type) => (
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="body2" fontWeight={600} noWrap title={type.displayName}>
              {type.displayName}
            </Typography>
            <Typography variant="caption" color="text.secondary" noWrap component="div">
              {type.name}
            </Typography>
          </Box>
        ),
      },
      {
        id: 'currency',
        label: 'Currency',
        width: 110,
        sortValue: (type) => type.currency,
        render: (type) => type.currency,
      },
      {
        id: 'locale',
        label: 'Locale',
        width: 130,
        sortValue: (type) => type.defaultLocale || 'en-GB',
        render: (type) => type.defaultLocale || 'en-GB',
      },
      {
        id: 'organisations',
        label: 'Organisations',
        align: 'right',
        width: 140,
        sortValue: (type) => type.organizationCount ?? 0,
        render: (type) => type.organizationCount ?? 0,
      },
      {
        id: 'capabilities',
        label: 'Default capabilities',
        align: 'right',
        width: 170,
        truncate: false,
        sortValue: (type) => type.defaultCapabilities?.length ?? 0,
        render: (type) => {
          const list = type.defaultCapabilities ?? [];
          if (list.length === 0) {
            return (
              <Typography variant="body2" color="text.secondary">
                None
              </Typography>
            );
          }
          return (
            <Tooltip title={list.join(', ')}>
              <Chip size="small" label={list.length} variant="outlined" />
            </Tooltip>
          );
        },
      },
      {
        id: 'status',
        label: 'Status',
        width: 130,
        truncate: false,
        sortValue: (type) => type.status,
        render: (type) => <StatusChip status={type.status} />,
      },
      {
        id: 'actions',
        label: 'Actions',
        align: 'right',
        width: 110,
        truncate: false,
        render: (type) => (
          <>
            <IconButton
              size="small"
              onClick={() => navigate(`/organization-types/${type.id}`)}
              aria-label={`View ${type.displayName}`}
            >
              <ViewIcon fontSize="small" />
            </IconButton>
            <IconButton
              size="small"
              onClick={() => navigate(`/organization-types/${type.id}/edit`)}
              aria-label={`Edit ${type.displayName}`}
            >
              <EditIcon fontSize="small" />
            </IconButton>
          </>
        ),
      },
    ],
    [navigate]
  );

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
        <Typography variant="body2" color="text.secondary" sx={{ ml: 2 }}>
          Loading organisation types…
        </Typography>
      </Box>
    );
  }

  return (
    <Box>
      <PageHeader
        title="Organisation Types"
        description="A type fixes the currency, locale and default capabilities that its organisations inherit."
        actions={
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => navigate('/organization-types/new')}
          >
            Create Organisation Type
          </Button>
        }
      />

      {loadFailed && (
        <Alert
          severity="error"
          sx={{ mb: 3 }}
          action={
            <Button color="inherit" size="small" onClick={loadOrganizationTypes}>
              Try again
            </Button>
          }
        >
          Organisation types could not be loaded.
        </Alert>
      )}

      <AdminTable
        rows={organizationTypes}
        columns={columns}
        getRowId={(type) => type.id}
        ariaLabel="Organisation types"
        urlKey="type"
        searchFields={(type) => [type.displayName, type.name, type.currency]}
        searchPlaceholder="Search types"
        onRowOpen={(type) => navigate(`/organization-types/${type.id}`)}
        onCreate={() => navigate('/organization-types/new')}
        createLabel="New type"
        emptyState={
          <Box textAlign="center">
            <Typography variant="body1" gutterBottom>
              No organisation types yet
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Every organisation belongs to a type, which sets its currency, its default locale and
              the capabilities it starts with. Create a type before creating organisations.
            </Typography>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => navigate('/organization-types/new')}
            >
              Create the first type
            </Button>
          </Box>
        }
      />
    </Box>
  );
};
