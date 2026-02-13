import React from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  Chip,
  Divider,
  Grid,
  Stack,
} from '@mui/material';
import {
  CreditCard as CardIcon,
  AccountBalance as BankIcon,
  Money as CashIcon,
  CheckCircle as SuccessIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
} from '@mui/icons-material';
import type { Payment } from './PaymentList';

export interface PaymentDetailsProps {
  payment: Payment & {
    payer?: {
      name: string;
      email: string;
    };
    transactionId?: string;
    notes?: string;
    metadata?: Record<string, any>;
  };
}

const getStatusIcon = (status: Payment['status']) => {
  switch (status) {
    case 'paid':
      return <SuccessIcon color="success" />;
    case 'pending':
      return <WarningIcon color="warning" />;
    case 'refunded':
    case 'failed':
      return <ErrorIcon color="error" />;
    default:
      return null;
  }
};

const getPaymentMethodIcon = (method: Payment['paymentMethod']) => {
  switch (method) {
    case 'card':
      return <CardIcon />;
    case 'bank_transfer':
      return <BankIcon />;
    case 'cash':
    case 'cheque':
    case 'offline':
      return <CashIcon />;
    default:
      return <CashIcon />;
  }
};

const formatPaymentMethod = (method: Payment['paymentMethod']): string => {
  switch (method) {
    case 'card':
      return 'Card Payment';
    case 'bank_transfer':
      return 'Bank Transfer';
    case 'cash':
      return 'Cash Payment';
    case 'cheque':
      return 'Cheque Payment';
    case 'offline':
      return 'Offline Payment';
    default:
      return method;
  }
};

const formatAmount = (amount: number, currency: string = 'EUR'): string => {
  return new Intl.NumberFormat('en-IE', {
    style: 'currency',
    currency,
  }).format(amount);
};

const formatDate = (date: Date | string): string => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('en-IE', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(dateObj);
};

const getStatusColor = (status: Payment['status']): 'success' | 'warning' | 'error' | 'default' => {
  switch (status) {
    case 'paid':
      return 'success';
    case 'pending':
      return 'warning';
    case 'refunded':
    case 'failed':
      return 'error';
    default:
      return 'default';
  }
};

/**
 * PaymentDetails component displays comprehensive payment information
 * Shows payer details, transaction info, and payment metadata
 */
export function PaymentDetails({ payment }: PaymentDetailsProps): JSX.Element {
  return (
    <Card>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
          <Box sx={{ mr: 2, color: 'action.active' }}>
            {getPaymentMethodIcon(payment.paymentMethod)}
          </Box>
          <Box sx={{ flex: 1 }}>
            <Typography variant="h5" component="div">
              {formatAmount(payment.amount, payment.currency)}
            </Typography>
            <Typography variant="body2" color="textSecondary">
              {formatPaymentMethod(payment.paymentMethod)}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {getStatusIcon(payment.status)}
            <Chip
              label={payment.status.toUpperCase()}
              color={getStatusColor(payment.status)}
            />
          </Box>
        </Box>

        <Divider sx={{ my: 2 }} />

        <Grid container spacing={3}>
          <Grid item xs={12} sm={6}>
            <Stack spacing={2}>
              <Box>
                <Typography variant="caption" color="textSecondary" display="block">
                  Payment Date
                </Typography>
                <Typography variant="body1">{formatDate(payment.date)}</Typography>
              </Box>

              {payment.reference && (
                <Box>
                  <Typography variant="caption" color="textSecondary" display="block">
                    Reference Number
                  </Typography>
                  <Typography variant="body1">{payment.reference}</Typography>
                </Box>
              )}

              {payment.transactionId && (
                <Box>
                  <Typography variant="caption" color="textSecondary" display="block">
                    Transaction ID
                  </Typography>
                  <Typography variant="body1" sx={{ fontFamily: 'monospace', fontSize: '0.875rem' }}>
                    {payment.transactionId}
                  </Typography>
                </Box>
              )}
            </Stack>
          </Grid>

          <Grid item xs={12} sm={6}>
            <Stack spacing={2}>
              {payment.payer && (
                <>
                  <Box>
                    <Typography variant="caption" color="textSecondary" display="block">
                      Payer Name
                    </Typography>
                    <Typography variant="body1">{payment.payer.name}</Typography>
                  </Box>

                  <Box>
                    <Typography variant="caption" color="textSecondary" display="block">
                      Payer Email
                    </Typography>
                    <Typography variant="body1">{payment.payer.email}</Typography>
                  </Box>
                </>
              )}
            </Stack>
          </Grid>

          {payment.description && (
            <Grid item xs={12}>
              <Box>
                <Typography variant="caption" color="textSecondary" display="block">
                  Description
                </Typography>
                <Typography variant="body1">{payment.description}</Typography>
              </Box>
            </Grid>
          )}

          {payment.notes && (
            <Grid item xs={12}>
              <Box>
                <Typography variant="caption" color="textSecondary" display="block">
                  Notes
                </Typography>
                <Typography variant="body1">{payment.notes}</Typography>
              </Box>
            </Grid>
          )}

          {payment.metadata && Object.keys(payment.metadata).length > 0 && (
            <Grid item xs={12}>
              <Box>
                <Typography variant="caption" color="textSecondary" display="block" gutterBottom>
                  Additional Information
                </Typography>
                <Box sx={{ bgcolor: 'grey.50', p: 2, borderRadius: 1 }}>
                  {Object.entries(payment.metadata).map(([key, value]) => (
                    <Box key={key} sx={{ mb: 1 }}>
                      <Typography variant="caption" color="textSecondary">
                        {key}:
                      </Typography>{' '}
                      <Typography variant="body2" component="span">
                        {String(value)}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              </Box>
            </Grid>
          )}
        </Grid>
      </CardContent>
    </Card>
  );
}
