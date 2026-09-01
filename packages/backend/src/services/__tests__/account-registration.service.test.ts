import {
  AccountRegistrationService,
  DEFAULT_REGISTRATION_SETTINGS,
} from '../account-registration.service';
import { db } from '../../database/pool';
import { ValidationError, NotFoundError } from '../../middleware/errors';
import * as email from '../email.service';

jest.mock('../../database/pool');
jest.mock('../../config/logger');
jest.mock('../email.service', () => ({
  sendRegistrationWelcomeEmail: jest.fn().mockResolvedValue(undefined),
  sendRegistrationPendingEmail: jest.fn().mockResolvedValue(undefined),
  sendRegistrationApprovedEmail: jest.fn().mockResolvedValue(undefined),
  sendRegistrationRejectedEmail: jest.fn().mockResolvedValue(undefined),
  sendNewRegistrationNotification: jest.fn().mockResolvedValue(undefined),
}));

const mockDb = db as jest.Mocked<typeof db>;
const ORG = 'org-1';

const identity = {
  keycloakUserId: 'kc-1',
  email: 'michael.adams@example.com',
  firstName: 'Michael',
  lastName: 'Adams',
};

describe('AccountRegistrationService', () => {
  let service: AccountRegistrationService;

  beforeEach(() => {
    mockDb.query.mockReset();
    jest.clearAllMocks();
    service = new AccountRegistrationService();
  });

  describe('settings', () => {
    it('defaults to auto-registration on', async () => {
      mockDb.query.mockResolvedValue({ rows: [{ settings: {} }] } as any);
      await expect(service.getSettings(ORG)).resolves.toEqual(
        DEFAULT_REGISTRATION_SETTINGS
      );
      expect(DEFAULT_REGISTRATION_SETTINGS.autoRegistration).toBe(true);
    });

    it('merges stored settings onto the defaults', async () => {
      mockDb.query.mockResolvedValue({
        rows: [{ settings: { registration: { autoRegistration: false } } }],
      } as any);

      const settings = await service.getSettings(ORG);
      expect(settings.autoRegistration).toBe(false);
      expect(settings.notificationEmails).toEqual([]);
    });

    it('writes only the registration key, leaving other settings alone', async () => {
      // organizations.settings is shared with branding, payment settings and
      // email templates — replacing it wholesale destroys them.
      mockDb.query
        .mockResolvedValueOnce({ rows: [{ settings: {} }] } as any)
        .mockResolvedValueOnce({ rows: [] } as any);

      await service.updateSettings(ORG, { autoRegistration: false });

      const [sql] = mockDb.query.mock.calls[1];
      expect(String(sql)).toContain("jsonb_set(COALESCE(settings, '{}'::jsonb), '{registration}'");
      expect(String(sql)).not.toMatch(/SET settings = \$1/);
    });

    it('rejects a malformed notification address', async () => {
      mockDb.query.mockResolvedValue({ rows: [{ settings: {} }] } as any);

      await expect(
        service.updateSettings(ORG, { notificationEmails: ['secretary@khpc.ie', 'nope'] })
      ).rejects.toThrow(ValidationError);
    });

    it('trims notification addresses', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [{ settings: {} }] } as any)
        .mockResolvedValueOnce({ rows: [] } as any);

      await service.updateSettings(ORG, { notificationEmails: ['  a@b.ie  '] });

      const stored = JSON.parse(mockDb.query.mock.calls[1][1]![0] as string);
      expect(stored.notificationEmails).toEqual(['a@b.ie']);
    });

    it('reports a missing organisation', async () => {
      mockDb.query.mockResolvedValue({ rows: [] } as any);
      await expect(service.getSettings('nope')).rejects.toThrow(NotFoundError);
    });
  });

  describe('register', () => {
    const withSettings = (autoRegistration: boolean) =>
      mockDb.query
        .mockResolvedValueOnce({ rows: [] } as any) // no existing membership
        .mockResolvedValueOnce({ rows: [{ settings: { registration: { autoRegistration } } }] } as any)
        .mockResolvedValueOnce({ rows: [{ id: 'ou-new' }] } as any) // insert
        .mockResolvedValueOnce({ rows: [] } as any); // audit

    it('activates immediately when auto-registration is on', async () => {
      withSettings(true);

      const result = await service.register(ORG, identity);

      expect(result.outcome).toBe('active');
      const params = mockDb.query.mock.calls[2][1] as any[];
      expect(params).toContain('active');
    });

    it('holds for approval when auto-registration is off', async () => {
      withSettings(false);

      const result = await service.register(ORG, identity);

      expect(result.outcome).toBe('pending');
      const params = mockDb.query.mock.calls[2][1] as any[];
      expect(params).toContain('pending');
    });

    it('creates an account-user, never an org-admin', async () => {
      withSettings(true);
      await service.register(ORG, identity);

      const [sql] = mockDb.query.mock.calls[2];
      expect(String(sql)).toContain("'account-user'");
    });

    it('is idempotent — registering twice returns the existing membership', async () => {
      // A member who taps a link twice should not see a failure.
      mockDb.query.mockResolvedValueOnce({
        rows: [{ id: 'ou-existing', status: 'active' }],
      } as any);

      const result = await service.register(ORG, identity);

      expect(result).toEqual({ outcome: 'active', organisationUserId: 'ou-existing' });
      expect(mockDb.query).toHaveBeenCalledTimes(1);
    });

    it('reports a still-pending membership as pending, not active', async () => {
      mockDb.query.mockResolvedValueOnce({
        rows: [{ id: 'ou-existing', status: 'pending' }],
      } as any);

      await expect(service.register(ORG, identity)).resolves.toEqual({
        outcome: 'pending',
        organisationUserId: 'ou-existing',
      });
    });

    /*
     * One email address, both applications.
     *
     * The unique constraint used to be `(organization_id, keycloak_user_id)`,
     * so an administrator of this club could not also hold a member account
     * here: this insert collided and the member was told their account could
     * not be created. Migration `1709000000038` put `user_type` in the key.
     * Running a club and taking part in it are ordinary things for one person
     * to do. See docs/ONE_EMAIL_BOTH_APPS.md.
     */
    it('registers an identity that already administers the club', async () => {
      withSettings(true);

      const result = await service.register(ORG, identity);

      expect(result.outcome).toBe('active');
      const [sql] = mockDb.query.mock.calls[2];
      expect(String(sql)).toContain("'account-user'");
    });

    it('looks only for a member row, which is what the constraint keys on', async () => {
      // Guard and constraint have to agree. Narrower than the constraint is how
      // the old 500 happened; wider would refuse a registration that is allowed.
      withSettings(true);
      await service.register(ORG, identity);

      const [sql] = mockDb.query.mock.calls[0];
      expect(String(sql)).toContain("user_type = 'account-user'");
    });

    /*
     * A double-tapped button. The check above settles the sequential case; two
     * requests in flight together need the insert itself to be forgiving, or
     * the loser reports a failure at the moment it succeeded.
     */
    it('treats a racing duplicate as the repeat registration it is', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [] } as any) // no membership yet
        .mockResolvedValueOnce({ rows: [{ settings: {} }] } as any)
        .mockResolvedValueOnce({ rows: [] } as any) // insert lost the race
        .mockResolvedValueOnce({
          rows: [{ id: 'ou-winner', status: 'active' }],
        } as any);

      await expect(service.register(ORG, identity)).resolves.toEqual({
        outcome: 'active',
        organisationUserId: 'ou-winner',
      });
    });

    it('does not let the insert fail on a duplicate', async () => {
      withSettings(true);
      await service.register(ORG, identity);

      const [sql] = mockDb.query.mock.calls[2];
      expect(String(sql)).toContain('ON CONFLICT');
      expect(String(sql)).toContain('DO NOTHING');
    });

    it('records the registration in the audit log', async () => {
      withSettings(true);
      await service.register(ORG, identity);

      const [sql, params] = mockDb.query.mock.calls[3];
      expect(String(sql)).toContain('organization_audit_log');
      expect(params).toContain('account_user.registered');
    });

    it('rejects a malformed email', async () => {
      await expect(
        service.register(ORG, { ...identity, email: 'not-an-email' })
      ).rejects.toThrow(ValidationError);
      expect(mockDb.query).not.toHaveBeenCalled();
    });

    it('rejects a missing name', async () => {
      await expect(
        service.register(ORG, { ...identity, firstName: '   ' })
      ).rejects.toThrow(/name/i);
    });
  });

  describe('decide', () => {
    it('approves by setting the membership active', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [{ id: 'ou-1', status: 'active' }] } as any)
        .mockResolvedValueOnce({ rows: [] } as any);

      await expect(service.decide(ORG, 'ou-1', 'approve', 'admin-1')).resolves.toEqual({
        status: 'active',
      });
    });

    it('rejects by setting the membership rejected', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [{ id: 'ou-1', status: 'rejected' }] } as any)
        .mockResolvedValueOnce({ rows: [] } as any);

      await expect(service.decide(ORG, 'ou-1', 'reject', 'admin-1')).resolves.toEqual({
        status: 'rejected',
      });
    });

    it('scopes the update to the acting organisation', async () => {
      // A valid id from another organisation must not be actionable.
      mockDb.query.mockResolvedValueOnce({ rows: [] } as any);

      await expect(
        service.decide(ORG, 'someone-elses', 'approve')
      ).rejects.toThrow(NotFoundError);

      const [sql, params] = mockDb.query.mock.calls[0];
      expect(String(sql)).toContain('organization_id = $3');
      expect(params).toEqual(['active', 'someone-elses', ORG]);
    });

    it('only ever touches account-user rows', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [] } as any);
      await service.decide(ORG, 'ou-1', 'approve').catch(() => undefined);

      const [sql] = mockDb.query.mock.calls[0];
      expect(String(sql)).toContain("user_type = 'account-user'");
    });

    it('records who decided, and keeps the note internal', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [{ id: 'ou-1', status: 'rejected' }] } as any)
        .mockResolvedValueOnce({ rows: [] } as any);

      const result = await service.decide(ORG, 'ou-1', 'reject', 'admin-1', 'Not a member');

      const [sql, params] = mockDb.query.mock.calls[1];
      expect(String(sql)).toContain('organization_audit_log');
      expect(params).toContain('admin-1');
      expect(JSON.stringify(params)).toContain('Not a member');
      // The applicant is told the outcome only.
      expect(result).toEqual({ status: 'rejected' });
    });

    it('does not fail the decision when the audit write fails', async () => {
      // A member must not be left un-approved because the audit table was busy.
      mockDb.query
        .mockResolvedValueOnce({ rows: [{ id: 'ou-1', status: 'active' }] } as any)
        .mockRejectedValueOnce(new Error('audit table unavailable'));

      await expect(service.decide(ORG, 'ou-1', 'approve')).resolves.toEqual({
        status: 'active',
      });
    });
  });

  describe('approveAllPending', () => {
    it('activates everyone waiting and reports the count', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [{ id: 'a' }, { id: 'b' }] } as any)
        .mockResolvedValue({ rows: [] } as any);

      await expect(service.approveAllPending(ORG, 'admin-1')).resolves.toBe(2);

      const [sql] = mockDb.query.mock.calls[0];
      expect(String(sql)).toContain("status = 'pending'");
      expect(String(sql)).toContain("SET status = 'active'");
    });

    it('is a no-op when nobody is waiting', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [] } as any);
      await expect(service.approveAllPending(ORG)).resolves.toBe(0);
    });
  });

  describe('listByStatus and countPending', () => {
    it('lists only account users of the given status', async () => {
      mockDb.query.mockResolvedValue({
        rows: [
          {
            id: 'ou-1',
            email: 'a@b.ie',
            first_name: 'A',
            last_name: 'B',
            phone: null,
            status: 'pending',
            created_at: new Date('2026-02-13'),
          },
        ],
      } as any);

      const rows = await service.listByStatus(ORG, 'pending');

      expect(rows[0]).toMatchObject({ id: 'ou-1', firstName: 'A', status: 'pending' });
      const [sql, params] = mockDb.query.mock.calls[0];
      expect(String(sql)).toContain("user_type = 'account-user'");
      expect(params).toEqual([ORG, 'pending']);
    });

    it('counts those waiting', async () => {
      mockDb.query.mockResolvedValue({ rows: [{ count: 4 }] } as any);
      await expect(service.countPending(ORG)).resolves.toBe(4);
    });

    it('reports zero rather than undefined when nothing is waiting', async () => {
      mockDb.query.mockResolvedValue({ rows: [] } as any);
      await expect(service.countPending(ORG)).resolves.toBe(0);
    });
  });

  describe('emails', () => {
    const orgRow = {
      display_name: 'Kildare Hunt Pony Club',
      url_code: 'khpc',
      contact_email: 'secretary@khpc.ie',
    };

    it('welcomes a member who is active immediately', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [] } as any)                                   // no existing
        .mockResolvedValueOnce({ rows: [{ settings: { registration: { autoRegistration: true } } }] } as any)
        .mockResolvedValueOnce({ rows: [{ id: 'ou-new' }] } as any)                   // insert
        .mockResolvedValueOnce({ rows: [] } as any)                                   // audit
        .mockResolvedValueOnce({ rows: [orgRow] } as any);                            // org context

      await service.register(ORG, identity);

      expect(email.sendRegistrationWelcomeEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          toEmail: identity.email,
          organizationName: 'Kildare Hunt Pony Club',
          urlCode: 'khpc',
        })
      );
      expect(email.sendRegistrationPendingEmail).not.toHaveBeenCalled();
    });

    it('tells a member who needs approval that they are waiting', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [] } as any)
        .mockResolvedValueOnce({ rows: [{ settings: { registration: { autoRegistration: false } } }] } as any)
        .mockResolvedValueOnce({ rows: [{ id: 'ou-new' }] } as any)
        .mockResolvedValueOnce({ rows: [] } as any)
        .mockResolvedValueOnce({ rows: [orgRow] } as any)                             // org context
        .mockResolvedValueOnce({ rows: [{ settings: { registration: { notificationEmails: [] } } }] } as any)
        .mockResolvedValueOnce({ rows: [{ count: 1 }] } as any);

      await service.register(ORG, identity);

      expect(email.sendRegistrationPendingEmail).toHaveBeenCalled();
      expect(email.sendRegistrationWelcomeEmail).not.toHaveBeenCalled();
    });

    it('notifies the organisation only when someone has to act', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [] } as any)
        .mockResolvedValueOnce({ rows: [{ settings: { registration: { autoRegistration: false } } }] } as any)
        .mockResolvedValueOnce({ rows: [{ id: 'ou-new' }] } as any)
        .mockResolvedValueOnce({ rows: [] } as any)
        .mockResolvedValueOnce({ rows: [orgRow] } as any)
        .mockResolvedValueOnce({
          rows: [{ settings: { registration: { notificationEmails: ['secretary@khpc.ie'] } } }],
        } as any)
        .mockResolvedValueOnce({ rows: [{ count: 3 }] } as any);

      await service.register(ORG, identity);

      expect(email.sendNewRegistrationNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          toEmails: ['secretary@khpc.ie'],
          applicantName: 'Michael Adams',
          pendingCount: 3,
        })
      );
    });

    it('does not notify the organisation about an auto-approved member', async () => {
      // Nobody has a decision to make, so there is nothing to tell them.
      mockDb.query
        .mockResolvedValueOnce({ rows: [] } as any)
        .mockResolvedValueOnce({ rows: [{ settings: { registration: { autoRegistration: true } } }] } as any)
        .mockResolvedValueOnce({ rows: [{ id: 'ou-new' }] } as any)
        .mockResolvedValueOnce({ rows: [] } as any)
        .mockResolvedValueOnce({ rows: [orgRow] } as any);

      await service.register(ORG, identity);

      expect(email.sendNewRegistrationNotification).not.toHaveBeenCalled();
    });

    it('emails the member on approval', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [{ id: 'ou-1', status: 'active' }] } as any)
        .mockResolvedValueOnce({ rows: [] } as any)                                    // audit
        .mockResolvedValueOnce({ rows: [orgRow] } as any)                              // org context
        .mockResolvedValueOnce({ rows: [{ email: 'm@x.ie', first_name: 'Michael' }] } as any);

      await service.decide(ORG, 'ou-1', 'approve', 'admin-1');

      expect(email.sendRegistrationApprovedEmail).toHaveBeenCalledWith(
        expect.objectContaining({ toEmail: 'm@x.ie', firstName: 'Michael' })
      );
    });

    it('emails a rejection with the club\'s contact address and no reason', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [{ id: 'ou-1', status: 'rejected' }] } as any)
        .mockResolvedValueOnce({ rows: [] } as any)
        .mockResolvedValueOnce({ rows: [orgRow] } as any)
        .mockResolvedValueOnce({ rows: [{ email: 'm@x.ie', first_name: 'Michael' }] } as any);

      await service.decide(ORG, 'ou-1', 'reject', 'admin-1', 'Internal note');

      const sent = (email.sendRegistrationRejectedEmail as jest.Mock).mock.calls[0][0];
      expect(sent.contactEmail).toBe('secretary@khpc.ie');
      // The administrator's note must never reach the applicant.
      expect(JSON.stringify(sent)).not.toContain('Internal note');
    });

    it('still registers the member when the emails fail', async () => {
      // The membership row is already committed; a mail failure must not undo it.
      (email.sendRegistrationWelcomeEmail as jest.Mock).mockRejectedValueOnce(
        new Error('SES unavailable')
      );
      mockDb.query
        .mockResolvedValueOnce({ rows: [] } as any)
        .mockResolvedValueOnce({ rows: [{ settings: { registration: { autoRegistration: true } } }] } as any)
        .mockResolvedValueOnce({ rows: [{ id: 'ou-new' }] } as any)
        .mockResolvedValueOnce({ rows: [] } as any)
        .mockResolvedValueOnce({ rows: [orgRow] } as any);

      await expect(service.register(ORG, identity)).resolves.toEqual({
        outcome: 'active',
        organisationUserId: 'ou-new',
      });
    });

    it('sends nothing for a repeat registration', async () => {
      mockDb.query.mockResolvedValueOnce({
        rows: [{ id: 'ou-existing', status: 'active' }],
      } as any);

      await service.register(ORG, identity);

      expect(email.sendRegistrationWelcomeEmail).not.toHaveBeenCalled();
      expect(email.sendRegistrationPendingEmail).not.toHaveBeenCalled();
    });
  });
});