import crypto from 'crypto';
import { db } from '../database/pool';
import { logger } from '../config/logger';
import { KeycloakAdminService } from './keycloak-admin.service';
import { sendAdminAddedToOrganisationEmail, sendAdminInviteEmail } from './email.service';

function generateTemporaryPassword(): string {
  return crypto.randomBytes(12).toString('base64url');
}

/**
 * Data Transfer Objects for Org Admin User operations
 */
export interface CreateOrgAdminUserDto {
  email: string;
  firstName: string;
  lastName: string;
  temporaryPassword?: string;
  roleIds?: string[];
}

export interface UpdateOrgAdminUserDto {
  firstName?: string;
  lastName?: string;
  status?: 'active' | 'inactive';
}

export interface OrgAdminUser {
  id: string;
  organizationId: string;
  keycloakUserId: string;
  email: string;
  firstName: string;
  lastName: string;
  status: 'active' | 'inactive';
  roles: string[];
  roleIds: string[];
  lastLogin?: Date;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Service for managing organization admin users
 * 
 * This service manages admin users who access the orgadmin UI.
 * Admin users can manage organization settings, configure modules,
 * and have role-based permissions.
 * 
 * Key Features:
 * - Creates admin user in Keycloak and database
 * - Adds user to organization's admins group
 * - Assigns organization-specific roles
 * - Manages user status and permissions
 */
export class OrgAdminUserService {
  constructor(private kcAdmin: KeycloakAdminService) {}

