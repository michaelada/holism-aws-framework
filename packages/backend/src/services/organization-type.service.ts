import { db } from '../database/pool';
import { logger } from '../config/logger';
import {
  OrganizationType,
  CreateOrganizationTypeDto,
  UpdateOrganizationTypeDto
} from '../types/organization.types';
import { capabilityService } from './capability.service';

export class OrganizationTypeService {
  // Supported locales for validation
  private readonly SUPPORTED_LOCALES = [
    'en-GB',
    'fr-FR',
    'es-ES',
    'it-IT',
    'de-DE',
    'pt-PT'
  ];

  // Default locale fallback
  private readonly DEFAULT_LOCALE = 'en-GB';

  /**
   * Validate locale format and support
   */
  validateLocale(locale: string): boolean {
    // Check format: xx-XX (language-REGION)
    const localeFormatRegex = /^[a-z]{2}-[A-Z]{2}$/;
    if (!localeFormatRegex.test(locale)) {
      return false;
    }

    // Check if locale is in supported list
    return this.SUPPORTED_LOCALES.includes(locale);
  }

  /**
   * Get fallback locale for invalid locales
   */
  private getFallbackLocale(locale?: string): string {
    if (!locale) {
      return this.DEFAULT_LOCALE;
    }

    // If locale is valid, return it
    if (this.validateLocale(locale)) {
      return locale;
    }

    // Otherwise, return default
    logger.warn(`Invalid locale '${locale}', falling back to '${this.DEFAULT_LOCALE}'`);
    return this.DEFAULT_LOCALE;
  }

  /**
   * Convert database row to OrganizationType object
   */
  private rowToOrganizationType(row: any): OrganizationType {
    return {
      id: row.id,
      name: row.name,
      displayName: row.display_name,
      description: row.description,
      currency: row.currency,
      language: row.language,
      defaultLocale: this.getFallbackLocale(row.default_locale),
      defaultCapabilities: row.default_capabilities || [],
      status: row.status || 'active',
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      createdBy: row.created_by,
      updatedBy: row.updated_by
    };
  }

  /**
   * Get all organization types
   */
  async getAllOrganizationTypes(): Promise<OrganizationType[]> {
    try {
      const result = await db.query(
        'SELECT * FROM organization_types ORDER BY display_name'
      );

      return result.rows.map((row: any) => this.rowToOrganizationType(row));
    } catch (error) {
      logger.error('Error getting organization types:', error);
      throw error;
    }
  }

  /**
   * Get organization type by ID
   */
  async getOrganizationTypeById(id: string): Promise<OrganizationType | null> {
    try {
      const result = await db.query(
        'SELECT * FROM organization_types WHERE id = $1',
        [id]
      );

      if (result.rows.length === 0) {
        return null;
      }

      return this.rowToOrganizationType(result.rows[0]);
    } catch (error) {
      logger.error('Error getting organization type by ID:', error);
      throw error;
    }
  }

  /**
   * Get organization type by name
   */
  async getOrganizationTypeByName(name: string): Promise<OrganizationType | null> {
    try {
      const result = await db.query(
        'SELECT * FROM organization_types WHERE name = $1',
        [name]
      );

      if (result.rows.length === 0) {
        return null;
      }

      return this.rowToOrganizationType(result.rows[0]);
    } catch (error) {
      logger.error('Error getting organization type by name:', error);
      throw error;
    }
  }

