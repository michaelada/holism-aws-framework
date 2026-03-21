/**
 * Release Booking Dialog Component
 *
 * Dialog for releasing (cancelling) a booking from the calendar view.
 * Follows the existing CancelBookingDialog pattern.
 * Includes a required cancellation reason and a conditional refund checkbox
 * (shown only when the booking's payment status is 'paid').
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
} from '@mui/material';
import { useTranslation } from '@aws-web-framework/orgadmin-shell';
import type { Booking } from '../types/calendar.types';

interface ReleaseBookingDialogProps {
  open: boolean;
  booking: Booking | null;
  onClose: () => void;
  onConfirm: (reason: string, refund: boolean) => void;
}

const ReleaseBookingDialog: React.FC<ReleaseBookingDialogProps> = ({
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

  const handleClose = () => {
    setReason('');
    setRefund(false);
    onClose();
  };

  if (!booking) return null;

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>{t('calendar.bookingView.releaseBooking')}</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" paragraph>
          {t('calendar.bookingView.releaseBookingMessage', {
            reference: booking.bookingReference,
            name: booking.userName,
          })}
        </Typography>

        <Typography variant="body2" sx={{ mb: 1 }}>
          {t('calendar.bookingView.bookingReference')}: {booking.bookingReference}
        </Typography>
        <Typography variant="body2" sx={{ mb: 2 }}>
          {t('calendar.bookingView.userName')}: {booking.userName ?? '—'}
        </Typography>

        <TextField
          label={t('calendar.bookingView.cancellationReason')}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          multiline
          rows={3}
          fullWidth
          required
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
            label={t('calendar.bookingView.refundBookingFee')}
          />
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>{t('common.actions.cancel')}</Button>
        <Button
          onClick={handleConfirm}
          color="error"
          variant="contained"
          disabled={!reason.trim()}
        >
          {t('calendar.bookingView.releaseSlot')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ReleaseBookingDialog;
