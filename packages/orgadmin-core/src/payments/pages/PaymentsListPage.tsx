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
  
  const [payments, setPayments] = useState<Payment[]>([]);
  const [filteredPayments, setFilteredPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'all' | Payment['status']>('all');
  const [paymentMethodFilter, setPaymentMethodFilter] = useState<'all' | Payment['paymentMethod']>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

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
    const headers = ['Date', 'Customer Name', 'Customer Email', 'Amount', 'Status', 'Type', 'Payment Method'];
    const rows = data.map(payment => [
      formatDate(payment.date),
      payment.customerName,
      payment.customerEmail,
      formatCurrency(payment.amount),
      payment.status,
      payment.type,
      payment.paymentMethod,
    ]);
    
    return [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
    ].join('\n');
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
    }).format(amount);
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

  const getTypeLabel = (type: Payment['type']) => {
    const labels: Record<Payment['type'], string> = {
      event: 'Event',
      membership: 'Membership',
      merchandise: 'Merchandise',
      calendar: 'Booking',
      registration: 'Registration',
      ticket: 'Ticket',
    };
    return labels[type] || type;
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">Payments</Typography>
        <Button
          variant="contained"
          color="primary"
          startIcon={<ExportIcon />}
          onClick={handleExportCSV}
          disabled={filteredPayments.length === 0}
        >
          Export to CSV
        </Button>
      </Box>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <TextField
              label="Start Date"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              sx={{ minWidth: 180 }}
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              label="End Date"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              sx={{ minWidth: 180 }}
              InputLabelProps={{ shrink: true }}
            />
            <FormControl sx={{ minWidth: 150 }}>
              <InputLabel>Status</InputLabel>
              <Select
                value={statusFilter}
                label="Status"
                onChange={(e) => setStatusFilter(e.target.value as any)}
              >
                <MenuItem value="all">All</MenuItem>
                <MenuItem value="pending">Pending</MenuItem>
                <MenuItem value="paid">Paid</MenuItem>
                <MenuItem value="refunded">Refunded</MenuItem>
                <MenuItem value="failed">Failed</MenuItem>
              </Select>
            </FormControl>
            <FormControl sx={{ minWidth: 180 }}>
              <InputLabel>Payment Method</InputLabel>
              <Select
                value={paymentMethodFilter}
                label="Payment Method"
                onChange={(e) => setPaymentMethodFilter(e.target.value as any)}
              >
                <MenuItem value="all">All</MenuItem>
                <MenuItem value="card">Card</MenuItem>
                <MenuItem value="cheque">Cheque</MenuItem>
                <MenuItem value="offline">Offline</MenuItem>
              </Select>
            </FormControl>
          </Box>
        </CardContent>
      </Card>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Date</TableCell>
              <TableCell>Customer</TableCell>
              <TableCell>Amount</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Type</TableCell>
              <TableCell>Payment Method</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} align="center">
                  Loading payments...
                </TableCell>
              </TableRow>
            ) : filteredPayments.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} align="center">
                  {statusFilter !== 'all' || paymentMethodFilter !== 'all' || startDate || endDate
                    ? 'No payments match your filters'
                    : 'No payments yet.'}
                </TableCell>
              </TableRow>
            ) : (
              filteredPayments.map((payment) => (
                <TableRow key={payment.id} hover>
                  <TableCell>{formatDate(payment.date)}</TableCell>
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
                      {formatCurrency(payment.amount)}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={payment.status}
                      color={getStatusColor(payment.status)}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>{getTypeLabel(payment.type)}</TableCell>
                  <TableCell sx={{ textTransform: 'capitalize' }}>
                    {payment.paymentMethod}
                  </TableCell>
                  <TableCell align="right">
                    <IconButton
                      size="small"
                      onClick={() => handleViewPayment(payment.id)}
                      title="View Details"
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
