/**
 * Payments List Page
 * 
 * Displays a table of all payments with filters for date range, status, and payment method
 * Includes export to CSV functionality
 */

import React, { useState, useEffect } from 'react';
import { ResponsiveTable, SortableTableCell } from '../../components';
import { useTableSort } from '../../hooks/useTableSort';
import { useCurrency } from '../../hooks/useCurrency';
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
import { useTranslation, useLocale, useOnboarding, usePageHelp, formatDate } from '@itsplainsailing/orgadmin-shell';

/**
 * A payment, named the way the API names one.
 *
 * This interface used to describe fields the endpoint has never returned —
 * `date`, `status`, `type`, `customerName`, `customerEmail`. Nothing failed:
 * TypeScript was told the shape and believed it, so every row rendered
 * `Invalid Date` from `new Date(undefined)` and looked up
 * `common.status.undefined`. A hand-written interface over an untyped response
 * is an assertion, not a check.
 */
interface Payment {
  id: string;
  /** Set when the money moved. Null on a payment still owed. */
  paymentDate: string | null;
  createdAt: string;
  amount: number;
  paymentStatus: string;
  paymentType: string;
  paymentMethod: string;
  userName: string | null;
  userEmail: string | null;
  /**
   * The kinds of thing in the basket, from the payment's lines.
   *
   * Absent on an older response; empty on a payment with no lines. Either way
   * `paymentType` is the fallback.
   */
  itemTypes?: string[];
}

/**
 * When the payment happened, for display and for filtering.
 *
 * `payment_date` is the moment the money moved and is null until it does, so an
 * unpaid payment falls back to when it was raised — otherwise the row it is
 * most important to chase is the one with no date on it.
 */
const paymentMoment = (payment: Payment): Date =>
  new Date(payment.paymentDate ?? payment.createdAt);

/**
 * What a payment was for.
 *
 * Everything taken through checkout carries `paymentType: 'cart'` — true, and
 * useless: the Type column read "Basket" on every row and told a club nothing
 * about what any of them bought. The basket's own lines do, so the column
 * names them instead: "Entry, Membership, Shop".
 *
 * Falls back to `paymentType` where a payment has no lines — an older row, or
 * one raised by hand — because "Basket" is still better than a blank.
 */
export function paymentKinds(
  payment: Payment,
  label: (key: string, options: { defaultValue: string }) => string
): string {
  const types = payment.itemTypes ?? [];

  if (types.length === 0) {
    return label(`payments.paymentTypes.${payment.paymentType}`, {
      defaultValue: payment.paymentType,
    });
  }

  return types
    .map((type) => label(`payments.itemTypes.${type}`, { defaultValue: type }))
    .join(', ');
}

const PaymentsListPage: React.FC = () => {
  const navigate = useNavigate();
  const { execute } = useApi();
  const { t } = useTranslation();
  const { format: formatMoney } = useCurrency();
  const { locale } = useLocale();
  const { checkModuleVisit } = useOnboarding();
  
  // Register page for contextual help
  usePageHelp('list');
  
  const [payments, setPayments] = useState<Payment[]>([]);
  const [filteredPayments, setFilteredPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'all' | Payment['paymentStatus']>('all');
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
      filtered = filtered.filter(payment => payment.paymentStatus === statusFilter);
    }

    // Apply payment method filter
    if (paymentMethodFilter !== 'all') {
      filtered = filtered.filter(payment => payment.paymentMethod === paymentMethodFilter);
    }

    // Apply date range filter
    if (startDate) {
      filtered = filtered.filter(payment => paymentMoment(payment) >= new Date(startDate));
    }
    if (endDate) {
      filtered = filtered.filter(payment => paymentMoment(payment) <= new Date(endDate));
    }

    setFilteredPayments(filtered);
  };

  const handleViewPayment = (paymentId: string) => {
    /*
      No `/orgadmin` prefix: the router carries it as its basename, so including
      it here produced `/orgadmin/orgadmin/payments/…` and a 404. Every other
      page in this package navigates without it.
    */
    navigate(`/payments/${paymentId}`);
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
      formatDate(paymentMoment(payment), 'dd MMM yyyy HH:mm', locale),
      payment.userName ?? '',
      payment.userEmail ?? '',
      formatMoney(payment.amount),
      t(`common.status.${payment.paymentStatus}`),
      paymentKinds(payment, t),
      payment.paymentMethod,
    ]);
    
    return [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
    ].join('\n');
  };

  const getStatusColor = (status: Payment['paymentStatus']) => {
    switch (status) {
      case 'paid':
        return 'success';
      case 'pending':
        return 'warning';
      case 'refunded':
        return 'info';
      // Money has gone back and some of it has not: neither settled nor spent.
      case 'partially_refunded':
        return 'warning';
      case 'failed':
        return 'error';
      default:
        return 'default';
    }
  };

  const sort = useTableSort(filteredPayments, {
    // Newest first: the question asked of a payment list is almost always
    // "what has just come in", and the reader can reverse it in one click.
    initial: { field: 'date', direction: 'desc' },
    accessors: {
      // The same moment the cell prints — `paymentMoment` falls back through
      // the several dates a payment can carry, and sorting a different one
      // from the one on screen is a list that looks unsorted.
      date: paymentMoment,
      type: (payment) => paymentKinds(payment, t),
    },
  });

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3,
        // Wraps rather than overflowing: a non-wrapping header row pushed
        // page actions past the right edge of a phone, with nothing on
        // screen to show the page had scrolled.
        flexWrap: 'wrap', gap: 2 }}>
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
                <MenuItem value="partially_refunded">
                  {t('payments.statusOptions.partially_refunded')}
                </MenuItem>
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

      <ResponsiveTable identityColumn={t('payments.table.customer')} component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <SortableTableCell sort={sort} field="date">
                {t('payments.table.date')}
              </SortableTableCell>
              <SortableTableCell sort={sort} field="userName">
                {t('payments.table.customer')}
              </SortableTableCell>
              <SortableTableCell sort={sort} field="amount">
                {t('payments.table.amount')}
              </SortableTableCell>
              <SortableTableCell sort={sort} field="paymentStatus">
                {t('payments.table.status')}
              </SortableTableCell>
              <SortableTableCell sort={sort} field="type">
                {t('payments.table.type')}
              </SortableTableCell>
              <SortableTableCell sort={sort} field="paymentMethod">
                {t('payments.table.paymentMethod')}
              </SortableTableCell>
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
              sort.rows.map((payment) => (
                <TableRow key={payment.id} hover>
                  {/*
                    The time as well as the date. Two payments on one day are
                    told apart by nothing else, and "when exactly" is the first
                    question asked of a payment being traced.
                  */}
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>
                    {formatDate(paymentMoment(payment), 'dd MMM yyyy HH:mm', locale)}
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" fontWeight="medium">
                      {payment.userName ?? t('payments.unknownPayer')}
                    </Typography>
                    <Typography variant="caption" color="textSecondary">
                      {payment.userEmail ?? ''}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" fontWeight="medium">
                      {formatMoney(payment.amount)}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={t(`common.status.${payment.paymentStatus}`, {
                        defaultValue: payment.paymentStatus,
                      })}
                      color={getStatusColor(payment.paymentStatus)}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    {paymentKinds(payment, t)}
                  </TableCell>
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
      </ResponsiveTable>
    </Box>
  );
};

export default PaymentsListPage;
