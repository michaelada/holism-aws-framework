import { KeycloakAdminService } from './keycloak-admin.service';
import { db } from '../database/pool';
import { logger } from '../config/logger';
import GroupRepresentation from '@keycloak/keycloak-admin-client/lib/defs/groupRepresentation';

/**
 * Data Transfer Objects for Tenant operations
 */
export interface CreateTenantDto {
  name: string;
  displayName: string;
  domain?: string;
}

export interface UpdateTenantDto {
  name?: string;
  displayName?: string;
  domain?: string;
  status?: string;
}

export interface Tenant {
  id: string;
  keycloakGroupId: string;
  name: string;
  displayName: string;
  domain?: string;
  status: string;
  memberCount?: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Service for managing tenant (organization) operations
 * 
 * This service manages tenants by coordinating between Keycloak groups
 * and the local PostgreSQL database. Tenants are represented as Keycloak
 * groups with metadata stored in both systems.
 * 
 * Key Features:
 * - Creates Keycloak group with tenant metadata as attributes
 * - Stores tenant record in PostgreSQL with Keycloak group ID
 * - Enriches tenant data with member count from Keycloak
 * - Updates both Keycloak and database on modifications
 * - Cascades deletion to remove group and database record
 */
export class TenantService {
  constructor(
    private kcAdmin: KeycloakAdminService,
    private database: typeof db = db
  ) {}

  /**
   * Create new tenant
   * 
   * Creates a tenant by:
   * 1. Creating a Keycloak group with tenant metadata as attributes
   * 2. Storing tenant record in PostgreSQL with Keycloak group ID reference
   * 
   * If database creation fails, the Keycloak group is rolled back.
   * 
   * @param data - Tenant creation data
   * @returns Created tenant with all fields
   * @throws Error if creation fails in either system
   */
  async createTenant(data: CreateTenantDto): Promise<Tenant> {
    let keycloakGroupId: string | null = null;

    try {
      await this.kcAdmin.ensureAuthenticated();
      const client = this.kcAdmin.getClient();

      // Create Keycloak group with tenant metadata as attributes
      logger.info('Creating Keycloak group for tenant', { name: data.name });
      
      const groupData: GroupRepresentation = {
        name: data.name,
        attributes: {
          displayName: [data.displayName],
          domain: data.domain ? [data.domain] : [],
          status: ['active'],
          createdAt: [new Date().toISOString()],
        },
      };

      const result = await client.groups.create(groupData);
      keycloakGroupId = result.id;

      if (!keycloakGroupId) {
        throw new Error('Failed to get group ID from Keycloak');
      }

      logger.info('Keycloak group created', { 
        groupId: keycloakGroupId, 
        name: data.name 
      });

      // Store tenant in database
      logger.info('Creating tenant record in database', { 
        keycloakGroupId, 
        name: data.name 
      });

      const dbResult = await this.database.query(
        `INSERT INTO tenants (keycloak_group_id, name, display_name, domain, status)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, keycloak_group_id, name, display_name, domain, status, created_at, updated_at`,
        [keycloakGroupId, data.name, data.displayName, data.domain || null, 'active']
      );

      const tenant = this.mapDbRowToTenant(dbResult.rows[0]);
      tenant.memberCount = 0; // New tenant has no members

      logger.info('Tenant created successfully', { 
        id: tenant.id, 
        keycloakGroupId: tenant.keycloakGroupId 
      });

      return tenant;
    } catch (error) {
      logger.error('Failed to create tenant', { 
        error: error instanceof Error ? error.message : String(error),
        name: data.name 
      });

      // Rollback Keycloak group if database fails
      if (keycloakGroupId) {
        try {
          await this.kcAdmin.ensureAuthenticated();
          const client = this.kcAdmin.getClient();
          await client.groups.del({ id: keycloakGroupId });
          logger.info('Rolled back Keycloak group', { groupId: keycloakGroupId });
        } catch (rollbackError) {
          logger.error('Failed to rollback Keycloak group', { 
            groupId: keycloakGroupId,
            error: rollbackError instanceof Error ? rollbackError.message : String(rollbackError)
          });
        }
      }

      throw error;
    }
  }

