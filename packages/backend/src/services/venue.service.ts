import { db } from '../database/pool';
import { logger } from '../config/logger';

/**
 * Venue interface matching database schema
 */
export interface Venue {
  id: string;
  organisationId: string;
  name: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * DTO for creating a venue
 */
export interface CreateVenueDto {
  organisationId: string;
  name: string;
  address?: string;
  latitude?: number;
  longitude?: number;
}

/**
 * DTO for updating a venue
 */
export interface UpdateVenueDto {
  name?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
}

/**
 * Service for managing venues
 */
export class VenueService {
  /**
   * Convert database row to Venue object
   */
  private rowToVenue(row: any): Venue {
    return {
      id: row.id,
      organisationId: row.organisation_id,
      name: row.name,
      address: row.address,
      latitude: row.latitude ? parseFloat(row.latitude) : undefined,
      longitude: row.longitude ? parseFloat(row.longitude) : undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * Validate latitude and longitude
   */
  private validateCoordinates(latitude?: number, longitude?: number): void {
    if (latitude !== undefined && (latitude < -90 || latitude > 90)) {
      throw new Error('Latitude must be between -90 and 90');
    }
    if (longitude !== undefined && (longitude < -180 || longitude > 180)) {
      throw new Error('Longitude must be between -180 and 180');
    }
  }

  /**
   * Get all venues for an organisation
   */
  async getByOrganisation(organisationId: string): Promise<Venue[]> {
    try {
      const result = await db.query(
        `SELECT * FROM venues 
         WHERE organisation_id = $1 
         ORDER BY name ASC`,
        [organisationId]
      );

      return result.rows.map(row => this.rowToVenue(row));
    } catch (error) {
      logger.error('Error getting venues by organisation:', error);
      throw error;
    }
  }

  /**
   * Get venue by ID
   */
  async getById(id: string): Promise<Venue | null> {
    try {
      const result = await db.query(
        'SELECT * FROM venues WHERE id = $1',
        [id]
      );

      if (result.rows.length === 0) {
        return null;
      }

      return this.rowToVenue(result.rows[0]);
    } catch (error) {
      logger.error('Error getting venue by ID:', error);
      throw error;
    }
  }

  /**
   * Create a new venue
   */
  async create(data: CreateVenueDto): Promise<Venue> {
    try {
      // Validate required fields
      if (!data.name || data.name.trim() === '') {
        throw new Error('Venue name is required');
      }

      // Validate coordinates
      this.validateCoordinates(data.latitude, data.longitude);

      const result = await db.query(
        `INSERT INTO venues 
         (organisation_id, name, address, latitude, longitude)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [
          data.organisationId,
          data.name.trim(),
          data.address?.trim() || null,
          data.latitude || null,
          data.longitude || null,
        ]
      );

      logger.info(`Venue created: ${data.name} (${result.rows[0].id})`);
      return this.rowToVenue(result.rows[0]);
    } catch (error: any) {
      // Handle unique constraint violation
      if (error.code === '23505') {
        throw new Error('A venue with this name already exists for this organisation');
      }
      logger.error('Error creating venue:', error);
      throw error;
    }
  }

  /**
   * Update a venue
   */
  async update(id: string, data: UpdateVenueDto): Promise<Venue> {
    try {
      // Get existing venue
      const existing = await this.getById(id);
      if (!existing) {
        throw new Error('Venue not found');
      }

      // Validate name if provided
      if (data.name !== undefined && data.name.trim() === '') {
        throw new Error('Venue name cannot be empty');
      }

      // Validate coordinates if provided
      this.validateCoordinates(data.latitude, data.longitude);

      const updates: string[] = ['updated_at = NOW()'];
      const values: any[] = [];
      let paramCount = 1;

      if (data.name !== undefined) {
        updates.push(`name = $${paramCount++}`);
        values.push(data.name.trim());
      }
      if (data.address !== undefined) {
        updates.push(`address = $${paramCount++}`);
        values.push(data.address?.trim() || null);
      }
      if (data.latitude !== undefined) {
        updates.push(`latitude = $${paramCount++}`);
        values.push(data.latitude || null);
      }
      if (data.longitude !== undefined) {
        updates.push(`longitude = $${paramCount++}`);
        values.push(data.longitude || null);
      }

      values.push(id);

      const result = await db.query(
        `UPDATE venues 
         SET ${updates.join(', ')}
         WHERE id = $${paramCount}
         RETURNING *`,
        values
      );

      if (result.rows.length === 0) {
        throw new Error('Venue not found');
      }

      logger.info(`Venue updated: ${id}`);
      return this.rowToVenue(result.rows[0]);
    } catch (error: any) {
      // Handle unique constraint violation
      if (error.code === '23505') {
        throw new Error('A venue with this name already exists for this organisation');
      }
      logger.error('Error updating venue:', error);
      throw error;
    }
  }

  /**
   * Delete a venue
   */
  async delete(id: string): Promise<void> {
    try {
      // Check if venue is in use
      const inUse = await this.isInUse(id);
      if (inUse) {
        throw new Error('Cannot delete venue that is used in events');
      }

      const result = await db.query(
        'DELETE FROM venues WHERE id = $1',
        [id]
      );

      if (result.rowCount === 0) {
        throw new Error('Venue not found');
      }

      logger.info(`Venue deleted: ${id}`);
    } catch (error) {
      logger.error('Error deleting venue:', error);
      throw error;
    }
  }

  /**
   * Check if venue is used in any events
   */
  async isInUse(id: string): Promise<boolean> {
    try {
      const result = await db.query(
        'SELECT COUNT(*) as count FROM events WHERE venue_id = $1',
        [id]
      );

      return parseInt(result.rows[0].count) > 0;
    } catch (error) {
      logger.error('Error checking if venue is in use:', error);
      throw error;
    }
  }
}

// Create singleton instance
export const venueService = new VenueService();
