import crypto from 'crypto';
import { db } from '../database/pool';
import { logger } from '../config/logger';
import { KeycloakAdminService } from './keycloak-admin.service';
import { ValidationError } from '../middleware/errors';
import {
  sendEmailChangeAddressInUse,
  sendEmailChangeRequestedAlert,
  sendEmailChangeVerification,
  sendPasswordChangedAlert,
} from './email.service';

/**
 * A member changing their own password or email address — P4, P5 and P6.
 *
 * Both used to be done by sending the member to Keycloak's account console.
 * This does them in the app, with Keycloak updated underneath, and the whole
 * design follows from two facts about how this platform uses Keycloak.
 *
 * ### An account user's username *is* their email address
 *
 * The seed creates them that way (`username: user.email`), so changing the
 * address changes the credential they sign in with. A mistyped address is not a
 * misdirected newsletter — it is a login the member does not own, and a
 * password reset that can never reach them.
 *
 * So an address is **proved before it is used**: a link goes to the new address
 * and nothing moves until it is followed. Until then the member signs in
 * exactly as before, and a typo costs them an email rather than their account.
 *
 * ### Keycloak can set a password but cannot check one
 *
 * The Admin API has `resetPassword` and no equivalent "is this the current
 * password?". The only way to answer that is to try to log in, which is what
 * `verifyPassword` does against a confidential client reserved for the purpose.
 * The tokens it gets back are discarded — this is an assertion, not a sign-in.
 *
 * ### One identity, many clubs
 *
 * Both changes apply to every club the member belongs to, because they belong
 * to the identity rather than to a membership. The screens say so, and the
 * pending-change row is keyed on the Keycloak user id for the same reason.
 *
 * See docs/ACCOUNT_SELF_SERVICE_CREDENTIALS.md.
 */

/** How long a member has to follow the link. Named once; the mail says the same. */
export const EMAIL_CHANGE_TTL_HOURS = 1;

const ACCOUNT_URL = process.env.ACCOUNT_URL || 'http://localhost:5176/account';

/**
 * Deliberately loose.
 *
 * The authority on whether an address works is whether the link arrives, and
 * that check runs a moment later. A stricter pattern here would only reject
 * valid-but-unusual addresses while proving nothing about the ordinary ones.
 */
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface Identity {
  keycloakUserId: string;
  email: string;
  firstName: string;
}

/** What a credential change needs to know about the member making it. */
interface CredentialsConfig {
  baseUrl: string;
  realm: string;
  /** The confidential client that may use a direct access grant. */
  clientId: string;
  clientSecret: string;
}

const hashToken = (token: string): string =>
  crypto.createHash('sha256').update(token).digest('hex');

export class AccountCredentialsService {
  constructor(
    private kcAdmin: KeycloakAdminService,
    private config: CredentialsConfig
  ) {}

  /**
   * The member behind an `organization_users` row.
   *
   * Read from the database rather than taken from the request, so a caller
   * cannot nominate somebody else's identity by passing an id.
   */
  private async identity(organisationUserId: string): Promise<Identity> {
    const result = await db.query(
      `SELECT keycloak_user_id, email, first_name
         FROM organization_users
        WHERE id = $1 AND user_type = 'account-user'`,
      [organisationUserId]
    );

    const row = result.rows[0];
    if (!row) throw new ValidationError('That account could not be found');
    if (!row.keycloak_user_id) {
      // Nothing to change: the credential lives in Keycloak, and this row has
      // no Keycloak identity behind it.
      throw new ValidationError('This account has no sign-in details to change');
    }

    return {
      keycloakUserId: row.keycloak_user_id,
      email: row.email,
      firstName: row.first_name || 'there',
    };
  }

