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
  Typography,
  Chip,
  IconButton,
} from '@mui/material';
import {
  Visibility as ViewIcon,
  FileDownload as ExportIcon,
} from '@mui/icons-material';
import { useTranslation, formatDate, formatCurrency, usePageHelp, useLocale } from '@aws-web-framework/orgadmin-shell';
import type { Booking, BookingsFilterOptions } from '../types/calendar.types';

const BookingsListPage: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { locale } = useLocale();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, _setFilters] = useState<BookingsFilterOptions>({});

  // Register page for contextual help
  usePageHelp('bookings-list');

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
        <Typography variant="h4">{t('calendar.bookings')}</Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            variant="outlined"
            startIcon={<ExportIcon />}
            onClick={handleExport}
          >
            {t('calendar.actions.exportToExcel')}
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
              <TableCell>{t('calendar.table.bookingReference')}</TableCell>
              <TableCell>{t('calendar.table.calendar')}</TableCell>
              <TableCell>{t('calendar.table.user')}</TableCell>
              <TableCell>{t('calendar.table.date')}</TableCell>
              <TableCell>{t('calendar.table.time')}</TableCell>
              <TableCell>{t('calendar.table.duration')}</TableCell>
              <TableCell>{t('calendar.table.price')}</TableCell>
              <TableCell>{t('calendar.table.bookingStatus')}</TableCell>
              <TableCell align="right">{t('calendar.table.actions')}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={9} align="center">{t('calendar.loadingBookings')}</TableCell>
              </TableRow>
            ) : bookings.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} align="center">{t('calendar.noBookingsFound')}</TableCell>
              </TableRow>
            ) : (
              bookings.map((booking) => (
                <TableRow key={booking.id} hover>
                  <TableCell>{booking.bookingReference}</TableCell>
                  <TableCell>{booking.calendar?.name}</TableCell>
                  <TableCell>{booking.userName}</TableCell>
                  <TableCell>{formatDate(new Date(booking.bookingDate), 'dd/MM/yyyy', locale)}</TableCell>
                  <TableCell>{booking.startTime}</TableCell>
                  <TableCell>{t('calendar.duration.minutes', { count: booking.duration })}</TableCell>
                  <TableCell>{formatCurrency(booking.totalPrice, 'EUR', locale)}</TableCell>
                  <TableCell>
                    <Chip label={booking.bookingStatus} size="small" />
                  </TableCell>
                  <TableCell align="right">
                    <IconButton size="small" onClick={() => handleViewBooking(booking.id)} title={t('calendar.tooltips.viewBooking')}>
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
