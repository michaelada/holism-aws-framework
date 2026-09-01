import { db } from '../database/pool';
import { logger } from '../config/logger';
import { ValidationError, NotFoundError } from '../middleware/errors';
import {
  sendRegistrationWelcomeEmail,
  sendRegistrationPendingEmail,
  sendRegistrationApprovedEmail,
  sendRegistrationRejectedEmail,
  sendNewRegistrationNotification,
} from './email.service';

/**
 * Self-registration for the account-user application, and the approval queue
 * behind it.
 *
 * Two independent gates, and keeping them separate is the whole design:
 *
 *   1. **Account activation** — Keycloak owns this (email verification). A
 *      person who has not verified cannot sign in at all.
 *   2. **Organisation approval** — `organization_users.status` owns this. A
 *      verified person can sign in and still be told they are waiting.
 *
 * Collapsing the two is the obvious mistake: a member who has verified their
 * email and is still locked out has no way to understand why. See G6 in
 * docs/ACCOUNT_USER_APP_WIREFRAMES.md, and screens A8 / I3 / I4.
 */

export interface RegistrationSettings {
  /**
   * ON  — a registered member is active once their email is verified.
   * OFF — an administrator must approve them first.
   */
  autoRegistration: boolean;
  /** Addresses told about a new registration. */
  notificationEmails: string[];
}

export const DEFAULT_REGISTRATION_SETTINGS: RegistrationSettings = {
  autoRegistration: true,
  notificationEmails: [],
};

export type RegistrationOutcome = 'active' | 'pending';

export interface RegistrationResult {
  outcome: RegistrationOutcome;
  organisationUserId: string;
}

export interface PendingRegistration {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  status: string;
  registeredAt: Date;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function sanitiseSettings(data: Partial<RegistrationSettings>): RegistrationSettings {
  const out = { ...DEFAULT_REGISTRATION_SETTINGS };

  if (typeof data.autoRegistration === 'boolean') {
    out.autoRegistration = data.autoRegistration;
  }

  if (Array.isArray(data.notificationEmails)) {
    const invalid = data.notificationEmails.filter(
      (address) => typeof address !== 'string' || !EMAIL_PATTERN.test(address.trim())
    );
    if (invalid.length > 0) {
      throw new ValidationError(`Not a valid email address: ${invalid.join(', ')}`);
    }
    out.notificationEmails = data.notificationEmails.map((a) => a.trim());
  }

  return out;
}

interface OrganisationContext {
  displayName: string;
  urlCode: string;
  contactEmail: string | null;
}

export class AccountRegistrationService {
  /**
   * Details the emails need: who the organisation is and where its portal is.
   *
   * Returns null rather than throwing — an email is a notification about a
   * state change that has already been committed, so failing to describe the
   * organisation must not undo it.
   */
  private async organisationContext(
    organisationId: string
  ): Promise<OrganisationContext | null> {
    try {
      const result = await db.query(
        'SELECT display_name, url_code, contact_email FROM organizations WHERE id = $1',
        [organisationId]
      );
      if (result.rows.length === 0) return null;
      return {
        displayName: result.rows[0].display_name,
        urlCode: result.rows[0].url_code,
        contactEmail: result.rows[0].contact_email,
      };
    } catch (error) {
      logger.error('Failed to load organisation context for a registration email:', error);
      return null;
    }
  }

  /** Look up one member, for addressing an approval or rejection email. */
  private async memberContact(
    organisationUserId: string
  ): Promise<{ email: string; firstName: string } | null> {
    try {
      const result = await db.query(
        'SELECT email, first_name FROM organization_users WHERE id = $1',
        [organisationUserId]
      );
      if (result.rows.length === 0) return null;
      return { email: result.rows[0].email, firstName: result.rows[0].first_name };
    } catch (error) {
      logger.error('Failed to load member contact for a registration email:', error);
      return null;
    }
  }
  /** Registration settings for an organisation, merged onto the defaults. */
  async getSettings(organisationId: string): Promise<RegistrationSettings> {
    const result = await db.query(
      'SELECT settings FROM organizations WHERE id = $1',
      [organisationId]
    );

    if (result.rows.length === 0) {
      throw new NotFoundError('Organisation not found');
    }

    const settings = result.rows[0].settings || {};
    return { ...DEFAULT_REGISTRATION_SETTINGS, ...(settings.registration || {}) };
  }

  /**
   * Update the registration settings.
   *
   * `jsonb_set` on the `registration` key only — `organizations.settings` is
   * shared with branding, payment settings and email templates, and replacing
   * it wholesale destroys those.
   */
  async updateSettings(
    organisationId: string,
    data: Partial<RegistrationSettings>
  ): Promise<RegistrationSettings> {
    const merged = sanitiseSettings({
      ...(await this.getSettings(organisationId)),
      ...data,
    });

    await db.query(
      `UPDATE organizations
       SET settings = jsonb_set(COALESCE(settings, '{}'::jsonb), '{registration}', $1::jsonb, true),
           updated_at = NOW()
       WHERE id = $2`,
      [JSON.stringify(merged), organisationId]
    );

    logger.info(
      `Registration settings updated for ${organisationId}: ` +
        `autoRegistration=${merged.autoRegistration}`
    );
    return merged;
  }

