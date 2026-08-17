import { Router, Request, Response } from 'express';
import { organizationTypeService } from '../services/organization-type.service';
import { organizationTypePaymentFeeService } from '../services/organization-type-payment-fee.service';
import { authenticateToken, requireRole } from '../middleware/auth.middleware';
import { ValidationError } from '../middleware/errors';
import { logger } from '../config/logger';

const router = Router();

/**
 * @swagger
 * /api/admin/organization-types:
 *   get:
 *     summary: Get all organization types
 *     tags: [Organization Types]
 *     responses:
 *       200:
 *         description: List of organization types
 */
router.get('/', authenticateToken(), async (_req: Request, res: Response) => {
  try {
    const types = await organizationTypeService.getAllOrganizationTypes();
    
    // Add organization count for each type
    const typesWithCounts = await Promise.all(
      types.map(async (type) => ({
        ...type,
        organizationCount: await organizationTypeService.getOrganizationCount(type.id)
      }))
    );
    
    return res.json(typesWithCounts);
  } catch (error) {
    logger.error('Error in GET /organization-types:', error);
    return res.status(500).json({ error: 'Failed to fetch organization types' });
  }
});

/**
 * @swagger
 * /api/admin/organization-types/{id}:
 *   get:
 *     summary: Get organization type by ID
 *     tags: [Organization Types]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Organization type details
 *       404:
 *         description: Organization type not found
 */
router.get('/:id', authenticateToken(), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const type = await organizationTypeService.getOrganizationTypeById(id);
    
    if (!type) {
      return res.status(404).json({ error: 'Organization type not found' });
    }
    
    // Add organization count
    const organizationCount = await organizationTypeService.getOrganizationCount(id);
    
    return res.json({
      ...type,
      organizationCount
    });
  } catch (error) {
    logger.error('Error in GET /organization-types/:id:', error);
    return res.status(500).json({ error: 'Failed to fetch organization type' });
  }
});

/**
 * @swagger
 * /api/admin/organization-types:
 *   post:
 *     summary: Create organization type (super admin only)
 *     tags: [Organization Types]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - displayName
 *               - currency
 *               - language
 *             properties:
 *               name:
 *                 type: string
 *               displayName:
 *                 type: string
 *               description:
 *                 type: string
 *               currency:
 *                 type: string
 *               language:
 *                 type: string
 *               defaultLocale:
 *                 type: string
 *                 description: Default locale for organizations of this type (e.g., en-GB, fr-FR)
 *                 default: en-GB
 *               defaultCapabilities:
 *                 type: array
 *                 items:
 *                   type: string
 *               membershipNumbering:
 *                 type: string
 *                 enum: [internal, external]
 *                 description: Controls whether membership numbers are system-generated (internal) or user-provided (external)
 *                 default: internal
 *               membershipNumberUniqueness:
 *                 type: string
 *                 enum: [organization_type, organization]
 *                 description: Uniqueness scope for membership numbers (only applicable for internal mode)
 *                 default: organization
 *               initialMembershipNumber:
 *                 type: integer
 *                 description: Starting number for internal sequential generation (only applicable for internal mode)
 *                 default: 1000000
 *                 minimum: 1
 *     responses:
 *       201:
 *         description: Organization type created
 *       400:
 *         description: Invalid locale format, unsupported locale, or invalid membership numbering configuration
 */
router.post(
  '/',
  authenticateToken(),
  requireRole('super-admin'),
  async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.sub;
      const type = await organizationTypeService.createOrganizationType(
        req.body,
        userId
      );
      res.status(201).json(type);
    } catch (error) {
      logger.error('Error in POST /organization-types:', error);
      /*
       * A refusal, not a fault. Checked by type before the substring tests
       * below, which are the older style: a validation failure that falls
       * through to the 500 branch tells the administrator only that something
       * broke, and leaves the message — which names what was wrong — unread.
       */
      if (error instanceof ValidationError) {
        res.status(400).json({ error: error.message });
      } else if (error instanceof Error && (
        error.message.includes('locale') ||
        error.message.includes('Membership number') ||
        error.message.includes('Initial membership number')
      )) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Failed to create organization type' });
      }
    }
  }
);

/**
 * @swagger
 * /api/admin/organization-types/{id}:
 *   put:
 *     summary: Update organization type (super admin only)
 *     tags: [Organization Types]
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
 *             properties:
 *               displayName:
 *                 type: string
 *               description:
 *                 type: string
 *               currency:
 *                 type: string
 *               language:
 *                 type: string
 *               defaultLocale:
 *                 type: string
 *                 description: Default locale for organizations of this type (e.g., en-GB, fr-FR)
 *               defaultCapabilities:
 *                 type: array
 *                 items:
 *                   type: string
 *               membershipNumbering:
 *                 type: string
 *                 enum: [internal, external]
 *                 description: Controls whether membership numbers are system-generated (internal) or user-provided (external)
 *               membershipNumberUniqueness:
 *                 type: string
 *                 enum: [organization_type, organization]
 *                 description: Uniqueness scope for membership numbers (only applicable for internal mode)
 *               initialMembershipNumber:
 *                 type: integer
 *                 description: Starting number for internal sequential generation (only applicable for internal mode)
 *                 minimum: 1
 *     responses:
 *       200:
 *         description: Organization type updated
 *       400:
 *         description: Invalid locale format, unsupported locale, invalid membership numbering configuration, or cannot change configuration with existing members
 *       404:
 *         description: Organization type not found
 */
