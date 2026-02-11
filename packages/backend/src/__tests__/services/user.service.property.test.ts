import * as fc from 'fast-check';
import { UserService, CreateUserDto, UpdateUserDto, UserFilters } from '../../services/user.service';
import { KeycloakAdminService } from '../../services/keycloak-admin.service';
import { db } from '../../database/pool';

// Mock dependencies
jest.mock('../../services/keycloak-admin.service');
jest.mock('../../database/pool');

/**
 * Feature: keycloak-admin-integration, Property 7: User Creation with Complete Profile
 * 
 * For any valid user creation request, the system should create the user in Keycloak
 * with all provided profile information, credentials, tenant association (if specified),
 * and role assignments (if specified).
 * 
 * Validates: Requirements 3.1, 3.2, 3.3, 3.4
 */
describe('Property 7: User Creation with Complete Profile', () => {
  let userService: UserService;
  let mockKcAdmin: jest.Mocked<KeycloakAdminService>;
  let mockDb: jest.Mocked<typeof db>;
  let mockClient: any;

  const userDataArbitrary = fc.record({
    username: fc.string({ minLength: 3, maxLength: 50 }).filter(s => /^[a-z0-9._-]+$/.test(s)),
    email: fc.emailAddress(),
    firstName: fc.string({ minLength: 1, maxLength: 50 }),
    lastName: fc.string({ minLength: 1, maxLength: 50 }),
    password: fc.option(fc.string({ minLength: 8, maxLength: 50 }), { nil: undefined }),
    temporaryPassword: fc.option(fc.boolean(), { nil: undefined }),
    emailVerified: fc.option(fc.boolean(), { nil: undefined }),
    phoneNumber: fc.option(fc.string({ minLength: 10, maxLength: 20 }), { nil: undefined }),
    department: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: undefined }),
    tenantId: fc.option(fc.uuid(), { nil: undefined }),
    roles: fc.option(fc.array(fc.constantFrom('user', 'admin', 'manager'), { minLength: 0, maxLength: 3 }), { nil: undefined }),
  });

  beforeEach(() => {
    jest.clearAllMocks();

    mockClient = {
      users: {
        create: jest.fn(),
        resetPassword: jest.fn(),
        addToGroup: jest.fn(),
        findOne: jest.fn(),
        listRealmRoleMappings: jest.fn(),
        listGroups: jest.fn(),
        addRealmRoleMappings: jest.fn(),
        del: jest.fn(),
      },
      roles: {
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

    userService = new UserService(mockKcAdmin, mockDb);
  });

  test('creates user in Keycloak with complete profile', async () => {
    await fc.assert(
      fc.asyncProperty(
        userDataArbitrary,
        async (userData: CreateUserDto) => {
          // Reset mocks for each iteration
          mockClient.users.create.mockClear();
          mockClient.users.resetPassword.mockClear();
          mockClient.users.addToGroup.mockClear();
          mockClient.users.addRealmRoleMappings.mockClear();
          mockDb.query.mockClear();

          const mockUserId = `user-${Math.random().toString(36).substring(7)}`;
          const mockDbUserId = `db-${Math.random().toString(36).substring(7)}`;

          // Mock Keycloak user creation
          mockClient.users.create.mockResolvedValue({ id: mockUserId });

          // Mock tenant lookup if tenantId provided
          if (userData.tenantId) {
            const mockGroupId = `group-${Math.random().toString(36).substring(7)}`;
            mockDb.query.mockResolvedValueOnce({
              rows: [{ keycloak_group_id: mockGroupId }],
            } as any);
          }

          // Mock role lookups if roles provided
          if (userData.roles && userData.roles.length > 0) {
            for (const roleName of userData.roles) {
              mockClient.roles.findOneByName.mockResolvedValueOnce({
                id: `role-${roleName}`,
                name: roleName,
              });
            }
          }

          // Mock database insertion
          mockDb.query.mockResolvedValueOnce({
            rows: [{
              id: mockDbUserId,
              keycloak_user_id: mockUserId,
              tenant_id: userData.tenantId || null,
              username: userData.username,
              email: userData.email,
              preferences: {},
              last_login: null,
              created_at: new Date(),
              updated_at: new Date(),
            }],
          } as any);

          // Mock mapDbRowToUser dependencies
          mockClient.users.findOne.mockResolvedValue({
            id: mockUserId,
            username: userData.username,
            email: userData.email,
            firstName: userData.firstName,
            lastName: userData.lastName,
            enabled: true,
            emailVerified: userData.emailVerified ?? false,
            attributes: {
              phoneNumber: userData.phoneNumber ? [userData.phoneNumber] : [],
              department: userData.department ? [userData.department] : [],
            },
          });

          mockClient.users.listRealmRoleMappings.mockResolvedValue(
            (userData.roles || []).map(name => ({ id: `role-${name}`, name, composite: false }))
          );

          if (userData.tenantId) {
            const mockGroupId = `group-${Math.random().toString(36).substring(7)}`;
            mockClient.users.listGroups.mockResolvedValue([{ id: mockGroupId }]);
            mockDb.query.mockResolvedValueOnce({ rows: [{ id: userData.tenantId }] } as any);
          } else {
            mockClient.users.listGroups.mockResolvedValue([]);
          }

          const result = await userService.createUser(userData);

          // Property 1: User must be created in Keycloak with profile information
          expect(mockClient.users.create).toHaveBeenCalledTimes(1);
          expect(mockClient.users.create).toHaveBeenCalledWith({
            username: userData.username,
            email: userData.email,
            firstName: userData.firstName,
            lastName: userData.lastName,
            enabled: true,
            emailVerified: userData.emailVerified ?? false,
            attributes: {
              phoneNumber: userData.phoneNumber ? [userData.phoneNumber] : [],
              department: userData.department ? [userData.department] : [],
            },
          });

          // Property 2: Password must be set if provided
          if (userData.password) {
            expect(mockClient.users.resetPassword).toHaveBeenCalledWith({
              id: mockUserId,
              credential: {
                temporary: userData.temporaryPassword ?? false,
                type: 'password',
                value: userData.password,
              },
            });
          } else {
            expect(mockClient.users.resetPassword).not.toHaveBeenCalled();
          }

          // Property 3: User must be added to tenant group if specified
          if (userData.tenantId) {
            expect(mockClient.users.addToGroup).toHaveBeenCalledTimes(1);
          } else {
            expect(mockClient.users.addToGroup).not.toHaveBeenCalled();
          }

          // Property 4: Roles must be assigned if specified
          if (userData.roles && userData.roles.length > 0) {
            expect(mockClient.users.addRealmRoleMappings).toHaveBeenCalledTimes(userData.roles.length);
          } else {
            expect(mockClient.users.addRealmRoleMappings).not.toHaveBeenCalled();
          }

          // Property 5: Database record must be created with Keycloak user ID
          expect(mockDb.query).toHaveBeenCalledWith(
            expect.stringContaining('INSERT INTO users'),
            [mockUserId, userData.tenantId || null, userData.username, userData.email, '{}']
          );

          // Property 6: Result must contain consistent data
          expect(result.keycloakUserId).toBe(mockUserId);
          expect(result.username).toBe(userData.username);
          expect(result.email).toBe(userData.email);
          expect(result.firstName).toBe(userData.firstName);
          expect(result.lastName).toBe(userData.lastName);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('rolls back Keycloak user if database creation fails', async () => {
    await fc.assert(
      fc.asyncProperty(
        userDataArbitrary,
        async (userData: CreateUserDto) => {
          mockClient.users.create.mockClear();
          mockClient.users.del.mockClear();
          mockDb.query.mockClear();

          const mockUserId = `user-${Math.random().toString(36).substring(7)}`;

          // Mock Keycloak user creation success
          mockClient.users.create.mockResolvedValue({ id: mockUserId });

          // Mock tenant lookup if needed
          if (userData.tenantId) {
            mockDb.query.mockResolvedValueOnce({
              rows: [{ keycloak_group_id: 'group-123' }],
            } as any);
          }

          // Mock role lookups if needed
          if (userData.roles && userData.roles.length > 0) {
            for (const roleName of userData.roles) {
              mockClient.roles.findOneByName.mockResolvedValueOnce({
                id: `role-${roleName}`,
                name: roleName,
              });
            }
          }

          // Mock database insertion failure
          mockDb.query.mockRejectedValue(new Error('Database constraint violation'));

          // Attempt to create user should fail
          await expect(userService.createUser(userData)).rejects.toThrow();

          // Property: Keycloak user must be rolled back
          expect(mockClient.users.del).toHaveBeenCalledWith({ id: mockUserId });
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * Feature: keycloak-admin-integration, Property 8: User List Filtering by Tenant
 * 
 * For any user list request with a tenant filter, the returned users should only
 * include those who are members of the specified tenant's Keycloak group.
 * 
 * Validates: Requirements 3.6
 */
describe('Property 8: User List Filtering by Tenant', () => {
  let userService: UserService;
  let mockKcAdmin: jest.Mocked<KeycloakAdminService>;
  let mockDb: jest.Mocked<typeof db>;
  let mockClient: any;

  const userListArbitrary = fc.array(
    fc.record({
      id: fc.uuid(),
      username: fc.string({ minLength: 3, maxLength: 50 }),
      email: fc.emailAddress(),
    }),
    { minLength: 1, maxLength: 10 }
  );

  beforeEach(() => {
    jest.clearAllMocks();

    mockClient = {
      users: {
        find: jest.fn(),
        findOne: jest.fn(),
        listRealmRoleMappings: jest.fn(),
        listGroups: jest.fn(),
      },
      groups: {
        listMembers: jest.fn(),
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

  test('filters users by tenant group membership', async () => {
    await fc.assert(
      fc.asyncProperty(
        userListArbitrary,
        fc.uuid(),
        fc.array(fc.integer({ min: 0, max: 9 })),
        async (users: any[], tenantId: string, memberIndices: number[]) => {
          mockClient.users.find.mockClear();
          mockClient.groups.listMembers.mockClear();
          mockDb.query.mockClear();

          const mockGroupId = `group-${Math.random().toString(36).substring(7)}`;

          // Determine which users are in the tenant
          const uniqueIndices = [...new Set(memberIndices.map(i => i % users.length))];
          const memberIds = new Set(uniqueIndices.map(i => users[i].id));

          // Mock Keycloak users
          mockClient.users.find.mockResolvedValue(users);

          // Mock tenant lookup
          mockDb.query.mockResolvedValueOnce({
            rows: [{ keycloak_group_id: mockGroupId }],
          } as any);

          // Mock group members
          const groupMembers = uniqueIndices.map(i => ({ id: users[i].id }));
          mockClient.groups.listMembers.mockResolvedValue(groupMembers);

          // Mock database and Keycloak lookups for each member
          for (const user of users) {
            if (memberIds.has(user.id)) {
              mockDb.query.mockResolvedValueOnce({
                rows: [{
                  id: `db-${user.id}`,
                  keycloak_user_id: user.id,
                  tenant_id: tenantId,
                  username: user.username,
                  email: user.email,
                  preferences: {},
                  last_login: null,
                  created_at: new Date(),
                  updated_at: new Date(),
                }],
              } as any);

              mockClient.users.findOne.mockResolvedValueOnce({
                id: user.id,
                username: user.username,
                email: user.email,
                enabled: true,
              });

              mockClient.users.listRealmRoleMappings.mockResolvedValueOnce([]);
              mockClient.users.listGroups.mockResolvedValueOnce([{ id: mockGroupId }]);
              mockDb.query.mockResolvedValueOnce({ rows: [{ id: tenantId }] } as any);
            }
          }

          const filters: UserFilters = { tenantId };
          const result = await userService.getUsers(filters);

          // Property 1: Only users in the tenant group should be returned
          expect(result.length).toBe(memberIds.size);

          // Property 2: All returned users must be members of the tenant
          for (const user of result) {
            expect(memberIds.has(user.keycloakUserId)).toBe(true);
          }

          // Property 3: Group membership must be queried
          expect(mockClient.groups.listMembers).toHaveBeenCalledWith({ id: mockGroupId });
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * Feature: keycloak-admin-integration, Property 9: User Update Dual-Store Consistency
 * 
 * For any user update request, both the Keycloak user data and the database
 * record should be updated with the new values.
 * 
 * Validates: Requirements 3.7
 */
describe('Property 9: User Update Dual-Store Consistency', () => {
  let userService: UserService;
  let mockKcAdmin: jest.Mocked<KeycloakAdminService>;
  let mockDb: jest.Mocked<typeof db>;
  let mockClient: any;

  const existingUserArbitrary = fc.record({
    id: fc.uuid(),
    keycloak_user_id: fc.uuid(),
    tenant_id: fc.option(fc.uuid(), { nil: null }),
    username: fc.string({ minLength: 3, maxLength: 50 }),
    email: fc.emailAddress(),
    created_at: fc.date(),
    updated_at: fc.date(),
  });

  const updateDataArbitrary = fc.record({
    email: fc.option(fc.emailAddress(), { nil: undefined }),
    firstName: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: undefined }),
    lastName: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: undefined }),
    enabled: fc.option(fc.boolean(), { nil: undefined }),
    phoneNumber: fc.option(fc.string({ minLength: 10, maxLength: 20 }), { nil: undefined }),
    department: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: undefined }),
  });

  beforeEach(() => {
    jest.clearAllMocks();

    mockClient = {
      users: {
        update: jest.fn(),
        findOne: jest.fn(),
        listRealmRoleMappings: jest.fn(),
        listGroups: jest.fn(),
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

  test('updates user in both Keycloak and database with consistent data', async () => {
    await fc.assert(
      fc.asyncProperty(
        existingUserArbitrary,
        updateDataArbitrary,
        async (existingUser: any, updates: UpdateUserDto) => {
          mockClient.users.update.mockClear();
          mockDb.query.mockClear();

          // Mock getUserById
          mockDb.query.mockResolvedValueOnce({ rows: [existingUser] } as any);

          mockClient.users.findOne.mockResolvedValueOnce({
            id: existingUser.keycloak_user_id,
            username: existingUser.username,
            email: existingUser.email,
            enabled: true,
          });

          mockClient.users.listRealmRoleMappings.mockResolvedValueOnce([]);

          if (existingUser.tenant_id) {
            mockClient.users.listGroups.mockResolvedValueOnce([{ id: 'group-1' }]);
            mockDb.query.mockResolvedValueOnce({ rows: [{ id: existingUser.tenant_id }] } as any);
          } else {
            mockClient.users.listGroups.mockResolvedValueOnce([]);
          }

          // Mock update query
          const updatedUser = {
            ...existingUser,
            email: updates.email || existingUser.email,
          };
          mockDb.query.mockResolvedValueOnce({ rows: [updatedUser] } as any);

          mockClient.users.findOne.mockResolvedValueOnce({
            id: existingUser.keycloak_user_id,
            username: existingUser.username,
            email: updates.email || existingUser.email,
            firstName: updates.firstName,
            lastName: updates.lastName,
            enabled: updates.enabled ?? true,
          });

          mockClient.users.listRealmRoleMappings.mockResolvedValueOnce([]);

          if (existingUser.tenant_id) {
            mockClient.users.listGroups.mockResolvedValueOnce([{ id: 'group-1' }]);
            mockDb.query.mockResolvedValueOnce({ rows: [{ id: existingUser.tenant_id }] } as any);
          } else {
            mockClient.users.listGroups.mockResolvedValueOnce([]);
          }

          await userService.updateUser(existingUser.id, updates);

          // Property 1: Keycloak user must be updated
          expect(mockClient.users.update).toHaveBeenCalledWith(
            { id: existingUser.keycloak_user_id },
            {
              email: updates.email,
              firstName: updates.firstName,
              lastName: updates.lastName,
              enabled: updates.enabled,
              attributes: {
                phoneNumber: updates.phoneNumber ? [updates.phoneNumber] : undefined,
                department: updates.department ? [updates.department] : undefined,
              },
            }
          );

          // Property 2: Database record must be updated if email changed
          if (updates.email !== undefined) {
            expect(mockDb.query).toHaveBeenCalledWith(
              expect.stringContaining('UPDATE users'),
              expect.any(Array)
            );
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * Feature: keycloak-admin-integration, Property 10: User Deletion Dual-Store Consistency
 * 
 * For any user deletion request, the system should remove the user from both
 * Keycloak and the database.
 * 
 * Validates: Requirements 3.8
 */
describe('Property 10: User Deletion Dual-Store Consistency', () => {
  let userService: UserService;
  let mockKcAdmin: jest.Mocked<KeycloakAdminService>;
  let mockDb: jest.Mocked<typeof db>;
  let mockClient: any;

  const userArbitrary = fc.record({
    id: fc.uuid(),
    keycloak_user_id: fc.uuid(),
    tenant_id: fc.option(fc.uuid(), { nil: null }),
    username: fc.string({ minLength: 3, maxLength: 50 }),
    email: fc.emailAddress(),
    created_at: fc.date(),
    updated_at: fc.date(),
  });

  beforeEach(() => {
    jest.clearAllMocks();

    mockClient = {
      users: {
        del: jest.fn(),
        findOne: jest.fn(),
        listRealmRoleMappings: jest.fn(),
        listGroups: jest.fn(),
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

  test('deletes user from both Keycloak and database', async () => {
    await fc.assert(
      fc.asyncProperty(
        userArbitrary,
        async (user: any) => {
          mockClient.users.del.mockClear();
          mockDb.query.mockClear();

          // Mock getUserById
          mockDb.query.mockResolvedValueOnce({ rows: [user] } as any);

          mockClient.users.findOne.mockResolvedValue({
            id: user.keycloak_user_id,
            username: user.username,
            email: user.email,
            enabled: true,
          });

          mockClient.users.listRealmRoleMappings.mockResolvedValue([]);
          mockClient.users.listGroups.mockResolvedValue([]);

          // Mock delete
          mockDb.query.mockResolvedValueOnce({ rows: [] } as any);

          await userService.deleteUser(user.id);

          // Property 1: Keycloak user must be deleted
          expect(mockClient.users.del).toHaveBeenCalledWith({ id: user.keycloak_user_id });

          // Property 2: Database record must be deleted
          expect(mockDb.query).toHaveBeenCalledWith(
            'DELETE FROM users WHERE id = $1',
            [user.id]
          );

          // Property 3: Deletion must occur in correct order (Keycloak first, then database)
          const delCallOrder = mockClient.users.del.mock.invocationCallOrder[0];
          const dbDeleteCallOrder = mockDb.query.mock.invocationCallOrder[1]; // Second query call
          expect(delCallOrder).toBeLessThan(dbDeleteCallOrder);
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * Feature: keycloak-admin-integration, Property 11: Password Reset with Temporary Flag
 * 
 * For any password reset request, the system should update the password in Keycloak
 * and correctly apply the temporary flag based on the request parameter.
 * 
 * Validates: Requirements 3.9
 */
describe('Property 11: Password Reset with Temporary Flag', () => {
  let userService: UserService;
  let mockKcAdmin: jest.Mocked<KeycloakAdminService>;
  let mockDb: jest.Mocked<typeof db>;
  let mockClient: any;

  const userArbitrary = fc.record({
    id: fc.uuid(),
    keycloak_user_id: fc.uuid(),
    username: fc.string({ minLength: 3, maxLength: 50 }),
    email: fc.emailAddress(),
  });

  const passwordArbitrary = fc.string({ minLength: 8, maxLength: 50 });
  const temporaryFlagArbitrary = fc.boolean();

  beforeEach(() => {
    jest.clearAllMocks();

    mockClient = {
      users: {
        resetPassword: jest.fn(),
        findOne: jest.fn(),
        listRealmRoleMappings: jest.fn(),
        listGroups: jest.fn(),
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

  test('resets password with correct temporary flag', async () => {
    await fc.assert(
      fc.asyncProperty(
        userArbitrary,
        passwordArbitrary,
        temporaryFlagArbitrary,
        async (user: any, password: string, temporary: boolean) => {
          mockClient.users.resetPassword.mockClear();
          mockDb.query.mockClear();

          // Mock getUserById
          mockDb.query.mockResolvedValue({ rows: [user] } as any);

          mockClient.users.findOne.mockResolvedValue({
            id: user.keycloak_user_id,
            username: user.username,
            email: user.email,
            enabled: true,
          });

          mockClient.users.listRealmRoleMappings.mockResolvedValue([]);
          mockClient.users.listGroups.mockResolvedValue([]);

          await userService.resetPassword(user.id, password, temporary);

          // Property: Password must be reset with correct temporary flag
          expect(mockClient.users.resetPassword).toHaveBeenCalledWith({
            id: user.keycloak_user_id,
            credential: {
              temporary,
              type: 'password',
              value: password,
            },
          });
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * Feature: keycloak-admin-integration, Property 12: User Roles Match Keycloak Mappings
 * 
 * For any user, the roles returned by the system should exactly match the realm
 * role mappings in Keycloak.
 * 
 * Validates: Requirements 3.10
 */
describe('Property 12: User Roles Match Keycloak Mappings', () => {
  let userService: UserService;
  let mockKcAdmin: jest.Mocked<KeycloakAdminService>;
  let mockDb: jest.Mocked<typeof db>;
  let mockClient: any;

  const userArbitrary = fc.record({
    id: fc.uuid(),
    keycloak_user_id: fc.uuid(),
    username: fc.string({ minLength: 3, maxLength: 50 }),
    email: fc.emailAddress(),
  });

  const rolesArbitrary = fc.array(
    fc.record({
      id: fc.uuid(),
      name: fc.constantFrom('user', 'admin', 'manager', 'viewer', 'editor'),
      composite: fc.boolean(),
    }),
    { minLength: 0, maxLength: 5 }
  );

  beforeEach(() => {
    jest.clearAllMocks();

    mockClient = {
      users: {
        listRealmRoleMappings: jest.fn(),
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

  test('returns roles that match Keycloak role mappings', async () => {
    await fc.assert(
      fc.asyncProperty(
        userArbitrary,
        rolesArbitrary,
        async (user: any, kcRoles: any[]) => {
          mockClient.users.listRealmRoleMappings.mockClear();

          // Mock Keycloak role mappings
          mockClient.users.listRealmRoleMappings.mockResolvedValue(kcRoles);

          const result = await userService.getUserRoles(user.keycloak_user_id);

          // Property 1: Number of roles must match
          expect(result.length).toBe(kcRoles.length);

          // Property 2: Each role must match Keycloak data
          for (let i = 0; i < kcRoles.length; i++) {
            expect(result[i].keycloakRoleId).toBe(kcRoles[i].id);
            expect(result[i].name).toBe(kcRoles[i].name);
            expect(result[i].composite).toBe(kcRoles[i].composite);
          }

          // Property 3: Role mappings must be queried from Keycloak
          expect(mockClient.users.listRealmRoleMappings).toHaveBeenCalledWith({
            id: user.keycloak_user_id,
          });
        }
      ),
      { numRuns: 100 }
    );
  });
});
