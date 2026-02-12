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
    navigate('/orgadmin/payments');
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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
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

  if (loading) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography>Loading payment details...</Typography>
      </Box>
    );
  }

  if (!payment) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography>Payment not found</Typography>
        <Button onClick={handleBack} sx={{ mt: 2 }}>
          Back to Payments
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
          <Typography variant="h4">Payment Details</Typography>
        </Box>
        {canRefund && (
          <Button
            variant="outlined"
            color="error"
            startIcon={<RefundIcon />}
            onClick={handleOpenRefundDialog}
          >
            Request Refund
          </Button>
        )}
      </Box>

      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Payment Information
              </Typography>
              <Divider sx={{ mb: 2 }} />
              
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="textSecondary">
                  Payment ID
                </Typography>
                <Typography variant="body1">{payment.id}</Typography>
              </Box>

              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="textSecondary">
                  Amount
                </Typography>
                <Typography variant="h5" color="primary">
                  {formatCurrency(payment.amount)}
                </Typography>
              </Box>

              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="textSecondary">
                  Status
                </Typography>
                <Chip
                  label={payment.status}
                  color={getStatusColor(payment.status)}
                  sx={{ mt: 0.5 }}
                />
              </Box>

              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="textSecondary">
                  Payment Method
                </Typography>
                <Typography variant="body1" sx={{ textTransform: 'capitalize' }}>
                  {payment.paymentMethod}
                </Typography>
              </Box>

              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="textSecondary">
                  Date
                </Typography>
                <Typography variant="body1">{formatDate(payment.date)}</Typography>
              </Box>

              {payment.transactionId && (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" color="textSecondary">
                    Transaction ID
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
                Customer Information
              </Typography>
              <Divider sx={{ mb: 2 }} />
              
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="textSecondary">
                  Name
                </Typography>
                <Typography variant="body1">{payment.customerName}</Typography>
              </Box>

              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="textSecondary">
                  Email
                </Typography>
                <Typography variant="body1">{payment.customerEmail}</Typography>
              </Box>

              {payment.customerPhone && (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" color="textSecondary">
                    Phone
                  </Typography>
                  <Typography variant="body1">{payment.customerPhone}</Typography>
                </Box>
              )}
            </CardContent>
          </Card>

          <Card sx={{ mt: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Related Transaction
              </Typography>
              <Divider sx={{ mb: 2 }} />
              
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="textSecondary">
                  Type
                </Typography>
                <Typography variant="body1">{getTypeLabel(payment.type)}</Typography>
              </Box>

              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="textSecondary">
                  Name
                </Typography>
                <Typography variant="body1">{payment.relatedTransaction.name}</Typography>
              </Box>

              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="textSecondary">
                  Transaction ID
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
                  Refund Information
                </Typography>
                <Divider sx={{ mb: 2 }} />
                
                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" color="textSecondary">
                    Refund Date
                  </Typography>
                  <Typography variant="body1">
                    {payment.refundedAt ? formatDate(payment.refundedAt) : 'N/A'}
                  </Typography>
                </Box>

                <Box>
                  <Typography variant="body2" color="textSecondary">
                    Reason
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
        <DialogTitle>Request Refund</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            Are you sure you want to refund this payment of {formatCurrency(payment.amount)}?
            This action cannot be undone.
          </DialogContentText>
          <TextField
            autoFocus
            fullWidth
            multiline
            rows={3}
            label="Refund Reason"
            value={refundReason}
            onChange={(e) => setRefundReason(e.target.value)}
            placeholder="Please provide a reason for the refund..."
            required
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseRefundDialog} disabled={refundProcessing}>
            Cancel
          </Button>
          <Button
            onClick={handleRefund}
            color="error"
            variant="contained"
            disabled={!refundReason.trim() || refundProcessing}
          >
            {refundProcessing ? 'Processing...' : 'Confirm Refund'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default PaymentDetailsPage;
