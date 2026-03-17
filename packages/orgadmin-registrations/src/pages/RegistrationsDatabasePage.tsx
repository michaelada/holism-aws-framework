/**
 * Registrations Database Page
 *
 * Comprehensive registration records with advanced filtering, batch operations, and Excel export.
 * Mirrors the MembersDatabasePage pattern from orgadmin-memberships.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  FormControl,
  IconButton,
  InputAdornment,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
  Alert,
  Snackbar,
} from '@mui/material';
import {
  Search as SearchIcon,
  Visibility as ViewIcon,
  CheckCircle as ProcessedIcon,
  RadioButtonUnchecked as UnprocessedIcon,
  FileDownload as ExportIcon,
  Label as LabelIcon,
  FilterList as FilterIcon,
  Add as AddIcon,
} from '@mui/icons-material';
import { useTranslation } from '@aws-web-framework/orgadmin-shell';
import { formatDate } from '@aws-web-framework/orgadmin-shell';
import { useOrganisation, useApi } from '@aws-web-framework/orgadmin-core';
import type { Registration, RegistrationFilter, RegistrationType } from '../types/registration.types';
import CreateCustomFilterDialog from '../components/CreateCustomFilterDialog';
import BatchOperationsDialog from '../components/BatchOperationsDialog';

const RegistrationsDatabasePage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { execute } = useApi();
  const { t, i18n } = useTranslation();
  const { organisation } = useOrganisation();

  // Core data state
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [filteredRegistrations, setFilteredRegistrations] = useState<Registration[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'current' | 'elapsed' | 'all'>('current');
  const [customFilters, setCustomFilters] = useState<RegistrationFilter[]>([]);
  const [selectedCustomFilter, setSelectedCustomFilter] = useState<string>('');

  // Selection state
  const [selectedRegistrations, setSelectedRegistrations] = useState<string[]>([]);

  // Dialog state
  const [filterDialogOpen, setFilterDialogOpen] = useState(false);
  const [batchDialogOpen, setBatchDialogOpen] = useState(false);
  const [batchOperation, setBatchOperation] = useState<'mark_processed' | 'mark_unprocessed' | 'add_labels' | 'remove_labels'>('mark_processed');

  // Registration types for "Add Registration" button visibility
  const [registrationTypes, setRegistrationTypes] = useState<RegistrationType[]>([]);
  const [loadingTypes, setLoadingTypes] = useState(true);

  // User roles for admin check
  const [userRoles, setUserRoles] = useState<Array<{ id: string; name: string; displayName: string }>>([]);
  const [loadingRoles, setLoadingRoles] = useState(true);

  // Registration type name lookup map
  const [registrationTypeMap, setRegistrationTypeMap] = useState<Record<string, string>>({});

  // Success notification state
  const [successMessage, setSuccessMessage] = useState('');
  const [showSuccessNotification, setShowSuccessNotification] = useState(false);

  // Check for success message from navigation state
  useEffect(() => {
    if (location.state?.successMessage) {
      setSuccessMessage(location.state.successMessage);
      setShowSuccessNotification(true);

      // Restore filter state if provided
      if (location.state?.filterState) {
        const { searchTerm: savedSearch, statusFilter: savedStatus, selectedCustomFilter: savedFilter } = location.state.filterState;
        if (savedSearch !== undefined) setSearchTerm(savedSearch);
        if (savedStatus !== undefined) setStatusFilter(savedStatus);
        if (savedFilter !== undefined) setSelectedCustomFilter(savedFilter);
      }

      // Clear navigation state to prevent showing message on refresh
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state]);

  // Initial data loading
  useEffect(() => {
    loadRegistrations();
    loadCustomFilters();
    loadRegistrationTypes();
    loadUserRoles();
  }, []);

  // Re-filter when dependencies change
  useEffect(() => {
    filterRegistrations();
  }, [registrations, searchTerm, statusFilter, selectedCustomFilter]);

  const loadRegistrations = async () => {
    try {
      setLoading(true);
      const response = await execute({
        method: 'GET',
        url: `/api/orgadmin/organisations/${organisation?.id}/registrations`,
      });
      setRegistrations(response || []);
    } catch (error) {
      console.error('Failed to load registrations:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadCustomFilters = async () => {
    try {
      const response = await execute({
        method: 'GET',
        url: `/api/orgadmin/organisations/${organisation?.id}/registrations/filters`,
      });
      setCustomFilters(response || []);
    } catch (error) {
      console.error('Failed to load custom filters:', error);
    }
  };

  const loadRegistrationTypes = async () => {
    try {
      setLoadingTypes(true);
      const response = await execute({
        method: 'GET',
        url: `/api/orgadmin/organisations/${organisation?.id}/registration-types`,
      });
      const typesArray = Array.isArray(response) ? response : [];
      setRegistrationTypes(typesArray);
      // Build lookup map for type names
      const typeMap: Record<string, string> = {};
      typesArray.forEach((rt: RegistrationType) => {
        typeMap[rt.id] = rt.name;
      });
      setRegistrationTypeMap(typeMap);
    } catch (error) {
      console.error('Failed to load registration types:', error);
      setRegistrationTypes([]);
    } finally {
      setLoadingTypes(false);
    }
  };

  const loadUserRoles = async () => {
    try {
      setLoadingRoles(true);
      const response = await execute({
        method: 'GET',
        url: '/api/orgadmin/auth/me',
      });
      setUserRoles(response.roles || []);
    } catch (error) {
      console.error('Failed to load user roles:', error);
      setUserRoles([]);
    } finally {
      setLoadingRoles(false);
    }
  };

  const hasAdminRole = (): boolean => {
    return userRoles.some(role => role.name === 'admin' || role.name === 'full-administrator');
  };

  const filterRegistrations = useCallback(() => {
    let filtered = [...registrations];

    // Apply status filter: current = active + pending
    if (statusFilter === 'current') {
      filtered = filtered.filter(r => r.status === 'active' || r.status === 'pending');
    } else if (statusFilter === 'elapsed') {
      filtered = filtered.filter(r => r.status === 'elapsed');
    }

    // Apply search filter by entity name, owner name, or registration number
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(r =>
        r.entityName.toLowerCase().includes(term) ||
        r.ownerName.toLowerCase().includes(term) ||
        r.registrationNumber.toLowerCase().includes(term)
      );
    }

    // Apply custom filter if selected
    if (selectedCustomFilter) {
      const filter = customFilters.find(f => f.id === selectedCustomFilter);
      if (filter) {
        if (filter.registrationStatus.length > 0) {
          filtered = filtered.filter(r => filter.registrationStatus.includes(r.status));
        }
        if (filter.registrationLabels.length > 0) {
          filtered = filtered.filter(r =>
            filter.registrationLabels.some(label => r.labels.includes(label))
          );
        }
        if (filter.registrationTypes.length > 0) {
          filtered = filtered.filter(r =>
            filter.registrationTypes.includes(r.registrationTypeId)
          );
        }
        if (filter.dateLastRenewedBefore) {
          filtered = filtered.filter(r => new Date(r.dateLastRenewed) <= new Date(filter.dateLastRenewedBefore!));
        }
        if (filter.dateLastRenewedAfter) {
          filtered = filtered.filter(r => new Date(r.dateLastRenewed) >= new Date(filter.dateLastRenewedAfter!));
        }
        if (filter.validUntilBefore) {
          filtered = filtered.filter(r => new Date(r.validUntil) <= new Date(filter.validUntilBefore!));
        }
        if (filter.validUntilAfter) {
          filtered = filtered.filter(r => new Date(r.validUntil) >= new Date(filter.validUntilAfter!));
        }
      }
    }

    setFilteredRegistrations(filtered);
  }, [registrations, searchTerm, statusFilter, selectedCustomFilter, customFilters]);

  // Selection handlers
  const handleSelectAll = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.checked) {
      setSelectedRegistrations(filteredRegistrations.map(r => r.id));
    } else {
      setSelectedRegistrations([]);
    }
  };

  const handleSelectRegistration = (registrationId: string) => {
    setSelectedRegistrations(prev =>
      prev.includes(registrationId)
        ? prev.filter(id => id !== registrationId)
        : [...prev, registrationId]
    );
  };

  // Navigation handlers
  const handleViewRegistration = (registrationId: string) => {
    const filterState = { searchTerm, statusFilter, selectedCustomFilter };
    navigate(`/registrations/${registrationId}`, { state: { filterState } });
  };

  const handleAddRegistration = () => {
    const filterState = { searchTerm, statusFilter, selectedCustomFilter };
    if (registrationTypes.length === 1) {
      navigate(`/registrations/create?typeId=${registrationTypes[0].id}`, { state: { filterState } });
    } else {
      navigate('/registrations/create', { state: { filterState } });
    }
  };

  // Processed flag toggle via PATCH
  const handleToggleProcessed = async (registrationId: string, currentProcessed: boolean) => {
    try {
      await execute({
        method: 'PATCH',
        url: `/api/orgadmin/registrations/${registrationId}`,
        data: { processed: !currentProcessed },
      });
      loadRegistrations();
    } catch (error) {
      console.error('Failed to update processed status:', error);
    }
  };

  // Batch operations
  const handleBatchOperation = (operation: typeof batchOperation) => {
    setBatchOperation(operation);
    setBatchDialogOpen(true);
  };

  // Export to Excel
  const handleExport = async () => {
    try {
      const response = await execute({
        method: 'GET',
        url: `/api/orgadmin/organisations/${organisation?.id}/registrations/export`,
        responseType: 'blob',
      });
      const blob = new Blob([response], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'registrations.xlsx';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export registrations:', error);
    }
  };

  // Date formatting using locale
  const formatDateLocale = (dateValue: Date | string) => {
    return formatDate(new Date(dateValue), 'dd MMM yyyy', i18n.language);
  };

  const getStatusColor = (status: string): 'success' | 'warning' | 'default' => {
    switch (status) {
      case 'active':
        return 'success';
      case 'pending':
        return 'warning';
      case 'elapsed':
        return 'default';
      default:
        return 'default';
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      {/* Header with title and action buttons */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">{t('registrations.registrationsDatabase')}</Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            variant="outlined"
            startIcon={<ExportIcon />}
            onClick={handleExport}
            data-testid="export-button"
          >
            {t('registrations.actions.exportToExcel')}
          </Button>
          {/* Add Registration button: visible when types exist AND user has admin role */}
          {!loadingTypes && !loadingRoles && registrationTypes.length > 0 && hasAdminRole() && (
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={handleAddRegistration}
              data-testid="add-registration-button"
            >
              {t('registrations.actions.addRegistration')}
            </Button>
          )}
        </Box>
      </Box>

      {/* Search, filters, and status toggle */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 2 }}>
            <TextField
              placeholder={t('registrations.searchPlaceholder')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              sx={{ flexGrow: 1, minWidth: 250 }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ),
              }}
              data-testid="search-field"
            />
            <FormControl sx={{ minWidth: 200 }}>
              <InputLabel>{t('registrations.filters.customFilter')}</InputLabel>
              <Select
                value={selectedCustomFilter}
                label={t('registrations.filters.customFilter')}
                onChange={(e) => setSelectedCustomFilter(e.target.value)}
                data-testid="custom-filter-select"
              >
                <MenuItem value="">{t('registrations.filters.none')}</MenuItem>
                {customFilters.map((filter) => (
                  <MenuItem key={filter.id} value={filter.id}>
                    {filter.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Button
              variant="outlined"
              startIcon={<FilterIcon />}
              onClick={() => setFilterDialogOpen(true)}
              data-testid="create-filter-button"
            >
              {t('registrations.filters.createFilter')}
            </Button>
          </Box>

          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
            <ToggleButtonGroup
              value={statusFilter}
              exclusive
              onChange={(_, value) => value && setStatusFilter(value)}
              size="small"
              data-testid="status-toggle"
            >
              <ToggleButton value="current">{t('registrations.statusOptions.current')}</ToggleButton>
              <ToggleButton value="elapsed">{t('registrations.statusOptions.elapsed')}</ToggleButton>
              <ToggleButton value="all">{t('registrations.statusOptions.all')}</ToggleButton>
            </ToggleButtonGroup>

            {/* Batch operation buttons: visible when registrations are selected */}
            {selectedRegistrations.length > 0 && (
              <Box sx={{ display: 'flex', gap: 1 }} data-testid="batch-operations">
                <Button
                  size="small"
                  onClick={() => handleBatchOperation('mark_processed')}
                >
                  {t('registrations.actions.markProcessed')}
                </Button>
                <Button
                  size="small"
                  onClick={() => handleBatchOperation('mark_unprocessed')}
                >
                  {t('registrations.actions.markUnprocessed')}
                </Button>
                <Button
                  size="small"
                  startIcon={<LabelIcon />}
                  onClick={() => handleBatchOperation('add_labels')}
                >
                  {t('registrations.actions.addLabels')}
                </Button>
                <Button
                  size="small"
                  startIcon={<LabelIcon />}
                  onClick={() => handleBatchOperation('remove_labels')}
                >
                  {t('registrations.actions.removeLabels')}
                </Button>
              </Box>
            )}
          </Box>
        </CardContent>
      </Card>

      {/* Registrations table */}
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell padding="checkbox">
                <Checkbox
                  checked={selectedRegistrations.length === filteredRegistrations.length && filteredRegistrations.length > 0}
                  indeterminate={selectedRegistrations.length > 0 && selectedRegistrations.length < filteredRegistrations.length}
                  onChange={handleSelectAll}
                />
              </TableCell>
              <TableCell>{t('registrations.table.registrationType')}</TableCell>
              <TableCell>{t('registrations.table.entityName')}</TableCell>
              <TableCell>{t('registrations.table.ownerName')}</TableCell>
              <TableCell>{t('registrations.table.registrationNumber')}</TableCell>
              <TableCell>{t('registrations.table.dateLastRenewed')}</TableCell>
              <TableCell>{t('registrations.table.status')}</TableCell>
              <TableCell>{t('registrations.table.validUntil')}</TableCell>
              <TableCell>{t('registrations.table.labels')}</TableCell>
              <TableCell>{t('registrations.table.processed')}</TableCell>
              <TableCell align="right">{t('registrations.table.actions')}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={11} align="center">
                  {t('registrations.loadingRegistrations')}
                </TableCell>
              </TableRow>
            ) : filteredRegistrations.length === 0 ? (
              <TableRow>
                <TableCell colSpan={11} align="center">
                  {t('registrations.noRegistrationsFound')}
                </TableCell>
              </TableRow>
            ) : (
              filteredRegistrations.map((registration) => (
                <TableRow key={registration.id} hover>
                  <TableCell padding="checkbox">
                    <Checkbox
                      checked={selectedRegistrations.includes(registration.id)}
                      onChange={() => handleSelectRegistration(registration.id)}
                    />
                  </TableCell>
                  <TableCell>
                    {registrationTypeMap[registration.registrationTypeId] || registration.registrationTypeId}
                  </TableCell>
                  <TableCell>
                    <Chip label={registration.entityName} color="primary" size="small" />
                  </TableCell>
                  <TableCell>{registration.ownerName}</TableCell>
                  <TableCell>{registration.registrationNumber}</TableCell>
                  <TableCell>{formatDateLocale(registration.dateLastRenewed)}</TableCell>
                  <TableCell>
                    <Chip
                      label={t(`registrations.status.${registration.status}`)}
                      color={getStatusColor(registration.status)}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>{formatDateLocale(registration.validUntil)}</TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                      {registration.labels.slice(0, 2).map((label) => (
                        <Chip key={label} label={label} size="small" />
                      ))}
                      {registration.labels.length > 2 && (
                        <Chip label={`+${registration.labels.length - 2}`} size="small" />
                      )}
                    </Box>
                  </TableCell>
                  <TableCell>
                    <IconButton
                      size="small"
                      onClick={() => handleToggleProcessed(registration.id, registration.processed)}
                      title={registration.processed
                        ? t('registrations.tooltips.markUnprocessed')
                        : t('registrations.tooltips.markProcessed')}
                      data-testid={`processed-toggle-${registration.id}`}
                    >
                      {registration.processed ? <ProcessedIcon color="success" /> : <UnprocessedIcon />}
                    </IconButton>
                  </TableCell>
                  <TableCell align="right">
                    <IconButton
                      size="small"
                      onClick={() => handleViewRegistration(registration.id)}
                      title={t('registrations.tooltips.viewDetails')}
                      data-testid={`view-button-${registration.id}`}
                    >
                      <ViewIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Create Custom Filter Dialog */}
      <CreateCustomFilterDialog
        open={filterDialogOpen}
        onClose={() => setFilterDialogOpen(false)}
        onSave={() => {
          setFilterDialogOpen(false);
          loadCustomFilters();
        }}
      />

      {/* Batch Operations Dialog */}
      <BatchOperationsDialog
        open={batchDialogOpen}
        onClose={() => setBatchDialogOpen(false)}
        operation={batchOperation}
        selectedIds={selectedRegistrations}
        onComplete={() => {
          setBatchDialogOpen(false);
          setSelectedRegistrations([]);
          loadRegistrations();
        }}
      />

      {/* Success notification */}
      <Snackbar
        open={showSuccessNotification}
        autoHideDuration={6000}
        onClose={() => setShowSuccessNotification(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setShowSuccessNotification(false)}
          severity="success"
          sx={{ width: '100%' }}
        >
          {successMessage}
        </Alert>
      </Snackbar>

    </Box>
  );
};

export default RegistrationsDatabasePage;
