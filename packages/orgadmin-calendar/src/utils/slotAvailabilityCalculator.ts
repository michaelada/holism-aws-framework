/**
 * Slot Availability Calculator Utility
 * 
 * Calculates available slots based on time slot configurations,
 * applies blocked periods, and validates booking windows.
 */

import type {
  TimeSlotConfiguration,
  BlockedPeriod,
  CalendarSlotView,
  Booking,
  SlotReservation,
} from '../types/calendar.types';

/**
 * Calculate available slots for a given date range
 */
export function calculateAvailableSlots(
  configurations: TimeSlotConfiguration[],
  blockedPeriods: BlockedPeriod[],
  bookings: Booking[],
  startDate: Date,
  endDate: Date,
  minDaysInAdvance: number = 0,
  maxDaysInAdvance: number = 90,
  reservations: SlotReservation[] = []
): CalendarSlotView[] {
  const slots: CalendarSlotView[] = [];

  // Generate slots from configurations
  for (const config of configurations) {
    const configSlots = generateSlotsFromConfiguration(
      config,
      startDate,
      endDate
    );
    slots.push(...configSlots);
  }

  // Apply blocked periods
  const availableSlots = applyBlockedPeriods(slots, blockedPeriods);

  // Apply booking window restrictions
  const validSlots = applyBookingWindow(
    availableSlots,
    minDaysInAdvance,
    maxDaysInAdvance
  );

  // Calculate places remaining
  const slotsWithBookings = calculatePlacesRemaining(validSlots, bookings);

  // Merge reservation status
  return mergeReservationStatus(slotsWithBookings, reservations);
}

/**
 * Convert HH:MM to total minutes since midnight
 */
function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

/**
 * Convert total minutes since midnight to HH:MM
 */
function minutesToTime(mins: number): string {
  const h = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Generate slots from a time slot configuration.
 *
 * For each matching day in the date range, generates repeating slots starting
 * from config.startTime at intervals of the smallest duration option, running
 * until end of day (24:00). Each time position produces one slot per duration
 * option (e.g. 30min and 60min). Blocked periods later filter out unavailable times.
 */
function generateSlotsFromConfiguration(
  config: TimeSlotConfiguration,
  startDate: Date,
  endDate: Date
): CalendarSlotView[] {
  const slots: CalendarSlotView[] = [];

  // Parse effective dates — treat as local dates (strip time component)
  const effectiveStart = config.effectiveDateStart
    ? new Date(new Date(config.effectiveDateStart).toISOString().split('T')[0] + 'T00:00:00')
    : null;
  const effectiveEnd = config.effectiveDateEnd
    ? new Date(new Date(config.effectiveDateEnd).toISOString().split('T')[0] + 'T23:59:59')
    : null;

  // Determine the reference week start for recurrence calculation
  const recurrenceWeeks = config.recurrenceWeeks || 1;
  const refWeekStart = effectiveStart
    ? getWeekStart(effectiveStart)
    : getWeekStart(startDate);

  // Determine duration options
  const durationOptions = config.durationOptions || [];
  const startMinutes = timeToMinutes(config.startTime);
  const endOfDay = 24 * 60; // midnight = 1440

  // Iterate through each day in the range
  const current = new Date(startDate);
  current.setHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999);

  while (current <= end) {
    const dayOfWeek = current.getDay();

    // Check if this day of week is in the config
    if (config.daysOfWeek && config.daysOfWeek.includes(dayOfWeek)) {
      // Check effective date range
      const currentDateOnly = new Date(current);
      currentDateOnly.setHours(0, 0, 0, 0);

      const withinEffective =
        (!effectiveStart || currentDateOnly >= effectiveStart) &&
        (!effectiveEnd || currentDateOnly <= effectiveEnd);

      if (withinEffective) {
        // Check recurrence (every N weeks from the effective start)
        const weeksSinceRef = getWeeksDifference(refWeekStart, getWeekStart(current));
        const matchesRecurrence = recurrenceWeeks <= 1 || weeksSinceRef % recurrenceWeeks === 0;

        if (matchesRecurrence) {
          // Generate slots for each duration option independently,
          // each stepping by its own duration from startTime
          const durationOptions = config.durationOptions || [];
          if (durationOptions.length === 0) {
            // Fallback: single 60-min slots
            for (let slotStart = startMinutes; slotStart + 60 <= endOfDay; slotStart += 60) {
              slots.push(createSlotView(current, minutesToTime(slotStart), 60, 0, config.placesAvailable || 1));
            }
          } else {
            for (const opt of durationOptions) {
              for (let slotStart = startMinutes; slotStart + opt.duration <= endOfDay; slotStart += opt.duration) {
                slots.push(createSlotView(
                  current,
                  minutesToTime(slotStart),
                  opt.duration,
                  opt.price,
                  config.placesAvailable || 1
                ));
              }
            }
          }
        }
      }
    }

    // Move to next day
    current.setDate(current.getDate() + 1);
  }

  return slots;
}

