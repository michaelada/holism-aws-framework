/**
 * Bookings List Page (Tabular View)
 * 
 * Displays bookings in a table format with comprehensive filtering options.
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Card,
  CardContent,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
  Chip,
  IconButton,
} from '@mui/material';
import {
  Visibility as ViewIcon,
  Cancel as CancelIcon,
  Email as EmailIcon,
  FileDownload as ExportIcon,
} from '@mui/icons-material';
import type { Booking, BookingsFilterOptions } from '../types/calendar.types';

const BookingsListPage: React.FC = () => {
  const navigate = useNavigate();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<BookingsFilterOptions>({});

  useEffect(() => {
    loadBookings();
  }, [filters]);

  const loadBookings = async () => {
    try {
      setLoading(true);
      // API call with filters
      setBookings([]);
    } catch (error) {
      console.error('Failed to load bookings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleViewBooking = (bookingId: string) => {
    navigate(`/orgadmin/calendar/bookings/${bookingId}`);
  };

  const handleExport = async () => {
    // Export to Excel
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">Bookings</Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            variant="outlined"
            startIcon={<ExportIcon />}
            onClick={handleExport}
          >
            Export to Excel
          </Button>
        </Box>
      </Box>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="body2" color="text.secondary">
            Filters will be implemented here
          </Typography>
        </CardContent>
      </Card>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Booking Reference</TableCell>
              <TableCell>Calendar</TableCell>
              <TableCell>User</TableCell>
              <TableCell>Date</TableCell>
              <TableCell>Time</TableCell>
              <TableCell>Duration</TableCell>
              <TableCell>Price</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={9} align="center">Loading bookings...</TableCell>
              </TableRow>
            ) : bookings.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} align="center">No bookings found</TableCell>
              </TableRow>
            ) : (
              bookings.map((booking) => (
                <TableRow key={booking.id} hover>
                  <TableCell>{booking.bookingReference}</TableCell>
                  <TableCell>{booking.calendar?.name}</TableCell>
                  <TableCell>{booking.userName}</TableCell>
                  <TableCell>{new Date(booking.bookingDate).toLocaleDateString()}</TableCell>
                  <TableCell>{booking.startTime}</TableCell>
                  <TableCell>{booking.duration} min</TableCell>
                  <TableCell>€{booking.totalPrice.toFixed(2)}</TableCell>
                  <TableCell>
                    <Chip label={booking.bookingStatus} size="small" />
                  </TableCell>
                  <TableCell align="right">
                    <IconButton size="small" onClick={() => handleViewBooking(booking.id)}>
                      <ViewIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};

export default BookingsListPage;
