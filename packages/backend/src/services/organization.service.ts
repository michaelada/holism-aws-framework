import { db } from '../database/pool';
import { logger } from '../config/logger';
import {
  Organization,
  CreateOrganizationDto,
  UpdateOrganizationDto,
  OrganizationStats
} from '../types/organization.types';
import { capabilityService } from './capability.service';
import { organizationTypeService } from './organization-type.service';
import { KeycloakAdminService } from './keycloak-admin.service';
import cacheService from './cache.service';

export class OrganizationService {
  private readonly CACHE_TTL = 300000; // 5 minutes
  
  constructor(private kcAdmin: KeycloakAdminService) {}

  /**
   * Convert database row to Organization object
   */
  private rowToOrganization(row: any): Organization {
    return {
      id: row.id,
      organizationTypeId: row.organization_type_id,
      keycloakGroupId: row.keycloak_group_id,
      name: row.name,
      displayName: row.display_name,
      domain: row.domain,
      status: row.status,
      currency: row.currency,
      language: row.language,
      enabledCapabilities: row.enabled_capabilities || [],
      settings: row.settings || {},
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      createdBy: row.created_by,
      updatedBy: row.updated_by
    };
  }

  /**
   * Get all organizations with optional type filter
   */
  async getAllOrganizations(organizationTypeId?: string): Promise<Organization[]> {
    try {
      let query = `
        SELECT o.*, 
               ot.name as org_type_name, 
               ot.display_name as org_type_display_name,
               ot.default_locale as org_type_default_locale
        FROM organizations o
        LEFT JOIN organization_types ot ON o.organization_type_id = ot.id
      `;
      const params: any[] = [];

      if (organizationTypeId) {
        query += ' WHERE o.organization_type_id = $1';
        params.push(organizationTypeId);
      }

      query += ' ORDER BY o.display_name';

      const result = await db.query(query, params);
      
      // Get user counts for each organization
      const organizations = await Promise.all(
        result.rows.map(async (row: any) => {
          const org = this.rowToOrganization(row);
          const stats = await this.getOrganizationStats(org.id);
          return {
            ...org,
            organizationType: row.org_type_name ? {
              id: org.organizationTypeId,
              name: row.org_type_name,
              displayName: row.org_type_display_name,
              defaultLocale: row.org_type_default_locale || 'en-GB'
            } : undefined,
            adminUserCount: stats.adminUserCount,
            accountUserCount: stats.accountUserCount
          };
        })
      );

      return organizations;
    } catch (error) {
      logger.error('Error getting organizations:', error);
      throw error;
    }
  }

  /**
   * Get organization by ID
   */
  async getOrganizationById(id: string): Promise<Organization | null> {
    try {
      // Check cache first
      const cacheKey = `org:${id}`;
      const cached = cacheService.get<Organization>(cacheKey);
      if (cached) {
        logger.debug(`Cache hit for organization ${id}`);
        return cached;
      }

      const result = await db.query(
        `SELECT o.*, 
                ot.name as org_type_name, 
                ot.display_name as org_type_display_name,
                ot.default_locale as org_type_default_locale
         FROM organizations o
         LEFT JOIN organization_types ot ON o.organization_type_id = ot.id
         WHERE o.id = $1`,
        [id]
      );

      if (result.rows.length === 0) {
        return null;
      }

      const org = this.rowToOrganization(result.rows[0]);
      const stats = await this.getOrganizationStats(id);
      
      const fullOrg = {
        ...org,
        organizationType: result.rows[0].org_type_name ? {
          id: org.organizationTypeId,
          name: result.rows[0].org_type_name,
          displayName: result.rows[0].org_type_display_name,
          defaultLocale: result.rows[0].org_type_default_locale || 'en-GB'
        } : undefined,
        adminUserCount: stats.adminUserCount,
        accountUserCount: stats.accountUserCount
      };

      // Cache the result
      cacheService.set(cacheKey, fullOrg, this.CACHE_TTL);

      return fullOrg;
    } catch (error) {
      logger.error('Error getting organization by ID:', error);
      throw error;
    }
  }

  /**
   * Get organization by name
   */
  async getOrganizationByName(name: string): Promise<Organization | null> {
    try {
      const result = await db.query(
        'SELECT * FROM organizations WHERE name = $1',
        [name]
      );

      if (result.rows.length === 0) {
        return null;
      }

      return this.rowToOrganization(result.rows[0]);
    } catch (error) {
      logger.error('Error getting organization by name:', error);
      throw error;
    }
  }

