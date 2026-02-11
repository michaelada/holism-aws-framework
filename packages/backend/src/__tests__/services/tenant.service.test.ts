import { TenantService, CreateTenantDto, UpdateTenantDto } from '../../services/tenant.service';
import { KeycloakAdminService } from '../../services/keycloak-admin.service';
import { db } from '../../database/pool';

// Mock dependencies
jest.mock('../../services/keycloak-admin.service');
jest.mock('../../database/pool');

describe('TenantService', () => {
  let tenantService: TenantService;
  let mockKcAdmin: jest.Mocked<KeycloakAdminService>;
  let mockDb: jest.Mocked<typeof db>;
  let mockClient: any;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Create mock Keycloak client
    mockClient = {
      groups: {
        create: jest.fn(),
        find: jest.fn(),
        findOne: jest.fn(),
        update: jest.fn(),
        del: jest.fn(),
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
    tenantService = new TenantService(mockKcAdmin, mockDb);
  });

  describe('createTenant', () => {
    const createData: CreateTenantDto = {
      name: 'test-tenant',
      displayName: 'Test Tenant',
      domain: 'test.example.com',
    };

    it('should create tenant in Keycloak and database', async () => {
      const mockGroupId = 'keycloak-group-123';
      const mockTenantId = 'db-tenant-456';

      // Mock Keycloak group creation
      mockClient.groups.create.mockResolvedValue({ id: mockGroupId });

      // Mock database insertion
      mockDb.query.mockResolvedValue({
        rows: [{
          id: mockTenantId,
          keycloak_group_id: mockGroupId,
          name: createData.name,
          display_name: createData.displayName,
          domain: createData.domain,
          status: 'active',
          created_at: new Date(),
          updated_at: new Date(),
        }],
      } as any);

      const result = await tenantService.createTenant(createData);

      // Verify Keycloak group creation
      expect(mockKcAdmin.ensureAuthenticated).toHaveBeenCalled();
      expect(mockClient.groups.create).toHaveBeenCalledWith({
        name: createData.name,
        attributes: {
          displayName: [createData.displayName],
          domain: [createData.domain],
          status: ['active'],
          createdAt: expect.any(Array),
        },
      });

      // Verify database insertion
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO tenants'),
        [mockGroupId, createData.name, createData.displayName, createData.domain, 'active']
      );

      // Verify result
      expect(result).toMatchObject({
        id: mockTenantId,
        keycloakGroupId: mockGroupId,
        name: createData.name,
        displayName: createData.displayName,
        domain: createData.domain,
        status: 'active',
        memberCount: 0,
      });
    });

    it('should create tenant without domain', async () => {
      const dataWithoutDomain: CreateTenantDto = {
        name: 'test-tenant',
        displayName: 'Test Tenant',
      };

      const mockGroupId = 'keycloak-group-123';
      mockClient.groups.create.mockResolvedValue({ id: mockGroupId });
      mockDb.query.mockResolvedValue({
        rows: [{
          id: 'db-tenant-456',
          keycloak_group_id: mockGroupId,
          name: dataWithoutDomain.name,
          display_name: dataWithoutDomain.displayName,
          domain: null,
          status: 'active',
          created_at: new Date(),
          updated_at: new Date(),
        }],
      } as any);

      const result = await tenantService.createTenant(dataWithoutDomain);

      expect(mockClient.groups.create).toHaveBeenCalledWith({
        name: dataWithoutDomain.name,
        attributes: {
          displayName: [dataWithoutDomain.displayName],
          domain: [],
          status: ['active'],
          createdAt: expect.any(Array),
        },
      });

      expect(result.domain).toBeNull();
    });

    it('should rollback Keycloak group if database fails', async () => {
      const mockGroupId = 'keycloak-group-123';
      mockClient.groups.create.mockResolvedValue({ id: mockGroupId });
      mockDb.query.mockRejectedValue(new Error('Database error'));

      await expect(tenantService.createTenant(createData)).rejects.toThrow('Database error');

      // Verify rollback was attempted
      expect(mockClient.groups.del).toHaveBeenCalledWith({ id: mockGroupId });
    });

    it('should throw error if Keycloak group creation fails', async () => {
      mockClient.groups.create.mockRejectedValue(new Error('Keycloak error'));

      await expect(tenantService.createTenant(createData)).rejects.toThrow('Keycloak error');

      // Verify database was not called
      expect(mockDb.query).not.toHaveBeenCalled();
    });

    it('should throw error if group ID is not returned', async () => {
      mockClient.groups.create.mockResolvedValue({ id: undefined });

      await expect(tenantService.createTenant(createData)).rejects.toThrow(
        'Failed to get group ID from Keycloak'
      );
    });
  });

  describe('getTenants', () => {
    it('should list all tenants with member counts', async () => {
      const mockTenants = [
        {
          id: 'tenant-1',
          keycloak_group_id: 'group-1',
          name: 'tenant-one',
          display_name: 'Tenant One',
          domain: 'one.example.com',
          status: 'active',
          created_at: new Date(),
          updated_at: new Date(),
        },
        {
          id: 'tenant-2',
          keycloak_group_id: 'group-2',
          name: 'tenant-two',
          display_name: 'Tenant Two',
          domain: 'two.example.com',
          status: 'active',
          created_at: new Date(),
          updated_at: new Date(),
        },
      ];

      mockDb.query.mockResolvedValue({ rows: mockTenants } as any);
      mockClient.groups.listMembers
        .mockResolvedValueOnce([{ id: 'user-1' }, { id: 'user-2' }]) // 2 members for tenant-1
        .mockResolvedValueOnce([{ id: 'user-3' }]); // 1 member for tenant-2

      const result = await tenantService.getTenants();

      expect(mockKcAdmin.ensureAuthenticated).toHaveBeenCalled();
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT')
      );

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        id: 'tenant-1',
        keycloakGroupId: 'group-1',
        name: 'tenant-one',
        memberCount: 2,
      });
      expect(result[1]).toMatchObject({
        id: 'tenant-2',
        keycloakGroupId: 'group-2',
        name: 'tenant-two',
        memberCount: 1,
      });
    });

    it('should handle member count errors gracefully', async () => {
      const mockTenants = [{
        id: 'tenant-1',
        keycloak_group_id: 'group-1',
        name: 'tenant-one',
        display_name: 'Tenant One',
        domain: null,
        status: 'active',
        created_at: new Date(),
        updated_at: new Date(),
      }];

      mockDb.query.mockResolvedValue({ rows: mockTenants } as any);
      mockClient.groups.listMembers.mockRejectedValue(new Error('Keycloak error'));

      const result = await tenantService.getTenants();

      expect(result).toHaveLength(1);
      expect(result[0].memberCount).toBe(0);
    });

    it('should return empty array when no tenants exist', async () => {
      mockDb.query.mockResolvedValue({ rows: [] } as any);

      const result = await tenantService.getTenants();

      expect(result).toEqual([]);
    });
  });

  describe('getTenantById', () => {
    it('should get tenant by ID with member count', async () => {
      const mockTenant = {
        id: 'tenant-1',
        keycloak_group_id: 'group-1',
        name: 'tenant-one',
        display_name: 'Tenant One',
        domain: 'one.example.com',
        status: 'active',
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockDb.query.mockResolvedValue({ rows: [mockTenant] } as any);
      mockClient.groups.listMembers.mockResolvedValue([
        { id: 'user-1' },
        { id: 'user-2' },
        { id: 'user-3' },
      ]);

      const result = await tenantService.getTenantById('tenant-1');

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE id = $1'),
        ['tenant-1']
      );

      expect(result).toMatchObject({
        id: 'tenant-1',
        keycloakGroupId: 'group-1',
        name: 'tenant-one',
        memberCount: 3,
      });
    });

    it('should throw error if tenant not found', async () => {
      mockDb.query.mockResolvedValue({ rows: [] } as any);

      await expect(tenantService.getTenantById('non-existent')).rejects.toThrow(
        'Tenant not found: non-existent'
      );
    });

    it('should handle member count error gracefully', async () => {
      const mockTenant = {
        id: 'tenant-1',
        keycloak_group_id: 'group-1',
        name: 'tenant-one',
        display_name: 'Tenant One',
        domain: null,
        status: 'active',
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockDb.query.mockResolvedValue({ rows: [mockTenant] } as any);
      mockClient.groups.listMembers.mockRejectedValue(new Error('Keycloak error'));

      const result = await tenantService.getTenantById('tenant-1');

      expect(result.memberCount).toBe(0);
    });
  });

  describe('updateTenant', () => {
    const mockExistingTenant = {
      id: 'tenant-1',
      keycloak_group_id: 'group-1',
      name: 'old-name',
      display_name: 'Old Name',
      domain: 'old.example.com',
      status: 'active',
      created_at: new Date(),
      updated_at: new Date(),
    };

    it('should update tenant in both Keycloak and database', async () => {
      const updates: UpdateTenantDto = {
        name: 'new-name',
        displayName: 'New Name',
        domain: 'new.example.com',
      };

      const updatedTenant = {
        ...mockExistingTenant,
        name: updates.name,
        display_name: updates.displayName,
        domain: updates.domain,
      };

      // Mock getTenantById
      mockDb.query.mockResolvedValueOnce({ rows: [mockExistingTenant] } as any);
      mockClient.groups.listMembers.mockResolvedValueOnce([]);
      
      // Mock update query
      mockDb.query.mockResolvedValueOnce({ rows: [updatedTenant] } as any);
      mockClient.groups.listMembers.mockResolvedValueOnce([{ id: 'user-1' }]);

      const result = await tenantService.updateTenant('tenant-1', updates);

      // Verify Keycloak update
      expect(mockClient.groups.update).toHaveBeenCalledWith(
        { id: 'group-1' },
        {
          name: updates.name,
          attributes: {
            displayName: [updates.displayName],
            domain: [updates.domain],
            status: ['active'],
          },
        }
      );

      // Verify database update
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE tenants'),
        expect.arrayContaining([updates.name, updates.displayName, updates.domain, 'tenant-1'])
      );

      expect(result).toMatchObject({
        name: updates.name,
        displayName: updates.displayName,
        domain: updates.domain,
      });
    });

    it('should update only specified fields', async () => {
      const updates: UpdateTenantDto = {
        displayName: 'New Display Name',
      };

      const updatedTenant = {
        ...mockExistingTenant,
        display_name: updates.displayName,
      };

      // Mock getTenantById
      mockDb.query.mockResolvedValueOnce({ rows: [mockExistingTenant] } as any);
      mockClient.groups.listMembers.mockResolvedValueOnce([]);
      
      // Mock update query
      mockDb.query.mockResolvedValueOnce({ rows: [updatedTenant] } as any);
      mockClient.groups.listMembers.mockResolvedValueOnce([]);

      await tenantService.updateTenant('tenant-1', updates);

      expect(mockClient.groups.update).toHaveBeenCalledWith(
        { id: 'group-1' },
        {
          name: mockExistingTenant.name, // unchanged
          attributes: {
            displayName: [updates.displayName],
            domain: [mockExistingTenant.domain],
            status: [mockExistingTenant.status],
          },
        }
      );
    });

    it('should throw error if tenant not found', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [] } as any);

      await expect(
        tenantService.updateTenant('non-existent', { displayName: 'New Name' })
      ).rejects.toThrow('Tenant not found');
    });
  });

  describe('deleteTenant', () => {
    const mockTenant = {
      id: 'tenant-1',
      keycloak_group_id: 'group-1',
      name: 'tenant-one',
      display_name: 'Tenant One',
      domain: 'one.example.com',
      status: 'active',
      created_at: new Date(),
      updated_at: new Date(),
    };

    it('should delete tenant from both Keycloak and database', async () => {
      // Mock getTenantById
      mockDb.query.mockResolvedValueOnce({ rows: [mockTenant] } as any);
      mockClient.groups.listMembers.mockResolvedValue([]);

      // Mock delete
      mockDb.query.mockResolvedValueOnce({ rows: [] } as any);

      await tenantService.deleteTenant('tenant-1');

      // Verify Keycloak deletion
      expect(mockClient.groups.del).toHaveBeenCalledWith({ id: 'group-1' });

      // Verify database deletion
      expect(mockDb.query).toHaveBeenCalledWith(
        'DELETE FROM tenants WHERE id = $1',
        ['tenant-1']
      );
    });

    it('should throw error if tenant not found', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [] } as any);

      await expect(tenantService.deleteTenant('non-existent')).rejects.toThrow(
        'Tenant not found'
      );

      expect(mockClient.groups.del).not.toHaveBeenCalled();
    });
  });

  describe('getTenantMemberCount', () => {
    it('should return member count from Keycloak', async () => {
      mockClient.groups.listMembers.mockResolvedValue([
        { id: 'user-1' },
        { id: 'user-2' },
        { id: 'user-3' },
      ]);

      const count = await tenantService.getTenantMemberCount('group-1');

      expect(mockKcAdmin.ensureAuthenticated).toHaveBeenCalled();
      expect(mockClient.groups.listMembers).toHaveBeenCalledWith({ id: 'group-1' });
      expect(count).toBe(3);
    });

    it('should return 0 for empty group', async () => {
      mockClient.groups.listMembers.mockResolvedValue([]);

      const count = await tenantService.getTenantMemberCount('group-1');

      expect(count).toBe(0);
    });

    it('should throw error if Keycloak fails', async () => {
      mockClient.groups.listMembers.mockRejectedValue(new Error('Keycloak error'));

      await expect(tenantService.getTenantMemberCount('group-1')).rejects.toThrow(
        'Keycloak error'
      );
    });
  });
});
