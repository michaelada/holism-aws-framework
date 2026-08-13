import { AccountOrganisationService } from '../account-organisation.service';
import { db } from '../../database/pool';

jest.mock('../../database/pool');
jest.mock('../../config/logger');

const mockDb = db as jest.Mocked<typeof db>;

const orgRow = (over: Record<string, any> = {}) => ({
  id: 'org-1',
  url_code: 'khpc',
  display_name: 'Kildare Hunt Pony Club',
  currency: 'EUR',
  language: 'en-GB',
  enabled_capabilities: ['memberships', 'event-management'],
  status: 'active',
  settings: {},
  org_type_display_name: 'Pony Club',
  ...over,
});

describe('AccountOrganisationService', () => {
  let service: AccountOrganisationService;

  beforeEach(() => {
    // mockReset rather than clearAllMocks: several tests queue values with
    // mockResolvedValueOnce and return early without consuming them all.
    // clearAllMocks leaves that queue in place, so the leftovers surface in the
    // next test.
    mockDb.query.mockReset();
    service = new AccountOrganisationService();
  });

  describe('listPublicOrganisations', () => {
    const setup = () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [orgRow()] } as any)
        .mockResolvedValueOnce({ rows: [{ total: 1 }] } as any);
    };

    it('returns only public fields', async () => {
      setup();
      const { organisations } = await service.listPublicOrganisations();

      expect(organisations[0]).toEqual({
        urlCode: 'khpc',
        displayName: 'Kildare Hunt Pony Club',
        organisationType: 'Pony Club',
        city: undefined,
        country: undefined,
        branding: { logoUrl: '', primaryColor: '#1976d2' },
      });
      // The directory is unauthenticated — nothing internal may leak.
      expect(organisations[0]).not.toHaveProperty('id');
      expect(organisations[0]).not.toHaveProperty('contactEmail');
      expect(organisations[0]).not.toHaveProperty('settings');
    });

    it('excludes inactive organisations and those opted out of the directory', async () => {
      setup();
      await service.listPublicOrganisations();

      const [sql] = mockDb.query.mock.calls[0];
      expect(String(sql)).toContain("o.status = 'active'");
      expect(String(sql)).toContain('listedInDirectory');
    });

    it('searches display name and URL code, case-insensitively', async () => {
      setup();
      await service.listPublicOrganisations({ query: '  KHPC ' });

      const [sql, params] = mockDb.query.mock.calls[0];
      expect(String(sql)).toContain('lower(o.display_name) LIKE');
      expect(String(sql)).toContain('lower(o.url_code) LIKE');
      expect(params).toContain('%khpc%');
    });

    it('caps the page size so the directory cannot be scraped in one call', async () => {
      setup();
      await service.listPublicOrganisations({ limit: 5000 });

      const params = mockDb.query.mock.calls[0][1] as any[];
      expect(params).toContain(100);
    });

    it('applies a sane default page size and offset', async () => {
      setup();
      await service.listPublicOrganisations();

      const params = mockDb.query.mock.calls[0][1] as any[];
      expect(params).toEqual([24, 0]);
    });

    it('rejects a negative offset rather than passing it to the query', async () => {
      setup();
      await service.listPublicOrganisations({ offset: -10 });

      const params = mockDb.query.mock.calls[0][1] as any[];
      expect(params).toContain(0);
    });

    it('surfaces branding and address when present', async () => {
      mockDb.query
        .mockResolvedValueOnce({
          rows: [
            orgRow({
              settings: {
                city: 'Naas',
                country: 'Ireland',
                branding: { logoUrl: 'https://x/logo.png', primaryColor: '#123456' },
              },
            }),
          ],
        } as any)
        .mockResolvedValueOnce({ rows: [{ total: 1 }] } as any);

      const { organisations } = await service.listPublicOrganisations();
      expect(organisations[0].city).toBe('Naas');
      expect(organisations[0].branding).toEqual({
        logoUrl: 'https://x/logo.png',
        primaryColor: '#123456',
      });
    });
  });

  describe('getPublicOrganisationByCode', () => {
    it('returns capabilities and locale for the gateway', async () => {
      mockDb.query.mockResolvedValue({ rows: [orgRow()] } as any);

      const org = await service.getPublicOrganisationByCode('khpc');
      expect(org).toMatchObject({
        urlCode: 'khpc',
        capabilities: ['memberships', 'event-management'],
        currency: 'EUR',
      });
    });

    it('does not require the organisation to be listed in the directory', async () => {
      mockDb.query.mockResolvedValue({ rows: [orgRow()] } as any);
      await service.getPublicOrganisationByCode('khpc');

      // Being unlisted affects discoverability, not access.
      const [sql] = mockDb.query.mock.calls[0];
      expect(String(sql)).not.toContain('listedInDirectory');
    });

    it('excludes inactive organisations', async () => {
      mockDb.query.mockResolvedValue({ rows: [] } as any);
      await expect(service.getPublicOrganisationByCode('khpc')).resolves.toBeNull();

      const [sql] = mockDb.query.mock.calls[0];
      expect(String(sql)).toContain("o.status = 'active'");
    });

    it('returns null for an unknown code', async () => {
      mockDb.query.mockResolvedValue({ rows: [] } as any);
      await expect(service.getPublicOrganisationByCode('nope')).resolves.toBeNull();
    });
  });

  describe('getOrganisationsForUser', () => {
    it('returns only account-user memberships', async () => {
      mockDb.query.mockResolvedValue({ rows: [{ ...orgRow(), status: 'active' }] } as any);
      await service.getOrganisationsForUser('kc-1');

      const [sql, params] = mockDb.query.mock.calls[0];
      expect(String(sql)).toContain("ou.user_type = 'account-user'");
      expect(params).toEqual(['kc-1']);
    });

    it('includes pending memberships so the switcher can explain them', async () => {
      mockDb.query.mockResolvedValue({
        rows: [{ ...orgRow(), status: 'pending' }],
      } as any);

      const orgs = await service.getOrganisationsForUser('kc-1');
      expect(orgs[0].status).toBe('pending');

      const [sql] = mockDb.query.mock.calls[0];
      expect(String(sql)).not.toContain("ou.status = 'active'");
    });
  });

  describe('resolveMembership', () => {
    const withOrgAndUser = (userRows: any[], org = orgRow()) => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [org] } as any)
        .mockResolvedValueOnce({ rows: userRows } as any);
    };

    it('admits an active member and reports the organisation context', async () => {
      withOrgAndUser([{ id: 'ou-1', status: 'active' }]);

      const result = await service.resolveMembership('kc-1', 'khpc');
      expect(result).toEqual({
        ok: true,
        membership: {
          organisationId: 'org-1',
          organisationUserId: 'ou-1',
          urlCode: 'khpc',
          displayName: 'Kildare Hunt Pony Club',
          currency: 'EUR',
          language: 'en-GB',
          capabilities: ['memberships', 'event-management'],
          status: 'active',
        },
      });
    });

    it('resolves the organisation id from the code, never from the caller', async () => {
      withOrgAndUser([{ id: 'ou-1', status: 'active' }]);
      await service.resolveMembership('kc-1', 'khpc');

      const [, orgParams] = mockDb.query.mock.calls[0];
      expect(orgParams).toEqual(['khpc']);
      // The membership lookup uses the id the *database* returned.
      const [, userParams] = mockDb.query.mock.calls[1];
      expect(userParams).toEqual(['kc-1', 'org-1']);
    });

    it('refuses a user with no membership of that organisation', async () => {
      withOrgAndUser([]);
      await expect(service.resolveMembership('kc-1', 'khpc')).resolves.toEqual({
        ok: false,
        reason: 'NOT_CONNECTED',
      });
    });

    it('only matches account-user rows, so an org admin is not admitted', async () => {
      withOrgAndUser([]);
      await service.resolveMembership('kc-1', 'khpc');

      const [sql] = mockDb.query.mock.calls[1];
      expect(String(sql)).toContain("user_type = 'account-user'");
    });

    it('distinguishes pending approval from being unknown', async () => {
      withOrgAndUser([{ id: 'ou-1', status: 'pending' }]);
      await expect(service.resolveMembership('kc-1', 'khpc')).resolves.toEqual({
        ok: false,
        reason: 'PENDING_APPROVAL',
      });
    });

    it('distinguishes a rejected registration', async () => {
      withOrgAndUser([{ id: 'ou-1', status: 'rejected' }]);
      await expect(service.resolveMembership('kc-1', 'khpc')).resolves.toEqual({
        ok: false,
        reason: 'REGISTRATION_REJECTED',
      });
    });

    it('treats any unrecognised status as inactive rather than as active', async () => {
      // Failing closed matters here: a status nobody anticipated must not read
      // as permission.
      for (const status of ['inactive', 'suspended', '', 'ACTIVE']) {
        mockDb.query.mockReset();
        withOrgAndUser([{ id: 'ou-1', status }]);
        await expect(service.resolveMembership('kc-1', 'khpc')).resolves.toEqual({
          ok: false,
          reason: 'ACCOUNT_INACTIVE',
        });
      }
    });

    it('refuses an unknown organisation', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [] } as any);
      await expect(service.resolveMembership('kc-1', 'nope')).resolves.toEqual({
        ok: false,
        reason: 'ORGANISATION_UNAVAILABLE',
      });
    });

    it('refuses an inactive organisation even to an active member', async () => {
      withOrgAndUser(
        [{ id: 'ou-1', status: 'active' }],
        orgRow({ status: 'inactive' })
      );
      await expect(service.resolveMembership('kc-1', 'khpc')).resolves.toEqual({
        ok: false,
        reason: 'ORGANISATION_UNAVAILABLE',
      });
    });

    it('does not query membership once the organisation is unavailable', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [] } as any);
      await service.resolveMembership('kc-1', 'nope');
      expect(mockDb.query).toHaveBeenCalledTimes(1);
    });
  });
});
