import * as fc from 'fast-check';
import { RoleService, CreateRoleDto } from '../../services/role.service';
import { KeycloakAdminService } from '../../services/keycloak-admin.service';
import { UserService } from '../../services/user.service';
import { db } from '../../database/pool';

// Mock dependencies
jest.mock('../../services/keycloak-admin.service');
jest.mock('../../database/pool');

/**
 * Feature: keycloak-admin-integration, Property 13: Role Creation Dual-Store Consistency
 * 
 * For any valid role creation request, the system should create both a realm role
 * in Keycloak and a database record with consistent information.
 * 
 * Validates: Requirements 4.1, 4.2
 */
describe('Property 13: Role Creation Dual-Store Consistency', () => {
  let roleService: RoleService;
  let mockKcAdmin: jest.Mocked<KeycloakAdminService>;
  let mockDb: jest.Mocked<typeof db>;
  let mockClient: any;

  const roleDataArbitrary = fc.record({
    name: fc.string({ minLength: 1, maxLength: 50 }).filter(s => /^[a-z0-9-_]+$/.test(s)),
    displayName: fc.string({ minLength: 1, maxLength: 100 }),
    description: fc.option(fc.string({ minLength: 1, maxLength: 255 }), { nil: undefined }),
    permissions: fc.option(
      fc.array(fc.string({ minLength: 1, maxLength: 50 }), { minLength: 0, maxLength: 10 }),
      { nil: undefined }
    ),
  });

  beforeEach(() => {
    jest.clearAllMocks();

    mockClient = {
      roles: {
        create: jest.fn(),
        findOneByName: jest.fn(),
        delByName: jest.fn(),
      },
    };

    mockKcAdmin = {
      ensureAuthenticated: jest.fn().mockResolvedValue(undefined),
      getClient: jest.fn().mockReturnValue(mockClient),
      authenticate: jest.fn(),
      isTokenExpired: jest.fn(),
    } as any;

    mockDb = {
      query: jest.fn(),
    } as any;

    roleService = new RoleService(mockKcAdmin, mockDb);
  });

  test('creates role in both Keycloak and database with consistent data', async () => {
    await fc.assert(
      fc.asyncProperty(roleDataArbitrary, async (roleData: CreateRoleDto) => {
        // Reset mocks for each iteration
        mockClient.roles.create.mockClear();
        mockClient.roles.findOneByName.mockClear();
        mockDb.query.mockClear();

        const mockRoleId = `role-${Math.random().toString(36).substring(7)}`;
        const mockDbId = `db-role-${Math.random().toString(36).substring(7)}`;

        // Mock Keycloak role creation
        mockClient.roles.create.mockResolvedValue(undefined);
        mockClient.roles.findOneByName.mockResolvedValue({
          id: mockRoleId,
          name: roleData.name,
          description: roleData.description,
          composite: false,
        });

        // Mock database insertion
        mockDb.query.mockResolvedValue({
          rows: [
            {
              id: mockDbId,
              keycloak_role_id: mockRoleId,
              name: roleData.name,
              display_name: roleData.displayName,
              description: roleData.description || null,
              permissions: JSON.stringify(roleData.permissions || []),
              created_at: new Date(),
              updated_at: new Date(),
            },
          ],
        } as any);

        const result = await roleService.createRole(roleData);

        // Property 1: Keycloak realm role must be created
        expect(mockClient.roles.create).toHaveBeenCalledTimes(1);
        expect(mockClient.roles.create).toHaveBeenCalledWith({
          name: roleData.name,
          description: roleData.description,
          attributes: {
            displayName: [roleData.displayName],
            permissions: roleData.permissions || [],
          },
        });

        // Property 2: Database record must be created with Keycloak role ID
        expect(mockDb.query).toHaveBeenCalledWith(
          expect.stringContaining('INSERT INTO roles'),
          [
            mockRoleId,
            roleData.name,
            roleData.displayName,
            roleData.description || null,
            JSON.stringify(roleData.permissions || []),
          ]
        );

        // Property 3: Result must contain consistent data from both stores
        expect(result.keycloakRoleId).toBe(mockRoleId);
        expect(result.name).toBe(roleData.name);
        expect(result.displayName).toBe(roleData.displayName);
        expect(result.description).toBe(roleData.description || null);
        expect(result.permissions).toEqual(roleData.permissions || []);
      }),
      { numRuns: 100 }
    );
  });

  test('rolls back Keycloak role if database creation fails', async () => {
    await fc.assert(
      fc.asyncProperty(roleDataArbitrary, async (roleData: CreateRoleDto) => {
        mockClient.roles.create.mockClear();
        mockClient.roles.findOneByName.mockClear();
        mockClient.roles.delByName.mockClear();
        mockDb.query.mockClear();

        const mockRoleId = `role-${Math.random().toString(36).substring(7)}`;

        // Mock Keycloak role creation success
        mockClient.roles.create.mockResolvedValue(undefined);
        mockClient.roles.findOneByName.mockResolvedValue({
          id: mockRoleId,
          name: roleData.name,
        });

        // Mock database insertion failure
        mockDb.query.mockRejectedValue(new Error('Database constraint violation'));

        // Attempt to create role should fail
        await expect(roleService.createRole(roleData)).rejects.toThrow();

        // Property: Keycloak role must be rolled back
        expect(mockClient.roles.delByName).toHaveBeenCalledWith({ name: roleData.name });
      }),
      { numRuns: 100 }
    );
  });
});

