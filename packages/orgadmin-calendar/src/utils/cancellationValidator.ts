/**
 * Cancellation Validator Utility
 * 
 * Validates if a booking can be cancelled based on cancellation policy.
 */

import type { Booking, Calendar, CancellationValidation } from '../types/calendar.types';

/**
 * Validate if a booking can be cancelled
 */
export function validateCancellation(
  booking: Booking,
  calendar: Calendar
): CancellationValidation {
  // Check if cancellations are allowed
  if (!calendar.allowCancellations) {
    return {
      canCancel: false,
      canRefund: false,
      reason: 'Cancellations are not allowed for this calendar',
      daysUntilBooking: 0,
    };
  }
  
  // Check if booking is already cancelled
  if (booking.bookingStatus === 'cancelled') {
    return {
      canCancel: false,
      canRefund: false,
      reason: 'Booking is already cancelled',
      daysUntilBooking: 0,
    };
  }
  
  // Calculate days until booking
  const now = new Date();
  const bookingDate = new Date(booking.bookingDate);
  const daysUntilBooking = Math.ceil(
    (bookingDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
  );
  
  // Check if within cancellation window
  const cancelDaysInAdvance = calendar.cancelDaysInAdvance || 0;
  if (daysUntilBooking < cancelDaysInAdvance) {
    return {
      canCancel: false,
      canRefund: false,
      reason: `Cancellations must be made at least ${cancelDaysInAdvance} days in advance`,
      daysUntilBooking,
    };
  }
  
  // Check if refund can be processed
  const canRefund =
    calendar.refundPaymentAutomatically &&
    booking.paymentStatus === 'paid' &&
    !booking.refundProcessed;
  
  return {
    canCancel: true,
    canRefund,
    daysUntilBooking,
  };
}

/**
 * Calculate days until booking
 */
export function calculateDaysUntilBooking(bookingDate: Date): number {
  const now = new Date();
  const booking = new Date(bookingDate);
  return Math.ceil((booking.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Check if booking is within cancellation window
 */
export function isWithinCancellationWindow(
  bookingDate: Date,
  cancelDaysInAdvance: number
): boolean {
  const daysUntil = calculateDaysUntilBooking(bookingDate);
  return daysUntil >= cancelDaysInAdvance;
}

/**
 * Generate cancellation message
 */
export function generateCancellationMessage(
  validation: CancellationValidation
): string {
  if (!validation.canCancel) {
    return validation.reason || 'Cancellation not allowed';
  }
  
  if (validation.canRefund) {
    return 'Booking can be cancelled with automatic refund';
  }
  
  return 'Booking can be cancelled (no refund will be processed)';
}
