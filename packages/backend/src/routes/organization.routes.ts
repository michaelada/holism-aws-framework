import { Router, Request, Response } from 'express';
import { organizationService } from '../services/organization.service';
import { organizationTypeService } from '../services/organization-type.service';
import { organizationApplicationFeeService } from '../services/organization-application-fee.service';
import { ValidationError } from '../middleware/errors';
import { authenticateToken, requireRole } from '../middleware/auth.middleware';
import { logger } from '../config/logger';
import { audited } from '../middleware/audit.middleware';

const router = Router();

/**
 * @swagger
 * /api/admin/organizations:
 *   get:
 *     summary: Get all organizations
 *     tags: [Organizations]
 *     parameters:
 *       - in: query
 *         name: organizationTypeId
 *         schema:
 *           type: string
 *         description: Filter by organization type
 *     responses:
 *       200:
 *         description: List of organizations
 */
router.get('/', authenticateToken(), async (req: Request, res: Response) => {
  try {
    const { organizationTypeId } = req.query;
    const organizations = await organizationService.getAllOrganizations(
      organizationTypeId as string
    );
    res.json(organizations);
  } catch (error) {
    logger.error('Error in GET /organizations:', error);
    res.status(500).json({ error: 'Failed to fetch organizations' });
  }
});

/**
 * @swagger
 * /api/admin/organizations/url-code-available:
 *   get:
 *     summary: Whether a URL code may be used
 *     description: >
 *       Backs the inline check on the organisation form. Declared before /:id
 *       so "url-code-available" is not captured as an organisation id.
 *     tags: [Organizations]
 *     parameters:
 *       - in: query
 *         name: code
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: excludeId
 *         description: Organisation being edited, so its own code does not count as taken
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Availability and, when unavailable, the reason
 */
router.get(
  '/url-code-available',
  authenticateToken(),
  async (req: Request, res: Response) => {
    try {
      const code = String(req.query.code ?? '');
      const excludeId = req.query.excludeId
        ? String(req.query.excludeId)
        : undefined;

      const result = await organizationService.checkUrlCodeAvailability(
        code,
        excludeId
      );
      return res.json(result);
    } catch (error) {
      logger.error('Error in GET /organizations/url-code-available:', error);
      return res.status(500).json({ error: 'Failed to check URL code' });
    }
  }
);

/**
 * @swagger
 * /api/admin/organizations/{id}:
 *   get:
 *     summary: Get organization by ID
 *     tags: [Organizations]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Organization details
 *       404:
 *         description: Organization not found
 */
router.get('/:id', authenticateToken(), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const organization = await organizationService.getOrganizationById(id);
    
    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }
    
    return res.json(organization);
  } catch (error) {
    logger.error('Error in GET /organizations/:id:', error);
    return res.status(500).json({ error: 'Failed to fetch organization' });
  }
});

/**
 * @swagger
 * /api/admin/organizations:
 *   post:
 *     summary: Create organization (super admin only)
 *     tags: [Organizations]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - organizationTypeId
 *               - name
 *               - displayName
 *               - enabledCapabilities
 *             properties:
 *               organizationTypeId:
 *                 type: string
 *               name:
 *                 type: string
 *               displayName:
 *                 type: string
 *               domain:
 *                 type: string
 *               status:
 *                 type: string
 *                 enum: [active, inactive, blocked]
 *               enabledCapabilities:
 *                 type: array
 *                 items:
 *                   type: string
 *               currency:
 *                 type: string
 *               language:
 *                 type: string
 *     responses:
 *       201:
 *         description: Organization created
 */
router.post(
  '/',
  authenticateToken(),
  requireRole('super-admin'),
  audited({ action: 'organisation.created', resource: 'organisation', label: 'name' }),
  async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.sub;
      const organization = await organizationService.createOrganization(
        req.body,
        userId
      );
      res.status(201).json(organization);
    } catch (error) {
      logger.error('Error in POST /organizations:', error);
      if (error instanceof Error) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Failed to create organization' });
      }
    }
  }
);

/**
 * @swagger
 * /api/admin/organizations/{id}:
 *   put:
 *     summary: Update organization (super admin only)
 *     tags: [Organizations]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Organization updated
 *       404:
 *         description: Organization not found
 */
