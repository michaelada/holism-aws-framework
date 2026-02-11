import { UserService, CreateUserDto, UpdateUserDto, UserFilters } from '../../services/user.service';
import { KeycloakAdminService } from '../../services/keycloak-admin.service';
import { db } from '../../database/pool';

// Mock dependencies
jest.mock('../../services/keycloak-admin.service');
jest.mock('../../database/pool');

describe('UserService', () => {
  let userService: UserService;
  let mockKcAdmin: jest.Mocked<KeycloakAdminService>;
  let mockDb: jest.Mocked<typeof db>;
  let mockClient: any;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Create mock Keycloak client
    mockClient = {
      users: {
        create: jest.fn(),
        find: jest.fn(),
        findOne: jest.fn(),
        update: jest.fn(),
        del: jest.fn(),
        resetPassword: jest.fn(),
        addToGroup: jest.fn(),
        delFromGroup: jest.fn(),
        listGroups: jest.fn(),
        listRealmRoleMappings: jest.fn(),
        addRealmRoleMappings: jest.fn(),
        delRealmRoleMappings: jest.fn(),
      },
      roles: {
        findOneByName: jest.fn(),
      },
      groups: {
        listMembers: jest.fn(),
      },
    };

    // Create mock KeycloakAdminService
    mockKcAdmin = {
      ensureAuthenticated: jest.fn().mockResolvedValue(undefined),
      getClient: jest.fn().mockReturnValue(mockClient),
      authenticate: jest.fn(),
      isTokenExpired: jest.fn(),
    } as any;

    // Create mock database
    mockDb = {
      query: jest.fn(),
    } as any;

    // Create service instance
    userService = new UserService(mockKcAdmin, mockDb);
  });

  describe('createUser', () => {
    const createData: CreateUserDto = {
      username: 'testuser',
      email: 'test@example.com',
      firstName: 'Test',
      lastName: 'User',
      password: 'password123',
      temporaryPassword: false,
      emailVerified: true,
      phoneNumber: '+1234567890',
      department: 'Engineering',
      tenantId: 'tenant-123',
      roles: ['user', 'admin'],
    };

    it('should create user in Keycloak and database with all options', async () => {
      const mockUserId = 'keycloak-user-123';
      const mockDbUserId = 'db-user-456';
      const mockTenantGroupId = 'group-789';

      // Mock Keycloak user creation
      mockClient.users.create.mockResolvedValue({ id: mockUserId });

      // Mock tenant lookup
      mockDb.query.mockResolvedValueOnce({
        rows: [{ keycloak_group_id: mockTenantGroupId }],
      } as any);

      // Mock role lookups
      mockClient.roles.findOneByName
        .mockResolvedValueOnce({ id: 'role-1', name: 'user' })
        .mockResolvedValueOnce({ id: 'role-2', name: 'admin' });

      // Mock database insertion
      mockDb.query.mockResolvedValueOnce({
        rows: [{
          id: mockDbUserId,
          keycloak_user_id: mockUserId,
          tenant_id: createData.tenantId,
          username: createData.username,
          email: createData.email,
          preferences: {},
          last_login: null,
          created_at: new Date(),
          updated_at: new Date(),
        }],
      } as any);

      // Mock mapDbRowToUser dependencies
      mockClient.users.findOne.mockResolvedValue({
        id: mockUserId,
        username: createData.username,
        email: createData.email,
        firstName: createData.firstName,
        lastName: createData.lastName,
        enabled: true,
        emailVerified: true,
        attributes: {
          phoneNumber: [createData.phoneNumber],
          department: [createData.department],
        },
      });

      mockClient.users.listRealmRoleMappings.mockResolvedValue([
        { id: 'role-1', name: 'user', composite: false },
        { id: 'role-2', name: 'admin', composite: false },
      ]);

      mockClient.users.listGroups.mockResolvedValue([
        { id: mockTenantGroupId, name: 'tenant-group' },
      ]);

      mockDb.query.mockResolvedValueOnce({
        rows: [{ id: createData.tenantId }],
      } as any);

      const result = await userService.createUser(createData);

      // Verify Keycloak user creation
      expect(mockKcAdmin.ensureAuthenticated).toHaveBeenCalled();
      expect(mockClient.users.create).toHaveBeenCalledWith({
        username: createData.username,
        email: createData.email,
        firstName: createData.firstName,
        lastName: createData.lastName,
        enabled: true,
        emailVerified: true,
        attributes: {
          phoneNumber: [createData.phoneNumber],
          department: [createData.department],
        },
      });

      // Verify password was set
      expect(mockClient.users.resetPassword).toHaveBeenCalledWith({
        id: mockUserId,
        credential: {
          temporary: false,
          type: 'password',
          value: createData.password,
        },
      });

      // Verify user was added to tenant group
      expect(mockClient.users.addToGroup).toHaveBeenCalledWith({
        id: mockUserId,
        groupId: mockTenantGroupId,
      });

      // Verify roles were assigned
      expect(mockClient.users.addRealmRoleMappings).toHaveBeenCalledTimes(2);

      // Verify database insertion
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO users'),
        [mockUserId, createData.tenantId, createData.username, createData.email, '{}']
      );

      // Verify result
      expect(result).toMatchObject({
        id: mockDbUserId,
        keycloakUserId: mockUserId,
        username: createData.username,
        email: createData.email,
      });
    });

    it('should create user without optional fields', async () => {
      const minimalData: CreateUserDto = {
        username: 'testuser',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
      };

      const mockUserId = 'keycloak-user-123';
      mockClient.users.create.mockResolvedValue({ id: mockUserId });

      mockDb.query.mockResolvedValueOnce({
        rows: [{
          id: 'db-user-456',
          keycloak_user_id: mockUserId,
          tenant_id: null,
          username: minimalData.username,
          email: minimalData.email,
          preferences: {},
          last_login: null,
          created_at: new Date(),
          updated_at: new Date(),
        }],
      } as any);

      mockClient.users.findOne.mockResolvedValue({
        id: mockUserId,
        username: minimalData.username,
        email: minimalData.email,
        firstName: minimalData.firstName,
        lastName: minimalData.lastName,
        enabled: true,
        emailVerified: false,
      });

      mockClient.users.listRealmRoleMappings.mockResolvedValue([]);
      mockClient.users.listGroups.mockResolvedValue([]);

      await userService.createUser(minimalData);

      expect(mockClient.users.create).toHaveBeenCalledWith({
        username: minimalData.username,
        email: minimalData.email,
        firstName: minimalData.firstName,
        lastName: minimalData.lastName,
        enabled: true,
        emailVerified: false,
        attributes: {
          phoneNumber: [],
          department: [],
        },
      });

      expect(mockClient.users.resetPassword).not.toHaveBeenCalled();
      expect(mockClient.users.addToGroup).not.toHaveBeenCalled();
    });

    it('should rollback Keycloak user if database fails', async () => {
      const mockUserId = 'keycloak-user-123';
      mockClient.users.create.mockResolvedValue({ id: mockUserId });
      mockDb.query.mockRejectedValue(new Error('Database error'));

      await expect(userService.createUser(createData)).rejects.toThrow('Database error');

      // Verify rollback was attempted
      expect(mockClient.users.del).toHaveBeenCalledWith({ id: mockUserId });
    });

    it('should throw error if Keycloak user creation fails', async () => {
      mockClient.users.create.mockRejectedValue(new Error('Keycloak error'));

      await expect(userService.createUser(createData)).rejects.toThrow('Keycloak error');

      // Verify database was not called
      expect(mockDb.query).not.toHaveBeenCalled();
    });
  });

  describe('getUsers', () => {
    it('should list all users', async () => {
      const mockKcUsers = [
        {
          id: 'kc-user-1',
          username: 'user1',
          email: 'user1@example.com',
          firstName: 'User',
          lastName: 'One',
          enabled: true,
          emailVerified: true,
        },
        {
          id: 'kc-user-2',
          username: 'user2',
          email: 'user2@example.com',
          firstName: 'User',
          lastName: 'Two',
          enabled: true,
          emailVerified: false,
        },
      ];

      mockClient.users.find.mockResolvedValue(mockKcUsers);

      // Mock database lookups for each user
      mockDb.query
        .mockResolvedValueOnce({
          rows: [{
            id: 'db-user-1',
            keycloak_user_id: 'kc-user-1',
            tenant_id: 'tenant-1',
            username: 'user1',
            email: 'user1@example.com',
            preferences: {},
            last_login: null,
            created_at: new Date(),
            updated_at: new Date(),
          }],
        } as any)
        .mockResolvedValueOnce({
          rows: [{
            id: 'db-user-2',
            keycloak_user_id: 'kc-user-2',
            tenant_id: null,
            username: 'user2',
            email: 'user2@example.com',
            preferences: {},
            last_login: null,
            created_at: new Date(),
            updated_at: new Date(),
          }],
        } as any);

      // Mock mapDbRowToUser dependencies for each user
      mockClient.users.findOne
        .mockResolvedValueOnce(mockKcUsers[0])
        .mockResolvedValueOnce(mockKcUsers[1]);

      mockClient.users.listRealmRoleMappings
        .mockResolvedValueOnce([{ id: 'role-1', name: 'user', composite: false }])
        .mockResolvedValueOnce([]);

      mockClient.users.listGroups
        .mockResolvedValueOnce([{ id: 'group-1', name: 'tenant-group' }])
        .mockResolvedValueOnce([]);

      mockDb.query
        .mockResolvedValueOnce({ rows: [{ id: 'tenant-1' }] } as any)
        .mockResolvedValueOnce({ rows: [] } as any);

      const result = await userService.getUsers();

      expect(mockClient.users.find).toHaveBeenCalledWith({
        max: 100,
        first: 0,
      });

      expect(result).toHaveLength(2);
      expect(result[0].username).toBe('user1');
      expect(result[1].username).toBe('user2');
    });

    it('should filter users by search term', async () => {
      const filters: UserFilters = { search: 'john' };

      mockClient.users.find.mockResolvedValue([
        {
          id: 'kc-user-1',
          username: 'john.doe',
          email: 'john@example.com',
          firstName: 'John',
          lastName: 'Doe',
          enabled: true,
        },
      ]);

      mockDb.query.mockResolvedValue({
        rows: [{
          id: 'db-user-1',
          keycloak_user_id: 'kc-user-1',
          tenant_id: null,
          username: 'john.doe',
          email: 'john@example.com',
          preferences: {},
          last_login: null,
          created_at: new Date(),
          updated_at: new Date(),
        }],
      } as any);

      mockClient.users.findOne.mockResolvedValue({
        id: 'kc-user-1',
        username: 'john.doe',
        email: 'john@example.com',
        firstName: 'John',
        lastName: 'Doe',
        enabled: true,
      });

      mockClient.users.listRealmRoleMappings.mockResolvedValue([]);
      mockClient.users.listGroups.mockResolvedValue([]);

      await userService.getUsers(filters);

      expect(mockClient.users.find).toHaveBeenCalledWith({ search: 'john' });
    });

    it('should filter users by tenant', async () => {
      const filters: UserFilters = { tenantId: 'tenant-123' };
      const mockGroupId = 'group-456';

      mockClient.users.find.mockResolvedValue([
        { id: 'kc-user-1', username: 'user1', email: 'user1@example.com' },
        { id: 'kc-user-2', username: 'user2', email: 'user2@example.com' },
      ]);

      // Mock tenant lookup
      mockDb.query.mockResolvedValueOnce({
        rows: [{ keycloak_group_id: mockGroupId }],
      } as any);

      // Mock group members (only user1 is in the group)
      mockClient.groups.listMembers.mockResolvedValue([
        { id: 'kc-user-1' },
      ]);

      // Mock database lookup for user1
      mockDb.query.mockResolvedValueOnce({
        rows: [{
          id: 'db-user-1',
          keycloak_user_id: 'kc-user-1',
          tenant_id: 'tenant-123',
          username: 'user1',
          email: 'user1@example.com',
          preferences: {},
          last_login: null,
          created_at: new Date(),
          updated_at: new Date(),
        }],
      } as any);

      mockClient.users.findOne.mockResolvedValue({
        id: 'kc-user-1',
        username: 'user1',
        email: 'user1@example.com',
        enabled: true,
      });

      mockClient.users.listRealmRoleMappings.mockResolvedValue([]);
      mockClient.users.listGroups.mockResolvedValue([{ id: mockGroupId }]);
      mockDb.query.mockResolvedValueOnce({ rows: [{ id: 'tenant-123' }] } as any);

      const result = await userService.getUsers(filters);

      expect(result).toHaveLength(1);
      expect(result[0].username).toBe('user1');
    });
  });

  describe('getUserById', () => {
    it('should get user by ID', async () => {
      const mockUser = {
        id: 'db-user-1',
        keycloak_user_id: 'kc-user-1',
        tenant_id: 'tenant-1',
        username: 'testuser',
        email: 'test@example.com',
        preferences: {},
        last_login: null,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockDb.query.mockResolvedValueOnce({ rows: [mockUser] } as any);

      mockClient.users.findOne.mockResolvedValue({
        id: 'kc-user-1',
        username: 'testuser',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        enabled: true,
        emailVerified: true,
      });

      mockClient.users.listRealmRoleMappings.mockResolvedValue([
        { id: 'role-1', name: 'user', composite: false },
      ]);

      mockClient.users.listGroups.mockResolvedValue([
        { id: 'group-1', name: 'tenant-group' },
      ]);

      mockDb.query.mockResolvedValueOnce({ rows: [{ id: 'tenant-1' }] } as any);

      const result = await userService.getUserById('db-user-1');

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE id = $1'),
        ['db-user-1']
      );

      expect(result).toMatchObject({
        id: 'db-user-1',
        keycloakUserId: 'kc-user-1',
        username: 'testuser',
      });
    });

    it('should throw error if user not found', async () => {
      mockDb.query.mockResolvedValue({ rows: [] } as any);

      await expect(userService.getUserById('non-existent')).rejects.toThrow(
        'User not found: non-existent'
      );
    });
  });

  describe('updateUser', () => {
    const mockExistingUser = {
      id: 'db-user-1',
      keycloak_user_id: 'kc-user-1',
      tenant_id: 'tenant-1',
      username: 'testuser',
      email: 'old@example.com',
      preferences: {},
      last_login: null,
      created_at: new Date(),
      updated_at: new Date(),
    };

    beforeEach(() => {
      // Mock getUserById
      mockDb.query.mockResolvedValueOnce({ rows: [mockExistingUser] } as any);

      mockClient.users.findOne.mockResolvedValue({
        id: 'kc-user-1',
        username: 'testuser',
        email: 'old@example.com',
        firstName: 'Test',
        lastName: 'User',
        enabled: true,
      });

      mockClient.users.listRealmRoleMappings.mockResolvedValue([]);
      mockClient.users.listGroups.mockResolvedValue([{ id: 'group-1' }]);
      mockDb.query.mockResolvedValueOnce({ rows: [{ id: 'tenant-1' }] } as any);
    });

    it('should update user in both Keycloak and database', async () => {
      const updates: UpdateUserDto = {
        email: 'new@example.com',
        firstName: 'New',
        lastName: 'Name',
      };

      const updatedUser = {
        ...mockExistingUser,
        email: updates.email,
      };

      mockDb.query.mockResolvedValueOnce({ rows: [updatedUser] } as any);

      mockClient.users.findOne.mockResolvedValue({
        id: 'kc-user-1',
        username: 'testuser',
        email: updates.email,
        firstName: updates.firstName,
        lastName: updates.lastName,
        enabled: true,
      });

      mockClient.users.listRealmRoleMappings.mockResolvedValue([]);
      mockClient.users.listGroups.mockResolvedValue([{ id: 'group-1' }]);
      mockDb.query.mockResolvedValueOnce({ rows: [{ id: 'tenant-1' }] } as any);

      await userService.updateUser('db-user-1', updates);

      // Verify Keycloak update
      expect(mockClient.users.update).toHaveBeenCalledWith(
        { id: 'kc-user-1' },
        {
          email: updates.email,
          firstName: updates.firstName,
          lastName: updates.lastName,
          enabled: undefined,
          attributes: {
            phoneNumber: undefined,
            department: undefined,
          },
        }
      );

      // Verify database update
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE users'),
        expect.arrayContaining([updates.email, 'db-user-1'])
      );
    });

    it('should update tenant association', async () => {
      const updates: UpdateUserDto = {
        tenantId: 'tenant-2',
      };

      // Mock old tenant lookup
      mockDb.query.mockResolvedValueOnce({
        rows: [{ keycloak_group_id: 'old-group-id' }],
      } as any);

      // Mock new tenant lookup
      mockDb.query.mockResolvedValueOnce({
        rows: [{ keycloak_group_id: 'new-group-id' }],
      } as any);

      const updatedUser = {
        ...mockExistingUser,
        tenant_id: updates.tenantId,
      };

      mockDb.query.mockResolvedValueOnce({ rows: [updatedUser] } as any);

      mockClient.users.findOne.mockResolvedValue({
        id: 'kc-user-1',
        username: 'testuser',
        email: 'old@example.com',
        enabled: true,
      });

      mockClient.users.listRealmRoleMappings.mockResolvedValue([]);
      mockClient.users.listGroups.mockResolvedValue([{ id: 'new-group-id' }]);
      mockDb.query.mockResolvedValueOnce({ rows: [{ id: 'tenant-2' }] } as any);

      await userService.updateUser('db-user-1', updates);

      // Verify user was removed from old group
      expect(mockClient.users.delFromGroup).toHaveBeenCalledWith({
        id: 'kc-user-1',
        groupId: 'old-group-id',
      });

      // Verify user was added to new group
      expect(mockClient.users.addToGroup).toHaveBeenCalledWith({
        id: 'kc-user-1',
        groupId: 'new-group-id',
      });
    });
  });

  describe('deleteUser', () => {
    it('should delete user from both Keycloak and database', async () => {
      const mockUser = {
        id: 'db-user-1',
        keycloak_user_id: 'kc-user-1',
        tenant_id: null,
        username: 'testuser',
        email: 'test@example.com',
        preferences: {},
        last_login: null,
        created_at: new Date(),
        updated_at: new Date(),
      };

      // Mock getUserById
      mockDb.query.mockResolvedValueOnce({ rows: [mockUser] } as any);

      mockClient.users.findOne.mockResolvedValue({
        id: 'kc-user-1',
        username: 'testuser',
        email: 'test@example.com',
        enabled: true,
      });

      mockClient.users.listRealmRoleMappings.mockResolvedValue([]);
      mockClient.users.listGroups.mockResolvedValue([]);

      // Mock delete
      mockDb.query.mockResolvedValueOnce({ rows: [] } as any);

      await userService.deleteUser('db-user-1');

      // Verify Keycloak deletion
      expect(mockClient.users.del).toHaveBeenCalledWith({ id: 'kc-user-1' });

      // Verify database deletion
      expect(mockDb.query).toHaveBeenCalledWith(
        'DELETE FROM users WHERE id = $1',
        ['db-user-1']
      );
    });
  });

  describe('resetPassword', () => {
    it('should reset password with temporary flag', async () => {
      const mockUser = {
        id: 'db-user-1',
        keycloak_user_id: 'kc-user-1',
        tenant_id: null,
        username: 'testuser',
        email: 'test@example.com',
        preferences: {},
        last_login: null,
        created_at: new Date(),
        updated_at: new Date(),
      };

      // Mock getUserById
      mockDb.query.mockResolvedValue({ rows: [mockUser] } as any);

      mockClient.users.findOne.mockResolvedValue({
        id: 'kc-user-1',
        username: 'testuser',
        email: 'test@example.com',
        enabled: true,
      });

      mockClient.users.listRealmRoleMappings.mockResolvedValue([]);
      mockClient.users.listGroups.mockResolvedValue([]);

      await userService.resetPassword('db-user-1', 'newpassword', true);

      expect(mockClient.users.resetPassword).toHaveBeenCalledWith({
        id: 'kc-user-1',
        credential: {
          temporary: true,
          type: 'password',
          value: 'newpassword',
        },
      });
    });
  });

  describe('assignRoleToUser', () => {
    it('should assign role to user', async () => {
      const mockRole = { id: 'role-1', name: 'admin' };

      mockClient.roles.findOneByName.mockResolvedValue(mockRole);

      await userService.assignRoleToUser('kc-user-1', 'admin');

      expect(mockClient.roles.findOneByName).toHaveBeenCalledWith({ name: 'admin' });
      expect(mockClient.users.addRealmRoleMappings).toHaveBeenCalledWith({
        id: 'kc-user-1',
        roles: [{ id: 'role-1', name: 'admin' }],
      });
    });

    it('should throw error if role not found', async () => {
      mockClient.roles.findOneByName.mockResolvedValue(null);

      await expect(
        userService.assignRoleToUser('kc-user-1', 'nonexistent')
      ).rejects.toThrow('Role not found: nonexistent');
    });
  });

  describe('removeRoleFromUser', () => {
    it('should remove role from user', async () => {
      const mockRole = { id: 'role-1', name: 'admin' };

      mockClient.roles.findOneByName.mockResolvedValue(mockRole);

      await userService.removeRoleFromUser('kc-user-1', 'admin');

      expect(mockClient.roles.findOneByName).toHaveBeenCalledWith({ name: 'admin' });
      expect(mockClient.users.delRealmRoleMappings).toHaveBeenCalledWith({
        id: 'kc-user-1',
        roles: [{ id: 'role-1', name: 'admin' }],
      });
    });
  });
});
