import React, { useCallback, useMemo, useState, useEffect } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  Add as AddIcon,
  CheckCircle as ActivateIcon,
  Edit as EditIcon,
  PauseCircleOutline as DeactivateIcon,
  Visibility as ViewIcon,
} from '@mui/icons-material';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  getOrganizations,
  getOrganizationTypes,
  updateOrganization,
} from '../services/organizationApi';
import type { Organization, OrganizationType } from '../types/organization.types';
import { useNotification } from '../context/NotificationContext';
import { AdminTable, AdminTableColumn } from '../components/AdminTable';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { PageHeader } from '../components/PageHeader';
import { StatusChip } from '../components/StatusChip';

type PendingBulk = { action: 'deactivate' | 'activate'; rows: Organization[] } | null;

export const OrganizationsPage: React.FC = () => {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [organizationTypes, setOrganizationTypes] = useState<OrganizationType[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toDeactivate, setToDeactivate] = useState<Organization | null>(null);
  const [pendingBulk, setPendingBulk] = useState<PendingBulk>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { showSuccess, showError } = useNotification();

  // Filters live in the URL, so a filtered list is linkable and — more to the
  // point — survives opening an organisation and coming back. They used to sit
  // in component state and had to be retyped after every drill-down.
  const filterTypeId = searchParams.get('type') ?? '';

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setLoadFailed(false);
      const [orgsData, typesData] = await Promise.all([
        getOrganizations(),
        getOrganizationTypes(),
      ]);
      setOrganizations(orgsData);
      setOrganizationTypes(typesData);
    } catch (error) {
      setLoadFailed(true);
      showError('Failed to load data');
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const typeName = useCallback(
    (org: Organization) =>
      organizationTypes.find((t) => t.id === org.organizationTypeId)?.displayName ?? 'Unknown',
    [organizationTypes]
  );

  const rows = useMemo(
    () =>
      filterTypeId
        ? organizations.filter((org) => org.organizationTypeId === filterTypeId)
        : organizations,
    [organizations, filterTypeId]
  );

  /**
   * Deactivation replaces deletion.
   *
   * Organisations are never deleted: an inactive organisation is unreachable to
   * its members *and* to its own administrators, and everything it holds —
   * entries, memberships, orders, payment history — is kept and comes back
   * intact when it is reactivated.
   */
  const confirmDeactivate = async () => {
    if (!toDeactivate) return;
    const target = toDeactivate;
    setToDeactivate(null);
    setBusy(true);
    try {
      await updateOrganization(target.id, { status: 'inactive' } as never);
      showSuccess(`${target.displayName} is now inactive`);
      await loadData();
    } catch (error: any) {
      showError(error.response?.data?.error || 'Failed to deactivate organisation');
    } finally {
      setBusy(false);
    }
  };

  const runBulk = async () => {
    if (!pendingBulk) return;
    const { action, rows: targets } = pendingBulk;
    setPendingBulk(null);
    setBusy(true);
    const status = action === 'deactivate' ? 'inactive' : 'active';

    // Settled, not all: one failure must not hide the successes, and the
    // operator needs to know exactly which organisations did not change.
    const results = await Promise.allSettled(
      targets.map((org) => updateOrganization(org.id, { status } as never))
    );
    const failed = results
      .map((r, i) => (r.status === 'rejected' ? targets[i].displayName : null))
      .filter(Boolean);

    if (failed.length === 0) {
      showSuccess(`${targets.length} organisation${targets.length === 1 ? '' : 's'} ${status}`);
    } else if (failed.length === targets.length) {
      showError(`No organisations were updated. ${failed.join(', ')} all failed.`);
    } else {
      showError(
        `${targets.length - failed.length} updated, ${failed.length} failed: ${failed.join(', ')}`
      );
    }

    await loadData();
    setBusy(false);
  };

  const columns: AdminTableColumn<Organization>[] = useMemo(
    () => [
      {
        id: 'name',
        label: 'Name',
        sortValue: (org) => org.displayName,
        width: 280,
        render: (org) => (
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="body2" fontWeight={600} noWrap title={org.displayName}>
              {org.displayName}
            </Typography>
            <Typography variant="caption" color="text.secondary" noWrap component="div">
              /{org.urlCode ?? org.name}
            </Typography>
          </Box>
        ),
      },
      {
        id: 'type',
        label: 'Type',
        sortValue: typeName,
        width: 180,
        render: (org) => typeName(org),
      },
      {
        id: 'status',
        label: 'Status',
        sortValue: (org) => org.status,
        width: 130,
        truncate: false,
        render: (org) => <StatusChip status={org.status} />,
      },
      {
        id: 'capabilities',
        label: 'Capabilities',
        align: 'right',
        sortValue: (org) => org.enabledCapabilities?.length ?? 0,
        width: 130,
        truncate: false,
        render: (org) => {
          const list = org.enabledCapabilities ?? [];
          if (list.length === 0) {
            return (
              <Typography variant="body2" color="text.secondary">
                None
              </Typography>
            );
          }
          // The count alone said nothing about which club has ticketing on.
          // The tooltip names them, so the estate's shape is legible without
          // opening every organisation in turn.
          return (
            <Tooltip title={list.join(', ')}>
              <Chip size="small" label={list.length} variant="outlined" />
            </Tooltip>
          );
        },
      },
      {
        id: 'adminUsers',
        label: 'Admins',
        align: 'right',
        width: 100,
        sortValue: (org) => org.adminUserCount ?? 0,
        render: (org) => org.adminUserCount ?? 0,
      },
      {
        id: 'accountUsers',
        label: 'Members',
        align: 'right',
        width: 110,
        sortValue: (org) => org.accountUserCount ?? 0,
        render: (org) => org.accountUserCount ?? 0,
      },
      {
        id: 'actions',
        label: 'Actions',
        align: 'right',
        width: 140,
        truncate: false,
        render: (org) => (
          <>
            <IconButton
              size="small"
              onClick={() => navigate(`/organizations/${org.id}`)}
              aria-label={`View ${org.displayName}`}
            >
              <ViewIcon fontSize="small" />
            </IconButton>
            <IconButton
              size="small"
              onClick={() => navigate(`/organizations/${org.id}/edit`)}
              aria-label={`Edit ${org.displayName}`}
            >
              <EditIcon fontSize="small" />
            </IconButton>
            {org.status === 'active' ? (
              <IconButton
                size="small"
                color="warning"
                onClick={() => setToDeactivate(org)}
                aria-label={`Make ${org.displayName} inactive`}
              >
                <DeactivateIcon fontSize="small" />
              </IconButton>
            ) : (
              <IconButton
                size="small"
                color="success"
                onClick={() => setPendingBulk({ action: 'activate', rows: [org] })}
                aria-label={`Reactivate ${org.displayName}`}
              >
                <ActivateIcon fontSize="small" />
              </IconButton>
            )}
          </>
        ),
      },
    ],
    [navigate, typeName]
  );

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
        <Typography variant="body2" color="text.secondary" sx={{ ml: 2 }}>
          Loading organisations…
        </Typography>
      </Box>
    );
  }

  return (
    <Box>
      <PageHeader
        title="Organisations"
        description="Every club and association on the platform."
        actions={
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => navigate('/organizations/new')}
          >
            Create Organisation
          </Button>
        }
      />

      {loadFailed && (
        <Alert
          severity="error"
          sx={{ mb: 3 }}
          action={
            <Button color="inherit" size="small" onClick={loadData}>
              Try again
            </Button>
          }
        >
          Organisations could not be loaded.
        </Alert>
      )}

      <AdminTable
        rows={rows}
        columns={columns}
        getRowId={(org) => org.id}
        ariaLabel="Organisations"
        loading={busy}
        urlKey="org"
        searchFields={(org) => [org.displayName, org.name, org.domain, org.urlCode]}
        searchPlaceholder="Search name, code or domain"
        onRowOpen={(org) => navigate(`/organizations/${org.id}`)}
        onCreate={() => navigate('/organizations/new')}
        createLabel="New organisation"
        toolbarActions={
          <>
            <FormControl size="small" sx={{ minWidth: 200 }}>
              <InputLabel id="org-type-filter">Filter by Type</InputLabel>
              <Select
                labelId="org-type-filter"
                value={filterTypeId}
                label="Filter by Type"
                onChange={(e) =>
                  setSearchParams(
                    (prev) => {
                      const next = new URLSearchParams(prev);
                      if (e.target.value) next.set('type', e.target.value);
                      else next.delete('type');
                      next.delete('orgpage');
                      return next;
                    },
                    { replace: true }
                  )
                }
              >
                <MenuItem value="">All Types</MenuItem>
                {organizationTypes.map((type) => (
                  <MenuItem key={type.id} value={type.id}>
                    {type.displayName}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            {filterTypeId && (
              <Button size="small" onClick={() => setSearchParams({}, { replace: true })}>
                Clear filters
              </Button>
            )}
          </>
        }
        bulkActions={[
          {
            id: 'deactivate',
            label: 'Make inactive',
            colour: 'error',
            icon: <DeactivateIcon fontSize="small" />,
            onRun: (selected) => setPendingBulk({ action: 'deactivate', rows: selected }),
          },
          {
            id: 'activate',
            label: 'Reactivate',
            icon: <ActivateIcon fontSize="small" />,
            onRun: (selected) => setPendingBulk({ action: 'activate', rows: selected }),
          },
        ]}
        emptyState={
          <Box textAlign="center">
            <Typography variant="body1" gutterBottom>
              No organisations yet
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              An organisation is a club or association. It inherits its currency and default
              capabilities from an organisation type, so set those up first.
            </Typography>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => navigate('/organizations/new')}
            >
              Create the first organisation
            </Button>
          </Box>
        }
      />

      <ConfirmDialog
        open={Boolean(toDeactivate)}
        title="Make this organisation inactive?"
        severity="error"
        confirmLabel="Make inactive"
        confirmPhrase={toDeactivate?.displayName}
        busy={busy}
        message={
          <>
            <strong>{toDeactivate?.displayName}</strong> will be closed to everyone until it is set
            back to active. Nothing is deleted.
          </>
        }
        consequences={
          toDeactivate ? (
            <>
              {toDeactivate.accountUserCount ?? 0} member
              {(toDeactivate.accountUserCount ?? 0) === 1 ? '' : 's'} lose access immediately and
              the club disappears from the public directory —{' '}
              <code>/account/{toDeactivate.urlCode ?? toDeactivate.name}</code> will stop working.
              Its {toDeactivate.adminUserCount ?? 0} administrator
              {(toDeactivate.adminUserCount ?? 0) === 1 ? '' : 's'} will not be able to sign in
              either. Entries, memberships, orders and payment history are all kept and return when
              you reactivate it.
            </>
          ) : undefined
        }
        onConfirm={confirmDeactivate}
        onCancel={() => setToDeactivate(null)}
      />

      <ConfirmDialog
        open={Boolean(pendingBulk)}
        title={
          pendingBulk?.action === 'deactivate'
            ? `Make ${pendingBulk?.rows.length} organisation${
                pendingBulk?.rows.length === 1 ? '' : 's'
              } inactive?`
            : `Reactivate ${pendingBulk?.rows.length} organisation${
                pendingBulk?.rows.length === 1 ? '' : 's'
              }?`
        }
        severity={pendingBulk?.action === 'deactivate' ? 'error' : 'primary'}
        confirmLabel={pendingBulk?.action === 'deactivate' ? 'Make inactive' : 'Reactivate'}
        busy={busy}
        message={<>{pendingBulk?.rows.map((org) => org.displayName).join(', ')}</>}
        consequences={
          pendingBulk?.action === 'deactivate' ? (
            <>
              {pendingBulk.rows.reduce((n, o) => n + (o.accountUserCount ?? 0), 0)} member accounts
              and{' '}
              {pendingBulk.rows.reduce((n, o) => n + (o.adminUserCount ?? 0), 0)} administrator
              accounts lose access immediately. Nothing is deleted; reactivating restores
              everything.
            </>
          ) : (
            <>Members and administrators regain access as soon as you confirm.</>
          )
        }
        onConfirm={runBulk}
        onCancel={() => setPendingBulk(null)}
      />

    </Box>
  );
};
