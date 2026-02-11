import { db } from '../database/pool';
import { logger } from '../config/logger';
import {
  OrganizationUser,
  CreateOrganizationUserDto,
  CreateOrganizationAdminUserDto,
  UpdateOrganizationUserDto,
  UserType
} from '../types/organization.types';
import { KeycloakAdminService } from './keycloak-admin.service';
import { organizationService } from './organization.service';

export class OrganizationUserService {
  constructor(private kcAdmin: KeycloakAdminService) {}

  /**
   * Convert database row to OrganizationUser object
   */
  private rowToOrganizationUser(row: any): OrganizationUser {
    return {
      id: row.id,
      organizationId: row.organization_id,
      keycloakUserId: row.keycloak_user_id,
      userType: row.user_type,
      email: row.email,
      firstName: row.first_name,
      lastName: row.last_name,
      status: row.status,
      lastLogin: row.last_login,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      createdBy: row.created_by
    };
  }

  /**
   * Get all users for an organization
   */
  async getUsersByOrganization(
    organizationId: string,
    userType?: UserType
  ): Promise<OrganizationUser[]> {
    try {
      let query = `
        SELECT ou.*, 
               array_agg(DISTINCT oar.id) FILTER (WHERE oar.id IS NOT NULL) as role_ids
        FROM organization_users ou
        LEFT JOIN organization_user_roles our ON ou.id = our.organization_user_id
        LEFT JOIN organization_admin_roles oar ON our.organization_admin_role_id = oar.id
        WHERE ou.organization_id = $1
      `;
      const params: any[] = [organizationId];

      if (userType) {
        query += ' AND ou.user_type = $2';
        params.push(userType);
      }

      query += ' GROUP BY ou.id ORDER BY ou.created_at DESC';

      const result = await db.query(query, params);
      return result.rows.map((row: any) => this.rowToOrganizationUser(row));
    } catch (error) {
      logger.error('Error getting organization users:', error);
      throw error;
    }
  }

  /**
   * Get user by ID
   */
  async getUserById(id: string): Promise<OrganizationUser | null> {
    try {
      const result = await db.query(
        'SELECT * FROM organization_users WHERE id = $1',
        [id]
      );

      if (result.rows.length === 0) {
        return null;
      }

      return this.rowToOrganizationUser(result.rows[0]);
    } catch (error) {
      logger.error('Error getting user by ID:', error);
      throw error;
    }
  }

  /**
   * Get user by email within organization
   */
  async getUserByEmail(
    organizationId: string,
    email: string
  ): Promise<OrganizationUser | null> {
    try {
      const result = await db.query(
        'SELECT * FROM organization_users WHERE organization_id = $1 AND email = $2',
        [organizationId, email]
      );

      if (result.rows.length === 0) {
        return null;
      }

      return this.rowToOrganizationUser(result.rows[0]);
    } catch (error) {
      logger.error('Error getting user by email:', error);
      throw error;
    }
  }

