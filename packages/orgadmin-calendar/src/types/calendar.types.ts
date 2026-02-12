/**
 * Calendar Bookings Types
 * 
 * Type definitions for the calendar bookings module.
 * Based on the design document section 4.5.
 */

// Calendar status and configuration types
export type CalendarStatus = 'open' | 'closed';
export type BookingStatus = 'confirmed' | 'cancelled' | 'pending_payment';
export type PaymentStatus = 'pending' | 'paid' | 'refunded';

/**
 * Main Calendar entity
 * Represents a bookable resource (court, arena, facility, etc.)
 */
export interface Calendar {
  id: string;
  organisationId: string;
  
  // Basic Information
  name: string;                        // Display name (e.g., "Tennis Court 1")
  description: string;                 // Detailed information about the resource
  displayColour: string;               // Hex colour code for calendar view
  status: CalendarStatus;              // Open or Closed
  
  // Automated Opening/Closing
  enableAutomatedSchedule: boolean;    // Enable automatic status changes
  scheduleRules?: ScheduleRule[];      // Rules for automatic opening/closing
  
  // Booking Window Configuration
  minDaysInAdvance?: number;           // Minimum days before timeslot that bookings allowed (default 0)
  maxDaysInAdvance?: number;           // Maximum days in future that bookings allowed (default 90)
  
  // Terms and Conditions
  useTermsAndConditions: boolean;      // Require T&C acceptance
  termsAndConditions?: string;         // Rich text T&Cs
  
  // Payment Configuration
  supportedPaymentMethods: string[];   // Payment method IDs from Payments module
  
  // Cancellation Policy
  allowCancellations: boolean;         // Enable self-service cancellations (default false)
  cancelDaysInAdvance?: number;        // Days before timeslot that cancellations allowed
  refundPaymentAutomatically: boolean; // Auto-refund on cancellation (default false)
  
  // Email Notifications
  adminNotificationEmails?: string;    // Comma-separated emails for booking notifications
  sendReminderEmails: boolean;         // Send reminder emails before bookings
  reminderHoursBefore?: number;        // Hours before booking to send reminder
  
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Schedule rule for automated opening/closing
 */
export interface ScheduleRule {
  id: string;
  calendarId: string;
  startDate: Date;                     // When this rule starts applying
  endDate?: Date;                      // When this rule stops (null = indefinite)
  action: 'open' | 'close';            // What to do
  timeOfDay?: string;                  // Time to execute action (HH:MM format)
  reason?: string;                     // Description (e.g., "Winter break")
  order: number;                       // Execution order for overlapping rules
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Time slot configuration - defines available booking slots
 */
export interface TimeSlotConfiguration {
  id: string;
  calendarId: string;
  
  // Schedule
  daysOfWeek: number[];                // 0=Sunday, 1=Monday, etc. (multi-select)
  startTime: string;                   // HH:MM format
  effectiveDateStart: Date;            // When this configuration starts
  effectiveDateEnd?: Date;             // When this configuration ends (null = indefinite)
  recurrenceWeeks: number;             // 1=every week, 2=every 2 weeks, etc.
  
  // Capacity
  placesAvailable: number;             // Number of bookings allowed (default 1)
  minPlacesRequired?: number;          // Minimum bookings before slot considered "booked"
  
  // Duration and Pricing Options
  durationOptions: DurationOption[];   // Multiple duration/price combinations
  
  order: number;                       // Display order
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Duration option - allows multiple durations/prices for same timeslot
 */
export interface DurationOption {
  id: string;
  timeSlotConfigurationId: string;
  duration: number;                    // Minutes
  price: number;                       // Cost for this duration
  label: string;                       // Display name (e.g., "Half Hour", "Full Hour")
  order: number;                       // Display order
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Blocked period - prevents bookings during specific times
 */
export interface BlockedPeriod {
  id: string;
  calendarId: string;
  blockType: 'date_range' | 'time_segment'; // Type of block
  
  // For date_range blocks
  startDate?: Date;                    // Start of blocked period
  endDate?: Date;                      // End of blocked period
  
  // For time_segment blocks
  daysOfWeek?: number[];               // Which days this block applies to
  startTime?: string;                  // HH:MM format
  endTime?: string;                    // HH:MM format
  
  reason?: string;                     // Why this period is blocked
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Booking entity - represents an actual booking
 */
export interface Booking {
  id: string;
  bookingReference: string;            // Unique reference for user (e.g., "BK-2024-001234")
  calendarId: string;
  userId: string;                      // Account user who made booking
  
