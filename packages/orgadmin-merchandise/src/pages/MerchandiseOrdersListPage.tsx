/**
 * Merchandise Orders List Page
 * 
 * Displays all merchandise orders with filtering, batch operations, and Excel export.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
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
import { useApi, useOrganisation } from '@aws-web-framework/orgadmin-core';
import BatchOrderOperationsDialog from '../components/BatchOrderOperationsDialog';
import type { MerchandiseOrder, OrderStatus, PaymentStatus } from '../types/merchandise.types';

const MerchandiseOrdersListPage: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { execute } = useApi();
  const { organisation } = useOrganisation();
  const [orders, setOrders] = useState<MerchandiseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<'all' | PaymentStatus>('all');
  const [orderStatusFilter, setOrderStatusFilter] = useState<'all' | OrderStatus>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [batchDialogOpen, setBatchDialogOpen] = useState(false);

  const loadOrders = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (searchTerm) params.append('customerName', searchTerm);
      if (paymentStatusFilter !== 'all') params.append('paymentStatus', paymentStatusFilter);
      if (orderStatusFilter !== 'all') params.append('orderStatus', orderStatusFilter);
      if (dateFrom) params.append('dateFrom', dateFrom);
      if (dateTo) params.append('dateTo', dateTo);

      const queryString = params.toString();
      const url = `/api/orgadmin/organisations/${organisation?.id}/merchandise-orders${queryString ? `?${queryString}` : ''}`;

      const response = await execute({
        method: 'GET',
        url,
      });
      setOrders(response || []);
    } catch (err) {
      console.error('Failed to load orders:', err);
      setError(t('merchandise.errors.loadOrdersFailed'));
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, [organisation?.id, searchTerm, paymentStatusFilter, orderStatusFilter, dateFrom, dateTo]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  const handleSelectAll = (checked: boolean) => {
    setSelectedOrderIds(checked ? orders.map(o => o.id) : []);
  };

  const handleSelectOrder = (orderId: string, checked: boolean) => {
    setSelectedOrderIds(prev =>
      checked ? [...prev, orderId] : prev.filter(id => id !== orderId)
    );
  };

  const handleBatchUpdate = async (orderIds: string[], newStatus: OrderStatus, notes?: string) => {
    try {
      for (const orderId of orderIds) {
        await execute({
          method: 'PUT',
          url: `/api/orgadmin/merchandise-orders/${orderId}/status`,
          data: { status: newStatus, notes },
        });
      }
      await loadOrders();
      setSelectedOrderIds([]);
    } catch (err) {
      console.error('Failed to batch update orders:', err);
      setError(t('merchandise.errors.batchUpdateFailed'));
    }
  };

  const handleExport = async () => {
    try {
      const response = await execute({
        method: 'GET',
        url: `/api/orgadmin/organisations/${organisation?.id}/merchandise-orders/export`,
        responseType: 'blob',
      });
      const blob = new Blob([response], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'merchandise-orders.xlsx';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to export orders:', err);
      setError(t('merchandise.errors.exportFailed'));
    }
  };

  const handleViewOrder = (orderId: string) => {
    navigate(`/merchandise/orders/${orderId}`);
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">{t('merchandise.orders.title')}</Typography>
        <Button startIcon={<ExportIcon />} onClick={handleExport}>
          {t('merchandise.orders.exportToExcel')}
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

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
            <TextField
              label={t('merchandise.filters.dateFrom')}
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              InputLabelProps={{ shrink: true }}
              sx={{ minWidth: 160 }}
            />
            <TextField
              label={t('merchandise.filters.dateTo')}
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              InputLabelProps={{ shrink: true }}
              sx={{ minWidth: 160 }}
            />
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
                  checked={selectedOrderIds.length === orders.length && orders.length > 0}
                  indeterminate={selectedOrderIds.length > 0 && selectedOrderIds.length < orders.length}
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
            ) : orders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} align="center">
                  {t('merchandise.noOrdersFound')}
                </TableCell>
              </TableRow>
            ) : (
              orders.map((order) => (
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