/**
 * Create a CalendarSlotView for a given date, time, and duration
 */
function createSlotView(
  date: Date,
  startTime: string,
  duration: number,
  price: number,
  placesAvailable: number
): CalendarSlotView {
  return {
    date: new Date(date),
    startTime,
    duration,
    endTime: minutesToTime(timeToMinutes(startTime) + duration),
    placesAvailable,
    placesBooked: 0,
    placesRemaining: placesAvailable,
    price,
    isAvailable: true,
    isBlocked: false,
    isFull: false,
    isMinimumMet: true,
    bookings: [],
    isBookedByOverlap: false,
    isReserved: false,
    isExactReservation: false,
  };
}

/**
 * Get the start of the week (Sunday) for a given date
 */
function getWeekStart(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay());
  return d;
}

/**
 * Get the number of weeks between two dates (week starts)
 */
function getWeeksDifference(from: Date, to: Date): number {
  const msPerWeek = 7 * 24 * 60 * 60 * 1000;
  return Math.round((to.getTime() - from.getTime()) / msPerWeek);
}

/**
 * Apply blocked periods to remove unavailable slots
 */
function applyBlockedPeriods(
  slots: CalendarSlotView[],
  blockedPeriods: BlockedPeriod[]
): CalendarSlotView[] {
  return slots.filter(slot => !isSlotBlocked(slot, blockedPeriods));
}

/**
 * Check if a slot is blocked
 */
function isSlotBlocked(
  slot: CalendarSlotView,
  blockedPeriods: BlockedPeriod[]
): boolean {
  for (const period of blockedPeriods) {
    if (period.blockType === 'date_range') {
      if (period.startDate && period.endDate) {
        const slotDate = slot.date.getTime();
        const periodStart = new Date(period.startDate).setHours(0, 0, 0, 0);
        const periodEnd = new Date(period.endDate).setHours(23, 59, 59, 999);
        if (slotDate >= periodStart && slotDate <= periodEnd) {
          return true;
        }
      }
    } else if (period.blockType === 'time_segment') {
      const dayOfWeek = slot.date.getDay();
      if (period.daysOfWeek?.includes(dayOfWeek)) {
        if (period.startTime && period.endTime) {
          const slotMins = timeToMinutes(slot.startTime);
          const blockStart = timeToMinutes(period.startTime);
          const blockEnd = timeToMinutes(period.endTime);

          if (blockEnd <= blockStart) {
            // Wraps past midnight (e.g. 18:00 → 00:00 means 18:00–23:59)
            if (slotMins >= blockStart || slotMins < blockEnd) {
              return true;
            }
          } else {
            // Normal range (e.g. 00:00 → 08:00)
            if (slotMins >= blockStart && slotMins < blockEnd) {
              return true;
            }
          }
        }
      }
    }
  }
  return false;
}

/**
 * Apply booking window restrictions
 */
function applyBookingWindow(
  slots: CalendarSlotView[],
  minDaysInAdvance: number,
  maxDaysInAdvance: number
): CalendarSlotView[] {
  const now = new Date();
  const minDate = new Date(now);
  minDate.setDate(minDate.getDate() + minDaysInAdvance);
  
  const maxDate = new Date(now);
  maxDate.setDate(maxDate.getDate() + maxDaysInAdvance);
  
  return slots.map(slot => ({
    ...slot,
    isAvailable: slot.date >= minDate && slot.date <= maxDate && !slot.isBlocked,
  }));
}

/**
 * Calculate places remaining for each slot.
 * Also marks slots as unavailable when an overlapping booking of a different
 * duration covers their time range (e.g. a 60min booking at 09:00 blocks
 * the 30min slots at 09:00-09:30 and 09:30-10:00).
 */
