import { db } from '../database/pool';
import { logger } from '../config/logger';
import { KeycloakAdminService } from './keycloak-admin.service';
import { ValidationError } from '../middleware/errors';

/**
 * The account user's own profile — screen P1.
 *
 * ### One identity, many organisations
 *
 * A member has **one** Keycloak account and one `organization_users` row per
 * club they belong to. Their name, phone and language belong to the identity,
 * not to any one club, so an edit here is written to Keycloak **and to every
 * one of that identity's `organization_users` rows** — not just the club whose
 * URL the request came in on.
 *
 * Updating only the current club's row is the obvious implementation and it is
 * wrong: the copies drift, and a member who corrects the spelling of their name
 * at the tennis club still appears misspelled on the pony club's start list.
 * The screen says this out loud, because a member changing their mobile needs
 * to know it changes everywhere.
 *
 * ### What is deliberately not editable here
 *
 * **Email and password.** Both are identity credentials whose change flows need
 * verification to be safe — an unverified email change locks the user out of
 * the address they sign in with, and a typo is unrecoverable. Keycloak's own
 * account console already implements both flows correctly, including the
 * verification mail. This service exposes the email read-only and the front end
 * sends the member there (P2) rather than reimplementing verification against
 * the admin API. See docs/ACCOUNT_USER_APP_PHASE10_PROFILE.md.
 */

/** The six the account app ships; anything else is not a locale we can render. */
const SUPPORTED_LANGUAGES = ['en-GB', 'de-DE', 'es-ES', 'fr-FR', 'it-IT', 'pt-PT'];

export interface AccountProfile {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  status: string;
  memberSince: string;
  lastLogin: string | null;
  /**
   * The member's own language, overriding the organisation's default. Null
   * means "follow the organisation", which is the default rather than a gap.
   */
  preferredLanguage: string | null;
  /**
   * How many organisations this identity belongs to. Drives the "these details
   * are shared" note — with only one club there is nothing to warn about.
   */
  organisationCount: number;
}

export interface UpdateAccountProfile {
  firstName?: string;
  lastName?: string;
  phone?: string | null;
  preferredLanguage?: string | null;
}

export class AccountProfileService {
  constructor(private kcAdmin: KeycloakAdminService) {}

  private async row(organisationUserId: string) {
    const result = await db.query(
      `SELECT id, email, first_name, last_name, phone, status, keycloak_user_id,
              preferred_language, last_login, created_at
       FROM organization_users
       WHERE id = $1`,
      [organisationUserId]
    );

    if (result.rows.length === 0) {
      throw new ValidationError('Profile not found');
    }

    return result.rows[0];
  }

  /**
   * How many clubs this identity belongs to.
   *
   * Counted by `keycloak_user_id` rather than by email, because the identity is
   * what is actually shared — an email is only its current label, and matching
   * on it would silently regroup people if one were ever reused.
   */
  private async organisationCount(keycloakUserId: string | null): Promise<number> {
    if (!keycloakUserId) return 1;

    const result = await db.query(
      `SELECT COUNT(DISTINCT organization_id)::int AS count
       FROM organization_users
       WHERE keycloak_user_id = $1 AND user_type = 'account-user'`,
      [keycloakUserId]
    );

    return result.rows[0]?.count ?? 1;
  }

  async getProfile(organisationUserId: string): Promise<AccountProfile> {
    const row = await this.row(organisationUserId);
    const organisationCount = await this.organisationCount(row.keycloak_user_id);
    const preferredLanguage = SUPPORTED_LANGUAGES.includes(row.preferred_language)
      ? row.preferred_language
      : null;

    return {
      id: row.id,
      email: row.email,
      firstName: row.first_name,
      lastName: row.last_name,
      phone: row.phone ?? null,
      status: row.status,
      memberSince: row.created_at,
      lastLogin: row.last_login ?? null,
      preferredLanguage,
      organisationCount,
    };
  }

