import { db } from '../database/pool';
import { logger } from '../config/logger';

/**
 * Event Type interface matching database schema
 */
export interface EventType {
  id: string;
  organisationId: string;
  name: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * DTO for creating an event type
 */
export interface CreateEventTypeDto {
  organisationId: string;
  name: string;
  description?: string;
}

/**
 * DTO for updating an event type
 */
export interface UpdateEventTypeDto {
  name?: string;
  description?: string;
}

/**
 * Service for managing event types
 */
export class EventTypeService {
  /**
   * Convert database row to EventType object
   */
  private rowToEventType(row: any): EventType {
    return {
      id: row.id,
      organisationId: row.organisation_id,
      name: row.name,
      description: row.description,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * Get all event types for an organisation
   */
  async getByOrganisation(organisationId: string): Promise<EventType[]> {
    try {
      const result = await db.query(
        `SELECT * FROM event_types 
         WHERE organisation_id = $1 
         ORDER BY name ASC`,
        [organisationId]
      );

      return result.rows.map(row => this.rowToEventType(row));
    } catch (error) {
      logger.error('Error getting event types by organisation:', error);
      throw error;
    }
  }

  /**
   * Get event type by ID
   */
  async getById(id: string): Promise<EventType | null> {
    try {
      const result = await db.query(
        'SELECT * FROM event_types WHERE id = $1',
        [id]
      );

      if (result.rows.length === 0) {
        return null;
      }

      return this.rowToEventType(result.rows[0]);
    } catch (error) {
      logger.error('Error getting event type by ID:', error);
      throw error;
    }
  }

  /**
   * Create a new event type
   */
  async create(data: CreateEventTypeDto): Promise<EventType> {
    try {
      // Validate required fields
      if (!data.name || data.name.trim() === '') {
        throw new Error('Event type name is required');
      }

      const result = await db.query(
        `INSERT INTO event_types 
         (organisation_id, name, description)
         VALUES ($1, $2, $3)
         RETURNING *`,
        [
          data.organisationId,
          data.name.trim(),
          data.description?.trim() || null,
        ]
      );

      logger.info(`Event type created: ${data.name} (${result.rows[0].id})`);
      return this.rowToEventType(result.rows[0]);
    } catch (error: any) {
      // Handle unique constraint violation
      if (error.code === '23505') {
        throw new Error('An event type with this name already exists for this organisation');
      }
      logger.error('Error creating event type:', error);
      throw error;
    }
  }

  /**
   * Update an event type
   */
  async update(id: string, data: UpdateEventTypeDto): Promise<EventType> {
    try {
      // Get existing event type
      const existing = await this.getById(id);
      if (!existing) {
        throw new Error('Event type not found');
      }

      // Validate name if provided
      if (data.name !== undefined && data.name.trim() === '') {
        throw new Error('Event type name cannot be empty');
      }

      const updates: string[] = ['updated_at = NOW()'];
      const values: any[] = [];
      let paramCount = 1;

      if (data.name !== undefined) {
        updates.push(`name = $${paramCount++}`);
        values.push(data.name.trim());
      }
      if (data.description !== undefined) {
        updates.push(`description = $${paramCount++}`);
        values.push(data.description?.trim() || null);
      }

      values.push(id);

      const result = await db.query(
        `UPDATE event_types 
         SET ${updates.join(', ')}
         WHERE id = $${paramCount}
         RETURNING *`,
        values
      );

      if (result.rows.length === 0) {
        throw new Error('Event type not found');
      }

      logger.info(`Event type updated: ${id}`);
      return this.rowToEventType(result.rows[0]);
    } catch (error: any) {
      // Handle unique constraint violation
      if (error.code === '23505') {
        throw new Error('An event type with this name already exists for this organisation');
      }
      logger.error('Error updating event type:', error);
      throw error;
    }
  }

  /**
   * Delete an event type
   */
  async delete(id: string): Promise<void> {
    try {
      // Check if event type is in use
      const inUse = await this.isInUse(id);
      if (inUse) {
        throw new Error('Cannot delete event type that is used in events');
      }

      const result = await db.query(
        'DELETE FROM event_types WHERE id = $1',
        [id]
      );

      if (result.rowCount === 0) {
        throw new Error('Event type not found');
      }

      logger.info(`Event type deleted: ${id}`);
    } catch (error) {
      logger.error('Error deleting event type:', error);
      throw error;
    }
  }

  /**
   * Check if event type is used in any events
   */
  async isInUse(id: string): Promise<boolean> {
    try {
      const result = await db.query(
        'SELECT COUNT(*) as count FROM events WHERE event_type_id = $1',
        [id]
      );

      return parseInt(result.rows[0].count) > 0;
    } catch (error) {
      logger.error('Error checking if event type is in use:', error);
      throw error;
    }
  }
}

// Create singleton instance
export const eventTypeService = new EventTypeService();