router.put(
  '/:id',
  authenticateToken(),
  requireRole('super-admin'),
  audited({ action: 'organisation.updated', resource: 'organisation', label: 'name' }),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const userId = (req as any).user?.sub;
      const organization = await organizationService.updateOrganization(
        id,
        req.body,
        userId
      );
      res.json(organization);
    } catch (error) {
      logger.error('Error in PUT /organizations/:id:', error);
      if (error instanceof Error) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Failed to update organization' });
      }
    }
  }
);

/**
 * @swagger
 * /api/admin/organizations/{id}:
 *   delete:
 *     summary: Retired — organisations are deactivated, not deleted
 *     description: >
 *       Always refuses. Set the organisation's status to `inactive` instead,
 *       which makes it unreachable to members and to its own administrators
 *       while keeping its entries, memberships, orders and payment history
 *       intact. See docs/ORGANISATION_STATUS_AND_DEACTIVATION.md.
 *     tags: [Organizations]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       409:
 *         description: Organisations cannot be deleted
 */
/*
 * The route stays and refuses, rather than being removed.
 *
 * Deleting it would answer 404, which reads as "wrong URL" and invites a
 * caller to go looking for the right one. A 409 that names the alternative
 * says what actually changed and where to go instead — and it keeps any
 * existing client from silently believing a delete succeeded.
 *
 * `deleteOrganization` remains on the service, unreferenced by any route, for
 * the same reason the endpoint does: removing it is a separate decision about
 * an operational escape hatch, and this change is about the product surface.
 */
router.delete(
  '/:id',
  authenticateToken(),
  requireRole('super-admin'),
  audited({ action: 'organisation.deleted', resource: 'organisation', label: 'name' }),
  async (req: Request, res: Response) => {
    logger.warn(`Refused DELETE /organizations/${req.params.id}: organisations are deactivated`);
    res.status(409).json({
      error: 'Organisations cannot be deleted',
      code: 'DELETE_NOT_SUPPORTED',
      message:
        'Set the organisation status to inactive instead. It will become unreachable to its ' +
        'members and administrators, and everything it holds is kept.',
    });
  }
);

/**
 * @swagger
 * /api/admin/organizations/{id}/capabilities:
 *   put:
 *     summary: Update organization capabilities (super admin only)
 *     tags: [Organizations]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - enabledCapabilities
 *             properties:
 *               enabledCapabilities:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Capabilities updated
 */
router.put(
  '/:id/capabilities',
  authenticateToken(),
  requireRole('super-admin'),
  audited({ action: 'capability.granted', resource: 'organisation', entityType: 'organisation', label: 'name', kind: 'action' }),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { enabledCapabilities } = req.body;
      const userId = (req as any).user?.sub;
      
      const organization = await organizationService.updateOrganizationCapabilities(
        id,
        enabledCapabilities,
        userId
      );
      res.json(organization);
    } catch (error) {
      logger.error('Error in PUT /organizations/:id/capabilities:', error);
      if (error instanceof Error) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Failed to update capabilities' });
      }
    }
  }
);

/**
 * @swagger
 * /api/admin/organizations/{id}/application-fees:
 *   get:
 *     summary: Get the Stripe Connect application fees for an organisation
 *     description: >
 *       The platform's cut of each card payment, per payment method. Each entry
 *       carries the organisation's own value alongside its type's current
 *       default, so a caller can show whether the two have diverged. This is
 *       the application fee only — handling fees are configured on the
 *       organisation type and are not returned here.
 *     tags: [Organizations]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: The organisation's application fees
 *       404:
 *         description: Organisation not found
 */
router.get(
  '/:id/application-fees',
  authenticateToken(),
  requireRole('super-admin'),
  async (req: Request, res: Response) => {
    try {
      const fees = await organizationApplicationFeeService.getForOrganisation(req.params.id);
      if (!fees) {
        res.status(404).json({ error: 'Organisation not found' });
        return;
      }
      res.json(fees);
    } catch (error) {
      logger.error('Error in GET /organizations/:id/application-fees:', error);
      res.status(500).json({ error: 'Failed to load application fees' });
    }
  }
);

