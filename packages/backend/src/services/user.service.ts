import { KeycloakAdminService } from './keycloak-admin.service';
import { db } from '../database/pool';
import { logger } from '../config/logger';
import UserRepresentation from '@keycloak/keycloak-admin-client/lib/defs/userRepresentation';

/**
 * Data Transfer Objects for User operations
 */
export interface CreateUserDto {
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  password?: string;
  temporaryPassword?: boolean;
  emailVerified?: boolean;
  phoneNumber?: string;
  department?: string;
  organizationId?: string;
  roles?: string[];
}

export interface UpdateUserDto {
  email?: string;
  firstName?: string;
  lastName?: string;
  enabled?: boolean;
  phoneNumber?: string;
  department?: string;
  organizationId?: string;
  roles?: string[];
}

export interface UserFilters {
  search?: string;
  email?: string;
  organizationId?: string;
  limit?: number;
  offset?: number;
}

/**
 * What a person *is* on the platform, as opposed to the individual realm and
 * organisation roles they hold.
 *
 * - `super-admin` — operates the platform console; the `admin` realm role.
 * - `org-admin`   — administers one or more organisations.
 * - `account`     — a member of one or more organisations.
 *
 * These are not mutually exclusive: the same person can administer one club
 * and be a member of another.
 */
export type UserClassification = 'super-admin' | 'org-admin' | 'account';

export interface User {
  id: string;
  keycloakUserId: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  enabled: boolean;
  emailVerified: boolean;
  roles: string[];
  /** Broad categories derived from `roles` and organisation membership. */
  classifications: UserClassification[];
  organizations: string[];
  phoneNumber?: string;
  department?: string;
  createdAt: Date;
  lastLogin?: Date;
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
 * Service for managing user operations
 * 
 * This service manages users by coordinating between Keycloak users
 * and the local PostgreSQL database. Users are created in Keycloak
 * with metadata stored in both systems.
 * 
 * Key Features:
 * - Creates user in Keycloak with profile and credentials
 * - Adds user to the organisation's group if specified
 * - Assigns realm roles to user
 * - Filters users by organisation using group membership
 * - Updates both Keycloak and database records
 * - Supports password reset with temporary flag
 */
export class UserService {
  /**
   * Realm roles that make someone a platform operator. `admin` is the one
   * `requireAdminRole()` enforces; `super-admin` also appears in the
   * development auth bypass, so both are honoured here.
   */
  private static readonly SUPER_ADMIN_ROLES = ['admin', 'super-admin'];

  constructor(
    private kcAdmin: KeycloakAdminService,
    private database: typeof db = db
  ) {}

