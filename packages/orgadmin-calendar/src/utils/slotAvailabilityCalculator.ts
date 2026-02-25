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
  maxDaysInAdvance: number = 90
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
  return calculatePlacesRemaining(validSlots, bookings);
}

/**
 * Generate slots from a time slot configuration
 */
function generateSlotsFromConfiguration(
  _config: TimeSlotConfiguration,
  _startDate: Date,
  _endDate: Date
): CalendarSlotView[] {
  const slots: CalendarSlotView[] = [];
  
  // Implementation would iterate through dates and generate slots
  // based on daysOfWeek, startTime, recurrenceWeeks, etc.
  
  return slots;
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
        const slotDate = slot.date;
        if (slotDate >= period.startDate && slotDate <= period.endDate) {
          return true;
        }
      }
    } else if (period.blockType === 'time_segment') {
      // Check if slot falls within time segment
      const dayOfWeek = slot.date.getDay();
      if (period.daysOfWeek?.includes(dayOfWeek)) {
        if (period.startTime && period.endTime) {
          if (slot.startTime >= period.startTime && slot.startTime < period.endTime) {
            return true;
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
 * Calculate places remaining for each slot
 */
function calculatePlacesRemaining(
  slots: CalendarSlotView[],
  bookings: Booking[]
): CalendarSlotView[] {
  return slots.map(slot => {
    const slotBookings = bookings.filter(
      booking =>
        booking.bookingDate.toDateString() === slot.date.toDateString() &&
        booking.startTime === slot.startTime &&
        booking.bookingStatus === 'confirmed'
    );
    
    const placesBooked = slotBookings.reduce(
      (sum, booking) => sum + booking.placesBooked,
      0
    );
    
    const placesRemaining = slot.placesAvailable - placesBooked;
    const isFull = placesRemaining <= 0;
    
    return {
      ...slot,
      placesBooked,
      placesRemaining,
      isFull,
      bookings: slotBookings,
    };
  });
}