  /**
   * Update the identity, then every copy of it.
   *
   * Keycloak is written **first and fatally**: it is the identity, and a
   * database row that disagrees with it is the drift this whole service exists
   * to prevent. If Keycloak refuses, nothing is written locally and the member
   * is told the change did not happen — far better than a profile screen that
   * shows a new name the login does not know about.
   *
   * (This is the opposite call from `account-user.service.ts`, where an
   * administrator editing someone else logs a Keycloak failure and continues.
   * There, the administrator's local edit is still worth keeping; here, the
   * member is editing their own identity and a half-applied change is the
   * failure mode to avoid.)
   */
  async updateProfile(
    organisationUserId: string,
    updates: UpdateAccountProfile
  ): Promise<AccountProfile> {
    const row = await this.row(organisationUserId);

    const firstName = updates.firstName?.trim() ?? row.first_name;
    const lastName = updates.lastName?.trim() ?? row.last_name;
    const phone =
      updates.phone === undefined ? row.phone : updates.phone?.trim() || null;

    if (!firstName || !lastName) {
      throw new ValidationError('A first name and a last name are required');
    }

    if (
      updates.preferredLanguage !== undefined &&
      updates.preferredLanguage !== null &&
      !SUPPORTED_LANGUAGES.includes(updates.preferredLanguage)
    ) {
      throw new ValidationError('That language is not supported');
    }

    const language =
      updates.preferredLanguage === undefined
        ? row.preferred_language ?? null
        : updates.preferredLanguage;

    if (row.keycloak_user_id) {
      await this.kcAdmin.ensureAuthenticated();
      const client = this.kcAdmin.getClient();

      /*
       * `locale` is written here as well as to the column, for a reader the
       * column cannot serve: Keycloak's own login page honours it, so the
       * member's chosen language applies to the sign-in screen too.
       *
       * Attributes are replaced wholesale by this API, so both are always sent;
       * updating one alone would silently erase the other.
       */
      await client.users.update(
        { id: row.keycloak_user_id },
        {
          firstName,
          lastName,
          attributes: {
            phone: phone ? [phone] : [],
            locale: language ? [language] : [],
          },
        }
      );
    }

    /*
     * Every row for this identity, not just the one being viewed. Scoped by
     * `user_type` so an account user editing their own details can never touch
     * an org-admin record that happens to share the Keycloak id.
     */
    const updated = await db.query(
      /*
       * `$5` is a **Keycloak subject, not a uuid column**, and the cast has to
       * say so.
       *
       * It was written `$5::uuid`, which is not a local coercion: Postgres
       * infers one type per parameter for the whole statement, so casting it
       * once made `$5` a `uuid` everywhere — including `keycloak_user_id = $5`,
       * where the column is `character varying`. Every save then failed with
       * "operator does not exist: character varying = uuid" and a 500, for any
       * member who has a Keycloak identity, which is all of them.
       *
       * `id = $6::uuid` is cast explicitly for the same reason, so neither
       * parameter's type depends on where it happens to appear first.
       */
      `UPDATE organization_users
       SET first_name = $1, last_name = $2, phone = $3, preferred_language = $4,
           updated_at = NOW()
       WHERE user_type = 'account-user'
         AND (
           ($5::text IS NOT NULL AND keycloak_user_id = $5::text)
           OR ($5::text IS NULL AND id = $6::uuid)
         )
       RETURNING id`,
      [firstName, lastName, phone, language, row.keycloak_user_id, organisationUserId]
    );

    logger.info('Account profile updated', {
      organisationUserId,
      rowsUpdated: updated.rows.length,
    });

    return this.getProfile(organisationUserId);
  }
}

const kcAdminConfig = {
  baseUrl: process.env.KEYCLOAK_URL || 'http://localhost:8080',
  realmName: process.env.KEYCLOAK_REALM || 'master',
  clientId: process.env.KEYCLOAK_CLIENT_ID || 'admin-cli',
  clientSecret: process.env.KEYCLOAK_CLIENT_SECRET || '',
};

export const accountProfileService = new AccountProfileService(
  KeycloakAdminService.getInstance(kcAdminConfig)
);