function calculatePlacesRemaining(
  slots: CalendarSlotView[],
  bookings: Booking[]
): CalendarSlotView[] {
  // Pre-process bookings: normalise dates/times and compute time ranges
  const normBookings = bookings
    .filter(b => b.bookingStatus === 'confirmed')
    .map(b => ({
      ...b,
      dateStr: normaliseDate(b.bookingDate),
      startMins: timeToMinutes(normaliseTime(b.startTime)),
      endMins: timeToMinutes(normaliseTime(b.startTime)) + b.duration,
    }));

  return slots.map(slot => {
    const slotDateStr = formatDateToYYYYMMDD(slot.date);
    const slotStartMins = timeToMinutes(slot.startTime);
    const slotEndMins = slotStartMins + slot.duration;

    // Exact match bookings: same date, same start time, same duration
    const exactBookings = normBookings.filter(
      b => b.dateStr === slotDateStr &&
           b.startMins === slotStartMins &&
           b.duration === slot.duration
    );

    const placesBooked = exactBookings.reduce(
      (sum, booking) => sum + booking.placesBooked,
      0
    );

    const placesRemaining = slot.placesAvailable - placesBooked;
    const isFull = placesRemaining <= 0;

    // Overlap check: any confirmed booking on the same date whose time range
    // overlaps this slot but is NOT an exact match (different duration or start)
    const hasOverlappingBooking = normBookings.some(
      b => b.dateStr === slotDateStr &&
           b.startMins < slotEndMins &&
           b.endMins > slotStartMins &&
           !(b.startMins === slotStartMins && b.duration === slot.duration)
    );

    return {
      ...slot,
      placesBooked,
      placesRemaining,
      isFull,
      bookings: exactBookings,
      isBookedByOverlap: hasOverlappingBooking,
      isAvailable: slot.isAvailable && !hasOverlappingBooking && !isFull,
    };
  });
}

/**
 * Normalise a time value to HH:MM (strip seconds if present, handle Date objects)
 */
function normaliseTime(time: any): string {
  if (!time) return '';
  const str = String(time);
  // Handle "HH:MM:SS" → "HH:MM"
  return str.substring(0, 5);
}

/**
 * Normalise a date value to YYYY-MM-DD string (handles Date objects, ISO strings, plain date strings)
 */
function normaliseDate(date: any): string {
  if (!date) return '';
  if (date instanceof Date) return formatDateToYYYYMMDD(date);
  const str = String(date);
  // Handle ISO strings like "2026-03-24T00:00:00.000Z" or plain "2026-03-24"
  return str.substring(0, 10);
}

/**
 * Merge reservation status into slots.
 * A reserved slot has isReserved = true, isAvailable = false, and the reservation object attached.
 * Also marks overlapping slots as reserved — e.g. a 60min reservation at 09:00 blocks
 * the 30min slots at 09:00 and 09:30.
 */
function mergeReservationStatus(
  slots: CalendarSlotView[],
  reservations: SlotReservation[]
): CalendarSlotView[] {
  // Pre-process reservations: normalise dates/times and compute time ranges
  const normReservations = reservations.map(r => ({
    ...r,
    dateStr: normaliseDate(r.slotDate),
    startMins: timeToMinutes(normaliseTime(r.startTime)),
    endMins: timeToMinutes(normaliseTime(r.startTime)) + r.duration,
  }));

  return slots.map(slot => {
    const slotDateStr = formatDateToYYYYMMDD(slot.date);
    const slotStartMins = timeToMinutes(slot.startTime);
    const slotEndMins = slotStartMins + slot.duration;

    // Exact match: same date, same start time, same duration
    const exactMatch = normReservations.find(
      r => r.dateStr === slotDateStr &&
           r.startMins === slotStartMins &&
           r.duration === slot.duration
    );

    if (exactMatch) {
      return {
        ...slot,
        isReserved: true,
        isExactReservation: true,
        isAvailable: false,
        reservation: exactMatch,
      };
    }

    // Overlap check: a reservation on the same date whose time range fully covers this slot
    const overlapping = normReservations.find(
      r => r.dateStr === slotDateStr &&
           r.startMins <= slotStartMins &&
           r.endMins >= slotEndMins
    );

    if (overlapping) {
      return {
        ...slot,
        isReserved: true,
        isExactReservation: false,
        isAvailable: false,
        reservation: overlapping,
      };
    }

    // Partial overlap: a reservation on the same date that overlaps any part of this slot
    const partialOverlap = normReservations.find(
      r => r.dateStr === slotDateStr &&
           r.startMins < slotEndMins &&
           r.endMins > slotStartMins
    );

    if (partialOverlap) {
      return {
        ...slot,
        isReserved: true,
        isExactReservation: false,
        isAvailable: false,
        reservation: partialOverlap,
      };
    }

    return {
      ...slot,
      isReserved: false,
      isExactReservation: false,
    };
  });
}

/**
 * Format a Date to YYYY-MM-DD string for comparison with reservation slotDate
 */
function formatDateToYYYYMMDD(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

