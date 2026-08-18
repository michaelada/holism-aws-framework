import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './auth.middleware';
import { db } from '../database/pool';

/**
 * Extended request with organisation information
 */
export interface OrganisationRequest extends AuthenticatedRequest {
  organisationId?: string;
  organisationUserId?: string;
  capabilities?: string[];
}

/**
 * The organisation this request is about, if it says.
 *
 * Two ways of saying it, and they mean the same thing:
 *
 * - **`/organisations/:organisationId/…`** — the data routes, where the
 *   organisation is part of the address.
 * - **`X-Organisation-Id`** — the routes that have no organisation in their
 *   path (Settings, Users, Forms, uploads, most of Payments). The shell sends
 *   it on every request once an administrator has chosen.
 *
 * The URL wins where both are present: an address naming an organisation is
 * unambiguous, and a header quietly overriding it would make the same URL mean
 * different things in different tabs.
 *
 * Neither is trusted. Whichever is used, membership is checked against it
 * before anything is attached to the request.
 */
export const ORGANISATION_HEADER = 'x-organisation-id';

function requestedOrganisationId(req: OrganisationRequest): string | null {
  const fromUrl = (req.params as Record<string, string> | undefined)?.organisationId;
  if (fromUrl) return fromUrl;

  const fromHeader = req.headers?.[ORGANISATION_HEADER];
  const value = Array.isArray(fromHeader) ? fromHeader[0] : fromHeader;
  return value && value.trim() ? value.trim() : null;
}

/** A malformed id must read as "not yours", not as a 500 from Postgres. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The caller's org-admin row for the organisation this request is about.
 *
 * **Which organisation is asked of the request, not of the identity.** The old
 * lookup asked "what is this administrator's organisation?", attached it, and
 * left the handler to go on using `req.params.organisationId` instead. Nothing
 * compared the two, so an administrator of one club could put another club's id
 * in the URL and be served: the capability was checked against *their*
 * organisation and the data read from the one they named. Thirty routes were
 * shaped that way. See docs/ORGADMIN_MULTI_ORGANISATION.md §0.
 *
 * The membership condition is both that fix and the whole of multi-organisation
 * support for those routes — the question stops being "what is their
 * organisation?" and becomes "is this one of them?", which is already right for
 * an administrator of six.
 *
 * Shared by the capability check and the role check so the two can never
 * disagree about which club they are talking about.
 */
async function resolveOrgAdminRow(keycloakUserId: string, requested: string | null) {
  if (requested) {
    return db.query(
      `SELECT ou.id as user_id, ou.organization_id, o.enabled_capabilities, o.status as org_status
       FROM organization_users ou
       INNER JOIN organizations o ON ou.organization_id = o.id
       WHERE ou.keycloak_user_id = $1 AND ou.user_type = 'org-admin' AND ou.status = 'active'
         AND ou.organization_id = $2::uuid`,
      [keycloakUserId, requested]
    );
  }

  /*
   * Nothing named it: the routes that still infer the organisation. Ordered
   * rather than `LIMIT 1` over an unordered set — with one row that made no
   * difference, and with two it would hand the administrator whichever one
   * Postgres felt like returning, possibly a different one each request.
   *
   * `org_admin_last_organisation` is a remembered *starting point*, not an
   * authority: a request that means a particular organisation says so in its
   * URL or its header. See migration 1709000000029.
   */
  return db.query(
    `SELECT ou.id as user_id, ou.organization_id, o.enabled_capabilities, o.status as org_status
     FROM organization_users ou
     INNER JOIN organizations o ON ou.organization_id = o.id
     LEFT JOIN org_admin_last_organisation last
       ON last.keycloak_user_id = ou.keycloak_user_id
      AND last.organization_id = ou.organization_id
     WHERE ou.keycloak_user_id = $1 AND ou.user_type = 'org-admin' AND ou.status = 'active'
     ORDER BY (last.keycloak_user_id IS NOT NULL) DESC, o.display_name, o.id
     LIMIT 1`,
    [keycloakUserId]
  );
}

/**
 * The verified organisation for this request, for middleware that runs without
 * the capability chain.
 *
 * Reuses whatever the capability middleware already resolved when both are in
 * play — it has verified membership by then, and asking again would be a second
 * query to reach the same answer.
 */
export async function organisationOfRequest(req: OrganisationRequest): Promise<string | null> {
  if (req.organisationId) return req.organisationId;
  if (!req.user) return null;

  const requested = requestedOrganisationId(req);
  if (requested && !UUID.test(requested)) return null;

  const result = await resolveOrgAdminRow(req.user.userId, requested);
  const row = result.rows[0];
  return row && row.org_status === 'active' ? row.organization_id : null;
}

/**
 * Middleware to load organisation capabilities
 * Must be used after authenticateToken middleware
 * 
 * This middleware:
 * 1. Looks up the user's organisation from organization_users table
 * 2. Loads organisation capabilities from the organizations table
 * 3. Attaches organisationId, organisationUserId, and capabilities to request for use by other middleware
 * 
 * @returns Express middleware function
 */
