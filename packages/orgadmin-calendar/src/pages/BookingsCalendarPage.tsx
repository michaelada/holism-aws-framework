/**
 * Bookings Calendar Page (Calendar View)
 *
 * Interactive calendar display of bookings using react-big-calendar.
 * Supports day/week/month views, colour-coded slot statuses,
 * and dispatches to booking/reservation dialogs on slot click.
 */

import React, { useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, CircularProgress, Alert, Typography, Snackbar, Button } from '@mui/material';
import { Calendar as BigCalendar, dateFnsLocalizer, View } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import {
  startOfWeek as dfStartOfWeek,
  endOfWeek as dfEndOfWeek,
  startOfMonth as dfStartOfMonth,
  endOfMonth as dfEndOfMonth,
  startOfDay,
  endOfDay,
} from 'date-fns';
import { enUS } from 'date-fns/locale';
import { useTranslation } from '@itsplainsailing/orgadmin-shell';
import 'react-big-calendar/lib/css/react-big-calendar.css';

import { useCalendarView } from '../hooks/useCalendarView';
import CalendarToolbar from '../components/CalendarToolbar';
import BookingDetailsPanel from '../components/BookingDetailsPanel';
import ReleaseBookingDialog from '../components/ReleaseBookingDialog';
import ReserveSlotDialog from '../components/ReserveSlotDialog';
import ReservedSlotPanel from '../components/ReservedSlotPanel';
import type { CalendarEvent, CalendarSlotView, Booking } from '../types/calendar.types';

// --- date-fns localizer setup ---
const locales = { 'en-US': enUS };
const localizer = dateFnsLocalizer({ format, parse, startOfWeek, getDay, locales });

// --- Colour constants ---
const STATUS_COLOURS = {
  available: '#4caf50',
  booked: '#2196f3',
  reserved: '#9e9e9e',
  bookedOverlap: '#90a4ae',  // blue-grey for overlap-blocked slots
} as const;

// Distinct shades for different durations so overlapping slots are visually separable
const DURATION_AVAILABLE_COLOURS = [
  '#4caf50', // green
  '#2e7d32', // dark green
  '#66bb6a', // light green
  '#1b5e20', // very dark green
  '#81c784', // pale green
];

// --- Helpers ---

/** Determine the status of a slot for colour coding and dispatch */
function getSlotStatus(slot: CalendarSlotView): 'available' | 'booked' | 'reserved' | 'bookedOverlap' {
  if (slot.isReserved) return 'reserved';
  if (slot.bookings.length > 0) return 'booked';
  if (slot.isBookedByOverlap) return 'bookedOverlap';
  return 'available';
}

/** Build a display title for a slot event — includes duration and price for available slots */
function getSlotTitle(slot: CalendarSlotView, status: string, t: (key: string) => string): string {
  if (status === 'reserved') return t('calendar.bookingView.statusReserved');
  if (status === 'booked') return `${slot.placesBooked}/${slot.placesAvailable} ${t('calendar.bookingView.statusBooked').toLowerCase()}`;
  if (status === 'bookedOverlap') return t('calendar.bookingView.statusUnavailable');
  // Show duration + price for available slots so different options are distinguishable
  const durationLabel = slot.duration >= 60
    ? `${slot.duration / 60}h`
    : `${slot.duration}m`;
  const priceLabel = slot.price > 0 ? ` €${slot.price.toFixed(2)}` : '';
  return `${durationLabel}${priceLabel} — ${t('calendar.bookingView.statusAvailable')}`;
}

/** Parse a slot date + time string into a Date object */
function slotToDate(slotDate: Date, timeStr: string): Date {
  const [hours, minutes] = timeStr.split(':').map(Number);
  const d = new Date(slotDate);
  d.setHours(hours, minutes, 0, 0);
  return d;
}