  /**
   * List all tenants
   * 
   * Retrieves all Keycloak groups and enriches them with:
   * - Local database information
   * - Member count from Keycloak
   * 
   * @returns Array of tenants with enriched data
   */
  async getTenants(): Promise<Tenant[]> {
    try {
      await this.kcAdmin.ensureAuthenticated();

      // Get all tenants from database
      logger.debug('Fetching tenants from database');
      const dbResult = await this.database.query(
        `SELECT id, keycloak_group_id, name, display_name, domain, status, created_at, updated_at
         FROM tenants
         ORDER BY created_at DESC`
      );

      const tenants: Tenant[] = [];

      // Enrich each tenant with member count from Keycloak
      for (const row of dbResult.rows) {
        const tenant = this.mapDbRowToTenant(row);
        
        try {
          tenant.memberCount = await this.getTenantMemberCount(tenant.keycloakGroupId);
        } catch (error) {
          logger.warn('Failed to get member count for tenant', {
            tenantId: tenant.id,
            keycloakGroupId: tenant.keycloakGroupId,
            error: error instanceof Error ? error.message : String(error)
          });
          tenant.memberCount = 0;
        }

        tenants.push(tenant);
      }

      logger.info('Retrieved tenants', { count: tenants.length });
      return tenants;
    } catch (error) {
      logger.error('Failed to list tenants', { 
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Get tenant by ID
   * 
   * Retrieves a specific tenant by database ID and enriches with
   * member count from Keycloak.
   * 
   * @param id - Database ID of the tenant
   * @returns Tenant with enriched data
   * @throws Error if tenant not found
   */
  async getTenantById(id: string): Promise<Tenant> {
    try {
      logger.debug('Fetching tenant by ID', { id });
      
      const dbResult = await this.database.query(
        `SELECT id, keycloak_group_id, name, display_name, domain, status, created_at, updated_at
         FROM tenants
         WHERE id = $1`,
        [id]
      );

      if (dbResult.rows.length === 0) {
        throw new Error(`Tenant not found: ${id}`);
      }

      const tenant = this.mapDbRowToTenant(dbResult.rows[0]);
      
      // Enrich with member count
      try {
        tenant.memberCount = await this.getTenantMemberCount(tenant.keycloakGroupId);
      } catch (error) {
        logger.warn('Failed to get member count for tenant', {
          tenantId: tenant.id,
          keycloakGroupId: tenant.keycloakGroupId,
          error: error instanceof Error ? error.message : String(error)
        });
        tenant.memberCount = 0;
      }

      logger.info('Retrieved tenant', { id: tenant.id });
      return tenant;
    } catch (error) {
      logger.error('Failed to get tenant by ID', { 
        id,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Update tenant
   * 
   * Updates tenant in both Keycloak and database:
   * 1. Updates Keycloak group attributes
   * 2. Updates database record
   * 
   * @param id - Database ID of the tenant
   * @param updates - Fields to update
   * @returns Updated tenant
   * @throws Error if update fails or tenant not found
   */
  async updateTenant(id: string, updates: UpdateTenantDto): Promise<Tenant> {
    try {
      // First, get the current tenant to get Keycloak group ID
      const currentTenant = await this.getTenantById(id);

      await this.kcAdmin.ensureAuthenticated();
      const client = this.kcAdmin.getClient();

      // Update Keycloak group attributes
      logger.info('Updating Keycloak group', { 
        groupId: currentTenant.keycloakGroupId,
        updates 
      });

      const groupUpdate: GroupRepresentation = {
        name: updates.name || currentTenant.name,
        attributes: {
          displayName: [updates.displayName || currentTenant.displayName],
          domain: updates.domain !== undefined ? [updates.domain] : (currentTenant.domain ? [currentTenant.domain] : []),
          status: [updates.status || currentTenant.status],
        },
      };

      await client.groups.update(
        { id: currentTenant.keycloakGroupId },
        groupUpdate
      );

      logger.info('Keycloak group updated', { groupId: currentTenant.keycloakGroupId });

      // Update database record
      logger.info('Updating tenant in database', { id });

      const updateFields: string[] = [];
      const updateValues: any[] = [];
      let paramIndex = 1;

      if (updates.name !== undefined) {
        updateFields.push(`name = $${paramIndex++}`);
        updateValues.push(updates.name);
      }
      if (updates.displayName !== undefined) {
        updateFields.push(`display_name = $${paramIndex++}`);
        updateValues.push(updates.displayName);
      }
      if (updates.domain !== undefined) {
        updateFields.push(`domain = $${paramIndex++}`);
        updateValues.push(updates.domain);
      }
      if (updates.status !== undefined) {
        updateFields.push(`status = $${paramIndex++}`);
        updateValues.push(updates.status);
      }

      updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
      updateValues.push(id);

      const dbResult = await this.database.query(
        `UPDATE tenants
         SET ${updateFields.join(', ')}
         WHERE id = $${paramIndex}
         RETURNING id, keycloak_group_id, name, display_name, domain, status, created_at, updated_at`,
        updateValues
      );

      const tenant = this.mapDbRowToTenant(dbResult.rows[0]);
      tenant.memberCount = await this.getTenantMemberCount(tenant.keycloakGroupId);

      logger.info('Tenant updated successfully', { id: tenant.id });
      return tenant;
    } catch (error) {
      logger.error('Failed to update tenant', { 
        id,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Delete tenant
   * 
   * Deletes tenant from both systems:
   * 1. Removes Keycloak group (cascades to remove user associations)
   * 2. Removes database record (cascades via foreign key constraints)
   * 
   * @param id - Database ID of the tenant
   * @throws Error if deletion fails or tenant not found
   */
  async deleteTenant(id: string): Promise<void> {
    try {
      // Get tenant to get Keycloak group ID
      const tenant = await this.getTenantById(id);

      await this.kcAdmin.ensureAuthenticated();
      const client = this.kcAdmin.getClient();

      // Delete from Keycloak first
      logger.info('Deleting Keycloak group', { 
        groupId: tenant.keycloakGroupId,
        tenantId: id 
      });

      await client.groups.del({ id: tenant.keycloakGroupId });

      logger.info('Keycloak group deleted', { groupId: tenant.keycloakGroupId });

      // Delete from database
      logger.info('Deleting tenant from database', { id });

      await this.database.query(
        'DELETE FROM tenants WHERE id = $1',
        [id]
      );

      logger.info('Tenant deleted successfully', { id });
    } catch (error) {
      logger.error('Failed to delete tenant', { 
        id,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Get tenant member count
   * 
   * Retrieves the number of members in a tenant's Keycloak group.
   * 
   * @param keycloakGroupId - Keycloak group ID
   * @returns Number of members in the group
   */
  async getTenantMemberCount(keycloakGroupId: string): Promise<number> {
    try {
      await this.kcAdmin.ensureAuthenticated();
      const client = this.kcAdmin.getClient();

      const members = await client.groups.listMembers({ id: keycloakGroupId });
      return members.length;
    } catch (error) {
      logger.error('Failed to get tenant member count', { 
        keycloakGroupId,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Map database row to Tenant object
   * 
   * @param row - Database row
   * @returns Tenant object
   */
  private mapDbRowToTenant(row: any): Tenant {
    return {
      id: row.id,
      keycloakGroupId: row.keycloak_group_id,
      name: row.name,
      displayName: row.display_name,
      domain: row.domain,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