export function loadOrganisationCapabilities() {
  return async (req: OrganisationRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required'
          }
        });
        return;
      }

      const keycloakUserId = req.user.userId;

      const requested = requestedOrganisationId(req);
      if (requested && !UUID.test(requested)) {
        res.status(403).json({
          error: { code: 'FORBIDDEN', message: 'You do not administer this organisation' },
        });
        return;
      }

      const userResult = await resolveOrgAdminRow(keycloakUserId, requested);

      if (userResult.rows.length === 0) {
        /*
         * One refusal for "not yours", "does not exist" and "not an
         * administrator at all". Distinguishing them would let anyone with an
         * org-admin session enumerate which organisation ids are real.
         */
        res.status(403).json({
          error: {
            code: 'FORBIDDEN',
            message: 'You do not administer this organisation'
          }
        });
        return;
      }

      /*
       * Checked on every request, not only at sign-in.
       *
       * Deactivating an organisation has to take effect immediately. Gating
       * only the login route would leave every administrator already signed in
       * working normally until their token expired — which, for the case this
       * exists to serve, is precisely the window that matters.
       */
      if (userResult.rows[0].org_status !== 'active') {
        res.status(403).json({
          error: {
            code: 'ORGANISATION_INACTIVE',
            message: 'This organisation is inactive.'
          }
        });
        return;
      }

      const organisationUserId = userResult.rows[0].user_id;
      const organisationId = userResult.rows[0].organization_id;
      const capabilities = userResult.rows[0].enabled_capabilities || [];

      // Attach to request
      req.organisationUserId = organisationUserId;
      req.organisationId = organisationId;
      req.capabilities = capabilities;

      next();
    } catch (error) {
      console.error('Error loading organisation capabilities:', error);
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to load organisation capabilities'
        }
      });
    }
  };
}

/**
 * Middleware to require specific capability(ies)
 * Must be used after loadOrganisationCapabilities middleware
 * 
 * @param capabilities - Single capability or array of capabilities (organisation must have at least one)
 * @returns Express middleware function
 * 
 * @example
 * // Require event-management capability
 * router.get('/events', 
 *   authenticateToken(),
 *   loadOrganisationCapabilities(),
 *   requireCapability('event-management'),
 *   getEvents
 * );
 * 
 * @example
 * // Require either memberships or registrations capability
 * router.get('/members', 
 *   authenticateToken(),
 *   loadOrganisationCapabilities(),
 *   requireCapability(['memberships', 'registrations']),
 *   getMembers
 * );
 */
export function requireCapability(capabilities: string | string[]) {
  const requiredCapabilities = Array.isArray(capabilities) ? capabilities : [capabilities];

  return (req: OrganisationRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required'
        }
      });
      return;
    }

    if (!req.capabilities) {
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Organisation capabilities not loaded. Ensure loadOrganisationCapabilities middleware is used before requireCapability.'
        }
      });
      return;
    }

    const hasCapability = requiredCapabilities.some(cap => req.capabilities!.includes(cap));

    if (!hasCapability) {
      res.status(403).json({
        error: {
          code: 'FORBIDDEN',
          message: `Access denied. Required capability: ${requiredCapabilities.join(' or ')}`,
          requiredCapabilities
        }
      });
      return;
    }

    next();
  };
}

/**
 * Middleware to require all specified capabilities
 * Must be used after loadOrganisationCapabilities middleware
 * 
 * @param capabilities - Array of capabilities (organisation must have all of them)
 * @returns Express middleware function
 * 
 * @example
 * // Require both event-management and event-ticketing capabilities
 * router.get('/ticketed-events', 
 *   authenticateToken(),
 *   loadOrganisationCapabilities(),
 *   requireAllCapabilities(['event-management', 'event-ticketing']),
 *   getTicketedEvents
 * );
 */
export function requireAllCapabilities(capabilities: string[]) {
  return (req: OrganisationRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required'
        }
      });
      return;
    }

    if (!req.capabilities) {
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Organisation capabilities not loaded. Ensure loadOrganisationCapabilities middleware is used before requireAllCapabilities.'
        }
      });
      return;
    }

    const hasAllCapabilities = capabilities.every(cap => req.capabilities!.includes(cap));

    if (!hasAllCapabilities) {
      res.status(403).json({
        error: {
          code: 'FORBIDDEN',
          message: `Access denied. Required capabilities: ${capabilities.join(', ')}`,
          requiredCapabilities: capabilities
        }
      });
      return;
    }

    next();
  };
}

/**
 * Convenience middleware for orgadmin routes with capability check
 * Combines authentication, organisation capability loading, and capability check
 * 
 * @param capability - Required capability name
 * @returns Array of Express middleware functions
 * 
 * @example
 * // Protect events routes with event-management capability
 * router.get('/events', 
 *   ...requireOrgAdminCapability('event-management'),
 *   getEvents
 * );
 */
export function requireOrgAdminCapability(capability: string | string[]) {
  return [
    loadOrganisationCapabilities(),
    requireCapability(capability)
  ];
}
