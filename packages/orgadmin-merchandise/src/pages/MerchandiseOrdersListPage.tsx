/**
 * Merchandise Orders List Page
 * 
 * Displays all merchandise orders with filtering, batch operations, and Excel export.
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
  Search as SearchIcon,
  Visibility as ViewIcon,
  FileDownload as ExportIcon,
} from '@mui/icons-material';
import { useTranslation, formatCurrency, formatDate } from '@aws-web-framework/orgadmin-shell';
import BatchOrderOperationsDialog from '../components/BatchOrderOperationsDialog';
import type { MerchandiseOrder, OrderStatus, PaymentStatus } from '../types/merchandise.types';

const MerchandiseOrdersListPage: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [orders, setOrders] = useState<MerchandiseOrder[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<MerchandiseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<'all' | PaymentStatus>('all');
  const [orderStatusFilter, setOrderStatusFilter] = useState<'all' | OrderStatus>('all');
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [batchDialogOpen, setBatchDialogOpen] = useState(false);

  useEffect(() => {
    loadOrders();
  }, []);

  useEffect(() => {
    filterOrders();
  }, [orders, searchTerm, paymentStatusFilter, orderStatusFilter]);

  const loadOrders = async () => {
    try {
      setLoading(true);
      // TODO: Implement API call
      setOrders([]);
    } catch (error) {
      console.error('Failed to load orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterOrders = () => {
    let filtered = [...orders];

    if (searchTerm) {
      filtered = filtered.filter(order =>
        order.customerName?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (paymentStatusFilter !== 'all') {
      filtered = filtered.filter(order => order.paymentStatus === paymentStatusFilter);
    }

    if (orderStatusFilter !== 'all') {
      filtered = filtered.filter(order => order.orderStatus === orderStatusFilter);
    }

    setFilteredOrders(filtered);
  };

  const handleSelectAll = (checked: boolean) => {
    setSelectedOrderIds(checked ? filteredOrders.map(o => o.id) : []);
  };

  const handleSelectOrder = (orderId: string, checked: boolean) => {
    setSelectedOrderIds(prev =>
      checked ? [...prev, orderId] : prev.filter(id => id !== orderId)
    );
  };

  const handleBatchUpdate = async (orderIds: string[], newStatus: OrderStatus, notes?: string) => {
    // TODO: Implement API call
    console.log('Batch update:', { orderIds, newStatus, notes });
    await loadOrders();
    setSelectedOrderIds([]);
  };

  const handleExport = () => {
    // TODO: Implement Excel export
    console.log('Exporting orders...');
  };

  const handleViewOrder = (orderId: string) => {
    navigate(`/orgadmin/merchandise/orders/${orderId}`);
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">{t('merchandise.orders.title')}</Typography>
        <Button startIcon={<ExportIcon />} onClick={handleExport}>
          {t('merchandise.orders.exportToExcel')}
        </Button>
      </Box>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 2 }}>
            <TextField
              placeholder={t('merchandise.searchOrdersPlaceholder')}
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
              <InputLabel>{t('merchandise.filters.paymentStatus')}</InputLabel>
              <Select
                value={paymentStatusFilter}
                label={t('merchandise.filters.paymentStatus')}
                onChange={(e) => setPaymentStatusFilter(e.target.value as any)}
              >
                <MenuItem value="all">{t('merchandise.paymentStatusOptions.all')}</MenuItem>
                <MenuItem value="pending">{t('merchandise.paymentStatusOptions.pending')}</MenuItem>
                <MenuItem value="paid">{t('merchandise.paymentStatusOptions.paid')}</MenuItem>
                <MenuItem value="refunded">{t('merchandise.paymentStatusOptions.refunded')}</MenuItem>
              </Select>
            </FormControl>
            <FormControl sx={{ minWidth: 150 }}>
              <InputLabel>{t('merchandise.filters.orderStatus')}</InputLabel>
              <Select
                value={orderStatusFilter}
                label={t('merchandise.filters.orderStatus')}
                onChange={(e) => setOrderStatusFilter(e.target.value as any)}
              >
                <MenuItem value="all">{t('merchandise.orderStatusOptions.all')}</MenuItem>
                <MenuItem value="pending">{t('merchandise.orderStatusOptions.pending')}</MenuItem>
                <MenuItem value="processing">{t('merchandise.orderStatusOptions.processing')}</MenuItem>
                <MenuItem value="shipped">{t('merchandise.orderStatusOptions.shipped')}</MenuItem>
                <MenuItem value="delivered">{t('merchandise.orderStatusOptions.delivered')}</MenuItem>
                <MenuItem value="cancelled">{t('merchandise.orderStatusOptions.cancelled')}</MenuItem>
              </Select>
            </FormControl>
          </Box>

          {selectedOrderIds.length > 0 && (
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
              <Typography variant="body2">
                {t('merchandise.orders.selectedOrders', { 
                  count: selectedOrderIds.length,
                  plural: selectedOrderIds.length !== 1 ? 's' : ''
                })}
              </Typography>
              <Button
                size="small"
                variant="outlined"
                onClick={() => setBatchDialogOpen(true)}
              >
                {t('merchandise.orders.updateStatus')}
              </Button>
            </Box>
          )}
        </CardContent>
      </Card>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell padding="checkbox">
                <Checkbox
                  checked={selectedOrderIds.length === filteredOrders.length && filteredOrders.length > 0}
                  indeterminate={selectedOrderIds.length > 0 && selectedOrderIds.length < filteredOrders.length}
                  onChange={(e) => handleSelectAll(e.target.checked)}
                />
              </TableCell>
              <TableCell>{t('merchandise.table.orderId')}</TableCell>
              <TableCell>{t('merchandise.table.customer')}</TableCell>
              <TableCell>{t('merchandise.table.merchandise')}</TableCell>
              <TableCell>{t('merchandise.table.quantity')}</TableCell>
              <TableCell>{t('merchandise.table.total')}</TableCell>
              <TableCell>{t('merchandise.table.payment')}</TableCell>
              <TableCell>{t('merchandise.table.orderStatus')}</TableCell>
              <TableCell>{t('merchandise.table.date')}</TableCell>
              <TableCell align="right">{t('merchandise.table.actions')}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={10} align="center">
                  {t('merchandise.loadingOrders')}
                </TableCell>
              </TableRow>
            ) : filteredOrders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} align="center">
                  {t('merchandise.noOrdersFound')}
                </TableCell>
              </TableRow>
            ) : (
              filteredOrders.map((order) => (
                <TableRow key={order.id} hover>
                  <TableCell padding="checkbox">
                    <Checkbox
                      checked={selectedOrderIds.includes(order.id)}
                      onChange={(e) => handleSelectOrder(order.id, e.target.checked)}
                    />
                  </TableCell>
                  <TableCell>{order.id}</TableCell>
                  <TableCell>{order.customerName || 'N/A'}</TableCell>
                  <TableCell>{order.merchandiseType?.name || 'N/A'}</TableCell>
                  <TableCell>{order.quantity}</TableCell>
                  <TableCell>{formatCurrency(order.totalPrice, 'EUR')}</TableCell>
                  <TableCell>
                    <Chip label={order.paymentStatus} size="small" />
                  </TableCell>
                  <TableCell>
                    <Chip label={order.orderStatus} size="small" />
                  </TableCell>
                  <TableCell>{formatDate(new Date(order.orderDate))}</TableCell>
                  <TableCell align="right">
                    <IconButton size="small" onClick={() => handleViewOrder(order.id)}>
                      <ViewIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <BatchOrderOperationsDialog
        open={batchDialogOpen}
        selectedOrderIds={selectedOrderIds}
        onClose={() => setBatchDialogOpen(false)}
        onUpdate={handleBatchUpdate}
      />
    </Box>
  );
};

export default MerchandiseOrdersListPage;