  /**
   * Create organization with Keycloak group
   */
  async createOrganization(
    data: CreateOrganizationDto,
    userId?: string
  ): Promise<Organization> {
    try {
      // Validate organization type exists
      const orgType = await organizationTypeService.getOrganizationTypeById(
        data.organizationTypeId
      );
      
      if (!orgType) {
        throw new Error('Organization type not found');
      }

      // Validate capabilities
      if (data.enabledCapabilities.length > 0) {
        const valid = await capabilityService.validateCapabilities(data.enabledCapabilities);
        if (!valid) {
          throw new Error('Invalid capabilities provided');
        }

        // Ensure capabilities are subset of org type defaults
        const invalidCaps = data.enabledCapabilities.filter(
          cap => !orgType.defaultCapabilities.includes(cap)
        );
        if (invalidCaps.length > 0) {
          throw new Error(
            `Capabilities not in organization type defaults: ${invalidCaps.join(', ')}`
          );
        }
      }

      // Create Keycloak group hierarchy
      await this.kcAdmin.ensureAuthenticated();
      const client = this.kcAdmin.getClient();
      
      // Find or create organization type group
      const groups = await client.groups.find({ search: orgType.name });
      let orgTypeGroup = groups.find((g: any) => g.name === orgType.name);
      
      if (!orgTypeGroup) {
        // Create organization type group
        const { id: orgTypeGroupId } = await client.groups.create({ name: orgType.name });
        orgTypeGroup = await client.groups.findOne({ id: orgTypeGroupId! });
      }

      // Create organization group under type group
      const { id: orgGroupId } = await client.groups.createChildGroup(
        { id: orgTypeGroup!.id! },
        { name: data.name }
      );

      // Fetch the created organization group
      const orgGroup = await client.groups.findOne({ id: orgGroupId! });

      // Create admin and member subgroups
      await client.groups.createChildGroup(
        { id: orgGroupId! },
        { name: 'admins' }
      );
      
      await client.groups.createChildGroup(
        { id: orgGroupId! },
        { name: 'members' }
      );

      // Insert into database
      const result = await db.query(
        `INSERT INTO organizations 
         (organization_type_id, keycloak_group_id, name, display_name, domain, status,
          currency, language, enabled_capabilities, created_by, updated_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         RETURNING *`,
        [
          data.organizationTypeId,
          orgGroup!.id,
          data.name,
          data.displayName,
          data.domain,
          data.status || 'active',
          data.currency || orgType.currency,
          data.language || orgType.language,
          JSON.stringify(data.enabledCapabilities),
          userId,
          userId
        ]
      );

      logger.info(`Organization created: ${data.name} with Keycloak group: ${orgGroup!.id}`);
      return this.rowToOrganization(result.rows[0]);
    } catch (error) {
      logger.error('Error creating organization:', error);
      throw error;
    }
  }

  /**
   * Update organization
   */
  async updateOrganization(
    id: string,
    data: UpdateOrganizationDto,
    userId?: string
  ): Promise<Organization> {
    try {
      // Validate capabilities if provided
      if (data.enabledCapabilities) {
        const org = await this.getOrganizationById(id);
        if (!org) {
          throw new Error('Organization not found');
        }

        const orgType = await organizationTypeService.getOrganizationTypeById(
          org.organizationTypeId
        );

        if (data.enabledCapabilities.length > 0) {
          const valid = await capabilityService.validateCapabilities(data.enabledCapabilities);
          if (!valid) {
            throw new Error('Invalid capabilities provided');
          }

          // Ensure capabilities are subset of org type defaults
          const invalidCaps = data.enabledCapabilities.filter(
            cap => !orgType!.defaultCapabilities.includes(cap)
          );
          if (invalidCaps.length > 0) {
            throw new Error(
              `Capabilities not in organization type defaults: ${invalidCaps.join(', ')}`
            );
          }
        }
      }

      const updates: string[] = ['updated_at = NOW()'];
      const values: any[] = [];
      let paramCount = 1;

      if (data.displayName !== undefined) {
        updates.push(`display_name = $${paramCount++}`);
        values.push(data.displayName);
      }
      if (data.domain !== undefined) {
        updates.push(`domain = $${paramCount++}`);
        values.push(data.domain);
      }
      if (data.status !== undefined) {
        updates.push(`status = $${paramCount++}`);
        values.push(data.status);
      }
      if (data.currency !== undefined) {
        updates.push(`currency = $${paramCount++}`);
        values.push(data.currency);
      }
      if (data.language !== undefined) {
        updates.push(`language = $${paramCount++}`);
        values.push(data.language);
      }
      if (data.enabledCapabilities !== undefined) {
        updates.push(`enabled_capabilities = $${paramCount++}`);
        values.push(JSON.stringify(data.enabledCapabilities));
      }
      if (data.settings !== undefined) {
        updates.push(`settings = $${paramCount++}`);
        values.push(JSON.stringify(data.settings));
      }

      if (userId) {
        updates.push(`updated_by = $${paramCount++}`);
        values.push(userId);
      }

      values.push(id);

      const result = await db.query(
        `UPDATE organizations 
         SET ${updates.join(', ')}
         WHERE id = $${paramCount}
         RETURNING *`,
        values
      );

      if (result.rows.length === 0) {
        throw new Error('Organization not found');
      }

      // Invalidate cache
      cacheService.delete(`org:${id}`);

      logger.info(`Organization updated: ${id}`);
      return this.rowToOrganization(result.rows[0]);
    } catch (error) {
      logger.error('Error updating organization:', error);
      throw error;
    }
  }

