/**
 * Cancel Booking Dialog Component
 * 
 * Dialog for cancelling bookings with optional refund.
 */

import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControlLabel,
  Checkbox,
  Typography,
  Alert,
} from '@mui/material';
import type { Booking, CancellationValidation } from '../types/calendar.types';

interface CancelBookingDialogProps {
  open: boolean;
  booking: Booking | null;
  onClose: () => void;
  onConfirm: (reason: string, refund: boolean) => void;
}

const CancelBookingDialog: React.FC<CancelBookingDialogProps> = ({
  open,
  booking,
  onClose,
  onConfirm,
}) => {
  const [reason, setReason] = useState('');
  const [refund, setRefund] = useState(false);

  const handleConfirm = () => {
    onConfirm(reason, refund);
    setReason('');
    setRefund(false);
  };

  if (!booking) return null;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Cancel Booking</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" paragraph>
          Are you sure you want to cancel booking {booking.bookingReference}?
        </Typography>
        
        <TextField
          label="Cancellation Reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          multiline
          rows={3}
          fullWidth
          sx={{ mb: 2 }}
        />
        
        {booking.paymentStatus === 'paid' && (
          <FormControlLabel
            control={
              <Checkbox
                checked={refund}
                onChange={(e) => setRefund(e.target.checked)}
              />
            }
            label="Process refund"
          />
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={handleConfirm} color="error" variant="contained">
          Confirm Cancellation
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default CancelBookingDialog;