  /**
   * Create organization type
   */
  async createOrganizationType(
    data: CreateOrganizationTypeDto,
    userId?: string
  ): Promise<OrganizationType> {
    try {
      // Validate capabilities
      if (data.defaultCapabilities.length > 0) {
        const valid = await capabilityService.validateCapabilities(data.defaultCapabilities);
        if (!valid) {
          throw new Error('Invalid capabilities provided');
        }
      }

      // Validate and set locale
      const locale = data.defaultLocale || this.DEFAULT_LOCALE;
      if (!this.validateLocale(locale)) {
        throw new Error(`Invalid or unsupported locale: ${locale}. Supported locales: ${this.SUPPORTED_LOCALES.join(', ')}`);
      }
      
      const result = await db.query(
        `INSERT INTO organization_types 
         (name, display_name, description, currency, language, default_locale, default_capabilities, created_by, updated_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING *`,
        [
          data.name,
          data.displayName,
          data.description,
          data.currency,
          data.language,
          locale,
          JSON.stringify(data.defaultCapabilities),
          userId,
          userId
        ]
      );

      logger.info(`Organization type created: ${data.name} with locale: ${locale}`);
      return this.rowToOrganizationType(result.rows[0]);
    } catch (error) {
      logger.error('Error creating organization type:', error);
      throw error;
    }
  }

  /**
   * Update organization type
   */
  async updateOrganizationType(
    id: string,
    data: UpdateOrganizationTypeDto,
    userId?: string
  ): Promise<OrganizationType> {
    try {
      // Validate capabilities if provided
      if (data.defaultCapabilities && data.defaultCapabilities.length > 0) {
        const valid = await capabilityService.validateCapabilities(data.defaultCapabilities);
        if (!valid) {
          throw new Error('Invalid capabilities provided');
        }
      }

      // Validate locale if provided
      if (data.defaultLocale !== undefined && !this.validateLocale(data.defaultLocale)) {
        throw new Error(`Invalid or unsupported locale: ${data.defaultLocale}. Supported locales: ${this.SUPPORTED_LOCALES.join(', ')}`);
      }

      const updates: string[] = ['updated_at = NOW()'];
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
      if (data.currency !== undefined) {
        updates.push(`currency = $${paramCount++}`);
        values.push(data.currency);
      }
      if (data.language !== undefined) {
        updates.push(`language = $${paramCount++}`);
        values.push(data.language);
      }
      if (data.defaultLocale !== undefined) {
        updates.push(`default_locale = $${paramCount++}`);
        values.push(data.defaultLocale);
      }
      if (data.defaultCapabilities !== undefined) {
        updates.push(`default_capabilities = $${paramCount++}`);
        values.push(JSON.stringify(data.defaultCapabilities));
      }

      if (userId) {
        updates.push(`updated_by = $${paramCount++}`);
        values.push(userId);
      }

      values.push(id);

      const result = await db.query(
        `UPDATE organization_types 
         SET ${updates.join(', ')}
         WHERE id = $${paramCount}
         RETURNING *`,
        values
      );

      if (result.rows.length === 0) {
        throw new Error('Organization type not found');
      }

      logger.info(`Organization type updated: ${id}`);
      return this.rowToOrganizationType(result.rows[0]);
    } catch (error) {
      logger.error('Error updating organization type:', error);
      throw error;
    }
  }

  /**
   * Delete organization type
   */
  async deleteOrganizationType(id: string): Promise<void> {
    try {
      // Check if any organizations use this type
      const orgCheck = await db.query(
        'SELECT COUNT(*) as count FROM organizations WHERE organization_type_id = $1',
        [id]
      );

      if (parseInt(orgCheck.rows[0].count) > 0) {
        throw new Error('Cannot delete organization type with existing organizations');
      }

      const result = await db.query(
        'DELETE FROM organization_types WHERE id = $1',
        [id]
      );

      if (result.rowCount === 0) {
        throw new Error('Organization type not found');
      }

      logger.info(`Organization type deleted: ${id}`);
    } catch (error) {
      logger.error('Error deleting organization type:', error);
      throw error;
    }
  }

  /**
   * Get organization count for a type
   */
  async getOrganizationCount(typeId: string): Promise<number> {
    try {
      const result = await db.query(
        'SELECT COUNT(*) as count FROM organizations WHERE organization_type_id = $1',
        [typeId]
      );

      return parseInt(result.rows[0].count);
    } catch (error) {
      logger.error('Error getting organization count:', error);
      throw error;
    }
  }
}

export const organizationTypeService = new OrganizationTypeService();
