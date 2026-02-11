import { KeycloakAdminService } from './keycloak-admin.service';
import { db } from '../database/pool';
import { logger } from '../config/logger';
import RoleRepresentation from '@keycloak/keycloak-admin-client/lib/defs/roleRepresentation';

/**
 * Data Transfer Objects for Role operations
 */
export interface CreateRoleDto {
  name: string;
  displayName: string;
  description?: string;
  permissions?: string[];
}

export interface Role {
  id: string;
  keycloakRoleId?: string;
  name: string;
  displayName: string;
  description?: string;
  permissions?: string[];
  composite: boolean;
}

/**
 * Service for managing role operations
 * 
 * This service manages roles by coordinating between Keycloak realm roles
 * and the local PostgreSQL database. Roles are created in Keycloak
 * with metadata stored in both systems.
 * 
 * Key Features:
 * - Creates realm role in Keycloak
 * - Stores role metadata in PostgreSQL
 * - Supports custom permissions as role attributes
 * - Deletes from both Keycloak and database
 */
export class RoleService {
  constructor(
    private kcAdmin: KeycloakAdminService,
    private database: typeof db = db
  ) {}

  /**
   * Create new role
   * 
   * Creates a role by:
   * 1. Creating a realm role in Keycloak with name and description
   * 2. Storing role metadata in PostgreSQL with Keycloak role ID reference
   * 3. Storing custom permissions as role attributes in Keycloak
   * 
   * If database creation fails, the Keycloak role is rolled back.
   * 
   * @param data - Role creation data
   * @returns Created role with all fields
   * @throws Error if creation fails in either system
   */
  async createRole(data: CreateRoleDto): Promise<Role> {
    let keycloakRoleId: string | null = null;

    try {
      await this.kcAdmin.ensureAuthenticated();
      const client = this.kcAdmin.getClient();

      // Create Keycloak realm role with metadata as attributes
      logger.info('Creating Keycloak realm role', { name: data.name });

      const roleData: RoleRepresentation = {
        name: data.name,
        description: data.description,
        attributes: {
          displayName: [data.displayName],
          permissions: data.permissions || [],
        },
      };

      await client.roles.create(roleData);

      // Get the created role to obtain its ID
      const createdRole = await client.roles.findOneByName({ name: data.name });

      if (!createdRole || !createdRole.id) {
        throw new Error('Failed to get role ID from Keycloak');
      }

      keycloakRoleId = createdRole.id;

      logger.info('Keycloak realm role created', {
        roleId: keycloakRoleId,
        name: data.name,
      });

      // Store role in database
      logger.info('Creating role record in database', {
        keycloakRoleId,
        name: data.name,
      });

      const dbResult = await this.database.query(
        `INSERT INTO roles (keycloak_role_id, name, display_name, description, permissions)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, keycloak_role_id, name, display_name, description, permissions, created_at, updated_at`,
        [
          keycloakRoleId,
          data.name,
          data.displayName,
          data.description || null,
          JSON.stringify(data.permissions || []),
        ]
      );

      const role = this.mapDbRowToRole(dbResult.rows[0]);

      logger.info('Role created successfully', {
        id: role.id,
        keycloakRoleId: role.keycloakRoleId,
      });

      return role;
    } catch (error) {
      logger.error('Failed to create role', {
        error: error instanceof Error ? error.message : String(error),
        name: data.name,
      });

      // Rollback Keycloak role if database fails
      if (keycloakRoleId) {
        try {
          await this.kcAdmin.ensureAuthenticated();
          const client = this.kcAdmin.getClient();
          await client.roles.delByName({ name: data.name });
          logger.info('Rolled back Keycloak role', { roleId: keycloakRoleId });
        } catch (rollbackError) {
          logger.error('Failed to rollback Keycloak role', {
            roleId: keycloakRoleId,
            error: rollbackError instanceof Error ? rollbackError.message : String(rollbackError),
          });
        }
      }

      throw error;
    }
  }

