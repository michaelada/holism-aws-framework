import { Router, Request, Response } from 'express';
import { organizationTypeService } from '../services/organization-type.service';
import { authenticateToken, requireRole } from '../middleware/auth.middleware';
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
 *               defaultCapabilities:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       201:
 *         description: Organization type created
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
      res.status(500).json({ error: 'Failed to create organization type' });
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
 *     responses:
 *       200:
 *         description: Organization type updated
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
      res.status(500).json({ error: 'Failed to update organization type' });
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

export default router;
