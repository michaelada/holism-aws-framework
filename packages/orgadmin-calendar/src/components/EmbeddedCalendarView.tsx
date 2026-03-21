/**
 * Embedded Calendar View Component
 *
 * A self-contained calendar booking view that can be embedded in any page.
 * Pre-selects a specific calendar by ID and renders the full interactive
 * booking calendar with reserve/free/release functionality.
 */

import React, { useState, useCallback, useMemo } from 'react';
import { Box, CircularProgress, Alert, Snackbar } from '@mui/material';
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
import { useTranslation } from '@aws-web-framework/orgadmin-shell';
import 'react-big-calendar/lib/css/react-big-calendar.css';

import { useCalendarView } from '../hooks/useCalendarView';
import BookingDetailsPanel from './BookingDetailsPanel';
import ReleaseBookingDialog from './ReleaseBookingDialog';
import ReserveSlotDialog from './ReserveSlotDialog';
import ReservedSlotPanel from './ReservedSlotPanel';
import type { CalendarEvent, CalendarSlotView, Booking } from '../types/calendar.types';

// --- date-fns localizer setup ---
const locales = { 'en-US': enUS };
const localizer = dateFnsLocalizer({ format, parse, startOfWeek, getDay, locales });

// --- Colour constants ---
const STATUS_COLOURS = {
  available: '#4caf50',
  booked: '#2196f3',
  reserved: '#9e9e9e',
  bookedOverlap: '#90a4ae',
} as const;

const DURATION_AVAILABLE_COLOURS = [
  '#4caf50', '#2e7d32', '#66bb6a', '#1b5e20', '#81c784',
];

// --- Helpers ---

function getSlotStatus(slot: CalendarSlotView): 'available' | 'booked' | 'reserved' | 'bookedOverlap' {
  if (slot.isReserved) return 'reserved';
  if (slot.bookings.length > 0) return 'booked';
  if (slot.isBookedByOverlap) return 'bookedOverlap';
  return 'available';
}

function getSlotTitle(slot: CalendarSlotView, status: string, t: (key: string) => string): string {
  if (status === 'reserved') return t('calendar.bookingView.statusReserved');
  if (status === 'booked') return `${slot.placesBooked}/${slot.placesAvailable} ${t('calendar.bookingView.statusBooked').toLowerCase()}`;
  if (status === 'bookedOverlap') return t('calendar.bookingView.statusUnavailable');
  const durationLabel = slot.duration >= 60 ? `${slot.duration / 60}h` : `${slot.duration}m`;
  const priceLabel = slot.price > 0 ? ` €${slot.price.toFixed(2)}` : '';
  return `${durationLabel}${priceLabel} — ${t('calendar.bookingView.statusAvailable')}`;
}

function slotToDate(slotDate: Date, timeStr: string): Date {
  const [hours, minutes] = timeStr.split(':').map(Number);
  const d = new Date(slotDate);
  d.setHours(hours, minutes, 0, 0);
  return d;
}

