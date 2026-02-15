/**
 * Payment Details Page
 * 
 * Shows full payment details including related transaction information
 * Provides refund functionality with confirmation dialog
 */

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider,
  Grid,
  IconButton,
  TextField,
  Typography,
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  Undo as RefundIcon,
} from '@mui/icons-material';
import { useApi } from '../../hooks/useApi';
import { useTranslation } from '@aws-web-framework/orgadmin-shell/hooks/useTranslation';
import { formatDateTime } from '@aws-web-framework/orgadmin-shell/utils/dateFormatting';
import { formatCurrency } from '@aws-web-framework/orgadmin-shell/utils/currencyFormatting';
import { useLocale } from '@aws-web-framework/orgadmin-shell/context/LocaleContext';

interface Payment {
  id: string;
  date: string;
  amount: number;
  status: 'pending' | 'paid' | 'refunded' | 'failed';
  type: 'event' | 'membership' | 'merchandise' | 'calendar' | 'registration' | 'ticket';
  paymentMethod: 'card' | 'cheque' | 'offline';
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  transactionId?: string;
  relatedTransaction: {
    id: string;
    name: string;
    type: string;
  };
  refundReason?: string;
  refundedAt?: string;
  createdAt: string;
  updatedAt: string;
}

const PaymentDetailsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { execute } = useApi();
  const { t } = useTranslation();
  const { locale } = useLocale();
  
  const [payment, setPayment] = useState<Payment | null>(null);
  const [loading, setLoading] = useState(true);
  const [refundDialogOpen, setRefundDialogOpen] = useState(false);
  const [refundReason, setRefundReason] = useState('');
  const [refundProcessing, setRefundProcessing] = useState(false);

  useEffect(() => {
    if (id) {
      loadPayment();
    }
  }, [id]);

  const loadPayment = async () => {
    try {
      setLoading(true);
      const response = await execute({
        method: 'GET',
        url: `/api/orgadmin/payments/${id}`,
      });
      setPayment(response);
    } catch (error) {
      console.error('Failed to load payment:', error);
      setPayment(null);
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    navigate('/payments');
  };

  const handleOpenRefundDialog = () => {
    setRefundDialogOpen(true);
  };

  const handleCloseRefundDialog = () => {
    setRefundDialogOpen(false);
    setRefundReason('');
  };

  const handleRefund = async () => {
    if (!payment || !refundReason.trim()) {
      return;
    }

    try {
      setRefundProcessing(true);
      await execute({
        method: 'POST',
        url: `/api/orgadmin/payments/${payment.id}/refund`,
        data: {
          reason: refundReason,
        },
      });
      
      // Reload payment to show updated status
      await loadPayment();
      handleCloseRefundDialog();
    } catch (error) {
      console.error('Failed to process refund:', error);
    } finally {
      setRefundProcessing(false);
    }
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

  if (loading) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography>{t('payments.loadingPayment')}</Typography>
      </Box>
    );
  }

  if (!payment) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography>{t('payments.paymentNotFound')}</Typography>
        <Button onClick={handleBack} sx={{ mt: 2 }}>
          {t('payments.actions.backToPayments')}
        </Button>
      </Box>
    );
  }

  const canRefund = payment.status === 'paid';

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <IconButton onClick={handleBack}>
            <BackIcon />
          </IconButton>
          <Typography variant="h4">{t('payments.paymentDetails')}</Typography>
        </Box>
        {canRefund && (
          <Button
            variant="outlined"
            color="error"
            startIcon={<RefundIcon />}
            onClick={handleOpenRefundDialog}
          >
            {t('payments.actions.requestRefund')}
          </Button>
        )}
      </Box>

      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                {t('payments.details.paymentInformation')}
              </Typography>
              <Divider sx={{ mb: 2 }} />
              
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="textSecondary">
                  {t('payments.details.paymentId')}
                </Typography>
                <Typography variant="body1">{payment.id}</Typography>
              </Box>

              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="textSecondary">
                  {t('payments.details.amount')}
                </Typography>
                <Typography variant="h5" color="primary">
                  {formatCurrency(payment.amount, 'GBP', locale)}
                </Typography>
              </Box>

              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="textSecondary">
                  {t('payments.details.status')}
                </Typography>
                <Chip
                  label={t(`common.status.${payment.status}`)}
                  color={getStatusColor(payment.status)}
                  sx={{ mt: 0.5 }}
                />
              </Box>

              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="textSecondary">
                  {t('payments.details.paymentMethod')}
                </Typography>
                <Typography variant="body1" sx={{ textTransform: 'capitalize' }}>
                  {t(`payments.paymentMethodOptions.${payment.paymentMethod}`)}
                </Typography>
              </Box>

              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="textSecondary">
                  {t('payments.details.date')}
                </Typography>
                <Typography variant="body1">{formatDateTime(new Date(payment.date), locale)}</Typography>
              </Box>

              {payment.transactionId && (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" color="textSecondary">
                    {t('payments.details.transactionId')}
                  </Typography>
                  <Typography variant="body1" sx={{ fontFamily: 'monospace', fontSize: '0.875rem' }}>
                    {payment.transactionId}
                  </Typography>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                {t('payments.details.customerInformation')}
              </Typography>
              <Divider sx={{ mb: 2 }} />
              
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="textSecondary">
                  {t('payments.details.name')}
                </Typography>
                <Typography variant="body1">{payment.customerName}</Typography>
              </Box>

              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="textSecondary">
                  {t('payments.details.email')}
                </Typography>
                <Typography variant="body1">{payment.customerEmail}</Typography>
              </Box>

              {payment.customerPhone && (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" color="textSecondary">
                    {t('payments.details.phone')}
                  </Typography>
                  <Typography variant="body1">{payment.customerPhone}</Typography>
                </Box>
              )}
            </CardContent>
          </Card>

          <Card sx={{ mt: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                {t('payments.details.relatedTransaction')}
              </Typography>
              <Divider sx={{ mb: 2 }} />
              
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="textSecondary">
                  {t('payments.details.type')}
                </Typography>
                <Typography variant="body1">{t(`payments.paymentTypes.${payment.type}`)}</Typography>
              </Box>

              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="textSecondary">
                  {t('payments.details.transactionName')}
                </Typography>
                <Typography variant="body1">{payment.relatedTransaction.name}</Typography>
              </Box>

              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="textSecondary">
                  {t('payments.details.transactionId')}
                </Typography>
                <Typography variant="body1">{payment.relatedTransaction.id}</Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {payment.status === 'refunded' && payment.refundReason && (
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  {t('payments.details.refundInformation')}
                </Typography>
                <Divider sx={{ mb: 2 }} />
                
                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" color="textSecondary">
                    {t('payments.details.refundDate')}
                  </Typography>
                  <Typography variant="body1">
                    {payment.refundedAt ? formatDateTime(new Date(payment.refundedAt), locale) : 'N/A'}
                  </Typography>
                </Box>

                <Box>
                  <Typography variant="body2" color="textSecondary">
                    {t('payments.details.refundReason')}
                  </Typography>
                  <Typography variant="body1">{payment.refundReason}</Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        )}
      </Grid>

      {/* Refund Confirmation Dialog */}
      <Dialog open={refundDialogOpen} onClose={handleCloseRefundDialog} maxWidth="sm" fullWidth>
        <DialogTitle>{t('payments.refund.title')}</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            {t('payments.refund.message', { amount: formatCurrency(payment.amount, 'GBP', locale) })}
          </DialogContentText>
          <TextField
            autoFocus
            fullWidth
            multiline
            rows={3}
            label={t('payments.refund.reasonLabel')}
            value={refundReason}
            onChange={(e) => setRefundReason(e.target.value)}
            placeholder={t('payments.refund.reasonPlaceholder')}
            required
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseRefundDialog} disabled={refundProcessing}>
            {t('common.actions.cancel')}
          </Button>
          <Button
            onClick={handleRefund}
            color="error"
            variant="contained"
            disabled={!refundReason.trim() || refundProcessing}
          >
            {refundProcessing ? t('payments.refund.processing') : t('payments.refund.confirmButton')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default PaymentDetailsPage;
