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
  TableContainer,
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
import { useTranslation } from '@aws-web-framework/orgadmin-shell';
import type { RegistrationType } from '../types/registration.types';

// Mock API hook - will be replaced with actual implementation
const useApi = () => ({
  execute: async ({ method, url }: { method: string; url: string }) => {
    // Mock data for development
    return [];
  },
});

const RegistrationTypesListPage: React.FC = () => {
  const navigate = useNavigate();
  const { execute } = useApi();
  const { t } = useTranslation();
  
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
        url: '/api/orgadmin/registration-types',
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
    navigate(`/orgadmin/registrations/types/${typeId}/edit`);
  };

  const handleViewType = (typeId: string) => {
    navigate(`/orgadmin/registrations/types/${typeId}`);
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

  const getPricingDisplay = (type: RegistrationType) => {
    // This will be enhanced when payment integration is complete
    return t('common.labels.configured');
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
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

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>{t('registrations.table.name')}</TableCell>
              <TableCell>{t('registrations.table.entityName')}</TableCell>
              <TableCell>{t('registrations.table.status')}</TableCell>
              <TableCell>{t('registrations.table.pricing')}</TableCell>
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
              filteredTypes.map((type) => (
                <TableRow key={type.id} hover>
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
                    {getPricingDisplay(type)}
                  </TableCell>
                  <TableCell align="right">
                    <IconButton
                      size="small"
                      onClick={() => handleViewType(type.id)}
                      title={t('registrations.tooltips.viewDetails')}
                    >
                      <ViewIcon />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => handleEditType(type.id)}
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
      </TableContainer>
    </Box>
  );
};

export default RegistrationTypesListPage;