/**
 * Feature: keycloak-admin-integration, Property 14: Role Assignment Creates Mapping
 * 
 * For any role assignment request, the system should create a realm role mapping
 * in Keycloak associating the user with the role.
 * 
 * Validates: Requirements 4.4
 */
describe('Property 14: Role Assignment Creates Mapping', () => {
  let userService: UserService;
  let mockKcAdmin: jest.Mocked<KeycloakAdminService>;
  let mockDb: jest.Mocked<typeof db>;
  let mockClient: any;

  const userIdArbitrary = fc.uuid();
  const roleNameArbitrary = fc.string({ minLength: 1, maxLength: 50 }).filter(s => /^[a-z0-9-_]+$/.test(s));

  beforeEach(() => {
    jest.clearAllMocks();

    mockClient = {
      roles: {
        findOneByName: jest.fn(),
      },
      users: {
        addRealmRoleMappings: jest.fn(),
      },
    };

    mockKcAdmin = {
      ensureAuthenticated: jest.fn().mockResolvedValue(undefined),
      getClient: jest.fn().mockReturnValue(mockClient),
      authenticate: jest.fn(),
      isTokenExpired: jest.fn(),
    } as any;

    mockDb = {
      query: jest.fn(),
    } as any;

    userService = new UserService(mockKcAdmin, mockDb);
  });

  test('creates realm role mapping when assigning role to user', async () => {
    await fc.assert(
      fc.asyncProperty(
        userIdArbitrary,
        roleNameArbitrary,
        async (userId: string, roleName: string) => {
          mockClient.roles.findOneByName.mockClear();
          mockClient.users.addRealmRoleMappings.mockClear();

          const mockRoleId = `role-${Math.random().toString(36).substring(7)}`;

          // Mock role lookup
          mockClient.roles.findOneByName.mockResolvedValue({
            id: mockRoleId,
            name: roleName,
          });

          await userService.assignRoleToUser(userId, roleName);

          // Property 1: Role must be looked up by name
          expect(mockClient.roles.findOneByName).toHaveBeenCalledWith({ name: roleName });

          // Property 2: Realm role mapping must be created
          expect(mockClient.users.addRealmRoleMappings).toHaveBeenCalledWith({
            id: userId,
            roles: [
              {
                id: mockRoleId,
                name: roleName,
              },
            ],
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  test('throws error when role does not exist', async () => {
    await fc.assert(
      fc.asyncProperty(
        userIdArbitrary,
        roleNameArbitrary,
        async (userId: string, roleName: string) => {
          mockClient.roles.findOneByName.mockClear();
          mockClient.users.addRealmRoleMappings.mockClear();

          // Mock role not found
          mockClient.roles.findOneByName.mockResolvedValue(null);

          // Property: Assignment must fail for non-existent role
          await expect(userService.assignRoleToUser(userId, roleName)).rejects.toThrow(
            `Role not found: ${roleName}`
          );

          // Property: Role mapping must not be attempted
          expect(mockClient.users.addRealmRoleMappings).not.toHaveBeenCalled();
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * Feature: keycloak-admin-integration, Property 15: Role Removal Deletes Mapping
 * 
 * For any role removal request, the system should delete the realm role mapping
 * from Keycloak.
 * 
 * Validates: Requirements 4.5
 */
describe('Property 15: Role Removal Deletes Mapping', () => {
  let userService: UserService;
  let mockKcAdmin: jest.Mocked<KeycloakAdminService>;
  let mockDb: jest.Mocked<typeof db>;
  let mockClient: any;

  const userIdArbitrary = fc.uuid();
  const roleNameArbitrary = fc.string({ minLength: 1, maxLength: 50 }).filter(s => /^[a-z0-9-_]+$/.test(s));

  beforeEach(() => {
    jest.clearAllMocks();

    mockClient = {
      roles: {
        findOneByName: jest.fn(),
      },
      users: {
        delRealmRoleMappings: jest.fn(),
      },
    };

    mockKcAdmin = {
      ensureAuthenticated: jest.fn().mockResolvedValue(undefined),
      getClient: jest.fn().mockReturnValue(mockClient),
      authenticate: jest.fn(),
      isTokenExpired: jest.fn(),
    } as any;

    mockDb = {
      query: jest.fn(),
    } as any;

    userService = new UserService(mockKcAdmin, mockDb);
  });

  test('deletes realm role mapping when removing role from user', async () => {
    await fc.assert(
      fc.asyncProperty(
        userIdArbitrary,
        roleNameArbitrary,
        async (userId: string, roleName: string) => {
          mockClient.roles.findOneByName.mockClear();
          mockClient.users.delRealmRoleMappings.mockClear();

          const mockRoleId = `role-${Math.random().toString(36).substring(7)}`;

          // Mock role lookup
          mockClient.roles.findOneByName.mockResolvedValue({
            id: mockRoleId,
            name: roleName,
          });

          await userService.removeRoleFromUser(userId, roleName);

          // Property 1: Role must be looked up by name
          expect(mockClient.roles.findOneByName).toHaveBeenCalledWith({ name: roleName });

          // Property 2: Realm role mapping must be deleted
          expect(mockClient.users.delRealmRoleMappings).toHaveBeenCalledWith({
            id: userId,
            roles: [
              {
                id: mockRoleId,
                name: roleName,
              },
            ],
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  test('throws error when role does not exist', async () => {
    await fc.assert(
      fc.asyncProperty(
        userIdArbitrary,
        roleNameArbitrary,
        async (userId: string, roleName: string) => {
          mockClient.roles.findOneByName.mockClear();
          mockClient.users.delRealmRoleMappings.mockClear();

          // Mock role not found
          mockClient.roles.findOneByName.mockResolvedValue(null);

          // Property: Removal must fail for non-existent role
          await expect(userService.removeRoleFromUser(userId, roleName)).rejects.toThrow(
            `Role not found: ${roleName}`
          );

          // Property: Role mapping deletion must not be attempted
          expect(mockClient.users.delRealmRoleMappings).not.toHaveBeenCalled();
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * Feature: keycloak-admin-integration, Property 16: Role Deletion Dual-Store Consistency
 * 
 * For any role deletion request, the system should remove the role from both
 * Keycloak and the database.
 * 
 * Validates: Requirements 4.6
 */
describe('Property 16: Role Deletion Dual-Store Consistency', () => {
  let roleService: RoleService;
  let mockKcAdmin: jest.Mocked<KeycloakAdminService>;
  let mockDb: jest.Mocked<typeof db>;
  let mockClient: any;

  const roleArbitrary = fc.record({
    id: fc.uuid(),
    keycloak_role_id: fc.uuid(),
    name: fc.string({ minLength: 1, maxLength: 50 }),
    display_name: fc.string({ minLength: 1, maxLength: 100 }),
    description: fc.option(fc.string({ minLength: 1, maxLength: 255 }), { nil: null }),
    permissions: fc.array(fc.string({ minLength: 1, maxLength: 50 }), { minLength: 0, maxLength: 10 }),
    created_at: fc.date(),
    updated_at: fc.date(),
  });

  beforeEach(() => {
    jest.clearAllMocks();

    mockClient = {
      roles: {
        findOneByName: jest.fn(),
        delByName: jest.fn(),
      },
    };

    mockKcAdmin = {
      ensureAuthenticated: jest.fn().mockResolvedValue(undefined),
      getClient: jest.fn().mockReturnValue(mockClient),
      authenticate: jest.fn(),
      isTokenExpired: jest.fn(),
    } as any;

    mockDb = {
      query: jest.fn(),
    } as any;

    roleService = new RoleService(mockKcAdmin, mockDb);
  });

  test('deletes role from both Keycloak and database', async () => {
    await fc.assert(
      fc.asyncProperty(roleArbitrary, async (role: any) => {
        mockClient.roles.findOneByName.mockClear();
        mockClient.roles.delByName.mockClear();
        mockDb.query.mockClear();

        // Mock getRoleById
        mockDb.query.mockResolvedValueOnce({ rows: [role] } as any);
        mockClient.roles.findOneByName.mockResolvedValue({
          id: role.keycloak_role_id,
          name: role.name,
          composite: false,
        });

        // Mock delete
        mockDb.query.mockResolvedValueOnce({ rows: [] } as any);

        await roleService.deleteRole(role.id);

        // Property 1: Keycloak realm role must be deleted
        expect(mockClient.roles.delByName).toHaveBeenCalledWith({ name: role.name });

        // Property 2: Database record must be deleted
        expect(mockDb.query).toHaveBeenCalledWith('DELETE FROM roles WHERE id = $1', [role.id]);

        // Property 3: Deletion must occur in correct order (Keycloak first, then database)
        const delCallOrder = mockClient.roles.delByName.mock.invocationCallOrder[0];
        const dbDeleteCallOrder = mockDb.query.mock.invocationCallOrder[1]; // Second query call
        expect(delCallOrder).toBeLessThan(dbDeleteCallOrder);
      }),
      { numRuns: 100 }
    );
  });

  test('throws error when role does not exist', async () => {
    await fc.assert(
      fc.asyncProperty(fc.uuid(), async (nonExistentId: string) => {
        mockDb.query.mockClear();
        mockClient.roles.delByName.mockClear();

        // Mock getRoleById returning no results
        mockDb.query.mockResolvedValueOnce({ rows: [] } as any);

        // Property: Deletion must fail for non-existent role
        await expect(roleService.deleteRole(nonExistentId)).rejects.toThrow('Role not found');

        // Property: Keycloak deletion must not be attempted
        expect(mockClient.roles.delByName).not.toHaveBeenCalled();
      }),
      { numRuns: 100 }
    );
  });
});

/**
 * Feature: keycloak-admin-integration, Property 17: Role Permissions Stored as Attributes
 * 
 * For any role with custom permissions, the permissions should be stored as
 * attributes in the Keycloak role.
 * 
 * Validates: Requirements 4.7
 */
describe('Property 17: Role Permissions Stored as Attributes', () => {
  let roleService: RoleService;
  let mockKcAdmin: jest.Mocked<KeycloakAdminService>;
  let mockDb: jest.Mocked<typeof db>;
  let mockClient: any;

  const roleWithPermissionsArbitrary = fc.record({
    name: fc.string({ minLength: 1, maxLength: 50 }).filter(s => /^[a-z0-9-_]+$/.test(s)),
    displayName: fc.string({ minLength: 1, maxLength: 100 }),
    description: fc.option(fc.string({ minLength: 1, maxLength: 255 }), { nil: undefined }),
    permissions: fc.array(
      fc.string({ minLength: 1, maxLength: 50 }).filter(s => /^[a-z0-9:_-]+$/.test(s)),
      { minLength: 1, maxLength: 20 }
    ),
  });

  beforeEach(() => {
    jest.clearAllMocks();

    mockClient = {
      roles: {
        create: jest.fn(),
        findOneByName: jest.fn(),
      },
    };

    mockKcAdmin = {
      ensureAuthenticated: jest.fn().mockResolvedValue(undefined),
      getClient: jest.fn().mockReturnValue(mockClient),
      authenticate: jest.fn(),
      isTokenExpired: jest.fn(),
    } as any;

    mockDb = {
      query: jest.fn(),
    } as any;

    roleService = new RoleService(mockKcAdmin, mockDb);
  });

  test('stores custom permissions as attributes in Keycloak role', async () => {
    await fc.assert(
      fc.asyncProperty(roleWithPermissionsArbitrary, async (roleData: CreateRoleDto) => {
        mockClient.roles.create.mockClear();
        mockClient.roles.findOneByName.mockClear();
        mockDb.query.mockClear();

        const mockRoleId = `role-${Math.random().toString(36).substring(7)}`;

        // Mock Keycloak role creation
        mockClient.roles.create.mockResolvedValue(undefined);
        mockClient.roles.findOneByName.mockResolvedValue({
          id: mockRoleId,
          name: roleData.name,
          attributes: {
            displayName: [roleData.displayName],
            permissions: roleData.permissions,
          },
        });

        // Mock database insertion
        mockDb.query.mockResolvedValue({
          rows: [
            {
              id: `db-role-${Math.random().toString(36).substring(7)}`,
              keycloak_role_id: mockRoleId,
              name: roleData.name,
              display_name: roleData.displayName,
              description: roleData.description || null,
              permissions: JSON.stringify(roleData.permissions),
              created_at: new Date(),
              updated_at: new Date(),
            },
          ],
        } as any);

        await roleService.createRole(roleData);

        // Property 1: Permissions must be stored as attributes in Keycloak
        expect(mockClient.roles.create).toHaveBeenCalledWith({
          name: roleData.name,
          description: roleData.description,
          attributes: {
            displayName: [roleData.displayName],
            permissions: roleData.permissions,
          },
        });

        // Property 2: Permissions must be stored in database
        expect(mockDb.query).toHaveBeenCalledWith(
          expect.stringContaining('INSERT INTO roles'),
          expect.arrayContaining([JSON.stringify(roleData.permissions)])
        );

        // Property 3: Permissions array must not be empty
        expect(roleData.permissions).toBeDefined();
        expect(roleData.permissions!.length).toBeGreaterThan(0);
      }),
      { numRuns: 100 }
    );
  });

  test('handles empty permissions array', async () => {
    const roleWithoutPermissions: CreateRoleDto = {
      name: 'role-no-perms',
      displayName: 'Role Without Permissions',
      permissions: [],
    };

    const mockRoleId = 'role-123';
    mockClient.roles.create.mockResolvedValue(undefined);
    mockClient.roles.findOneByName.mockResolvedValue({
      id: mockRoleId,
      name: roleWithoutPermissions.name,
    });

    mockDb.query.mockResolvedValue({
      rows: [
        {
          id: 'db-role-123',
          keycloak_role_id: mockRoleId,
          name: roleWithoutPermissions.name,
          display_name: roleWithoutPermissions.displayName,
          description: null,
          permissions: JSON.stringify([]),
          created_at: new Date(),
          updated_at: new Date(),
        },
      ],
    } as any);

    await roleService.createRole(roleWithoutPermissions);

    // Property: Empty permissions array must be stored as empty array
    expect(mockClient.roles.create).toHaveBeenCalledWith({
      name: roleWithoutPermissions.name,
      description: undefined,
      attributes: {
        displayName: [roleWithoutPermissions.displayName],
        permissions: [],
      },
    });
  });
});