  /**
   * Create new user
   * 
   * Creates a user by:
   * 1. Creating the user in Keycloak with profile and credentials
   * 2. Adding user to the organisation's group if specified
   * 3. Assigning realm roles if specified
   * 4. Storing user record in PostgreSQL with Keycloak user ID reference
   * 
   * If database creation fails, the Keycloak user is rolled back.
   * 
   * @param data - User creation data
   * @returns Created user with all fields
   * @throws Error if creation fails in either system
   */
  async createUser(data: CreateUserDto): Promise<User> {
    let keycloakUserId: string | null = null;

    try {
      await this.kcAdmin.ensureAuthenticated();
      const client = this.kcAdmin.getClient();

      // Create Keycloak user with profile information
      logger.info('Creating Keycloak user', { username: data.username });

      const userData: UserRepresentation = {
        username: data.username,
        email: data.email,
        firstName: data.firstName,
        lastName: data.lastName,
        enabled: true,
        emailVerified: data.emailVerified ?? false,
        attributes: {
          phoneNumber: data.phoneNumber ? [data.phoneNumber] : [],
          department: data.department ? [data.department] : [],
        },
      };

      const result = await client.users.create(userData);
      keycloakUserId = result.id;

      if (!keycloakUserId) {
        throw new Error('Failed to get user ID from Keycloak');
      }

      logger.info('Keycloak user created', { 
        userId: keycloakUserId, 
        username: data.username 
      });

      // Set password if provided
      if (data.password) {
        logger.debug('Setting user password', { userId: keycloakUserId });
        await client.users.resetPassword({
          id: keycloakUserId,
          credential: {
            temporary: data.temporaryPassword ?? false,
            type: 'password',
            value: data.password,
          },
        });
      }

      // Add user to the organisation's Keycloak group if one was specified.
      if (data.organizationId) {
        logger.debug('Adding user to organisation group', { 
          userId: keycloakUserId, 
          organizationId: data.organizationId 
        });

        const orgResult = await this.database.query(
          'SELECT keycloak_group_id FROM organizations WHERE id = $1',
          [data.organizationId]
        );

        if (orgResult.rows.length === 0) {
          throw new Error(`Organisation not found: ${data.organizationId}`);
        }

        const keycloakGroupId = orgResult.rows[0].keycloak_group_id;
        await client.users.addToGroup({
          id: keycloakUserId,
          groupId: keycloakGroupId,
        });
      }

      // Assign roles if specified
      if (data.roles && data.roles.length > 0) {
        logger.debug('Assigning roles to user', { 
          userId: keycloakUserId, 
          roles: data.roles 
        });

        for (const roleName of data.roles) {
          await this.assignRoleToUser(keycloakUserId, roleName);
        }
      }

      // Store user in database
      logger.info('Creating user record in database', { 
        keycloakUserId, 
        username: data.username 
      });

      const dbResult = await this.database.query(
        `INSERT INTO users (keycloak_user_id, organization_id, username, email, preferences)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, keycloak_user_id, organization_id, username, email, preferences, last_login, created_at, updated_at`,
        [keycloakUserId, data.organizationId || null, data.username, data.email, '{}']
      );

      const user = await this.mapDbRowToUser(dbResult.rows[0]);

      logger.info('User created successfully', { 
        id: user.id, 
        keycloakUserId: user.keycloakUserId 
      });

      return user;
    } catch (error) {
      logger.error('Failed to create user', { 
        error: error instanceof Error ? error.message : String(error),
        username: data.username 
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
   * List users with optional filters
   * 
   * Retrieves users from Keycloak and enriches them with:
   * - Local database information
   * - Organisation associations
   * - Role assignments
   * 
   * @param filters - Optional filters for search, email, organisation, pagination
   * @returns Array of users with enriched data
   */
  async getUsers(filters?: UserFilters): Promise<User[]> {
    try {
      await this.kcAdmin.ensureAuthenticated();
      const client = this.kcAdmin.getClient();

      logger.debug('Fetching users with filters', { filters });

      // Get users from Keycloak
      let kcUsers: UserRepresentation[] = [];

      if (filters?.search) {
        kcUsers = await client.users.find({ search: filters.search });
      } else if (filters?.email) {
        kcUsers = await client.users.find({ email: filters.email });
      } else {
        kcUsers = await client.users.find({
          max: filters?.limit || 100,
          first: filters?.offset || 0,
        });
      }

      // Filter by organisation if specified
      if (filters?.organizationId) {
        logger.debug('Filtering users by organisation', { organizationId: filters.organizationId });

        const orgResult = await this.database.query(
          'SELECT keycloak_group_id FROM organizations WHERE id = $1',
          [filters.organizationId]
        );

        if (orgResult.rows.length === 0) {
          throw new Error(`Organisation not found: ${filters.organizationId}`);
        }

        const keycloakGroupId = orgResult.rows[0].keycloak_group_id;

        // Get group members
        const groupMembers = await client.groups.listMembers({ id: keycloakGroupId });
        const memberIds = new Set(groupMembers.map(m => m.id));

        // Filter users to only those in the group
        kcUsers = kcUsers.filter(u => u.id && memberIds.has(u.id));
      }

      // Enrich users with database information
      const users: User[] = [];

      for (const kcUser of kcUsers) {
        if (!kcUser.id) continue;

        try {
          const dbResult = await this.database.query(
            'SELECT id, keycloak_user_id, organization_id, username, email, preferences, last_login, created_at, updated_at FROM users WHERE keycloak_user_id = $1',
            [kcUser.id]
          );

          let user: User;

          if (dbResult.rows.length > 0) {
            user = await this.mapDbRowToUser(dbResult.rows[0]);
          } else {
            /*
             * In Keycloak but not in `users`. That is the norm, not an edge
             * case: `users` is the super admin's own registry, while everyone
             * who actually belongs to an organisation lives in Keycloak groups
             * and `organization_users`. Roles and organisations are therefore
             * resolved from Keycloak here too — returning empty arrays would
             * show every one of these people as belonging to nothing.
             */
            const [roles, membership] = await Promise.all([
              this.getUserRoles(kcUser.id),
              this.resolveMembership(kcUser.id),
            ]);

            const roleNames = roles.map(r => r.name);

            user = {
              id: '',
              keycloakUserId: kcUser.id,
              username: kcUser.username || '',
              email: kcUser.email || '',
              firstName: kcUser.firstName || '',
              lastName: kcUser.lastName || '',
              enabled: kcUser.enabled ?? true,
              emailVerified: kcUser.emailVerified ?? false,
              roles: roleNames,
              classifications: this.classifyUser(roleNames, membership.classifications),
              organizations: membership.organizationIds,
              phoneNumber: kcUser.attributes?.phoneNumber?.[0],
              department: kcUser.attributes?.department?.[0],
              createdAt: new Date(kcUser.createdTimestamp || Date.now()),
            };
          }

          users.push(user);
        } catch (error) {
          logger.warn('Failed to enrich user', {
            keycloakUserId: kcUser.id,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }

      logger.info('Retrieved users', { count: users.length });
      return users;
    } catch (error) {
      logger.error('Failed to list users', { 
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Get user by ID
   * 
   * Retrieves a specific user by database ID and enriches with
   * Keycloak data, roles, and organisation associations.
   * 
   * @param id - Database ID of the user
   * @returns User with enriched data
   * @throws Error if user not found
   */
  async getUserById(id: string): Promise<User> {
    try {
      logger.debug('Fetching user by ID', { id });

      const dbResult = await this.database.query(
        'SELECT id, keycloak_user_id, organization_id, username, email, preferences, last_login, created_at, updated_at FROM users WHERE id = $1',
        [id]
      );

      if (dbResult.rows.length === 0) {
        throw new Error(`User not found: ${id}`);
      }

      const user = await this.mapDbRowToUser(dbResult.rows[0]);

      logger.info('Retrieved user', { id: user.id });
      return user;
    } catch (error) {
      logger.error('Failed to get user by ID', { 
        id,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Update user
   * 
   * Updates user in both Keycloak and database:
   * 1. Updates Keycloak user profile
   * 2. Updates organisation association if changed
   * 3. Updates role assignments if changed
   * 4. Updates database record
   * 
   * @param id - Database ID of the user
   * @param updates - Fields to update
   * @returns Updated user
   * @throws Error if update fails or user not found
   */
  async updateUser(id: string, updates: UpdateUserDto): Promise<User> {
    try {
      // First, get the current user to get Keycloak user ID
      const currentUser = await this.getUserById(id);

      await this.kcAdmin.ensureAuthenticated();
      const client = this.kcAdmin.getClient();

      // Update Keycloak user profile
      logger.info('Updating Keycloak user', { 
        userId: currentUser.keycloakUserId,
        updates 
      });

      const userUpdate: UserRepresentation = {
        email: updates.email,
        firstName: updates.firstName,
        lastName: updates.lastName,
        enabled: updates.enabled,
        attributes: {
          phoneNumber: updates.phoneNumber ? [updates.phoneNumber] : undefined,
          department: updates.department ? [updates.department] : undefined,
        },
      };

      await client.users.update(
        { id: currentUser.keycloakUserId },
        userUpdate
      );

      logger.info('Keycloak user updated', { userId: currentUser.keycloakUserId });

      // Update organisation association if changed
      if (updates.organizationId !== undefined) {
        logger.debug('Updating user organisation association', { 
          userId: currentUser.keycloakUserId,
          newOrganizationId: updates.organizationId 
        });

        // Remove from the previous organisation's group, if any.
        if (currentUser.organizations.length > 0) {
          const oldOrgResult = await this.database.query(
            'SELECT keycloak_group_id FROM organizations WHERE id = $1',
            [currentUser.organizations[0]]
          );

          if (oldOrgResult.rows.length > 0) {
            const oldGroupId = oldOrgResult.rows[0].keycloak_group_id;
            await client.users.delFromGroup({
              id: currentUser.keycloakUserId,
              groupId: oldGroupId,
            });
          }
        }

        // Add to the new organisation's group, if one was given.
        if (updates.organizationId) {
          const newOrgResult = await this.database.query(
            'SELECT keycloak_group_id FROM organizations WHERE id = $1',
            [updates.organizationId]
          );

          if (newOrgResult.rows.length === 0) {
            throw new Error(`Organisation not found: ${updates.organizationId}`);
          }

          const newGroupId = newOrgResult.rows[0].keycloak_group_id;
          await client.users.addToGroup({
            id: currentUser.keycloakUserId,
            groupId: newGroupId,
          });
        }
      }

      // Update role assignments if changed
      if (updates.roles !== undefined) {
        logger.debug('Updating user roles', { 
          userId: currentUser.keycloakUserId,
          newRoles: updates.roles 
        });

        // Get current roles
        const currentRoles = await this.getUserRoles(currentUser.keycloakUserId);
        const currentRoleNames = new Set(currentRoles.map(r => r.name));
        const newRoleNames = new Set(updates.roles);

        // Remove roles that are no longer assigned
        for (const roleName of currentRoleNames) {
          if (!newRoleNames.has(roleName)) {
            await this.removeRoleFromUser(currentUser.keycloakUserId, roleName);
          }
        }

        // Add new roles
        for (const roleName of newRoleNames) {
          if (!currentRoleNames.has(roleName)) {
            await this.assignRoleToUser(currentUser.keycloakUserId, roleName);
          }
        }
      }

      // Update database record
      logger.info('Updating user in database', { id });

      const updateFields: string[] = [];
      const updateValues: any[] = [];
      let paramIndex = 1;

      if (updates.email !== undefined) {
        updateFields.push(`email = $${paramIndex++}`);
        updateValues.push(updates.email);
      }
      if (updates.organizationId !== undefined) {
        updateFields.push(`organization_id = $${paramIndex++}`);
        updateValues.push(updates.organizationId);
      }

      updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
      updateValues.push(id);

      const dbResult = await this.database.query(
        `UPDATE users
         SET ${updateFields.join(', ')}
         WHERE id = $${paramIndex}
         RETURNING id, keycloak_user_id, organization_id, username, email, preferences, last_login, created_at, updated_at`,
        updateValues
      );

      const user = await this.mapDbRowToUser(dbResult.rows[0]);

      logger.info('User updated successfully', { id: user.id });
      return user;
    } catch (error) {
      logger.error('Failed to update user', { 
        id,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Delete user
   * 
   * Deletes user from both systems:
   * 1. Removes user from Keycloak (cascades to remove group and role associations)
   * 2. Removes database record
   * 
   * @param id - Database ID of the user
   * @throws Error if deletion fails or user not found
   */
  async deleteUser(id: string): Promise<void> {
    try {
      // Get user to get Keycloak user ID
      const user = await this.getUserById(id);

      await this.kcAdmin.ensureAuthenticated();
      const client = this.kcAdmin.getClient();

      // Delete from Keycloak first
      logger.info('Deleting Keycloak user', { 
        userId: user.keycloakUserId,
        dbId: id 
      });

      await client.users.del({ id: user.keycloakUserId });

      logger.info('Keycloak user deleted', { userId: user.keycloakUserId });

      // Delete from database
      logger.info('Deleting user from database', { id });

      await this.database.query(
        'DELETE FROM users WHERE id = $1',
        [id]
      );

      logger.info('User deleted successfully', { id });
    } catch (error) {
      logger.error('Failed to delete user', { 
        id,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Reset user password
   * 
   * Updates the password in Keycloak with optional temporary flag.
   * 
   * @param id - Database ID of the user
   * @param password - New password
   * @param temporary - Whether password should be temporary (user must change on next login)
   * @throws Error if reset fails or user not found
   */
  async resetPassword(id: string, password: string, temporary: boolean): Promise<void> {
    try {
      // Get user to get Keycloak user ID
      const user = await this.getUserById(id);

      await this.kcAdmin.ensureAuthenticated();
      const client = this.kcAdmin.getClient();

      logger.info('Resetting user password', { 
        userId: user.keycloakUserId,
        temporary 
      });

      await client.users.resetPassword({
        id: user.keycloakUserId,
        credential: {
          temporary,
          type: 'password',
          value: password,
        },
      });

      logger.info('Password reset successfully', { userId: user.keycloakUserId });
    } catch (error) {
      logger.error('Failed to reset password', { 
        id,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Get user roles
   * 
   * Retrieves realm role mappings for a user from Keycloak.
   * 
   * @param keycloakUserId - Keycloak user ID
   * @returns Array of roles assigned to the user
   */
  async getUserRoles(keycloakUserId: string): Promise<Role[]> {
    try {
      await this.kcAdmin.ensureAuthenticated();
      const client = this.kcAdmin.getClient();

      const roleMappings = await client.users.listRealmRoleMappings({ id: keycloakUserId });

      const roles: Role[] = roleMappings.map(role => ({
        id: role.id || '',
        keycloakRoleId: role.id,
        name: role.name || '',
        displayName: role.name || '',
        description: role.description,
        composite: role.composite ?? false,
      }));

      return roles;
    } catch (error) {
      logger.error('Failed to get user roles', { 
        keycloakUserId,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Assign role to user
   * 
   * Creates a realm role mapping in Keycloak associating the user with the role.
   * 
   * @param keycloakUserId - Keycloak user ID (not database ID)
   * @param roleName - Name of the role to assign
   * @throws Error if assignment fails or role not found
   */
  async assignRoleToUser(keycloakUserId: string, roleName: string): Promise<void> {
    try {
      await this.kcAdmin.ensureAuthenticated();
      const client = this.kcAdmin.getClient();

      logger.debug('Assigning role to user', { keycloakUserId, roleName });

      // Find the role by name
      const role = await client.roles.findOneByName({ name: roleName });

      if (!role || !role.id) {
        throw new Error(`Role not found: ${roleName}`);
      }

      // Assign the role to the user
      await client.users.addRealmRoleMappings({
        id: keycloakUserId,
        roles: [
          {
            id: role.id!,
            name: role.name!,
          },
        ],
      });

      logger.info('Role assigned to user', { keycloakUserId, roleName });
    } catch (error) {
      logger.error('Failed to assign role to user', { 
        keycloakUserId,
        roleName,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Remove role from user
   * 
   * Deletes the realm role mapping from Keycloak.
   * 
   * @param keycloakUserId - Keycloak user ID (not database ID)
   * @param roleName - Name of the role to remove
   * @throws Error if removal fails or role not found
   */
  async removeRoleFromUser(keycloakUserId: string, roleName: string): Promise<void> {
    try {
      await this.kcAdmin.ensureAuthenticated();
      const client = this.kcAdmin.getClient();

      logger.debug('Removing role from user', { keycloakUserId, roleName });

      // Find the role by name
      const role = await client.roles.findOneByName({ name: roleName });

      if (!role || !role.id) {
        throw new Error(`Role not found: ${roleName}`);
      }

      // Remove the role from the user
      await client.users.delRealmRoleMappings({
        id: keycloakUserId,
        roles: [
          {
            id: role.id!,
            name: role.name!,
          },
        ],
      });

      logger.info('Role removed from user', { keycloakUserId, roleName });
    } catch (error) {
      logger.error('Failed to remove role from user', { 
        keycloakUserId,
        roleName,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Map database row to User object
   * 
   * Enriches database data with Keycloak information.
   * 
   * @param row - Database row
   * @returns User object with enriched data
   */
  /**
   * Which organisations a user belongs to, resolved from their Keycloak groups.
   *
   * An organisation's group tree is `<org-type>/<org>/{admins,members}`, so a
   * member's group is a *child* of the organisation's. Matching on the
   * organisation's own group id alone would therefore find nothing for anyone
   * actually placed in `admins` or `members`; the parent path is checked too.
   *
   * Keyed on the Keycloak user id rather than a `users` row, because the
   * platform user list is drawn from Keycloak and most of those people have no
   * `users` row at all — `users` is the super admin's own registry, not the
   * record of who belongs where.
   */
  private async resolveMembership(keycloakUserId: string): Promise<{
    organizationIds: string[];
    classifications: UserClassification[];
  }> {
    await this.kcAdmin.ensureAuthenticated();
    const client = this.kcAdmin.getClient();

    const groups = await client.users.listGroups({ id: keycloakUserId });
    const organizationIds: string[] = [];
    const classifications = new Set<UserClassification>();

    for (const group of groups) {
      if (!group.id) continue;

      const orgResult = await this.database.query(
        `SELECT o.id
         FROM organizations o
         WHERE o.keycloak_group_id = $1
            OR ($2::text IS NOT NULL AND $2::text LIKE '/' || (
                 SELECT t.name FROM organization_types t WHERE t.id = o.organization_type_id
               ) || '/' || o.name || '/%')`,
        [group.id, group.path ?? null]
      );

      for (const orgRow of orgResult.rows) {
        if (!organizationIds.includes(orgRow.id)) organizationIds.push(orgRow.id);
      }

      // The leaf of the group path says which side of the organisation they
      // are on: `<org-type>/<org>/admins` administers it, `.../members` belongs
      // to it.
      if (orgResult.rows.length > 0) {
        if (group.path?.endsWith('/admins')) classifications.add('org-admin');
        if (group.path?.endsWith('/members')) classifications.add('account');
      }
    }

    /*
     * `organization_users` is the record of who belongs where, so it is the
     * authority; the group paths above only corroborate it. Read second so a
     * person whose Keycloak groups have drifted is still classified correctly.
     */
    const userTypes = await this.database.query(
      'SELECT DISTINCT user_type FROM organization_users WHERE keycloak_user_id = $1',
      [keycloakUserId]
    );

    for (const row of userTypes.rows) {
      if (row.user_type === 'org-admin') classifications.add('org-admin');
      if (row.user_type === 'account-user') classifications.add('account');
    }

    return { organizationIds, classifications: Array.from(classifications) };
  }

  /**
   * Broad categories for a user, in a stable order: platform first, then
   * organisation administration, then membership.
   */
  private classifyUser(
    roleNames: string[],
    membershipClassifications: UserClassification[]
  ): UserClassification[] {
    const classifications = new Set<UserClassification>(membershipClassifications);

    if (roleNames.some(role => UserService.SUPER_ADMIN_ROLES.includes(role))) {
      classifications.add('super-admin');
    }

    const order: UserClassification[] = ['super-admin', 'org-admin', 'account'];
    return order.filter(c => classifications.has(c));
  }

  private async mapDbRowToUser(row: any): Promise<User> {
    await this.kcAdmin.ensureAuthenticated();
    const client = this.kcAdmin.getClient();

    // Get user from Keycloak
    const kcUser = await client.users.findOne({ id: row.keycloak_user_id });

    if (!kcUser) {
      throw new Error(`Keycloak user not found: ${row.keycloak_user_id}`);
    }

    // Get user roles
    const roles = await this.getUserRoles(row.keycloak_user_id);

    const membership = await this.resolveMembership(row.keycloak_user_id);
    const roleNames = roles.map(r => r.name);

    return {
      id: row.id,
      keycloakUserId: row.keycloak_user_id,
      username: kcUser.username || row.username,
      email: kcUser.email || row.email,
      firstName: kcUser.firstName || '',
      lastName: kcUser.lastName || '',
      enabled: kcUser.enabled ?? true,
      emailVerified: kcUser.emailVerified ?? false,
      roles: roleNames,
      classifications: this.classifyUser(roleNames, membership.classifications),
      organizations: membership.organizationIds,
      phoneNumber: kcUser.attributes?.phoneNumber?.[0],
      department: kcUser.attributes?.department?.[0],
      createdAt: row.created_at,
      lastLogin: row.last_login,
    };
  }
}
