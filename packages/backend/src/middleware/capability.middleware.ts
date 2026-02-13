import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './auth.middleware';
import { db } from '../database/pool';

/**
 * Extended request with organisation information
 */
export interface OrganisationRequest extends AuthenticatedRequest {
  organisationId?: string;
  capabilities?: string[];
}

/**
 * Middleware to load organisation capabilities
 * Must be used after authenticateToken middleware
 * 
 * This middleware:
 * 1. Extracts organisation ID from request (query param, body, or params)
 * 2. Loads organisation capabilities from database
 * 3. Attaches capabilities to request for use by other middleware
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

      // Extract organisation ID from request
      // Priority: params > body > query
      const organisationId = 
        req.params.organisationId || 
        req.body?.organisationId || 
        req.query.organisationId as string;

      if (!organisationId) {
        res.status(400).json({
          error: {
            code: 'BAD_REQUEST',
            message: 'Organisation ID is required'
          }
        });
        return;
      }

      // Load organisation capabilities from database
      const result = await db.query(
        `SELECT c.name
         FROM capabilities c
         INNER JOIN organisation_capabilities oc ON c.id = oc.capability_id
         WHERE oc.organisation_id = $1 AND oc.enabled = true`,
        [organisationId]
      );

      const capabilities = result.rows.map((row: any) => row.name);

      // Attach to request
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
