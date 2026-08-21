import { Router, Response } from 'express';
import { authenticateToken } from '../middleware/auth.middleware';
import {
  OrganisationRequest,
  ORGANISATION_HEADER,
  organisationOfRequest,
} from '../middleware/capability.middleware';
import { db } from '../database/pool';
import { logger } from '../config/logger';

const router = Router();

/**
 * GET /api/orgadmin/auth/me
 * Get current authenticated user's organization and profile
 * 
 * This endpoint is called by the orgadmin frontend after Keycloak authentication
 * to fetch the user's organization details and verify they have org-admin access
 */
router.get('/auth/me', authenticateToken(), async (req: OrganisationRequest, res: Response): Promise<void> => {
  try {
    const keycloakUserId = req.user?.userId;
    const userEmail = req.user?.email;

    if (!keycloakUserId) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    logger.info(`Fetching organization for user: ${userEmail} (${keycloakUserId})`);

    /*
     * Every organisation this identity administers, not just one.
     *
     * `organization_users` is unique on `(organization_id, keycloak_user_id)`,
     * so one person holding several rows has always been what the schema
     * expects — account users already live that way. What stopped it here was
     * this query ending in `LIMIT 1` over an unordered set: with one row it made
     * no difference, and with two it would hand the administrator whichever one
     * Postgres felt like returning, possibly a different one each sign-in.
     *
     * Ordered by name so the list reads the way a person would write it.
     * See docs/ORGADMIN_MULTI_ORGANISATION.md.
     */
    const memberships = await db.query(
      `SELECT ou.*, o.id as org_id, o.name as org_name, o.display_name as org_display_name,
              o.url_code as org_url_code,
              o.url_code as org_url_code,
              o.status as org_status, o.currency, o.language, o.enabled_capabilities, o.settings,
              o.organization_type_id, o.keycloak_group_id, o.created_at as org_created_at, 
              o.updated_at as org_updated_at,
              (last.keycloak_user_id IS NOT NULL) AS was_last_used
       FROM organization_users ou
       INNER JOIN organizations o ON ou.organization_id = o.id
       LEFT JOIN org_admin_last_organisation last
         ON last.keycloak_user_id = ou.keycloak_user_id
        AND last.organization_id = ou.organization_id
       WHERE ou.keycloak_user_id = $1 AND ou.user_type = 'org-admin' AND ou.status = 'active'
       ORDER BY o.display_name, o.id`,
      [keycloakUserId]
    );

    /*
     * Which one to open on, in order of how much it is worth trusting: what the
     * request asked for, then where they were last time, then the first by name.
     *
     * An organisation the header names but they do not administer is ignored
     * rather than refused — this endpoint answers "who are you and where can you
     * work?", and a stale header from a club they have since left should land
     * them somewhere useful rather than locked out of the app entirely.
     */
    const active = memberships.rows.filter((row: any) => row.org_status === 'active');
    const requestedHeader = req.headers?.[ORGANISATION_HEADER];
    const requested = Array.isArray(requestedHeader) ? requestedHeader[0] : requestedHeader;

    const current =
      active.find((row: any) => row.org_id === requested) ??
      active.find((row: any) => row.was_last_used) ??
      active[0];

    const userResult = { rows: current ? [current] : (memberships.rows.length ? [memberships.rows[0]] : []) };

    if (userResult.rows.length === 0) {
      logger.warn(`No active org-admin user found for Keycloak user: ${keycloakUserId}`);
      res.status(403).json({ 
        error: 'Access denied',
        message: 'User is not an organization administrator or account is not active'
      });
      return;
    }

    /*
     * An inactive organisation admits nobody — administrators included.
     *
     * This check is deliberately separate from the one above, and the message
     * is deliberately different. The query filters on `ou.status`, the *user's*
     * membership; this is `o.status`, the *organisation's*. Until now only the
     * first was enforced, so deactivating an organisation shut its members out
     * of the member app while its administrators carried on working in it
     * unaffected — the opposite of what "inactive" is understood to mean.
     *
     * Telling the administrator plainly that the organisation is inactive is
     * safe: they already know the organisation exists, and a vague "access
     * denied" would send them to support to be told the same thing.
     */
    if (userResult.rows[0].org_status !== 'active') {
      logger.warn(
        `Org-admin sign-in refused: organisation ${userResult.rows[0].org_id} is ` +
          `${userResult.rows[0].org_status}`
      );
      res.status(403).json({
        error: 'Organisation inactive',
        code: 'ORGANISATION_INACTIVE',
        message:
          'This organisation is inactive. Contact the platform administrator to reactivate it.',
      });
      return;
    }

    const userRow = userResult.rows[0];

    // Update last_login timestamp
    await db.query(
      'UPDATE organization_users SET last_login = NOW() WHERE id = $1',
      [userRow.id]
    );

    /*
     * Remember where they are, so a new session opens here rather than
     * alphabetically first.
     *
     * A *starting point*, never an authority — what decides which organisation
     * a request acts on is the request itself. Written on every `/auth/me` and
     * not only on an explicit switch, because arriving somewhere by any route
     * is what makes it the place to come back to.
     */
    if (memberships.rows.length > 1) {
      await db.query(
        `INSERT INTO org_admin_last_organisation (keycloak_user_id, organization_id, updated_at)
         VALUES ($1::text, $2::uuid, NOW())
         ON CONFLICT (keycloak_user_id)
         DO UPDATE SET organization_id = EXCLUDED.organization_id, updated_at = NOW()`,
        [keycloakUserId, userRow.org_id]
      );
    }

    // Get user's roles and permissions
    const rolesResult = await db.query(
      `SELECT oar.id, oar.name, oar.display_name, oar.capability_permissions
       FROM organization_user_roles our
       INNER JOIN organization_admin_roles oar ON our.organization_admin_role_id = oar.id
       WHERE our.organization_user_id = $1`,
      [userRow.id]
    );

    // Aggregate capabilities from all roles
    const capabilitiesSet = new Set<string>();
    rolesResult.rows.forEach((role: any) => {
      const permissions = role.capability_permissions || {};
      Object.keys(permissions).forEach(cap => capabilitiesSet.add(cap));
    });

    const capabilities = Array.from(capabilitiesSet);

    // Build response
    const response = {
      user: {
        id: userRow.id,
        email: userRow.email,
        firstName: userRow.first_name,
        lastName: userRow.last_name,
        userName: userRow.email, // Use email as username
        status: userRow.status,
        lastLogin: new Date() // Return current timestamp since we just updated it
      },
      organisation: {
        id: userRow.org_id,
        organizationTypeId: userRow.organization_type_id,
        keycloakGroupId: userRow.keycloak_group_id,
        name: userRow.org_name,
        displayName: userRow.org_display_name,
        /*
         * How the club is addressed in the account application —
         * `/account/khpc`. The org-admin needs it to show an administrator the
         * public address of something they have just published.
         */
        urlCode: userRow.org_url_code,
        status: userRow.org_status,
        currency: userRow.currency,
        language: userRow.language,
        enabledCapabilities: userRow.enabled_capabilities || [],
        settings: userRow.settings || {},
        createdAt: userRow.org_created_at,
        updatedAt: userRow.org_updated_at
      },
      /*
       * Every organisation they administer, so the shell can offer a switcher.
       *
       * A summary rather than the full record: the switcher needs a name to
       * show and an id to send, and shipping four complete organisations with
       * their settings to render a menu would be the same mistake as loading a
       * catalogue to draw a link.
       *
       * An administrator of one gets a list of one, and the shell renders no
       * switcher — that falls out of the data rather than out of a flag, so
       * there is nothing to configure and nothing to get wrong.
       */
      organisations: active.map((row: any) => ({
        id: row.org_id,
        displayName: row.org_display_name,
        urlCode: row.org_url_code,
        isCurrent: row.org_id === userRow.org_id,
      })),
      capabilities,
      roles: rolesResult.rows.map((role: any) => ({
        id: role.id,
        name: role.name,
        displayName: role.display_name
      }))
    };

    logger.info(`Successfully fetched organization for user: ${userEmail}`);
    res.json(response);
  } catch (error) {
    logger.error('Error fetching user organization:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: 'Failed to load organization data'
    });
  }
});

