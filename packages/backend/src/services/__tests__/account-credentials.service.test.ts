import { AccountCredentialsService } from '../account-credentials.service';
import { db } from '../../database/pool';
import { ValidationError } from '../../middleware/errors';
import * as emailService from '../email.service';

jest.mock('../../database/pool');
jest.mock('../../config/logger');
jest.mock('../email.service');

/**
 * Changing a password or an email address from inside the app.
 *
 * Two properties carry the whole design, and both are easy to lose in a
 * refactor that looks harmless:
 *
 * **An address is proved before it is used.** A member's Keycloak username *is*
 * their email, so an address that turned out to be mistyped would be a login
 * they do not own. Nothing may move until the link is followed.
 *
 * **The email endpoint answers the same way whether or not an address is
 * taken.** Otherwise a member can test which addresses are registered with the
 * platform using nothing but their own password.
 */
describe('AccountCredentialsService', () => {
  const mockDb = db as jest.Mocked<typeof db>;
  const mail = emailService as jest.Mocked<typeof emailService>;

  const OU = 'ou-1';
  const KC = 'kc-1';
  const CONFIG = {
    baseUrl: 'http://keycloak:8080',
    realm: 'aws-framework',
    clientId: 'account-password-check',
    clientSecret: 'shhh',
  };

  const usersFindOne = jest.fn();
  const usersFind = jest.fn();
  const usersUpdate = jest.fn();
  const usersResetPassword = jest.fn();

  const kcAdmin = {
    ensureAuthenticated: jest.fn(),
    getClient: () => ({
      users: {
        findOne: usersFindOne,
        find: usersFind,
        update: usersUpdate,
        resetPassword: usersResetPassword,
      },
    }),
  } as any;

  let service: AccountCredentialsService;
  let fetchMock: jest.Mock;

  /** A token response, or a refusal, from the direct-grant check. */
  const passwordIs = (correct: boolean) =>
    fetchMock.mockResolvedValue(
      correct
        ? { ok: true, status: 200, json: async () => ({ access_token: 'x' }) }
        : { ok: false, status: 401, json: async () => ({ error: 'invalid_grant' }) }
    );

  const identityRow = (over: Record<string, unknown> = {}) => ({
    keycloak_user_id: KC,
    email: 'ada@example.com',
    first_name: 'Ada',
    ...over,
  });

  beforeEach(() => {
    /*
     * `reset`, not `clear`. Several cases here install a rejection — a refused
     * password policy, an unsendable link — and `clearAllMocks` forgets the
     * calls while keeping the implementation, so the next test inherits the
     * failure and reports it as its own.
     */
    jest.resetAllMocks();

    service = new AccountCredentialsService(kcAdmin, CONFIG);
    usersFindOne.mockResolvedValue({ id: KC, username: 'ada@example.com' });
    usersFind.mockResolvedValue([]);

    fetchMock = jest.fn();
    (global as any).fetch = fetchMock;
    passwordIs(true);

    mockDb.query = jest.fn().mockImplementation((sql: string) => {
      if (sql.includes('FROM organization_users')) return { rows: [identityRow()] };
      return { rows: [] };
    }) as any;
  });

  describe('verifyPassword', () => {
    it('asks Keycloak with the confidential client and its secret', async () => {
      await service.verifyPassword('ada@example.com', 'hunter2');

      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe(
        'http://keycloak:8080/realms/aws-framework/protocol/openid-connect/token'
      );

      const body = new URLSearchParams(init.body as string);
      expect(body.get('grant_type')).toBe('password');
      expect(body.get('client_id')).toBe('account-password-check');
      // Without the secret the grant is refused, and every member would be
      // told they mistyped a password they typed correctly.
      expect(body.get('client_secret')).toBe('shhh');
      expect(body.get('username')).toBe('ada@example.com');
    });

    it('reads a 401 as the wrong password', async () => {
      passwordIs(false);
      await expect(service.verifyPassword('ada@example.com', 'nope')).resolves.toBe(false);
    });

    it('reads a 400 invalid_grant as a refusal too', async () => {
      // Keycloak uses it for a disabled or temporarily locked account.
      fetchMock.mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({ error: 'invalid_grant' }),
      });
      await expect(service.verifyPassword('ada@example.com', 'nope')).resolves.toBe(false);
    });

    it('refuses to run at all without a client secret', async () => {
      /*
       * Found while verifying this against a live realm, and the reason it is
       * pinned: Keycloak answers a confidential client with no secret with the
       * same 401 it uses for bad credentials. Left to fall through, an unset
       * `KEYCLOAK_PASSWORD_CHECK_CLIENT_SECRET` tells *every* member that the
       * password they just typed correctly is wrong — and nothing in the logs
       * says why.
       */
      const misconfigured = new AccountCredentialsService(kcAdmin, { ...CONFIG, clientSecret: '' });

      await expect(misconfigured.verifyPassword('ada@example.com', 'hunter2')).rejects.toThrow(
        /not configured/
      );
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('throws rather than reporting a wrong password when the check itself fails', async () => {
      /*
       * The distinction that matters. A misconfigured client secret answers 401
       * at the *client* level, and treating every failure as "wrong password"
       * would tell every member their correct password was wrong — with nothing
       * in the logs pointing at the real cause.
       */
      fetchMock.mockResolvedValue({
        ok: false,
        status: 503,
        json: async () => ({ error: 'unavailable' }),
      });

      await expect(service.verifyPassword('ada@example.com', 'hunter2')).rejects.toThrow(/503/);
    });
  });

  describe('changePassword', () => {
    it('sets the new password once the current one checks out', async () => {
      await service.changePassword(OU, 'hunter2', 'a-longer-one');

      expect(usersResetPassword).toHaveBeenCalledWith({
        id: KC,
        credential: { type: 'password', value: 'a-longer-one', temporary: false },
      });
    });

    it('refuses a wrong current password, and writes nothing', async () => {
      passwordIs(false);

      await expect(service.changePassword(OU, 'wrong', 'a-longer-one')).rejects.toThrow(
        ValidationError
      );
      expect(usersResetPassword).not.toHaveBeenCalled();
    });

    it('passes Keycloak’s own policy complaint back to the member', async () => {
      /*
       * The realm decides the policy and can tighten it without this code being
       * touched. Substituting our own wording would eventually describe rules
       * that no longer apply.
       */
      usersResetPassword.mockRejectedValue({
        response: { data: { errorMessage: 'Invalid password: must contain at least one number' } },
      });

      await expect(service.changePassword(OU, 'hunter2', 'nodigits')).rejects.toThrow(
        'Invalid password: must contain at least one number'
      );
    });

    it('will not accept the current password as the new one', async () => {
      await expect(service.changePassword(OU, 'same', 'same')).rejects.toThrow(ValidationError);
      expect(usersResetPassword).not.toHaveBeenCalled();
    });

    it('tells the member afterwards, at the address on file', async () => {
      // The alarm for somebody else changing it. Sent after the change, since a
      // warning about something that did not happen is worse than none.
      await service.changePassword(OU, 'hunter2', 'a-longer-one');

      expect(mail.sendPasswordChangedAlert).toHaveBeenCalledWith(
        expect.objectContaining({ toEmail: 'ada@example.com' })
      );
    });
  });

  describe('requestEmailChange', () => {
    it('changes nothing in Keycloak, and records a pending change', async () => {
      await service.requestEmailChange(OU, 'hunter2', 'new@example.com');

      expect(usersUpdate).not.toHaveBeenCalled();

      const insert = (mockDb.query as jest.Mock).mock.calls.find(([sql]) =>
        sql.includes('INSERT INTO pending_email_changes')
      );
      expect(insert).toBeDefined();
      expect(insert[1][1]).toBe('new@example.com');
    });

    it('stores a hash of the token, never the token', async () => {
      await service.requestEmailChange(OU, 'hunter2', 'new@example.com');

      const [, params] = (mockDb.query as jest.Mock).mock.calls.find(([sql]) =>
        sql.includes('INSERT INTO pending_email_changes')
      );
      const stored = params[2];
      const [{ confirmUrl }] = mail.sendEmailChangeVerification.mock.calls[0] as any[];
      const token = new URL(confirmUrl).searchParams.get('token')!;

      expect(stored).toHaveLength(64); // sha256, hex
      expect(stored).not.toContain(token);
    });

    it('answers identically for an address that is already taken', async () => {
      /*
       * The disclosure guard. A different answer here — an error, a different
       * status, a different shape — turns this endpoint into a way of testing
       * which addresses are registered with the platform.
       */
      usersFind.mockResolvedValue([{ id: 'someone-else' }]);

      const taken = await service.requestEmailChange(OU, 'hunter2', 'taken@example.com');
      expect(taken).toEqual({ sentTo: 'taken@example.com' });

      expect(mail.sendEmailChangeVerification).not.toHaveBeenCalled();
      expect(mail.sendEmailChangeAddressInUse).toHaveBeenCalledWith(
        expect.objectContaining({ toEmail: 'taken@example.com' })
      );
    });

    it('warns the address that stands to lose the account', async () => {
      await service.requestEmailChange(OU, 'hunter2', 'new@example.com');

      expect(mail.sendEmailChangeRequestedAlert).toHaveBeenCalledWith(
        expect.objectContaining({ toEmail: 'ada@example.com', newEmail: 'new@example.com' })
      );
    });

    it('drops the pending change when the link cannot be sent', async () => {
      // Otherwise the member is told to check an inbox nothing was sent to, and
      // a row sits there claiming a change is under way.
      mail.sendEmailChangeVerification.mockRejectedValue(new Error('SES is unhappy'));

      await expect(
        service.requestEmailChange(OU, 'hunter2', 'new@example.com')
      ).rejects.toThrow(ValidationError);

      const deletes = (mockDb.query as jest.Mock).mock.calls.filter(([sql]) =>
        sql.includes('DELETE FROM pending_email_changes')
      );
      expect(deletes.length).toBe(2); // the supersede, then the rollback
    });

    it('refuses a wrong current password', async () => {
      passwordIs(false);
      await expect(
        service.requestEmailChange(OU, 'wrong', 'new@example.com')
      ).rejects.toThrow(ValidationError);
    });

    it('refuses an address that is not one', async () => {
      await expect(service.requestEmailChange(OU, 'hunter2', 'not-an-address')).rejects.toThrow(
        ValidationError
      );
    });

    it('refuses the address the member already has', async () => {
      await expect(
        service.requestEmailChange(OU, 'hunter2', 'ADA@example.com')
      ).rejects.toThrow(ValidationError);
    });

    it('normalises the address before storing it', async () => {
      // Keycloak usernames are matched lowercase; storing "New@Example.com"
      // would create a login the member cannot type consistently.
      await service.requestEmailChange(OU, 'hunter2', '  New@Example.COM ');

      const [, params] = (mockDb.query as jest.Mock).mock.calls.find(([sql]) =>
        sql.includes('INSERT INTO pending_email_changes')
      );
      expect(params[1]).toBe('new@example.com');
    });
  });

  describe('confirmEmailChange', () => {
    const pending = { id: 'p-1', keycloak_user_id: KC, new_email: 'new@example.com' };

    const withPending = () => {
      mockDb.query = jest.fn().mockImplementation((sql: string) => {
        if (sql.includes('FROM pending_email_changes')) return { rows: [pending] };
        if (sql.includes('UPDATE organization_users')) return { rows: [{ id: 'a' }, { id: 'b' }] };
        return { rows: [] };
      }) as any;
    };

    it('moves the username as well as the email', async () => {
      /*
       * They are the same thing for an account user. Updating only the address
       * would leave the member signing in with one that is no longer theirs,
       * and `users.find({ username })` — used by the seed and the invitation
       * flow — looking for the wrong one.
       */
      withPending();

      await expect(service.confirmEmailChange('a-token')).resolves.toEqual({
        email: 'new@example.com',
      });

      expect(usersUpdate).toHaveBeenCalledWith(
        { id: KC },
        { email: 'new@example.com', username: 'new@example.com', emailVerified: true }
      );
    });

    it('updates every organisation row for that identity', async () => {
      withPending();
      await service.confirmEmailChange('a-token');

      const [sql, params] = (mockDb.query as jest.Mock).mock.calls.find(([text]) =>
        text.includes('UPDATE organization_users')
      );
      expect(sql).toContain('keycloak_user_id = $1::text');
      expect(sql).toContain("user_type = 'account-user'");
      expect(params[0]).toBe(KC);
    });

    it('consumes the token so the link works once', async () => {
      withPending();
      await service.confirmEmailChange('a-token');

      expect(
        (mockDb.query as jest.Mock).mock.calls.some(([sql]) =>
          sql.includes('SET consumed_at = NOW()')
        )
      ).toBe(true);
    });

    it('only looks at tokens that are unused and still live', async () => {
      withPending();
      await service.confirmEmailChange('a-token');

      const [sql] = (mockDb.query as jest.Mock).mock.calls.find(([text]) =>
        text.includes('FROM pending_email_changes')
      );
      expect(sql).toContain('consumed_at IS NULL');
      expect(sql).toContain('expires_at > NOW()');
    });

    it('gives one answer for expired, used and never valid', async () => {
      // Telling them apart would say which tokens exist to somebody guessing.
      mockDb.query = jest.fn().mockResolvedValue({ rows: [] }) as any;

      await expect(service.confirmEmailChange('anything')).rejects.toThrow('That link is not valid');
      await expect(service.confirmEmailChange('')).rejects.toThrow('That link is not valid');
    });

    it('refuses if the address was claimed while the link sat in an inbox', async () => {
      // An hour is long enough, and the alternative is two accounts sharing a
      // username — which is the credential itself.
      withPending();
      usersFind.mockResolvedValue([{ id: 'somebody-else' }]);

      await expect(service.confirmEmailChange('a-token')).rejects.toThrow(ValidationError);
      expect(usersUpdate).not.toHaveBeenCalled();
    });

    it('is not confused by finding the member’s own Keycloak record', async () => {
      withPending();
      usersFind.mockResolvedValue([{ id: KC }]);

      await expect(service.confirmEmailChange('a-token')).resolves.toEqual({
        email: 'new@example.com',
      });
    });
  });
});
