import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './auth.middleware';
import { db } from '../database/pool';
import { logger } from '../config/logger';

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

  return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
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
      const result = await db.query(
        `SELECT oar.name
         FROM organization_users ou
         INNER JOIN organization_user_roles our ON ou.id = our.organization_user_id
         INNER JOIN organization_admin_roles oar ON our.organization_admin_role_id = oar.id
         WHERE ou.keycloak_user_id = $1 AND ou.user_type = 'org-admin' AND ou.status = 'active'`,
        [keycloakUserId]
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
