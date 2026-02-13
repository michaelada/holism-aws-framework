import { OrgAdminUserService } from '../org-admin-user.service';
import { KeycloakAdminService } from '../keycloak-admin.service';
import { db } from '../../database/pool';

// Mock dependencies
jest.mock('../../database/pool');
jest.mock('../../config/logger');

describe('OrgAdminUserService', () => {
  let service: OrgAdminUserService;
  let mockKcAdmin: jest.Mocked<KeycloakAdminService>;
  let mockClient: any;
  const mockDb = db as jest.Mocked<typeof db>;

  beforeEach(() => {
    // Create mock Keycloak client
    mockClient = {
      users: {
        create: jest.fn(),
        update: jest.fn(),
        del: jest.fn(),
        addToGroup: jest.fn(),
        resetPassword: jest.fn()
      },
      groups: {
        listSubGroups: jest.fn()
      }
    };

    // Create mock KeycloakAdminService
    mockKcAdmin = {
      ensureAuthenticated: jest.fn().mockResolvedValue(undefined),
      getClient: jest.fn().mockReturnValue(mockClient),
      authenticate: jest.fn(),
      isTokenExpired: jest.fn(),
    } as any;

    service = new OrgAdminUserService(mockKcAdmin);
    jest.clearAllMocks();
  });

  describe('getAdminUsersByOrganisation', () => {
    it('should return all admin users for an organization', async () => {
      const mockUsers = [
        {
          id: 'user-1',
          organization_id: 'org-1',
          keycloak_user_id: 'kc-user-1',
          email: 'admin1@example.com',
          first_name: 'Admin',
          last_name: 'One',
          status: 'active',
          last_login: null,
          created_at: new Date(),
          updated_at: new Date()
        }
      ];

      mockDb.query
        .mockResolvedValueOnce({ rows: mockUsers } as any) // Get users
        .mockResolvedValueOnce({ rows: [{ id: 'role-1', name: 'Admin' }] } as any); // Get roles

      const result = await service.getAdminUsersByOrganisation('org-1');

      expect(result).toHaveLength(1);
      expect(result[0].email).toBe('admin1@example.com');
      expect(result[0].roles).toEqual(['role-1']);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('user_type = \'org-admin\''),
        ['org-1']
      );
    });

    it('should return empty array when no users found', async () => {
      mockDb.query.mockResolvedValue({ rows: [] } as any);

      const result = await service.getAdminUsersByOrganisation('org-1');

      expect(result).toEqual([]);
    });
  });

  describe('createAdminUser', () => {
    const mockOrgData = {
      id: 'org-1',
      keycloak_group_id: 'kc-group-1'
    };

    const mockAdminsGroup = {
      id: 'admins-group-1',
      name: 'admins'
    };

    it('should create admin user successfully', async () => {
      const userData = {
        email: 'newadmin@example.com',
        firstName: 'New',
        lastName: 'Admin',
        temporaryPassword: 'temp123',
        roleIds: ['role-1']
      };

      mockDb.query
        .mockResolvedValueOnce({ rows: [mockOrgData] } as any) // Get organization
        .mockResolvedValueOnce({ rows: [] } as any) // Check existing user
        .mockResolvedValueOnce({ // Insert user
          rows: [{
            id: 'user-1',
            organization_id: 'org-1',
            keycloak_user_id: 'kc-user-1',
            email: userData.email,
            first_name: userData.firstName,
            last_name: userData.lastName,
            status: 'active',
            created_at: new Date(),
            updated_at: new Date()
          }]
        } as any)
        .mockResolvedValueOnce({ rows: [] } as any) // Get roles (empty initially)
        .mockResolvedValueOnce({ rows: [{ id: 'user-1' }] } as any) // Verify user for assignRoles
        .mockResolvedValueOnce({ rows: [] } as any) // Check role assignment exists
        .mockResolvedValueOnce({ rows: [] } as any) // Insert role assignment
        .mockResolvedValueOnce({ // Get updated user
          rows: [{
            id: 'user-1',
            organization_id: 'org-1',
            keycloak_user_id: 'kc-user-1',
            email: userData.email,
            first_name: userData.firstName,
            last_name: userData.lastName,
            status: 'active',
            created_at: new Date(),
            updated_at: new Date()
          }]
        } as any)
        .mockResolvedValueOnce({ rows: [{ id: 'role-1', name: 'Admin' }] } as any); // Get roles after assignment

      mockClient.users.create.mockResolvedValue({ id: 'kc-user-1' });
      mockClient.groups.listSubGroups.mockResolvedValue([mockAdminsGroup]);

      const result = await service.createAdminUser('org-1', userData, 'creator-1');

      expect(result.email).toBe(userData.email);
      expect(mockClient.users.create).toHaveBeenCalledWith(
        expect.objectContaining({
          email: userData.email,
          firstName: userData.firstName,
          lastName: userData.lastName
        })
      );
      expect(mockClient.users.addToGroup).toHaveBeenCalledWith({
        id: 'kc-user-1',
        groupId: 'admins-group-1'
      });
    });

    it('should throw error if organization not found', async () => {
      mockDb.query.mockResolvedValue({ rows: [] } as any);

      await expect(
        service.createAdminUser('org-999', {
          email: 'test@example.com',
          firstName: 'Test',
          lastName: 'User'
        })
      ).rejects.toThrow('Organization not found');
    });

    it('should throw error if user already exists', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [mockOrgData] } as any)
        .mockResolvedValueOnce({ rows: [{ id: 'existing-user' }] } as any);

      await expect(
        service.createAdminUser('org-1', {
          email: 'existing@example.com',
          firstName: 'Existing',
          lastName: 'User'
        })
      ).rejects.toThrow('User with this email already exists in organization');
    });

    it('should rollback Keycloak user on database failure', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [mockOrgData] } as any)
        .mockResolvedValueOnce({ rows: [] } as any) // Check existing - no user
        .mockRejectedValueOnce(new Error('Database error')); // Insert fails

      mockClient.users.create.mockResolvedValue({ id: 'kc-user-1' });
      mockClient.groups.listSubGroups.mockResolvedValue([mockAdminsGroup]);

      await expect(
        service.createAdminUser('org-1', {
          email: 'test@example.com',
          firstName: 'Test',
          lastName: 'User'
        })
      ).rejects.toThrow('Database error');

      expect(mockClient.users.del).toHaveBeenCalledWith({ id: 'kc-user-1' });
    });
  });

  describe('updateAdminUser', () => {
    it('should update admin user successfully', async () => {
      const mockUser = {
        id: 'user-1',
        organization_id: 'org-1',
        keycloak_user_id: 'kc-user-1',
        email: 'admin@example.com',
        first_name: 'Admin',
        last_name: 'User',
        status: 'active',
        created_at: new Date(),
        updated_at: new Date()
      };

      const updatedUser = {
        ...mockUser,
        first_name: 'Updated',
        last_name: 'Name'
      };

      mockDb.query
        .mockResolvedValueOnce({ rows: [mockUser] } as any) // Get current user
        .mockResolvedValueOnce({ rows: [updatedUser] } as any) // Update user
        .mockResolvedValueOnce({ rows: [] } as any); // Get roles

      const result = await service.updateAdminUser('user-1', {
        firstName: 'Updated',
        lastName: 'Name'
      });

      expect(result.firstName).toBe('Updated');
      expect(result.lastName).toBe('Name');
      expect(mockClient.users.update).toHaveBeenCalledWith(
        { id: 'kc-user-1' },
        expect.objectContaining({
          firstName: 'Updated',
          lastName: 'Name'
        })
      );
    });

    it('should throw error if user not found', async () => {
      mockDb.query.mockResolvedValue({ rows: [] } as any);

      await expect(
        service.updateAdminUser('user-999', { firstName: 'Test' })
      ).rejects.toThrow('Admin user not found');
    });
  });

  describe('deleteAdminUser', () => {
    it('should delete admin user successfully', async () => {
      const mockUser = {
        id: 'user-1',
        keycloak_user_id: 'kc-user-1'
      };

      mockDb.query
        .mockResolvedValueOnce({ rows: [mockUser] } as any)
        .mockResolvedValueOnce({ rows: [] } as any);

      await service.deleteAdminUser('user-1');

      expect(mockClient.users.del).toHaveBeenCalledWith({ id: 'kc-user-1' });
      expect(mockDb.query).toHaveBeenCalledWith(
        'DELETE FROM organization_users WHERE id = $1',
        ['user-1']
      );
    });

    it('should throw error if user not found', async () => {
      mockDb.query.mockResolvedValue({ rows: [] } as any);

      await expect(
        service.deleteAdminUser('user-999')
      ).rejects.toThrow('Admin user not found');
    });
  });

  describe('assignRoles', () => {
    it('should assign roles to admin user', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [{ id: 'user-1' }] } as any) // Verify user
        .mockResolvedValueOnce({ rows: [] } as any) // Check existing assignment
        .mockResolvedValueOnce({ rows: [] } as any); // Insert assignment

      await service.assignRoles('user-1', ['role-1'], 'assigner-1');

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO organization_user_roles'),
        ['user-1', 'role-1', 'assigner-1']
      );
    });

    it('should skip already assigned roles', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [{ id: 'user-1' }] } as any) // Verify user
        .mockResolvedValueOnce({ rows: [{ id: 'assignment-1' }] } as any); // Already exists

      await service.assignRoles('user-1', ['role-1']);

      // Should only call verify user and check existing, not insert
      expect(mockDb.query).toHaveBeenCalledTimes(2);
    });

    it('should throw error if user not found', async () => {
      mockDb.query.mockResolvedValue({ rows: [] } as any);

      await expect(
        service.assignRoles('user-999', ['role-1'])
      ).rejects.toThrow('Admin user not found');
    });
  });

  describe('removeRole', () => {
    it('should remove role from admin user', async () => {
      mockDb.query.mockResolvedValue({ rows: [] } as any);

      await service.removeRole('user-1', 'role-1');

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM organization_user_roles'),
        ['user-1', 'role-1']
      );
    });
  });

  describe('resetPassword', () => {
    it('should reset admin user password', async () => {
      mockDb.query.mockResolvedValue({
        rows: [{ id: 'user-1', keycloak_user_id: 'kc-user-1' }]
      } as any);

      await service.resetPassword('user-1', 'newpassword123');

      expect(mockClient.users.resetPassword).toHaveBeenCalledWith({
        id: 'kc-user-1',
        credential: {
          type: 'password',
          value: 'newpassword123',
          temporary: true
        }
      });
    });

    it('should throw error if user not found', async () => {
      mockDb.query.mockResolvedValue({ rows: [] } as any);

      await expect(
        service.resetPassword('user-999', 'newpassword')
      ).rejects.toThrow('Admin user not found');
    });
  });
});