  /**
   * Connect an existing identity to an organisation.
   *
   * The Keycloak account is assumed to exist already — either the person
   * registered through Keycloak, or they are an existing member of another
   * organisation joining this one. This owns only the `organization_users` row
   * and the status it starts in.
   *
   * Idempotent by design: registering twice returns the existing membership
   * rather than creating a second one or erroring, because a member who taps a
   * link twice should not see a failure.
   */
  async register(
    organisationId: string,
    identity: {
      keycloakUserId: string;
      email: string;
      firstName: string;
      lastName: string;
      phone?: string;
    }
  ): Promise<RegistrationResult> {
    if (!EMAIL_PATTERN.test(identity.email || '')) {
      throw new ValidationError('A valid email address is required');
    }
    if (!identity.firstName?.trim() || !identity.lastName?.trim()) {
      throw new ValidationError('First and last name are required');
    }

    /*
     * The member row for this identity at this club, if there is one.
     *
     * Scoped to `account-user`, which is exactly as wide as
     * `organization_users_org_kc_user_type_unique` — the guard and the
     * constraint agree, which is the property that matters. They did not
     * always: while the constraint was `(organization_id, keycloak_user_id)`
     * this same query hit it whenever the identity already administered the
     * club, and the insert below failed with a 500. Migration
     * `1709000000038` put `user_type` in the key, so an administrator of this
     * club may hold a member account here too — see docs/ONE_EMAIL_BOTH_APPS.md.
     */
    const existing = await db.query(
      `SELECT id, status FROM organization_users
       WHERE organization_id = $1 AND keycloak_user_id = $2 AND user_type = 'account-user'
       LIMIT 1`,
      [organisationId, identity.keycloakUserId]
    );

    if (existing.rows.length > 0) {
      const row = existing.rows[0];
      return {
        outcome: row.status === 'active' ? 'active' : 'pending',
        organisationUserId: row.id,
      };
    }

    const { autoRegistration } = await this.getSettings(organisationId);
    const status: RegistrationOutcome = autoRegistration ? 'active' : 'pending';

    /*
     * `ON CONFLICT DO NOTHING`, then read back what is there.
     *
     * The check above settles all but one case: two requests racing, which a
     * double-tapped button produces easily enough. Without this the loser hits
     * the unique constraint and the member is told their account could not be
     * created, at the moment it was. Registering twice is not an error and has
     * never been treated as one — the early return above says the same thing
     * for the sequential case.
     */
    const created = await db.query(
      `INSERT INTO organization_users
        (organization_id, keycloak_user_id, user_type, email, first_name, last_name, phone, status)
       VALUES ($1, $2, 'account-user', $3, $4, $5, $6, $7)
       ON CONFLICT (organization_id, keycloak_user_id, user_type) DO NOTHING
       RETURNING id`,
      [
        organisationId,
        identity.keycloakUserId,
        identity.email,
        identity.firstName.trim(),
        identity.lastName.trim(),
        identity.phone ?? null,
        status,
      ]
    );

    if (created.rows.length === 0) {
      const winner = await db.query(
        `SELECT id, status FROM organization_users
         WHERE organization_id = $1 AND keycloak_user_id = $2 AND user_type = 'account-user'
         LIMIT 1`,
        [organisationId, identity.keycloakUserId]
      );
      const row = winner.rows[0];
      return {
        outcome: row.status === 'active' ? 'active' : 'pending',
        organisationUserId: row.id,
      };
    }

    await this.audit(organisationId, created.rows[0].id, 'account_user.registered', {
      status,
      email: identity.email,
    });

    await this.notifyRegistered(organisationId, identity, status);

    logger.info(
      `Account user registered with ${organisationId} as ${status}: ${identity.email}`
    );
    return { outcome: status, organisationUserId: created.rows[0].id };
  }

  /** Registrations waiting for a decision. */
  async listByStatus(
    organisationId: string,
    status: 'pending' | 'rejected' | 'active'
  ): Promise<PendingRegistration[]> {
    const result = await db.query(
      `SELECT id, email, first_name, last_name, phone, status, created_at
       FROM organization_users
       WHERE organization_id = $1 AND user_type = 'account-user' AND status = $2
       ORDER BY created_at`,
      [organisationId, status]
    );

    return result.rows.map((row: any) => ({
      id: row.id,
      email: row.email,
      firstName: row.first_name,
      lastName: row.last_name,
      phone: row.phone,
      status: row.status,
      registeredAt: row.created_at,
    }));
  }

  async countPending(organisationId: string): Promise<number> {
    const result = await db.query(
      `SELECT COUNT(*)::int AS count FROM organization_users
       WHERE organization_id = $1 AND user_type = 'account-user' AND status = 'pending'`,
      [organisationId]
    );
    return result.rows[0]?.count ?? 0;
  }