/** Map CalendarSlotView[] to CalendarEvent[] */
function mapSlotsToEvents(slots: CalendarSlotView[], t: (key: string) => string): CalendarEvent[] {
  // Collect unique durations to assign a colour index to each
  const uniqueDurations = [...new Set(slots.map(s => s.duration))].sort((a, b) => a - b);

  return slots.map((slot) => {
    const status = getSlotStatus(slot);
    const durationIndex = uniqueDurations.indexOf(slot.duration);
    return {
      id: `${slot.date.toISOString().split('T')[0]}-${slot.startTime}-${slot.duration}`,
      title: getSlotTitle(slot, status, t),
      start: slotToDate(slot.date, slot.startTime),
      end: slotToDate(slot.date, slot.endTime),
      resource: { slot, status, durationIndex },
    };
  });
}

/** Calculate the visible date range for a given date and view mode */
function getVisibleRange(date: Date, viewMode: 'day' | 'week' | 'month'): { start: Date; end: Date } {
  switch (viewMode) {
    case 'day':
      return { start: startOfDay(date), end: endOfDay(date) };
    case 'week':
      return { start: dfStartOfWeek(date, { weekStartsOn: 0 }), end: dfEndOfWeek(date, { weekStartsOn: 0 }) };
    case 'month': {
      const monthStart = dfStartOfMonth(date);
      const monthEnd = dfEndOfMonth(date);
      // Extend to full weeks for the calendar grid
      return {
        start: dfStartOfWeek(monthStart, { weekStartsOn: 0 }),
        end: dfEndOfWeek(monthEnd, { weekStartsOn: 0 }),
      };
    }
  }
}

// --- Inline SlotEventComponent ---

interface SlotEventProps {
  event: CalendarEvent;
}

