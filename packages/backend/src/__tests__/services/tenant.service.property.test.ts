import * as fc from 'fast-check';
import { TenantService, CreateTenantDto, UpdateTenantDto } from '../../services/tenant.service';
import { KeycloakAdminService } from '../../services/keycloak-admin.service';
import { db } from '../../database/pool';

// Mock dependencies
jest.mock('../../services/keycloak-admin.service');
jest.mock('../../database/pool');

/**
 * Feature: keycloak-admin-integration, Property 3: Tenant Creation Dual-Store Consistency
 * 
 * For any valid tenant creation request, the system should create both a Keycloak group
 * and a database record, and both should contain consistent tenant information with the
 * database record referencing the Keycloak group ID.
 * 
 * Validates: Requirements 2.1, 2.2
 */
describe('Property 3: Tenant Creation Dual-Store Consistency', () => {
  let tenantService: TenantService;
  let mockKcAdmin: jest.Mocked<KeycloakAdminService>;
  let mockDb: jest.Mocked<typeof db>;
  let mockClient: any;

  const tenantDataArbitrary = fc.record({
    name: fc.string({ minLength: 1, maxLength: 50 }).filter(s => /^[a-z0-9-]+$/.test(s)),
    displayName: fc.string({ minLength: 1, maxLength: 100 }),
    domain: fc.option(fc.domain(), { nil: undefined }),
  });

  beforeEach(() => {
    jest.clearAllMocks();

    mockClient = {
      groups: {
        create: jest.fn(),
        update: jest.fn(),
        del: jest.fn(),
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

    tenantService = new TenantService(mockKcAdmin, mockDb);
  });

  test('creates tenant in both Keycloak and database with consistent data', async () => {
    await fc.assert(
      fc.asyncProperty(
        tenantDataArbitrary,
        async (tenantData: CreateTenantDto) => {
          // Reset mocks for each iteration
          mockClient.groups.create.mockClear();
          mockDb.query.mockClear();

          const mockGroupId = `group-${Math.random().toString(36).substring(7)}`;
          const mockTenantId = `tenant-${Math.random().toString(36).substring(7)}`;

          // Mock Keycloak group creation
          mockClient.groups.create.mockResolvedValue({ id: mockGroupId });

          // Mock database insertion
          mockDb.query.mockResolvedValue({
            rows: [{
              id: mockTenantId,
              keycloak_group_id: mockGroupId,
              name: tenantData.name,
              display_name: tenantData.displayName,
              domain: tenantData.domain || null,
              status: 'active',
              created_at: new Date(),
              updated_at: new Date(),
            }],
          } as any);

          const result = await tenantService.createTenant(tenantData);

          // Property 1: Keycloak group must be created
          expect(mockClient.groups.create).toHaveBeenCalledTimes(1);
          expect(mockClient.groups.create).toHaveBeenCalledWith({
            name: tenantData.name,
            attributes: {
              displayName: [tenantData.displayName],
              domain: tenantData.domain ? [tenantData.domain] : [],
              status: ['active'],
              createdAt: expect.any(Array),
            },
          });

          // Property 2: Database record must be created with Keycloak group ID
          expect(mockDb.query).toHaveBeenCalledWith(
            expect.stringContaining('INSERT INTO tenants'),
            [mockGroupId, tenantData.name, tenantData.displayName, tenantData.domain || null, 'active']
          );

          // Property 3: Result must contain consistent data from both stores
          expect(result.keycloakGroupId).toBe(mockGroupId);
          expect(result.name).toBe(tenantData.name);
          expect(result.displayName).toBe(tenantData.displayName);
          expect(result.domain).toBe(tenantData.domain || null);
          expect(result.status).toBe('active');
          expect(result.memberCount).toBe(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('rolls back Keycloak group if database creation fails', async () => {
    await fc.assert(
      fc.asyncProperty(
        tenantDataArbitrary,
        async (tenantData: CreateTenantDto) => {
          mockClient.groups.create.mockClear();
          mockClient.groups.del.mockClear();
          mockDb.query.mockClear();

          const mockGroupId = `group-${Math.random().toString(36).substring(7)}`;

          // Mock Keycloak group creation success
          mockClient.groups.create.mockResolvedValue({ id: mockGroupId });

          // Mock database insertion failure
          mockDb.query.mockRejectedValue(new Error('Database constraint violation'));

          // Attempt to create tenant should fail
          await expect(tenantService.createTenant(tenantData)).rejects.toThrow();

          // Property: Keycloak group must be rolled back
          expect(mockClient.groups.del).toHaveBeenCalledWith({ id: mockGroupId });
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * Feature: keycloak-admin-integration, Property 4: Tenant List Enrichment
 * 
 * For any tenant list request, all Keycloak groups should be retrieved and enriched
 * with corresponding database information, and the member count should match the
 * actual Keycloak group membership.
 * 
 * Validates: Requirements 2.3, 2.7
 */
describe('Property 4: Tenant List Enrichment', () => {
  let tenantService: TenantService;
  let mockKcAdmin: jest.Mocked<KeycloakAdminService>;
  let mockDb: jest.Mocked<typeof db>;
  let mockClient: any;

  const tenantListArbitrary = fc.array(
    fc.record({
      id: fc.uuid(),
      keycloak_group_id: fc.uuid(),
      name: fc.string({ minLength: 1, maxLength: 50 }),
      display_name: fc.string({ minLength: 1, maxLength: 100 }),
      domain: fc.option(fc.domain(), { nil: null }),
      status: fc.constantFrom('active', 'inactive'),
      created_at: fc.date(),
      updated_at: fc.date(),
    }),
    { minLength: 0, maxLength: 10 }
  );

  const memberCountArbitrary = fc.integer({ min: 0, max: 100 });

  beforeEach(() => {
    jest.clearAllMocks();

    mockClient = {
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

    tenantService = new TenantService(mockKcAdmin, mockDb);
  });

  test('enriches all tenants with member counts from Keycloak', async () => {
    await fc.assert(
      fc.asyncProperty(
        tenantListArbitrary,
        fc.array(memberCountArbitrary),
        async (tenants: any[], memberCounts: number[]) => {
          // Ensure we have member counts for all tenants
          const counts = memberCounts.slice(0, tenants.length);
          while (counts.length < tenants.length) {
            counts.push(0);
          }

          mockDb.query.mockClear();
          mockClient.groups.listMembers.mockClear();

          // Mock database query
          mockDb.query.mockResolvedValue({ rows: tenants } as any);

          // Mock Keycloak member counts
          for (let i = 0; i < tenants.length; i++) {
            const members = Array.from({ length: counts[i] }, (_, j) => ({ id: `user-${j}` }));
            mockClient.groups.listMembers.mockResolvedValueOnce(members);
          }

          const result = await tenantService.getTenants();

          // Property 1: All tenants from database must be returned
          expect(result).toHaveLength(tenants.length);

          // Property 2: Each tenant must be enriched with member count
          for (let i = 0; i < tenants.length; i++) {
            expect(result[i].id).toBe(tenants[i].id);
            expect(result[i].keycloakGroupId).toBe(tenants[i].keycloak_group_id);
            expect(result[i].memberCount).toBe(counts[i]);
          }

          // Property 3: Member count must be queried from Keycloak for each tenant
          expect(mockClient.groups.listMembers).toHaveBeenCalledTimes(tenants.length);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('handles member count errors gracefully with zero fallback', async () => {
    await fc.assert(
      fc.asyncProperty(
        tenantListArbitrary.filter(arr => arr.length > 0),
        async (tenants: any[]) => {
          mockDb.query.mockClear();
          mockClient.groups.listMembers.mockClear();

          mockDb.query.mockResolvedValue({ rows: tenants } as any);

          // Mock Keycloak member count failures
          mockClient.groups.listMembers.mockRejectedValue(new Error('Keycloak error'));

          const result = await tenantService.getTenants();

          // Property: All tenants must have memberCount of 0 when Keycloak fails
          for (const tenant of result) {
            expect(tenant.memberCount).toBe(0);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * Feature: keycloak-admin-integration, Property 5: Tenant Update Dual-Store Consistency
 * 
 * For any tenant update request, both the Keycloak group attributes and the database
 * record should be updated with the new values.
 * 
 * Validates: Requirements 2.4
 */
describe('Property 5: Tenant Update Dual-Store Consistency', () => {
  let tenantService: TenantService;
  let mockKcAdmin: jest.Mocked<KeycloakAdminService>;
  let mockDb: jest.Mocked<typeof db>;
  let mockClient: any;

  const existingTenantArbitrary = fc.record({
    id: fc.uuid(),
    keycloak_group_id: fc.uuid(),
    name: fc.string({ minLength: 1, maxLength: 50 }),
    display_name: fc.string({ minLength: 1, maxLength: 100 }),
    domain: fc.option(fc.domain(), { nil: null }),
    status: fc.constantFrom('active', 'inactive'),
    created_at: fc.date(),
    updated_at: fc.date(),
  });

  const updateDataArbitrary = fc.record({
    name: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: undefined }),
    displayName: fc.option(fc.string({ minLength: 1, maxLength: 100 }), { nil: undefined }),
    domain: fc.option(fc.domain(), { nil: undefined }),
    status: fc.option(fc.constantFrom('active', 'inactive'), { nil: undefined }),
  });

  beforeEach(() => {
    jest.clearAllMocks();

    mockClient = {
      groups: {
        update: jest.fn(),
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

    tenantService = new TenantService(mockKcAdmin, mockDb);
  });

  test('updates tenant in both Keycloak and database with consistent data', async () => {
    await fc.assert(
      fc.asyncProperty(
        existingTenantArbitrary,
        updateDataArbitrary,
        async (existingTenant: any, updates: UpdateTenantDto) => {
          mockClient.groups.update.mockClear();
          mockDb.query.mockClear();
          mockClient.groups.listMembers.mockClear();

          // Mock getTenantById
          mockDb.query.mockResolvedValueOnce({ rows: [existingTenant] } as any);
          mockClient.groups.listMembers.mockResolvedValueOnce([]);

          // Mock update query
          const updatedTenant = {
            ...existingTenant,
            name: updates.name || existingTenant.name,
            display_name: updates.displayName || existingTenant.display_name,
            domain: updates.domain !== undefined ? updates.domain : existingTenant.domain,
            status: updates.status || existingTenant.status,
          };
          mockDb.query.mockResolvedValueOnce({ rows: [updatedTenant] } as any);
          mockClient.groups.listMembers.mockResolvedValueOnce([]);

          await tenantService.updateTenant(existingTenant.id, updates);

          // Property 1: Keycloak group must be updated
          expect(mockClient.groups.update).toHaveBeenCalledWith(
            { id: existingTenant.keycloak_group_id },
            {
              name: updates.name || existingTenant.name,
              attributes: {
                displayName: [updates.displayName || existingTenant.display_name],
                domain: updates.domain !== undefined ? [updates.domain] : (existingTenant.domain ? [existingTenant.domain] : []),
                status: [updates.status || existingTenant.status],
              },
            }
          );

          // Property 2: Database record must be updated
          expect(mockDb.query).toHaveBeenCalledWith(
            expect.stringContaining('UPDATE tenants'),
            expect.any(Array)
          );
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * Feature: keycloak-admin-integration, Property 6: Tenant Deletion Cascade
 * 
 * For any tenant deletion request, the system should remove the Keycloak group,
 * the database record, and all user associations with that tenant.
 * 
 * Validates: Requirements 2.5, 2.6
 */
describe('Property 6: Tenant Deletion Cascade', () => {
  let tenantService: TenantService;
  let mockKcAdmin: jest.Mocked<KeycloakAdminService>;
  let mockDb: jest.Mocked<typeof db>;
  let mockClient: any;

  const tenantArbitrary = fc.record({
    id: fc.uuid(),
    keycloak_group_id: fc.uuid(),
    name: fc.string({ minLength: 1, maxLength: 50 }),
    display_name: fc.string({ minLength: 1, maxLength: 100 }),
    domain: fc.option(fc.domain(), { nil: null }),
    status: fc.constantFrom('active', 'inactive'),
    created_at: fc.date(),
    updated_at: fc.date(),
  });

  beforeEach(() => {
    jest.clearAllMocks();

    mockClient = {
      groups: {
        del: jest.fn(),
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

    tenantService = new TenantService(mockKcAdmin, mockDb);
  });

  test('deletes tenant from both Keycloak and database', async () => {
    await fc.assert(
      fc.asyncProperty(
        tenantArbitrary,
        async (tenant: any) => {
          mockClient.groups.del.mockClear();
          mockDb.query.mockClear();
          mockClient.groups.listMembers.mockClear();

          // Mock getTenantById
          mockDb.query.mockResolvedValueOnce({ rows: [tenant] } as any);
          mockClient.groups.listMembers.mockResolvedValueOnce([]);

          // Mock delete
          mockDb.query.mockResolvedValueOnce({ rows: [] } as any);

          await tenantService.deleteTenant(tenant.id);

          // Property 1: Keycloak group must be deleted
          expect(mockClient.groups.del).toHaveBeenCalledWith({ id: tenant.keycloak_group_id });

          // Property 2: Database record must be deleted
          expect(mockDb.query).toHaveBeenCalledWith(
            'DELETE FROM tenants WHERE id = $1',
            [tenant.id]
          );

          // Property 3: Deletion must occur in correct order (Keycloak first, then database)
          const delCallOrder = mockClient.groups.del.mock.invocationCallOrder[0];
          const dbDeleteCallOrder = mockDb.query.mock.invocationCallOrder[1]; // Second query call
          expect(delCallOrder).toBeLessThan(dbDeleteCallOrder);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('throws error when tenant does not exist', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        async (nonExistentId: string) => {
          mockDb.query.mockClear();
          mockClient.groups.del.mockClear();

          // Mock getTenantById returning no results
          mockDb.query.mockResolvedValueOnce({ rows: [] } as any);

          // Property: Deletion must fail for non-existent tenant
          await expect(tenantService.deleteTenant(nonExistentId)).rejects.toThrow('Tenant not found');

          // Property: Keycloak deletion must not be attempted
          expect(mockClient.groups.del).not.toHaveBeenCalled();
        }
      ),
      { numRuns: 100 }
    );
  });
});