  /**
   * Approve or reject a registration.
   *
   * Scoped to the organisation so one organisation's admin cannot act on
   * another's member, even given a valid id.
   *
   * A rejection note is recorded in the audit log and is **not** returned to
   * the applicant — whatever an administrator wrote is internal, and surfacing
   * it invites arguments the platform cannot adjudicate.
   */
  async decide(
    organisationId: string,
    organisationUserId: string,
    decision: 'approve' | 'reject',
    actingAdminId?: string,
    note?: string
  ): Promise<{ status: string }> {
    const status = decision === 'approve' ? 'active' : 'rejected';

    const result = await db.query(
      `UPDATE organization_users
       SET status = $1, updated_at = NOW()
       WHERE id = $2 AND organization_id = $3 AND user_type = 'account-user'
       RETURNING id, status`,
      [status, organisationUserId, organisationId]
    );

    if (result.rows.length === 0) {
      throw new NotFoundError('Registration not found');
    }

    await this.audit(
      organisationId,
      organisationUserId,
      `account_user.${decision === 'approve' ? 'approved' : 'rejected'}`,
      { note: note ?? null },
      actingAdminId
    );

    await this.notifyDecision(organisationId, organisationUserId, decision);

    logger.info(
      `Registration ${organisationUserId} ${decision}d for organisation ${organisationId}`
    );
    return { status };
  }

  /**
   * Approve everyone currently waiting.
   *
   * Used when an administrator turns auto-registration on and chooses to clear
   * the queue. Deliberately a separate, explicit act — flipping the setting
   * does not retroactively approve anybody.
   */
  async approveAllPending(
    organisationId: string,
    actingAdminId?: string
  ): Promise<number> {
    const result = await db.query(
      `UPDATE organization_users
       SET status = 'active', updated_at = NOW()
       WHERE organization_id = $1 AND user_type = 'account-user' AND status = 'pending'
       RETURNING id`,
      [organisationId]
    );

    for (const row of result.rows) {
      await this.audit(
        organisationId,
        row.id,
        'account_user.approved',
        { bulk: true },
        actingAdminId
      );
    }

    return result.rows.length;
  }

  /**
   * Tell the member where they stand, and the organisation that someone is
   * waiting.
   *
   * Never throws: the membership row is already committed, and a member who is
   * registered should stay registered even if no email goes out.
   */
  private async notifyRegistered(
    organisationId: string,
    identity: { email: string; firstName: string; lastName: string },
    status: RegistrationOutcome
  ): Promise<void> {
    try {
      const org = await this.organisationContext(organisationId);
      if (!org) return;

      const common = {
        toEmail: identity.email,
        firstName: identity.firstName,
        organizationName: org.displayName,
        urlCode: org.urlCode,
      };

      if (status === 'active') {
        await sendRegistrationWelcomeEmail(common);
        return;
      }

      await sendRegistrationPendingEmail(common);

      // Only worth telling the organisation about registrations they have to
      // act on — an auto-approved member needs no decision from anyone.
      const settings = await this.getSettings(organisationId);
      if (settings.notificationEmails.length > 0) {
        await sendNewRegistrationNotification({
          toEmails: settings.notificationEmails,
          organizationName: org.displayName,
          applicantName: `${identity.firstName} ${identity.lastName}`.trim(),
          applicantEmail: identity.email,
          pendingCount: await this.countPending(organisationId),
        });
      }
    } catch (error) {
      logger.error('Failed to send registration emails:', error);
    }
  }

  private async notifyDecision(
    organisationId: string,
    organisationUserId: string,
    decision: 'approve' | 'reject'
  ): Promise<void> {
    try {
      const [org, member] = await Promise.all([
        this.organisationContext(organisationId),
        this.memberContact(organisationUserId),
      ]);
      if (!org || !member) return;

      const common = {
        toEmail: member.email,
        firstName: member.firstName,
        organizationName: org.displayName,
        urlCode: org.urlCode,
      };

      if (decision === 'approve') {
        await sendRegistrationApprovedEmail(common);
      } else {
        await sendRegistrationRejectedEmail({
          ...common,
          contactEmail: org.contactEmail ?? undefined,
        });
      }
    } catch (error) {
      logger.error('Failed to send a registration decision email:', error);
    }
  }

  /**
   * Record the decision.
   *
   * Audit failures are logged but never fail the operation they describe: a
   * member should not be left un-approved because the audit table was busy.
   */
  private async audit(
    organisationId: string,
    entityId: string,
    action: string,
    changes: Record<string, any>,
    userId?: string
  ): Promise<void> {
    try {
      await db.query(
        `INSERT INTO organization_audit_log
          (organization_id, user_id, action, entity_type, entity_id, changes)
         VALUES ($1, $2, $3, 'organization_user', $4, $5)`,
        [organisationId, userId ?? null, action, entityId, JSON.stringify(changes)]
      );
    } catch (error) {
      logger.error(`Failed to write audit entry for ${action}:`, error);
    }
  }
}

export const accountRegistrationService = new AccountRegistrationService();
