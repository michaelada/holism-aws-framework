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

      // Look up the user's organisation and capabilities from organization_users and organizations tables
      const userResult = await db.query(
        `SELECT ou.id as user_id, ou.organization_id, o.enabled_capabilities
         FROM organization_users ou
         INNER JOIN organizations o ON ou.organization_id = o.id
         WHERE ou.keycloak_user_id = $1 AND ou.user_type = 'org-admin' AND ou.status = 'active'
         LIMIT 1`,
        [keycloakUserId]
      );

      if (userResult.rows.length === 0) {
        res.status(403).json({
          error: {
            code: 'FORBIDDEN',
            message: 'User is not an organization administrator or account is not active'
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
