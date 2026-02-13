import { db } from '../database/pool';
import { logger } from '../config/logger';
import { KeycloakAdminService } from './keycloak-admin.service';

/**
 * Data Transfer Objects for Account User operations
 */
export interface CreateAccountUserDto {
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  temporaryPassword?: string;
}

export interface UpdateAccountUserDto {
  firstName?: string;
  lastName?: string;
  phone?: string;
  status?: 'active' | 'inactive';
}

export interface AccountUser {
  id: string;
  organizationId: string;
  keycloakUserId: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  status: 'active' | 'inactive';
  lastLogin?: Date;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Service for managing account users
 * 
 * This service manages account users who access the accountuser UI (future).
 * Account users are organization members who can:
 * - Enter events
 * - Purchase merchandise
 * - Make calendar bookings
 * - Register items
 * 
 * Key Features:
 * - Creates account user in Keycloak and database
 * - Adds user to organization's members group
 * - Manages user status and profile
 * - No role assignments (simpler than admin users)
 */
export class AccountUserService {
  constructor(private kcAdmin: KeycloakAdminService) {}

  /**
   * Convert database row to AccountUser object
   */
  private rowToAccountUser(row: any): AccountUser {
    return {
      id: row.id,
      organizationId: row.organization_id,
      keycloakUserId: row.keycloak_user_id,
      email: row.email,
      firstName: row.first_name,
      lastName: row.last_name,
      phone: row.phone,
      status: row.status,
      lastLogin: row.last_login,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * Get all account users for an organization
   * 
   * @param organizationId - Organization ID
   * @returns Array of account users
   */
  async getAccountUsersByOrganisation(organizationId: string): Promise<AccountUser[]> {
    try {
      logger.debug('Fetching account users for organization', { organizationId });

      const result = await db.query(
        `SELECT * FROM organization_users
         WHERE organization_id = $1 AND user_type = 'account-user'
         ORDER BY created_at DESC`,
        [organizationId]
      );

      const users = result.rows.map((row: any) => this.rowToAccountUser(row));

      logger.info('Retrieved account users', { 
        organizationId, 
        count: users.length 
      });

      return users;
    } catch (error) {
      logger.error('Error getting account users', { 
        organizationId,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Create account user
   * 
   * Creates an account user by:
   * 1. Creating the user in Keycloak with profile and credentials
   * 2. Adding user to organization's members group
   * 3. Storing user record in PostgreSQL
   * 
   * @param organizationId - Organization ID
   * @param data - User creation data
   * @param createdBy - ID of user creating this account user
   * @returns Created account user
   * @throws Error if creation fails
   */
  async createAccountUser(
    organizationId: string,
    data: CreateAccountUserDto,
    createdBy?: string
  ): Promise<AccountUser> {
    let keycloakUserId: string | null = null;

    try {
      // Verify organization exists and get Keycloak group ID
      const orgResult = await db.query(
        'SELECT id, keycloak_group_id FROM organizations WHERE id = $1',
        [organizationId]
      );

      if (orgResult.rows.length === 0) {
        throw new Error(`Organization not found: ${organizationId}`);
      }

      const keycloakGroupId = orgResult.rows[0].keycloak_group_id;

      // Check if user already exists in this organization
      const existingResult = await db.query(
        'SELECT id FROM organization_users WHERE organization_id = $1 AND email = $2',
        [organizationId, data.email]
      );

      if (existingResult.rows.length > 0) {
        throw new Error('User with this email already exists in organization');
      }

      // Create user in Keycloak
      await this.kcAdmin.ensureAuthenticated();
      const client = this.kcAdmin.getClient();

      logger.info('Creating Keycloak account user', { 
        email: data.email,
        organizationId 
      });

      const kcUser = await client.users.create({
        email: data.email,
        firstName: data.firstName,
        lastName: data.lastName,
        enabled: true,
        emailVerified: false,
        username: data.email,
        attributes: {
          phone: data.phone ? [data.phone] : []
        },
        credentials: data.temporaryPassword ? [{
          type: 'password',
          value: data.temporaryPassword,
          temporary: true
        }] : undefined
      });

      if (!kcUser.id) {
        throw new Error('Failed to create user in Keycloak');
      }

      keycloakUserId = kcUser.id;

      logger.info('Keycloak account user created', { 
        keycloakUserId,
        email: data.email 
      });

      // Add user to organization's members group
      logger.debug('Adding user to organization members group', { 
        keycloakUserId,
        keycloakGroupId 
      });

      // Find members subgroup
      const subgroups = await client.groups.listSubGroups({ parentId: keycloakGroupId });
      const membersGroup = subgroups.find((g: any) => g.name === 'members');
      
      if (membersGroup && membersGroup.id) {
        await client.users.addToGroup({
          id: keycloakUserId,
          groupId: membersGroup.id
        });
        logger.info('User added to members group', { keycloakUserId });
      } else {
        logger.warn('Members group not found for organization', { 
          organizationId,
          keycloakGroupId 
        });
      }

      // Store user in database
      logger.info('Creating account user record in database', { 
        keycloakUserId,
        organizationId 
      });

      const dbResult = await db.query(
        `INSERT INTO organization_users 
         (organization_id, keycloak_user_id, user_type, email, first_name, last_name, phone, status, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING *`,
        [
          organizationId,
          keycloakUserId,
          'account-user',
          data.email,
          data.firstName,
          data.lastName,
          data.phone || null,
          'active',
          createdBy
        ]
      );

      const user = this.rowToAccountUser(dbResult.rows[0]);

      logger.info('Account user created successfully', { 
        id: user.id,
        email: user.email 
      });

      return user;
    } catch (error) {
      logger.error('Failed to create account user', { 
        organizationId,
        email: data.email,
        error: error instanceof Error ? error.message : String(error)
      });

      // Rollback Keycloak user if database fails
      if (keycloakUserId) {
        try {
          await this.kcAdmin.ensureAuthenticated();
          const client = this.kcAdmin.getClient();
          await client.users.del({ id: keycloakUserId });
          logger.info('Rolled back Keycloak user', { userId: keycloakUserId });
        } catch (rollbackError) {
          logger.error('Failed to rollback Keycloak user', { 
            userId: keycloakUserId,
            error: rollbackError instanceof Error ? rollbackError.message : String(rollbackError)
          });
        }
      }

      throw error;
    }
  }

  /**
   * Update account user
   * 
   * Updates user in both Keycloak and database.
   * 
   * @param id - Database ID of the user
   * @param updates - Fields to update
   * @returns Updated user
   * @throws Error if update fails or user not found
   */
  async updateAccountUser(id: string, updates: UpdateAccountUserDto): Promise<AccountUser> {
    try {
      logger.info('Updating account user', { id, updates });

      // Get current user
      const currentResult = await db.query(
        'SELECT * FROM organization_users WHERE id = $1 AND user_type = $2',
        [id, 'account-user']
      );

      if (currentResult.rows.length === 0) {
        throw new Error('Account user not found');
      }

      const currentUser = currentResult.rows[0];

      // Update Keycloak user if profile changed
      if (updates.firstName || updates.lastName || updates.phone !== undefined) {
        try {
          await this.kcAdmin.ensureAuthenticated();
          const client = this.kcAdmin.getClient();
          await client.users.update(
            { id: currentUser.keycloak_user_id },
            {
              firstName: updates.firstName || currentUser.first_name,
              lastName: updates.lastName || currentUser.last_name,
              enabled: updates.status === 'active',
              attributes: {
                phone: updates.phone !== undefined ? [updates.phone] : [currentUser.phone]
              }
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
      if (updates.phone !== undefined) {
        updateFields.push(`phone = $${paramCount++}`);
        updateValues.push(updates.phone);
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

      const user = this.rowToAccountUser(dbResult.rows[0]);

      logger.info('Account user updated successfully', { id: user.id });
      return user;
    } catch (error) {
      logger.error('Failed to update account user', { 
        id,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Delete account user
   * 
   * Deletes user from both Keycloak and database.
   * 
   * @param id - Database ID of the user
   * @throws Error if deletion fails or user not found
   */
  async deleteAccountUser(id: string): Promise<void> {
    try {
      logger.info('Deleting account user', { id });

      // Get user to get Keycloak user ID
      const result = await db.query(
        'SELECT * FROM organization_users WHERE id = $1 AND user_type = $2',
        [id, 'account-user']
      );

      if (result.rows.length === 0) {
        throw new Error('Account user not found');
      }

      const user = result.rows[0];

      // Delete from Keycloak
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

      // Delete from database
      await db.query(
        'DELETE FROM organization_users WHERE id = $1',
        [id]
      );

      logger.info('Account user deleted successfully', { id });
    } catch (error) {
      logger.error('Failed to delete account user', { 
        id,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Reset account user password
   * 
   * @param userId - Database ID of the user
   * @param newPassword - New password
   * @throws Error if reset fails
   */
  async resetPassword(userId: string, newPassword: string): Promise<void> {
    try {
      logger.info('Resetting account user password', { userId });

      // Get user to get Keycloak user ID
      const result = await db.query(
        'SELECT keycloak_user_id FROM organization_users WHERE id = $1 AND user_type = $2',
        [userId, 'account-user']
      );

      if (result.rows.length === 0) {
        throw new Error('Account user not found');
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
export const accountUserService = new AccountUserService(kcAdmin);
