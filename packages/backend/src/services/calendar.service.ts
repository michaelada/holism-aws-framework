import { db } from '../database/pool';
import { logger } from '../config/logger';

/**
 * Calendar status types
 */
export type CalendarStatus = 'open' | 'closed';

/**
 * Booking status types
 */
export type BookingStatus = 'confirmed' | 'cancelled' | 'pending_payment';
/**
 * Slot reservation interface matching database schema
 */
export interface SlotReservation {
  id: string;
  calendarId: string;
  reservedBy: string;
  slotDate: string;
  startTime: string;
  duration: number;
  reason?: string;
  createdAt: Date;
  updatedAt: Date;
}
export type PaymentStatus = 'pending' | 'paid' | 'refunded';

/**
 * Calendar interface matching database schema
 */
export interface Calendar {
  id: string;
  organisationId: string;
  name: string;
  description: string;
  displayColour: string;
  status: CalendarStatus;
  enableAutomatedSchedule: boolean;
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
  handlingFeeIncluded: boolean;
  discountIds: string[];
  applicationFormId?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Booking interface matching database schema
 */
export interface Booking {
  id: string;
  bookingReference: string;
  calendarId: string;
  userId: string;
  bookingDate: Date;
  startTime: string;
  duration: number;
  endTime: string;
  placesBooked: number;
  pricePerPlace: number;
  totalPrice: number;
  bookingStatus: BookingStatus;
  paymentStatus: PaymentStatus;
  paymentMethod?: string;
  formSubmissionId?: string;
  cancelledAt?: Date;
  cancelledBy?: string;
  cancellationReason?: string;
  refundProcessed: boolean;
  refundedAt?: Date;
  adminNotes?: string;
  bookedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * DTO for creating a calendar
 */
export interface CreateCalendarDto {
  organisationId: string;
  name: string;
  description: string;
  displayColour: string;
  status?: CalendarStatus;
  enableAutomatedSchedule?: boolean;
  minDaysInAdvance?: number;
  maxDaysInAdvance?: number;
  useTermsAndConditions?: boolean;
  termsAndConditions?: string;
  supportedPaymentMethods: string[];
  allowCancellations?: boolean;
  cancelDaysInAdvance?: number;
  refundPaymentAutomatically?: boolean;
  adminNotificationEmails?: string;
  sendReminderEmails?: boolean;
  reminderHoursBefore?: number;
  handlingFeeIncluded?: boolean;
  discountIds?: string[];
  applicationFormId?: string;
  scheduleRules?: any[];
  timeSlotConfigurations?: any[];
  blockedPeriods?: any[];
}

/**
 * DTO for updating a calendar
 */
export interface UpdateCalendarDto {
  name?: string;
  description?: string;
  displayColour?: string;
  status?: CalendarStatus;
  enableAutomatedSchedule?: boolean;
  minDaysInAdvance?: number;
  maxDaysInAdvance?: number;
  useTermsAndConditions?: boolean;
  termsAndConditions?: string;
  supportedPaymentMethods?: string[];
  allowCancellations?: boolean;
  cancelDaysInAdvance?: number;
  refundPaymentAutomatically?: boolean;
  adminNotificationEmails?: string;
  sendReminderEmails?: boolean;
  reminderHoursBefore?: number;
  handlingFeeIncluded?: boolean;
  discountIds?: string[];
  applicationFormId?: string;
  scheduleRules?: any[];
  timeSlotConfigurations?: any[];
  blockedPeriods?: any[];
}

/**
 * DTO for creating a booking
 */
export interface CreateBookingDto {
  calendarId: string;
  userId: string;
  bookingDate: Date;
  startTime: string;
  duration: number;
  placesBooked?: number;
  pricePerPlace: number;
  formSubmissionId?: string;
  paymentMethod?: string;
}

/**
 * Service for managing calendars and bookings
 */
export class CalendarService {
  /**
   * Convert database row to Calendar object
   */
  private rowToCalendar(row: any): Calendar {
    return {
      id: row.id,
      organisationId: row.organisation_id,
      name: row.name,
      description: row.description,
      displayColour: row.display_colour,
      status: row.status,
      enableAutomatedSchedule: row.enable_automated_schedule,
      minDaysInAdvance: row.min_days_in_advance,
      maxDaysInAdvance: row.max_days_in_advance,
      useTermsAndConditions: row.use_terms_and_conditions,
      termsAndConditions: row.terms_and_conditions,
      supportedPaymentMethods: row.supported_payment_methods || [],
      allowCancellations: row.allow_cancellations,
      cancelDaysInAdvance: row.cancel_days_in_advance,
      refundPaymentAutomatically: row.refund_payment_automatically,
      adminNotificationEmails: row.admin_notification_emails,
      sendReminderEmails: row.send_reminder_emails,
      reminderHoursBefore: row.reminder_hours_before,
      handlingFeeIncluded: row.handling_fee_included || false,
      discountIds: row.discount_ids || [],
      applicationFormId: row.application_form_id || undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * Convert database row to Booking object
   */
  private rowToBooking(row: any): Booking {
    return {
      id: row.id,
      bookingReference: row.booking_reference,
      calendarId: row.calendar_id,
      userId: row.user_id,
      bookingDate: row.booking_date,
      startTime: row.start_time,
      duration: row.duration,
      endTime: row.end_time,
      placesBooked: row.places_booked,
      pricePerPlace: row.price_per_place,
      totalPrice: row.total_price,
      bookingStatus: row.booking_status,
      paymentStatus: row.payment_status,
      paymentMethod: row.payment_method,
      formSubmissionId: row.form_submission_id,
      cancelledAt: row.cancelled_at,
      cancelledBy: row.cancelled_by,
      cancellationReason: row.cancellation_reason,
      refundProcessed: row.refund_processed,
      refundedAt: row.refunded_at,
      adminNotes: row.admin_notes,
      bookedAt: row.booked_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
  /**
   * Convert database row to SlotReservation object
   */
  private rowToReservation(row: any): SlotReservation {
    return {
      id: row.id,
      calendarId: row.calendar_id,
      reservedBy: row.reserved_by,
      slotDate: row.slot_date,
      startTime: row.start_time,
      duration: row.duration,
      reason: row.reason || undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * Generate unique booking reference
   */
  private async generateBookingReference(): Promise<string> {
    const year = new Date().getFullYear();
    const result = await db.query(
      `SELECT COUNT(*) as count FROM bookings WHERE booking_reference LIKE $1`,
      [`BK-${year}-%`]
    );
    const count = parseInt(result.rows[0].count) + 1;
    return `BK-${year}-${count.toString().padStart(6, '0')}`;
  }

  /**
   * Calculate end time from start time and duration
   */
  private calculateEndTime(startTime: string, duration: number): string {
    const [hours, minutes] = startTime.split(':').map(Number);
    const totalMinutes = hours * 60 + minutes + duration;
    const endHours = Math.floor(totalMinutes / 60) % 24;
    const endMinutes = totalMinutes % 60;
    return `${endHours.toString().padStart(2, '0')}:${endMinutes.toString().padStart(2, '0')}`;
  }

  /**
   * Save schedule rules for a calendar (delete + re-insert)
   */
  private async saveScheduleRules(calendarId: string, rules: any[]): Promise<void> {
    await db.query('DELETE FROM schedule_rules WHERE calendar_id = $1', [calendarId]);
    for (let i = 0; i < rules.length; i++) {
      const rule = rules[i];
      await db.query(
        `INSERT INTO schedule_rules (calendar_id, start_date, end_date, action, time_of_day, reason, "order")
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [calendarId, rule.startDate, rule.endDate || null, rule.action, rule.timeOfDay || null, rule.reason || null, i]
      );
    }
  }

  /**
   * Save time slot configurations for a calendar (delete + re-insert)
   */
  private async saveTimeSlotConfigurations(calendarId: string, configs: any[]): Promise<void> {
    // CASCADE delete removes duration_options too
    await db.query('DELETE FROM time_slot_configurations WHERE calendar_id = $1', [calendarId]);
    for (let i = 0; i < configs.length; i++) {
      const config = configs[i];
      const result = await db.query(
        `INSERT INTO time_slot_configurations
         (calendar_id, days_of_week, start_time, effective_date_start, effective_date_end,
          recurrence_weeks, places_available, min_places_required, "order")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING id`,
        [
          calendarId,
          JSON.stringify(config.daysOfWeek || []),
          config.startTime,
          config.effectiveDateStart,
          config.effectiveDateEnd || null,
          config.recurrenceWeeks || 1,
          config.placesAvailable || 1,
          config.minPlacesRequired || null,
          i,
        ]
      );
      const configId = result.rows[0].id;
      const durationOptions = config.durationOptions || [];
      for (let j = 0; j < durationOptions.length; j++) {
        const opt = durationOptions[j];
        await db.query(
          `INSERT INTO duration_options (time_slot_configuration_id, duration, price, label, "order")
           VALUES ($1, $2, $3, $4, $5)`,
          [configId, opt.duration, opt.price, opt.label || '', j]
        );
      }
    }
  }

  /**
   * Save blocked periods for a calendar (delete + re-insert)
   */
  private async saveBlockedPeriods(calendarId: string, periods: any[]): Promise<void> {
    await db.query('DELETE FROM blocked_periods WHERE calendar_id = $1', [calendarId]);
    for (const period of periods) {
      await db.query(
        `INSERT INTO blocked_periods (calendar_id, block_type, start_date, end_date, days_of_week, start_time, end_time, reason)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          calendarId,
          period.blockType,
          period.startDate || null,
          period.endDate || null,
          period.daysOfWeek ? JSON.stringify(period.daysOfWeek) : null,
          period.startTime || null,
          period.endTime || null,
          period.reason || null,
        ]
      );
    }
  }

  /**
   * Load child entities for a calendar and attach to the result object
   */
  private async loadCalendarChildren(calendar: any): Promise<any> {
    const [rulesResult, configsResult, periodsResult] = await Promise.all([
      db.query('SELECT * FROM schedule_rules WHERE calendar_id = $1 ORDER BY "order"', [calendar.id]),
      db.query('SELECT * FROM time_slot_configurations WHERE calendar_id = $1 ORDER BY "order"', [calendar.id]),
      db.query('SELECT * FROM blocked_periods WHERE calendar_id = $1', [calendar.id]),
    ]);

    const scheduleRules = rulesResult.rows.map(r => ({
      startDate: r.start_date,
      endDate: r.end_date || undefined,
      action: r.action,
      timeOfDay: r.time_of_day || undefined,
      reason: r.reason || undefined,
    }));

    const timeSlotConfigurations = [];
    for (const row of configsResult.rows) {
      const durationResult = await db.query(
        'SELECT * FROM duration_options WHERE time_slot_configuration_id = $1 ORDER BY "order"',
        [row.id]
      );
      timeSlotConfigurations.push({
        daysOfWeek: row.days_of_week || [],
        startTime: row.start_time,
        effectiveDateStart: row.effective_date_start,
        effectiveDateEnd: row.effective_date_end || undefined,
        recurrenceWeeks: row.recurrence_weeks,
        placesAvailable: row.places_available,
        minPlacesRequired: row.min_places_required || undefined,
        durationOptions: durationResult.rows.map(d => ({
          duration: d.duration,
          price: parseFloat(d.price),
          label: d.label,
        })),
      });
    }

    const blockedPeriods = periodsResult.rows.map(r => ({
      blockType: r.block_type,
      startDate: r.start_date || undefined,
      endDate: r.end_date || undefined,
      daysOfWeek: r.days_of_week || undefined,
      startTime: r.start_time || undefined,
      endTime: r.end_time || undefined,
      reason: r.reason || undefined,
    }));

    return {
      ...calendar,
      scheduleRules,
      timeSlotConfigurations,
      blockedPeriods,
    };
  }

  /**
   * Get all calendars for an organisation
   */
  async getCalendarsByOrganisation(organisationId: string): Promise<Calendar[]> {
    try {
      const result = await db.query(
        `SELECT * FROM calendars 
         WHERE organisation_id = $1 
         ORDER BY name ASC`,
        [organisationId]
      );

      return result.rows.map(row => this.rowToCalendar(row));
    } catch (error) {
      logger.error('Error getting calendars by organisation:', error);
      throw error;
    }
  }

  /**
   * Get calendar by ID
   */
  async getCalendarById(id: string): Promise<Calendar | null> {
    try {
      const result = await db.query(
        'SELECT * FROM calendars WHERE id = $1',
        [id]
      );

      if (result.rows.length === 0) {
        return null;
      }

      const calendar = this.rowToCalendar(result.rows[0]);
      return this.loadCalendarChildren(calendar);
    } catch (error) {
      logger.error('Error getting calendar by ID:', error);
      throw error;
    }
  }

  /**
   * Create a new calendar
   */
  async createCalendar(data: CreateCalendarDto): Promise<Calendar> {
    try {
      // Validate cancellation policy
      if (data.allowCancellations && !data.cancelDaysInAdvance) {
        throw new Error('Cancel days in advance is required when cancellations are allowed');
      }

      // Validate terms and conditions
      if (data.useTermsAndConditions && !data.termsAndConditions) {
        throw new Error('Terms and conditions text is required when use terms and conditions is enabled');
      }

      // Validate reminder emails
      if (data.sendReminderEmails && !data.reminderHoursBefore) {
        throw new Error('Reminder hours before is required when reminder emails are enabled');
      }

      // Validate booking window
      const minDays = typeof data.minDaysInAdvance === 'number' && !isNaN(data.minDaysInAdvance) ? data.minDaysInAdvance : undefined;
      const maxDays = typeof data.maxDaysInAdvance === 'number' && !isNaN(data.maxDaysInAdvance) ? data.maxDaysInAdvance : undefined;
      if (minDays !== undefined && minDays < 0) {
        throw new Error('Minimum days in advance cannot be negative');
      }
      if (maxDays !== undefined && maxDays < 0) {
        throw new Error('Maximum days in advance cannot be negative');
      }
      if (
        minDays !== undefined &&
        maxDays !== undefined &&
        minDays > maxDays
      ) {
        throw new Error('Minimum days in advance cannot be greater than maximum days in advance');
      }

      const result = await db.query(
        `INSERT INTO calendars 
         (organisation_id, name, description, display_colour, status,
          enable_automated_schedule, min_days_in_advance, max_days_in_advance,
          use_terms_and_conditions, terms_and_conditions, supported_payment_methods,
          allow_cancellations, cancel_days_in_advance, refund_payment_automatically,
          admin_notification_emails, send_reminder_emails, reminder_hours_before,
          handling_fee_included, application_form_id, discount_ids)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
         RETURNING *`,
        [
          data.organisationId,
          data.name,
          data.description,
          data.displayColour,
          data.status || 'open',
          data.enableAutomatedSchedule || false,
          data.minDaysInAdvance || 0,
          data.maxDaysInAdvance || 90,
          data.useTermsAndConditions || false,
          data.termsAndConditions || null,
          JSON.stringify(data.supportedPaymentMethods),
          data.allowCancellations || false,
          data.cancelDaysInAdvance || null,
          data.refundPaymentAutomatically || false,
          data.adminNotificationEmails || null,
          data.sendReminderEmails || false,
          data.reminderHoursBefore || null,
          data.handlingFeeIncluded ?? false,
          data.applicationFormId || null,
          JSON.stringify(data.discountIds || []),
        ]
      );

      logger.info(`Calendar created: ${data.name} (${result.rows[0].id})`);
      const calendarId = result.rows[0].id;

      // Save child entities
      if (data.scheduleRules?.length) {
        await this.saveScheduleRules(calendarId, data.scheduleRules);
      }
      if (data.timeSlotConfigurations?.length) {
        await this.saveTimeSlotConfigurations(calendarId, data.timeSlotConfigurations);
      }
      if (data.blockedPeriods?.length) {
        await this.saveBlockedPeriods(calendarId, data.blockedPeriods);
      }

      return this.rowToCalendar(result.rows[0]);
    } catch (error) {
      logger.error('Error creating calendar:', error);
      throw error;
    }
  }

  /**
   * Update a calendar
   */
  async updateCalendar(id: string, data: UpdateCalendarDto): Promise<Calendar> {
    try {
      // Get existing calendar
      const existing = await this.getCalendarById(id);
      if (!existing) {
        throw new Error('Calendar not found');
      }

      // Validate cancellation policy
      const allowCancellations = data.allowCancellations !== undefined 
        ? data.allowCancellations 
        : existing.allowCancellations;
      const cancelDaysInAdvance = data.cancelDaysInAdvance !== undefined 
        ? data.cancelDaysInAdvance 
        : existing.cancelDaysInAdvance;
      if (allowCancellations && !cancelDaysInAdvance) {
        throw new Error('Cancel days in advance is required when cancellations are allowed');
      }

      // Validate terms and conditions
      const useTerms = data.useTermsAndConditions !== undefined 
        ? data.useTermsAndConditions 
        : existing.useTermsAndConditions;
      const termsText = data.termsAndConditions !== undefined 
        ? data.termsAndConditions 
        : existing.termsAndConditions;
      if (useTerms && !termsText) {
        throw new Error('Terms and conditions text is required when use terms and conditions is enabled');
      }

      // Validate reminder emails
      const sendReminders = data.sendReminderEmails !== undefined 
        ? data.sendReminderEmails 
        : existing.sendReminderEmails;
      const reminderHours = data.reminderHoursBefore !== undefined 
        ? data.reminderHoursBefore 
        : existing.reminderHoursBefore;
      if (sendReminders && !reminderHours) {
        throw new Error('Reminder hours before is required when reminder emails are enabled');
      }

      // Validate booking window
      const minDays = data.minDaysInAdvance !== undefined 
        ? data.minDaysInAdvance 
        : existing.minDaysInAdvance;
      const maxDays = data.maxDaysInAdvance !== undefined 
        ? data.maxDaysInAdvance 
        : existing.maxDaysInAdvance;
      
      if (minDays !== undefined && minDays < 0) {
        throw new Error('Minimum days in advance cannot be negative');
      }
      if (maxDays !== undefined && maxDays < 0) {
        throw new Error('Maximum days in advance cannot be negative');
      }
      if (minDays !== undefined && maxDays !== undefined && minDays > maxDays) {
        throw new Error('Minimum days in advance cannot be greater than maximum days in advance');
      }

      const updates: string[] = ['updated_at = NOW()'];
      const values: any[] = [];
      let paramCount = 1;

      if (data.name !== undefined) {
        updates.push(`name = $${paramCount++}`);
        values.push(data.name);
      }
      if (data.description !== undefined) {
        updates.push(`description = $${paramCount++}`);
        values.push(data.description);
      }
      if (data.displayColour !== undefined) {
        updates.push(`display_colour = $${paramCount++}`);
        values.push(data.displayColour);
      }
      if (data.status !== undefined) {
        updates.push(`status = $${paramCount++}`);
        values.push(data.status);
      }
      if (data.enableAutomatedSchedule !== undefined) {
        updates.push(`enable_automated_schedule = $${paramCount++}`);
        values.push(data.enableAutomatedSchedule);
      }
      if (data.minDaysInAdvance !== undefined) {
        updates.push(`min_days_in_advance = $${paramCount++}`);
        values.push(data.minDaysInAdvance);
      }
      if (data.maxDaysInAdvance !== undefined) {
        updates.push(`max_days_in_advance = $${paramCount++}`);
        values.push(data.maxDaysInAdvance);
      }
      if (data.useTermsAndConditions !== undefined) {
        updates.push(`use_terms_and_conditions = $${paramCount++}`);
        values.push(data.useTermsAndConditions);
      }
      if (data.termsAndConditions !== undefined) {
        updates.push(`terms_and_conditions = $${paramCount++}`);
        values.push(data.termsAndConditions || null);
      }
      if (data.supportedPaymentMethods !== undefined) {
        updates.push(`supported_payment_methods = $${paramCount++}`);
        values.push(JSON.stringify(data.supportedPaymentMethods));
      }
      if (data.allowCancellations !== undefined) {
        updates.push(`allow_cancellations = $${paramCount++}`);
        values.push(data.allowCancellations);
      }
      if (data.cancelDaysInAdvance !== undefined) {
        updates.push(`cancel_days_in_advance = $${paramCount++}`);
        values.push(data.cancelDaysInAdvance || null);
      }
      if (data.refundPaymentAutomatically !== undefined) {
        updates.push(`refund_payment_automatically = $${paramCount++}`);
        values.push(data.refundPaymentAutomatically);
      }
      if (data.adminNotificationEmails !== undefined) {
        updates.push(`admin_notification_emails = $${paramCount++}`);
        values.push(data.adminNotificationEmails || null);
      }
      if (data.sendReminderEmails !== undefined) {
        updates.push(`send_reminder_emails = $${paramCount++}`);
        values.push(data.sendReminderEmails);
      }
      if (data.reminderHoursBefore !== undefined) {
        updates.push(`reminder_hours_before = $${paramCount++}`);
        values.push(data.reminderHoursBefore || null);
      }
      if (data.handlingFeeIncluded !== undefined) {
        updates.push(`handling_fee_included = $${paramCount++}`);
        values.push(data.handlingFeeIncluded);
      }
      if (data.applicationFormId !== undefined) {
        updates.push(`application_form_id = $${paramCount++}`);
        values.push(data.applicationFormId || null);
      }
      if (data.discountIds !== undefined) {
        updates.push(`discount_ids = $${paramCount++}`);
        values.push(JSON.stringify(data.discountIds));
      }

      values.push(id);

      const result = await db.query(
        `UPDATE calendars 
         SET ${updates.join(', ')}
         WHERE id = $${paramCount}
         RETURNING *`,
        values
      );

      if (result.rows.length === 0) {
        throw new Error('Calendar not found');
      }

      logger.info(`Calendar updated: ${id}`);

      // Save child entities
      if (data.scheduleRules !== undefined) {
        await this.saveScheduleRules(id, data.scheduleRules || []);
      }
      if (data.timeSlotConfigurations !== undefined) {
        await this.saveTimeSlotConfigurations(id, data.timeSlotConfigurations || []);
      }
      if (data.blockedPeriods !== undefined) {
        await this.saveBlockedPeriods(id, data.blockedPeriods || []);
      }

      return this.rowToCalendar(result.rows[0]);
    } catch (error) {
      logger.error('Error updating calendar:', error);
      throw error;
    }
  }

  /**
   * Delete a calendar
   */
  async deleteCalendar(id: string): Promise<void> {
    try {
      const result = await db.query(
        'DELETE FROM calendars WHERE id = $1',
        [id]
      );

      if (result.rowCount === 0) {
        throw new Error('Calendar not found');
      }

      logger.info(`Calendar deleted: ${id}`);
    } catch (error) {
      logger.error('Error deleting calendar:', error);
      throw error;
    }
  }

  /**
   * Get all bookings for a calendar
   */
  async getBookingsByCalendar(calendarId: string): Promise<Booking[]> {
    try {
      const result = await db.query(
        `SELECT * FROM bookings 
         WHERE calendar_id = $1 
         ORDER BY booking_date DESC, start_time DESC`,
        [calendarId]
      );

      return result.rows.map(row => this.rowToBooking(row));
    } catch (error) {
      logger.error('Error getting bookings by calendar:', error);
      throw error;
    }
  }

  /**
   * Get all bookings for an organisation (across all calendars).
   * Includes calendar name, user name, and user email via JOINs.
   */
  async getBookingsByOrganisation(
    organisationId: string
  ): Promise<(Booking & { calendarName: string; userName: string; userEmail: string })[]> {
    try {
      const result = await db.query(
        `SELECT b.*,
                c.name AS calendar_name,
                COALESCE(ou.first_name || ' ' || ou.last_name, '') AS user_name,
                COALESCE(ou.email, '') AS user_email
         FROM bookings b
         JOIN calendars c ON b.calendar_id = c.id
         LEFT JOIN organization_users ou ON b.user_id = ou.id
         WHERE c.organisation_id = $1
         ORDER BY b.booking_date DESC, b.start_time DESC`,
        [organisationId]
      );

      return result.rows.map(row => ({
        ...this.rowToBooking(row),
        calendarName: row.calendar_name || '',
        userName: row.user_name || '',
        userEmail: row.user_email || '',
      }));
    } catch (error) {
      logger.error('Error getting bookings by organisation:', error);
      throw error;
    }
  }
  /**
   * Get bookings for a calendar within a date range (confirmed only)
   * Includes user name and email via JOIN with organization_users
   */
  async getBookingsByCalendarAndDateRange(
    calendarId: string,
    start: string,
    end: string
  ): Promise<(Booking & { userName: string; userEmail: string })[]> {
    try {
      const result = await db.query(
        `SELECT b.*,
                COALESCE(ou.first_name || ' ' || ou.last_name, '') AS user_name,
                COALESCE(ou.email, '') AS user_email
         FROM bookings b
         LEFT JOIN organization_users ou ON b.user_id = ou.id
         WHERE b.calendar_id = $1
           AND b.booking_date BETWEEN $2 AND $3
           AND b.booking_status = 'confirmed'
         ORDER BY b.booking_date ASC, b.start_time ASC`,
        [calendarId, start, end]
      );

      return result.rows.map(row => ({
        ...this.rowToBooking(row),
        userName: row.user_name || '',
        userEmail: row.user_email || '',
      }));
    } catch (error) {
      logger.error('Error getting bookings by calendar and date range:', error);
      throw error;
    }
  }


  /**
   * Get booking by ID
   */
  async getBookingById(id: string): Promise<(Booking & { calendarName: string; userName: string; userEmail: string }) | null> {
    try {
      const result = await db.query(
        `SELECT b.*,
                c.name AS calendar_name,
                COALESCE(ou.first_name || ' ' || ou.last_name, '') AS user_name,
                COALESCE(ou.email, '') AS user_email
         FROM bookings b
         JOIN calendars c ON b.calendar_id = c.id
         LEFT JOIN organization_users ou ON b.user_id = ou.id
         WHERE b.id = $1`,
        [id]
      );

      if (result.rows.length === 0) {
        return null;
      }

      return {
        ...this.rowToBooking(result.rows[0]),
        calendarName: result.rows[0].calendar_name || '',
        userName: result.rows[0].user_name || '',
        userEmail: result.rows[0].user_email || '',
      };
    } catch (error) {
      logger.error('Error getting booking by ID:', error);
      throw error;
    }
  }

  /**
   * Create a new booking
   */
  async createBooking(data: CreateBookingDto): Promise<Booking> {
    try {
      // Validate places booked
      const placesBooked = data.placesBooked !== undefined ? data.placesBooked : 1;
      if (placesBooked < 1) {
        throw new Error('Places booked must be at least 1');
      }

      // Calculate end time and total price
      const endTime = this.calculateEndTime(data.startTime, data.duration);
      const totalPrice = data.pricePerPlace * placesBooked;

      // Generate booking reference
      const bookingReference = await this.generateBookingReference();

      const result = await db.query(
        `INSERT INTO bookings 
         (booking_reference, calendar_id, user_id, booking_date, start_time, duration, end_time,
          places_booked, price_per_place, total_price, booking_status, payment_status,
          payment_method, form_submission_id, refund_processed, booked_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW())
         RETURNING *`,
        [
          bookingReference,
          data.calendarId,
          data.userId,
          data.bookingDate,
          data.startTime,
          data.duration,
          endTime,
          placesBooked,
          data.pricePerPlace,
          totalPrice,
          'confirmed',
          data.paymentMethod ? 'pending' : 'paid',
          data.paymentMethod || null,
          data.formSubmissionId || null,
          false,
        ]
      );

      logger.info(`Booking created: ${bookingReference} (${result.rows[0].id})`);
      return this.rowToBooking(result.rows[0]);
    } catch (error) {
      logger.error('Error creating booking:', error);
      throw error;
    }
  }
  /**
   * Get reservations for a calendar within a date range
   */
  async getReservationsByCalendarAndDateRange(calendarId: string, start: string, end: string): Promise<SlotReservation[]> {
    try {
      const result = await db.query(
        `SELECT * FROM slot_reservations
         WHERE calendar_id = $1 AND slot_date BETWEEN $2 AND $3
         ORDER BY slot_date ASC, start_time ASC`,
        [calendarId, start, end]
      );

      return result.rows.map(row => this.rowToReservation(row));
    } catch (error) {
      logger.error('Error getting reservations by calendar and date range:', error);
      throw error;
    }
  }

  /**
   * Create a slot reservation
   * Returns 409-style error if unique constraint violated (slot already reserved)
   */
  async createReservation(
    calendarId: string,
    reservedBy: string,
    slotDate: string,
    startTime: string,
    duration: number,
    reason?: string
  ): Promise<SlotReservation> {
    try {
      const result = await db.query(
        `INSERT INTO slot_reservations (calendar_id, reserved_by, slot_date, start_time, duration, reason)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [calendarId, reservedBy, slotDate, startTime, duration, reason || null]
      );

      logger.info(`Slot reservation created for calendar ${calendarId} on ${slotDate} at ${startTime}`);
      return this.rowToReservation(result.rows[0]);
    } catch (error: any) {
      if (error.code === '23505') {
        const conflictError: any = new Error('Slot is already reserved');
        conflictError.statusCode = 409;
        throw conflictError;
      }
      logger.error('Error creating reservation:', error);
      throw error;
    }
  }

  /**
   * Delete a slot reservation by ID
   */
  async deleteReservation(id: string): Promise<void> {
    try {
      const result = await db.query(
        'DELETE FROM slot_reservations WHERE id = $1',
        [id]
      );

      if (result.rowCount === 0) {
        throw new Error('Reservation not found');
      }

      logger.info(`Slot reservation deleted: ${id}`);
    } catch (error) {
      logger.error('Error deleting reservation:', error);
      throw error;
    }
  }

  /**
   * Cancel a booking with optional refund processing
   */
  async cancelBookingWithRefund(
    bookingId: string,
    cancelledBy: string,
    reason: string,
    refund: boolean
  ): Promise<Booking> {
    try {
      const result = await db.query(
        `UPDATE bookings
         SET booking_status = 'cancelled',
             cancelled_by = $2,
             cancellation_reason = $3,
             cancelled_at = NOW(),
             refund_processed = $4,
             updated_at = NOW()
         WHERE id = $1
         RETURNING *`,
        [bookingId, cancelledBy, reason, refund]
      );

      if (result.rows.length === 0) {
        throw new Error('Booking not found');
      }

      logger.info(`Booking cancelled: ${bookingId}, refund: ${refund}`);
      return this.rowToBooking(result.rows[0]);
    } catch (error) {
      logger.error('Error cancelling booking with refund:', error);
      throw error;
    }
  }
}

// Create singleton instance
export const calendarService = new CalendarService();