  // Booking Details
  bookingDate: Date;                   // Date of the booking
  startTime: string;                   // HH:MM format
  duration: number;                    // Minutes
  endTime: string;                     // Calculated: HH:MM format
  placesBooked: number;                // Number of places booked (default 1)
  
  // Pricing
  pricePerPlace: number;               // Price for each place
  totalPrice: number;                  // placesBooked × pricePerPlace
  
  // Status
  bookingStatus: BookingStatus;        // Confirmed, Cancelled, Pending Payment
  paymentStatus: PaymentStatus;        // Pending, Paid, Refunded
  paymentMethod?: string;              // Payment method used
  
  // Form Submission (if calendar requires additional info)
  formSubmissionId?: string;           // Link to FormSubmission
  
  // Cancellation Details
  cancelledAt?: Date;                  // When booking was cancelled
  cancelledBy?: string;                // User ID who cancelled (user or admin)
  cancellationReason?: string;         // Why it was cancelled
  refundProcessed: boolean;            // Whether refund was completed
  refundedAt?: Date;                   // When refund was processed
  
  // Admin Notes
  adminNotes?: string;                 // Internal notes
  
  // Timestamps
  bookedAt: Date;                      // When booking was made
  createdAt: Date;
  updatedAt: Date;
  
  // Populated fields (from joins)
  calendar?: Calendar;
  userName?: string;
  userEmail?: string;
  userPhone?: string;
}

/**
 * Booking history for audit trail
 */
export interface BookingHistory {
  id: string;
  bookingId: string;
  userId: string;                      // Who made the change
  action: string;                      // What changed (e.g., "status_changed", "cancelled", "refunded")
  previousValue?: string;              // Old value
  newValue?: string;                   // New value
  notes?: string;                      // Additional context
  createdAt: Date;
}

/**
 * View model for calendar display
 * Used to render available slots in calendar views
 */
export interface CalendarSlotView {
  date: Date;
  startTime: string;
  duration: number;
  endTime: string;
  placesAvailable: number;
  placesBooked: number;
  placesRemaining: number;
  price: number;
  isAvailable: boolean;                // Can be booked
  isBlocked: boolean;                  // Blocked period
  isFull: boolean;                     // All places booked
  isMinimumMet: boolean;               // Minimum places requirement met (if applicable)
  bookings: Booking[];                 // Existing bookings for this slot
}

/**
 * Form data types for creating/editing calendars
 */
export interface CalendarFormData {
  name: string;
  description: string;
  displayColour: string;
  status: CalendarStatus;
  
  enableAutomatedSchedule: boolean;
  scheduleRules: {
    startDate: Date;
    endDate?: Date;
    action: 'open' | 'close';
    timeOfDay?: string;
    reason?: string;
  }[];
  
  minDaysInAdvance?: number;
  maxDaysInAdvance?: number;
  
  useTermsAndConditions: boolean;
  termsAndConditions?: string;
  
  supportedPaymentMethods: string[];
  
  allowCancellations: boolean;
  cancelDaysInAdvance?: number;
  refundPaymentAutomatically: boolean;
  
  adminNotificationEmails?: string;
  sendReminderEmails: boolean;
  reminderHoursBefore?: number;
}

/**
 * Form data for time slot configuration
 */
export interface TimeSlotConfigurationFormData {
  daysOfWeek: number[];
  startTime: string;
  effectiveDateStart: Date;
  effectiveDateEnd?: Date;
  recurrenceWeeks: number;
  placesAvailable: number;
  minPlacesRequired?: number;
  durationOptions: {
    duration: number;
    price: number;
    label: string;
  }[];
}

/**
 * Form data for blocked periods
 */
export interface BlockedPeriodFormData {
  blockType: 'date_range' | 'time_segment';
  
  // For date_range blocks
  startDate?: Date;
  endDate?: Date;
  
  // For time_segment blocks
  daysOfWeek?: number[];
  startTime?: string;
  endTime?: string;
  
  reason?: string;
}

/**
 * Filter options for bookings list
 */
export interface BookingsFilterOptions {
  calendarId?: string;
  dateFrom?: Date;
  dateTo?: Date;
  bookingStatus?: BookingStatus[];
  paymentStatus?: PaymentStatus[];
  userSearch?: string;
}

/**
 * Cancellation validation result
 */
export interface CancellationValidation {
  canCancel: boolean;
  canRefund: boolean;
  reason?: string;
  daysUntilBooking: number;
}
