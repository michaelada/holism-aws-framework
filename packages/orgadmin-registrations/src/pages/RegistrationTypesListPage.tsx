/**
 * Registration Types List Page
 * 
 * Displays a table of all registration types with search and filter functionality
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  IconButton,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
  InputAdornment,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Visibility as ViewIcon,
  Search as SearchIcon,
} from '@mui/icons-material';
import { useTranslation, useOnboarding, usePageHelp } from '@itsplainsailing/orgadmin-shell';
import {
  useApi,
  useOrganisation,
  ResponsiveTable,
  SortableTableCell,
  useTableSort,
} from '@itsplainsailing/orgadmin-core';
import type { RegistrationType } from '../types/registration.types';

const RegistrationTypesListPage: React.FC = () => {
  const navigate = useNavigate();
  const { execute } = useApi();
  const { t } = useTranslation();
  const { organisation } = useOrganisation();
  const { setCurrentModule, checkModuleVisit } = useOnboarding();

  // Register page for contextual help
  usePageHelp('list');

  useEffect(() => {
    setCurrentModule('registrations');
    checkModuleVisit('registrations');
  }, [setCurrentModule, checkModuleVisit]);
  
  const [registrationTypes, setRegistrationTypes] = useState<RegistrationType[]>([]);
  const [filteredTypes, setFilteredTypes] = useState<RegistrationType[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'closed'>('all');

  useEffect(() => {
    loadRegistrationTypes();
  }, []);

  useEffect(() => {
    filterRegistrationTypes();
  }, [registrationTypes, searchTerm, statusFilter]);

  const loadRegistrationTypes = async () => {
    try {
      setLoading(true);
      const response = await execute({
        method: 'GET',
        url: `/api/orgadmin/organisations/${organisation?.id}/registration-types`,
      });
      setRegistrationTypes(response || []);
    } catch (error) {
      console.error('Failed to load registration types:', error);
      setRegistrationTypes([]);
    } finally {
      setLoading(false);
    }
  };

  const filterRegistrationTypes = () => {
    let filtered = [...registrationTypes];

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(type =>
        type.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        type.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        type.entityName.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Apply status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(type => type.registrationStatus === statusFilter);
    }

    setFilteredTypes(filtered);
  };

  const handleCreateType = () => {
    navigate('/registrations/types/new');
  };

  const handleEditType = (typeId: string) => {
    navigate(`/registrations/types/${typeId}/edit`);
  };

  const handleViewType = (typeId: string) => {
    navigate(`/registrations/types/${typeId}`);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open':
        return 'success';
      case 'closed':
        return 'default';
      default:
        return 'default';
    }
  };

  const sort = useTableSort(filteredTypes);

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3,
        // Wraps rather than overflowing: a non-wrapping header row pushed
        // page actions past the right edge of a phone, with nothing on
        // screen to show the page had scrolled.
        flexWrap: 'wrap', gap: 2 }}>
        <Typography variant="h4">{t('registrations.registrationTypes')}</Typography>
        <Button
          variant="contained"
          color="primary"
          startIcon={<AddIcon />}
          onClick={handleCreateType}
        >
          {t('registrations.createRegistrationType')}
        </Button>
      </Box>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
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
            />
            <FormControl sx={{ minWidth: 150 }}>
              <InputLabel>{t('registrations.filters.status')}</InputLabel>
              <Select
                value={statusFilter}
                label={t('registrations.filters.status')}
                onChange={(e) => setStatusFilter(e.target.value as any)}
              >
                <MenuItem value="all">{t('registrations.statusOptions.all')}</MenuItem>
                <MenuItem value="open">{t('registrations.statusOptions.open')}</MenuItem>
                <MenuItem value="closed">{t('registrations.statusOptions.closed')}</MenuItem>
              </Select>
            </FormControl>
          </Box>
        </CardContent>
      </Card>

      <ResponsiveTable identityColumn={t('registrations.table.name')} component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <SortableTableCell sort={sort} field="name">
                {t('registrations.table.name')}
              </SortableTableCell>
              <SortableTableCell sort={sort} field="entityName">
                {t('registrations.table.entityName')}
              </SortableTableCell>
              <SortableTableCell sort={sort} field="status">
                {t('registrations.table.status')}
              </SortableTableCell>
              <SortableTableCell sort={sort} field="createdAt">
                {t('registrations.table.createdAt')}
              </SortableTableCell>
              <TableCell align="right">{t('registrations.table.actions')}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} align="center">
                  {t('registrations.loadingTypes')}
                </TableCell>
              </TableRow>
            ) : filteredTypes.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} align="center">
                  {searchTerm || statusFilter !== 'all'
                    ? t('registrations.noMatchingTypes')
                    : t('registrations.noTypesFound')}
                </TableCell>
              </TableRow>
            ) : (
              sort.rows.map((type) => (
                <TableRow
                  key={type.id}
                  hover
                  onClick={() => handleViewType(type.id)}
                  sx={{ cursor: 'pointer' }}
                >
                  <TableCell>
                    <Typography variant="body1" fontWeight="medium">
                      {type.name}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {type.description}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={type.entityName}
                      variant="outlined"
                      size="small"
                      color="primary"
                    />
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={type.registrationStatus}
                      color={getStatusColor(type.registrationStatus)}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    {type.createdAt ? new Date(type.createdAt).toLocaleDateString() : '-'}
                  </TableCell>
                  <TableCell align="right">
                    <IconButton
                      size="small"
                      onClick={(e) => { e.stopPropagation(); handleViewType(type.id); }}
                      title={t('registrations.tooltips.viewDetails')}
                    >
                      <ViewIcon />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={(e) => { e.stopPropagation(); handleEditType(type.id); }}
                      title={t('registrations.tooltips.edit')}
                    >
                      <EditIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </ResponsiveTable>
    </Box>
  );
};

export default RegistrationTypesListPage;