/**
 * GET /api/orgadmin/auth/capabilities
 * Get current user's capabilities based on their roles and organization's enabled capabilities
 */
router.get('/auth/capabilities', authenticateToken(), async (req: OrganisationRequest, res: Response): Promise<void> => {
  try {
    const keycloakUserId = req.user?.userId;

    if (!keycloakUserId) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    /*
     * The organisation this request is about, resolved the same way every other
     * org-admin route resolves it — the header if the shell sent one, else where
     * they were last, else the first by name. This too ended in an unordered
     * `LIMIT 1`, which for an administrator of several would have reported the
     * capabilities of an arbitrary one of their clubs.
     */
    const organisationId = await organisationOfRequest(req);
    if (!organisationId) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    const userResult = await db.query(
      `SELECT ou.id, o.enabled_capabilities
       FROM organization_users ou
       INNER JOIN organizations o ON ou.organization_id = o.id
       WHERE ou.keycloak_user_id = $1 AND ou.user_type = 'org-admin' AND ou.status = 'active'
         AND ou.organization_id = $2::uuid`,
      [keycloakUserId, organisationId]
    );

    if (userResult.rows.length === 0) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    const userRow = userResult.rows[0];

    // Get user's role-based capabilities
    const rolesResult = await db.query(
      `SELECT oar.capability_permissions
       FROM organization_user_roles our
       INNER JOIN organization_admin_roles oar ON our.organization_admin_role_id = oar.id
       WHERE our.organization_user_id = $1`,
      [userRow.id]
    );

    // Aggregate capabilities from roles
    const roleCapabilities = new Set<string>();
    rolesResult.rows.forEach((role: any) => {
      const permissions = role.capability_permissions || {};
      Object.keys(permissions).forEach(cap => roleCapabilities.add(cap));
    });

    // Combine role capabilities with organization's enabled capabilities
    const enabledCapabilities: string[] = userRow.enabled_capabilities || [];
    const allCapabilities = new Set([...roleCapabilities, ...enabledCapabilities]);

    res.json({ capabilities: Array.from(allCapabilities) });
  } catch (error) {
    logger.error('Error fetching capabilities:', error);
    res.status(500).json({ error: 'Failed to load capabilities' });
  }
});

export default router;
