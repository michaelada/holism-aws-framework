import { AccountProfileService } from '../account-profile.service';
import { db } from '../../database/pool';
import { ValidationError } from '../../middleware/errors';

jest.mock('../../database/pool');
jest.mock('../../config/logger');

/**
 * The property that matters most here is that one identity stays one identity.
 *
 * A member has one Keycloak account and an `organization_users` row per club.
 * Updating only the club whose URL the request arrived on is the obvious
 * implementation and it is wrong — the copies drift, and a member who corrects
 * their name at one club stays misspelled at the others.
 */
describe('AccountProfileService', () => {
  const mockDb = db as jest.Mocked<typeof db>;
  const OU = 'ou-1';
  const KC = 'kc-1';

  const usersUpdate = jest.fn();
  const kcAdmin = {
    ensureAuthenticated: jest.fn(),
    getClient: () => ({ users: { update: usersUpdate } }),
  } as any;

  let service: AccountProfileService;

  const row = (over: Record<string, unknown> = {}) => ({
    id: OU,
    email: 'ada@example.com',
    first_name: 'Ada',
    last_name: 'Adams',
    phone: '0871234567',
    status: 'active',
    keycloak_user_id: KC,
    preferred_language: null,
    last_login: '2026-08-01T10:00:00.000Z',
    created_at: '2025-01-04T09:00:00.000Z',
    ...over,
  });

  /** SELECT profile row, then COUNT organisations, then (on update) the UPDATE. */
  const respond = (profileRow = row(), count = 2) => {
    mockDb.query = jest.fn().mockImplementation((sql: string) => {
      const text = String(sql);
      if (text.includes('COUNT(DISTINCT organization_id)')) {
        return Promise.resolve({ rows: [{ count }], rowCount: 1 });
      }
      if (text.includes('UPDATE organization_users')) {
        return Promise.resolve({ rows: [{ id: OU }, { id: 'ou-2' }], rowCount: 2 });
      }
      return Promise.resolve({ rows: [profileRow], rowCount: 1 });
    });
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AccountProfileService(kcAdmin);
    respond();
  });

  describe('getProfile', () => {
    it('returns the member’s details', async () => {
      const profile = await service.getProfile(OU);

      expect(profile).toMatchObject({
        id: OU,
        email: 'ada@example.com',
        firstName: 'Ada',
        lastName: 'Adams',
        phone: '0871234567',
        preferredLanguage: null,
      });
    });

    /** Drives the "these details are shared" warning; below two there is nothing to warn about. */
    it('reports how many organisations the identity belongs to', async () => {
      const profile = await service.getProfile(OU);

      expect(profile.organisationCount).toBe(2);
    });

    /**
     * Counted by Keycloak id, not by email: the identity is what is shared, and
     * an email is only its current label.
     */
    it('counts organisations by the identity, not by email', async () => {
      await service.getProfile(OU);

      const count = (mockDb.query as jest.Mock).mock.calls.find((call) =>
        String(call[0]).includes('COUNT(DISTINCT organization_id)')
      );
      expect(String(count?.[0])).toContain('keycloak_user_id = $1');
      expect(count?.[1]).toEqual([KC]);
    });

    it('ignores a stored language the app cannot render', async () => {
      respond(row({ preferred_language: 'xx-XX' }));

      const profile = await service.getProfile(OU);

      expect(profile.preferredLanguage).toBeNull();
    });

    it('throws when there is no such profile', async () => {
      mockDb.query = jest.fn().mockResolvedValue({ rows: [], rowCount: 0 });

      await expect(service.getProfile(OU)).rejects.toThrow(ValidationError);
    });
  });

  describe('updateProfile', () => {
    it('updates every row belonging to the identity, not just this club’s', async () => {
      await service.updateProfile(OU, { firstName: 'Adaline' });

      const update = (mockDb.query as jest.Mock).mock.calls.find((call) =>
        String(call[0]).includes('UPDATE organization_users')
      );
      expect(String(update?.[0])).toContain('keycloak_user_id = $5');
      expect(update?.[1]).toEqual(expect.arrayContaining(['Adaline', KC]));
    });

    /**
     * An account user editing their own details must never reach an org-admin
     * record that happens to share the Keycloak id.
     */
    it('never touches org-admin records', async () => {
      await service.updateProfile(OU, { firstName: 'Adaline' });

      const update = (mockDb.query as jest.Mock).mock.calls.find((call) =>
        String(call[0]).includes('UPDATE organization_users')
      );
      expect(String(update?.[0])).toContain("user_type = 'account-user'");
    });

    it('writes the identity to Keycloak as well as the database', async () => {
      await service.updateProfile(OU, { firstName: 'Adaline', phone: '0899999999' });

      expect(usersUpdate).toHaveBeenCalledWith(
        { id: KC },
        expect.objectContaining({
          firstName: 'Adaline',
          lastName: 'Adams',
          attributes: expect.objectContaining({ phone: ['0899999999'] }),
        })
      );
    });

    /**
     * Keycloak's own login page honours `locale`, so the member's chosen
     * language reaches the sign-in screen — which no column of ours could do.
     */
    it('writes the language to Keycloak’s locale attribute too', async () => {
      await service.updateProfile(OU, { preferredLanguage: 'fr-FR' });

      expect(usersUpdate).toHaveBeenCalledWith(
        { id: KC },
        expect.objectContaining({ attributes: expect.objectContaining({ locale: ['fr-FR'] }) })
      );
    });

    /**
     * Keycloak is the identity. If it refuses, writing the database anyway
     * produces exactly the drift this service exists to prevent — and a profile
     * showing a name the login does not know about.
     */
    it('does not write the database when Keycloak refuses', async () => {
      usersUpdate.mockRejectedValueOnce(new Error('keycloak is down'));

      await expect(service.updateProfile(OU, { firstName: 'Adaline' })).rejects.toThrow();

      const update = (mockDb.query as jest.Mock).mock.calls.find((call) =>
        String(call[0]).includes('UPDATE organization_users')
      );
      expect(update).toBeUndefined();
    });

    it('rejects a language the app cannot render', async () => {
      await expect(
        service.updateProfile(OU, { preferredLanguage: 'xx-XX' })
      ).rejects.toThrow(ValidationError);
      expect(usersUpdate).not.toHaveBeenCalled();
    });

    it('accepts null to fall back to the organisation’s language', async () => {
      await service.updateProfile(OU, { preferredLanguage: null });

      const update = (mockDb.query as jest.Mock).mock.calls.find((call) =>
        String(call[0]).includes('UPDATE organization_users')
      );
      expect(update?.[1]?.[3]).toBeNull();
    });

    it('requires a first and last name', async () => {
      await expect(service.updateProfile(OU, { firstName: '   ' })).rejects.toThrow(
        ValidationError
      );
    });

    it('leaves unmentioned fields alone', async () => {
      await service.updateProfile(OU, { firstName: 'Adaline' });

      const update = (mockDb.query as jest.Mock).mock.calls.find((call) =>
        String(call[0]).includes('UPDATE organization_users')
      );
      // Last name and phone keep their stored values.
      expect(update?.[1]?.[1]).toBe('Adams');
      expect(update?.[1]?.[2]).toBe('0871234567');
    });

    it('clears the phone when given an empty string', async () => {
      await service.updateProfile(OU, { phone: '' });

      const update = (mockDb.query as jest.Mock).mock.calls.find((call) =>
        String(call[0]).includes('UPDATE organization_users')
      );
      expect(update?.[1]?.[2]).toBeNull();
    });
  });
});
