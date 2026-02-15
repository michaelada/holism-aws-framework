/**
 * Merchandise Types List Page
 * 
 * Displays a table of all merchandise types with search and filter functionality.
 * Shows status badges (Active/Inactive) and stock indicators if tracking enabled.
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
  Inventory as StockIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
} from '@mui/icons-material';
import { useTranslation, formatCurrency } from '@aws-web-framework/orgadmin-shell';
import type { MerchandiseType, StockLevel } from '../types/merchandise.types';

// Mock API hook - will be replaced with actual implementation
const useApi = () => ({
  execute: async ({ method, url }: { method: string; url: string }) => {
    // Mock data for development
    return [];
  },
});

const MerchandiseTypesListPage: React.FC = () => {
  const navigate = useNavigate();
  const { execute } = useApi();
  const { t } = useTranslation();
  
  const [merchandiseTypes, setMerchandiseTypes] = useState<MerchandiseType[]>([]);
  const [filteredTypes, setFilteredTypes] = useState<MerchandiseType[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [stockFilter, setStockFilter] = useState<'all' | 'in_stock' | 'low_stock' | 'out_of_stock'>('all');

  useEffect(() => {
    loadMerchandiseTypes();
  }, []);

  useEffect(() => {
    filterMerchandiseTypes();
  }, [merchandiseTypes, searchTerm, statusFilter, stockFilter]);

  const loadMerchandiseTypes = async () => {
    try {
      setLoading(true);
      const response = await execute({
        method: 'GET',
        url: '/api/orgadmin/merchandise-types',
      });
      setMerchandiseTypes(response || []);
    } catch (error) {
      console.error('Failed to load merchandise types:', error);
      setMerchandiseTypes([]);
    } finally {
      setLoading(false);
    }
  };

  const filterMerchandiseTypes = () => {
    let filtered = [...merchandiseTypes];

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(type =>
        type.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        type.description.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Apply status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(type => type.status === statusFilter);
    }

    // Apply stock filter
    if (stockFilter !== 'all' && stockFilter !== 'in_stock') {
      filtered = filtered.filter(type => {
        if (!type.trackStockLevels) return false;
        const stockLevel = getStockLevel(type);
        return stockLevel === stockFilter;
      });
    } else if (stockFilter === 'in_stock') {
      filtered = filtered.filter(type => {
        if (!type.trackStockLevels) return true; // No tracking = always in stock
        const stockLevel = getStockLevel(type);
        return stockLevel === 'in_stock';
      });
    }

    setFilteredTypes(filtered);
  };

  const getStockLevel = (type: MerchandiseType): StockLevel => {
    if (!type.trackStockLevels) return 'in_stock';
    
    // Check all option values for stock levels
    let hasOutOfStock = false;
    let hasLowStock = false;
    
    for (const optionType of type.optionTypes) {
      for (const optionValue of optionType.optionValues) {
        const quantity = optionValue.stockQuantity || 0;
        if (quantity === 0) {
          hasOutOfStock = true;
        } else if (type.lowStockAlert && quantity <= type.lowStockAlert) {
          hasLowStock = true;
        }
      }
    }
    
    if (hasOutOfStock) return 'out_of_stock';
    if (hasLowStock) return 'low_stock';
    return 'in_stock';
  };

  const handleCreateType = () => {
    navigate('/merchandise/new');
  };

  const handleEditType = (typeId: string) => {
    navigate(`/orgadmin/merchandise/${typeId}/edit`);
  };

  const handleViewType = (typeId: string) => {
    navigate(`/orgadmin/merchandise/${typeId}`);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'success';
      case 'inactive':
        return 'default';
      default:
        return 'default';
    }
  };

  const getPriceRange = (type: MerchandiseType): string => {
    if (type.optionTypes.length === 0) {
      return t('merchandise.pricing.noOptions');
    }
    
    const prices = type.optionTypes.flatMap(ot => 
      ot.optionValues.map(ov => ov.price)
    );
    
    if (prices.length === 0) return t('merchandise.pricing.noPricing');
    
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    
    if (minPrice === maxPrice) {
      return formatCurrency(minPrice, 'EUR');
    }
    
    return `${formatCurrency(minPrice, 'EUR')} - ${formatCurrency(maxPrice, 'EUR')}`;
  };

  const renderStockIndicator = (type: MerchandiseType) => {
    if (!type.trackStockLevels) {
      return (
        <Chip
          label={t('merchandise.stock.notTracked')}
          size="small"
          variant="outlined"
        />
      );
    }
    
    const stockLevel = getStockLevel(type);
    
    switch (stockLevel) {
      case 'in_stock':
        return (
          <Chip
            icon={<CheckCircleIcon />}
            label={t('merchandise.stock.inStock')}
            color="success"
            size="small"
          />
        );
      case 'low_stock':
        return (
          <Chip
            icon={<WarningIcon />}
            label={t('merchandise.stock.lowStock')}
            color="warning"
            size="small"
          />
        );
      case 'out_of_stock':
        return (
          <Chip
            icon={<WarningIcon />}
            label={t('merchandise.stock.outOfStock')}
            color="error"
            size="small"
          />
        );
      default:
        return null;
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">{t('merchandise.title')}</Typography>
        <Button
          variant="contained"
          color="primary"
          startIcon={<AddIcon />}
          onClick={handleCreateType}
        >
          {t('merchandise.createMerchandiseType')}
        </Button>
      </Box>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <TextField
              placeholder={t('merchandise.searchPlaceholder')}
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
              <InputLabel>{t('merchandise.filters.status')}</InputLabel>
              <Select
                value={statusFilter}
                label={t('merchandise.filters.status')}
                onChange={(e) => setStatusFilter(e.target.value as any)}
              >
                <MenuItem value="all">{t('merchandise.statusOptions.all')}</MenuItem>
                <MenuItem value="active">{t('merchandise.statusOptions.active')}</MenuItem>
                <MenuItem value="inactive">{t('merchandise.statusOptions.inactive')}</MenuItem>
              </Select>
            </FormControl>
            <FormControl sx={{ minWidth: 150 }}>
              <InputLabel>{t('merchandise.filters.stockLevel')}</InputLabel>
              <Select
                value={stockFilter}
                label={t('merchandise.filters.stockLevel')}
                onChange={(e) => setStockFilter(e.target.value as any)}
              >
                <MenuItem value="all">{t('merchandise.stockOptions.all')}</MenuItem>
                <MenuItem value="in_stock">{t('merchandise.stockOptions.inStock')}</MenuItem>
                <MenuItem value="low_stock">{t('merchandise.stockOptions.lowStock')}</MenuItem>
                <MenuItem value="out_of_stock">{t('merchandise.stockOptions.outOfStock')}</MenuItem>
              </Select>
            </FormControl>
          </Box>
        </CardContent>
      </Card>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>{t('merchandise.table.name')}</TableCell>
              <TableCell>{t('merchandise.table.status')}</TableCell>
              <TableCell>{t('merchandise.table.priceRange')}</TableCell>
              <TableCell>{t('merchandise.table.stockStatus')}</TableCell>
              <TableCell align="right">{t('merchandise.table.actions')}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} align="center">
                  {t('merchandise.loadingTypes')}
                </TableCell>
              </TableRow>
            ) : filteredTypes.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} align="center">
                  {searchTerm || statusFilter !== 'all' || stockFilter !== 'all'
                    ? t('merchandise.noMatchingTypes')
                    : t('merchandise.noTypesFound')}
                </TableCell>
              </TableRow>
            ) : (
              filteredTypes.map((type) => (
                <TableRow key={type.id} hover>
                  <TableCell>
                    <Typography variant="body1" fontWeight="medium">
                      {type.name}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" noWrap sx={{ maxWidth: 300 }}>
                      {type.description}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={type.status}
                      color={getStatusColor(type.status)}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    {getPriceRange(type)}
                  </TableCell>
                  <TableCell>
                    {renderStockIndicator(type)}
                  </TableCell>
                  <TableCell align="right">
                    <IconButton
                      size="small"
                      onClick={() => handleViewType(type.id)}
                      title={t('merchandise.tooltips.viewDetails')}
                    >
                      <ViewIcon />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => handleEditType(type.id)}
                      title={t('merchandise.tooltips.edit')}
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

export default MerchandiseTypesListPage;
