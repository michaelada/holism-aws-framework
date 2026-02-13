import { Router, Request, Response } from 'express';
import { paymentService } from '../services/payment.service';
import { authenticateToken } from '../middleware/auth.middleware';
import { logger } from '../config/logger';

const router = Router();

/**
 * @swagger
 * /api/orgadmin/organisations/{organisationId}/payments:
 *   get:
 *     summary: Get all payments for an organisation
 *     tags: [Payments]
 *     parameters:
 *       - in: path
 *         name: organisationId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: paymentStatus
 *         schema:
 *           type: array
 *           items:
 *             type: string
 *         description: Filter by payment status
 *       - in: query
 *         name: paymentMethod
 *         schema:
 *           type: array
 *           items:
 *             type: string
 *         description: Filter by payment method
 *       - in: query
 *         name: paymentType
 *         schema:
 *           type: array
 *           items:
 *             type: string
 *         description: Filter by payment type
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter by start date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter by end date
 *       - in: query
 *         name: searchTerm
 *         schema:
 *           type: string
 *         description: Search by user name, email, or transaction ID
 *     responses:
 *       200:
 *         description: List of payments
 */
router.get(
  '/organisations/:organisationId/payments',
  authenticateToken(),
  async (req: Request, res: Response) => {
    try {
      const { organisationId } = req.params;
      const { 
        paymentStatus, 
        paymentMethod, 
        paymentType, 
        startDate, 
        endDate, 
        searchTerm 
      } = req.query;

      // Build filters
      const filters: any = {};
      
      if (paymentStatus) {
        filters.paymentStatus = Array.isArray(paymentStatus) 
          ? paymentStatus 
          : [paymentStatus];
      }
      
      if (paymentMethod) {
        filters.paymentMethod = Array.isArray(paymentMethod) 
          ? paymentMethod 
          : [paymentMethod];
      }
      
      if (paymentType) {
        filters.paymentType = Array.isArray(paymentType) 
          ? paymentType 
          : [paymentType];
      }
      
      if (startDate) {
        filters.startDate = new Date(startDate as string);
      }
      
      if (endDate) {
        filters.endDate = new Date(endDate as string);
      }
      
      if (searchTerm) {
        filters.searchTerm = searchTerm as string;
      }

      const payments = await paymentService.getPaymentsByOrganisation(
        organisationId,
        filters
      );
      
      res.json(payments);
    } catch (error) {
      logger.error('Error in GET /organisations/:organisationId/payments:', error);
      res.status(500).json({ error: 'Failed to fetch payments' });
    }
  }
);

/**
 * @swagger
 * /api/orgadmin/payments/{id}:
 *   get:
 *     summary: Get payment by ID
 *     tags: [Payments]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Payment details
 *       404:
 *         description: Payment not found
 */
router.get(
  '/payments/:id',
  authenticateToken(),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const payment = await paymentService.getPaymentById(id);
      
      if (!payment) {
        return res.status(404).json({ error: 'Payment not found' });
      }
      
      return res.json(payment);
    } catch (error) {
      logger.error('Error in GET /payments/:id:', error);
      return res.status(500).json({ error: 'Failed to fetch payment' });
    }
  }
);

/**
 * @swagger
 * /api/orgadmin/payments/{id}/refund:
 *   post:
 *     summary: Request a refund for a payment
 *     tags: [Payments]
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
 *               - organisationId
 *               - refundAmount
 *               - requestedBy
 *             properties:
 *               organisationId:
 *                 type: string
 *               refundAmount:
 *                 type: number
 *               refundReason:
 *                 type: string
 *               requestedBy:
 *                 type: string
 *     responses:
 *       201:
 *         description: Refund requested
 *       400:
 *         description: Invalid request
 *       404:
 *         description: Payment not found
 */
