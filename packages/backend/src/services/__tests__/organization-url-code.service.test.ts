import { OrganizationService } from '../organization.service';
import { capabilityService } from '../capability.service';
import { organizationTypeService } from '../organization-type.service';
import { KeycloakAdminService } from '../keycloak-admin.service';
import { orgPaymentMethodDataService } from '../org-payment-method-data.service';
import cacheService from '../cache.service';
import { db } from '../../database/pool';
import { OrganizationType } from '../../types/organization.types';

jest.mock('../../database/pool');
jest.mock('../../config/logger');
jest.mock('../capability.service');
jest.mock('../organization-type.service');
jest.mock('../org-payment-method-data.service');
jest.mock('../cache.service');

/**
 * URL codes and the currency rule on organisations.
 *
 * See G2 and G12 in docs/ACCOUNT_USER_APP_WIREFRAMES.md.
 */
describe('OrganizationService — URL codes and currency', () => {
  let service: OrganizationService;
  let mockKcAdmin: jest.Mocked<KeycloakAdminService>;
  let mockClient: any;

  const mockDb = db as jest.Mocked<typeof db>;
  const mockCapabilityService = capabilityService as jest.Mocked<typeof capabilityService>;
  const mockOrgTypeService = organizationTypeService as jest.Mocked<typeof organizationTypeService>;
  const mockPaymentMethods = orgPaymentMethodDataService as jest.Mocked<typeof orgPaymentMethodDataService>;
  const mockCache = cacheService as jest.Mocked<typeof cacheService>;

  const orgType: OrganizationType = {
    id: 'type-1',
    name: 'pony-club',
    displayName: 'Pony Club',
    currency: 'EUR',
    language: 'en',
    defaultCapabilities: ['memberships'],
    defaultLocale: 'en-GB',
    membershipNumbering: 'internal',
    membershipNumberUniqueness: 'organization',
    initialMembershipNumber: 1,
    status: 'active',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  /** Rows already holding a URL code, as returned by the uniqueness lookup. */
  const existingCodes = (...codes: string[]) => ({
    rows: codes.map((url_code) => ({ url_code })),
  });

  const createdRow = {
    id: 'org-1',
    organization_type_id: 'type-1',
    keycloak_group_id: 'org-group-id',
    name: 'kildare-hunt',
    display_name: 'Kildare Hunt Pony Club',
    url_code: 'kildare-hunt-pony-club',
    status: 'active',
    currency: 'EUR',
    language: 'en',
    enabled_capabilities: [],
    settings: {},
    created_at: new Date(),
    updated_at: new Date(),
  };

  /** The insert parameters the service built, for assertions. */
  const insertCall = () =>
    mockDb.query.mock.calls.find(([sql]) =>
      String(sql).includes('INSERT INTO organizations')
    );

  beforeEach(() => {
    jest.clearAllMocks();

    mockClient = {
      groups: {
        find: jest.fn().mockResolvedValue([]),
        findOne: jest
          .fn()
          .mockResolvedValueOnce({ id: 'type-group-id', name: 'pony-club' })
          .mockResolvedValue({ id: 'org-group-id', name: 'kildare-hunt' }),
        create: jest.fn().mockResolvedValue({ id: 'type-group-id' }),
        createChildGroup: jest.fn().mockResolvedValue({ id: 'org-group-id' }),
        del: jest.fn(),
      },
    };

    mockKcAdmin = {
      ensureAuthenticated: jest.fn().mockResolvedValue(undefined),
      getClient: jest.fn().mockReturnValue(mockClient),
    } as any;

    service = new OrganizationService(mockKcAdmin);

    mockOrgTypeService.getOrganizationTypeById.mockResolvedValue(orgType);
    mockCapabilityService.validateCapabilities.mockResolvedValue(true);
    mockPaymentMethods.initializeDefaultPaymentMethods = jest.fn().mockResolvedValue(undefined);
    mockPaymentMethods.syncOrgPaymentMethods = jest.fn().mockResolvedValue(undefined);
    mockPaymentMethods.getOrgPaymentMethods = jest.fn().mockResolvedValue([]);
    mockCache.get = jest.fn().mockReturnValue(null);
    mockCache.set = jest.fn();
    mockCache.delete = jest.fn();
  });

  const newOrg = (over: Record<string, any> = {}) => ({
    organizationTypeId: 'type-1',
    name: 'kildare-hunt',
    displayName: 'Kildare Hunt Pony Club',
    enabledCapabilities: [],
    ...over,
  });

  describe('deriving a code', () => {
    it('derives one from the display name when none is supplied', async () => {
      mockDb.query
        .mockResolvedValueOnce(existingCodes() as any)
        .mockResolvedValue({ rows: [createdRow] } as any);

      await service.createOrganization(newOrg());

      expect(insertCall()![1]).toContain('kildare-hunt-pony-club');
    });

    it('suffixes a derived code that is already taken', async () => {
      mockDb.query
        .mockResolvedValueOnce(existingCodes('kildare-hunt-pony-club') as any)
        .mockResolvedValue({ rows: [createdRow] } as any);

      await service.createOrganization(newOrg());

      expect(insertCall()![1]).toContain('kildare-hunt-pony-club-2');
    });

    it('avoids a reserved word when deriving', async () => {
      mockDb.query
        .mockResolvedValueOnce(existingCodes() as any)
        .mockResolvedValue({ rows: [createdRow] } as any);

      await service.createOrganization(newOrg({ displayName: 'Admin' }));

      expect(insertCall()![1]).toContain('admin-org');
    });
  });

  describe('a code the super admin supplied', () => {
    it('is used as given', async () => {
      mockDb.query
        .mockResolvedValueOnce(existingCodes() as any)
        .mockResolvedValue({ rows: [createdRow] } as any);

      await service.createOrganization(newOrg({ urlCode: 'khpc' }));

      expect(insertCall()![1]).toContain('khpc');
    });

    it('is rejected rather than silently altered when taken', async () => {
      // Quietly suffixing a code the super admin typed would put a different
      // address in front of members than the one they were shown.
      mockDb.query.mockResolvedValueOnce(existingCodes('khpc') as any);

      await expect(
        service.createOrganization(newOrg({ urlCode: 'khpc' }))
      ).rejects.toThrow(/already used/i);
    });

    it('is rejected when malformed', async () => {
      mockDb.query.mockResolvedValueOnce(existingCodes() as any);

      await expect(
        service.createOrganization(newOrg({ urlCode: 'KHPC' }))
      ).rejects.toThrow(/lower-case/i);
    });

    it('is rejected when reserved', async () => {
      mockDb.query.mockResolvedValueOnce(existingCodes() as any);

      await expect(
        service.createOrganization(newOrg({ urlCode: 'admin' }))
      ).rejects.toThrow(/reserved/i);
    });

    it('is settled before any Keycloak group is created', async () => {
      // A rejected code must not leave an orphaned group behind.
      mockDb.query.mockResolvedValueOnce(existingCodes('khpc') as any);

      await expect(
        service.createOrganization(newOrg({ urlCode: 'khpc' }))
      ).rejects.toThrow();

      expect(mockClient.groups.createChildGroup).not.toHaveBeenCalled();
      expect(mockKcAdmin.ensureAuthenticated).not.toHaveBeenCalled();
    });
  });

  describe('currency', () => {
    it('always comes from the organisation type', async () => {
      mockDb.query
        .mockResolvedValueOnce(existingCodes() as any)
        .mockResolvedValue({ rows: [createdRow] } as any);

      await service.createOrganization(newOrg());

      expect(insertCall()![1]).toContain('EUR');
    });

    it('ignores a currency sent by the client rather than honouring it', async () => {
      // The type's fixed handling fee is a cash amount in the type's currency,
      // so the two cannot diverge (G12).
      mockDb.query
        .mockResolvedValueOnce(existingCodes() as any)
        .mockResolvedValue({ rows: [createdRow] } as any);

      await service.createOrganization(newOrg({ currency: 'GBP' }));

      const params = insertCall()![1] as any[];
      expect(params).toContain('EUR');
      expect(params).not.toContain('GBP');
    });

    it('is not updatable', async () => {
      mockDb.query.mockResolvedValue({ rows: [createdRow] } as any);

      await service.updateOrganization('org-1', { currency: 'GBP' } as any);

      const update = mockDb.query.mock.calls.find(([sql]) =>
        String(sql).includes('UPDATE organizations')
      );
      expect(String(update![0])).not.toContain('currency =');
    });
  });

  describe('checkUrlCodeAvailability', () => {
    it('accepts a well-formed code that is free', async () => {
      mockDb.query.mockResolvedValue(existingCodes('other') as any);

      await expect(service.checkUrlCodeAvailability('khpc')).resolves.toEqual({
        available: true,
      });
    });

    it('reports a code that is taken', async () => {
      mockDb.query.mockResolvedValue(existingCodes('khpc') as any);

      const result = await service.checkUrlCodeAvailability('khpc');
      expect(result.available).toBe(false);
      expect(result.reason).toMatch(/already in use/i);
    });

    it('reports why a malformed code cannot be used', async () => {
      const result = await service.checkUrlCodeAvailability('KH PC');
      expect(result.available).toBe(false);
      expect(result.reason).toBeTruthy();
    });

    it('does not count the organisation being edited as a collision', async () => {
      mockDb.query.mockResolvedValue(existingCodes('other') as any);

      await service.checkUrlCodeAvailability('khpc', 'org-1');

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('id <> $1'),
        ['org-1']
      );
    });
  });
});