  /**
   * Convert database row to OrgAdminUser object
   */
  private async rowToOrgAdminUser(row: any): Promise<OrgAdminUser> {
    // Get user roles
    const rolesResult = await db.query(
      `SELECT oar.id, oar.name
       FROM organization_user_roles our
       JOIN organization_admin_roles oar ON our.organization_admin_role_id = oar.id
       WHERE our.organization_user_id = $1`,
      [row.id]
    );

    return {
      id: row.id,
      organizationId: row.organization_id,
      keycloakUserId: row.keycloak_user_id,
      email: row.email,
      firstName: row.first_name,
      lastName: row.last_name,
      status: row.status,
      roles: rolesResult.rows.map((r: any) => r.name),
      roleIds: rolesResult.rows.map((r: any) => r.id),
      lastLogin: row.last_login,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * Get all admin users for an organization
   * 
   * @param organizationId - Organization ID
   * @returns Array of admin users with their roles
   */
  async getAdminUsersByOrganisation(organizationId: string): Promise<OrgAdminUser[]> {
    try {
      logger.debug('Fetching admin users for organization', { organizationId });

      const result = await db.query(
        `SELECT * FROM organization_users
         WHERE organization_id = $1 AND user_type = 'org-admin'
         ORDER BY created_at DESC`,
        [organizationId]
      );

      const users: OrgAdminUser[] = [];
      for (const row of result.rows) {
        users.push(await this.rowToOrgAdminUser(row));
      }

      logger.info('Retrieved admin users', { 
        organizationId, 
        count: users.length 
      });

      return users;
    } catch (error) {
      logger.error('Error getting admin users', { 
        organizationId,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Create organization admin user
   * 
   * Creates an admin user by:
   * 1. Creating the user in Keycloak with profile and credentials
   * 2. Adding user to organization's admins group
   * 3. Storing user record in PostgreSQL
   * 4. Assigning specified roles
   * 
   * @param organizationId - Organization ID
   * @param data - User creation data
   * @param createdBy - ID of user creating this admin user
   * @returns Created admin user
   * @throws Error if creation fails
   */
  async createAdminUser(
    organizationId: string,
    data: CreateOrgAdminUserDto,
    createdBy?: string
  ): Promise<OrgAdminUser> {
    let keycloakUserId: string | null = null;
    /*
     * Only set when *this* call created the identity, so the rollback below
     * cannot delete an administrator who already existed and belongs to other
     * organisations.
     */
    let createdKeycloakUserId: string | null = null;

    try {
      // Verify organization exists and get Keycloak group ID
      const orgResult = await db.query(
        'SELECT id, display_name, keycloak_group_id FROM organizations WHERE id = $1',
        [organizationId]
      );

      if (orgResult.rows.length === 0) {
        throw new Error(`Organization not found: ${organizationId}`);
      }

      const keycloakGroupId = orgResult.rows[0].keycloak_group_id;
      const organizationName = orgResult.rows[0].display_name || 'the organization';

      // Check if user already exists in this organization
      const existingResult = await db.query(
        'SELECT id FROM organization_users WHERE organization_id = $1 AND email = $2',
        [organizationId, data.email]
      );

      if (existingResult.rows.length > 0) {
        throw Object.assign(new Error('User with this email already exists in organization'), { statusCode: 409 });
      }

      // Create user in Keycloak
      await this.kcAdmin.ensureAuthenticated();
      const client = this.kcAdmin.getClient();

      logger.info('Creating Keycloak admin user', { 
        email: data.email,
        organizationId 
      });

      // Generate a temporary password if not provided
      const temporaryPassword = data.temporaryPassword || generateTemporaryPassword();

      /*
       * Adopt the identity if it already exists; only create when it does not.
       *
       * A Keycloak username must be unique in the realm and this platform uses
       * the email address as the username, so somebody who already administers
       * one club — or is a member of one — cannot be given a second Keycloak
       * user. `users.create` was called unconditionally, which meant adding an
       * existing person to a second organisation failed at Keycloak with a 409
       * and the per-organisation duplicate check above never got to matter.
       *
       * Adopting is also the *right* answer rather than a workaround: it is one
       * person, and they keep one password, one email address and one set of
       * credential-change flows. Two Keycloak users sharing an address would be
       * two passwords that drift apart.
       *
       * The seed has always done this (`upsertUser`); this is the same idea in
       * the path administrators actually use.
       */
      const existingKeycloak = await client.users.find({ username: data.email, exact: true });
      const adopted = existingKeycloak.length > 0;

      if (adopted) {
        keycloakUserId = existingKeycloak[0].id!;
        logger.info('Adopting an existing Keycloak identity for a second organisation', {
          keycloakUserId,
          organizationId,
        });
      } else {
        const kcUser = await client.users.create({
          email: data.email,
          firstName: data.firstName,
          lastName: data.lastName,
          enabled: true,
          emailVerified: false,
          username: data.email,
          credentials: [{
            type: 'password',
            value: temporaryPassword,
            temporary: true
          }]
        });

        if (!kcUser.id) {
          throw new Error('Failed to create user in Keycloak');
        }

        keycloakUserId = kcUser.id;
        createdKeycloakUserId = kcUser.id;

        logger.info('Keycloak admin user created', { 
          keycloakUserId,
          email: data.email 
        });
      }

      // Add user to organization's admins group
      logger.debug('Adding user to organization admins group', { 
        keycloakUserId,
        keycloakGroupId 
      });

      // Find admins subgroup
      const subgroups = await client.groups.listSubGroups({ parentId: keycloakGroupId });
      const adminsGroup = subgroups.find((g: any) => g.name === 'admins');
      
      if (!adminsGroup || !adminsGroup.id) {
        throw new Error('Admins group not found for organization');
      }

      await client.users.addToGroup({
        id: keycloakUserId,
        groupId: adminsGroup.id
      });

      logger.info('User added to admins group', { keycloakUserId });

      // Store user in database
      logger.info('Creating admin user record in database', { 
        keycloakUserId,
        organizationId 
      });

      const dbResult = await db.query(
        `INSERT INTO organization_users 
         (organization_id, keycloak_user_id, user_type, email, first_name, last_name, status, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [
          organizationId,
          keycloakUserId,
          'org-admin',
          data.email,
          data.firstName,
          data.lastName,
          'active',
          createdBy
        ]
      );

      const user = await this.rowToOrgAdminUser(dbResult.rows[0]);

      /*
       * Which mail to send, decided once rather than at each of the two exits.
       *
       * An adopted identity must not be sent a temporary password: they have a
       * password, and the invitation email's whole shape — "here are your
       * credentials, you will be asked to change them" — is wrong for somebody
       * who has been signing in for a year. Non-blocking either way; the
       * administrator exists whether or not the mail lands.
       */
      const announce = () => {
        if (adopted) {
          sendAdminAddedToOrganisationEmail({
            toEmail: data.email,
            firstName: data.firstName,
            organizationName,
          });
        } else {
          sendAdminInviteEmail({
            toEmail: data.email,
            firstName: data.firstName,
            lastName: data.lastName,
            organizationName,
            temporaryPassword,
          });
        }
      };

      // Assign roles if provided
      if (data.roleIds && data.roleIds.length > 0) {
        logger.debug('Assigning roles to admin user', { 
          userId: user.id,
          roleIds: data.roleIds 
        });

        for (const roleId of data.roleIds) {
          await this.assignRoles(user.id, [roleId], createdBy);
        }

        // Refresh user to get updated roles
        const updatedResult = await db.query(
          'SELECT * FROM organization_users WHERE id = $1',
          [user.id]
        );
        const updatedUser = await this.rowToOrgAdminUser(updatedResult.rows[0]);

        announce();

        return updatedUser;
      }

      announce();

      logger.info('Admin user created successfully', { 
        id: user.id,
        email: user.email 
      });

      return user;
    } catch (error) {
      logger.error('Failed to create admin user', { 
        organizationId,
        email: data.email,
        error: error instanceof Error ? error.message : String(error)
      });

      /*
       * Roll back only what this call created.
       *
       * `keycloakUserId` may now be an identity that already existed and
       * administers other organisations — deleting it because *this*
       * organisation's insert failed would sign them out of every club they
       * belong to, over an error that had nothing to do with them.
       */
      if (createdKeycloakUserId) {
        try {
          await this.kcAdmin.ensureAuthenticated();
          const client = this.kcAdmin.getClient();
          await client.users.del({ id: createdKeycloakUserId });
          logger.info('Rolled back Keycloak user', { userId: createdKeycloakUserId });
        } catch (rollbackError) {
          logger.error('Failed to rollback Keycloak user', { 
            userId: createdKeycloakUserId,
            error: rollbackError instanceof Error ? rollbackError.message : String(rollbackError)
          });
        }
      }

      throw error;
    }
  }

  /**
   * Update admin user
   * 
   * Updates user in both Keycloak and database.
   * 
   * @param id - Database ID of the user
   * @param updates - Fields to update
   * @returns Updated user
   * @throws Error if update fails or user not found
   */
  async updateAdminUser(id: string, updates: UpdateOrgAdminUserDto): Promise<OrgAdminUser> {
    try {
      logger.info('Updating admin user', { id, updates });

      // Get current user
      const currentResult = await db.query(
        'SELECT * FROM organization_users WHERE id = $1 AND user_type = $2',
        [id, 'org-admin']
      );

      if (currentResult.rows.length === 0) {
        throw new Error('Admin user not found');
      }

      const currentUser = currentResult.rows[0];

      // Update Keycloak user if name changed
      if (updates.firstName || updates.lastName) {
        try {
          await this.kcAdmin.ensureAuthenticated();
          const client = this.kcAdmin.getClient();
          await client.users.update(
            { id: currentUser.keycloak_user_id },
            {
              firstName: updates.firstName || currentUser.first_name,
              lastName: updates.lastName || currentUser.last_name,
              enabled: updates.status === 'active'
            }
          );
          logger.info('Keycloak user updated', { 
            keycloakUserId: currentUser.keycloak_user_id 
          });
        } catch (kcError) {
          logger.warn('Failed to update user in Keycloak', { 
            keycloakUserId: currentUser.keycloak_user_id,
            error: kcError instanceof Error ? kcError.message : String(kcError)
          });
        }
      }

      // Update database record
      const updateFields: string[] = ['updated_at = NOW()'];
      const updateValues: any[] = [];
      let paramCount = 1;

      if (updates.firstName !== undefined) {
        updateFields.push(`first_name = $${paramCount++}`);
        updateValues.push(updates.firstName);
      }
      if (updates.lastName !== undefined) {
        updateFields.push(`last_name = $${paramCount++}`);
        updateValues.push(updates.lastName);
      }
      if (updates.status !== undefined) {
        updateFields.push(`status = $${paramCount++}`);
        updateValues.push(updates.status);
      }

      updateValues.push(id);

      const dbResult = await db.query(
        `UPDATE organization_users 
         SET ${updateFields.join(', ')}
         WHERE id = $${paramCount}
         RETURNING *`,
        updateValues
      );

      const user = await this.rowToOrgAdminUser(dbResult.rows[0]);

      logger.info('Admin user updated successfully', { id: user.id });
      return user;
    } catch (error) {
      logger.error('Failed to update admin user', { 
        id,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Delete admin user
   * 
   * Deletes user from both Keycloak and database.
   * 
   * @param id - Database ID of the user
   * @throws Error if deletion fails or user not found
   */
  async deleteAdminUser(id: string): Promise<void> {
    try {
      logger.info('Deleting admin user', { id });

      // Get user to get Keycloak user ID
      const result = await db.query(
        'SELECT * FROM organization_users WHERE id = $1 AND user_type = $2',
        [id, 'org-admin']
      );

      if (result.rows.length === 0) {
        throw new Error('Admin user not found');
      }

      const user = result.rows[0];

      /*
       * The identity survives unless this was its last row.
       *
       * Removing somebody from one club must not sign them out of the others.
       * The Keycloak user is the person; the `organization_users` row is their
       * membership of *this* organisation, and deleting the first because the
       * second went would lock an administrator out of every club they belong
       * to — and, if they are also a member somewhere, out of the member app.
       *
       * Counted across `user_type` deliberately: an account-user row is the
       * same person, and their membership of a club is reason enough to keep
       * the identity alive.
       */
      const elsewhere = await db.query(
        `SELECT 1 FROM organization_users
          WHERE keycloak_user_id = $1::text AND id <> $2::uuid
          LIMIT 1`,
        [user.keycloak_user_id, id]
      );

      if (elsewhere.rows.length > 0) {
        logger.info('Keeping the Keycloak identity; it is used elsewhere', {
          keycloakUserId: user.keycloak_user_id,
        });
      } else {
        try {
          await this.kcAdmin.ensureAuthenticated();
          const client = this.kcAdmin.getClient();
          await client.users.del({ id: user.keycloak_user_id });
          logger.info('Keycloak user deleted', { 
            keycloakUserId: user.keycloak_user_id 
          });
        } catch (kcError) {
          logger.warn('Failed to delete user from Keycloak', { 
            keycloakUserId: user.keycloak_user_id,
            error: kcError instanceof Error ? kcError.message : String(kcError)
          });
        }
      }

      // Delete from database (cascade will handle role assignments)
      await db.query(
        'DELETE FROM organization_users WHERE id = $1',
        [id]
      );

      logger.info('Admin user deleted successfully', { id });
    } catch (error) {
      logger.error('Failed to delete admin user', { 
        id,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Sync roles for admin user (replace all existing roles with new set)
   */
  async syncRoles(
    userId: string,
    roleIds: string[],
    assignedBy?: string
  ): Promise<void> {
    try {
      logger.debug('Syncing roles for admin user', { userId, roleIds });

      // Verify user exists and is an admin
      const userResult = await db.query(
        'SELECT id FROM organization_users WHERE id = $1 AND user_type = $2',
        [userId, 'org-admin']
      );

      if (userResult.rows.length === 0) {
        throw new Error('Admin user not found');
      }

      // Remove all existing role assignments
      await db.query(
        'DELETE FROM organization_user_roles WHERE organization_user_id = $1',
        [userId]
      );

      // Assign new roles
      for (const roleId of roleIds) {
        await db.query(
          `INSERT INTO organization_user_roles 
           (organization_user_id, organization_admin_role_id, assigned_by)
           VALUES ($1, $2, $3)`,
          [userId, roleId, assignedBy]
        );
      }

      logger.info('Roles synced successfully', { userId, roleIds });
    } catch (error) {
      logger.error('Failed to sync roles', { 
        userId,
        roleIds,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Assign roles to admin user
   * 
   * Assigns organization-specific roles to the admin user.
   * 
   * @param userId - Database ID of the user
   * @param roleIds - Array of role IDs to assign
   * @param assignedBy - ID of user assigning the roles
   * @throws Error if assignment fails
   */
  async assignRoles(
    userId: string,
    roleIds: string[],
    assignedBy?: string
  ): Promise<void> {
    try {
      logger.debug('Assigning roles to admin user', { userId, roleIds });

      // Verify user exists and is an admin
      const userResult = await db.query(
        'SELECT id FROM organization_users WHERE id = $1 AND user_type = $2',
        [userId, 'org-admin']
      );

      if (userResult.rows.length === 0) {
        throw new Error('Admin user not found');
      }

      // Assign each role
      for (const roleId of roleIds) {
        // Check if assignment already exists
        const existingResult = await db.query(
          `SELECT id FROM organization_user_roles 
           WHERE organization_user_id = $1 AND organization_admin_role_id = $2`,
          [userId, roleId]
        );

        if (existingResult.rows.length === 0) {
          // Create new assignment
          await db.query(
            `INSERT INTO organization_user_roles 
             (organization_user_id, organization_admin_role_id, assigned_by)
             VALUES ($1, $2, $3)`,
            [userId, roleId, assignedBy]
          );

          logger.debug('Role assigned', { userId, roleId });
        }
      }

      logger.info('Roles assigned successfully', { userId, roleIds });
    } catch (error) {
      logger.error('Failed to assign roles', { 
        userId,
        roleIds,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Remove role from admin user
   * 
   * @param userId - Database ID of the user
   * @param roleId - Role ID to remove
   * @throws Error if removal fails
   */
  async removeRole(userId: string, roleId: string): Promise<void> {
    try {
      logger.debug('Removing role from admin user', { userId, roleId });

      await db.query(
        `DELETE FROM organization_user_roles 
         WHERE organization_user_id = $1 AND organization_admin_role_id = $2`,
        [userId, roleId]
      );

      logger.info('Role removed successfully', { userId, roleId });
    } catch (error) {
      logger.error('Failed to remove role', { 
        userId,
        roleId,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Resend invitation to an admin user who hasn't activated their account.
   * Generates a new temporary password and sends a reminder email.
   */
  async resendInvite(userId: string): Promise<void> {
    try {
      logger.info('Resending invite for admin user', { userId });

      // Get user and organization details
      const result = await db.query(
        `SELECT ou.*, o.display_name as organization_name
         FROM organization_users ou
         JOIN organizations o ON o.id = ou.organization_id
         WHERE ou.id = $1 AND ou.user_type = 'org-admin'`,
        [userId]
      );

      if (result.rows.length === 0) {
        throw new Error('Admin user not found');
      }

      const row = result.rows[0];

      // Check if user has already logged in
      if (row.last_login) {
        throw Object.assign(
          new Error('User has already activated their account'),
          { statusCode: 400 }
        );
      }

      // Generate new temporary password
      const temporaryPassword = generateTemporaryPassword();

      // Reset password in Keycloak with temporary flag
      await this.kcAdmin.ensureAuthenticated();
      const client = this.kcAdmin.getClient();

      await client.users.resetPassword({
        id: row.keycloak_user_id,
        credential: {
          type: 'password',
          value: temporaryPassword,
          temporary: true,
        },
      });

      // Send reminder email
      const { sendResendInviteEmail } = await import('./email.service');
      await sendResendInviteEmail({
        toEmail: row.email,
        firstName: row.first_name,
        organizationName: row.organization_name || 'the organization',
        temporaryPassword,
      });

      logger.info('Invite resent successfully', { userId });
    } catch (error) {
      logger.error('Failed to resend invite', {
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Reset admin user password
   * 
   * @param userId - Database ID of the user
   * @param newPassword - New password
   * @throws Error if reset fails
   */
  async resetPassword(userId: string, newPassword: string): Promise<void> {
    try {
      logger.info('Resetting admin user password', { userId });

      // Get user to get Keycloak user ID
      const result = await db.query(
        'SELECT keycloak_user_id FROM organization_users WHERE id = $1 AND user_type = $2',
        [userId, 'org-admin']
      );

      if (result.rows.length === 0) {
        throw new Error('Admin user not found');
      }

      const keycloakUserId = result.rows[0].keycloak_user_id;

      await this.kcAdmin.ensureAuthenticated();
      const client = this.kcAdmin.getClient();

      await client.users.resetPassword({
        id: keycloakUserId,
        credential: {
          type: 'password',
          value: newPassword,
          temporary: true
        }
      });

      logger.info('Password reset successfully', { userId });
    } catch (error) {
      logger.error('Failed to reset password', { 
        userId,
        error: error instanceof Error ? error.message : String(error)
      });
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
export const orgAdminUserService = new OrgAdminUserService(kcAdmin);