function mapSlotsToEvents(slots: CalendarSlotView[], t: (key: string) => string): CalendarEvent[] {
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

function getVisibleRange(date: Date, viewMode: 'day' | 'week' | 'month'): { start: Date; end: Date } {
  switch (viewMode) {
    case 'day':
      return { start: startOfDay(date), end: endOfDay(date) };
    case 'week':
      return { start: dfStartOfWeek(date, { weekStartsOn: 0 }), end: dfEndOfWeek(date, { weekStartsOn: 0 }) };
    case 'month': {
      const monthStart = dfStartOfMonth(date);
      const monthEnd = dfEndOfMonth(date);
      return {
        start: dfStartOfWeek(monthStart, { weekStartsOn: 0 }),
        end: dfEndOfWeek(monthEnd, { weekStartsOn: 0 }),
      };
    }
  }
}

const SlotEventComponent: React.FC<{ event: CalendarEvent }> = ({ event }) => (
  <Box
    sx={{
      color: '#fff', borderRadius: '4px', px: 0.5, py: 0.25,
      fontSize: '0.7rem', lineHeight: 1.3, height: '100%',
      overflow: 'hidden', cursor: 'pointer',
    }}
  >
    <Box sx={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
      {event.title}
    </Box>
  </Box>
);

// --- Props ---

interface EmbeddedCalendarViewProps {
  calendarId: string;
}

const EmbeddedCalendarView: React.FC<EmbeddedCalendarViewProps> = ({ calendarId }) => {
  const { t } = useTranslation();
  const {
    selectedCalendar,
    slots,
    loading,
    error,
    setDateRange,
    reserveSlot,
    freeSlot,
    releaseBooking,
  } = useCalendarView(calendarId);

  const [viewMode, setViewMode] = useState<'day' | 'week' | 'month'>('week');
  const [currentDate, setCurrentDate] = useState<Date>(new Date());

  const [selectedSlot, setSelectedSlot] = useState<CalendarSlotView | null>(null);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [bookingDetailsPanelOpen, setBookingDetailsPanelOpen] = useState(false);
  const [reserveDialogOpen, setReserveDialogOpen] = useState(false);
  const [reservedSlotPanelOpen, setReservedSlotPanelOpen] = useState(false);
  const [releaseDialogOpen, setReleaseDialogOpen] = useState(false);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false, message: '', severity: 'success',
  });

  const events = useMemo(() => mapSlotsToEvents(slots, t), [slots, t]);

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
        setSnackbar({ open: true, message: t('calendar.bookingView.blockedByBooking'), severity: 'info' as any });
        break;
      case 'reserved':
        if (slot.isExactReservation) {
          setReservedSlotPanelOpen(true);
        } else {
          setSnackbar({ open: true, message: t('calendar.bookingView.blockedByReservation'), severity: 'info' as any });
        }
        break;
    }
  }, [t]);

  const handleNavigate = useCallback((newDate: Date) => {
    setCurrentDate(newDate);
    const range = getVisibleRange(newDate, viewMode);
    setDateRange(range.start, range.end);
  }, [viewMode, setDateRange]);

  const handleViewChange = useCallback((newView: View) => {
    const mode = newView as 'day' | 'week' | 'month';
    setViewMode(mode);
    const range = getVisibleRange(currentDate, mode);
    setDateRange(range.start, range.end);
  }, [currentDate, setDateRange]);

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

  const calendarComponents = useMemo(() => ({ event: SlotEventComponent }), []);

  return (
    <Box>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {t('calendar.bookingView.errors.loadFailed')}
        </Alert>
      )}

      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      )}

      <Box sx={{ height: 700, overflow: 'auto' }}>
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

      <BookingDetailsPanel
        open={bookingDetailsPanelOpen}
        slot={selectedSlot}
        onClose={() => { setBookingDetailsPanelOpen(false); setSelectedSlot(null); }}
        onRelease={(booking) => { setSelectedBooking(booking); setReleaseDialogOpen(true); }}
      />
      <ReleaseBookingDialog
        open={releaseDialogOpen}
        booking={selectedBooking}
        onClose={() => { setReleaseDialogOpen(false); setSelectedBooking(null); }}
        onConfirm={handleConfirmRelease}
      />
      <ReserveSlotDialog
        open={reserveDialogOpen}
        slot={selectedSlot}
        onClose={() => { setReserveDialogOpen(false); setSelectedSlot(null); }}
        onConfirm={handleConfirmReserve}
      />
      <ReservedSlotPanel
        open={reservedSlotPanelOpen}
        slot={selectedSlot}
        onClose={() => { setReservedSlotPanelOpen(false); setSelectedSlot(null); }}
        onFreeSlot={handleFreeSlot}
      />
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={snackbar.severity} onClose={() => setSnackbar(prev => ({ ...prev, open: false }))} variant="filled">
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default EmbeddedCalendarView;
