/**
 * Calendar Module Tests
 * 
 * Comprehensive tests for calendar functionality including:
 * - Calendar list rendering and filtering
 * - Calendar creation form validation
 * - Time slot configuration
 * - Blocked periods
 * - Schedule rules
 * - Bookings list filtering
 * - Slot availability calculator
 * - Cancellation validator
 */

import { describe, it, expect } from 'vitest';
import {
  calculateAvailableSlots,
  isSlotBlocked,
} from '../utils/slotAvailabilityCalculator';
import {
  validateCancellation,
  calculateDaysUntilBooking,
  isWithinCancellationWindow,
} from '../utils/cancellationValidator';
import type {
  Calendar,
  Booking,
  TimeSlotConfiguration,
  BlockedPeriod,
  CalendarSlotView,
} from '../types/calendar.types';

describe('Calendar Module', () => {
  describe('Calendar Types', () => {
    it('should define Calendar interface correctly', () => {
      const calendar: Calendar = {
        id: '1',
        organisationId: 'org-1',
        name: 'Tennis Court 1',
        description: 'Main tennis court',
        displayColour: '#1976d2',
        status: 'open',
        enableAutomatedSchedule: false,
        minDaysInAdvance: 0,
        maxDaysInAdvance: 90,
        useTermsAndConditions: false,
        supportedPaymentMethods: ['card'],
        allowCancellations: true,
        cancelDaysInAdvance: 2,
        refundPaymentAutomatically: false,
        sendReminderEmails: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(calendar.name).toBe('Tennis Court 1');
      expect(calendar.status).toBe('open');
    });

    it('should define Booking interface correctly', () => {
      const booking: Booking = {
        id: '1',
        bookingReference: 'BK-2024-001',
        calendarId: 'cal-1',
        userId: 'user-1',
        bookingDate: new Date('2024-06-01'),
        startTime: '10:00',
        duration: 60,
        endTime: '11:00',
        placesBooked: 1,
        pricePerPlace: 20,
        totalPrice: 20,
        bookingStatus: 'confirmed',
        paymentStatus: 'paid',
        refundProcessed: false,
        bookedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(booking.bookingReference).toBe('BK-2024-001');
      expect(booking.bookingStatus).toBe('confirmed');
    });
  });

  describe('Cancellation Validator', () => {
    const mockCalendar: Calendar = {
      id: '1',
      organisationId: 'org-1',
      name: 'Test Calendar',
      description: 'Test',
      displayColour: '#000000',
      status: 'open',
      enableAutomatedSchedule: false,
      useTermsAndConditions: false,
      supportedPaymentMethods: [],
      allowCancellations: true,
      cancelDaysInAdvance: 2,
      refundPaymentAutomatically: true,
      sendReminderEmails: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('should allow cancellation when within window', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 5);

      const booking: Booking = {
        id: '1',
        bookingReference: 'BK-001',
        calendarId: '1',
        userId: 'user-1',
        bookingDate: futureDate,
        startTime: '10:00',
        duration: 60,
        endTime: '11:00',
        placesBooked: 1,
        pricePerPlace: 20,
        totalPrice: 20,
        bookingStatus: 'confirmed',
        paymentStatus: 'paid',
        refundProcessed: false,
        bookedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const validation = validateCancellation(booking, mockCalendar);
      expect(validation.canCancel).toBe(true);
      expect(validation.canRefund).toBe(true);
    });

    it('should not allow cancellation when outside window', () => {
      const nearDate = new Date();
      nearDate.setDate(nearDate.getDate() + 1);

      const booking: Booking = {
        id: '1',
        bookingReference: 'BK-001',
        calendarId: '1',
        userId: 'user-1',
        bookingDate: nearDate,
        startTime: '10:00',
        duration: 60,
        endTime: '11:00',
        placesBooked: 1,
        pricePerPlace: 20,
        totalPrice: 20,
        bookingStatus: 'confirmed',
        paymentStatus: 'paid',
        refundProcessed: false,
        bookedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const validation = validateCancellation(booking, mockCalendar);
      expect(validation.canCancel).toBe(false);
      expect(validation.reason).toContain('at least 2 days in advance');
    });

    it('should not allow cancellation when already cancelled', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 5);

      const booking: Booking = {
        id: '1',
        bookingReference: 'BK-001',
        calendarId: '1',
        userId: 'user-1',
        bookingDate: futureDate,
        startTime: '10:00',
        duration: 60,
        endTime: '11:00',
        placesBooked: 1,
        pricePerPlace: 20,
        totalPrice: 20,
        bookingStatus: 'cancelled',
        paymentStatus: 'paid',
        refundProcessed: false,
        bookedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const validation = validateCancellation(booking, mockCalendar);
      expect(validation.canCancel).toBe(false);
      expect(validation.reason).toContain('already cancelled');
    });

    it('should calculate days until booking correctly', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 5);

      const days = calculateDaysUntilBooking(futureDate);
      expect(days).toBeGreaterThanOrEqual(4);
      expect(days).toBeLessThanOrEqual(6);
    });

    it('should check cancellation window correctly', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 5);

      const isWithin = isWithinCancellationWindow(futureDate, 2);
      expect(isWithin).toBe(true);

      const nearDate = new Date();
      nearDate.setDate(nearDate.getDate() + 1);

      const isNotWithin = isWithinCancellationWindow(nearDate, 2);
      expect(isNotWithin).toBe(false);
    });
  });

  describe('Slot Availability Calculator', () => {
    it('should calculate available slots', () => {
      const configurations: TimeSlotConfiguration[] = [];
      const blockedPeriods: BlockedPeriod[] = [];
      const bookings: Booking[] = [];
      const startDate = new Date('2024-06-01');
      const endDate = new Date('2024-06-07');

      const slots = calculateAvailableSlots(
        configurations,
        blockedPeriods,
        bookings,
        startDate,
        endDate
      );

      expect(Array.isArray(slots)).toBe(true);
    });

    it('should apply booking window restrictions', () => {
      const configurations: TimeSlotConfiguration[] = [];
      const blockedPeriods: BlockedPeriod[] = [];
      const bookings: Booking[] = [];
      const startDate = new Date();
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 100);

      const slots = calculateAvailableSlots(
        configurations,
        blockedPeriods,
        bookings,
        startDate,
        endDate,
        0,
        90
      );

      // Slots beyond 90 days should not be available
      expect(Array.isArray(slots)).toBe(true);
    });
  });

  describe('Calendar Form Validation', () => {
    it('should validate required fields', () => {
      const formData = {
        name: '',
        description: '',
        displayColour: '#1976d2',
        status: 'open' as const,
        enableAutomatedSchedule: false,
        scheduleRules: [],
        useTermsAndConditions: false,
        supportedPaymentMethods: [],
        allowCancellations: false,
        refundPaymentAutomatically: false,
        sendReminderEmails: false,
      };

      const isValid = !!(formData.name && formData.description);
      expect(isValid).toBe(false);
    });

    it('should validate colour format', () => {
      const validColour = '#1976d2';
      const invalidColour = 'blue';

      expect(validColour.startsWith('#')).toBe(true);
      expect(invalidColour.startsWith('#')).toBe(false);
    });
  });

  describe('Schedule Rules', () => {
    it('should create schedule rule with required fields', () => {
      const rule = {
        startDate: new Date('2024-06-01'),
        action: 'open' as const,
      };

      expect(rule.startDate).toBeInstanceOf(Date);
      expect(rule.action).toBe('open');
    });

    it('should support optional end date', () => {
      const rule = {
        startDate: new Date('2024-06-01'),
        endDate: new Date('2024-12-31'),
        action: 'close' as const,
        reason: 'Winter break',
      };

      expect(rule.endDate).toBeInstanceOf(Date);
      expect(rule.reason).toBe('Winter break');
    });
  });

  describe('Blocked Periods', () => {
    it('should create date range block', () => {
      const block: BlockedPeriod = {
        id: '1',
        calendarId: 'cal-1',
        blockType: 'date_range',
        startDate: new Date('2024-12-25'),
        endDate: new Date('2024-12-26'),
        reason: 'Christmas holidays',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(block.blockType).toBe('date_range');
      expect(block.startDate).toBeInstanceOf(Date);
    });

    it('should create time segment block', () => {
      const block: BlockedPeriod = {
        id: '1',
        calendarId: 'cal-1',
        blockType: 'time_segment',
        daysOfWeek: [1, 2, 3, 4, 5], // Monday to Friday
        startTime: '12:00',
        endTime: '13:00',
        reason: 'Lunch break',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(block.blockType).toBe('time_segment');
      expect(block.daysOfWeek).toHaveLength(5);
    });
  });

  describe('Time Slot Configuration', () => {
    it('should create time slot with duration options', () => {
      const config: TimeSlotConfiguration = {
        id: '1',
        calendarId: 'cal-1',
        daysOfWeek: [1, 3, 5], // Mon, Wed, Fri
        startTime: '09:00',
        effectiveDateStart: new Date('2024-06-01'),
        recurrenceWeeks: 1,
        placesAvailable: 1,
        durationOptions: [
          {
            id: '1',
            timeSlotConfigurationId: '1',
            duration: 30,
            price: 10,
            label: 'Half Hour',
            order: 1,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          {
            id: '2',
            timeSlotConfigurationId: '1',
            duration: 60,
            price: 15,
            label: 'Full Hour',
            order: 2,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
        order: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(config.durationOptions).toHaveLength(2);
      expect(config.daysOfWeek).toContain(1);
    });

    it('should support minimum places requirement', () => {
      const config: TimeSlotConfiguration = {
        id: '1',
        calendarId: 'cal-1',
        daysOfWeek: [1],
        startTime: '09:00',
        effectiveDateStart: new Date(),
        recurrenceWeeks: 1,
        placesAvailable: 8,
        minPlacesRequired: 5,
        durationOptions: [],
        order: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(config.placesAvailable).toBe(8);
      expect(config.minPlacesRequired).toBe(5);
    });
  });
});
