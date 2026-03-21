/**
 * Booking Details Panel Component
 *
 * Right-side drawer that displays all confirmed bookings for a selected time slot.
 * Supports multi-capacity slots by rendering a list of bookings.
 * Each booking shows full details, a link to the full booking page, and a release button.
 */

import React from 'react';
import {
  Drawer,
  Box,
  Typography,
  Button,
  Divider,
  Chip,
  List,
  ListItem,
  IconButton,
} from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';
import { Link } from 'react-router-dom';
import { useTranslation, formatCurrency, useLocale } from '@aws-web-framework/orgadmin-shell';
import type { CalendarSlotView, Booking } from '../types/calendar.types';

interface BookingDetailsPanelProps {
  open: boolean;
  slot: CalendarSlotView | null;
  onClose: () => void;
  onRelease: (booking: Booking) => void;
}

/** Format a Date to a readable date string */
function formatBookingDate(date: Date): string {
  const d = new Date(date);
  return d.toLocaleDateString(undefined, {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

const BookingDetailsPanel: React.FC<BookingDetailsPanelProps> = ({
  open,
  slot,
  onClose,
  onRelease,
}) => {
  const { t } = useTranslation();
  const { locale } = useLocale();

  const confirmedBookings = slot?.bookings.filter(
    (b) => b.bookingStatus === 'confirmed',
  ) ?? [];

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{ sx: { width: 400 } }}
    >
      <Box sx={{ p: 2 }}>
        {/* Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6">
            {t('calendar.bookingView.bookingDetails')}
          </Typography>
          <IconButton onClick={onClose} size="small" aria-label="close">
            <CloseIcon />
          </IconButton>
        </Box>

        <Divider sx={{ mb: 2 }} />

        {confirmedBookings.length === 0 && (
          <Typography variant="body2" color="text.secondary">
            {t('calendar.bookingView.noBookings')}
          </Typography>
        )}

        <List disablePadding>
          {confirmedBookings.map((booking) => (
            <ListItem
              key={booking.id}
              disablePadding
              sx={{ display: 'block', mb: 2 }}
            >
              <Box sx={{ p: 1.5, border: 1, borderColor: 'divider', borderRadius: 1 }}>
                {/* Booking Reference */}
                <Typography variant="subtitle2" gutterBottom>
                  {t('calendar.bookingView.bookingReference')}: {booking.bookingReference}
                </Typography>

                {/* User Info */}
                <Typography variant="body2" color="text.secondary">
                  {t('calendar.bookingView.userName')}: {booking.userName ?? '—'}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {t('calendar.bookingView.userEmail')}: {booking.userEmail ?? '—'}
                </Typography>

                <Divider sx={{ my: 1 }} />

                {/* Booking Date & Times */}
                <Typography variant="body2">
                  {t('calendar.bookingView.bookingDate')}: {formatBookingDate(booking.bookingDate)}
                </Typography>
                <Typography variant="body2">
                  {t('calendar.bookingView.startTime')}: {booking.startTime}
                </Typography>
                <Typography variant="body2">
                  {t('calendar.bookingView.endTime')}: {booking.endTime}
                </Typography>
                <Typography variant="body2">
                  {t('calendar.bookingView.duration')}: {booking.duration} min
                </Typography>

                <Divider sx={{ my: 1 }} />

                {/* Capacity & Pricing */}
                <Typography variant="body2">
                  {t('calendar.bookingView.placesBooked')}: {booking.placesBooked}
                </Typography>
                <Typography variant="body2">
                  {t('calendar.bookingView.totalPrice')}: {formatCurrency(booking.totalPrice, 'EUR', locale)}
                </Typography>

                {/* Status Chips */}
                <Box sx={{ display: 'flex', gap: 1, mt: 1, mb: 1 }}>
                  <Chip
                    label={`${t('calendar.bookingView.paymentStatus')}: ${booking.paymentStatus}`}
                    size="small"
                    color={booking.paymentStatus === 'paid' ? 'success' : 'default'}
                  />
                  <Chip
                    label={`${t('calendar.bookingView.bookingStatus')}: ${booking.bookingStatus}`}
                    size="small"
                    color="primary"
                  />
                </Box>

                {/* Actions */}
                <Box sx={{ display: 'flex', gap: 1, mt: 1.5 }}>
                  <Button
                    component={Link}
                    to={`../bookings/${booking.id}`}
                    size="small"
                    variant="outlined"
                  >
                    {t('calendar.bookingView.viewFullDetails')}
                  </Button>
                  <Button
                    size="small"
                    variant="contained"
                    color="error"
                    onClick={() => onRelease(booking)}
                  >
                    {t('calendar.bookingView.releaseSlot')}
                  </Button>
                </Box>
              </Box>
            </ListItem>
          ))}
        </List>
      </Box>
    </Drawer>
  );
};

export default BookingDetailsPanel;
