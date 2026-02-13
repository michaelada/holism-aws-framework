import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Typography,
  Box,
  Alert,
  FormControlLabel,
  Checkbox,
  CircularProgress,
} from '@mui/material';
import { Warning as WarningIcon } from '@mui/icons-material';

export interface RefundDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (refundData: { amount: number; reason: string; notifyCustomer: boolean }) => Promise<void>;
  paymentAmount: number;
  currency?: string;
  paymentId: string;
}

const formatAmount = (amount: number, currency: string = 'EUR'): string => {
  return new Intl.NumberFormat('en-IE', {
    style: 'currency',
    currency,
  }).format(amount);
};

/**
 * RefundDialog component for processing payment refunds
 * Allows partial or full refunds with reason and customer notification options
 */
export function RefundDialog({
  open,
  onClose,
  onConfirm,
  paymentAmount,
  currency = 'EUR',
  paymentId,
}: RefundDialogProps): JSX.Element {
  const [refundAmount, setRefundAmount] = useState<string>(paymentAmount.toString());
  const [reason, setReason] = useState<string>('');
  const [notifyCustomer, setNotifyCustomer] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [processing, setProcessing] = useState<boolean>(false);

  const handleAmountChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setRefundAmount(value);
    setError('');
  };

  const handleReasonChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setReason(event.target.value);
    setError('');
  };

  const handleConfirm = async () => {
    // Validate refund amount
    const amount = parseFloat(refundAmount);
    
    if (isNaN(amount) || amount <= 0) {
      setError('Please enter a valid refund amount');
      return;
    }

    if (amount > paymentAmount) {
      setError('Refund amount cannot exceed the original payment amount');
      return;
    }

    if (!reason.trim()) {
      setError('Please provide a reason for the refund');
      return;
    }

    setProcessing(true);
    setError('');

    try {
      await onConfirm({
        amount,
        reason: reason.trim(),
        notifyCustomer,
      });
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process refund');
    } finally {
      setProcessing(false);
    }
  };

  const handleClose = () => {
    if (!processing) {
      setRefundAmount(paymentAmount.toString());
      setReason('');
      setNotifyCustomer(true);
      setError('');
      onClose();
    }
  };

  const isPartialRefund = parseFloat(refundAmount) < paymentAmount;

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <WarningIcon color="warning" />
          <Typography variant="h6">Process Refund</Typography>
        </Box>
      </DialogTitle>

      <DialogContent>
        <Alert severity="warning" sx={{ mb: 3 }}>
          This action will process a refund for payment {paymentId}. This cannot be undone.
        </Alert>

        <Box sx={{ mb: 3 }}>
          <Typography variant="body2" color="textSecondary" gutterBottom>
            Original Payment Amount
          </Typography>
          <Typography variant="h6">{formatAmount(paymentAmount, currency)}</Typography>
        </Box>

        <TextField
          label="Refund Amount"
          type="number"
          value={refundAmount}
          onChange={handleAmountChange}
          fullWidth
          required
          disabled={processing}
          inputProps={{
            min: 0,
            max: paymentAmount,
            step: 0.01,
          }}
          helperText={
            isPartialRefund
              ? `Partial refund: ${formatAmount(parseFloat(refundAmount) || 0, currency)} of ${formatAmount(paymentAmount, currency)}`
              : 'Full refund'
          }
          sx={{ mb: 2 }}
        />

        <TextField
          label="Reason for Refund"
          value={reason}
          onChange={handleReasonChange}
          fullWidth
          required
          multiline
          rows={3}
          disabled={processing}
          placeholder="Please provide a reason for this refund..."
          sx={{ mb: 2 }}
        />

        <FormControlLabel
          control={
            <Checkbox
              checked={notifyCustomer}
              onChange={(e) => setNotifyCustomer(e.target.checked)}
              disabled={processing}
            />
          }
          label="Send refund notification email to customer"
        />

        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose} disabled={processing}>
          Cancel
        </Button>
        <Button
          onClick={handleConfirm}
          variant="contained"
          color="warning"
          disabled={processing}
          startIcon={processing ? <CircularProgress size={20} /> : null}
        >
          {processing ? 'Processing...' : 'Process Refund'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
