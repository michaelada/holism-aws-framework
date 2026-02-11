import { Router, Request, Response } from 'express';
import { organizationService } from '../services/organization.service';
import { organizationTypeService } from '../services/organization-type.service';
import { authenticateToken, requireRole } from '../middleware/auth.middleware';
import { logger } from '../config/logger';

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
 *     summary: Delete organization (super admin only)
 *     tags: [Organizations]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       204:
 *         description: Organization deleted
 *       400:
 *         description: Cannot delete organization with existing users
 */
router.delete(
  '/:id',
  authenticateToken(),
  requireRole('super-admin'),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      await organizationService.deleteOrganization(id);
      res.status(204).send();
    } catch (error) {
      logger.error('Error in DELETE /organizations/:id:', error);
      if (error instanceof Error && error.message.includes('existing users')) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Failed to delete organization' });
      }
    }
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
