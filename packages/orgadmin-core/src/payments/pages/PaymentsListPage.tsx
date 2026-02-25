/**
 * Payments List Page
 * 
 * Displays a table of all payments with filters for date range, status, and payment method
 * Includes export to CSV functionality
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
  MenuItem,
  Select,
  FormControl,
  InputLabel,
} from '@mui/material';
import {
  Visibility as ViewIcon,
  FileDownload as ExportIcon,
} from '@mui/icons-material';
import { useApi } from '../../hooks/useApi';
import { useTranslation, useLocale, useOnboarding, formatDate, formatCurrency } from '@aws-web-framework/orgadmin-shell';

interface Payment {
  id: string;
  date: string;
  amount: number;
  status: 'pending' | 'paid' | 'refunded' | 'failed';
  type: 'event' | 'membership' | 'merchandise' | 'calendar' | 'registration' | 'ticket';
  paymentMethod: 'card' | 'cheque' | 'offline';
  customerName: string;
  customerEmail: string;
}

const PaymentsListPage: React.FC = () => {
  const navigate = useNavigate();
  const { execute } = useApi();
  const { t } = useTranslation();
  const { locale } = useLocale();
  const { checkModuleVisit } = useOnboarding();
  
  const [payments, setPayments] = useState<Payment[]>([]);
  const [filteredPayments, setFilteredPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'all' | Payment['status']>('all');
  const [paymentMethodFilter, setPaymentMethodFilter] = useState<'all' | Payment['paymentMethod']>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Check module visit for onboarding
  useEffect(() => {
    checkModuleVisit('payments');
  }, [checkModuleVisit]);

  useEffect(() => {
    loadPayments();
  }, []);

  useEffect(() => {
    filterPayments();
  }, [payments, statusFilter, paymentMethodFilter, startDate, endDate]);

  const loadPayments = async () => {
    try {
      setLoading(true);
      const response = await execute({
        method: 'GET',
        url: '/api/orgadmin/payments',
      });
      setPayments(response || []);
    } catch (error) {
      console.error('Failed to load payments:', error);
      setPayments([]);
    } finally {
      setLoading(false);
    }
  };

  const filterPayments = () => {
    let filtered = [...payments];

    // Apply status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(payment => payment.status === statusFilter);
    }

    // Apply payment method filter
    if (paymentMethodFilter !== 'all') {
      filtered = filtered.filter(payment => payment.paymentMethod === paymentMethodFilter);
    }

    // Apply date range filter
    if (startDate) {
      filtered = filtered.filter(payment => new Date(payment.date) >= new Date(startDate));
    }
    if (endDate) {
      filtered = filtered.filter(payment => new Date(payment.date) <= new Date(endDate));
    }

    setFilteredPayments(filtered);
  };

  const handleViewPayment = (paymentId: string) => {
    navigate(`/orgadmin/payments/${paymentId}`);
  };

  const handleExportCSV = async () => {
    try {
      await execute({
        method: 'GET',
        url: '/api/orgadmin/payments/export',
        params: {
          status: statusFilter !== 'all' ? statusFilter : undefined,
          paymentMethod: paymentMethodFilter !== 'all' ? paymentMethodFilter : undefined,
          startDate: startDate || undefined,
          endDate: endDate || undefined,
        },
      });
      
      // Create CSV content
      const csvContent = convertToCSV(filteredPayments);
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `payments_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Failed to export payments:', error);
    }
  };

  const convertToCSV = (data: Payment[]): string => {
    const headers = [
      t('payments.table.date'),
      t('payments.table.customer'),
      t('common.labels.email'),
      t('payments.table.amount'),
      t('payments.table.status'),
      t('payments.table.type'),
      t('payments.table.paymentMethod')
    ];
    const rows = data.map(payment => [
      formatDate(new Date(payment.date), 'dd MMM yyyy', locale),
      payment.customerName,
      payment.customerEmail,
      formatCurrency(payment.amount, 'GBP', locale),
      t(`common.status.${payment.status}`),
      t(`payments.paymentTypes.${payment.type}`),
      payment.paymentMethod,
    ]);
    
    return [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
    ].join('\n');
  };

  const getStatusColor = (status: Payment['status']) => {
    switch (status) {
      case 'paid':
        return 'success';
      case 'pending':
        return 'warning';
      case 'refunded':
        return 'info';
      case 'failed':
        return 'error';
      default:
        return 'default';
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">{t('payments.title')}</Typography>
        <Button
          variant="contained"
          color="primary"
          startIcon={<ExportIcon />}
          onClick={handleExportCSV}
          disabled={filteredPayments.length === 0}
        >
          {t('payments.actions.exportToCSV')}
        </Button>
      </Box>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <TextField
              label={t('payments.filters.startDate')}
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              sx={{ minWidth: 180 }}
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              label={t('payments.filters.endDate')}
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              sx={{ minWidth: 180 }}
              InputLabelProps={{ shrink: true }}
            />
            <FormControl sx={{ minWidth: 150 }}>
              <InputLabel>{t('payments.filters.status')}</InputLabel>
              <Select
                value={statusFilter}
                label={t('payments.filters.status')}
                onChange={(e) => setStatusFilter(e.target.value as any)}
              >
                <MenuItem value="all">{t('payments.statusOptions.all')}</MenuItem>
                <MenuItem value="pending">{t('payments.statusOptions.pending')}</MenuItem>
                <MenuItem value="paid">{t('payments.statusOptions.paid')}</MenuItem>
                <MenuItem value="refunded">{t('payments.statusOptions.refunded')}</MenuItem>
                <MenuItem value="failed">{t('payments.statusOptions.failed')}</MenuItem>
              </Select>
            </FormControl>
            <FormControl sx={{ minWidth: 180 }}>
              <InputLabel>{t('payments.filters.paymentMethod')}</InputLabel>
              <Select
                value={paymentMethodFilter}
                label={t('payments.filters.paymentMethod')}
                onChange={(e) => setPaymentMethodFilter(e.target.value as any)}
              >
                <MenuItem value="all">{t('payments.paymentMethodOptions.all')}</MenuItem>
                <MenuItem value="card">{t('payments.paymentMethodOptions.card')}</MenuItem>
                <MenuItem value="cheque">{t('payments.paymentMethodOptions.cheque')}</MenuItem>
                <MenuItem value="offline">{t('payments.paymentMethodOptions.offline')}</MenuItem>
              </Select>
            </FormControl>
          </Box>
        </CardContent>
      </Card>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>{t('payments.table.date')}</TableCell>
              <TableCell>{t('payments.table.customer')}</TableCell>
              <TableCell>{t('payments.table.amount')}</TableCell>
              <TableCell>{t('payments.table.status')}</TableCell>
              <TableCell>{t('payments.table.type')}</TableCell>
              <TableCell>{t('payments.table.paymentMethod')}</TableCell>
              <TableCell align="right">{t('payments.table.actions')}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} align="center">
                  {t('payments.loadingPayments')}
                </TableCell>
              </TableRow>
            ) : filteredPayments.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} align="center">
                  {statusFilter !== 'all' || paymentMethodFilter !== 'all' || startDate || endDate
                    ? t('payments.noMatchingPayments')
                    : t('payments.noPaymentsFound')}
                </TableCell>
              </TableRow>
            ) : (
              filteredPayments.map((payment) => (
                <TableRow key={payment.id} hover>
                  <TableCell>{formatDate(new Date(payment.date), 'dd MMM yyyy', locale)}</TableCell>
                  <TableCell>
                    <Typography variant="body2" fontWeight="medium">
                      {payment.customerName}
                    </Typography>
                    <Typography variant="caption" color="textSecondary">
                      {payment.customerEmail}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" fontWeight="medium">
                      {formatCurrency(payment.amount, 'GBP', locale)}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={t(`common.status.${payment.status}`)}
                      color={getStatusColor(payment.status)}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>{t(`payments.paymentTypes.${payment.type}`)}</TableCell>
                  <TableCell sx={{ textTransform: 'capitalize' }}>
                    {t(`payments.paymentMethodOptions.${payment.paymentMethod}`)}
                  </TableCell>
                  <TableCell align="right">
                    <IconButton
                      size="small"
                      onClick={() => handleViewPayment(payment.id)}
                      title={t('payments.tooltips.viewDetails')}
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
    </Box>
  );
};

export default PaymentsListPage;
