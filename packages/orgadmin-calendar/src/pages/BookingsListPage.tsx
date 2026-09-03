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
  TableHead,
  TableRow,
  Typography,
  Chip,
  IconButton,
} from '@mui/material';
import {
  Visibility as ViewIcon,
  FileDownload as ExportIcon,
  CalendarMonth as CalendarViewIcon,
} from '@mui/icons-material';
import { useTranslation, formatDate, formatCurrency, usePageHelp, useLocale } from '@aws-web-framework/orgadmin-shell';
import {
  useOrganisation,
  useApi,
  ResponsiveTable,
  SortableTableCell,
  useTableSort,
} from '@aws-web-framework/orgadmin-core';
import type { Booking, BookingsFilterOptions } from '../types/calendar.types';

const BookingsListPage: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { locale } = useLocale();
  const { organisation } = useOrganisation();
  const { execute } = useApi();
  const [bookings, setBookings] = useState<(Booking & { calendarName?: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, _setFilters] = useState<BookingsFilterOptions>({});

  // Register page for contextual help
  usePageHelp('bookings-list');

  useEffect(() => {
    if (organisation?.id) {
      loadBookings();
    }
  }, [organisation?.id, filters]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadBookings = async () => {
    if (!organisation?.id) return;
    try {
      setLoading(true);
      const data = await execute({
        method: 'GET',
        url: `/api/orgadmin/organisations/${organisation.id}/bookings`,
      });
      setBookings(data || []);
    } catch (error) {
      console.error('Failed to load bookings:', error);
      setBookings([]);
    } finally {
      setLoading(false);
    }
  };

  const handleViewBooking = (bookingId: string) => {
    navigate(`/calendar/bookings/${bookingId}`);
  };

  const handleExport = async () => {
    // Export to Excel
  };

  /*
   * `startTime` is "09:30" — a time of day, which the comparison reads as one.
   * Sorted as text, 9:30 would follow 14:00.
   */
  const sort = useTableSort(bookings, {
    accessors: { calendarName: (booking) => (booking as any).calendarName },
  });

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3,
        // Wraps rather than overflowing: a non-wrapping header row pushed
        // page actions past the right edge of a phone, with nothing on
        // screen to show the page had scrolled.
        flexWrap: 'wrap', gap: 2 }}>
        <Typography variant="h4">{t('calendar.bookings')}</Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            variant="outlined"
            startIcon={<CalendarViewIcon />}
            onClick={() => navigate('/calendar/bookings/calendar-view')}
          >
            {t('calendar.bookingView.title')}
          </Button>
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

      <ResponsiveTable identityColumn={t('calendar.table.bookingReference')} component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <SortableTableCell sort={sort} field="bookingReference">
                {t('calendar.table.bookingReference')}
              </SortableTableCell>
              <SortableTableCell sort={sort} field="calendarName">
                {t('calendar.table.calendar')}
              </SortableTableCell>
              <SortableTableCell sort={sort} field="userName">
                {t('calendar.table.user')}
              </SortableTableCell>
              <SortableTableCell sort={sort} field="bookingDate">
                {t('calendar.table.date')}
              </SortableTableCell>
              <SortableTableCell sort={sort} field="startTime">
                {t('calendar.table.time')}
              </SortableTableCell>
              <SortableTableCell sort={sort} field="duration">
                {t('calendar.table.duration')}
              </SortableTableCell>
              <SortableTableCell sort={sort} field="totalPrice">
                {t('calendar.table.price')}
              </SortableTableCell>
              <SortableTableCell sort={sort} field="bookingStatus">
                {t('calendar.table.bookingStatus')}
              </SortableTableCell>
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
              sort.rows.map((booking) => (
                <TableRow key={booking.id} hover>
                  <TableCell>{booking.bookingReference}</TableCell>
                  <TableCell>{(booking as any).calendarName || '—'}</TableCell>
                  <TableCell>{booking.userName}</TableCell>
                  <TableCell>{formatDate(new Date(booking.bookingDate), 'dd/MM/yyyy', locale)}</TableCell>
                  <TableCell>{booking.startTime}</TableCell>
                  <TableCell>{t('calendar.duration.minutes', { count: booking.duration })}</TableCell>
                  <TableCell>{formatCurrency(booking.totalPrice, 'EUR', locale)}</TableCell>
                  <TableCell>
                    <Chip
                      label={booking.bookingStatus}
                      size="small"
                      sx={{
                        bgcolor: booking.bookingStatus === 'confirmed' ? '#e8f5e9' : booking.bookingStatus === 'cancelled' ? '#ffebee' : undefined,
                        color: booking.bookingStatus === 'confirmed' ? '#2e7d32' : booking.bookingStatus === 'cancelled' ? '#c62828' : undefined,
                      }}
                    />
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
      </ResponsiveTable>
    </Box>
  );
};

export default BookingsListPage;
