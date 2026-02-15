/**
 * Registrations Database Page
 * 
 * Comprehensive registration records with advanced filtering, batch operations, and Excel export
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
} from '@mui/material';
import {
  Search as SearchIcon,
  Visibility as ViewIcon,
  Edit as EditIcon,
  CheckCircle as ProcessedIcon,
  RadioButtonUnchecked as UnprocessedIcon,
  FileDownload as ExportIcon,
  Label as LabelIcon,
  FilterList as FilterIcon,
} from '@mui/icons-material';
import { useTranslation, formatDate } from '@aws-web-framework/orgadmin-shell';
import type { Registration, RegistrationFilter } from '../types/registration.types';
import CreateCustomFilterDialog from '../components/CreateCustomFilterDialog';
import BatchOperationsDialog from '../components/BatchOperationsDialog';

// Mock API hook
const useApi = () => ({
  execute: async ({ method, url }: { method: string; url: string }) => {
    return [];
  },
});

const RegistrationsDatabasePage: React.FC = () => {
  const navigate = useNavigate();
  const { execute } = useApi();
  const { t } = useTranslation();

  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [filteredRegistrations, setFilteredRegistrations] = useState<Registration[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'current' | 'elapsed' | 'all'>('current');
  const [selectedRegistrations, setSelectedRegistrations] = useState<string[]>([]);
  const [customFilters, setCustomFilters] = useState<RegistrationFilter[]>([]);
  const [selectedCustomFilter, setSelectedCustomFilter] = useState<string>('');
  const [filterDialogOpen, setFilterDialogOpen] = useState(false);
  const [batchDialogOpen, setBatchDialogOpen] = useState(false);
  const [batchOperation, setBatchOperation] = useState<'mark_processed' | 'mark_unprocessed' | 'add_labels' | 'remove_labels'>('mark_processed');

  useEffect(() => {
    loadRegistrations();
    loadCustomFilters();
  }, []);

  useEffect(() => {
    filterRegistrations();
  }, [registrations, searchTerm, statusFilter, selectedCustomFilter]);

  const loadRegistrations = async () => {
    try {
      setLoading(true);
      const response = await execute({
        method: 'GET',
        url: '/api/orgadmin/registrations',
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
        url: '/api/orgadmin/registration-filters',
      });
      setCustomFilters(response || []);
    } catch (error) {
      console.error('Failed to load custom filters:', error);
    }
  };

  const filterRegistrations = () => {
    let filtered = [...registrations];

    // Apply status filter
    if (statusFilter === 'current') {
      filtered = filtered.filter(r => r.status === 'active' || r.status === 'pending');
    } else if (statusFilter === 'elapsed') {
      filtered = filtered.filter(r => r.status === 'elapsed');
    }

    // Apply search filter (entity name or owner name)
    if (searchTerm) {
      filtered = filtered.filter(r =>
        r.entityName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.ownerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.registrationNumber.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Apply custom filter (simplified - would need full implementation)
    if (selectedCustomFilter) {
      // Custom filter logic would go here
    }

    setFilteredRegistrations(filtered);
  };

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

  const handleViewRegistration = (registrationId: string) => {
    navigate(`/orgadmin/registrations/${registrationId}`);
  };

  const handleEditRegistration = (registrationId: string) => {
    navigate(`/orgadmin/registrations/${registrationId}/edit`);
  };

  const handleToggleProcessed = async (registrationId: string, currentStatus: boolean) => {
    try {
      await execute({
        method: 'PATCH',
        url: `/api/orgadmin/registrations/${registrationId}`,
      });
      loadRegistrations();
    } catch (error) {
      console.error('Failed to update processed status:', error);
    }
  };

  const handleBatchOperation = (operation: typeof batchOperation) => {
    setBatchOperation(operation);
    setBatchDialogOpen(true);
  };

  const handleExport = async () => {
    try {
      // Export logic would go here
      console.log('Exporting registrations...');
    } catch (error) {
      console.error('Failed to export registrations:', error);
    }
  };

  const formatDate = (dateString: Date | string) => {
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const getStatusColor = (status: string) => {
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
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">{t('registrations.registrationsDatabase')}</Typography>
        <Button
          variant="outlined"
          startIcon={<ExportIcon />}
          onClick={handleExport}
          disabled={filteredRegistrations.length === 0}
        >
          {t('registrations.actions.exportToExcel')}
        </Button>
      </Box>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 2 }}>
            <TextField
              placeholder="Search by entity name or owner name..."
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
            />
            <FormControl sx={{ minWidth: 200 }}>
              <InputLabel>Custom Filter</InputLabel>
              <Select
                value={selectedCustomFilter}
                label="Custom Filter"
                onChange={(e) => setSelectedCustomFilter(e.target.value)}
              >
                <MenuItem value="">None</MenuItem>
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
            >
              Create Filter
            </Button>
          </Box>

          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
            <ToggleButtonGroup
              value={statusFilter}
              exclusive
              onChange={(e, value) => value && setStatusFilter(value)}
              size="small"
            >
              <ToggleButton value="current">Current</ToggleButton>
              <ToggleButton value="elapsed">Elapsed</ToggleButton>
              <ToggleButton value="all">All</ToggleButton>
            </ToggleButtonGroup>

            {selectedRegistrations.length > 0 && (
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => handleBatchOperation('mark_processed')}
                >
                  Mark Processed
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => handleBatchOperation('mark_unprocessed')}
                >
                  Mark Unprocessed
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<LabelIcon />}
                  onClick={() => handleBatchOperation('add_labels')}
                >
                  Add Labels
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<LabelIcon />}
                  onClick={() => handleBatchOperation('remove_labels')}
                >
                  Remove Labels
                </Button>
              </Box>
            )}
          </Box>
        </CardContent>
      </Card>

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
              <TableCell>Registration Type</TableCell>
              <TableCell>Entity Name</TableCell>
              <TableCell>Registration Number</TableCell>
              <TableCell>Owner Name</TableCell>
              <TableCell>Date Last Renewed</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Valid Until</TableCell>
              <TableCell>Labels</TableCell>
              <TableCell>Processed</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={11} align="center">
                  Loading registrations...
                </TableCell>
              </TableRow>
            ) : filteredRegistrations.length === 0 ? (
              <TableRow>
                <TableCell colSpan={11} align="center">
                  {searchTerm || statusFilter !== 'current' || selectedCustomFilter
                    ? 'No registrations match your filters'
                    : 'No registrations yet.'}
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
                    <Typography variant="body2">
                      {/* Would show registration type name from join */}
                      Registration Type
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip label={registration.entityName} color="primary" size="small" />
                  </TableCell>
                  <TableCell>{registration.registrationNumber}</TableCell>
                  <TableCell>{registration.ownerName}</TableCell>
                  <TableCell>{formatDate(registration.dateLastRenewed)}</TableCell>
                  <TableCell>
                    <Chip
                      label={registration.status}
                      color={getStatusColor(registration.status)}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>{formatDate(registration.validUntil)}</TableCell>
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
                      title={registration.processed ? 'Mark Unprocessed' : 'Mark Processed'}
                    >
                      {registration.processed ? <ProcessedIcon color="success" /> : <UnprocessedIcon />}
                    </IconButton>
                  </TableCell>
                  <TableCell align="right">
                    <IconButton
                      size="small"
                      onClick={() => handleViewRegistration(registration.id)}
                      title="View Details"
                    >
                      <ViewIcon />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => handleEditRegistration(registration.id)}
                      title="Edit"
                    >
                      <EditIcon />
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
    </Box>
  );
};

export default RegistrationsDatabasePage;