/**
 * @swagger
 * /api/admin/organizations/{id}/application-fees:
 *   put:
 *     summary: Replace the Stripe Connect application fees for an organisation
 *     description: >
 *       Sets this organisation's own split, independently of its type. A pair
 *       must be set together or left blank together; a half-set pair is
 *       rejected, because one filled box and one empty one reads as a
 *       deliberate 0% when it is almost certainly an unfinished form.
 *     tags: [Organizations]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               fees:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     paymentMethodId:
 *                       type: string
 *                     applicationFeeFixed:
 *                       type: number
 *                       nullable: true
 *                     applicationFeePercentage:
 *                       type: number
 *                       nullable: true
 *     responses:
 *       200:
 *         description: The organisation's application fees after the update
 *       400:
 *         description: Invalid rates
 *       404:
 *         description: Organisation not found
 */
router.put(
  '/:id/application-fees',
  authenticateToken(),
  requireRole('super-admin'),
  audited({ action: 'settings.payment-updated', resource: 'organisation', entityType: 'organisation', label: 'name', kind: 'action' }),
  async (req: Request, res: Response) => {
    try {
      const { fees } = req.body;
      if (!Array.isArray(fees)) {
        res.status(400).json({ error: 'fees must be an array' });
        return;
      }
      if (fees.some((entry) => !entry || typeof entry.paymentMethodId !== 'string')) {
        res.status(400).json({ error: 'Every fee entry needs a paymentMethodId' });
        return;
      }

      const updated = await organizationApplicationFeeService.setForOrganisation(
        req.params.id,
        fees
      );
      if (!updated) {
        res.status(404).json({ error: 'Organisation not found' });
        return;
      }
      res.json(updated);
    } catch (error) {
      if (error instanceof ValidationError) {
        res.status(400).json({ error: error.message });
        return;
      }
      logger.error('Error in PUT /organizations/:id/application-fees:', error);
      res.status(500).json({ error: 'Failed to update application fees' });
    }
  }
);

/**
 * @swagger
 * /api/admin/organizations/{id}/application-fees/{paymentMethodId}/reset:
 *   post:
 *     summary: Copy the organisation type's current application fee onto this organisation
 *     description: >
 *       An explicit, per-organisation action. Organisations do not otherwise
 *       track their type after creation — see docs/ORGANISATION_APPLICATION_FEE.md.
 *     tags: [Organizations]
 *     responses:
 *       200:
 *         description: The organisation's application fees after the reset
 */
router.post(
  '/:id/application-fees/:paymentMethodId/reset',
  authenticateToken(),
  requireRole('super-admin'),
  audited({ action: 'settings.payment-updated', resource: 'organisation', entityType: 'organisation', label: 'name', kind: 'action' }),
  async (req: Request, res: Response) => {
    try {
      const updated = await organizationApplicationFeeService.resetToTypeDefault(
        req.params.id,
        req.params.paymentMethodId
      );
      if (!updated) {
        res.status(404).json({ error: 'Organisation not found' });
        return;
      }
      res.json(updated);
    } catch (error) {
      logger.error('Error in POST /organizations/:id/application-fees/:pm/reset:', error);
      res.status(500).json({ error: 'Failed to reset application fee' });
    }
  }
);

/**
 * @swagger
 * /api/admin/organizations/{id}/stats:
 *   get:
 *     summary: Get organization statistics
 *     tags: [Organizations]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Organization statistics
 */
router.get('/:id/stats', authenticateToken(), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const stats = await organizationService.getOrganizationStats(id);
    res.json(stats);
  } catch (error) {
    logger.error('Error in GET /organizations/:id/stats:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

/**
 * @swagger
 * /api/admin/organization-types/{typeId}/organizations:
 *   get:
 *     summary: Get organizations by type
 *     tags: [Organizations]
 *     parameters:
 *       - in: path
 *         name: typeId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of organizations in type
 */
router.get(
  '/by-type/:typeId',
  authenticateToken(),
  async (req: Request, res: Response) => {
    try {
      const { typeId } = req.params;
      
      // Verify type exists
      const type = await organizationTypeService.getOrganizationTypeById(typeId);
      if (!type) {
        return res.status(404).json({ error: 'Organization type not found' });
      }
      
      const organizations = await organizationService.getOrganizationsByType(typeId);
      return res.json(organizations);
    } catch (error) {
      logger.error('Error in GET /organizations/by-type/:typeId:', error);
      return res.status(500).json({ error: 'Failed to fetch organizations' });
    }
  }
);

export default router;