router.put(
  '/:id',
  authenticateToken(),
  requireRole('super-admin'),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const userId = (req as any).user?.sub;
      const type = await organizationTypeService.updateOrganizationType(
        id,
        req.body,
        userId
      );
      res.json(type);
    } catch (error) {
      logger.error('Error in PUT /organization-types/:id:', error);
      /*
       * A refusal, not a fault. Checked by type before the substring tests
       * below, which are the older style: a validation failure that falls
       * through to the 500 branch tells the administrator only that something
       * broke, and leaves the message — which names what was wrong — unread.
       */
      if (error instanceof ValidationError) {
        res.status(400).json({ error: error.message });
      } else if (error instanceof Error && (
        error.message.includes('locale') ||
        error.message.includes('Membership number') ||
        error.message.includes('Initial membership number') ||
        error.message.includes('Cannot change') ||
        error.message.includes('duplicate membership numbers')
      )) {
        res.status(400).json({ error: error.message });
      } else if (error instanceof Error && error.message.includes('not found')) {
        res.status(404).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Failed to update organization type' });
      }
    }
  }
);

/**
 * @swagger
 * /api/admin/organization-types/{id}:
 *   delete:
 *     summary: Delete organization type (super admin only)
 *     tags: [Organization Types]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       204:
 *         description: Organization type deleted
 *       400:
 *         description: Cannot delete type with existing organizations
 */
router.delete(
  '/:id',
  authenticateToken(),
  requireRole('super-admin'),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      await organizationTypeService.deleteOrganizationType(id);
      res.status(204).send();
    } catch (error) {
      logger.error('Error in DELETE /organization-types/:id:', error);
      if (error instanceof Error && error.message.includes('existing organizations')) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Failed to delete organization type' });
      }
    }
  }
);

/**
 * @swagger
 * /api/admin/organization-types/payment-fees/defaults:
 *   get:
 *     summary: Platform default handling fees for each card payment method
 *     description: >
 *       Used to pre-fill the create-organisation-type form. Declared before
 *       /:id/payment-fees so "payment-fees" is not captured as an :id.
 *     tags: [Organization Types]
 *     responses:
 *       200:
 *         description: Default rates per card payment method
 */
router.get(
  '/payment-fees/defaults',
  authenticateToken(),
  async (_req: Request, res: Response) => {
    try {
      const defaults = await organizationTypePaymentFeeService.getCardMethodDefaults();
      return res.json(defaults);
    } catch (error) {
      logger.error('Error in GET /organization-types/payment-fees/defaults:', error);
      return res.status(500).json({ error: 'Failed to fetch default handling fees' });
    }
  }
);

/**
 * @swagger
 * /api/admin/organization-types/{id}/payment-fees:
 *   get:
 *     summary: Card handling fees for an organization type
 *     description: >
 *       Returns a row per active card payment method. Methods with no rates set
 *       fall back to the platform defaults, so the caller always receives a
 *       complete set. Also reports how many organisations inherit these rates.
 *     tags: [Organization Types]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Handling fees and the number of affected organisations
 */
router.get(
  '/:id/payment-fees',
  authenticateToken(),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const [fees, organisationCount] = await Promise.all([
        organizationTypePaymentFeeService.getFeesForOrganizationType(id),
        organizationTypePaymentFeeService.countOrganisationsOfType(id),
      ]);
      return res.json({ fees, organisationCount });
    } catch (error) {
      logger.error('Error in GET /organization-types/:id/payment-fees:', error);
      return res.status(500).json({ error: 'Failed to fetch handling fees' });
    }
  }
);

/**
 * @swagger
 * /api/admin/organization-types/{id}/payment-fees:
 *   put:
 *     summary: Set card handling fees for an organization type
 *     description: >
 *       Every organisation of this type charges the new rates from the moment
 *       this succeeds. Payments already taken are unaffected.
 *     tags: [Organization Types]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Updated handling fees
 *       400:
 *         description: Invalid rates
 */
router.put(
  '/:id/payment-fees',
  authenticateToken(),
  requireRole('super-admin'),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { fees } = req.body;

      if (!Array.isArray(fees)) {
        return res.status(400).json({ error: 'fees must be an array' });
      }

      const updated = await organizationTypePaymentFeeService.setFees(id, fees);
      return res.json({ fees: updated });
    } catch (error) {
      logger.error('Error in PUT /organization-types/:id/payment-fees:', error);
      if (error instanceof ValidationError) {
        return res.status(400).json({ error: error.message });
      }
      return res.status(500).json({ error: 'Failed to update handling fees' });
    }
  }
);

export default router;
