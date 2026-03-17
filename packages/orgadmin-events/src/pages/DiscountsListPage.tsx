/**
 * Discounts List Page
 * 
 * Displays all discounts for the Events module.
 * Only visible if organisation has 'entry-discounts' capability enabled.
 * 
 * Features:
 * - Table view with columns: name, type, value, scope, status, usage count, actions
 * - Filters for status, discount type, and application scope
 * - Search by name or code
 * - Actions: edit, activate/deactivate, delete, view usage
 * - Pagination with 50 items per page
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Card,
  CardContent,
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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  Chip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  Tooltip,
  TablePagination,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Search as SearchIcon,
  ToggleOn as ActivateIcon,
  ToggleOff as DeactivateIcon,
  Assessment as StatsIcon,
} from '@mui/icons-material';
import { useApi, useOrganisation } from '@aws-web-framework/orgadmin-core';
import { usePageHelp, useOnboarding, formatCurrency, useLocale } from '@aws-web-framework/orgadmin-shell';
import type { Discount, DiscountStatus, DiscountType, ApplicationScope } from '../types/discount.types';

interface DiscountsListPageProps {
  moduleType?: 'events' | 'memberships' | 'registrations';
}

const DiscountsListPage: React.FC<DiscountsListPageProps> = ({ moduleType = 'events' }) => {
  // Register help content for this page
  usePageHelp('discounts');

  const navigate = useNavigate();
  const { execute, error: apiError } = useApi();
  const { organisation } = useOrganisation();
  const { setCurrentModule } = useOnboarding();
  const { locale } = useLocale();
  
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [filteredDiscounts, setFilteredDiscounts] = useState<Discount[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<DiscountStatus | 'all'>('all');
  const [typeFilter, setTypeFilter] = useState<DiscountType | 'all'>('all');
  const [scopeFilter, setScopeFilter] = useState<ApplicationScope | 'all'>('all');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingDiscount, setDeletingDiscount] = useState<Discount | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(50);

  // Set current module for help context
  useEffect(() => {
    setCurrentModule(moduleType === 'memberships' ? 'memberships' : moduleType === 'registrations' ? 'registrations' : 'events');
  }, [setCurrentModule, moduleType]);

  useEffect(() => {
    if (organisation?.id) {
      loadDiscounts();
    }
  }, [organisation?.id]);

  useEffect(() => {
    filterDiscounts();
  }, [discounts, searchTerm, statusFilter, typeFilter, scopeFilter]);

  const loadDiscounts = async () => {
    if (!organisation?.id) return;
    
    setLoading(true);
    
    const response = await execute({
      method: 'GET',
      url: `/api/orgadmin/organisations/${organisation.id}/discounts/${moduleType}`,
    });
    
    // If response is null, the API call failed and useApi has set the error state
    if (response === null) {
      setDiscounts([]);
      setLoading(false);
      return;
    }
    
    // Extract the discounts array from the response object
    const discountsArray = response?.discounts || [];
    
    // Transform dates from strings to Date objects
    const transformedDiscounts = discountsArray.map((discount: any) => ({
      ...discount,
      validFrom: discount.validFrom ? new Date(discount.validFrom) : undefined,
      validUntil: discount.validUntil ? new Date(discount.validUntil) : undefined,
      createdAt: new Date(discount.createdAt),
      updatedAt: new Date(discount.updatedAt),
    }));
    
    setDiscounts(transformedDiscounts);
    setLoading(false);
  };

  const filterDiscounts = () => {
    let filtered = [...discounts];

    // Apply search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(discount =>
        discount.name.toLowerCase().includes(term) ||
        discount.description?.toLowerCase().includes(term) ||
        discount.code?.toLowerCase().includes(term)
      );
    }

    // Apply status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(discount => discount.status === statusFilter);
    }

    // Apply type filter
    if (typeFilter !== 'all') {
      filtered = filtered.filter(discount => discount.discountType === typeFilter);
    }

    // Apply scope filter
    if (scopeFilter !== 'all') {
      filtered = filtered.filter(discount => discount.applicationScope === scopeFilter);
    }

    setFilteredDiscounts(filtered);
    setPage(0); // Reset to first page when filters change
  };

  const handleCreate = () => {
    const basePath = moduleType === 'memberships' ? '/members' : moduleType === 'registrations' ? '/registrations' : '/events';
    navigate(`${basePath}/discounts/new`);
  };

  const handleEdit = (discount: Discount) => {
    const basePath = moduleType === 'memberships' ? '/members' : moduleType === 'registrations' ? '/registrations' : '/events';
    navigate(`${basePath}/discounts/${discount.id}/edit`);
  };

  const handleToggleStatus = async (discount: Discount) => {
    if (!organisation?.id) return;
    
    try {
      const newStatus = discount.status === 'active' ? 'inactive' : 'active';
      await execute({
        method: 'PUT',
        url: `/api/orgadmin/discounts/${discount.id}`,
        data: { 
          organisationId: organisation.id,
          status: newStatus 
        },
      });
      loadDiscounts();
    } catch (error) {
      console.error('Failed to update discount status:', error);
      setLocalError('Failed to update discount status');
    }
  };

  const handleDeleteClick = (discount: Discount) => {
    setDeletingDiscount(discount);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deletingDiscount || !organisation?.id) return;
    
    try {
      await execute({
        method: 'DELETE',
        url: `/api/orgadmin/discounts/${deletingDiscount.id}?organisationId=${organisation.id}`,
      });
      setDeleteDialogOpen(false);
      setDeletingDiscount(null);
      loadDiscounts();
    } catch (error) {
      console.error('Failed to delete discount:', error);
      setLocalError('Failed to delete discount. It may be in use by existing events or activities.');
    }
  };

  const handleViewStats = (discount: Discount) => {
    const basePath = moduleType === 'memberships' ? '/members' : moduleType === 'registrations' ? '/registrations' : '/events';
    navigate(`${basePath}/discounts/${discount.id}/stats`);
  };

  const getStatusColor = (status: DiscountStatus): 'success' | 'default' | 'error' => {
    switch (status) {
      case 'active': return 'success';
      case 'inactive': return 'default';
      case 'expired': return 'error';
      default: return 'default';
    }
  };

  const formatDiscountValue = (discount: Discount): string => {
    return discount.discountType === 'percentage'
      ? `${discount.discountValue}%`
      : formatCurrency(discount.discountValue, organisation?.currency || 'EUR', locale);
  };

  const formatScope = (scope: ApplicationScope): string => {
    return scope.split('-').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  };

  const getUsageCount = (discount: Discount): number => {
    return discount.usageLimits?.currentUsageCount || 0;
  };

  const getRemainingUses = (discount: Discount): string => {
    const current = getUsageCount(discount);
    const limit = discount.usageLimits?.totalUsageLimit;
    
    if (!limit) return 'Unlimited';
    
    const remaining = limit - current;
    return remaining > 0 ? `${remaining} left` : 'Limit reached';
  };

  // Pagination
  const handleChangePage = (_event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const paginatedDiscounts = filteredDiscounts.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage
  );

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">
          {moduleType === 'memberships' ? 'Membership Discounts' : moduleType === 'registrations' ? 'Registration Discounts' : 'Event Discounts'}
        </Typography>
        <Button
          variant="contained"
          color="primary"
          startIcon={<AddIcon />}
          onClick={handleCreate}
        >
          Create Discount
        </Button>
      </Box>

      {(apiError || localError) && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setLocalError(null)}>
          {apiError || localError}
        </Alert>
      )}

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={2}>
            <Grid item xs={12} md={4}>
              <TextField
                placeholder="Search by name, description, or code..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                fullWidth
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon />
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>
            <Grid item xs={12} md={2}>
              <FormControl fullWidth>
                <InputLabel>Status</InputLabel>
                <Select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as DiscountStatus | 'all')}
                  label="Status"
                >
                  <MenuItem value="all">All Statuses</MenuItem>
                  <MenuItem value="active">Active</MenuItem>
                  <MenuItem value="inactive">Inactive</MenuItem>
                  <MenuItem value="expired">Expired</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={3}>
              <FormControl fullWidth>
                <InputLabel>Type</InputLabel>
                <Select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value as DiscountType | 'all')}
                  label="Type"
                >
                  <MenuItem value="all">All Types</MenuItem>
                  <MenuItem value="percentage">Percentage</MenuItem>
                  <MenuItem value="fixed">Fixed Amount</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={3}>
              <FormControl fullWidth>
                <InputLabel>Scope</InputLabel>
                <Select
                  value={scopeFilter}
                  onChange={(e) => setScopeFilter(e.target.value as ApplicationScope | 'all')}
                  label="Scope"
                >
                  <MenuItem value="all">All Scopes</MenuItem>
                  <MenuItem value="item">Item</MenuItem>
                  <MenuItem value="category">Category</MenuItem>
                  <MenuItem value="cart">Cart</MenuItem>
                  <MenuItem value="quantity-based">Quantity-based</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Type</TableCell>
              <TableCell>Value</TableCell>
              <TableCell>Scope</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Usage</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} align="center">
                  Loading...
                </TableCell>
              </TableRow>
            ) : paginatedDiscounts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} align="center">
                  {searchTerm || statusFilter !== 'all' || typeFilter !== 'all' || scopeFilter !== 'all'
                    ? 'No matching discounts found'
                    : 'No discounts yet. Create your first discount to get started.'}
                </TableCell>
              </TableRow>
            ) : (
              paginatedDiscounts.map((discount) => (
                <TableRow key={discount.id} hover>
                  <TableCell>
                    <Typography variant="body1" fontWeight="medium">
                      {discount.name}
                    </Typography>
                    {discount.code && (
                      <Typography variant="caption" color="textSecondary">
                        Code: {discount.code}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={discount.discountType === 'percentage' ? 'Percentage' : 'Fixed Amount'}
                      size="small"
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" fontWeight="medium">
                      {formatDiscountValue(discount)}
                    </Typography>
                  </TableCell>
                  <TableCell>{formatScope(discount.applicationScope)}</TableCell>
                  <TableCell>
                    <Chip
                      label={discount.status}
                      size="small"
                      color={getStatusColor(discount.status)}
                    />
                  </TableCell>
                  <TableCell>
                    <Tooltip title={getRemainingUses(discount)}>
                      <Typography variant="body2">
                        {getUsageCount(discount)}
                        {discount.usageLimits?.totalUsageLimit && ` / ${discount.usageLimits.totalUsageLimit}`}
                      </Typography>
                    </Tooltip>
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip title="Edit">
                      <IconButton
                        size="small"
                        onClick={() => handleEdit(discount)}
                      >
                        <EditIcon />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title={discount.status === 'active' ? 'Deactivate' : 'Activate'}>
                      <IconButton
                        size="small"
                        onClick={() => handleToggleStatus(discount)}
                        disabled={discount.status === 'expired'}
                      >
                        {discount.status === 'active' ? <DeactivateIcon /> : <ActivateIcon />}
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="View Usage Stats">
                      <IconButton
                        size="small"
                        onClick={() => handleViewStats(discount)}
                      >
                        <StatsIcon />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete">
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => handleDeleteClick(discount)}
                      >
                        <DeleteIcon />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        <TablePagination
          rowsPerPageOptions={[25, 50, 100]}
          component="div"
          count={filteredDiscounts.length}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
        />
      </TableContainer>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Delete Discount</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete the discount "{deletingDiscount?.name}"?
          </Typography>
          <Typography variant="body2" color="textSecondary" sx={{ mt: 2 }}>
            This action cannot be undone. All applications of this discount will be removed.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleDeleteConfirm}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default DiscountsListPage;
