/**
 * Reserve Slot Dialog Component
 *
 * MUI Dialog that opens when clicking an available slot in the calendar view.
 * Displays slot date, start time, and duration as read-only fields.
 * Provides an optional reason text field for the reservation.
 * On confirm, calls onConfirm(reason) so the parent can wire to reserveSlot.
 */

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
} from '@mui/material';
import { useTranslation } from '@aws-web-framework/orgadmin-shell';
import type { CalendarSlotView } from '../types/calendar.types';

interface ReserveSlotDialogProps {
  open: boolean;
  slot: CalendarSlotView | null;
  onClose: () => void;
  onConfirm: (reason?: string) => void;
}

/** Format a Date to a readable date string */
function formatSlotDate(date: Date): string {
  const d = new Date(date);
  return d.toLocaleDateString(undefined, {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

const ReserveSlotDialog: React.FC<ReserveSlotDialogProps> = ({
  open,
  slot,
  onClose,
  onConfirm,
}) => {
  const { t } = useTranslation();
  const [reason, setReason] = useState('');

  const handleConfirm = () => {
    onConfirm(reason.trim() || undefined);
    setReason('');
  };

  const handleClose = () => {
    setReason('');
    onClose();
  };

  if (!slot) return null;

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>{t('calendar.bookingView.reserveSlot')}</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" paragraph>
          {t('calendar.bookingView.reserveSlotMessage')}
        </Typography>

        <Box sx={{ mb: 2 }}>
          <Typography variant="body2" sx={{ mb: 0.5 }}>
            <strong>{t('calendar.bookingView.slotDate')}:</strong> {formatSlotDate(slot.date)}
          </Typography>
          <Typography variant="body2" sx={{ mb: 0.5 }}>
            <strong>{t('calendar.bookingView.startTime')}:</strong> {slot.startTime}
          </Typography>
          <Typography variant="body2">
            <strong>{t('calendar.bookingView.duration')}:</strong> {slot.duration} min
          </Typography>
        </Box>

        <TextField
          label={t('calendar.bookingView.reservationReason')}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          multiline
          rows={3}
          fullWidth
          placeholder={t('calendar.bookingView.reservationReasonPlaceholder')}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>{t('common.actions.cancel')}</Button>
        <Button onClick={handleConfirm} variant="contained" color="primary">
          {t('common.actions.confirm')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ReserveSlotDialog;
