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
      membershipNumbering: row.membership_numbering || 'internal',
      membershipNumberUniqueness: row.membership_number_uniqueness || 'organization',
      initialMembershipNumber: row.initial_membership_number || 1000000,
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
    const client = await db.getClient();
    
    try {
      await client.query('BEGIN');
      
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

      // Set defaults for membership numbering fields
      const membershipNumbering = data.membershipNumbering || 'internal';
      const membershipNumberUniqueness = data.membershipNumberUniqueness || 'organization';
      const initialMembershipNumber = data.initialMembershipNumber !== undefined ? data.initialMembershipNumber : 1000000;

      // Validate conditional requirements
      if (membershipNumbering === 'external') {
        if (data.membershipNumberUniqueness !== undefined) {
          throw new Error('Membership number uniqueness can only be set for internal numbering mode');
        }
        if (data.initialMembershipNumber !== undefined) {
          throw new Error('Initial membership number can only be set for internal numbering mode');
        }
      }

      // Validate initial membership number is positive (check the actual provided/default value)
      if (initialMembershipNumber <= 0) {
        throw new Error('Initial membership number must be a positive integer');
      }
      
      const result = await client.query(
        `INSERT INTO organization_types 
         (name, display_name, description, currency, language, default_locale, default_capabilities, 
          membership_numbering, membership_number_uniqueness, initial_membership_number, 
          created_by, updated_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         RETURNING *`,
        [
          data.name,
          data.displayName,
          data.description,
          data.currency,
          data.language,
          locale,
          JSON.stringify(data.defaultCapabilities),
          membershipNumbering,
          membershipNumberUniqueness,
          initialMembershipNumber,
          userId,
          userId
        ]
      );

      const organizationType = this.rowToOrganizationType(result.rows[0]);

      // Initialize sequence record for internal mode with organization type scope
      if (membershipNumbering === 'internal' && membershipNumberUniqueness === 'organization_type') {
        await client.query(
          `INSERT INTO membership_number_sequences 
           (organization_type_id, organization_id, next_number)
           VALUES ($1, $2, $3)`,
          [organizationType.id, null, initialMembershipNumber]
        );
        logger.info(`Initialized organization type-level sequence for ${data.name} starting at ${initialMembershipNumber}`);
      }

      await client.query('COMMIT');
      logger.info(`Organization type created: ${data.name} with locale: ${locale}, numbering: ${membershipNumbering}`);
      return organizationType;
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error creating organization type:', error);
      throw error;
    } finally {
      client.release();
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
      const client = await db.getClient();

      try {
        await client.query('BEGIN');

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

        // Get current organization type configuration
        const currentResult = await client.query(
          'SELECT * FROM organization_types WHERE id = $1',
          [id]
        );

        if (currentResult.rows.length === 0) {
          throw new Error('Organization type not found');
        }

        const currentOrgType = this.rowToOrganizationType(currentResult.rows[0]);

        // Validate membership numbering configuration changes
        if (data.membershipNumbering !== undefined || data.membershipNumberUniqueness !== undefined) {
          // Check if there are existing members for this organization type
          const memberCountResult = await client.query(
            `SELECT COUNT(*) as count 
             FROM members m
             JOIN organizations o ON m.organisation_id = o.id
             WHERE o.organization_type_id = $1`,
            [id]
          );

          const memberCount = parseInt(memberCountResult.rows[0].count);

          if (memberCount > 0) {
            // If changing numbering mode, reject the change
            if (data.membershipNumbering !== undefined && data.membershipNumbering !== currentOrgType.membershipNumbering) {
              throw new Error('Cannot change membership numbering mode when members already exist for this organization type');
            }

            // If changing uniqueness scope, check for conflicts
            if (data.membershipNumberUniqueness !== undefined && 
                data.membershipNumberUniqueness !== currentOrgType.membershipNumberUniqueness) {

              // Changing from organization-level to organization type-level: check for duplicates across organizations
              if (currentOrgType.membershipNumberUniqueness === 'organization' && 
                  data.membershipNumberUniqueness === 'organization_type') {
                const duplicateCheckResult = await client.query(
                  `SELECT m.membership_number, COUNT(*) as count
                   FROM members m
                   JOIN organizations o ON m.organisation_id = o.id
                   WHERE o.organization_type_id = $1
                   GROUP BY m.membership_number
                   HAVING COUNT(*) > 1`,
                  [id]
                );

                if (duplicateCheckResult.rows.length > 0) {
                  const duplicateNumbers = duplicateCheckResult.rows.map(r => r.membership_number).join(', ');
                  throw new Error(`Cannot change to organization type-level uniqueness: duplicate membership numbers exist across organizations (${duplicateNumbers})`);
                }
              }
            }
          }
        }

        // Validate conditional requirements for membership numbering
        if (data.membershipNumbering === 'external') {
          if (data.membershipNumberUniqueness !== undefined) {
            throw new Error('Membership number uniqueness can only be set for internal numbering mode');
          }
          if (data.initialMembershipNumber !== undefined) {
            throw new Error('Initial membership number can only be set for internal numbering mode');
          }
        }

        // Validate initial membership number is positive if provided
        if (data.initialMembershipNumber !== undefined && data.initialMembershipNumber <= 0) {
          throw new Error('Initial membership number must be a positive integer');
        }

        const updates: string[] = ['updated_at = NOW()'];
        const values: any[] = [];
        let paramCount = 1;

        if (data.name !== undefined) {
          updates.push(`name = $${paramCount++}`);
          values.push(data.name);
        }
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
        if (data.membershipNumbering !== undefined) {
          updates.push(`membership_numbering = $${paramCount++}`);
          values.push(data.membershipNumbering);
        }
        if (data.membershipNumberUniqueness !== undefined) {
          updates.push(`membership_number_uniqueness = $${paramCount++}`);
          values.push(data.membershipNumberUniqueness);
        }
        if (data.initialMembershipNumber !== undefined) {
          updates.push(`initial_membership_number = $${paramCount++}`);
          values.push(data.initialMembershipNumber);
        }

        if (userId) {
          updates.push(`updated_by = $${paramCount++}`);
          values.push(userId);
        }

        values.push(id);

        const result = await client.query(
          `UPDATE organization_types 
           SET ${updates.join(', ')}
           WHERE id = $${paramCount}
           RETURNING *`,
          values
        );

        const updatedOrgType = this.rowToOrganizationType(result.rows[0]);

        // Handle sequence record updates if uniqueness scope changed
        if (data.membershipNumberUniqueness !== undefined && 
            data.membershipNumberUniqueness !== currentOrgType.membershipNumberUniqueness) {

          const finalNumbering = updatedOrgType.membershipNumbering;
          const finalUniqueness = updatedOrgType.membershipNumberUniqueness;
          const finalInitialNumber = updatedOrgType.initialMembershipNumber;

          if (finalNumbering === 'internal') {
            if (finalUniqueness === 'organization_type') {
              // Changed to organization type-level: create/update org type-level sequence
              // Check if sequence already exists
              const existingSeqResult = await client.query(
                `SELECT * FROM membership_number_sequences 
                 WHERE organization_type_id = $1 AND organization_id IS NULL`,
                [id]
              );

              if (existingSeqResult.rows.length === 0) {
                // Find the highest membership number across all organizations
                const maxNumberResult = await client.query(
                  `SELECT MAX(CAST(m.membership_number AS INTEGER)) as max_number
                   FROM members m
                   JOIN organizations o ON m.organisation_id = o.id
                   WHERE o.organization_type_id = $1
                   AND m.membership_number ~ '^[0-9]+$'`,
                  [id]
                );

                const maxNumber = maxNumberResult.rows[0].max_number;
                const nextNumber = maxNumber ? maxNumber + 1 : finalInitialNumber;

                await client.query(
                  `INSERT INTO membership_number_sequences 
                   (organization_type_id, organization_id, next_number)
                   VALUES ($1, $2, $3)`,
                  [id, null, nextNumber]
                );
                logger.info(`Created organization type-level sequence for ${id} starting at ${nextNumber}`);
              }

              // Delete organization-level sequences for this type
              await client.query(
                `DELETE FROM membership_number_sequences 
                 WHERE organization_type_id = $1 AND organization_id IS NOT NULL`,
                [id]
              );
            } else {
              // Changed to organization-level: delete org type-level sequence
              await client.query(
                `DELETE FROM membership_number_sequences 
                 WHERE organization_type_id = $1 AND organization_id IS NULL`,
                [id]
              );
              logger.info(`Deleted organization type-level sequence for ${id} (now using organization-level)`);
            }
          }
        }

        await client.query('COMMIT');
        logger.info(`Organization type updated: ${id}`);
        return updatedOrgType;
      } catch (error) {
        await client.query('ROLLBACK');
        logger.error('Error updating organization type:', error);
        throw error;
      } finally {
        client.release();
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