const SlotEventComponent: React.FC<SlotEventProps> = ({ event }) => {
  return (
    <Box
      sx={{
        color: '#fff',
        borderRadius: '4px',
        px: 0.5,
        py: 0.25,
        fontSize: '0.7rem',
        lineHeight: 1.3,
        height: '100%',
        overflow: 'hidden',
        cursor: 'pointer',
      }}
    >
      <Box sx={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {event.title}
      </Box>
    </Box>
  );
};

// --- Main Page Component ---

const BookingsCalendarPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const {
    calendars,
    selectedCalendar,
    slots,
    loading,
    error,
    selectCalendar,
    setDateRange,
    reserveSlot,
    freeSlot,
    releaseBooking,
  } = useCalendarView();

  // View state
  const [viewMode, setViewMode] = useState<'day' | 'week' | 'month'>('week');
  const [currentDate, setCurrentDate] = useState<Date>(new Date());

  // Dialog/drawer state
  const [selectedSlot, setSelectedSlot] = useState<CalendarSlotView | null>(null);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [bookingDetailsPanelOpen, setBookingDetailsPanelOpen] = useState(false);
  const [reserveDialogOpen, setReserveDialogOpen] = useState(false);
  const [reservedSlotPanelOpen, setReservedSlotPanelOpen] = useState(false);
  const [releaseDialogOpen, setReleaseDialogOpen] = useState(false);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success',
  });

  // Map slots to calendar events
  const events = useMemo(() => mapSlotsToEvents(slots, t), [slots, t]);

  // Handle event click — dispatch based on status
  const handleSelectEvent = useCallback((event: CalendarEvent) => {
    const { slot, status } = event.resource;
    setSelectedSlot(slot);

    switch (status) {
      case 'booked':
        setBookingDetailsPanelOpen(true);
        break;
      case 'available':
        setReserveDialogOpen(true);
        break;
      case 'bookedOverlap':
        setSnackbar({
          open: true,
          message: t('calendar.bookingView.blockedByBooking'),
          severity: 'info' as any,
        });
        break;
      case 'reserved':
        if (slot.isExactReservation) {
          // This is the original reservation — allow freeing it
          setReservedSlotPanelOpen(true);
        } else {
          // This slot is blocked by an overlapping reservation — show info only
          setSnackbar({
            open: true,
            message: t('calendar.bookingView.blockedByReservation'),
            severity: 'info' as any,
          });
        }
        break;
    }
  }, [t]);

  // Handle date navigation
  const handleNavigate = useCallback(
    (newDate: Date) => {
      setCurrentDate(newDate);
      const range = getVisibleRange(newDate, viewMode);
      setDateRange(range.start, range.end);
    },
    [viewMode, setDateRange],
  );

  // Handle view mode change
  const handleViewChange = useCallback((newView: View) => {
    const mode = newView as 'day' | 'week' | 'month';
    setViewMode(mode);
    // Recalculate date range for the new view without changing currentDate
    const range = getVisibleRange(currentDate, mode);
    setDateRange(range.start, range.end);
  }, [currentDate, setDateRange]);

  // --- Dialog/Panel handlers ---

  const handleCloseBookingDetailsPanel = useCallback(() => {
    setBookingDetailsPanelOpen(false);
    setSelectedSlot(null);
  }, []);

  const handleReleaseFromPanel = useCallback((booking: Booking) => {
    setSelectedBooking(booking);
    setReleaseDialogOpen(true);
  }, []);

  const handleCloseReleaseDialog = useCallback(() => {
    setReleaseDialogOpen(false);
    setSelectedBooking(null);
  }, []);

  const handleConfirmRelease = useCallback(async (reason: string, refund: boolean) => {
    if (!selectedBooking) return;
    try {
      await releaseBooking(selectedBooking.id, reason, refund);
      setReleaseDialogOpen(false);
      setSelectedBooking(null);
      setBookingDetailsPanelOpen(false);
      setSelectedSlot(null);
      setSnackbar({ open: true, message: t('calendar.bookingView.releaseBookingSuccess'), severity: 'success' });
    } catch {
      setSnackbar({ open: true, message: t('calendar.bookingView.errors.releaseFailed'), severity: 'error' });
    }
  }, [selectedBooking, releaseBooking, t]);

  const handleCloseReserveDialog = useCallback(() => {
    setReserveDialogOpen(false);
    setSelectedSlot(null);
  }, []);

  const handleConfirmReserve = useCallback(async (reason?: string) => {
    if (!selectedSlot || !selectedCalendar) return;
    const slotDate = format(selectedSlot.date, 'yyyy-MM-dd');
    try {
      await reserveSlot({
        calendarId: selectedCalendar.id,
        slotDate,
        startTime: selectedSlot.startTime,
        duration: selectedSlot.duration,
        reason,
      });
      setReserveDialogOpen(false);
      setSelectedSlot(null);
      setSnackbar({ open: true, message: t('calendar.bookingView.reserveSlotSuccess'), severity: 'success' });
    } catch {
      setSnackbar({ open: true, message: t('calendar.bookingView.errors.reserveFailed'), severity: 'error' });
    }
  }, [selectedSlot, selectedCalendar, reserveSlot, t]);

  const handleCloseReservedSlotPanel = useCallback(() => {
    setReservedSlotPanelOpen(false);
    setSelectedSlot(null);
  }, []);

  const handleFreeSlot = useCallback(async (reservationId: string) => {
    try {
      await freeSlot(reservationId);
      setReservedSlotPanelOpen(false);
      setSelectedSlot(null);
      setSnackbar({ open: true, message: t('calendar.bookingView.freeSlotSuccess'), severity: 'success' });
    } catch {
      setSnackbar({ open: true, message: t('calendar.bookingView.errors.freeFailed'), severity: 'error' });
    }
  }, [freeSlot, t]);

  const handleCloseSnackbar = useCallback(() => {
    setSnackbar((prev) => ({ ...prev, open: false }));
  }, []);

  // Custom toolbar wrapper that bridges react-big-calendar toolbar props to our CalendarToolbar
  const CustomToolbar = useCallback(
    (toolbarProps: any) => (
      <CalendarToolbar
        viewMode={viewMode}
        onViewModeChange={(mode) => {
          handleViewChange(mode as View);
          toolbarProps.onView(mode);
        }}
        currentDate={toolbarProps.date}
        onNavigate={(action) => toolbarProps.onNavigate(action)}
        calendars={calendars}
        selectedCalendarId={selectedCalendar?.id ?? null}
        onCalendarSelect={selectCalendar}
        label={toolbarProps.label}
      />
    ),
    [viewMode, handleViewChange, calendars, selectedCalendar?.id, selectCalendar],
  );

  // Custom components for react-big-calendar
  const calendarComponents = useMemo(
    () => ({
      toolbar: CustomToolbar,
      event: SlotEventComponent,
    }),
    [CustomToolbar],
  );

  // Event style getter for colour coding — uses duration-based colours for available slots
  const eventPropGetter = useCallback((event: CalendarEvent) => {
    const { status, durationIndex } = event.resource;
    let colour: string;
    if (status === 'available') {
      colour = DURATION_AVAILABLE_COLOURS[durationIndex % DURATION_AVAILABLE_COLOURS.length];
    } else {
      colour = STATUS_COLOURS[status as keyof typeof STATUS_COLOURS];
    }
    return {
      style: {
        backgroundColor: colour,
        border: '1px solid rgba(255,255,255,0.3)',
        borderRadius: '4px',
        color: '#fff',
        padding: '2px 4px',
        cursor: 'pointer',
        fontSize: '0.7rem',
      },
    };
  }, []);

  return (
    <Box sx={{ p: 3, height: 'calc(100vh - 100px)' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h4">
          {t('calendar.bookingView.title')}
        </Typography>
        <Button
          variant="outlined"
          onClick={() => navigate('/calendar/bookings')}
        >
          {t('calendar.bookings')}
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {t('calendar.bookingView.errors.loadFailed')}
        </Alert>
      )}

      {calendars.length === 0 && !loading && !error && (
        <Alert severity="info" sx={{ mb: 2 }}>
          {t('calendar.bookingView.noCalendars')}
        </Alert>
      )}

      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      )}

      <Box sx={{ height: 'calc(100% - 80px)', minHeight: 500 }}>
        <BigCalendar<CalendarEvent>
          localizer={localizer}
          events={events}
          view={viewMode}
          date={currentDate}
          onNavigate={handleNavigate}
          onView={handleViewChange}
          onSelectEvent={handleSelectEvent}
          components={calendarComponents}
          eventPropGetter={eventPropGetter}
          defaultView="week"
          views={['day', 'week', 'month']}
          step={30}
          timeslots={2}
          style={{ height: '100%' }}
        />
      </Box>

      {/* Booking Details Panel (booked slot) */}
      <BookingDetailsPanel
        open={bookingDetailsPanelOpen}
        slot={selectedSlot}
        onClose={handleCloseBookingDetailsPanel}
        onRelease={handleReleaseFromPanel}
      />

      {/* Release Booking Dialog */}
      <ReleaseBookingDialog
        open={releaseDialogOpen}
        booking={selectedBooking}
        onClose={handleCloseReleaseDialog}
        onConfirm={handleConfirmRelease}
      />

      {/* Reserve Slot Dialog (available slot) */}
      <ReserveSlotDialog
        open={reserveDialogOpen}
        slot={selectedSlot}
        onClose={handleCloseReserveDialog}
        onConfirm={handleConfirmReserve}
      />

      {/* Reserved Slot Panel (reserved slot) */}
      <ReservedSlotPanel
        open={reservedSlotPanelOpen}
        slot={selectedSlot}
        onClose={handleCloseReservedSlotPanel}
        onFreeSlot={handleFreeSlot}
      />

      {/* Snackbar for success/error messages */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={snackbar.severity} onClose={handleCloseSnackbar} variant="filled">
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default BookingsCalendarPage;
