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
import { useTranslation } from '@aws-web-framework/orgadmin-shell';
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
  const { t } = useTranslation();
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
      <DialogTitle>{t('calendar.cancelBooking.title')}</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" paragraph>
          {t('calendar.cancelBooking.message', { reference: booking.bookingReference })}
        </Typography>
        
        <TextField
          label={t('calendar.fields.cancellationReason')}
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
            label={t('calendar.fields.processRefund')}
          />
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('common.actions.cancel')}</Button>
        <Button onClick={handleConfirm} color="error" variant="contained">
          {t('calendar.cancelBooking.confirmButton')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default CancelBookingDialog;
