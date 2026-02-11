import { Router, Request, Response } from 'express';
import { capabilityService } from '../services/capability.service';
import { authenticateToken, requireRole } from '../middleware/auth.middleware';
import { logger } from '../config/logger';

const router = Router();

/**
 * @swagger
 * /api/admin/capabilities:
 *   get:
 *     summary: Get all capabilities
 *     tags: [Capabilities]
 *     parameters:
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *           enum: [core-service, additional-feature]
 *         description: Filter by category
 *     responses:
 *       200:
 *         description: List of capabilities
 */
router.get('/', authenticateToken(), async (req: Request, res: Response) => {
  try {
    const { category } = req.query;
    const capabilities = await capabilityService.getAllCapabilities(
      category as any
    );
    res.json(capabilities);
  } catch (error) {
    logger.error('Error in GET /capabilities:', error);
    res.status(500).json({ error: 'Failed to fetch capabilities' });
  }
});

/**
 * @swagger
 * /api/admin/capabilities/{id}:
 *   get:
 *     summary: Get capability by ID
 *     tags: [Capabilities]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Capability details
 *       404:
 *         description: Capability not found
 */
router.get('/:id', authenticateToken(), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const capability = await capabilityService.getCapabilityById(id);
    
    if (!capability) {
      return res.status(404).json({ error: 'Capability not found' });
    }
    
    return res.json(capability);
  } catch (error) {
    logger.error('Error in GET /capabilities/:id:', error);
    return res.status(500).json({ error: 'Failed to fetch capability' });
  }
});

/**
 * @swagger
 * /api/admin/capabilities:
 *   post:
 *     summary: Create capability (super admin only)
 *     tags: [Capabilities]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - displayName
 *               - category
 *             properties:
 *               name:
 *                 type: string
 *               displayName:
 *                 type: string
 *               description:
 *                 type: string
 *               category:
 *                 type: string
 *                 enum: [core-service, additional-feature]
 *     responses:
 *       201:
 *         description: Capability created
 *       403:
 *         description: Forbidden - super admin only
 */
router.post(
  '/',
  authenticateToken(),
  requireRole('super-admin'),
  async (req: Request, res: Response) => {
    try {
      const capability = await capabilityService.createCapability(req.body);
      res.status(201).json(capability);
    } catch (error) {
      logger.error('Error in POST /capabilities:', error);
      res.status(500).json({ error: 'Failed to create capability' });
    }
  }
);

/**
 * @swagger
 * /api/admin/capabilities/{id}:
 *   put:
 *     summary: Update capability (super admin only)
 *     tags: [Capabilities]
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
 *         description: Capability updated
 *       404:
 *         description: Capability not found
 */
router.put(
  '/:id',
  authenticateToken(),
  requireRole('super-admin'),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const capability = await capabilityService.updateCapability(id, req.body);
      res.json(capability);
    } catch (error) {
      logger.error('Error in PUT /capabilities/:id:', error);
      res.status(500).json({ error: 'Failed to update capability' });
    }
  }
);

/**
 * @swagger
 * /api/admin/capabilities/{id}:
 *   delete:
 *     summary: Deactivate capability (super admin only)
 *     tags: [Capabilities]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       204:
 *         description: Capability deactivated
 */
router.delete(
  '/:id',
  authenticateToken(),
  requireRole('super-admin'),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      await capabilityService.deactivateCapability(id);
      res.status(204).send();
    } catch (error) {
      logger.error('Error in DELETE /capabilities/:id:', error);
      res.status(500).json({ error: 'Failed to deactivate capability' });
    }
  }
);

export default router;
