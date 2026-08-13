import { db } from '../database/pool';
import { logger } from '../config/logger';
import {
  OrganizationAdminRole,
  CreateOrganizationAdminRoleDto,
  UpdateOrganizationAdminRoleDto
} from '../types/organization.types';
import { organizationService } from './organization.service';

/**
 * The automatically provisioned role. `name` is the stable identifier — the
 * display name is what an administrator sees and could in principle be
 * translated later without breaking the lookup.
 */
export const FULL_ADMINISTRATOR_ROLE = {
  name: 'full-administrator',
  displayName: 'Full Administrator',
  description: 'Full administrative access to every capability',
} as const;

export class OrganizationAdminRoleService {
  /**
   * Convert database row to OrganizationAdminRole object
   */
  private rowToRole(row: any): OrganizationAdminRole {
    return {
      id: row.id,
      organizationId: row.organization_id,
      keycloakRoleId: row.keycloak_role_id,
      name: row.name,
      displayName: row.display_name,
      description: row.description,
      capabilityPermissions: row.capability_permissions || {},
      isSystemRole: row.is_system_role,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  /**
   * Get all roles for an organization
   */
  async getRolesByOrganization(organizationId: string): Promise<OrganizationAdminRole[]> {
    try {
      const result = await db.query(
        'SELECT * FROM organization_admin_roles WHERE organization_id = $1 ORDER BY display_name',
        [organizationId]
      );

      return result.rows.map((row: any) => this.rowToRole(row));
    } catch (error) {
      logger.error('Error getting organization roles:', error);
      throw error;
    }
  }

  /**
   * Get role by ID
   */
  async getRoleById(id: string): Promise<OrganizationAdminRole | null> {
    try {
      const result = await db.query(
        'SELECT * FROM organization_admin_roles WHERE id = $1',
        [id]
      );

      if (result.rows.length === 0) {
        return null;
      }

      return this.rowToRole(result.rows[0]);
    } catch (error) {
      logger.error('Error getting role by ID:', error);
      throw error;
    }
  }

  /**
   * Get role by name within organization
   */
  async getRoleByName(
    organizationId: string,
    name: string
  ): Promise<OrganizationAdminRole | null> {
    try {
      const result = await db.query(
        'SELECT * FROM organization_admin_roles WHERE organization_id = $1 AND name = $2',
        [organizationId, name]
      );

      if (result.rows.length === 0) {
        return null;
      }

      return this.rowToRole(result.rows[0]);
    } catch (error) {
      logger.error('Error getting role by name:', error);
      throw error;
    }
  }

  /**
   * Create role
   */
  async createRole(
    organizationId: string,
    data: CreateOrganizationAdminRoleDto
  ): Promise<OrganizationAdminRole> {
    try {
      // Verify organization exists
      const org = await organizationService.getOrganizationById(organizationId);
      if (!org) {
        throw new Error('Organization not found');
      }

      // Check if role name already exists
      const existing = await this.getRoleByName(organizationId, data.name);
      if (existing) {
        throw new Error('Role with this name already exists in organization');
      }

      // Validate capability permissions against organization's enabled capabilities
      const invalidCapabilities = Object.keys(data.capabilityPermissions).filter(
        cap => !org.enabledCapabilities.includes(cap)
      );

      if (invalidCapabilities.length > 0) {
        throw new Error(
          `Capabilities not enabled for organization: ${invalidCapabilities.join(', ')}`
        );
      }

      const result = await db.query(
        `INSERT INTO organization_admin_roles 
         (organization_id, name, display_name, description, capability_permissions, is_system_role)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [
          organizationId,
          data.name,
          data.displayName,
          data.description,
          JSON.stringify(data.capabilityPermissions),
          false
        ]
      );

      logger.info(`Role created: ${data.name} for organization ${organizationId}`);
      return this.rowToRole(result.rows[0]);
    } catch (error) {
      logger.error('Error creating role:', error);
      throw error;
    }
  }

  /**
   * Update role
   */
  async updateRole(
    id: string,
    data: UpdateOrganizationAdminRoleDto
  ): Promise<OrganizationAdminRole> {
    try {
      const role = await this.getRoleById(id);
      if (!role) {
        throw new Error('Role not found');
      }

      if (role.isSystemRole) {
        throw new Error('Cannot update system role');
      }

      // Validate capability permissions if provided
      if (data.capabilityPermissions) {
        const org = await organizationService.getOrganizationById(role.organizationId);
        if (!org) {
          throw new Error('Organization not found');
        }

        const invalidCapabilities = Object.keys(data.capabilityPermissions).filter(
          cap => !org.enabledCapabilities.includes(cap)
        );

        if (invalidCapabilities.length > 0) {
          throw new Error(
            `Capabilities not enabled for organization: ${invalidCapabilities.join(', ')}`
          );
        }
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
      if (data.capabilityPermissions !== undefined) {
        updates.push(`capability_permissions = $${paramCount++}`);
        values.push(JSON.stringify(data.capabilityPermissions));
      }

      values.push(id);

      const result = await db.query(
        `UPDATE organization_admin_roles 
         SET ${updates.join(', ')}
         WHERE id = $${paramCount}
         RETURNING *`,
        values
      );

      logger.info(`Role updated: ${id}`);
      return this.rowToRole(result.rows[0]);
    } catch (error) {
      logger.error('Error updating role:', error);
      throw error;
    }
  }

  /**
   * Delete role
   */
  async deleteRole(id: string): Promise<void> {
    try {
      const role = await this.getRoleById(id);
      if (!role) {
        throw new Error('Role not found');
      }

      if (role.isSystemRole) {
        throw new Error('Cannot delete system role');
      }

      // Check if role is assigned to any users
      const userCount = await db.query(
        'SELECT COUNT(*) as count FROM organization_user_roles WHERE organization_admin_role_id = $1',
        [id]
      );

      if (parseInt(userCount.rows[0].count) > 0) {
        throw new Error('Cannot delete role that is assigned to users');
      }

      await db.query('DELETE FROM organization_admin_roles WHERE id = $1', [id]);

      logger.info(`Role deleted: ${id}`);
    } catch (error) {
      logger.error('Error deleting role:', error);
      throw error;
    }
  }

  /**
   * Get users assigned to a role
   */
  async getRoleUsers(roleId: string): Promise<string[]> {
    try {
      const result = await db.query(
        'SELECT organization_user_id FROM organization_user_roles WHERE organization_admin_role_id = $1',
        [roleId]
      );

      return result.rows.map((row: any) => row.organization_user_id);
    } catch (error) {
      logger.error('Error getting role users:', error);
      throw error;
    }
  }

  /**
   * Create default roles for an organization
   */
  /**
   * The role every organisation gets when it is created.
   *
   * "Full Administrator", with `admin` on **every capability that exists** —
   * not merely the ones the organisation currently has enabled.
   *
   * That distinction is the substance of this method. Access requires *both*
   * that the organisation has a capability enabled *and* that the user's role
   * permits it, so granting `admin` on a capability the organisation does not
   * have grants nothing today. What it does buy is that the role stays
   * genuinely full: when a super admin later enables another capability for the
   * organisation, its Full Administrator can use it immediately. Snapshotting
   * the enabled set instead would leave the role quietly unable to reach new
   * features — exactly the surprise its name promises against, and one that
   * surfaces as "why can't the administrator see the shop?" months later.
   *
   * Idempotent: `ON CONFLICT DO NOTHING` against the unique
   * `(organization_id, name)` key, so a retried organisation creation cannot
   * produce two roles with the same name. It deliberately does **not** update
   * an existing role — a club that has edited its Full Administrator's
   * permissions should not have them silently reset.
   */
  async ensureFullAdministratorRole(organizationId: string): Promise<void> {
    try {
      const capabilities = await db.query(
        `SELECT name FROM capabilities WHERE is_active = true ORDER BY name`
      );

      const permissions: Record<string, 'admin'> = {};
      capabilities.rows.forEach((row: { name: string }) => {
        permissions[row.name] = 'admin';
      });

      await db.query(
        `INSERT INTO organization_admin_roles
           (organization_id, name, display_name, description,
            capability_permissions, is_system_role, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, true, NOW(), NOW())
         ON CONFLICT (organization_id, name) DO NOTHING`,
        [
          organizationId,
          FULL_ADMINISTRATOR_ROLE.name,
          FULL_ADMINISTRATOR_ROLE.displayName,
          FULL_ADMINISTRATOR_ROLE.description,
          JSON.stringify(permissions),
        ]
      );

      logger.info('Full Administrator role ensured for organisation', { organizationId });
    } catch (error) {
      logger.error('Error creating the Full Administrator role:', error);
      throw error;
    }
  }

  async createDefaultRoles(organizationId: string): Promise<void> {
    try {
      const org = await organizationService.getOrganizationById(organizationId);
      if (!org) {
        throw new Error('Organization not found');
      }

      // Create full permissions object for all enabled capabilities
      const fullPermissions: Record<string, 'admin'> = {};
      org.enabledCapabilities.forEach(cap => {
        fullPermissions[cap] = 'admin';
      });

      // Create read-only permissions
      const readPermissions: Record<string, 'read'> = {};
      org.enabledCapabilities.forEach(cap => {
        readPermissions[cap] = 'read';
      });

      // Admin role
      await db.query(
        `INSERT INTO organization_admin_roles 
         (organization_id, name, display_name, description, capability_permissions, is_system_role)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          organizationId,
          'admin',
          'Administrator',
          'Full access to all capabilities',
          JSON.stringify(fullPermissions),
          true
        ]
      );

      // Viewer role
      await db.query(
        `INSERT INTO organization_admin_roles 
         (organization_id, name, display_name, description, capability_permissions, is_system_role)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          organizationId,
          'viewer',
          'Viewer',
          'Read-only access to all capabilities',
          JSON.stringify(readPermissions),
          true
        ]
      );

      logger.info(`Default roles created for organization: ${organizationId}`);
    } catch (error) {
      logger.error('Error creating default roles:', error);
      throw error;
    }
  }
}

export const organizationAdminRoleService = new OrganizationAdminRoleService();
