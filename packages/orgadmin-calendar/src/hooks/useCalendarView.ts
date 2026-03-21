/**
 * useCalendarView Hook
 *
 * Encapsulates calendar booking view data fetching and mutation logic.
 * Fetches calendars, time slot configurations, blocked periods, bookings,
 * and reservations, then generates CalendarSlotView[] via slotAvailabilityCalculator.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useOrganisation, useApi } from '@aws-web-framework/orgadmin-core';
import { calculateAvailableSlots } from '../utils/slotAvailabilityCalculator';
import type {
  Calendar,
  CalendarSlotView,
  SlotReservation,
  ReserveSlotRequest,
  Booking,
  TimeSlotConfiguration,
  BlockedPeriod,
} from '../types/calendar.types';

const API_BASE = '/api/orgadmin';

/**
 * Format a Date to YYYY-MM-DD string for API calls
 */
function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export interface UseCalendarViewReturn {
  calendars: Calendar[];
  selectedCalendar: Calendar | null;
  slots: CalendarSlotView[];
  reservations: SlotReservation[];
  loading: boolean;
  error: string | null;
  selectCalendar: (id: string) => void;
  setDateRange: (start: Date, end: Date) => void;
  reserveSlot: (data: ReserveSlotRequest) => Promise<void>;
  freeSlot: (reservationId: string) => Promise<void>;
  releaseBooking: (bookingId: string, reason: string, refund: boolean) => Promise<void>;
  refresh: () => Promise<void>;
}