  /** The username Keycloak knows, which is the authority for a password grant. */
  private async keycloakUsername(keycloakUserId: string): Promise<string> {
    await this.kcAdmin.ensureAuthenticated();
    const user = await this.kcAdmin.getClient().users.findOne({ id: keycloakUserId });

    if (!user?.username) {
      throw new ValidationError('This account has no sign-in details to change');
    }
    return user.username;
  }

  /**
   * Whether this really is the member's current password.
   *
   * A password grant, which succeeds or returns 401. The tokens are thrown
   * away — the answer is the only thing wanted, and keeping a session the
   * member did not ask for would be a second credential to look after.
   *
   * A network or configuration failure is **not** a "wrong password": it throws,
   * so a misconfigured client secret shows up as a 500 rather than as every
   * member being told they mistyped a password they typed correctly.
   */
  async verifyPassword(username: string, password: string): Promise<boolean> {
    /*
     * A missing secret is a configuration fault, and it must not be allowed to
     * look like a wrong password.
     *
     * Keycloak answers a confidential client with no secret with the same 401
     * it uses for bad credentials, so without this check an unset
     * `KEYCLOAK_PASSWORD_CHECK_CLIENT_SECRET` tells **every** member that the
     * password they just typed correctly is wrong — with nothing in the logs
     * pointing at the real cause. Found exactly that way while verifying this
     * against a live realm.
     */
    if (!this.config.clientSecret) {
      logger.error(
        'KEYCLOAK_PASSWORD_CHECK_CLIENT_SECRET is not set; passwords cannot be verified',
        { clientId: this.config.clientId }
      );
      throw new Error('The password-verification client is not configured');
    }

    const response = await fetch(
      `${this.config.baseUrl}/realms/${this.config.realm}/protocol/openid-connect/token`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'password',
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret,
          username,
          password,
          scope: 'openid',
        }),
      }
    );

    if (response.ok) return true;
    if (response.status === 401) return false;

    /*
     * 400 `invalid_grant` is also a refusal — Keycloak uses it for a disabled
     * account and for a temporarily locked one. Anything else is our problem,
     * not the member's.
     */
    const body = (await response.json().catch(() => ({}))) as { error?: string };
    if (response.status === 400 && body.error === 'invalid_grant') return false;

    logger.error('Password verification could not be completed', {
      status: response.status,
      error: body.error,
    });
    throw new Error(`Keycloak refused the password check: ${response.status}`);
  }

  /**
   * Change the member's password.
   *
   * The policy is Keycloak's, and so is the complaint. A realm can require
   * length, digits, mixed case or no reuse of the last N, and those rules can
   * change without this code being touched — reimplementing them here would
   * produce a second opinion that eventually disagrees with the one that
   * actually decides.
   */
  async changePassword(
    organisationUserId: string,
    currentPassword: string,
    newPassword: string
  ): Promise<void> {
    if (!currentPassword || !newPassword) {
      throw new ValidationError('Both your current and your new password are required');
    }
    if (currentPassword === newPassword) {
      throw new ValidationError('Your new password must be different from your current one');
    }

    const identity = await this.identity(organisationUserId);
    const username = await this.keycloakUsername(identity.keycloakUserId);

    if (!(await this.verifyPassword(username, currentPassword))) {
      throw new ValidationError('That is not your current password');
    }

    try {
      await this.kcAdmin.ensureAuthenticated();
      await this.kcAdmin.getClient().users.resetPassword({
        id: identity.keycloakUserId,
        credential: { type: 'password', value: newPassword, temporary: false },
      });
    } catch (error) {
      /*
       * Keycloak's own words. `invalidPasswordMinLengthMessage` and friends
       * arrive as a readable sentence, and passing it through means a form that
       * satisfies our checks and then fails on theirs cannot happen.
       */
      const message = keycloakMessage(error);
      logger.warn('Keycloak refused a new password', { message });
      throw new ValidationError(message ?? 'That password was not accepted');
    }

    logger.info('Account password changed', { organisationUserId });

    // After the change, not before: an alarm about something that did not
    // happen is worse than none.
    await sendPasswordChangedAlert({ toEmail: identity.email, firstName: identity.firstName });
  }

  /**
   * Ask to change the email address. Nothing moves yet.
   *
   * The answer is the same whether or not the address is already somebody
   * else's, because a different answer would turn this into a way of testing
   * which addresses are registered with the platform using nothing but one's
   * own password. The clash is real and it is reported — by mail, to the
   * address in question, which is the one place the answer is safe to send.
   */
  async requestEmailChange(
    organisationUserId: string,
    currentPassword: string,
    newEmailInput: string
  ): Promise<{ sentTo: string }> {
    const newEmail = String(newEmailInput ?? '').trim().toLowerCase();

    if (!EMAIL_SHAPE.test(newEmail)) {
      throw new ValidationError('That does not look like an email address');
    }

    const identity = await this.identity(organisationUserId);
    const username = await this.keycloakUsername(identity.keycloakUserId);

    if (newEmail === identity.email?.toLowerCase() || newEmail === username.toLowerCase()) {
      throw new ValidationError('That is already your email address');
    }

    if (!(await this.verifyPassword(username, currentPassword))) {
      throw new ValidationError('That is not your current password');
    }

    await this.kcAdmin.ensureAuthenticated();
    const client = this.kcAdmin.getClient();

    const taken = await client.users.find({ username: newEmail, exact: true });
    if (taken.length > 0) {
      logger.info('Email change requested for an address already in use', { organisationUserId });
      await sendEmailChangeAddressInUse({ toEmail: newEmail, firstName: identity.firstName });
      return { sentTo: newEmail };
    }

    const token = crypto.randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + EMAIL_CHANGE_TTL_HOURS * 3_600_000);

    /*
     * Supersedes any earlier request. Two live tokens for two different
     * addresses is a question with no good answer, and the partial unique index
     * would refuse the insert anyway.
     */
    await db.query(
      `DELETE FROM pending_email_changes
        WHERE keycloak_user_id = $1::text AND consumed_at IS NULL`,
      [identity.keycloakUserId]
    );

    await db.query(
      `INSERT INTO pending_email_changes (keycloak_user_id, new_email, token_hash, expires_at)
       VALUES ($1::text, $2, $3, $4)`,
      [identity.keycloakUserId, newEmail, hashToken(token), expiresAt]
    );

    /*
     * The link first, and strictly. If it cannot be sent there is no change to
     * make, and a member told to check their inbox would wait for something
     * that will never arrive — so the row goes back and the request fails.
     */
    try {
      await sendEmailChangeVerification({
        toEmail: newEmail,
        firstName: identity.firstName,
        confirmUrl: `${ACCOUNT_URL}/confirm-email?token=${encodeURIComponent(token)}`,
        expiresInHours: EMAIL_CHANGE_TTL_HOURS,
      });
    } catch (error) {
      await db.query(
        `DELETE FROM pending_email_changes
          WHERE keycloak_user_id = $1::text AND consumed_at IS NULL`,
        [identity.keycloakUserId]
      );
      logger.error('Could not send an email-change link; the request was dropped', {
        organisationUserId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw new ValidationError('We could not send a link to that address. Please try again.');
    }

    // The alarm, to the address that stands to lose control, while it still
    // works. Swallowed on failure: the change itself is already safely pending.
    await sendEmailChangeRequestedAlert({
      toEmail: identity.email,
      firstName: identity.firstName,
      newEmail,
    });

    logger.info('Email change requested', { organisationUserId });
    return { sentTo: newEmail };
  }

  /**
   * Follow the link: apply the change.
   *
   * Anonymous, because the link is opened from a mail client that may carry no
   * session — often in another browser entirely. The token is the authority,
   * which is safe because obtaining one needed the current password *and*
   * control of the new address.
   */
  async confirmEmailChange(token: string): Promise<{ email: string }> {
    if (!token) throw new ValidationError('That link is not valid');

    const found = await db.query(
      `SELECT id, keycloak_user_id, new_email
         FROM pending_email_changes
        WHERE token_hash = $1
          AND consumed_at IS NULL
          AND expires_at > NOW()`,
      [hashToken(token)]
    );

    const pending = found.rows[0];
    /*
     * Expired, already used, and never valid are one answer. Telling them apart
     * would say which tokens exist to somebody guessing at them.
     */
    if (!pending) throw new ValidationError('That link is not valid');

    const newEmail: string = pending.new_email;

    /*
     * Re-checked here, not only at request time. An hour is long enough for
     * somebody else to have registered the address, and the alternative is two
     * accounts sharing a username.
     */
    await this.kcAdmin.ensureAuthenticated();
    const client = this.kcAdmin.getClient();

    const taken = await client.users.find({ username: newEmail, exact: true });
    if (taken.some((user) => user.id !== pending.keycloak_user_id)) {
      await db.query(`DELETE FROM pending_email_changes WHERE id = $1::uuid`, [pending.id]);
      throw new ValidationError('That address now belongs to another account');
    }

    /*
     * **Username as well as email.** They are the same thing for an account
     * user, and updating only the address would leave the member signing in
     * with an address that is no longer theirs — and `users.find({ username })`,
     * which the seed and the invitation flow both use, looking for the wrong
     * one.
     */
    await client.users.update(
      { id: pending.keycloak_user_id },
      { email: newEmail, username: newEmail, emailVerified: true }
    );

    /*
     * Every row for this identity. The address belongs to the person, not to
     * one club, and a copy left behind is a club emailing an address the member
     * has abandoned. `$1::text` because `keycloak_user_id` is a varchar and
     * Postgres infers one type per parameter for the whole statement — the
     * fault that broke profile saves.
     */
    const updated = await db.query(
      `UPDATE organization_users
          SET email = $2, updated_at = NOW()
        WHERE keycloak_user_id = $1::text AND user_type = 'account-user'
        RETURNING id`,
      [pending.keycloak_user_id, newEmail]
    );

    await db.query(`UPDATE pending_email_changes SET consumed_at = NOW() WHERE id = $1::uuid`, [
      pending.id,
    ]);

    logger.info('Email address changed', {
      keycloakUserId: pending.keycloak_user_id,
      rowsUpdated: updated.rows.length,
    });

    return { email: newEmail };
  }
}

