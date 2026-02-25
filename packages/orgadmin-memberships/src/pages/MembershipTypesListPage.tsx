/**
 * Membership Types List Page
 * 
 * Displays a table of all membership types with search and filter functionality
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
  Menu,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Visibility as ViewIcon,
  Search as SearchIcon,
  ArrowDropDown as ArrowDropDownIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { usePageHelp } from '@aws-web-framework/orgadmin-shell';
import type { MembershipType } from '../types/membership.types';

// Mock API hook - will be replaced with actual implementation
const useApi = () => ({
  execute: async (_params: { method: string; url: string }) => {
    // Mock data for development
    return [];
  },
});

const MembershipTypesListPage: React.FC = () => {
  const navigate = useNavigate();
  const { execute } = useApi();
  const { t } = useTranslation();
  
  const [membershipTypes, setMembershipTypes] = useState<MembershipType[]>([]);
  const [filteredTypes, setFilteredTypes] = useState<MembershipType[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'closed'>('all');
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'single' | 'group'>('all');
  const [createMenuAnchor, setCreateMenuAnchor] = useState<null | HTMLElement>(null);

  // Register page for contextual help
  usePageHelp('list');

  useEffect(() => {
    loadMembershipTypes();
  }, []);

  useEffect(() => {
    filterMembershipTypes();
  }, [membershipTypes, searchTerm, statusFilter, categoryFilter]);

  const loadMembershipTypes = async () => {
    try {
      setLoading(true);
      const response = await execute({
        method: 'GET',
        url: '/api/orgadmin/membership-types',
      });
      setMembershipTypes(response || []);
    } catch (error) {
      console.error('Failed to load membership types:', error);
      setMembershipTypes([]);
    } finally {
      setLoading(false);
    }
  };

  const filterMembershipTypes = () => {
    let filtered = [...membershipTypes];

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(type =>
        type.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        type.description.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Apply status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(type => type.membershipStatus === statusFilter);
    }

    // Apply category filter
    if (categoryFilter !== 'all') {
      filtered = filtered.filter(type => type.membershipTypeCategory === categoryFilter);
    }

    setFilteredTypes(filtered);
  };

  const handleCreateMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setCreateMenuAnchor(event.currentTarget);
  };

  const handleCreateMenuClose = () => {
    setCreateMenuAnchor(null);
  };

  const handleCreateSingle = () => {
    handleCreateMenuClose();
    navigate('/members/types/new/single');
  };

  const handleCreateGroup = () => {
    handleCreateMenuClose();
    navigate('/members/types/new/group');
  };

  const handleEditType = (typeId: string) => {
    navigate(`/orgadmin/members/types/${typeId}/edit`);
  };

  const handleViewType = (typeId: string) => {
    navigate(`/orgadmin/members/types/${typeId}`);
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

  const getCategoryLabel = (category: string) => {
    return category === 'single' ? t('memberships.typeOptions.single') : t('memberships.typeOptions.group');
  };

  const getPricingDisplay = (_type: MembershipType) => {
    // This will be enhanced when payment integration is complete
    return t('common.labels.configured');
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">{t('memberships.membershipTypes')}</Typography>
        <Button
          variant="contained"
          color="primary"
          startIcon={<AddIcon />}
          endIcon={<ArrowDropDownIcon />}
          onClick={handleCreateMenuOpen}
        >
          {t('memberships.createMembershipType')}
        </Button>
        <Menu
          anchorEl={createMenuAnchor}
          open={Boolean(createMenuAnchor)}
          onClose={handleCreateMenuClose}
        >
          <MenuItem onClick={handleCreateSingle}>{t('memberships.typeOptions.singleMembership')}</MenuItem>
          <MenuItem onClick={handleCreateGroup}>{t('memberships.typeOptions.groupMembership')}</MenuItem>
        </Menu>
      </Box>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <TextField
              placeholder={t('memberships.searchPlaceholder')}
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
              <InputLabel>{t('memberships.filters.status')}</InputLabel>
              <Select
                value={statusFilter}
                label={t('memberships.filters.status')}
                onChange={(e) => setStatusFilter(e.target.value as any)}
              >
                <MenuItem value="all">{t('memberships.statusOptions.all')}</MenuItem>
                <MenuItem value="open">{t('memberships.statusOptions.open')}</MenuItem>
                <MenuItem value="closed">{t('memberships.statusOptions.closed')}</MenuItem>
              </Select>
            </FormControl>
            <FormControl sx={{ minWidth: 150 }}>
              <InputLabel>{t('memberships.filters.type')}</InputLabel>
              <Select
                value={categoryFilter}
                label={t('memberships.filters.type')}
                onChange={(e) => setCategoryFilter(e.target.value as any)}
              >
                <MenuItem value="all">{t('memberships.typeOptions.all')}</MenuItem>
                <MenuItem value="single">{t('memberships.typeOptions.single')}</MenuItem>
                <MenuItem value="group">{t('memberships.typeOptions.group')}</MenuItem>
              </Select>
            </FormControl>
          </Box>
        </CardContent>
      </Card>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>{t('memberships.table.name')}</TableCell>
              <TableCell>{t('memberships.table.status')}</TableCell>
              <TableCell>{t('memberships.table.type')}</TableCell>
              <TableCell>{t('memberships.table.pricing')}</TableCell>
              <TableCell align="right">{t('memberships.table.actions')}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} align="center">
                  {t('memberships.loadingTypes')}
                </TableCell>
              </TableRow>
            ) : filteredTypes.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} align="center">
                  {searchTerm || statusFilter !== 'all' || categoryFilter !== 'all'
                    ? t('memberships.noMatchingTypes')
                    : t('memberships.noTypesFound')}
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
                      label={type.membershipStatus}
                      color={getStatusColor(type.membershipStatus)}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={getCategoryLabel(type.membershipTypeCategory)}
                      variant="outlined"
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
                      title={t('memberships.tooltips.viewDetails')}
                    >
                      <ViewIcon />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => handleEditType(type.id)}
                      title={t('memberships.tooltips.edit')}
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

export default MembershipTypesListPage;
