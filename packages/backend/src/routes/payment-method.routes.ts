import { Router, Request, Response } from 'express';
import { paymentMethodService } from '../services/payment-method.service';
import { authenticateToken, requireRole } from '../middleware/auth.middleware';
import { logger } from '../config/logger';

const router = Router();

/**
 * @swagger
 * /api/admin/payment-methods:
 *   get:
 *     summary: Get all active payment methods
 *     tags: [Payment Methods]
 *     responses:
 *       200:
 *         description: List of active payment methods
 */
router.get('/', authenticateToken(), async (_req: Request, res: Response) => {
  try {
    const paymentMethods = await paymentMethodService.getAllPaymentMethods();
    res.json(paymentMethods);
  } catch (error) {
    logger.error('Error in GET /payment-methods:', error);
    res.status(500).json({ error: 'Failed to fetch payment methods' });
  }
});

/**
 * @swagger
 * /api/admin/payment-methods/{id}:
 *   get:
 *     summary: Get payment method by ID
 *     tags: [Payment Methods]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Payment method details
 *       404:
 *         description: Payment method not found
 */
router.get('/:id', authenticateToken(), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const paymentMethod = await paymentMethodService.getPaymentMethodById(id);
    
    if (!paymentMethod) {
      return res.status(404).json({ error: 'Payment method not found' });
    }
    
    return res.json(paymentMethod);
  } catch (error) {
    logger.error('Error in GET /payment-methods/:id:', error);
    return res.status(500).json({ error: 'Failed to fetch payment method' });
  }
});

/**
 * @swagger
 * /api/admin/payment-methods:
 *   post:
 *     summary: Create payment method (super admin only)
 *     tags: [Payment Methods]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - displayName
 *               - requiresActivation
 *             properties:
 *               name:
 *                 type: string
 *               displayName:
 *                 type: string
 *               description:
 *                 type: string
 *               requiresActivation:
 *                 type: boolean
 *     responses:
 *       201:
 *         description: Payment method created
 *       403:
 *         description: Forbidden - super admin only
 */
router.post(
  '/',
  authenticateToken(),
  requireRole('super-admin'),
  async (req: Request, res: Response) => {
    try {
      const paymentMethod = await paymentMethodService.createPaymentMethod(req.body);
      res.status(201).json(paymentMethod);
    } catch (error) {
      logger.error('Error in POST /payment-methods:', error);
      if (error instanceof Error && error.message.includes('already exists')) {
        res.status(409).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Failed to create payment method' });
      }
    }
  }
);

/**
 * @swagger
 * /api/admin/payment-methods/{id}:
 *   put:
 *     summary: Update payment method (super admin only)
 *     tags: [Payment Methods]
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
 *         description: Payment method updated
 *       404:
 *         description: Payment method not found
 */
router.put(
  '/:id',
  authenticateToken(),
  requireRole('super-admin'),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const paymentMethod = await paymentMethodService.updatePaymentMethod(id, req.body);
      res.json(paymentMethod);
    } catch (error) {
      logger.error('Error in PUT /payment-methods/:id:', error);
      if (error instanceof Error && error.message.includes('not found')) {
        res.status(404).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Failed to update payment method' });
      }
    }
  }
);

/**
 * @swagger
 * /api/admin/payment-methods/{id}:
 *   delete:
 *     summary: Deactivate payment method (super admin only)
 *     tags: [Payment Methods]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       204:
 *         description: Payment method deactivated
 */
router.delete(
  '/:id',
  authenticateToken(),
  requireRole('super-admin'),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      await paymentMethodService.deactivatePaymentMethod(id);
      res.status(204).send();
    } catch (error) {
      logger.error('Error in DELETE /payment-methods/:id:', error);
      if (error instanceof Error && error.message.includes('not found')) {
        res.status(404).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Failed to deactivate payment method' });
      }
    }
  }
);

export default router;