/** Keycloak's own complaint, wherever the admin client happened to put it. */
function keycloakMessage(error: unknown): string | null {
  const response = (error as { response?: { data?: Record<string, string> } })?.response?.data;
  return (
    response?.errorMessage ||
    response?.error_description ||
    response?.error ||
    (error instanceof Error ? error.message : null)
  );
}

const kcAdminConfig = {
  baseUrl: process.env.KEYCLOAK_URL || 'http://localhost:8080',
  realmName: process.env.KEYCLOAK_REALM || 'master',
  clientId: process.env.KEYCLOAK_CLIENT_ID || 'admin-cli',
  clientSecret: process.env.KEYCLOAK_CLIENT_SECRET || '',
};

export const accountCredentialsService = new AccountCredentialsService(
  KeycloakAdminService.getInstance(kcAdminConfig),
  {
    baseUrl: kcAdminConfig.baseUrl,
    realm: kcAdminConfig.realmName,
    /*
     * A client of its own, confidential, existing only to answer "is this the
     * member's password?". Enabling direct access grants on the public
     * `account-app` client instead would have been less work and a much wider
     * door: a public client needs no secret, so anyone could post
     * username-and-password pairs at the token endpoint.
     */
    clientId: process.env.KEYCLOAK_PASSWORD_CHECK_CLIENT_ID || 'account-password-check',
    clientSecret: process.env.KEYCLOAK_PASSWORD_CHECK_CLIENT_SECRET || '',
  }
);
