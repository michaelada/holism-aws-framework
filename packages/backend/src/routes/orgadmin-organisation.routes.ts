import { Router, Response } from 'express';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth.middleware';
import { db } from '../database/pool';
import { logger } from '../config/logger';
import { organizationPaymentSettingsService } from '../services/organization-payment-settings.service';

const router = Router();

/**
 * Resolve the organisation that the authenticated org-admin belongs to.
 * Returns null if the user is not an active org-admin of any organisation.
 */
async function resolveOrganisationId(keycloakUserId: string): Promise<string | null> {
  const result = await db.query(
    `SELECT organization_id FROM organization_users
     WHERE keycloak_user_id = $1 AND user_type = 'org-admin' AND status = 'active'
     LIMIT 1`,
    [keycloakUserId]
  );
  return result.rows.length > 0 ? result.rows[0].organization_id : null;
}

/**
 * @openapi
 * /api/orgadmin/organisation/payment-settings:
 *   get:
 *     summary: Get the current organisation's payment settings
 *     tags: [OrgAdmin]
 *     responses:
 *       200:
 *         description: The organisation's payment settings
 */
router.get(
  '/payment-settings',
  authenticateToken(),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const keycloakUserId = req.user?.userId;
      if (!keycloakUserId) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      const organisationId = await resolveOrganisationId(keycloakUserId);
      if (!organisationId) {
        res.status(403).json({ error: 'User is not an organization administrator' });
        return;
      }

      const settings = await organizationPaymentSettingsService.getPaymentSettings(organisationId);
      res.json(settings);
    } catch (error) {
      logger.error('Error in GET /organisation/payment-settings:', error);
      res.status(500).json({ error: 'Failed to load payment settings' });
    }
  }
);

/**
 * @openapi
 * /api/orgadmin/organisation/payment-settings:
 *   put:
 *     summary: Update the current organisation's payment settings
 *     tags: [OrgAdmin]
 *     responses:
 *       200:
 *         description: The updated payment settings
 */
router.put(
  '/payment-settings',
  authenticateToken(),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const keycloakUserId = req.user?.userId;
      if (!keycloakUserId) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      const organisationId = await resolveOrganisationId(keycloakUserId);
      if (!organisationId) {
        res.status(403).json({ error: 'User is not an organization administrator' });
        return;
      }

      const updated = await organizationPaymentSettingsService.updatePaymentSettings(
        organisationId,
        req.body
      );
      res.json(updated);
    } catch (error) {
      logger.error('Error in PUT /organisation/payment-settings:', error);
      res.status(500).json({ error: 'Failed to update payment settings' });
    }
  }
);

export default router;
