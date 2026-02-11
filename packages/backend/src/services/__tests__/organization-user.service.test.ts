import { organizationUserService } from '../organization-user.service';
import { db } from '../../database/pool';
import { logger } from '../../config/logger';

// Mock dependencies
jest.mock('../../database/pool');
jest.mock('../../config/logger');
jest.mock('../organization.service');
jest.mock('../keycloak-admin.service');

const mockDb = db as jest.Mocked<typeof db>;
const mockLogger = logger as jest.Mocked<typeof logger>;

describe('OrganizationUserService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getUsersByOrganization', () => {
    it('should get all users for an organization', async () => {
      const mockUsers = [
        {
          id: 'user-1',
          organization_id: 'org-1',
          keycloak_user_id: 'kc-user-1',
          user_type: 'org-admin',
          email: 'admin@test.com',
          first_name: 'John',
          last_name: 'Admin',
          status: 'active',
          last_login: null,
          created_at: new Date(),
          updated_at: new Date(),
          created_by: null
        }
      ];

      mockDb.query.mockResolvedValue({ rows: mockUsers } as any);

      const result = await organizationUserService.getUsersByOrganization('org-1');

      expect(result).toHaveLength(1);
      expect(result[0].email).toBe('admin@test.com');
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT ou.*'),
        ['org-1']
      );
    });

    it('should filter by user type', async () => {
      mockDb.query.mockResolvedValue({ rows: [] } as any);

      await organizationUserService.getUsersByOrganization('org-1', 'org-admin');

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('AND ou.user_type = $2'),
        ['org-1', 'org-admin']
      );
    });

    it('should handle database errors', async () => {
      mockDb.query.mockRejectedValue(new Error('Database error'));

      await expect(
        organizationUserService.getUsersByOrganization('org-1')
      ).rejects.toThrow('Database error');

      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('getUserById', () => {
    it('should get user by ID', async () => {
      const mockUser = {
        id: 'user-1',
        organization_id: 'org-1',
        keycloak_user_id: 'kc-user-1',
        user_type: 'org-admin',
        email: 'admin@test.com',
        first_name: 'John',
        last_name: 'Admin',
        status: 'active',
        last_login: null,
        created_at: new Date(),
        updated_at: new Date(),
        created_by: null
      };

      mockDb.query.mockResolvedValue({ rows: [mockUser] } as any);

      const result = await organizationUserService.getUserById('user-1');

      expect(result).not.toBeNull();
      expect(result?.email).toBe('admin@test.com');
    });

    it('should return null if user not found', async () => {
      mockDb.query.mockResolvedValue({ rows: [] } as any);

      const result = await organizationUserService.getUserById('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('getUserByEmail', () => {
    it('should get user by email within organization', async () => {
      const mockUser = {
        id: 'user-1',
        organization_id: 'org-1',
        keycloak_user_id: 'kc-user-1',
        user_type: 'org-admin',
        email: 'admin@test.com',
        first_name: 'John',
        last_name: 'Admin',
        status: 'active',
        last_login: null,
        created_at: new Date(),
        updated_at: new Date(),
        created_by: null
      };

      mockDb.query.mockResolvedValue({ rows: [mockUser] } as any);

      const result = await organizationUserService.getUserByEmail('org-1', 'admin@test.com');

      expect(result).not.toBeNull();
      expect(result?.email).toBe('admin@test.com');
    });

    it('should return null if user not found', async () => {
      mockDb.query.mockResolvedValue({ rows: [] } as any);

      const result = await organizationUserService.getUserByEmail('org-1', 'nonexistent@test.com');

      expect(result).toBeNull();
    });
  });

  describe('updateUser', () => {
    it('should update user details', async () => {
      const existingUser = {
        id: 'user-1',
        organization_id: 'org-1',
        keycloak_user_id: 'kc-user-1',
        user_type: 'org-admin',
        email: 'admin@test.com',
        first_name: 'John',
        last_name: 'Admin',
        status: 'active',
        last_login: null,
        created_at: new Date(),
        updated_at: new Date(),
        created_by: null
      };

      const updatedUser = {
        ...existingUser,
        first_name: 'Jane',
        updated_at: new Date()
      };

      mockDb.query
        .mockResolvedValueOnce({ rows: [existingUser] } as any)
        .mockResolvedValueOnce({ rows: [updatedUser] } as any);

      const result = await organizationUserService.updateUser('user-1', {
        firstName: 'Jane'
      });

      expect(result.firstName).toBe('Jane');
      expect(mockDb.query).toHaveBeenCalledTimes(2);
    });

    it('should throw error if user not found', async () => {
      mockDb.query.mockResolvedValue({ rows: [] } as any);

      await expect(
        organizationUserService.updateUser('nonexistent', { firstName: 'Jane' })
      ).rejects.toThrow('User not found');
    });
  });

  describe('assignRole', () => {
    it('should assign role to user', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [] } as any) // Check existing
        .mockResolvedValueOnce({ rows: [] } as any); // Insert

      await organizationUserService.assignRole('user-1', 'role-1', 'admin-1');

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO organization_user_roles'),
        ['user-1', 'role-1', 'admin-1']
      );
    });

    it('should not assign role if already assigned', async () => {
      mockDb.query.mockResolvedValue({ rows: [{ id: 'assignment-1' }] } as any);

      await organizationUserService.assignRole('user-1', 'role-1');

      expect(mockDb.query).toHaveBeenCalledTimes(1); // Only check, no insert
    });
  });

  describe('removeRole', () => {
    it('should remove role from user', async () => {
      mockDb.query.mockResolvedValue({ rows: [] } as any);

      await organizationUserService.removeRole('user-1', 'role-1');

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM organization_user_roles'),
        ['user-1', 'role-1']
      );
    });
  });

  describe('getUserRoles', () => {
    it('should get user roles', async () => {
      const mockRoles = [
        { organization_admin_role_id: 'role-1' },
        { organization_admin_role_id: 'role-2' }
      ];

      mockDb.query.mockResolvedValue({ rows: mockRoles } as any);

      const result = await organizationUserService.getUserRoles('user-1');

      expect(result).toEqual(['role-1', 'role-2']);
    });
  });
});
