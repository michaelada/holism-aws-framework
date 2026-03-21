/**
 * Booking Details Page
 * 
 * Displays comprehensive booking information with admin actions.
 */

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Card,
  CardContent,
  Typography,
  Grid,
  Chip,
  Divider,
} from '@mui/material';
import {
  Cancel as CancelIcon,
  Email as EmailIcon,
  Print as PrintIcon,
  ArrowBack as BackIcon,
} from '@mui/icons-material';
import { useApi } from '@aws-web-framework/orgadmin-core';
import { useTranslation, formatCurrency, useLocale } from '@aws-web-framework/orgadmin-shell';
import type { Booking } from '../types/calendar.types';

const BookingDetailsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { execute } = useApi();
  const { t } = useTranslation();
  const { locale } = useLocale();
  const [booking, setBooking] = useState<(Booking & { calendarName?: string }) | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      loadBooking(id);
    }
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadBooking = async (bookingId: string) => {
    try {
      setLoading(true);
      const data = await execute({
        method: 'GET',
        url: `/api/orgadmin/bookings/${bookingId}`,
      });
      setBooking(data);
    } catch (error) {
      console.error('Failed to load booking:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <Box sx={{ p: 3 }}><Typography>Loading...</Typography></Box>;
  }

  if (!booking) {
    return <Box sx={{ p: 3 }}><Typography>Booking not found</Typography></Box>;
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Button variant="text" startIcon={<BackIcon />} onClick={() => navigate('/calendar/bookings')}>
            {t('calendar.bookings')}
          </Button>
          <Typography variant="h4">{booking.bookingReference}</Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button variant="outlined" startIcon={<EmailIcon />}>
            Resend Confirmation
          </Button>
          <Button variant="outlined" startIcon={<PrintIcon />}>
            Print
          </Button>
          {booking.bookingStatus === 'confirmed' && (
            <Button variant="outlined" color="error" startIcon={<CancelIcon />}>
              Cancel Booking
            </Button>
          )}
        </Box>
      </Box>

      <Grid container spacing={3}>
        {/* Booking Information */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>{t('calendar.bookingView.bookingDetails')}</Typography>
              <Divider sx={{ mb: 2 }} />
              <Typography variant="body2" sx={{ mb: 1 }}>
                {t('calendar.bookingView.bookingReference')}: {booking.bookingReference}
              </Typography>
              <Typography variant="body2" sx={{ mb: 1 }}>
                {t('calendar.bookingView.bookingDate')}: {new Date(booking.bookingDate).toLocaleDateString(locale, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}
              </Typography>
              <Typography variant="body2" sx={{ mb: 1 }}>
                {t('calendar.bookingView.startTime')}: {booking.startTime}
              </Typography>
              <Typography variant="body2" sx={{ mb: 1 }}>
                {t('calendar.bookingView.endTime')}: {booking.endTime}
              </Typography>
              <Typography variant="body2" sx={{ mb: 1 }}>
                {t('calendar.bookingView.duration')}: {booking.duration} min
              </Typography>
              <Typography variant="body2" sx={{ mb: 1 }}>
                {t('calendar.bookingView.placesBooked')}: {booking.placesBooked}
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
                <Chip
                  label={booking.bookingStatus}
                  size="small"
                  sx={{
                    bgcolor: booking.bookingStatus === 'confirmed' ? '#e8f5e9' : booking.bookingStatus === 'cancelled' ? '#ffebee' : undefined,
                    color: booking.bookingStatus === 'confirmed' ? '#2e7d32' : booking.bookingStatus === 'cancelled' ? '#c62828' : undefined,
                  }}
                />
                <Chip
                  label={`${t('calendar.bookingView.paymentStatus')}: ${booking.paymentStatus}`}
                  size="small"
                  color={booking.paymentStatus === 'paid' ? 'success' : 'default'}
                />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Pricing & User */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Pricing</Typography>
              <Divider sx={{ mb: 2 }} />
              <Typography variant="body2" sx={{ mb: 1 }}>
                Price per place: {formatCurrency(booking.pricePerPlace, 'EUR', locale)}
              </Typography>
              <Typography variant="body2" sx={{ mb: 1 }}>
                {t('calendar.bookingView.totalPrice')}: {formatCurrency(booking.totalPrice, 'EUR', locale)}
              </Typography>
              {booking.paymentMethod && (
                <Typography variant="body2" sx={{ mb: 1 }}>
                  Payment method: {booking.paymentMethod}
                </Typography>
              )}
            </CardContent>
          </Card>

          {/* User Info */}
          <Card sx={{ mt: 2 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>User</Typography>
              <Divider sx={{ mb: 2 }} />
              <Typography variant="body2" sx={{ mb: 1 }}>
                {t('calendar.bookingView.userName')}: {booking.userName ?? '—'}
              </Typography>
              <Typography variant="body2" sx={{ mb: 1 }}>
                {t('calendar.bookingView.userEmail')}: {booking.userEmail ?? '—'}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* Cancellation Details (if cancelled) */}
        {booking.bookingStatus === 'cancelled' && (
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom color="error">Cancellation Details</Typography>
                <Divider sx={{ mb: 2 }} />
                {booking.cancellationReason && (
                  <Typography variant="body2" sx={{ mb: 1 }}>
                    Reason: {booking.cancellationReason}
                  </Typography>
                )}
                {booking.cancelledAt && (
                  <Typography variant="body2" sx={{ mb: 1 }}>
                    Cancelled at: {new Date(booking.cancelledAt).toLocaleString(locale)}
                  </Typography>
                )}
                <Typography variant="body2" sx={{ mb: 1 }}>
                  Refund processed: {booking.refundProcessed ? 'Yes' : 'No'}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        )}

        {/* Admin Notes */}
        {booking.adminNotes && (
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>Admin Notes</Typography>
                <Divider sx={{ mb: 2 }} />
                <Typography variant="body2">{booking.adminNotes}</Typography>
              </CardContent>
            </Card>
          </Grid>
        )}
      </Grid>
    </Box>
  );
};

export default BookingDetailsPage;
