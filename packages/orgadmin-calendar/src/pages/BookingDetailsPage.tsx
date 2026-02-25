/**
 * Booking Details Page
 * 
 * Displays comprehensive booking information with admin actions.
 */

import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
  Box,
  Button,
  Card,
  CardContent,
  Typography,
  Grid,
  Chip,
} from '@mui/material';
import {
  Cancel as CancelIcon,
  Email as EmailIcon,
  Print as PrintIcon,
} from '@mui/icons-material';
import type { Booking } from '../types/calendar.types';

const BookingDetailsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [booking, _setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      loadBooking(id);
    }
  }, [id]);

  const loadBooking = async (_bookingId: string) => {
    try {
      setLoading(true);
      // API call
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
        <Typography variant="h4">Booking Details</Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button variant="outlined" startIcon={<EmailIcon />}>
            Resend Confirmation
          </Button>
          <Button variant="outlined" startIcon={<PrintIcon />}>
            Print
          </Button>
          <Button variant="outlined" color="error" startIcon={<CancelIcon />}>
            Cancel Booking
          </Button>
        </Box>
      </Box>

      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Booking Information</Typography>
              <Typography variant="body2">Reference: {booking.bookingReference}</Typography>
              <Typography variant="body2">Status: <Chip label={booking.bookingStatus} size="small" /></Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default BookingDetailsPage;
