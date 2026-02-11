import { RoleService, CreateRoleDto } from '../../services/role.service';
import { KeycloakAdminService } from '../../services/keycloak-admin.service';
import { db } from '../../database/pool';

// Mock dependencies
jest.mock('../../services/keycloak-admin.service');
jest.mock('../../database/pool');

describe('RoleService', () => {
  let roleService: RoleService;
  let mockKcAdmin: jest.Mocked<KeycloakAdminService>;
  let mockDb: jest.Mocked<typeof db>;
  let mockClient: any;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Create mock Keycloak client
    mockClient = {
      roles: {
        create: jest.fn(),
        find: jest.fn(),
        findOneByName: jest.fn(),
        delByName: jest.fn(),
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
    roleService = new RoleService(mockKcAdmin, mockDb);
  });

  describe('createRole', () => {
    const createData: CreateRoleDto = {
      name: 'test-role',
      displayName: 'Test Role',
      description: 'A test role',
      permissions: ['read:users', 'write:users'],
    };

    it('should create role in Keycloak and database', async () => {
      const mockRoleId = 'keycloak-role-123';
      const mockDbId = 'db-role-456';

      // Mock Keycloak role creation
      mockClient.roles.create.mockResolvedValue(undefined);
      mockClient.roles.findOneByName.mockResolvedValue({
        id: mockRoleId,
        name: createData.name,
        description: createData.description,
        composite: false,
      });

      // Mock database insertion
      mockDb.query.mockResolvedValue({
        rows: [
          {
            id: mockDbId,
            keycloak_role_id: mockRoleId,
            name: createData.name,
            display_name: createData.displayName,
            description: createData.description,
            permissions: JSON.stringify(createData.permissions),
            created_at: new Date(),
            updated_at: new Date(),
          },
        ],
      } as any);

      const result = await roleService.createRole(createData);

      // Verify Keycloak role creation
      expect(mockKcAdmin.ensureAuthenticated).toHaveBeenCalled();
      expect(mockClient.roles.create).toHaveBeenCalledWith({
        name: createData.name,
        description: createData.description,
        attributes: {
          displayName: [createData.displayName],
          permissions: createData.permissions,
        },
      });

      // Verify role lookup
      expect(mockClient.roles.findOneByName).toHaveBeenCalledWith({
        name: createData.name,
      });

      // Verify database insertion
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO roles'),
        [
          mockRoleId,
          createData.name,
          createData.displayName,
          createData.description,
          JSON.stringify(createData.permissions),
        ]
      );

      // Verify result
      expect(result).toMatchObject({
        id: mockDbId,
        keycloakRoleId: mockRoleId,
        name: createData.name,
        displayName: createData.displayName,
        description: createData.description,
        permissions: createData.permissions,
      });
    });

    it('should create role without description and permissions', async () => {
      const dataWithoutOptionals: CreateRoleDto = {
        name: 'simple-role',
        displayName: 'Simple Role',
      };

      const mockRoleId = 'keycloak-role-123';
      mockClient.roles.create.mockResolvedValue(undefined);
      mockClient.roles.findOneByName.mockResolvedValue({
        id: mockRoleId,
        name: dataWithoutOptionals.name,
        composite: false,
      });

      mockDb.query.mockResolvedValue({
        rows: [
          {
            id: 'db-role-456',
            keycloak_role_id: mockRoleId,
            name: dataWithoutOptionals.name,
            display_name: dataWithoutOptionals.displayName,
            description: null,
            permissions: JSON.stringify([]),
            created_at: new Date(),
            updated_at: new Date(),
          },
        ],
      } as any);

      const result = await roleService.createRole(dataWithoutOptionals);

      expect(mockClient.roles.create).toHaveBeenCalledWith({
        name: dataWithoutOptionals.name,
        description: undefined,
        attributes: {
          displayName: [dataWithoutOptionals.displayName],
          permissions: [],
        },
      });

      expect(result.description).toBeNull();
      expect(result.permissions).toEqual([]);
    });

    it('should rollback Keycloak role if database fails', async () => {
      const mockRoleId = 'keycloak-role-123';
      mockClient.roles.create.mockResolvedValue(undefined);
      mockClient.roles.findOneByName.mockResolvedValue({
        id: mockRoleId,
        name: createData.name,
      });
      mockDb.query.mockRejectedValue(new Error('Database error'));

      await expect(roleService.createRole(createData)).rejects.toThrow('Database error');

      // Verify rollback was attempted
      expect(mockClient.roles.delByName).toHaveBeenCalledWith({ name: createData.name });
    });

    it('should throw error if Keycloak role creation fails', async () => {
      mockClient.roles.create.mockRejectedValue(new Error('Keycloak error'));

      await expect(roleService.createRole(createData)).rejects.toThrow('Keycloak error');

      // Verify database was not called
      expect(mockDb.query).not.toHaveBeenCalled();
    });

    it('should throw error if role ID is not returned', async () => {
      mockClient.roles.create.mockResolvedValue(undefined);
      mockClient.roles.findOneByName.mockResolvedValue({ id: undefined });

      await expect(roleService.createRole(createData)).rejects.toThrow(
        'Failed to get role ID from Keycloak'
      );
    });

    it('should store custom permissions as attributes', async () => {
      const dataWithPermissions: CreateRoleDto = {
        name: 'admin-role',
        displayName: 'Admin Role',
        permissions: ['admin:all', 'read:all', 'write:all', 'delete:all'],
      };

      const mockRoleId = 'keycloak-role-123';
      mockClient.roles.create.mockResolvedValue(undefined);
      mockClient.roles.findOneByName.mockResolvedValue({
        id: mockRoleId,
        name: dataWithPermissions.name,
      });

      mockDb.query.mockResolvedValue({
        rows: [
          {
            id: 'db-role-456',
            keycloak_role_id: mockRoleId,
            name: dataWithPermissions.name,
            display_name: dataWithPermissions.displayName,
            description: null,
            permissions: JSON.stringify(dataWithPermissions.permissions),
            created_at: new Date(),
            updated_at: new Date(),
          },
        ],
      } as any);

      await roleService.createRole(dataWithPermissions);

      // Verify permissions are stored as attributes in Keycloak
      expect(mockClient.roles.create).toHaveBeenCalledWith({
        name: dataWithPermissions.name,
        description: undefined,
        attributes: {
          displayName: [dataWithPermissions.displayName],
          permissions: dataWithPermissions.permissions,
        },
      });

      // Verify permissions are stored in database
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO roles'),
        expect.arrayContaining([JSON.stringify(dataWithPermissions.permissions)])
      );
    });
  });

  describe('getRoles', () => {
    it('should list all roles from Keycloak', async () => {
      const mockKcRoles = [
        {
          id: 'role-1',
          name: 'role-one',
          description: 'Role One',
          composite: false,
          attributes: {
            displayName: ['Role One Display'],
            permissions: ['read:users'],
          },
        },
        {
          id: 'role-2',
          name: 'role-two',
          description: 'Role Two',
          composite: true,
          attributes: {
            displayName: ['Role Two Display'],
            permissions: ['write:users'],
          },
        },
      ];

      mockClient.roles.find.mockResolvedValue(mockKcRoles);

      // Mock database queries for each role
      mockDb.query
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'db-role-1',
              keycloak_role_id: 'role-1',
              name: 'role-one',
              display_name: 'Role One Display',
              description: 'Role One',
              permissions: JSON.stringify(['read:users']),
              created_at: new Date(),
              updated_at: new Date(),
            },
          ],
        } as any)
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'db-role-2',
              keycloak_role_id: 'role-2',
              name: 'role-two',
              display_name: 'Role Two Display',
              description: 'Role Two',
              permissions: JSON.stringify(['write:users']),
              created_at: new Date(),
              updated_at: new Date(),
            },
          ],
        } as any);

      const result = await roleService.getRoles();

      expect(mockKcAdmin.ensureAuthenticated).toHaveBeenCalled();
      expect(mockClient.roles.find).toHaveBeenCalled();

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        id: 'db-role-1',
        keycloakRoleId: 'role-1',
        name: 'role-one',
        displayName: 'Role One Display',
        permissions: ['read:users'],
      });
      expect(result[1]).toMatchObject({
        id: 'db-role-2',
        keycloakRoleId: 'role-2',
        name: 'role-two',
        displayName: 'Role Two Display',
        permissions: ['write:users'],
      });
    });

    it('should handle roles not in database', async () => {
      const mockKcRoles = [
        {
          id: 'role-1',
          name: 'role-one',
          description: 'Role One',
          composite: false,
          attributes: {
            displayName: ['Role One Display'],
            permissions: ['read:users'],
          },
        },
      ];

      mockClient.roles.find.mockResolvedValue(mockKcRoles);
      mockDb.query.mockResolvedValue({ rows: [] } as any);

      const result = await roleService.getRoles();

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: '',
        keycloakRoleId: 'role-1',
        name: 'role-one',
        displayName: 'Role One Display',
        permissions: ['read:users'],
      });
    });

    it('should return empty array when no roles exist', async () => {
      mockClient.roles.find.mockResolvedValue([]);

      const result = await roleService.getRoles();

      expect(result).toEqual([]);
    });

    it('should skip roles without ID or name', async () => {
      const mockKcRoles = [
        { id: 'role-1', name: 'role-one' },
        { id: undefined, name: 'role-two' },
        { id: 'role-3', name: undefined },
      ];

      mockClient.roles.find.mockResolvedValue(mockKcRoles);
      mockDb.query.mockResolvedValue({ rows: [] } as any);

      const result = await roleService.getRoles();

      expect(result).toHaveLength(1);
      expect(result[0].keycloakRoleId).toBe('role-1');
    });
  });

  describe('getRoleById', () => {
    it('should get role by ID with Keycloak data', async () => {
      const mockRole = {
        id: 'db-role-1',
        keycloak_role_id: 'role-1',
        name: 'role-one',
        display_name: 'Role One',
        description: 'Role One Description',
        permissions: JSON.stringify(['read:users', 'write:users']),
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockDb.query.mockResolvedValue({ rows: [mockRole] } as any);
      mockClient.roles.findOneByName.mockResolvedValue({
        id: 'role-1',
        name: 'role-one',
        composite: true,
      });

      const result = await roleService.getRoleById('db-role-1');

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE id = $1'),
        ['db-role-1']
      );

      expect(mockClient.roles.findOneByName).toHaveBeenCalledWith({
        name: 'role-one',
      });

      expect(result).toMatchObject({
        id: 'db-role-1',
        keycloakRoleId: 'role-1',
        name: 'role-one',
        displayName: 'Role One',
        description: 'Role One Description',
        permissions: ['read:users', 'write:users'],
        composite: true,
      });
    });

    it('should throw error if role not found', async () => {
      mockDb.query.mockResolvedValue({ rows: [] } as any);

      await expect(roleService.getRoleById('non-existent')).rejects.toThrow(
        'Role not found: non-existent'
      );
    });

    it('should handle missing Keycloak role gracefully', async () => {
      const mockRole = {
        id: 'db-role-1',
        keycloak_role_id: 'role-1',
        name: 'role-one',
        display_name: 'Role One',
        description: null,
        permissions: JSON.stringify([]),
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockDb.query.mockResolvedValue({ rows: [mockRole] } as any);
      mockClient.roles.findOneByName.mockResolvedValue(null);

      const result = await roleService.getRoleById('db-role-1');

      expect(result.composite).toBe(false);
    });
  });

  describe('deleteRole', () => {
    const mockRole = {
      id: 'db-role-1',
      keycloak_role_id: 'role-1',
      name: 'role-one',
      display_name: 'Role One',
      description: 'Role One Description',
      permissions: JSON.stringify(['read:users']),
      created_at: new Date(),
      updated_at: new Date(),
    };

    it('should delete role from both Keycloak and database', async () => {
      // Mock getRoleById
      mockDb.query.mockResolvedValueOnce({ rows: [mockRole] } as any);
      mockClient.roles.findOneByName.mockResolvedValue({
        id: 'role-1',
        name: 'role-one',
        composite: false,
      });

      // Mock delete
      mockDb.query.mockResolvedValueOnce({ rows: [] } as any);

      await roleService.deleteRole('db-role-1');

      // Verify Keycloak deletion
      expect(mockClient.roles.delByName).toHaveBeenCalledWith({ name: 'role-one' });

      // Verify database deletion
      expect(mockDb.query).toHaveBeenCalledWith('DELETE FROM roles WHERE id = $1', [
        'db-role-1',
      ]);
    });

    it('should throw error if role not found', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [] } as any);

      await expect(roleService.deleteRole('non-existent')).rejects.toThrow('Role not found');

      expect(mockClient.roles.delByName).not.toHaveBeenCalled();
    });

    it('should delete role from both stores in correct order', async () => {
      // Mock getRoleById
      mockDb.query.mockResolvedValueOnce({ rows: [mockRole] } as any);
      mockClient.roles.findOneByName.mockResolvedValue({
        id: 'role-1',
        name: 'role-one',
      });

      // Mock delete
      mockDb.query.mockResolvedValueOnce({ rows: [] } as any);

      await roleService.deleteRole('db-role-1');

      // Verify deletion order (Keycloak first, then database)
      const delCallOrder = mockClient.roles.delByName.mock.invocationCallOrder[0];
      const dbDeleteCallOrder = mockDb.query.mock.invocationCallOrder[1]; // Second query call
      expect(delCallOrder).toBeLessThan(dbDeleteCallOrder);
    });
  });
});
