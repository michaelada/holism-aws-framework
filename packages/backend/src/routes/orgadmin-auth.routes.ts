import { Router, Response } from 'express';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth.middleware';
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
router.get('/auth/me', authenticateToken(), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const keycloakUserId = req.user?.userId;
    const userEmail = req.user?.email;

    if (!keycloakUserId) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    logger.info(`Fetching organization for user: ${userEmail} (${keycloakUserId})`);

    // Find the organization user record
    const userResult = await db.query(
      `SELECT ou.*, o.id as org_id, o.name as org_name, o.display_name as org_display_name,
              o.status as org_status, o.currency, o.language, o.enabled_capabilities, o.settings,
              o.organization_type_id, o.keycloak_group_id, o.created_at as org_created_at, 
              o.updated_at as org_updated_at
       FROM organization_users ou
       INNER JOIN organizations o ON ou.organization_id = o.id
       WHERE ou.keycloak_user_id = $1 AND ou.user_type = 'org-admin' AND ou.status = 'active'
       LIMIT 1`,
      [keycloakUserId]
    );

    if (userResult.rows.length === 0) {
      logger.warn(`No active org-admin user found for Keycloak user: ${keycloakUserId}`);
      res.status(403).json({ 
        error: 'Access denied',
        message: 'User is not an organization administrator or account is not active'
      });
      return;
    }

    const userRow = userResult.rows[0];

    // Update last_login timestamp
    await db.query(
      'UPDATE organization_users SET last_login = NOW() WHERE id = $1',
      [userRow.id]
    );

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
        status: userRow.org_status,
        currency: userRow.currency,
        language: userRow.language,
        enabledCapabilities: userRow.enabled_capabilities || [],
        settings: userRow.settings || {},
        createdAt: userRow.org_created_at,
        updatedAt: userRow.org_updated_at
      },
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

export default router;
