import { db } from '../database/pool';
import { resolveLogoUrl } from './organization-branding.service';

/**
 * Organisation lookup for the account-user application.
 *
 * Two audiences:
 *
 *   - the public directory and organisation gateway, which must work with no
 *     session at all (screens A1 and A2);
 *   - an authenticated account user, resolving which organisations they belong
 *     to and whether they may enter a given one (screens A6, A7, A8).
 *
 * The org-admin equivalent of the second is `loadOrganisationCapabilities` in
 * capability.middleware. It resolves a single organisation from the token and
 * hard-codes `user_type = 'org-admin'`, so none of it is reusable here: an
 * account user may belong to several organisations, and the one they mean is
 * in the URL.
 */

/** Why an authenticated user may not enter an organisation. */
export type MembershipDenial =
  | 'NOT_CONNECTED'
  | 'PENDING_APPROVAL'
  | 'REGISTRATION_REJECTED'
  | 'ACCOUNT_INACTIVE'
  | 'ORGANISATION_UNAVAILABLE';

export interface AccountMembership {
  organisationId: string;
  organisationUserId: string;
  urlCode: string;
  displayName: string;
  currency: string;
  language: string | null;
  capabilities: string[];
  status: string;
}

export type MembershipResult =
  | { ok: true; membership: AccountMembership }
  | { ok: false; reason: MembershipDenial };

/** An organisation as shown before sign-in. Deliberately minimal. */
export interface PublicOrganisation {
  urlCode: string;
  displayName: string;
  organisationType: string | null;
  city?: string;
  country?: string;
  branding: {
    logoUrl: string;
    primaryColor: string;
  };
}

export interface PublicOrganisationDetail extends PublicOrganisation {
  capabilities: string[];
  currency: string;
  language: string | null;
  /** Whether members can register themselves, for the gateway's call to action. */
  registrationOpen: boolean;
}

const DEFAULT_PRIMARY = '#1976d2';

/**
 * Fields safe to expose without a session.
 *
 * Contact details, settings and internal ids are deliberately absent — the
 * directory is unauthenticated, so everything it returns is public.
 */
function rowToPublicOrganisation(row: any): PublicOrganisation {
  const branding = row.settings?.branding || {};
  const address = row.settings || {};
  return {
    urlCode: row.url_code,
    displayName: row.display_name,
    organisationType: row.org_type_display_name ?? null,
    city: address.city || undefined,
    country: address.country || undefined,
    branding: {
      logoUrl: branding.logoUrl || '',
      primaryColor: branding.primaryColor || DEFAULT_PRIMARY,
    },
  };
}

/**
 * The public view of an organisation, with its logo signed.
 *
 * An uploaded logo is stored as an S3 key rather than a URL, because the bucket
 * blocks public access — so every response has to sign it or the account app
 * renders a broken image. Signing is local crypto, not a network call, which is
 * why doing it per row in a directory listing is affordable.
 */
async function toPublicOrganisationWithLogo(row: any): Promise<PublicOrganisation> {
  const base = rowToPublicOrganisation(row);
  return {
    ...base,
    branding: {
      ...base.branding,
      logoUrl: await resolveLogoUrl(row.settings?.branding || {}),
    },
  };
}

