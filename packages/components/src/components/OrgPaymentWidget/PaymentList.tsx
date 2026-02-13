import React from 'react';
import {
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Chip,
  IconButton,
  Typography,
  Box,
  Divider,
} from '@mui/material';
import {
  Visibility as ViewIcon,
  CreditCard as CardIcon,
  AccountBalance as BankIcon,
  Money as CashIcon,
} from '@mui/icons-material';

export interface Payment {
  id: string;
  amount: number;
  currency?: string;
  status: 'pending' | 'paid' | 'refunded' | 'failed';
  paymentMethod: 'card' | 'bank_transfer' | 'cash' | 'cheque' | 'offline';
  date: Date | string;
  description?: string;
  reference?: string;
}

export interface PaymentListProps {
  payments: Payment[];
  onViewDetails?: (paymentId: string) => void;
  emptyMessage?: string;
}

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
      return 'Card';
    case 'bank_transfer':
      return 'Bank Transfer';
    case 'cash':
      return 'Cash';
    case 'cheque':
      return 'Cheque';
    case 'offline':
      return 'Offline';
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
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(dateObj);
};

/**
 * PaymentList component displays a list of payments with status and details
 * Supports multiple payment methods and statuses
 */
export function PaymentList({
  payments,
  onViewDetails,
  emptyMessage = 'No payments found',
}: PaymentListProps): JSX.Element {
  if (payments.length === 0) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography color="textSecondary">{emptyMessage}</Typography>
      </Box>
    );
  }

  return (
    <List>
      {payments.map((payment, index) => (
        <React.Fragment key={payment.id}>
          <ListItem>
            <Box sx={{ mr: 2, color: 'action.active' }}>
              {getPaymentMethodIcon(payment.paymentMethod)}
            </Box>
            <ListItemText
              primary={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography variant="body1" component="span">
                    {formatAmount(payment.amount, payment.currency)}
                  </Typography>
                  <Chip
                    label={payment.status.toUpperCase()}
                    color={getStatusColor(payment.status)}
                    size="small"
                  />
                </Box>
              }
              secondary={
                <Box>
                  <Typography variant="body2" color="textSecondary" component="span">
                    {formatPaymentMethod(payment.paymentMethod)} • {formatDate(payment.date)}
                  </Typography>
                  {payment.description && (
                    <Typography variant="body2" color="textSecondary" component="div">
                      {payment.description}
                    </Typography>
                  )}
                  {payment.reference && (
                    <Typography variant="caption" color="textSecondary" component="div">
                      Ref: {payment.reference}
                    </Typography>
                  )}
                </Box>
              }
            />
            {onViewDetails && (
              <ListItemSecondaryAction>
                <IconButton
                  edge="end"
                  onClick={() => onViewDetails(payment.id)}
                  size="small"
                >
                  <ViewIcon />
                </IconButton>
              </ListItemSecondaryAction>
            )}
          </ListItem>
          {index < payments.length - 1 && <Divider />}
        </React.Fragment>
      ))}
    </List>
  );
}
