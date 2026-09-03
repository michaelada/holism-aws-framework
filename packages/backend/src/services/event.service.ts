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
  /*
   * Optional here, and required in `event-activity.service`'s own
   * `EventActivity`: this shape is also what a caller *sends* when creating an
   * event with its activities in one payload, and both have defaults.
   */
  entryEligibility?: 'all' | 'members';
  /** How many people one of this activity's tickets admits. Defaults to 1. */
  ticketsAdmit?: number;
  useTermsAndConditions: boolean;
  termsAndConditions?: string;
  fee: number;
  supportedPaymentMethods: string[];
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
  /** Public listing. See docs/PUBLIC_EVENTS.md §2. */
  showOnOrganisationPage: boolean;
  showOnPlatformPage: boolean;
  entriesLimit?: number;
  /**
   * How many entries the event has, where the query asked for it.
   *
   * `COUNT(*)` of `event_entries`, which is the same count the event-level
   * limit is checked against in `account-catalogue.service` and the same set
   * `GET /events/:id/entries` lists. A number on a list that disagrees with the
   * screen it links to is worse than no number.
   *
   * Undefined rather than 0 where the query did not ask, so "none yet" and "not
   * loaded" stay distinguishable.
   */
  entryCount?: number;
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
  showOnOrganisationPage?: boolean;
  showOnPlatformPage?: boolean;
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
  showOnOrganisationPage?: boolean;
  showOnPlatformPage?: boolean;
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
      showOnOrganisationPage: Boolean(row.show_on_organisation_page),
      showOnPlatformPage: Boolean(row.show_on_platform_page),
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
      // Only the list asks for this; `undefined` elsewhere means "not counted",
      // which is not the same answer as none.
      entryCount: row.entry_count === undefined ? undefined : Number(row.entry_count),
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
           v.longitude as venue_longitude,
           -- A correlated subquery rather than a join and a GROUP BY: e.* is
           -- selected here, so grouping would mean naming every column of it.
           (SELECT COUNT(*) FROM event_entries ee
              WHERE ee.event_id = e.id AND ee.entry_status <> 'removed') AS entry_count
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

      // Load ticketing configuration if it exists
      const { ticketingService } = await import('./ticketing.service');
      const ticketingConfig = await ticketingService.getTicketingConfigByEvent(id);
      if (ticketingConfig) {
        event.generateElectronicTickets = ticketingConfig.generateElectronicTickets;
        event.ticketHeaderText = ticketingConfig.ticketHeaderText;
        event.ticketInstructions = ticketingConfig.ticketInstructions;
        event.ticketFooterText = ticketingConfig.ticketFooterText;
        event.ticketValidityPeriod = ticketingConfig.ticketValidityPeriod;
        event.ticketBackgroundColor = ticketingConfig.ticketBackgroundColor;
      }

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
      /*
       * All four dates are required to create an event.
       *
       * An event runs between two dates and takes entries between two others,
       * and none of them has a sensible default: a null entry window means
       * *unbounded* to `public-event.service`, so an event created without one
       * is permanently open to entries, which nobody sets out to do. The form
       * used to paper over this by filling absent entry dates with the current
       * time, which created events closed to entries instead. See
       * docs/EVENT_ENTRY_DATE_INVENTION_FIX.md.
       *
       * Checked here as well as in the form, because the form is not the only
       * way in. The columns stay nullable so events created before this rule
       * still read correctly.
       */
      const REQUIRED_DATES = [
        ['startDate', data.startDate],
        ['endDate', data.endDate],
        ['openDateEntries', data.openDateEntries],
        ['entriesClosingDate', data.entriesClosingDate],
      ] as const;

      const missing = REQUIRED_DATES.filter(([, value]) => !value).map(([field]) => field);
      if (missing.length > 0) {
        throw new Error(`Missing required date${missing.length > 1 ? 's' : ''}: ${missing.join(', ')}`);
      }

      // Validate dates
      if (new Date(data.endDate) < new Date(data.startDate)) {
        throw new Error('End date must be after start date');
      }

      if (new Date(data.entriesClosingDate!) <= new Date(data.openDateEntries!)) {
        throw new Error('Entries closing date must be after the entries opening date');
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
          status, event_type_id, venue_id, discount_ids,
          show_on_organisation_page, show_on_platform_page)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
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
          data.showOnOrganisationPage ?? false,
          data.showOnPlatformPage ?? false,
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

      /*
       * An update may leave a date alone, but it may not clear one.
       *
       * `undefined` means "not part of this update" — that is how a partial
       * update of one field works, and it must keep working. An explicit null
       * or empty string is a request to remove a required value, which is the
       * state the create rule above exists to prevent; allowing an edit to
       * reach it by the back door would make the rule decorative.
       *
       * An event that predates the rule and already has no entry window is left
       * as it is: unchanged fields are never examined here.
       */
      const cleared = (['startDate', 'endDate', 'openDateEntries', 'entriesClosingDate'] as const)
        .filter((field) => field in data && !data[field])
        .map((field) => String(field));
      if (cleared.length > 0) {
        throw new Error(
          `Cannot clear required date${cleared.length > 1 ? 's' : ''}: ${cleared.join(', ')}`
        );
      }

      // Validate dates if provided
      const startDate = data.startDate || existing.startDate;
      const endDate = data.endDate || existing.endDate;
      if (new Date(endDate) < new Date(startDate)) {
        throw new Error('End date must be after start date');
      }

      const openDateEntries = data.openDateEntries ?? existing.openDateEntries;
      const entriesClosingDate = data.entriesClosingDate ?? existing.entriesClosingDate;
      if (
        openDateEntries &&
        entriesClosingDate &&
        new Date(entriesClosingDate) <= new Date(openDateEntries)
      ) {
        throw new Error('Entries closing date must be after the entries opening date');
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
      if (data.showOnOrganisationPage !== undefined) {
        updates.push(`show_on_organisation_page = $${paramCount++}`);
        values.push(data.showOnOrganisationPage);
      }
      if (data.showOnPlatformPage !== undefined) {
        updates.push(`show_on_platform_page = $${paramCount++}`);
        values.push(data.showOnPlatformPage);
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

      // Persist ticketing configuration if any ticketing field is present
      const hasTicketingFields =
        data.generateElectronicTickets !== undefined ||
        data.ticketHeaderText !== undefined ||
        data.ticketInstructions !== undefined ||
        data.ticketFooterText !== undefined ||
        data.ticketValidityPeriod !== undefined ||
        data.ticketBackgroundColor !== undefined;

      if (hasTicketingFields) {
        const { ticketingService } = await import('./ticketing.service');
        const existingConfig = await ticketingService.getTicketingConfigByEvent(id);

        const ticketingFields: Record<string, any> = {};
        if (data.generateElectronicTickets !== undefined) ticketingFields.generateElectronicTickets = data.generateElectronicTickets;
        if (data.ticketHeaderText !== undefined) ticketingFields.ticketHeaderText = data.ticketHeaderText;
        if (data.ticketInstructions !== undefined) ticketingFields.ticketInstructions = data.ticketInstructions;
        if (data.ticketFooterText !== undefined) ticketingFields.ticketFooterText = data.ticketFooterText;
        if (data.ticketValidityPeriod !== undefined) ticketingFields.ticketValidityPeriod = data.ticketValidityPeriod;
        if (data.ticketBackgroundColor !== undefined) ticketingFields.ticketBackgroundColor = data.ticketBackgroundColor;

        if (!existingConfig) {
          await ticketingService.createTicketedEvent({
            eventId: id,
            generateElectronicTickets: data.generateElectronicTickets ?? false,
            ...ticketingFields,
          });
        } else {
          await ticketingService.updateTicketedEvent(id, ticketingFields);
        }
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
          /*
           * Both of these were being dropped by the clone, and both fail
           * quietly: a members-only activity reopened to everybody, and a
           * family ticket copied as one that admits a single person.
           */
          entryEligibility: activity.entryEligibility,
          ticketsAdmit: activity.ticketsAdmit,
          useTermsAndConditions: activity.useTermsAndConditions,
          termsAndConditions: activity.termsAndConditions,
          fee: activity.fee,
          supportedPaymentMethods: activity.supportedPaymentMethods,
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
