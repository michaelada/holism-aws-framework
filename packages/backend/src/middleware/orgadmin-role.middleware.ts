import { Response, NextFunction } from 'express';
import { db } from '../database/pool';
import { logger } from '../config/logger';
import { OrganisationRequest, organisationOfRequest } from './capability.middleware';

/**
 * Middleware to require specific organization admin role(s)
 * Must be used after authenticateToken middleware
 * 
 * This middleware checks organization-specific roles stored in the database,
 * not Keycloak realm roles. It's designed for orgadmin portal endpoints.
 * 
 * @param roles - Single role name or array of role names (user must have at least one)
 * @returns Express middleware function
 * 
 * @example
 * // Require admin role
 * router.post('/members', authenticateToken(), requireOrgAdminRole('admin'), handler);
 * 
 * // Require admin or manager role
 * router.post('/members', authenticateToken(), requireOrgAdminRole(['admin', 'manager']), handler);
 */
export function requireOrgAdminRole(roles: string | string[]) {
  const requiredRoles = Array.isArray(roles) ? roles : [roles];

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

      // Get user's organization admin roles from database
      /*
       * `o.status = 'active'` belongs here as well as in the capability
       * middleware: not every org-admin route passes through both, and a role
       * check that succeeds for an inactive organisation would hand out
       * permissions for an organisation nobody should be able to reach.
       */
      /*
       * **Roles are held in an organisation, not on the platform.**
       *
       * This gathered every role name the identity had anywhere, with no
       * organisation filter at all. With one organisation each that was the
       * same answer; the moment somebody administers two it is a privilege
       * escalation — a role held at one club would satisfy a role check for a
       * request against the other.
       *
       * Scoped to the organisation the request is about, resolved the same way
       * the capability check resolves it so the two can never disagree about
       * which club they are talking about.
       */
      const organisationId = await organisationOfRequest(req);

      if (!organisationId) {
        logger.warn(`User ${keycloakUserId} has no organisation for this request`);
        res.status(403).json({
          error: {
            code: 'FORBIDDEN',
            message: 'You do not administer this organisation'
          }
        });
        return;
      }

      const result = await db.query(
        `SELECT oar.name
         FROM organization_users ou
         INNER JOIN organizations o ON ou.organization_id = o.id
         INNER JOIN organization_user_roles our ON ou.id = our.organization_user_id
         INNER JOIN organization_admin_roles oar ON our.organization_admin_role_id = oar.id
         WHERE ou.keycloak_user_id = $1 AND ou.user_type = 'org-admin'
           AND ou.status = 'active' AND o.status = 'active'
           AND ou.organization_id = $2::uuid`,
        [keycloakUserId, organisationId]
      );

      if (result.rows.length === 0) {
        logger.warn(`User ${keycloakUserId} has no organization admin roles`);
        res.status(403).json({
          error: {
            code: 'FORBIDDEN',
            message: 'Access denied. You do not have the required role.'
          }
        });
        return;
      }

      const userRoles = result.rows.map((row: any) => row.name);
      const hasRole = requiredRoles.some(role => userRoles.includes(role));

      if (!hasRole) {
        logger.warn(`User ${keycloakUserId} does not have required role. Has: ${userRoles.join(', ')}, Required: ${requiredRoles.join(' or ')}`);
        res.status(403).json({
          error: {
            code: 'FORBIDDEN',
            message: `Access denied. Required role: ${requiredRoles.join(' or ')}`
          }
        });
        return;
      }

      logger.debug(`User ${keycloakUserId} has required role: ${userRoles.join(', ')}`);
      next();
    } catch (error) {
      logger.error('Error checking organization admin role:', error);
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to verify user role'
        }
      });
    }
  };
}

/**
 * Convenience middleware for requiring admin role
 * Must be used after authenticateToken middleware
 * 
 * Accepts both 'admin' and 'full-administrator' roles
 * 
 * @returns Express middleware function
 * 
 * @example
 * router.post('/members', authenticateToken(), requireOrgAdmin(), handler);
 */
export function requireOrgAdmin() {
  return requireOrgAdminRole(['admin', 'full-administrator']);
}
