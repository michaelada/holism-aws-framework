import { db } from '../database/pool';
import { logger } from '../config/logger';
import { createKeycloakAdminService } from './keycloak-admin.factory';

/**
 * Who is signed in, and ending their sessions.
 *
 * **Keycloak holds the sessions; we hold only tokens.** So this reads through
 * the Admin API and joins to our own tables for names and organisations, rather
 * than keeping a session table of its own — a second copy would be wrong the
 * moment somebody signed out.
 *
 * ## What "sign them out" actually does
 *
 * It ends the Keycloak session, which stops the refresh. It does **not**
 * invalidate an access token already issued: those are stateless and stay valid
 * for their remaining lifetime — 5 minutes on this deployment. So the honest
 * guarantee is "signed out within five minutes", and the confirmation dialog
 * says exactly that rather than implying it is instant.
 *
 * That is the agreed behaviour for the "their permissions changed" case. If the
 * reason is ever a compromised account, §1.2 of the design describes the `sid`
 * check that makes it immediate.
 *
 * See docs/AUDIT_TRAIL_AND_SESSIONS.md Part 1.
 */

export interface LiveSession {
  sessionId: string;
  keycloakUserId: string;
  username: string | null;
  email: string | null;
  /** Which application they are signed in to. */
  application: string;
  ipAddress: string | null;
  startedAt: Date | null;
  lastAccessAt: Date | null;
  /** From our own tables; null where the person has no record here. */
  displayName: string | null;
  userType: 'super-admin' | 'org-admin' | 'account-user' | 'unknown';
  organisationId: string | null;
  organisationName: string | null;
}

/**
 * The clients whose sessions are worth showing, and what to call them.
 *
 * Listed rather than discovered, because Keycloak's client list also contains
 * the service accounts this process itself uses — showing our own backend as
 * "signed in" would be noise at best and alarming at worst.
 */
const APPLICATIONS: Record<string, string> = {
  'account-app': 'Account',
  'orgadmin-client': 'Org Admin',
  'aws-framework-admin': 'Platform Admin',
};

class SessionService {
  /**
   * The authenticated Admin client, and the realm it is pointed at.
   *
   * `createKeycloakAdminService` returns the singleton, so this does not build
   * a client per call; `ensureAuthenticated` refreshes the service-account
   * token only when it is close to expiring.
   */
  private async admin(): Promise<{ client: any; realm: string }> {
    const service = createKeycloakAdminService();
    await service.ensureAuthenticated();
    return { client: (service as any).client, realm: (service as any).config.realmName };
  }

  /**
   * Every live session, across all three applications.
   *
   * The union is what tells us *which* application each person is in, which a
   * per-user query would not.
   */
  async listLiveSessions(): Promise<LiveSession[]> {
    const { client } = await this.admin();
    const sessions: LiveSession[] = [];

    const clients = await client.clients.find();

    for (const [clientId, label] of Object.entries(APPLICATIONS)) {
      const record = clients.find((c: any) => c.clientId === clientId);
      if (!record?.id) continue;

      try {
        const found = await client.clients.listSessions({ id: record.id, max: 500 });
        for (const session of found) {
          sessions.push({
            sessionId: session.id,
            keycloakUserId: session.userId,
            username: session.username ?? null,
            email: null,
            application: label,
            ipAddress: session.ipAddress ?? null,
            startedAt: session.start ? new Date(Number(session.start)) : null,
            lastAccessAt: session.lastAccess ? new Date(Number(session.lastAccess)) : null,
            displayName: null,
            userType: 'unknown',
            organisationId: null,
            organisationName: null,
          });
        }
      } catch (error) {
        /*
         * One application being unreadable must not empty the whole screen —
         * "we cannot see Account sessions" is better than "nobody is signed in",
         * which is what an unhandled failure here would look like.
         */
        logger.warn('Could not list sessions for a client', { clientId, error });
      }
    }

    return this.decorate(sessions);
  }

  /**
   * Put names, user types and organisations against the Keycloak ids.
   *
   * One query for the whole page rather than one per session. A session whose
   * user we cannot identify is **kept** and marked `unknown`: somebody signed
   * in that we have no record of is itself worth seeing on this screen.
   */
  private async decorate(sessions: LiveSession[]): Promise<LiveSession[]> {
    const ids = [...new Set(sessions.map((s) => s.keycloakUserId).filter(Boolean))];
    if (ids.length === 0) return sessions;

    const result = await db.query(
      `SELECT ou.keycloak_user_id, ou.first_name, ou.last_name, ou.email, ou.user_type,
              o.id AS organisation_id, o.display_name AS organisation_name
         FROM organization_users ou
         LEFT JOIN organizations o ON o.id = ou.organization_id
        WHERE ou.keycloak_user_id = ANY($1)`,
      [ids]
    );

    const byUser = new Map<string, any[]>();
    for (const row of result.rows) {
      const list = byUser.get(row.keycloak_user_id) ?? [];
      list.push(row);
      byUser.set(row.keycloak_user_id, list);
    }

    return sessions.map((session) => {
      const rows = byUser.get(session.keycloakUserId) ?? [];
      /*
       * A person may belong to several organisations. The row matching the
       * application they are signed in to is the meaningful one; failing that,
       * the first. Guessing wrong here mislabels an organisation on screen, so
       * the application is used as the tie-breaker rather than picking blind.
       */
      const preferred =
        rows.find((r) =>
          session.application === 'Org Admin'
            ? r.user_type === 'org-admin'
            : r.user_type === 'account-user'
        ) ?? rows[0];

      if (!preferred) {
        return {
          ...session,
          userType: session.application === 'Platform Admin' ? 'super-admin' : 'unknown',
        };
      }

      return {
        ...session,
        displayName:
          [preferred.first_name, preferred.last_name].filter(Boolean).join(' ') || null,
        email: preferred.email ?? null,
        userType: preferred.user_type === 'org-admin' ? 'org-admin' : 'account-user',
        organisationId: preferred.organisation_id ?? null,
        organisationName: preferred.organisation_name ?? null,
      };
    });
  }

  /** End one session. The person stays signed in anywhere else. */
  async revokeSession(sessionId: string): Promise<void> {
    const { client, realm } = await this.admin();
    await client.realms.removeSession({ realm, sessionId });
  }

  /** End every session this person has, in every application. */
  async revokeAllForUser(keycloakUserId: string): Promise<void> {
    const { client } = await this.admin();
    await client.users.logout({ id: keycloakUserId });
  }
}

export const sessionService = new SessionService();
