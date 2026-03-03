import { db } from '../database/pool';
import { logger } from '../config/logger';

/**
 * Event Activity interface
 */
export interface EventActivity {
  name: string;
  description: string;
  showPublicly: boolean;
  applicationFormId?: string;
  limitApplicants: boolean;
  applicantsLimit?: number;
  allowSpecifyQuantity: boolean;
  useTermsAndConditions: boolean;
  termsAndConditions?: string;
  fee: number;
  allowedPaymentMethod: 'card' | 'cheque' | 'both';
  handlingFeeIncluded: boolean;
  chequePaymentInstructions?: string;
}

/**
 * Event interface matching database schema
 */
export interface Event {
  id: string;
  organisationId: string;
  name: string;
  description: string;
  eventOwner: string;
  emailNotifications?: string;
  startDate: Date;
  endDate: Date;
  openDateEntries?: Date;
  entriesClosingDate?: Date;
  limitEntries: boolean;
  entriesLimit?: number;
  addConfirmationMessage: boolean;
  confirmationMessage?: string;
  status: 'draft' | 'published' | 'cancelled' | 'completed';
  eventTypeId?: string;
  venueId?: string;
  discountIds?: string[];
  activities?: EventActivity[];
  // Ticketing configuration
  generateElectronicTickets?: boolean;
  ticketHeaderText?: string;
  ticketInstructions?: string;
  ticketFooterText?: string;
  ticketValidityPeriod?: number;
  includeEventLogo?: boolean;
  ticketBackgroundColor?: string;
  // Soft delete fields
  deleted?: boolean;
  deletedAt?: Date;
  deletedBy?: string;
  // Populated fields from joins
  eventType?: {
    id: string;
    name: string;
    description?: string;
  };
  venue?: {
    id: string;
    name: string;
    address?: string;
    latitude?: number;
    longitude?: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

/**
 * DTO for creating an event
 */
export interface CreateEventDto {
  organisationId: string;
  name: string;
  description: string;
  eventOwner: string;
  emailNotifications?: string;
  startDate: Date;
  endDate: Date;
  openDateEntries?: Date;
  entriesClosingDate?: Date;
  limitEntries?: boolean;
  entriesLimit?: number;
  addConfirmationMessage?: boolean;
  confirmationMessage?: string;
  status?: 'draft' | 'published';
  eventTypeId?: string;
  venueId?: string;
  discountIds?: string[];
  activities?: EventActivity[];
  // Ticketing configuration
  generateElectronicTickets?: boolean;
  ticketHeaderText?: string;
  ticketInstructions?: string;
  ticketFooterText?: string;
  ticketValidityPeriod?: number;
  includeEventLogo?: boolean;
  ticketBackgroundColor?: string;
}

/**
 * DTO for updating an event
 */
export interface UpdateEventDto {
  name?: string;
  description?: string;
  eventOwner?: string;
  emailNotifications?: string;
  startDate?: Date;
  endDate?: Date;
  openDateEntries?: Date;
  entriesClosingDate?: Date;
  limitEntries?: boolean;
  entriesLimit?: number;
  addConfirmationMessage?: boolean;
  confirmationMessage?: string;
  status?: 'draft' | 'published' | 'cancelled' | 'completed';
  eventTypeId?: string;
  venueId?: string;
  discountIds?: string[];
  activities?: EventActivity[];
  // Ticketing configuration
  generateElectronicTickets?: boolean;
  ticketHeaderText?: string;
  ticketInstructions?: string;
  ticketFooterText?: string;
  ticketValidityPeriod?: number;
  includeEventLogo?: boolean;
  ticketBackgroundColor?: string;
}

/**
 * Service for managing events
 */
export class EventService {
  /**
   * Convert database row to Event object
   */
  private rowToEvent(row: any): Event {
    // Parse discount_ids from JSONB - it might be a string or already parsed
    let discountIds: string[] = [];
    if (row.discount_ids) {
      if (Array.isArray(row.discount_ids)) {
        discountIds = row.discount_ids;
      } else if (typeof row.discount_ids === 'string') {
        try {
          const parsed = JSON.parse(row.discount_ids);
          discountIds = Array.isArray(parsed) ? parsed : [];
        } catch {
          discountIds = [];
        }
      }
    }

    const event: Event = {
      id: row.id,
      organisationId: row.organisation_id,
      name: row.name,
      description: row.description,
      eventOwner: row.event_owner,
      emailNotifications: row.email_notifications,
      startDate: row.start_date,
      endDate: row.end_date,
      openDateEntries: row.open_date_entries,
      entriesClosingDate: row.entries_closing_date,
      limitEntries: row.limit_entries,
      entriesLimit: row.entries_limit,
      addConfirmationMessage: row.add_confirmation_message,
      confirmationMessage: row.confirmation_message,
      status: row.status,
      eventTypeId: row.event_type_id,
      venueId: row.venue_id,
      discountIds,
      deleted: row.deleted,
      deletedAt: row.deleted_at,
      deletedBy: row.deleted_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };

    // Add event type if joined
    if (row.event_type_name) {
      event.eventType = {
        id: row.event_type_id,
        name: row.event_type_name,
        description: row.event_type_description,
      };
    }

    // Add venue if joined
    if (row.venue_name) {
      event.venue = {
        id: row.venue_id,
        name: row.venue_name,
        address: row.venue_address,
        latitude: row.venue_latitude ? parseFloat(row.venue_latitude) : undefined,
        longitude: row.venue_longitude ? parseFloat(row.venue_longitude) : undefined,
      };
    }

    return event;
  }

  /**
   * Get all events for an organisation
   */
  async getEventsByOrganisation(organisationId: string): Promise<Event[]> {
    try {
      const result = await db.query(
        `SELECT 
           e.*,
           et.name as event_type_name,
           et.description as event_type_description,
           v.name as venue_name,
           v.address as venue_address,
           v.latitude as venue_latitude,
           v.longitude as venue_longitude
         FROM events e
         LEFT JOIN event_types et ON e.event_type_id = et.id
         LEFT JOIN venues v ON e.venue_id = v.id
         WHERE e.organisation_id = $1 AND e.deleted = FALSE
         ORDER BY e.start_date DESC`,
        [organisationId]
      );

      return result.rows.map(row => this.rowToEvent(row));
    } catch (error) {
      logger.error('Error getting events by organisation:', error);
      throw error;
    }
  }

  /**
   * Get event by ID
   */
  async getEventById(id: string): Promise<Event | null> {
    try {
      const result = await db.query(
        `SELECT 
           e.*,
           et.name as event_type_name,
           et.description as event_type_description,
           v.name as venue_name,
           v.address as venue_address,
           v.latitude as venue_latitude,
           v.longitude as venue_longitude
         FROM events e
         LEFT JOIN event_types et ON e.event_type_id = et.id
         LEFT JOIN venues v ON e.venue_id = v.id
         WHERE e.id = $1`,
        [id]
      );

      if (result.rows.length === 0) {
        return null;
      }

      const event = this.rowToEvent(result.rows[0]);
      
      // Load activities for this event
      const { eventActivityService } = await import('./event-activity.service');
      const activities = await eventActivityService.getActivitiesByEvent(id);
      event.activities = activities;

      return event;
    } catch (error) {
      logger.error('Error getting event by ID:', error);
      throw error;
    }
  }

  /**
   * Create a new event
   */
  async createEvent(data: CreateEventDto): Promise<Event> {
    try {
      // Validate dates
      if (new Date(data.endDate) < new Date(data.startDate)) {
        throw new Error('End date must be after start date');
      }

      // Validate entries limit
      if (data.limitEntries && (!data.entriesLimit || data.entriesLimit <= 0)) {
        throw new Error('Entries limit must be greater than 0 when limit is enabled');
      }

      // Validate confirmation message
      if (data.addConfirmationMessage && !data.confirmationMessage) {
        throw new Error('Confirmation message is required when add confirmation message is enabled');
      }

      const result = await db.query(
        `INSERT INTO events 
         (organisation_id, name, description, event_owner, email_notifications,
          start_date, end_date, open_date_entries, entries_closing_date,
          limit_entries, entries_limit, add_confirmation_message, confirmation_message, 
          status, event_type_id, venue_id, discount_ids)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
         RETURNING *`,
        [
          data.organisationId,
          data.name,
          data.description,
          data.eventOwner,
          data.emailNotifications || null,
          data.startDate,
          data.endDate,
          data.openDateEntries || null,
          data.entriesClosingDate || null,
          data.limitEntries || false,
          data.entriesLimit || null,
          data.addConfirmationMessage || false,
          data.confirmationMessage || null,
          data.status || 'draft',
          data.eventTypeId || null,
          data.venueId || null,
          JSON.stringify(data.discountIds || []),
        ]
      );

      const event = this.rowToEvent(result.rows[0]);

      // Create activities if provided
      if (data.activities && data.activities.length > 0) {
        const { eventActivityService } = await import('./event-activity.service');
        const activities = await eventActivityService.replaceActivitiesForEvent(
          event.id,
          data.activities.map(a => ({ ...a, eventId: event.id }))
        );
        event.activities = activities;
      }

      logger.info(`Event created: ${data.name} (${event.id})`);
      return event;
    } catch (error) {
      logger.error('Error creating event:', error);
      throw error;
    }
  }

  /**
   * Update an event
   */
  async updateEvent(id: string, data: UpdateEventDto): Promise<Event> {
    try {
      // Get existing event
      const existing = await this.getEventById(id);
      if (!existing) {
        throw new Error('Event not found');
      }

      // Validate dates if provided
      const startDate = data.startDate || existing.startDate;
      const endDate = data.endDate || existing.endDate;
      if (new Date(endDate) < new Date(startDate)) {
        throw new Error('End date must be after start date');
      }

      // Validate entries limit
      const limitEntries = data.limitEntries !== undefined ? data.limitEntries : existing.limitEntries;
      const entriesLimit = data.entriesLimit !== undefined ? data.entriesLimit : existing.entriesLimit;
      if (limitEntries && (!entriesLimit || entriesLimit <= 0)) {
        throw new Error('Entries limit must be greater than 0 when limit is enabled');
      }

      // Validate confirmation message
      const addConfirmationMessage = data.addConfirmationMessage !== undefined 
        ? data.addConfirmationMessage 
        : existing.addConfirmationMessage;
      const confirmationMessage = data.confirmationMessage !== undefined 
        ? data.confirmationMessage 
        : existing.confirmationMessage;
      if (addConfirmationMessage && !confirmationMessage) {
        throw new Error('Confirmation message is required when add confirmation message is enabled');
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
      if (data.eventOwner !== undefined) {
        updates.push(`event_owner = $${paramCount++}`);
        values.push(data.eventOwner);
      }
      if (data.emailNotifications !== undefined) {
        updates.push(`email_notifications = $${paramCount++}`);
        values.push(data.emailNotifications || null);
      }
      if (data.startDate !== undefined) {
        updates.push(`start_date = $${paramCount++}`);
        values.push(data.startDate);
      }
      if (data.endDate !== undefined) {
        updates.push(`end_date = $${paramCount++}`);
        values.push(data.endDate);
      }
      if (data.openDateEntries !== undefined) {
        updates.push(`open_date_entries = $${paramCount++}`);
        values.push(data.openDateEntries || null);
      }
      if (data.entriesClosingDate !== undefined) {
        updates.push(`entries_closing_date = $${paramCount++}`);
        values.push(data.entriesClosingDate || null);
      }
      if (data.limitEntries !== undefined) {
        updates.push(`limit_entries = $${paramCount++}`);
        values.push(data.limitEntries);
      }
      if (data.entriesLimit !== undefined) {
        updates.push(`entries_limit = $${paramCount++}`);
        values.push(data.entriesLimit || null);
      }
      if (data.addConfirmationMessage !== undefined) {
        updates.push(`add_confirmation_message = $${paramCount++}`);
        values.push(data.addConfirmationMessage);
      }
      if (data.confirmationMessage !== undefined) {
        updates.push(`confirmation_message = $${paramCount++}`);
        values.push(data.confirmationMessage || null);
      }
      if (data.status !== undefined) {
        updates.push(`status = $${paramCount++}`);
        values.push(data.status);
      }
      if (data.eventTypeId !== undefined) {
        updates.push(`event_type_id = $${paramCount++}`);
        values.push(data.eventTypeId || null);
      }
      if (data.venueId !== undefined) {
        updates.push(`venue_id = $${paramCount++}`);
        values.push(data.venueId || null);
      }
      if (data.discountIds !== undefined) {
        updates.push(`discount_ids = $${paramCount++}`);
        values.push(JSON.stringify(data.discountIds || []));
      }

      values.push(id);

      const result = await db.query(
        `UPDATE events 
         SET ${updates.join(', ')}
         WHERE id = $${paramCount}
         RETURNING *`,
        values
      );

      if (result.rows.length === 0) {
        throw new Error('Event not found');
      }

      const event = this.rowToEvent(result.rows[0]);

      // Update activities if provided
      if (data.activities !== undefined) {
        const { eventActivityService } = await import('./event-activity.service');
        const activities = await eventActivityService.replaceActivitiesForEvent(
          id,
          data.activities.map(a => ({ ...a, eventId: id }))
        );
        event.activities = activities;
      } else {
        // Load existing activities
        const { eventActivityService } = await import('./event-activity.service');
        event.activities = await eventActivityService.getActivitiesByEvent(id);
      }

      logger.info(`Event updated: ${id}`);
      return event;
    } catch (error) {
      logger.error('Error updating event:', error);
      throw error;
    }
  }

  /**
   * Soft delete an event
   */
  async deleteEvent(id: string, deletedBy: string): Promise<void> {
    try {
      const result = await db.query(
        'UPDATE events SET deleted = TRUE, deleted_at = NOW(), deleted_by = $2 WHERE id = $1 AND deleted = FALSE',
        [id, deletedBy]
      );

      if (result.rowCount === 0) {
        throw new Error('Event not found or already deleted');
      }

      logger.info(`Event soft deleted: ${id} by ${deletedBy}`);
    } catch (error) {
      logger.error('Error deleting event:', error);
      throw error;
    }
  }

  /**
   * Clone an event with all its activities
   * Creates a new event with "(Copy)" appended to the name
   * All activities are cloned as well
   * The cloned event has no entries (it's a new event)
   */
  async cloneEvent(id: string): Promise<Event> {
    try {
      // Get the original event with activities
      const originalEvent = await this.getEventById(id);
      if (!originalEvent) {
        throw new Error('Event not found');
      }

      // Create new event data with "(Copy)" appended to name
      const cloneData: CreateEventDto = {
        organisationId: originalEvent.organisationId,
        name: `${originalEvent.name} (Copy)`,
        description: originalEvent.description,
        eventOwner: originalEvent.eventOwner,
        emailNotifications: originalEvent.emailNotifications,
        startDate: originalEvent.startDate,
        endDate: originalEvent.endDate,
        openDateEntries: originalEvent.openDateEntries,
        entriesClosingDate: originalEvent.entriesClosingDate,
        limitEntries: originalEvent.limitEntries,
        entriesLimit: originalEvent.entriesLimit,
        addConfirmationMessage: originalEvent.addConfirmationMessage,
        confirmationMessage: originalEvent.confirmationMessage,
        status: 'draft', // Always create clones as draft
        eventTypeId: originalEvent.eventTypeId,
        venueId: originalEvent.venueId,
        discountIds: originalEvent.discountIds || [], // Clone discount IDs
        // Clone activities (without IDs)
        activities: originalEvent.activities?.map(activity => ({
          eventId: '', // Will be set by createEvent
          name: activity.name,
          description: activity.description,
          showPublicly: activity.showPublicly,
          applicationFormId: activity.applicationFormId,
          limitApplicants: activity.limitApplicants,
          applicantsLimit: activity.applicantsLimit,
          allowSpecifyQuantity: activity.allowSpecifyQuantity,
          useTermsAndConditions: activity.useTermsAndConditions,
          termsAndConditions: activity.termsAndConditions,
          fee: activity.fee,
          allowedPaymentMethod: activity.allowedPaymentMethod,
          handlingFeeIncluded: activity.handlingFeeIncluded,
          chequePaymentInstructions: activity.chequePaymentInstructions,
        })) || [],
      };

      // Create the cloned event
      const clonedEvent = await this.createEvent(cloneData);

      logger.info(`Event cloned: ${originalEvent.name} -> ${clonedEvent.name} (${clonedEvent.id})`);
      return clonedEvent;
    } catch (error) {
      logger.error('Error cloning event:', error);
      throw error;
    }
  }

}

// Create singleton instance
export const eventService = new EventService();