  /**
   * List all roles
   * 
   * Retrieves all realm roles from Keycloak and enriches them with
   * local database information.
   * 
   * @returns Array of roles with enriched data
   */
  async getRoles(): Promise<Role[]> {
    try {
      await this.kcAdmin.ensureAuthenticated();
      const client = this.kcAdmin.getClient();

      logger.debug('Fetching roles from Keycloak');

      // Get all realm roles from Keycloak
      const kcRoles = await client.roles.find();

      const roles: Role[] = [];

      // Enrich each role with database information
      for (const kcRole of kcRoles) {
        if (!kcRole.id || !kcRole.name) continue;

        try {
          const dbResult = await this.database.query(
            'SELECT id, keycloak_role_id, name, display_name, description, permissions, created_at, updated_at FROM roles WHERE keycloak_role_id = $1',
            [kcRole.id]
          );

          let role: Role;

          if (dbResult.rows.length > 0) {
            role = this.mapDbRowToRole(dbResult.rows[0]);
          } else {
            // Role exists in Keycloak but not in database - create minimal role object
            role = {
              id: '',
              keycloakRoleId: kcRole.id,
              name: kcRole.name,
              displayName: kcRole.attributes?.displayName?.[0] || kcRole.name,
              description: kcRole.description,
              permissions: kcRole.attributes?.permissions || [],
              composite: kcRole.composite ?? false,
            };
          }

          roles.push(role);
        } catch (error) {
          logger.warn('Failed to enrich role', {
            keycloakRoleId: kcRole.id,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      logger.info('Retrieved roles', { count: roles.length });
      return roles;
    } catch (error) {
      logger.error('Failed to list roles', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Get role by ID
   * 
   * Retrieves a specific role by database ID and enriches with
   * Keycloak data.
   * 
   * @param id - Database ID of the role
   * @returns Role with enriched data
   * @throws Error if role not found
   */
  async getRoleById(id: string): Promise<Role> {
    try {
      logger.debug('Fetching role by ID', { id });

      const dbResult = await this.database.query(
        'SELECT id, keycloak_role_id, name, display_name, description, permissions, created_at, updated_at FROM roles WHERE id = $1',
        [id]
      );

      if (dbResult.rows.length === 0) {
        throw new Error(`Role not found: ${id}`);
      }

      const role = this.mapDbRowToRole(dbResult.rows[0]);

      // Enrich with Keycloak data
      await this.kcAdmin.ensureAuthenticated();
      const client = this.kcAdmin.getClient();

      const kcRole = await client.roles.findOneByName({ name: role.name });

      if (kcRole) {
        role.composite = kcRole.composite ?? false;
      }

      logger.info('Retrieved role', { id: role.id });
      return role;
    } catch (error) {
      logger.error('Failed to get role by ID', {
        id,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Delete role
   * 
   * Deletes role from both systems:
   * 1. Removes realm role from Keycloak (cascades to remove user role mappings)
   * 2. Removes database record
   * 
   * @param id - Database ID of the role
   * @throws Error if deletion fails or role not found
   */
  async deleteRole(id: string): Promise<void> {
    try {
      // Get role to get Keycloak role ID and name
      const role = await this.getRoleById(id);

      await this.kcAdmin.ensureAuthenticated();
      const client = this.kcAdmin.getClient();

      // Delete from Keycloak first
      logger.info('Deleting Keycloak realm role', {
        roleId: role.keycloakRoleId,
        name: role.name,
        dbId: id,
      });

      await client.roles.delByName({ name: role.name });

      logger.info('Keycloak realm role deleted', { roleId: role.keycloakRoleId });

      // Delete from database
      logger.info('Deleting role from database', { id });

      await this.database.query('DELETE FROM roles WHERE id = $1', [id]);

      logger.info('Role deleted successfully', { id });
    } catch (error) {
      logger.error('Failed to delete role', {
        id,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Map database row to Role object
   * 
   * @param row - Database row
   * @returns Role object
   */
  private mapDbRowToRole(row: any): Role {
    return {
      id: row.id,
      keycloakRoleId: row.keycloak_role_id,
      name: row.name,
      displayName: row.display_name,
      description: row.description,
      permissions: typeof row.permissions === 'string' ? JSON.parse(row.permissions) : row.permissions,
      composite: false, // Will be enriched from Keycloak if needed
    };
  }
}
