import { db } from '../database/pool';
import { logger } from '../config/logger';
import { Capability, CreateCapabilityDto, CapabilityCategory } from '../types/organization.types';
import cacheService from './cache.service';

export class CapabilityService {
  private readonly CACHE_TTL = 600000; // 10 minutes (capabilities change rarely)
  
  /**
   * Convert database row to Capability object
   */
  private rowToCapability(row: any): Capability {
    return {
      id: row.id,
      name: row.name,
      displayName: row.display_name,
      description: row.description,
      category: row.category,
      isActive: row.is_active,
      createdAt: row.created_at
    };
  }

  /**
   * Get all capabilities
   */
  async getAllCapabilities(category?: CapabilityCategory): Promise<Capability[]> {
    try {
      // Check cache first
      const cacheKey = `capabilities:all:${category || 'all'}`;
      const cached = cacheService.get<Capability[]>(cacheKey);
      if (cached) {
        logger.debug(`Cache hit for capabilities ${category || 'all'}`);
        return cached;
      }

      let query = 'SELECT * FROM capabilities WHERE is_active = true';
      const params: any[] = [];

      if (category) {
        query += ' AND category = $1';
        params.push(category);
      }

      query += ' ORDER BY category, display_name';

      const result = await db.query(query, params);
      const capabilities = result.rows.map((row: any) => this.rowToCapability(row));

      // Cache the result
      cacheService.set(cacheKey, capabilities, this.CACHE_TTL);

      return capabilities;
    } catch (error) {
      logger.error('Error getting capabilities:', error);
      throw error;
    }
  }

  /**
   * Get capability by ID
   */
  async getCapabilityById(id: string): Promise<Capability | null> {
    try {
      const result = await db.query(
        'SELECT * FROM capabilities WHERE id = $1',
        [id]
      );

      if (result.rows.length === 0) {
        return null;
      }

      return this.rowToCapability(result.rows[0]);
    } catch (error) {
      logger.error('Error getting capability by ID:', error);
      throw error;
    }
  }

  /**
   * Get capability by name
   */
  async getCapabilityByName(name: string): Promise<Capability | null> {
    try {
      const result = await db.query(
        'SELECT * FROM capabilities WHERE name = $1',
        [name]
      );

      if (result.rows.length === 0) {
        return null;
      }

      return this.rowToCapability(result.rows[0]);
    } catch (error) {
      logger.error('Error getting capability by name:', error);
      throw error;
    }
  }

  /**
   * Create capability (super admin only)
   */
  async createCapability(data: CreateCapabilityDto): Promise<Capability> {
    try {
      const result = await db.query(
        `INSERT INTO capabilities (name, display_name, description, category)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [data.name, data.displayName, data.description, data.category]
      );

      logger.info(`Capability created: ${data.name}`);
      return this.rowToCapability(result.rows[0]);
    } catch (error) {
      logger.error('Error creating capability:', error);
      throw error;
    }
  }

  /**
   * Update capability
   */
  async updateCapability(id: string, data: Partial<CreateCapabilityDto>): Promise<Capability> {
    try {
      const updates: string[] = [];
      const values: any[] = [];
      let paramCount = 1;

      if (data.displayName !== undefined) {
        updates.push(`display_name = $${paramCount++}`);
        values.push(data.displayName);
      }
      if (data.description !== undefined) {
        updates.push(`description = $${paramCount++}`);
        values.push(data.description);
      }
      if (data.category !== undefined) {
        updates.push(`category = $${paramCount++}`);
        values.push(data.category);
      }

      values.push(id);

      const result = await db.query(
        `UPDATE capabilities 
         SET ${updates.join(', ')}
         WHERE id = $${paramCount}
         RETURNING *`,
        values
      );

      if (result.rows.length === 0) {
        throw new Error('Capability not found');
      }

      logger.info(`Capability updated: ${id}`);
      return this.rowToCapability(result.rows[0]);
    } catch (error) {
      logger.error('Error updating capability:', error);
      throw error;
    }
  }

  /**
   * Deactivate capability
   */
  async deactivateCapability(id: string): Promise<void> {
    try {
      await db.query(
        'UPDATE capabilities SET is_active = false WHERE id = $1',
        [id]
      );

      logger.info(`Capability deactivated: ${id}`);
    } catch (error) {
      logger.error('Error deactivating capability:', error);
      throw error;
    }
  }

  /**
   * Validate capability names
   */
  async validateCapabilities(capabilityNames: string[]): Promise<boolean> {
    return (await this.unknownCapabilities(capabilityNames)).length === 0;
  }

  /**
   * The names that are not capabilities this platform knows about.
   *
   * Returned rather than reduced to a boolean so a refusal can **say which**.
   * "Invalid capabilities provided" is a message that tells an administrator
   * nothing: they cannot see the catalogue, they did not necessarily change the
   * capabilities at all, and the offending name may well have been in the
   * record before they opened it.
   *
   * That is not hypothetical. Editing an organisation type's application fee
   * failed with exactly that message, because the record carried three names
   * that no longer exist — nothing the administrator had touched, and nothing
   * the error named.
   *
   * A name that exists but is switched off (`is_active = false`) counts as
   * unknown: it cannot be granted, and saying it is not a capability is nearer
   * the truth than saying nothing.
   */
  async unknownCapabilities(capabilityNames: string[]): Promise<string[]> {
    if (capabilityNames.length === 0) return [];

    try {
      const result = await db.query(
        'SELECT name FROM capabilities WHERE name = ANY($1) AND is_active = true',
        [capabilityNames]
      );

      const known = new Set(result.rows.map((row: { name: string }) => row.name));
      // De-duplicated: a list that repeats an unknown name should not repeat it
      // in the refusal.
      return [...new Set(capabilityNames)].filter((name) => !known.has(name));
    } catch (error) {
      logger.error('Error validating capabilities:', error);
      throw error;
    }
  }
}

export const capabilityService = new CapabilityService();