router.post(
  '/payments/:id/refund',
  authenticateToken(),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { organisationId, refundAmount, refundReason, requestedBy } = req.body;

      // Validate required fields
      if (!organisationId || !refundAmount || !requestedBy) {
        return res.status(400).json({ 
          error: 'organisationId, refundAmount, and requestedBy are required' 
        });
      }

      const refund = await paymentService.requestRefund({
        paymentId: id,
        organisationId,
        refundAmount,
        refundReason,
        requestedBy,
      });

      return res.status(201).json(refund);
    } catch (error) {
      logger.error('Error in POST /payments/:id/refund:', error);
      if (error instanceof Error) {
        return res.status(400).json({ error: error.message });
      }
      return res.status(500).json({ error: 'Failed to request refund' });
    }
  }
);

/**
 * @swagger
 * /api/orgadmin/organisations/{organisationId}/payments/export:
 *   get:
 *     summary: Export payments to Excel
 *     tags: [Payments]
 *     parameters:
 *       - in: path
 *         name: organisationId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: paymentStatus
 *         schema:
 *           type: array
 *           items:
 *             type: string
 *         description: Filter by payment status
 *       - in: query
 *         name: paymentMethod
 *         schema:
 *           type: array
 *           items:
 *             type: string
 *         description: Filter by payment method
 *       - in: query
 *         name: paymentType
 *         schema:
 *           type: array
 *           items:
 *             type: string
 *         description: Filter by payment type
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter by start date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter by end date
 *       - in: query
 *         name: searchTerm
 *         schema:
 *           type: string
 *         description: Search by user name, email, or transaction ID
 *     responses:
 *       200:
 *         description: Excel file
 *         content:
 *           application/vnd.openxmlformats-officedocument.spreadsheetml.sheet:
 *             schema:
 *               type: string
 *               format: binary
 */
router.get(
  '/organisations/:organisationId/payments/export',
  authenticateToken(),
  async (req: Request, res: Response) => {
    try {
      const { organisationId } = req.params;
      const { 
        paymentStatus, 
        paymentMethod, 
        paymentType, 
        startDate, 
        endDate, 
        searchTerm 
      } = req.query;

      // Build filters
      const filters: any = {};
      
      if (paymentStatus) {
        filters.paymentStatus = Array.isArray(paymentStatus) 
          ? paymentStatus 
          : [paymentStatus];
      }
      
      if (paymentMethod) {
        filters.paymentMethod = Array.isArray(paymentMethod) 
          ? paymentMethod 
          : [paymentMethod];
      }
      
      if (paymentType) {
        filters.paymentType = Array.isArray(paymentType) 
          ? paymentType 
          : [paymentType];
      }
      
      if (startDate) {
        filters.startDate = new Date(startDate as string);
      }
      
      if (endDate) {
        filters.endDate = new Date(endDate as string);
      }
      
      if (searchTerm) {
        filters.searchTerm = searchTerm as string;
      }

      const buffer = await paymentService.exportPayments(organisationId, filters);
      
      // Set headers for file download
      const filename = `payments_${organisationId}_${new Date().toISOString().split('T')[0]}.xlsx`;
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      
      return res.send(buffer);
    } catch (error) {
      logger.error('Error in GET /organisations/:organisationId/payments/export:', error);
      return res.status(500).json({ error: 'Failed to export payments' });
    }
  }
);

/**
 * @swagger
 * /api/orgadmin/organisations/{organisationId}/lodgements:
 *   get:
 *     summary: Get lodgements (payment summaries) for an organisation
 *     tags: [Payments]
 *     parameters:
 *       - in: path
 *         name: organisationId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter by start date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter by end date
 *     responses:
 *       200:
 *         description: List of lodgements
 */
router.get(
  '/organisations/:organisationId/lodgements',
  authenticateToken(),
  async (req: Request, res: Response) => {
    try {
      const { organisationId } = req.params;
      const { startDate, endDate } = req.query;

      const lodgements = await paymentService.getLodgementsByOrganisation(
        organisationId,
        startDate ? new Date(startDate as string) : undefined,
        endDate ? new Date(endDate as string) : undefined
      );
      
      res.json(lodgements);
    } catch (error) {
      logger.error('Error in GET /organisations/:organisationId/lodgements:', error);
      res.status(500).json({ error: 'Failed to fetch lodgements' });
    }
  }
);

export default router;
