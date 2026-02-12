import { db } from '../database/pool';
import { logger } from '../config/logger';

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
}

/**
 * Service for managing events
 */
export class EventService {
  /**
   * Convert database row to Event object
   */
  private rowToEvent(row: any): Event {
    return {
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
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * Get all events for an organisation
   */
  async getEventsByOrganisation(organisationId: string): Promise<Event[]> {
    try {
      const result = await db.query(
        `SELECT * FROM events 
         WHERE organisation_id = $1 
         ORDER BY start_date DESC`,
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
        'SELECT * FROM events WHERE id = $1',
        [id]
      );

      if (result.rows.length === 0) {
        return null;
      }

      return this.rowToEvent(result.rows[0]);
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
          limit_entries, entries_limit, add_confirmation_message, confirmation_message, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
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
        ]
      );

      logger.info(`Event created: ${data.name} (${result.rows[0].id})`);
      return this.rowToEvent(result.rows[0]);
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

      logger.info(`Event updated: ${id}`);
      return this.rowToEvent(result.rows[0]);
    } catch (error) {
      logger.error('Error updating event:', error);
      throw error;
    }
  }

  /**
   * Delete an event
   */
  async deleteEvent(id: string): Promise<void> {
    try {
      const result = await db.query(
        'DELETE FROM events WHERE id = $1',
        [id]
      );

      if (result.rowCount === 0) {
        throw new Error('Event not found');
      }

      logger.info(`Event deleted: ${id}`);
    } catch (error) {
      logger.error('Error deleting event:', error);
      throw error;
    }
  }
}

// Create singleton instance
export const eventService = new EventService();