export class AccountOrganisationService {
  /**
   * The public directory (screen A1).
   *
   * An organisation can opt out of being listed while staying reachable by its
   * code — hiding from the directory is a discoverability choice, not access
   * control, so `getPublicOrganisationByCode` ignores the flag.
   */
  async listPublicOrganisations(options: {
    query?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<{ organisations: PublicOrganisation[]; total: number }> {
    const limit = Math.min(Math.max(options.limit ?? 24, 1), 100);
    const offset = Math.max(options.offset ?? 0, 0);
    const query = options.query?.trim();

    const filters = [
      "o.status = 'active'",
      "COALESCE(o.settings->'listedInDirectory', 'true'::jsonb) <> 'false'::jsonb",
    ];
    const params: any[] = [];

    if (query) {
      params.push(`%${query.toLowerCase()}%`);
      filters.push(
        `(lower(o.display_name) LIKE $${params.length} OR lower(o.url_code) LIKE $${params.length})`
      );
    }

    const where = `WHERE ${filters.join(' AND ')}`;

    const [rows, count] = await Promise.all([
      db.query(
        `SELECT o.url_code, o.display_name, o.settings,
                ot.display_name AS org_type_display_name
         FROM organizations o
         LEFT JOIN organization_types ot ON ot.id = o.organization_type_id
         ${where}
         ORDER BY o.display_name
         LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, limit, offset]
      ),
      db.query(
        `SELECT COUNT(*)::int AS total FROM organizations o ${where}`,
        params
      ),
    ]);

    return {
      organisations: await Promise.all(rows.rows.map(toPublicOrganisationWithLogo)),
      total: count.rows[0]?.total ?? 0,
    };
  }

  /**
   * One organisation by its code, for the gateway (screen A2).
   *
   * Returns null for an unknown or inactive organisation. Reachable whether or
   * not the organisation is listed in the directory.
   */
  async getPublicOrganisationByCode(
    urlCode: string
  ): Promise<PublicOrganisationDetail | null> {
    const result = await db.query(
      `SELECT o.url_code, o.display_name, o.settings, o.enabled_capabilities,
              o.currency, o.language,
              ot.display_name AS org_type_display_name
       FROM organizations o
       LEFT JOIN organization_types ot ON ot.id = o.organization_type_id
       WHERE o.url_code = $1 AND o.status = 'active'`,
      [urlCode]
    );

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    return {
      ...(await toPublicOrganisationWithLogo(row)),
      capabilities: row.enabled_capabilities || [],
      currency: row.currency,
      language: row.language,
      // Registration is open unless an admin has turned auto-registration off
      // *and* approvals are not being handled — for now the gateway always
      // offers it, and the approval gate is applied after the account exists.
      registrationOpen: true,
    };
  }

  /**
   * Every organisation this user belongs to, for the switcher (screen A7).
   *
   * Includes pending and rejected memberships so the account application can
   * explain a state rather than appearing to have lost an organisation.
   */
  async getOrganisationsForUser(keycloakUserId: string): Promise<
    Array<PublicOrganisation & { status: string; capabilities: string[] }>
  > {
    const result = await db.query(
      `SELECT o.url_code, o.display_name, o.settings, o.enabled_capabilities,
              ou.status,
              ot.display_name AS org_type_display_name
       FROM organization_users ou
       JOIN organizations o ON o.id = ou.organization_id
       LEFT JOIN organization_types ot ON ot.id = o.organization_type_id
       WHERE ou.keycloak_user_id = $1
         AND ou.user_type = 'account-user'
         AND o.status = 'active'
       ORDER BY o.display_name`,
      [keycloakUserId]
    );

    return Promise.all(
      result.rows.map(async (row: any) => ({
        ...(await toPublicOrganisationWithLogo(row)),
        status: row.status,
        capabilities: row.enabled_capabilities || [],
      }))
    );
  }

  /**
   * Whether this user may act inside this organisation.
   *
   * Distinguishes "we have never heard of you" from "you are waiting for
   * approval" from "you were turned down", because the account application
   * shows a different screen for each and a single 403 would collapse them.
   */
  async resolveMembership(
    keycloakUserId: string,
    urlCode: string
  ): Promise<MembershipResult> {
    const orgResult = await db.query(
      `SELECT id, url_code, display_name, currency, language,
              enabled_capabilities, status
       FROM organizations
       WHERE url_code = $1`,
      [urlCode]
    );

    if (orgResult.rows.length === 0 || orgResult.rows[0].status !== 'active') {
      return { ok: false, reason: 'ORGANISATION_UNAVAILABLE' };
    }

    const org = orgResult.rows[0];

    const userResult = await db.query(
      `SELECT id, status
       FROM organization_users
       WHERE keycloak_user_id = $1
         AND organization_id = $2
         AND user_type = 'account-user'
       LIMIT 1`,
      [keycloakUserId, org.id]
    );

    if (userResult.rows.length === 0) {
      return { ok: false, reason: 'NOT_CONNECTED' };
    }

    const { id: organisationUserId, status } = userResult.rows[0];

    switch (status) {
      case 'active':
        return {
          ok: true,
          membership: {
            organisationId: org.id,
            organisationUserId,
            urlCode: org.url_code,
            displayName: org.display_name,
            currency: org.currency,
            language: org.language,
            capabilities: org.enabled_capabilities || [],
            status,
          },
        };
      // These two arrive with the registration-approval work (G6). Handled
      // now so the middleware does not have to change when they start being
      // written, and so an unexpected status never reads as "active".
      case 'pending':
        return { ok: false, reason: 'PENDING_APPROVAL' };
      case 'rejected':
        return { ok: false, reason: 'REGISTRATION_REJECTED' };
      default:
        return { ok: false, reason: 'ACCOUNT_INACTIVE' };
    }
  }

  /**
   * The internal id for a URL code, with no membership check.
   *
   * For the two flows that must work for someone who is *not* yet an active
   * member: registering with an organisation, and asking whether approval has
   * come through. Every other caller should go through `resolveMembership`.
   */
  async getOrganisationIdByCode(urlCode: string): Promise<string | null> {
    const result = await db.query(
      "SELECT id FROM organizations WHERE url_code = $1 AND status = 'active'",
      [urlCode]
    );
    return result.rows.length > 0 ? result.rows[0].id : null;
  }

  /** The signed-in user's own record within one organisation. */
  async getAccountUserProfile(organisationUserId: string) {
    const result = await db.query(
      `SELECT id, email, first_name, last_name, status, preferred_language,
              last_login, created_at
       FROM organization_users
       WHERE id = $1`,
      [organisationUserId]
    );

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    return {
      id: row.id,
      email: row.email,
      firstName: row.first_name,
      lastName: row.last_name,
      status: row.status,
      /*
       * Returned here, on the call that resolves the shell, because the app
       * chooses its locale the moment an organisation resolves. Null means
       * "follow the organisation", which is what most members do.
       */
      preferredLanguage: row.preferred_language ?? null,
      lastLogin: row.last_login,
      memberSince: row.created_at,
    };
  }
}

export const accountOrganisationService = new AccountOrganisationService();
