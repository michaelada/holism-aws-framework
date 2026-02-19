import { OrganizationService } from '../organization.service';
import { capabilityService } from '../capability.service';
import { organizationTypeService } from '../organization-type.service';
import { KeycloakAdminService } from '../keycloak-admin.service';
import { orgPaymentMethodDataService } from '../org-payment-method-data.service';
import cacheService from '../cache.service';
import { db } from '../../database/pool';
import { logger } from '../../config/logger';

// Mock dependencies
jest.mock('../../database/pool');
jest.mock('../../config/logger');
jest.mock('../capability.service');
jest.mock('../organization-type.service');
jest.mock('../org-payment-method-data.service');
jest.mock('../cache.service');

describe('OrganizationService', () => {
  let service: OrganizationService;
  let mockKcAdmin: jest.Mocked<KeycloakAdminService>;
  let mockClient: any;
  const mockDb = db as jest.Mocked<typeof db>;
  const mockCapabilityService = capabilityService as jest.Mocked<typeof capabilityService>;
  const mockOrgTypeService = organizationTypeService as jest.Mocked<typeof organizationTypeService>;
  const mockOrgPaymentMethodDataService = orgPaymentMethodDataService as jest.Mocked<typeof orgPaymentMethodDataService>;
  const mockCacheService = cacheService as jest.Mocked<typeof cacheService>;

  beforeEach(() => {
    // Create mock Keycloak client
    mockClient = {
      groups: {
        find: jest.fn(),
        findOne: jest.fn(),
        create: jest.fn(),
        createChildGroup: jest.fn(),
        del: jest.fn()
      }
    };

    // Create mock KeycloakAdminService
    mockKcAdmin = {
      ensureAuthenticated: jest.fn().mockResolvedValue(undefined),
      getClient: jest.fn().mockReturnValue(mockClient),
      authenticate: jest.fn(),
      isTokenExpired: jest.fn(),
    } as any;

    service = new OrganizationService(mockKcAdmin);
    
    // Mock payment method service methods
    mockOrgPaymentMethodDataService.initializeDefaultPaymentMethods = jest.fn().mockResolvedValue(undefined);
    mockOrgPaymentMethodDataService.syncOrgPaymentMethods = jest.fn().mockResolvedValue(undefined);
    mockOrgPaymentMethodDataService.getOrgPaymentMethods = jest.fn().mockResolvedValue([]);
    
    // Mock cache service methods
    mockCacheService.get = jest.fn().mockReturnValue(null);
    mockCacheService.set = jest.fn();
    mockCacheService.delete = jest.fn();
    
    jest.clearAllMocks();
  });

  describe('getAllOrganizations', () => {
    it('should return all organizations with user counts', async () => {
      const mockOrgs = [
        {
          id: '1',
          organization_type_id: 'type-1',
          keycloak_group_id: 'kc-group-1',
          name: 'org-1',
          display_name: 'Organization 1',
          domain: 'org1.example.com',
          status: 'active',
          currency: 'USD',
          language: 'en',
          enabled_capabilities: ['event-management'],
          settings: {},
          created_at: new Date(),
          updated_at: new Date(),
          created_by: null,
          updated_by: null
        }
      ];

      mockDb.query
        .mockResolvedValueOnce({ rows: mockOrgs } as any) // getAllOrganizations
        .mockResolvedValue({ rows: [{ admin_user_count: '2', account_user_count: '10' }] } as any); // getOrganizationStats

      const result = await service.getAllOrganizations();

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('org-1');
      expect(result[0].adminUserCount).toBe(2);
      expect(result[0].accountUserCount).toBe(10);
    });

    it('should filter by organization type when provided', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [] } as any)
        .mockResolvedValue({ rows: [{ admin_user_count: '0', account_user_count: '0' }] } as any);

      await service.getAllOrganizations('type-1');

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE o.organization_type_id = $1'),
        ['type-1']
      );
    });
  });

  describe('getOrganizationById', () => {
    it('should return organization with user counts', async () => {
      const mockOrg = {
        id: '1',
        organization_type_id: 'type-1',
        keycloak_group_id: 'kc-group-1',
        name: 'org-1',
        display_name: 'Organization 1',
        domain: 'org1.example.com',
        status: 'active',
        currency: 'USD',
        language: 'en',
        enabled_capabilities: ['event-management'],
        settings: {},
        created_at: new Date(),
        updated_at: new Date(),
        created_by: null,
        updated_by: null
      };

      mockDb.query
        .mockResolvedValueOnce({ rows: [mockOrg] } as any)
        .mockResolvedValueOnce({ rows: [{ admin_user_count: '3', account_user_count: '15' }] } as any);

      mockOrgPaymentMethodDataService.getOrgPaymentMethods.mockResolvedValue([]);

      const result = await service.getOrganizationById('1');

      expect(result).not.toBeNull();
      expect(result?.id).toBe('1');
      expect(result?.adminUserCount).toBe(3);
      expect(result?.accountUserCount).toBe(15);
    });

    it('should return null when not found', async () => {
      mockDb.query.mockResolvedValue({ rows: [] } as any);

      const result = await service.getOrganizationById('999');

      expect(result).toBeNull();
    });
  });

  describe('createOrganization', () => {
    const mockOrgType = {
      id: 'type-1',
      name: 'swimming-club',
      displayName: 'Swimming Club',
      currency: 'USD',
      language: 'en',
      defaultCapabilities: ['event-management', 'memberships', 'registrations'],
      defaultLocale: 'en-GB',
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    it('should create organization with Keycloak group hierarchy', async () => {
      const newOrg = {
        organizationTypeId: 'type-1',
        name: 'riverside-swim',
        displayName: 'Riverside Swim Club',
        domain: 'riverside.example.com',
        enabledCapabilities: ['event-management', 'memberships']
      };

      mockOrgTypeService.getOrganizationTypeById.mockResolvedValue(mockOrgType);
      mockCapabilityService.validateCapabilities.mockResolvedValue(true);

      // Mock Keycloak group creation
      mockClient.groups.find.mockResolvedValue([]);
      mockClient.groups.create.mockResolvedValue({ id: 'type-group-id' });
      mockClient.groups.findOne
        .mockResolvedValueOnce({ id: 'type-group-id', name: 'swimming-club' }) // type group
        .mockResolvedValueOnce({ id: 'org-group-id', name: 'riverside-swim' }); // org group
      mockClient.groups.createChildGroup
        .mockResolvedValueOnce({ id: 'org-group-id' }) // org group
        .mockResolvedValueOnce({ id: 'admins-group-id' }) // admins subgroup
        .mockResolvedValueOnce({ id: 'members-group-id' }); // members subgroup

      const mockCreated = {
        id: '1',
        organization_type_id: 'type-1',
        keycloak_group_id: 'org-group-id',
        name: 'riverside-swim',
        display_name: 'Riverside Swim Club',
        domain: 'riverside.example.com',
        status: 'active',
        currency: 'USD',
        language: 'en',
        enabled_capabilities: ['event-management', 'memberships'],
        settings: {},
        created_at: new Date(),
        updated_at: new Date(),
        created_by: null,
        updated_by: null
      };

      mockDb.query.mockResolvedValue({ rows: [mockCreated] } as any);

      const result = await service.createOrganization(newOrg, 'user-123');

      expect(mockKcAdmin.ensureAuthenticated).toHaveBeenCalled();
      expect(mockClient.groups.createChildGroup).toHaveBeenCalledTimes(3);
      expect(result.name).toBe('riverside-swim');
      expect(result.keycloakGroupId).toBe('org-group-id');
    });

    it('should throw error when organization type not found', async () => {
      mockOrgTypeService.getOrganizationTypeById.mockResolvedValue(null);

      await expect(service.createOrganization({
        organizationTypeId: 'invalid',
        name: 'test',
        displayName: 'Test',
        enabledCapabilities: []
      })).rejects.toThrow('Organization type not found');
    });

    it('should throw error for invalid capabilities', async () => {
      mockOrgTypeService.getOrganizationTypeById.mockResolvedValue(mockOrgType);
      mockCapabilityService.validateCapabilities.mockResolvedValue(false);

      await expect(service.createOrganization({
        organizationTypeId: 'type-1',
        name: 'test',
        displayName: 'Test',
        enabledCapabilities: ['invalid-capability']
      })).rejects.toThrow('Invalid capabilities provided');
    });

    it('should throw error when capabilities not in type defaults', async () => {
      mockOrgTypeService.getOrganizationTypeById.mockResolvedValue(mockOrgType);
      mockCapabilityService.validateCapabilities.mockResolvedValue(true);

      await expect(service.createOrganization({
        organizationTypeId: 'type-1',
        name: 'test',
        displayName: 'Test',
        enabledCapabilities: ['event-management', 'not-in-defaults']
      })).rejects.toThrow('Capabilities not in organization type defaults');
    });

    it('should reuse existing organization type group', async () => {
      const newOrg = {
        organizationTypeId: 'type-1',
        name: 'riverside-swim',
        displayName: 'Riverside Swim Club',
        enabledCapabilities: []
      };

      mockOrgTypeService.getOrganizationTypeById.mockResolvedValue(mockOrgType);

      // Mock existing type group
      mockClient.groups.find.mockResolvedValue([
        { id: 'existing-type-group', name: 'swimming-club' }
      ]);
      mockClient.groups.createChildGroup
        .mockResolvedValueOnce({ id: 'org-group-id' })
        .mockResolvedValueOnce({ id: 'admins-group-id' })
        .mockResolvedValueOnce({ id: 'members-group-id' });
      mockClient.groups.findOne.mockResolvedValue({ id: 'org-group-id' });

      mockDb.query.mockResolvedValue({ rows: [{ id: '1', keycloak_group_id: 'org-group-id' }] } as any);

      await service.createOrganization(newOrg);

      expect(mockClient.groups.create).not.toHaveBeenCalled();
      expect(mockClient.groups.createChildGroup).toHaveBeenCalledWith(
        { id: 'existing-type-group' },
        { name: 'riverside-swim' }
      );
    });
  });

  describe('updateOrganization', () => {
    it('should update organization fields', async () => {
      const mockOrg = {
        id: '1',
        organization_type_id: 'type-1',
        keycloak_group_id: 'kc-group-1',
        name: 'org-1',
        display_name: 'Organization 1',
        status: 'active',
        currency: 'USD',
        language: 'en',
        enabled_capabilities: ['event-management'],
        settings: {},
        created_at: new Date(),
        updated_at: new Date(),
        created_by: null,
        updated_by: null,
        org_type_name: 'swimming-club',
        org_type_display_name: 'Swimming Club',
        org_type_default_locale: 'en-GB'
      };

      const mockOrgType = {
        id: 'type-1',
        name: 'swimming-club',
        displayName: 'Swimming Club',
        defaultCapabilities: ['event-management', 'memberships'],
        defaultLocale: 'en-GB',
        status: 'active',
        currency: 'USD',
        language: 'en',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const mockUpdated = {
        ...mockOrg,
        display_name: 'Updated Name'
      };

      mockDb.query
        .mockResolvedValueOnce({ rows: [mockOrg] } as any) // getOrganizationById query
        .mockResolvedValueOnce({ rows: [{ admin_user_count: '0', account_user_count: '0' }] } as any) // stats in getOrganizationById
        .mockResolvedValueOnce({ rows: [mockUpdated] } as any); // update query

      mockOrgTypeService.getOrganizationTypeById.mockResolvedValue(mockOrgType);
      mockCapabilityService.validateCapabilities.mockResolvedValue(true);
      mockOrgPaymentMethodDataService.getOrgPaymentMethods.mockResolvedValue([]);

      const result = await service.updateOrganization('1', {
        displayName: 'Updated Name',
        enabledCapabilities: ['event-management']
      }, 'user-123');

      expect(result.displayName).toBe('Updated Name');
    });

    it('should throw error when organization not found', async () => {
      // Mock for updateOrganization - it doesn't call getOrganizationById first
      // It just tries to update directly
      mockDb.query.mockResolvedValue({ rows: [] } as any);

      await expect(service.updateOrganization('999', { displayName: 'Test' }))
        .rejects.toThrow('Organization not found');
    });
  });

  describe('deleteOrganization', () => {
    it('should delete organization and Keycloak group when no users exist', async () => {
      const mockOrg = {
        id: '1',
        organization_type_id: 'type-1',
        keycloak_group_id: 'kc-group-1',
        name: 'org-1',
        display_name: 'Organization 1',
        domain: 'org1.example.com',
        status: 'active',
        currency: 'USD',
        language: 'en',
        enabled_capabilities: [],
        settings: {},
        created_at: new Date(),
        updated_at: new Date(),
        created_by: null,
        updated_by: null,
        org_type_name: 'swimming-club',
        org_type_display_name: 'Swimming Club',
        org_type_default_locale: 'en-GB'
      };

      mockDb.query
        .mockResolvedValueOnce({ rows: [mockOrg] } as any) // getOrganizationById
        .mockResolvedValueOnce({ rows: [{ admin_user_count: '0', account_user_count: '0' }] } as any) // stats for getOrganizationById
        .mockResolvedValueOnce({ rows: [{ admin_user_count: '0', account_user_count: '0' }] } as any) // stats check in deleteOrganization
        .mockResolvedValueOnce({ rowCount: 1 } as any); // delete

      mockOrgPaymentMethodDataService.getOrgPaymentMethods.mockResolvedValue([]);

      await service.deleteOrganization('1');

      expect(mockKcAdmin.ensureAuthenticated).toHaveBeenCalled();
      expect(mockClient.groups.del).toHaveBeenCalledWith({ id: 'kc-group-1' });
      expect(logger.info).toHaveBeenCalledWith('Organization deleted: 1');
    });

    it('should throw error when users exist', async () => {
      const mockOrg = {
        id: '1',
        organization_type_id: 'type-1',
        keycloak_group_id: 'kc-group-1',
        name: 'org-1',
        display_name: 'Organization 1',
        domain: 'org1.example.com',
        status: 'active',
        currency: 'USD',
        language: 'en',
        enabled_capabilities: [],
        settings: {},
        created_at: new Date(),
        updated_at: new Date(),
        created_by: null,
        updated_by: null,
        org_type_name: 'swimming-club',
        org_type_display_name: 'Swimming Club',
        org_type_default_locale: 'en-GB'
      };

      mockDb.query
        .mockResolvedValueOnce({ rows: [mockOrg] } as any) // getOrganizationById query
        .mockResolvedValueOnce({ rows: [{ admin_user_count: '5', account_user_count: '0' }] } as any) // stats in getOrganizationById
        .mockResolvedValueOnce({ rows: [{ admin_user_count: '5', account_user_count: '0' }] } as any); // stats check in deleteOrganization

      mockOrgPaymentMethodDataService.getOrgPaymentMethods.mockResolvedValue([]);

      await expect(service.deleteOrganization('1'))
        .rejects.toThrow('Cannot delete organization with existing users');
    });

    it('should continue deletion even if Keycloak deletion fails', async () => {
      const mockOrg = {
        id: '1',
        organization_type_id: 'type-1',
        keycloak_group_id: 'kc-group-1',
        name: 'org-1',
        display_name: 'Organization 1',
        domain: 'org1.example.com',
        status: 'active',
        currency: 'USD',
        language: 'en',
        enabled_capabilities: [],
        settings: {},
        created_at: new Date(),
        updated_at: new Date(),
        created_by: null,
        updated_by: null,
        org_type_name: 'swimming-club',
        org_type_display_name: 'Swimming Club',
        org_type_default_locale: 'en-GB'
      };

      mockDb.query
        .mockResolvedValueOnce({ rows: [mockOrg] } as any) // getOrganizationById query
        .mockResolvedValueOnce({ rows: [{ admin_user_count: '0', account_user_count: '0' }] } as any) // stats in getOrganizationById
        .mockResolvedValueOnce({ rows: [{ admin_user_count: '0', account_user_count: '0' }] } as any) // stats check in deleteOrganization
        .mockResolvedValueOnce({ rowCount: 1 } as any); // delete query

      mockClient.groups.del.mockRejectedValue(new Error('Keycloak error'));
      mockOrgPaymentMethodDataService.getOrgPaymentMethods.mockResolvedValue([]);

      await service.deleteOrganization('1');

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Failed to delete Keycloak group'),
        expect.any(Error)
      );
      expect(logger.info).toHaveBeenCalledWith('Organization deleted: 1');
    });
  });

  describe('getOrganizationStats', () => {
    it('should return user statistics', async () => {
      mockDb.query.mockResolvedValue({
        rows: [{ admin_user_count: '5', account_user_count: '25' }]
      } as any);

      const result = await service.getOrganizationStats('1');

      expect(result.adminUserCount).toBe(5);
      expect(result.accountUserCount).toBe(25);
    });

    it('should return zero counts when no users', async () => {
      mockDb.query.mockResolvedValue({
        rows: [{ admin_user_count: '0', account_user_count: '0' }]
      } as any);

      const result = await service.getOrganizationStats('1');

      expect(result.adminUserCount).toBe(0);
      expect(result.accountUserCount).toBe(0);
    });
  });

  describe('updateOrganizationCapabilities', () => {
    it('should update capabilities', async () => {
      const mockOrg = {
        id: '1',
        organization_type_id: 'type-1',
        keycloak_group_id: 'kc-group-1',
        name: 'org-1',
        display_name: 'Organization 1',
        status: 'active',
        currency: 'USD',
        language: 'en',
        enabled_capabilities: ['event-management'],
        settings: {},
        created_at: new Date(),
        updated_at: new Date(),
        created_by: null,
        updated_by: null,
        org_type_name: 'swimming-club',
        org_type_display_name: 'Swimming Club',
        org_type_default_locale: 'en-GB'
      };

      const mockUpdated = {
        ...mockOrg,
        enabled_capabilities: ['event-management', 'memberships']
      };

      mockDb.query
        .mockResolvedValueOnce({ rows: [mockOrg] } as any) // getOrganizationById query
        .mockResolvedValueOnce({ rows: [{ admin_user_count: '0', account_user_count: '0' }] } as any) // stats in getOrganizationById
        .mockResolvedValueOnce({ rows: [mockUpdated] } as any); // update query

      mockOrgTypeService.getOrganizationTypeById.mockResolvedValue({
        id: 'type-1',
        name: 'swimming-club',
        displayName: 'Swimming Club',
        defaultCapabilities: ['event-management', 'memberships', 'registrations'],
        defaultLocale: 'en-GB',
        status: 'active',
        currency: 'USD',
        language: 'en',
        createdAt: new Date(),
        updatedAt: new Date()
      });

      mockCapabilityService.validateCapabilities.mockResolvedValue(true);
      mockOrgPaymentMethodDataService.getOrgPaymentMethods.mockResolvedValue([]);

      const result = await service.updateOrganizationCapabilities(
        '1',
        ['event-management', 'memberships'],
        'user-123'
      );

      expect(result.enabledCapabilities).toEqual(['event-management', 'memberships']);
    });
  });

  describe('Payment Method Integration', () => {
    const mockOrgType = {
      id: 'type-1',
      name: 'swimming-club',
      displayName: 'Swimming Club',
      currency: 'USD',
      language: 'en',
      defaultCapabilities: ['event-management'],
      defaultLocale: 'en-GB',
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    describe('createOrganization with payment methods', () => {
      it('should initialize default payment methods', async () => {
        const newOrg = {
          organizationTypeId: 'type-1',
          name: 'test-org',
          displayName: 'Test Organization',
          enabledCapabilities: []
        };

        mockOrgTypeService.getOrganizationTypeById.mockResolvedValue(mockOrgType);
        mockClient.groups.find.mockResolvedValue([]);
        mockClient.groups.create.mockResolvedValue({ id: 'type-group-id' });
        mockClient.groups.findOne
          .mockResolvedValueOnce({ id: 'type-group-id', name: 'swimming-club' })
          .mockResolvedValueOnce({ id: 'org-group-id', name: 'test-org' });
        mockClient.groups.createChildGroup
          .mockResolvedValueOnce({ id: 'org-group-id' })
          .mockResolvedValueOnce({ id: 'admins-group-id' })
          .mockResolvedValueOnce({ id: 'members-group-id' });

        const mockCreated = {
          id: 'new-org-id',
          organization_type_id: 'type-1',
          keycloak_group_id: 'org-group-id',
          name: 'test-org',
          display_name: 'Test Organization',
          status: 'active',
          currency: 'USD',
          language: 'en',
          enabled_capabilities: [],
          settings: {},
          created_at: new Date(),
          updated_at: new Date(),
          created_by: null,
          updated_by: null
        };

        mockDb.query.mockResolvedValue({ rows: [mockCreated] } as any);

        await service.createOrganization(newOrg);

        expect(mockOrgPaymentMethodDataService.initializeDefaultPaymentMethods).toHaveBeenCalledWith('new-org-id');
      });

      it('should sync additional payment methods when provided', async () => {
        const newOrg = {
          organizationTypeId: 'type-1',
          name: 'test-org',
          displayName: 'Test Organization',
          enabledCapabilities: [],
          enabledPaymentMethods: ['stripe', 'helix-pay']
        };

        mockOrgTypeService.getOrganizationTypeById.mockResolvedValue(mockOrgType);
        mockClient.groups.find.mockResolvedValue([]);
        mockClient.groups.create.mockResolvedValue({ id: 'type-group-id' });
        mockClient.groups.findOne
          .mockResolvedValueOnce({ id: 'type-group-id', name: 'swimming-club' })
          .mockResolvedValueOnce({ id: 'org-group-id', name: 'test-org' });
        mockClient.groups.createChildGroup
          .mockResolvedValueOnce({ id: 'org-group-id' })
          .mockResolvedValueOnce({ id: 'admins-group-id' })
          .mockResolvedValueOnce({ id: 'members-group-id' });

        const mockCreated = {
          id: 'new-org-id',
          organization_type_id: 'type-1',
          keycloak_group_id: 'org-group-id',
          name: 'test-org',
          display_name: 'Test Organization',
          status: 'active',
          currency: 'USD',
          language: 'en',
          enabled_capabilities: [],
          settings: {},
          created_at: new Date(),
          updated_at: new Date(),
          created_by: null,
          updated_by: null
        };

        mockDb.query.mockResolvedValue({ rows: [mockCreated] } as any);

        await service.createOrganization(newOrg);

        expect(mockOrgPaymentMethodDataService.initializeDefaultPaymentMethods).toHaveBeenCalledWith('new-org-id');
        expect(mockOrgPaymentMethodDataService.syncOrgPaymentMethods).toHaveBeenCalledWith(
          'new-org-id',
          ['stripe', 'helix-pay']
        );
      });

      it('should not fail organization creation if payment method initialization fails', async () => {
        const newOrg = {
          organizationTypeId: 'type-1',
          name: 'test-org',
          displayName: 'Test Organization',
          enabledCapabilities: []
        };

        mockOrgTypeService.getOrganizationTypeById.mockResolvedValue(mockOrgType);
        mockClient.groups.find.mockResolvedValue([]);
        mockClient.groups.create.mockResolvedValue({ id: 'type-group-id' });
        mockClient.groups.findOne
          .mockResolvedValueOnce({ id: 'type-group-id', name: 'swimming-club' })
          .mockResolvedValueOnce({ id: 'org-group-id', name: 'test-org' });
        mockClient.groups.createChildGroup
          .mockResolvedValueOnce({ id: 'org-group-id' })
          .mockResolvedValueOnce({ id: 'admins-group-id' })
          .mockResolvedValueOnce({ id: 'members-group-id' });

        const mockCreated = {
          id: 'new-org-id',
          organization_type_id: 'type-1',
          keycloak_group_id: 'org-group-id',
          name: 'test-org',
          display_name: 'Test Organization',
          status: 'active',
          currency: 'USD',
          language: 'en',
          enabled_capabilities: [],
          settings: {},
          created_at: new Date(),
          updated_at: new Date(),
          created_by: null,
          updated_by: null
        };

        mockDb.query.mockResolvedValue({ rows: [mockCreated] } as any);
        mockOrgPaymentMethodDataService.initializeDefaultPaymentMethods.mockRejectedValue(
          new Error('Payment method initialization failed')
        );

        const result = await service.createOrganization(newOrg);

        expect(result.id).toBe('new-org-id');
        expect(logger.error).toHaveBeenCalledWith(
          expect.stringContaining('Error initializing payment methods'),
          expect.any(Error)
        );
      });
    });

    describe('updateOrganization with payment methods', () => {
      it('should sync payment methods when enabledPaymentMethods is provided', async () => {
        const mockOrg = {
          id: '1',
          organization_type_id: 'type-1',
          keycloak_group_id: 'kc-group-1',
          name: 'org-1',
          display_name: 'Organization 1',
          status: 'active',
          currency: 'USD',
          language: 'en',
          enabled_capabilities: [],
          settings: {},
          created_at: new Date(),
          updated_at: new Date(),
          created_by: null,
          updated_by: null
        };

        mockDb.query.mockResolvedValue({ rows: [mockOrg] } as any);

        await service.updateOrganization('1', {
          enabledPaymentMethods: ['stripe', 'helix-pay']
        });

        expect(mockOrgPaymentMethodDataService.syncOrgPaymentMethods).toHaveBeenCalledWith(
          '1',
          ['stripe', 'helix-pay']
        );
      });

      it('should not sync payment methods when enabledPaymentMethods is not provided', async () => {
        const mockOrg = {
          id: '1',
          organization_type_id: 'type-1',
          keycloak_group_id: 'kc-group-1',
          name: 'org-1',
          display_name: 'Organization 1',
          status: 'active',
          currency: 'USD',
          language: 'en',
          enabled_capabilities: [],
          settings: {},
          created_at: new Date(),
          updated_at: new Date(),
          created_by: null,
          updated_by: null
        };

        mockDb.query.mockResolvedValue({ rows: [mockOrg] } as any);

        await service.updateOrganization('1', {
          displayName: 'Updated Name'
        });

        expect(mockOrgPaymentMethodDataService.syncOrgPaymentMethods).not.toHaveBeenCalled();
      });

      it('should not fail organization update if payment method sync fails', async () => {
        const mockOrg = {
          id: '1',
          organization_type_id: 'type-1',
          keycloak_group_id: 'kc-group-1',
          name: 'org-1',
          display_name: 'Organization 1',
          status: 'active',
          currency: 'USD',
          language: 'en',
          enabled_capabilities: [],
          settings: {},
          created_at: new Date(),
          updated_at: new Date(),
          created_by: null,
          updated_by: null
        };

        mockDb.query.mockResolvedValue({ rows: [mockOrg] } as any);
        mockOrgPaymentMethodDataService.syncOrgPaymentMethods.mockRejectedValue(
          new Error('Payment method sync failed')
        );

        const result = await service.updateOrganization('1', {
          enabledPaymentMethods: ['stripe']
        });

        expect(result.id).toBe('1');
        expect(logger.error).toHaveBeenCalledWith(
          expect.stringContaining('Error syncing payment methods'),
          expect.any(Error)
        );
      });
    });

    describe('getOrganizationById with payment methods', () => {
      it('should include payment methods in response', async () => {
        const mockOrg = {
          id: '1',
          organization_type_id: 'type-1',
          keycloak_group_id: 'kc-group-1',
          name: 'org-1',
          display_name: 'Organization 1',
          status: 'active',
          currency: 'USD',
          language: 'en',
          enabled_capabilities: [],
          settings: {},
          created_at: new Date(),
          updated_at: new Date(),
          created_by: null,
          updated_by: null,
          org_type_name: 'swimming-club',
          org_type_display_name: 'Swimming Club',
          org_type_default_locale: 'en-GB'
        };

        const mockPaymentMethods = [
          {
            id: 'pm-1',
            organizationId: '1',
            paymentMethodId: 'method-1',
            status: 'active' as const,
            paymentData: {},
            createdAt: new Date(),
            updatedAt: new Date()
          }
        ];

        mockDb.query
          .mockResolvedValueOnce({ rows: [mockOrg] } as any)
          .mockResolvedValueOnce({ rows: [{ admin_user_count: '0', account_user_count: '0' }] } as any);

        mockOrgPaymentMethodDataService.getOrgPaymentMethods.mockResolvedValue(mockPaymentMethods);

        const result = await service.getOrganizationById('1');

        expect(result).not.toBeNull();
        expect(result?.paymentMethods).toEqual(mockPaymentMethods);
        expect(mockOrgPaymentMethodDataService.getOrgPaymentMethods).toHaveBeenCalledWith('1');
      });

      it('should continue without payment methods if fetch fails', async () => {
        const mockOrg = {
          id: '1',
          organization_type_id: 'type-1',
          keycloak_group_id: 'kc-group-1',
          name: 'org-1',
          display_name: 'Organization 1',
          status: 'active',
          currency: 'USD',
          language: 'en',
          enabled_capabilities: [],
          settings: {},
          created_at: new Date(),
          updated_at: new Date(),
          created_by: null,
          updated_by: null,
          org_type_name: 'swimming-club',
          org_type_display_name: 'Swimming Club',
          org_type_default_locale: 'en-GB'
        };

        mockDb.query
          .mockResolvedValueOnce({ rows: [mockOrg] } as any)
          .mockResolvedValueOnce({ rows: [{ admin_user_count: '0', account_user_count: '0' }] } as any);

        mockOrgPaymentMethodDataService.getOrgPaymentMethods.mockRejectedValue(
          new Error('Payment methods fetch failed')
        );

        const result = await service.getOrganizationById('1');

        expect(result).not.toBeNull();
        expect(result?.paymentMethods).toEqual([]);
        expect(logger.error).toHaveBeenCalledWith(
          expect.stringContaining('Error fetching payment methods'),
          expect.any(Error)
        );
      });
    });
  });
});
