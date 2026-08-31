import { Router, Request, Response } from 'express';
import { paymentService } from '../services/payment.service';
import { authenticateToken } from '../middleware/auth.middleware';
import { byParam, byResource } from '../middleware/organisation-scope.middleware';
import { OrganisationRequest } from '../middleware/capability.middleware';
import { logger } from '../config/logger';
import { audited } from '../middleware/audit.middleware';

/*
 * `mergeParams` so this router can be mounted twice: at `/api/orgadmin` and at
 * `/api/orgadmin/organisations/:organisationId`. Without it the parent's
 * `:organisationId` is invisible here, and the guards would see a request that
 * names no organisation at all.
 */
const router = Router({ mergeParams: true });

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
  byParam('organisationId'),
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
  // The payment's own organisation, not the caller's: this route names a
  // payment and nothing else, and had no organisation check at all.
  byResource('payment', 'id'),
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
  /*
   * Scoped by the payment, deliberately — **not** by the `organisationId` in
   * the body, which the handler goes on to use. A caller supplying both could
   * otherwise refund another club's payment by naming their own organisation,
   * and money would move.
   */
  byResource('payment', 'id'),
  audited({ action: 'refund.issued', resource: 'payment', entityType: 'payment', kind: 'action' }),
  async (req: OrganisationRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { refundAmount, refundReason, requestedBy } = req.body;

      /*
       * The payment's organisation, established by the guard above — not the
       * one in the body. They are the same in every honest request, and taking
       * the body's would let a caller refund another club's payment by naming
       * their own. The body field is now ignored rather than trusted.
       */
      const organisationId = req.organisationId!;

      if (!refundAmount || !requestedBy) {
        return res.status(400).json({ 
          error: 'refundAmount and requestedBy are required' 
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
  byParam('organisationId'),
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

export default router;
