import { CalendarService } from '../calendar.service';
import { db } from '../../database/pool';

// Mock dependencies
jest.mock('../../database/pool');
jest.mock('../../config/logger');

describe('CalendarService', () => {
  let service: CalendarService;
  const mockDb = db as jest.Mocked<typeof db>;

  beforeEach(() => {
    service = new CalendarService();
    jest.clearAllMocks();
  });

  describe('getCalendarsByOrganisation', () => {
    it('should return all calendars for an organisation', async () => {
      const mockCalendars = [
        {
          id: '1',
          organisation_id: 'org-1',
          name: 'Tennis Court 1',
          description: 'Main tennis court',
          display_colour: '#1976d2',
          status: 'open',
          enable_automated_schedule: false,
          min_days_in_advance: 0,
          max_days_in_advance: 90,
          use_terms_and_conditions: false,
          terms_and_conditions: null,
          supported_payment_methods: ['card', 'offline'],
          allow_cancellations: true,
          cancel_days_in_advance: 2,
          refund_payment_automatically: false,
          admin_notification_emails: 'admin@example.com',
          send_reminder_emails: false,
          reminder_hours_before: null,
          created_at: new Date(),
          updated_at: new Date(),
        },
      ];

      mockDb.query.mockResolvedValue({ rows: mockCalendars } as any);

      const result = await service.getCalendarsByOrganisation('org-1');

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Tennis Court 1');
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE organisation_id = $1'),
        ['org-1']
      );
    });
  });

  describe('getCalendarById', () => {
    it('should return calendar by ID', async () => {
      const mockCalendar = {
        id: '1',
        organisation_id: 'org-1',
        name: 'Tennis Court 1',
        description: 'Main tennis court',
        display_colour: '#1976d2',
        status: 'open',
        enable_automated_schedule: false,
        min_days_in_advance: 0,
        max_days_in_advance: 90,
        use_terms_and_conditions: false,
        terms_and_conditions: null,
        supported_payment_methods: ['card', 'offline'],
        allow_cancellations: true,
        cancel_days_in_advance: 2,
        refund_payment_automatically: false,
        admin_notification_emails: 'admin@example.com',
        send_reminder_emails: false,
        reminder_hours_before: null,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockDb.query.mockResolvedValue({ rows: [mockCalendar] } as any);

      const result = await service.getCalendarById('1');

      expect(result).not.toBeNull();
      expect(result?.name).toBe('Tennis Court 1');
    });

    it('should return null when calendar not found', async () => {
      mockDb.query.mockResolvedValue({ rows: [] } as any);

      const result = await service.getCalendarById('999');

      expect(result).toBeNull();
    });
  });

  describe('createCalendar', () => {
    it('should create calendar with all attributes', async () => {
      const newCalendar = {
        organisationId: 'org-1',
        name: 'Tennis Court 1',
        description: 'Main tennis court',
        displayColour: '#1976d2',
        status: 'open' as const,
        enableAutomatedSchedule: false,
        minDaysInAdvance: 0,
        maxDaysInAdvance: 90,
        useTermsAndConditions: false,
        supportedPaymentMethods: ['card', 'offline'],
        allowCancellations: true,
        cancelDaysInAdvance: 2,
        refundPaymentAutomatically: false,
        adminNotificationEmails: 'admin@example.com',
        sendReminderEmails: false,
      };

      const mockCreated = {
        id: '1',
        organisation_id: 'org-1',
        name: 'Tennis Court 1',
        description: 'Main tennis court',
        display_colour: '#1976d2',
        status: 'open',
        enable_automated_schedule: false,
        min_days_in_advance: 0,
        max_days_in_advance: 90,
        use_terms_and_conditions: false,
        terms_and_conditions: null,
        supported_payment_methods: ['card', 'offline'],
        allow_cancellations: true,
        cancel_days_in_advance: 2,
        refund_payment_automatically: false,
        admin_notification_emails: 'admin@example.com',
        send_reminder_emails: false,
        reminder_hours_before: null,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockDb.query.mockResolvedValue({ rows: [mockCreated] } as any);

      const result = await service.createCalendar(newCalendar);

      expect(result.name).toBe('Tennis Court 1');
      expect(result.allowCancellations).toBe(true);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO calendars'),
        expect.any(Array)
      );
    });

    it('should throw error when cancellations enabled without cancel days', async () => {
      const invalidCalendar = {
        organisationId: 'org-1',
        name: 'Tennis Court 1',
        description: 'Main tennis court',
        displayColour: '#1976d2',
        supportedPaymentMethods: ['card'],
        allowCancellations: true,
        // Missing cancelDaysInAdvance
      };

      await expect(service.createCalendar(invalidCalendar)).rejects.toThrow(
        'Cancel days in advance is required when cancellations are allowed'
      );
    });

    it('should throw error when terms enabled without terms text', async () => {
      const invalidCalendar = {
        organisationId: 'org-1',
        name: 'Tennis Court 1',
        description: 'Main tennis court',
        displayColour: '#1976d2',
        supportedPaymentMethods: ['card'],
        useTermsAndConditions: true,
        // Missing termsAndConditions
      };

      await expect(service.createCalendar(invalidCalendar)).rejects.toThrow(
        'Terms and conditions text is required when use terms and conditions is enabled'
      );
    });

    it('should throw error when reminder emails enabled without hours', async () => {
      const invalidCalendar = {
        organisationId: 'org-1',
        name: 'Tennis Court 1',
        description: 'Main tennis court',
        displayColour: '#1976d2',
        supportedPaymentMethods: ['card'],
        sendReminderEmails: true,
        // Missing reminderHoursBefore
      };

      await expect(service.createCalendar(invalidCalendar)).rejects.toThrow(
        'Reminder hours before is required when reminder emails are enabled'
      );
    });

    it('should throw error when min days > max days', async () => {
      const invalidCalendar = {
        organisationId: 'org-1',
        name: 'Tennis Court 1',
        description: 'Main tennis court',
        displayColour: '#1976d2',
        supportedPaymentMethods: ['card'],
        minDaysInAdvance: 30,
        maxDaysInAdvance: 10,
      };

      await expect(service.createCalendar(invalidCalendar)).rejects.toThrow(
        'Minimum days in advance cannot be greater than maximum days in advance'
      );
    });
  });

  describe('updateCalendar', () => {
    it('should update calendar attributes', async () => {
      const existingCalendar = {
        id: '1',
        organisation_id: 'org-1',
        name: 'Tennis Court 1',
        description: 'Main tennis court',
        display_colour: '#1976d2',
        status: 'open',
        enable_automated_schedule: false,
        min_days_in_advance: 0,
        max_days_in_advance: 90,
        use_terms_and_conditions: false,
        terms_and_conditions: null,
        supported_payment_methods: ['card'],
        allow_cancellations: false,
        cancel_days_in_advance: null,
        refund_payment_automatically: false,
        admin_notification_emails: null,
        send_reminder_emails: false,
        reminder_hours_before: null,
        created_at: new Date(),
        updated_at: new Date(),
      };

      const updatedCalendar = {
        ...existingCalendar,
        name: 'Tennis Court 1 - Updated',
        status: 'closed',
      };

      mockDb.query
        .mockResolvedValueOnce({ rows: [existingCalendar] } as any) // getCalendarById
        .mockResolvedValueOnce({ rows: [updatedCalendar] } as any); // update

      const result = await service.updateCalendar('1', {
        name: 'Tennis Court 1 - Updated',
        status: 'closed',
      });

      expect(result.name).toBe('Tennis Court 1 - Updated');
      expect(result.status).toBe('closed');
    });

    it('should throw error when calendar not found', async () => {
      mockDb.query.mockResolvedValue({ rows: [] } as any);

      await expect(service.updateCalendar('999', { name: 'Updated' })).rejects.toThrow(
        'Calendar not found'
      );
    });
  });

  describe('deleteCalendar', () => {
    it('should delete calendar', async () => {
      mockDb.query.mockResolvedValue({ rowCount: 1 } as any);

      await service.deleteCalendar('1');

      expect(mockDb.query).toHaveBeenCalledWith(
        'DELETE FROM calendars WHERE id = $1',
        ['1']
      );
    });

    it('should throw error when calendar not found', async () => {
      mockDb.query.mockResolvedValue({ rowCount: 0 } as any);

      await expect(service.deleteCalendar('999')).rejects.toThrow('Calendar not found');
    });
  });

  describe('getBookingsByCalendar', () => {
    it('should return all bookings for a calendar', async () => {
      const mockBookings = [
        {
          id: '1',
          booking_reference: 'BK-2024-000001',
          calendar_id: 'cal-1',
          user_id: 'user-1',
          booking_date: new Date('2024-07-01'),
          start_time: '10:00',
          duration: 60,
          end_time: '11:00',
          places_booked: 1,
          price_per_place: 25.0,
          total_price: 25.0,
          booking_status: 'confirmed',
          payment_status: 'paid',
          payment_method: 'card',
          form_submission_id: null,
          cancelled_at: null,
          cancelled_by: null,
          cancellation_reason: null,
          refund_processed: false,
          refunded_at: null,
          admin_notes: null,
          booked_at: new Date(),
          created_at: new Date(),
          updated_at: new Date(),
        },
      ];

      mockDb.query.mockResolvedValue({ rows: mockBookings } as any);

      const result = await service.getBookingsByCalendar('cal-1');

      expect(result).toHaveLength(1);
      expect(result[0].bookingReference).toBe('BK-2024-000001');
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE calendar_id = $1'),
        ['cal-1']
      );
    });
  });

  describe('getBookingById', () => {
    it('should return booking by ID', async () => {
      const mockBooking = {
        id: '1',
        booking_reference: 'BK-2024-000001',
        calendar_id: 'cal-1',
        user_id: 'user-1',
        booking_date: new Date('2024-07-01'),
        start_time: '10:00',
        duration: 60,
        end_time: '11:00',
        places_booked: 1,
        price_per_place: 25.0,
        total_price: 25.0,
        booking_status: 'confirmed',
        payment_status: 'paid',
        payment_method: 'card',
        form_submission_id: null,
        cancelled_at: null,
        cancelled_by: null,
        cancellation_reason: null,
        refund_processed: false,
        refunded_at: null,
        admin_notes: null,
        booked_at: new Date(),
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockDb.query.mockResolvedValue({ rows: [mockBooking] } as any);

      const result = await service.getBookingById('1');

      expect(result).not.toBeNull();
      expect(result?.bookingReference).toBe('BK-2024-000001');
    });

    it('should return null when booking not found', async () => {
      mockDb.query.mockResolvedValue({ rows: [] } as any);

      const result = await service.getBookingById('999');

      expect(result).toBeNull();
    });
  });

  describe('createBooking', () => {
    it('should create booking with calculated values', async () => {
      const newBooking = {
        calendarId: 'cal-1',
        userId: 'user-1',
        bookingDate: new Date('2024-07-01'),
        startTime: '10:00',
        duration: 60,
        placesBooked: 2,
        pricePerPlace: 25.0,
      };

      const mockCreated = {
        id: '1',
        booking_reference: 'BK-2024-000001',
        calendar_id: 'cal-1',
        user_id: 'user-1',
        booking_date: new Date('2024-07-01'),
        start_time: '10:00',
        duration: 60,
        end_time: '11:00',
        places_booked: 2,
        price_per_place: 25.0,
        total_price: 50.0,
        booking_status: 'confirmed',
        payment_status: 'paid',
        payment_method: null,
        form_submission_id: null,
        cancelled_at: null,
        cancelled_by: null,
        cancellation_reason: null,
        refund_processed: false,
        refunded_at: null,
        admin_notes: null,
        booked_at: new Date(),
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockDb.query
        .mockResolvedValueOnce({ rows: [{ count: '0' }] } as any) // generateBookingReference
        .mockResolvedValueOnce({ rows: [mockCreated] } as any); // insert

      const result = await service.createBooking(newBooking);

      expect(result.placesBooked).toBe(2);
      expect(result.totalPrice).toBe(50.0);
      expect(result.endTime).toBe('11:00');
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO bookings'),
        expect.any(Array)
      );
    });

    it('should throw error when places booked is less than 1', async () => {
      const invalidBooking = {
        calendarId: 'cal-1',
        userId: 'user-1',
        bookingDate: new Date('2024-07-01'),
        startTime: '10:00',
        duration: 60,
        placesBooked: 0,
        pricePerPlace: 25.0,
      };

      // Mock the database call for generateBookingReference (won't be reached but needed for test setup)
      mockDb.query.mockResolvedValue({ rows: [{ count: '0' }] } as any);

      await expect(service.createBooking(invalidBooking)).rejects.toThrow(
        'Places booked must be at least 1'
      );
    });

    it('should calculate end time correctly across midnight', async () => {
      const newBooking = {
        calendarId: 'cal-1',
        userId: 'user-1',
        bookingDate: new Date('2024-07-01'),
        startTime: '23:30',
        duration: 90,
        pricePerPlace: 25.0,
      };

      const mockCreated = {
        id: '1',
        booking_reference: 'BK-2024-000001',
        calendar_id: 'cal-1',
        user_id: 'user-1',
        booking_date: new Date('2024-07-01'),
        start_time: '23:30',
        duration: 90,
        end_time: '01:00',
        places_booked: 1,
        price_per_place: 25.0,
        total_price: 25.0,
        booking_status: 'confirmed',
        payment_status: 'paid',
        payment_method: null,
        form_submission_id: null,
        cancelled_at: null,
        cancelled_by: null,
        cancellation_reason: null,
        refund_processed: false,
        refunded_at: null,
        admin_notes: null,
        booked_at: new Date(),
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockDb.query
        .mockResolvedValueOnce({ rows: [{ count: '0' }] } as any)
        .mockResolvedValueOnce({ rows: [mockCreated] } as any);

      const result = await service.createBooking(newBooking);

      expect(result.endTime).toBe('01:00');
    });
  });

  describe('time slot validation', () => {
    it('should correctly calculate end time for various durations', async () => {
      const testCases = [
        { start: '09:00', duration: 30, expected: '09:30' },
        { start: '09:00', duration: 60, expected: '10:00' },
        { start: '09:00', duration: 90, expected: '10:30' },
        { start: '09:00', duration: 120, expected: '11:00' },
        { start: '14:30', duration: 45, expected: '15:15' },
        { start: '23:00', duration: 120, expected: '01:00' },
      ];

      for (const testCase of testCases) {
        const newBooking = {
          calendarId: 'cal-1',
          userId: 'user-1',
          bookingDate: new Date('2024-07-01'),
          startTime: testCase.start,
          duration: testCase.duration,
          pricePerPlace: 25.0,
        };

        const mockCreated = {
          id: '1',
          booking_reference: 'BK-2024-000001',
          calendar_id: 'cal-1',
          user_id: 'user-1',
          booking_date: new Date('2024-07-01'),
          start_time: testCase.start,
          duration: testCase.duration,
          end_time: testCase.expected,
          places_booked: 1,
          price_per_place: 25.0,
          total_price: 25.0,
          booking_status: 'confirmed',
          payment_status: 'paid',
          payment_method: null,
          form_submission_id: null,
          cancelled_at: null,
          cancelled_by: null,
          cancellation_reason: null,
          refund_processed: false,
          refunded_at: null,
          admin_notes: null,
          booked_at: new Date(),
          created_at: new Date(),
          updated_at: new Date(),
        };

        mockDb.query
          .mockResolvedValueOnce({ rows: [{ count: '0' }] } as any)
          .mockResolvedValueOnce({ rows: [mockCreated] } as any);

        const result = await service.createBooking(newBooking);

        expect(result.endTime).toBe(testCase.expected);
      }
    });
  });
});
