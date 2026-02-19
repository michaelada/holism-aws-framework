import { Router, Request, Response } from 'express';
import { orgPaymentMethodDataService } from '../services/org-payment-method-data.service';
import { authenticateToken, requireRole } from '../middleware/auth.middleware';
import { logger } from '../config/logger';

const router = Router();

/**
 * @swagger
 * /api/admin/organizations/{orgId}/payment-methods:
 *   get:
 *     summary: Get organization payment methods
 *     tags: [Organizations, Payment Methods]
 *     parameters:
 *       - in: path
 *         name: orgId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of organization payment methods
 */
router.get(
  '/:orgId/payment-methods',
  authenticateToken(),
  async (req: Request, res: Response) => {
    try {
      const { orgId } = req.params;
      const paymentMethods = await orgPaymentMethodDataService.getOrgPaymentMethods(orgId);
      res.json(paymentMethods);
    } catch (error) {
      logger.error('Error in GET /organizations/:orgId/payment-methods:', error);
      res.status(500).json({ error: 'Failed to fetch organization payment methods' });
    }
  }
);

/**
 * @swagger
 * /api/admin/organizations/{orgId}/payment-methods:
 *   post:
 *     summary: Add payment method to organization
 *     tags: [Organizations, Payment Methods]
 *     parameters:
 *       - in: path
 *         name: orgId
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
 *               - paymentMethodId
 *             properties:
 *               paymentMethodId:
 *                 type: string
 *               status:
 *                 type: string
 *                 enum: [inactive, active]
 *               paymentData:
 *                 type: object
 *     responses:
 *       201:
 *         description: Payment method added to organization
 */
router.post(
  '/:orgId/payment-methods',
  authenticateToken(),
  requireRole('super-admin'),
  async (req: Request, res: Response) => {
    try {
      const { orgId } = req.params;
      const { paymentMethodId, status, paymentData } = req.body;
      
      const orgPaymentMethod = await orgPaymentMethodDataService.createOrgPaymentMethod({
        organizationId: orgId,
        paymentMethodId,
        status,
        paymentData
      });
      
      res.status(201).json(orgPaymentMethod);
    } catch (error) {
      logger.error('Error in POST /organizations/:orgId/payment-methods:', error);
      if (error instanceof Error && error.message.includes('already associated')) {
        res.status(409).json({ error: error.message });
      } else if (error instanceof Error && error.message.includes('foreign key')) {
        res.status(400).json({ error: 'Invalid organization or payment method ID' });
      } else {
        res.status(500).json({ error: 'Failed to add payment method to organization' });
      }
    }
  }
);

/**
 * @swagger
 * /api/admin/organizations/{orgId}/payment-methods/{methodId}:
 *   put:
 *     summary: Update organization payment method
 *     tags: [Organizations, Payment Methods]
 *     parameters:
 *       - in: path
 *         name: orgId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: methodId
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
 *         description: Organization payment method updated
 *       404:
 *         description: Payment method association not found
 */
router.put(
  '/:orgId/payment-methods/:methodId',
  authenticateToken(),
  requireRole('super-admin'),
  async (req: Request, res: Response) => {
    try {
      const { orgId, methodId } = req.params;
      const orgPaymentMethod = await orgPaymentMethodDataService.updateOrgPaymentMethod(
        orgId,
        methodId,
        req.body
      );
      res.json(orgPaymentMethod);
    } catch (error) {
      logger.error('Error in PUT /organizations/:orgId/payment-methods/:methodId:', error);
      if (error instanceof Error && error.message.includes('not found')) {
        res.status(404).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Failed to update organization payment method' });
      }
    }
  }
);

/**
 * @swagger
 * /api/admin/organizations/{orgId}/payment-methods/{methodId}:
 *   delete:
 *     summary: Remove payment method from organization
 *     tags: [Organizations, Payment Methods]
 *     parameters:
 *       - in: path
 *         name: orgId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: methodId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       204:
 *         description: Payment method removed from organization
 */
router.delete(
  '/:orgId/payment-methods/:methodId',
  authenticateToken(),
  requireRole('super-admin'),
  async (req: Request, res: Response) => {
    try {
      const { orgId, methodId } = req.params;
      await orgPaymentMethodDataService.deleteOrgPaymentMethod(orgId, methodId);
      res.status(204).send();
    } catch (error) {
      logger.error('Error in DELETE /organizations/:orgId/payment-methods/:methodId:', error);
      if (error instanceof Error && error.message.includes('not found')) {
        res.status(404).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Failed to remove payment method from organization' });
      }
    }
  }
);

export default router;