  /**
   * Delete organization and Keycloak group
   */
  async deleteOrganization(id: string): Promise<void> {
    try {
      const org = await this.getOrganizationById(id);
      if (!org) {
        throw new Error('Organization not found');
      }

      // Check if organization has users
      const stats = await this.getOrganizationStats(id);
      if (stats.adminUserCount > 0 || stats.accountUserCount > 0) {
        throw new Error('Cannot delete organization with existing users');
      }

      // Delete Keycloak group
      try {
        await this.kcAdmin.ensureAuthenticated();
        const client = this.kcAdmin.getClient();
        await client.groups.del({ id: org.keycloakGroupId });
      } catch (kcError) {
        logger.warn(`Failed to delete Keycloak group: ${org.keycloakGroupId}`, kcError);
        // Continue with database deletion even if Keycloak fails
      }

      // Delete from database
      const result = await db.query(
        'DELETE FROM organizations WHERE id = $1',
        [id]
      );

      if (result.rowCount === 0) {
        throw new Error('Organization not found');
      }

      // Invalidate cache
      cacheService.delete(`org:${id}`);

      logger.info(`Organization deleted: ${id}`);
    } catch (error) {
      logger.error('Error deleting organization:', error);
      throw error;
    }
  }

  /**
   * Update organization capabilities
   */
  async updateOrganizationCapabilities(
    id: string,
    capabilities: string[],
    userId?: string
  ): Promise<Organization> {
    try {
      return await this.updateOrganization(
        id,
        { enabledCapabilities: capabilities },
        userId
      );
    } catch (error) {
      logger.error('Error updating organization capabilities:', error);
      throw error;
    }
  }

  /**
   * Get organization statistics
   */
  async getOrganizationStats(id: string): Promise<OrganizationStats> {
    try {
      const result = await db.query(
        `SELECT 
          COUNT(CASE WHEN user_type = 'org-admin' THEN 1 END) as admin_user_count,
          COUNT(CASE WHEN user_type = 'account-user' THEN 1 END) as account_user_count
         FROM organization_users
         WHERE organization_id = $1 AND status = 'active'`,
        [id]
      );

      return {
        adminUserCount: parseInt(result.rows[0].admin_user_count) || 0,
        accountUserCount: parseInt(result.rows[0].account_user_count) || 0
      };
    } catch (error) {
      logger.error('Error getting organization stats:', error);
      throw error;
    }
  }

  /**
   * Get organizations by type
   */
  async getOrganizationsByType(typeId: string): Promise<Organization[]> {
    return this.getAllOrganizations(typeId);
  }
}

// Create singleton instance
// Note: KeycloakAdminService will be initialized with config from environment
const kcAdminConfig = {
  baseUrl: process.env.KEYCLOAK_URL || 'http://localhost:8080',
  realmName: process.env.KEYCLOAK_REALM || 'master',
  clientId: process.env.KEYCLOAK_CLIENT_ID || 'admin-cli',
  clientSecret: process.env.KEYCLOAK_CLIENT_SECRET || '',
};

const kcAdmin = KeycloakAdminService.getInstance(kcAdminConfig);
export const organizationService = new OrganizationService(kcAdmin);