  /**
   * Create organization admin user with Keycloak integration
   */
  async createAdminUser(
    organizationId: string,
    data: CreateOrganizationAdminUserDto,
    createdBy?: string
  ): Promise<OrganizationUser> {
    try {
      // Verify organization exists
      const org = await organizationService.getOrganizationById(organizationId);
      if (!org) {
        throw new Error('Organization not found');
      }

      // Check if user already exists
      const existing = await this.getUserByEmail(organizationId, data.email);
      if (existing) {
        throw new Error('User with this email already exists in organization');
      }

      // Create user in Keycloak
      await this.kcAdmin.ensureAuthenticated();
      const client = this.kcAdmin.getClient();

      const kcUser = await client.users.create({
        email: data.email,
        firstName: data.firstName,
        lastName: data.lastName,
        enabled: true,
        emailVerified: false,
        username: data.email,
        credentials: data.temporaryPassword ? [{
          type: 'password',
          value: data.temporaryPassword,
          temporary: true
        }] : undefined
      });

      if (!kcUser.id) {
        throw new Error('Failed to create user in Keycloak');
      }

      // Add user to organization's admins group
      const orgGroup = await client.groups.findOne({ id: org.keycloakGroupId });
      if (!orgGroup) {
        throw new Error('Organization group not found in Keycloak');
      }

      // Find admins subgroup
      const subgroups = await client.groups.listSubGroups({ parentId: org.keycloakGroupId });
      const adminsGroup = subgroups.find((g: any) => g.name === 'admins');
      
      if (!adminsGroup) {
        throw new Error('Admins group not found');
      }

      await client.users.addToGroup({
        id: kcUser.id,
        groupId: adminsGroup.id!
      });

      // Insert into database
      const result = await db.query(
        `INSERT INTO organization_users 
         (organization_id, keycloak_user_id, user_type, email, first_name, last_name, status, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [
          organizationId,
          kcUser.id,
          'org-admin',
          data.email,
          data.firstName,
          data.lastName,
          'active',
          createdBy
        ]
      );

      const user = this.rowToOrganizationUser(result.rows[0]);

      // Assign role if provided
      if (data.roleId) {
        await this.assignRole(user.id, data.roleId, createdBy);
      }

      logger.info(`Admin user created: ${data.email} for organization ${organizationId}`);
      return user;
    } catch (error) {
      logger.error('Error creating admin user:', error);
      throw error;
    }
  }

  /**
   * Create account user (simplified - no Keycloak for now)
   */
  async createAccountUser(
    organizationId: string,
    data: CreateOrganizationUserDto,
    createdBy?: string
  ): Promise<OrganizationUser> {
    try {
      // Verify organization exists
      const org = await organizationService.getOrganizationById(organizationId);
      if (!org) {
        throw new Error('Organization not found');
      }

      // Check if user already exists
      const existing = await this.getUserByEmail(organizationId, data.email);
      if (existing) {
        throw new Error('User with this email already exists in organization');
      }

      // For account users, we'll create a simpler Keycloak user
      await this.kcAdmin.ensureAuthenticated();
      const client = this.kcAdmin.getClient();

      const kcUser = await client.users.create({
        email: data.email,
        firstName: data.firstName,
        lastName: data.lastName,
        enabled: true,
        emailVerified: false,
        username: data.email,
        credentials: data.temporaryPassword ? [{
          type: 'password',
          value: data.temporaryPassword,
          temporary: true
        }] : undefined
      });

      if (!kcUser.id) {
        throw new Error('Failed to create user in Keycloak');
      }

      // Add user to organization's members group
      const subgroups = await client.groups.listSubGroups({ parentId: org.keycloakGroupId });
      const membersGroup = subgroups.find((g: any) => g.name === 'members');
      
      if (membersGroup) {
        await client.users.addToGroup({
          id: kcUser.id,
          groupId: membersGroup.id!
        });
      }

      // Insert into database
      const result = await db.query(
        `INSERT INTO organization_users 
         (organization_id, keycloak_user_id, user_type, email, first_name, last_name, status, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [
          organizationId,
          kcUser.id,
          'account-user',
          data.email,
          data.firstName,
          data.lastName,
          'active',
          createdBy
        ]
      );

      logger.info(`Account user created: ${data.email} for organization ${organizationId}`);
      return this.rowToOrganizationUser(result.rows[0]);
    } catch (error) {
      logger.error('Error creating account user:', error);
      throw error;
    }
  }

  /**
   * Update user
   */
  async updateUser(
    id: string,
    data: UpdateOrganizationUserDto,
    _updatedBy?: string
  ): Promise<OrganizationUser> {
    try {
      const user = await this.getUserById(id);
      if (!user) {
        throw new Error('User not found');
      }

      const updates: string[] = ['updated_at = NOW()'];
      const values: any[] = [];
      let paramCount = 1;

      if (data.firstName !== undefined) {
        updates.push(`first_name = $${paramCount++}`);
        values.push(data.firstName);
      }
      if (data.lastName !== undefined) {
        updates.push(`last_name = $${paramCount++}`);
        values.push(data.lastName);
      }
      if (data.status !== undefined) {
        updates.push(`status = $${paramCount++}`);
        values.push(data.status);
      }

      values.push(id);

      const result = await db.query(
        `UPDATE organization_users 
         SET ${updates.join(', ')}
         WHERE id = $${paramCount}
         RETURNING *`,
        values
      );

      // Update in Keycloak if name changed
      if (data.firstName || data.lastName) {
        try {
          await this.kcAdmin.ensureAuthenticated();
          const client = this.kcAdmin.getClient();
          await client.users.update(
            { id: user.keycloakUserId },
            {
              firstName: data.firstName || user.firstName,
              lastName: data.lastName || user.lastName
            }
          );
        } catch (kcError) {
          logger.warn('Failed to update user in Keycloak:', kcError);
        }
      }

      logger.info(`User updated: ${id}`);
      return this.rowToOrganizationUser(result.rows[0]);
    } catch (error) {
      logger.error('Error updating user:', error);
      throw error;
    }
  }

  /**
   * Delete user
   */
  async deleteUser(id: string): Promise<void> {
    try {
      const user = await this.getUserById(id);
      if (!user) {
        throw new Error('User not found');
      }

      // Delete from Keycloak
      try {
        await this.kcAdmin.ensureAuthenticated();
        const client = this.kcAdmin.getClient();
        await client.users.del({ id: user.keycloakUserId });
      } catch (kcError) {
        logger.warn('Failed to delete user from Keycloak:', kcError);
      }

      // Delete from database (cascade will handle role assignments)
      await db.query('DELETE FROM organization_users WHERE id = $1', [id]);

      logger.info(`User deleted: ${id}`);
    } catch (error) {
      logger.error('Error deleting user:', error);
      throw error;
    }
  }

  /**
   * Assign role to user
   */
  async assignRole(
    userId: string,
    roleId: string,
    assignedBy?: string
  ): Promise<void> {
    try {
      // Check if assignment already exists
      const existing = await db.query(
        'SELECT id FROM organization_user_roles WHERE organization_user_id = $1 AND organization_admin_role_id = $2',
        [userId, roleId]
      );

      if (existing.rows.length > 0) {
        return; // Already assigned
      }

      await db.query(
        `INSERT INTO organization_user_roles 
         (organization_user_id, organization_admin_role_id, assigned_by)
         VALUES ($1, $2, $3)`,
        [userId, roleId, assignedBy]
      );

      logger.info(`Role ${roleId} assigned to user ${userId}`);
    } catch (error) {
      logger.error('Error assigning role:', error);
      throw error;
    }
  }

  /**
   * Remove role from user
   */
  async removeRole(userId: string, roleId: string): Promise<void> {
    try {
      await db.query(
        'DELETE FROM organization_user_roles WHERE organization_user_id = $1 AND organization_admin_role_id = $2',
        [userId, roleId]
      );

      logger.info(`Role ${roleId} removed from user ${userId}`);
    } catch (error) {
      logger.error('Error removing role:', error);
      throw error;
    }
  }

  /**
   * Get user's roles
   */
  async getUserRoles(userId: string): Promise<string[]> {
    try {
      const result = await db.query(
        'SELECT organization_admin_role_id FROM organization_user_roles WHERE organization_user_id = $1',
        [userId]
      );

      return result.rows.map((row: any) => row.organization_admin_role_id);
    } catch (error) {
      logger.error('Error getting user roles:', error);
      throw error;
    }
  }

  /**
   * Reset user password
   */
  async resetPassword(userId: string, newPassword: string): Promise<void> {
    try {
      const user = await this.getUserById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      await this.kcAdmin.ensureAuthenticated();
      const client = this.kcAdmin.getClient();

      await client.users.resetPassword({
        id: user.keycloakUserId,
        credential: {
          type: 'password',
          value: newPassword,
          temporary: true
        }
      });

      logger.info(`Password reset for user: ${userId}`);
    } catch (error) {
      logger.error('Error resetting password:', error);
      throw error;
    }
  }
}

// Create singleton instance
const kcAdminConfig = {
  baseUrl: process.env.KEYCLOAK_URL || 'http://localhost:8080',
  realmName: process.env.KEYCLOAK_REALM || 'master',
  clientId: process.env.KEYCLOAK_CLIENT_ID || 'admin-cli',
  clientSecret: process.env.KEYCLOAK_CLIENT_SECRET || '',
};

const kcAdmin = KeycloakAdminService.getInstance(kcAdminConfig);
export const organizationUserService = new OrganizationUserService(kcAdmin);