export function useCalendarView(initialCalendarId?: string): UseCalendarViewReturn {
  const { organisation } = useOrganisation();
  const { execute } = useApi();

  // Store execute in a ref to avoid dependency issues (it returns a new reference every render)
  const executeRef = useRef(execute);
  executeRef.current = execute;

  const [calendars, setCalendars] = useState<Calendar[]>([]);
  const [selectedCalendarId, setSelectedCalendarId] = useState<string | null>(initialCalendarId ?? null);
  const [selectedCalendar, setSelectedCalendar] = useState<Calendar | null>(null);

  const [reservations, setReservations] = useState<SlotReservation[]>([]);
  const [slots, setSlots] = useState<CalendarSlotView[]>([]);

  const [dateRange, setDateRangeState] = useState<{ start: Date; end: Date }>(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    return { start, end };
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch calendars list on mount
  useEffect(() => {
    if (!organisation?.id) return;

    const fetchCalendars = async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await executeRef.current({
          method: 'GET',
          url: `${API_BASE}/organisations/${organisation.id}/calendars`,
        });
        const calendarList = result || [];
        setCalendars(calendarList);
        // Auto-select first calendar if none selected and no initial ID provided
        if (calendarList.length > 0 && !selectedCalendarId && !initialCalendarId) {
          setSelectedCalendarId(calendarList[0].id);
        }
      } catch (err) {
        setError('Failed to load calendars');
        setCalendars([]);
      } finally {
        setLoading(false);
      }
    };

    fetchCalendars();
  }, [organisation?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch calendar details, bookings, and reservations when selectedCalendarId or dateRange changes
  useEffect(() => {
    if (!selectedCalendarId) {
      setSelectedCalendar(null);
      setReservations([]);
      setSlots([]);
      return;
    }

    const fetchCalendarData = async () => {
      setLoading(true);
      setError(null);

      const startStr = formatDate(dateRange.start);
      const endStr = formatDate(dateRange.end);

      try {
        // Fetch calendar with children (configs, blocked periods, schedule rules)
        const calendarData = await executeRef.current({
          method: 'GET',
          url: `${API_BASE}/calendars/${selectedCalendarId}`,
        });

        // Fetch bookings in date range
        const bookingsData = await executeRef.current({
          method: 'GET',
          url: `${API_BASE}/calendars/${selectedCalendarId}/bookings/range?start=${startStr}&end=${endStr}`,
        });

        // Fetch reservations in date range
        const reservationsData = await executeRef.current({
          method: 'GET',
          url: `${API_BASE}/calendars/${selectedCalendarId}/reservations?start=${startStr}&end=${endStr}`,
        });

        if (calendarData) {
          setSelectedCalendar(calendarData);
          const configs: TimeSlotConfiguration[] = calendarData.timeSlotConfigurations || [];
          const blocked: BlockedPeriod[] = calendarData.blockedPeriods || [];

          const fetchedBookings: Booking[] = bookingsData || [];
          const fetchedReservations: SlotReservation[] = reservationsData || [];
          setReservations(fetchedReservations);

          // Generate slots using the calculator
          const generatedSlots = calculateAvailableSlots(
            configs,
            blocked,
            fetchedBookings,
            dateRange.start,
            dateRange.end,
            calendarData.minDaysInAdvance ?? 0,
            calendarData.maxDaysInAdvance ?? 90,
            fetchedReservations
          );
          setSlots(generatedSlots);
        }
      } catch (err) {
        setError('Failed to load calendar data');
      } finally {
        setLoading(false);
      }
    };

    fetchCalendarData();
  }, [selectedCalendarId, dateRange]); // eslint-disable-line react-hooks/exhaustive-deps

  const selectCalendar = useCallback((id: string) => {
    setSelectedCalendarId(id);
  }, []);

  const setDateRange = useCallback((start: Date, end: Date) => {
    setDateRangeState({ start, end });
  }, []);

  const refresh = useCallback(async () => {
    if (!selectedCalendarId) return;

    const startStr = formatDate(dateRange.start);
    const endStr = formatDate(dateRange.end);

    setLoading(true);
    setError(null);

    try {
      const calendarData = await executeRef.current({
        method: 'GET',
        url: `${API_BASE}/calendars/${selectedCalendarId}`,
      });

      const bookingsData = await executeRef.current({
        method: 'GET',
        url: `${API_BASE}/calendars/${selectedCalendarId}/bookings/range?start=${startStr}&end=${endStr}`,
      });

      const reservationsData = await executeRef.current({
        method: 'GET',
        url: `${API_BASE}/calendars/${selectedCalendarId}/reservations?start=${startStr}&end=${endStr}`,
      });

      if (calendarData) {
        setSelectedCalendar(calendarData);
        const configs: TimeSlotConfiguration[] = calendarData.timeSlotConfigurations || [];
        const blocked: BlockedPeriod[] = calendarData.blockedPeriods || [];

        const fetchedBookings: Booking[] = bookingsData || [];
        const fetchedReservations: SlotReservation[] = reservationsData || [];
        setReservations(fetchedReservations);

        const generatedSlots = calculateAvailableSlots(
          configs,
          blocked,
          fetchedBookings,
          dateRange.start,
          dateRange.end,
          calendarData.minDaysInAdvance ?? 0,
          calendarData.maxDaysInAdvance ?? 90,
          fetchedReservations
        );
        setSlots(generatedSlots);
      }
    } catch (err) {
      setError('Failed to refresh calendar data');
    } finally {
      setLoading(false);
    }
  }, [selectedCalendarId, dateRange]);

  const reserveSlot = useCallback(async (data: ReserveSlotRequest) => {
    try {
      await executeRef.current({
        method: 'POST',
        url: `${API_BASE}/calendars/${data.calendarId}/reservations`,
        data: {
          slotDate: data.slotDate,
          startTime: data.startTime,
          duration: data.duration,
          reason: data.reason,
        },
      });
      await refresh();
    } catch (err) {
      setError('Failed to reserve slot');
      throw err;
    }
  }, [refresh]);

  const freeSlot = useCallback(async (reservationId: string) => {
    try {
      await executeRef.current({
        method: 'DELETE',
        url: `${API_BASE}/reservations/${reservationId}`,
      });
      await refresh();
    } catch (err) {
      setError('Failed to free slot');
      throw err;
    }
  }, [refresh]);

  const releaseBooking = useCallback(async (bookingId: string, reason: string, refund: boolean) => {
    try {
      await executeRef.current({
        method: 'POST',
        url: `${API_BASE}/bookings/${bookingId}/cancel`,
        data: { reason, refund },
      });
      await refresh();
    } catch (err) {
      setError('Failed to release booking');
      throw err;
    }
  }, [refresh]);

  return {
    calendars,
    selectedCalendar,
    slots,
    reservations,
    loading,
    error,
    selectCalendar,
    setDateRange,
    reserveSlot,
    freeSlot,
    releaseBooking,
    refresh,
  };
}
