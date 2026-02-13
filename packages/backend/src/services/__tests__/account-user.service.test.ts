import { AccountUserService } from '../account-user.service';
import { KeycloakAdminService } from '../keycloak-admin.service';
import { db } from '../../database/pool';

// Mock dependencies
jest.mock('../../database/pool');
jest.mock('../../config/logger');

describe('AccountUserService', () => {
  let service: AccountUserService;
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

    service = new AccountUserService(mockKcAdmin);
    jest.clearAllMocks();
  });

  describe('getAccountUsersByOrganisation', () => {
    it('should return all account users for an organization', async () => {
      const mockUsers = [
        {
          id: 'user-1',
          organization_id: 'org-1',
          keycloak_user_id: 'kc-user-1',
          email: 'user1@example.com',
          first_name: 'User',
          last_name: 'One',
          phone: '1234567890',
          status: 'active',
          last_login: null,
          created_at: new Date(),
          updated_at: new Date()
        }
      ];

      mockDb.query.mockResolvedValue({ rows: mockUsers } as any);

      const result = await service.getAccountUsersByOrganisation('org-1');

      expect(result).toHaveLength(1);
      expect(result[0].email).toBe('user1@example.com');
      expect(result[0].phone).toBe('1234567890');
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('user_type = \'account-user\''),
        ['org-1']
      );
    });

    it('should return empty array when no users found', async () => {
      mockDb.query.mockResolvedValue({ rows: [] } as any);

      const result = await service.getAccountUsersByOrganisation('org-1');

      expect(result).toEqual([]);
    });
  });

  describe('createAccountUser', () => {
    const mockOrgData = {
      id: 'org-1',
      keycloak_group_id: 'kc-group-1'
    };

    const mockMembersGroup = {
      id: 'members-group-1',
      name: 'members'
    };

    it('should create account user successfully', async () => {
      const userData = {
        email: 'newuser@example.com',
        firstName: 'New',
        lastName: 'User',
        phone: '1234567890',
        temporaryPassword: 'temp123'
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
            phone: userData.phone,
            status: 'active',
            created_at: new Date(),
            updated_at: new Date()
          }]
        } as any);

      mockClient.users.create.mockResolvedValue({ id: 'kc-user-1' });
      mockClient.groups.listSubGroups.mockResolvedValue([mockMembersGroup]);

      const result = await service.createAccountUser('org-1', userData, 'creator-1');

      expect(result.email).toBe(userData.email);
      expect(result.phone).toBe(userData.phone);
      expect(mockClient.users.create).toHaveBeenCalledWith(
        expect.objectContaining({
          email: userData.email,
          firstName: userData.firstName,
          lastName: userData.lastName,
          attributes: {
            phone: [userData.phone]
          }
        })
      );
      expect(mockClient.users.addToGroup).toHaveBeenCalledWith({
        id: 'kc-user-1',
        groupId: 'members-group-1'
      });
    });

    it('should create user without phone number', async () => {
      const userData = {
        email: 'newuser@example.com',
        firstName: 'New',
        lastName: 'User'
      };

      mockDb.query
        .mockResolvedValueOnce({ rows: [mockOrgData] } as any)
        .mockResolvedValueOnce({ rows: [] } as any)
        .mockResolvedValueOnce({
          rows: [{
            id: 'user-1',
            organization_id: 'org-1',
            keycloak_user_id: 'kc-user-1',
            email: userData.email,
            first_name: userData.firstName,
            last_name: userData.lastName,
            phone: null,
            status: 'active',
            created_at: new Date(),
            updated_at: new Date()
          }]
        } as any);

      mockClient.users.create.mockResolvedValue({ id: 'kc-user-1' });
      mockClient.groups.listSubGroups.mockResolvedValue([mockMembersGroup]);

      const result = await service.createAccountUser('org-1', userData);

      expect(result.phone).toBeNull();
    });

    it('should throw error if organization not found', async () => {
      mockDb.query.mockResolvedValue({ rows: [] } as any);

      await expect(
        service.createAccountUser('org-999', {
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
        service.createAccountUser('org-1', {
          email: 'existing@example.com',
          firstName: 'Existing',
          lastName: 'User'
        })
      ).rejects.toThrow('User with this email already exists in organization');
    });

    it('should rollback Keycloak user on database failure', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [mockOrgData] } as any)
        .mockResolvedValueOnce({ rows: [] } as any)
        .mockRejectedValueOnce(new Error('Database error'));

      mockClient.users.create.mockResolvedValue({ id: 'kc-user-1' });
      mockClient.groups.listSubGroups.mockResolvedValue([mockMembersGroup]);

      await expect(
        service.createAccountUser('org-1', {
          email: 'test@example.com',
          firstName: 'Test',
          lastName: 'User'
        })
      ).rejects.toThrow('Database error');

      expect(mockClient.users.del).toHaveBeenCalledWith({ id: 'kc-user-1' });
    });
  });

  describe('updateAccountUser', () => {
    it('should update account user successfully', async () => {
      const mockUser = {
        id: 'user-1',
        organization_id: 'org-1',
        keycloak_user_id: 'kc-user-1',
        email: 'user@example.com',
        first_name: 'User',
        last_name: 'Name',
        phone: '1234567890',
        status: 'active',
        created_at: new Date(),
        updated_at: new Date()
      };

      mockDb.query
        .mockResolvedValueOnce({ rows: [mockUser] } as any) // Get current user
        .mockResolvedValueOnce({ // Update user
          rows: [{
            ...mockUser,
            first_name: 'Updated',
            phone: '9876543210'
          }]
        } as any);

      const result = await service.updateAccountUser('user-1', {
        firstName: 'Updated',
        phone: '9876543210'
      });

      expect(result.firstName).toBe('Updated');
      expect(result.phone).toBe('9876543210');
      expect(mockClient.users.update).toHaveBeenCalledWith(
        { id: 'kc-user-1' },
        expect.objectContaining({
          firstName: 'Updated',
          attributes: {
            phone: ['9876543210']
          }
        })
      );
    });

    it('should update status', async () => {
      const mockUser = {
        id: 'user-1',
        organization_id: 'org-1',
        keycloak_user_id: 'kc-user-1',
        email: 'user@example.com',
        first_name: 'User',
        last_name: 'Name',
        status: 'active',
        created_at: new Date(),
        updated_at: new Date()
      };

      mockDb.query
        .mockResolvedValueOnce({ rows: [mockUser] } as any)
        .mockResolvedValueOnce({
          rows: [{ ...mockUser, status: 'inactive' }]
        } as any);

      const result = await service.updateAccountUser('user-1', {
        status: 'inactive'
      });

      expect(result.status).toBe('inactive');
    });

    it('should throw error if user not found', async () => {
      mockDb.query.mockResolvedValue({ rows: [] } as any);

      await expect(
        service.updateAccountUser('user-999', { firstName: 'Test' })
      ).rejects.toThrow('Account user not found');
    });
  });

  describe('deleteAccountUser', () => {
    it('should delete account user successfully', async () => {
      const mockUser = {
        id: 'user-1',
        keycloak_user_id: 'kc-user-1'
      };

      mockDb.query
        .mockResolvedValueOnce({ rows: [mockUser] } as any)
        .mockResolvedValueOnce({ rows: [] } as any);

      await service.deleteAccountUser('user-1');

      expect(mockClient.users.del).toHaveBeenCalledWith({ id: 'kc-user-1' });
      expect(mockDb.query).toHaveBeenCalledWith(
        'DELETE FROM organization_users WHERE id = $1',
        ['user-1']
      );
    });

    it('should throw error if user not found', async () => {
      mockDb.query.mockResolvedValue({ rows: [] } as any);

      await expect(
        service.deleteAccountUser('user-999')
      ).rejects.toThrow('Account user not found');
    });
  });

  describe('resetPassword', () => {
    it('should reset account user password', async () => {
      mockDb.query.mockResolvedValue({
        rows: [{ keycloak_user_id: 'kc-user-1' }]
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
      ).rejects.toThrow('Account user not found');
    });
  });
});
