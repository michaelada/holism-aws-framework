/**
 * Reserved Slot Panel Component
 *
 * Right-side drawer that opens when clicking a reserved slot in the calendar view.
 * Displays reservation details (date, reason, reserved by).
 * Provides a "Free Slot" button with a confirmation prompt.
 * On confirm free, calls onFreeSlot(reservation.id) so the parent can wire to freeSlot.
 */

import React, { useState } from 'react';
import {
  Drawer,
  Box,
  Typography,
  Button,
  Divider,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Snackbar,
  Alert,
} from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';
import { useTranslation } from '@aws-web-framework/orgadmin-shell';
import type { CalendarSlotView } from '../types/calendar.types';

interface ReservedSlotPanelProps {
  open: boolean;
  slot: CalendarSlotView | null;
  onClose: () => void;
  onFreeSlot: (reservationId: string) => void;
}

/** Format a Date to a readable date string */
function formatReservationDate(date: Date): string {
  const d = new Date(date);
  return d.toLocaleDateString(undefined, {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

const ReservedSlotPanel: React.FC<ReservedSlotPanelProps> = ({
  open,
  slot,
  onClose,
  onFreeSlot,
}) => {
  const { t } = useTranslation();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const reservation = slot?.reservation;

  const handleFreeSlotClick = () => {
    setConfirmOpen(true);
  };

  const handleConfirmFree = () => {
    setConfirmOpen(false);
    if (reservation) {
      try {
        onFreeSlot(reservation.id);
      } catch {
        setErrorMessage(t('calendar.bookingView.errors.freeFailed'));
      }
    }
  };

  const handleCancelConfirm = () => {
    setConfirmOpen(false);
  };

  const handleClose = () => {
    setConfirmOpen(false);
    onClose();
  };

  return (
    <>
      <Drawer
        anchor="right"
        open={open}
        onClose={handleClose}
        PaperProps={{ sx: { width: 400 } }}
      >
        <Box sx={{ p: 2 }}>
          {/* Header */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6">
              {t('calendar.bookingView.reservedSlotDetails')}
            </Typography>
            <IconButton onClick={handleClose} size="small" aria-label="close">
              <CloseIcon />
            </IconButton>
          </Box>

          <Divider sx={{ mb: 2 }} />

          {slot && reservation ? (
            <Box>
              {/* Slot Info */}
              <Typography variant="body2" sx={{ mb: 0.5 }}>
                <strong>{t('calendar.bookingView.slotDate')}:</strong> {formatReservationDate(slot.date)}
              </Typography>
              <Typography variant="body2" sx={{ mb: 0.5 }}>
                <strong>{t('calendar.bookingView.startTime')}:</strong> {slot.startTime}
              </Typography>
              <Typography variant="body2" sx={{ mb: 1.5 }}>
                <strong>{t('calendar.bookingView.duration')}:</strong> {slot.duration} min
              </Typography>

              <Divider sx={{ mb: 1.5 }} />

              {/* Reservation Details */}
              <Typography variant="body2" sx={{ mb: 0.5 }}>
                <strong>{t('calendar.bookingView.reservedOn')}:</strong>{' '}
                {formatReservationDate(reservation.createdAt)}
              </Typography>
              <Typography variant="body2" sx={{ mb: 0.5 }}>
                <strong>{t('calendar.bookingView.reservedBy')}:</strong> {reservation.reservedBy}
              </Typography>

              {reservation.reason && (
                <Typography variant="body2" sx={{ mb: 0.5 }}>
                  <strong>{t('calendar.bookingView.reservationReason')}:</strong> {reservation.reason}
                </Typography>
              )}

              <Divider sx={{ my: 2 }} />

              {/* Free Slot Action */}
              <Button
                variant="contained"
                color="warning"
                fullWidth
                onClick={handleFreeSlotClick}
              >
                {t('calendar.bookingView.freeSlot')}
              </Button>
            </Box>
          ) : (
            <Typography variant="body2" color="text.secondary">
              {t('calendar.bookingView.noReservationData')}
            </Typography>
          )}
        </Box>
      </Drawer>

      {/* Free Slot Confirmation Dialog */}
      <Dialog open={confirmOpen} onClose={handleCancelConfirm} maxWidth="xs" fullWidth>
        <DialogTitle>{t('calendar.bookingView.freeSlot')}</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            {t('calendar.bookingView.freeSlotConfirm')}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCancelConfirm}>{t('common.actions.cancel')}</Button>
          <Button onClick={handleConfirmFree} variant="contained" color="warning">
            {t('common.actions.confirm')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Error Snackbar */}
      <Snackbar
        open={!!errorMessage}
        autoHideDuration={6000}
        onClose={() => setErrorMessage(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity="error" onClose={() => setErrorMessage(null)}>
          {errorMessage}
        </Alert>
      </Snackbar>
    </>
  );
};

export default ReservedSlotPanel;
