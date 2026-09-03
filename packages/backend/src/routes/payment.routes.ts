import { Router, Request, Response } from 'express';
import { paymentService } from '../services/payment.service';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth.middleware';
import { byParam, byResource } from '../middleware/organisation-scope.middleware';
import { OrganisationRequest } from '../middleware/capability.middleware';
import { logger } from '../config/logger';
import { AppError } from '../middleware/errors';
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
 * /api/orgadmin/organisations/{organisationId}/refunds:
 *   get:
 *     summary: Every refund this organisation has made
 *     description: >
 *       Listed in its own right rather than found by opening payments one at a
 *       time. Each carries the payment it came out of, so a reader can go
 *       straight to it.
 *     tags: [Payments]
 *     responses:
 *       200:
 *         description: The refunds, most recent first
 */
router.get(
  '/refunds',
  authenticateToken(),
  // Scoped like the payments list beside it: the front end addresses this
  // router through `/organisations/:organisationId`, and the guard checks the
  // caller administers the club they named.
  byParam('organisationId'),
  async (req: OrganisationRequest, res: Response) => {
    try {
      return res.json(await paymentService.listRefunds(req.organisationId!));
    } catch (error) {
      logger.error('Error in GET /refunds:', error);
      return res.status(500).json({ error: 'Failed to fetch refunds' });
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

      /*
       * With what it bought.
       *
       * The payment row is a total; an administrator looking at €185 needs the
       * two entries, the membership and the shirt inside it — and a way into
       * each. Fetched here rather than behind a second endpoint because the
       * screen has no use for one without the other.
       *
       * Scoped by the payment's own organisation, which `byResource` has
       * already established as one the caller administers.
       */
      const [lines, refunds, settlement] = await Promise.all([
        paymentService.getPaymentLines(id, payment.organisationId),
        /*
         * What went back, and how an offline settlement got where it is. Both
         * belong to the same question the screen is answering — "what happened
         * to this payment" — and a second round trip for each would leave the
         * page rendering three times.
         */
        paymentService.getRefundsForPayment(id, payment.organisationId),
        paymentService.getSettlementHistory(id, payment.organisationId),
      ]);

      return res.json({ ...payment, lines, refunds, settlement });
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
      const { refundAmount, refundReason, scope, lineIds, removeEntries } = req.body;

      /*
       * Who is asking comes from the token, not the body.
       *
       * `refunds.requested_by` is the accountability record for money going
       * back, and a client-supplied one is a client-supplied answer to "who
       * authorised this". The screen had never sent it anyway, so every refund
       * from the interface was refused with a 400 — the button did nothing.
       */
      const requestedBy = (req as AuthenticatedRequest).user?.userId;

      /*
       * The payment's organisation, established by the guard above — not the
       * one in the body. They are the same in every honest request, and taking
       * the body's would let a caller refund another club's payment by naming
       * their own. The body field is now ignored rather than trusted.
       */
      const organisationId = req.organisationId!;

      if (!requestedBy) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      /*
       * Only an `amount` refund needs a figure from the caller; every other
       * scope is worked out from the payment. Kept as a guard here because an
       * amount-scoped request with no amount is a client bug worth naming, and
       * the service would otherwise refuse it less clearly.
       */
      if ((scope ?? 'amount') === 'amount' && !refundAmount) {
        return res.status(400).json({ error: 'refundAmount is required' });
      }

      const outcome = await paymentService.requestRefund({
        paymentId: id,
        organisationId,
        refundAmount,
        refundReason,
        requestedBy,
        scope,
        lineIds,
        removeEntries,
      });

      return res.status(201).json(outcome);
    } catch (error) {
      logger.error('Error in POST /payments/:id/refund:', error);
      if (error instanceof AppError) {
        return res.status(error.statusCode).json({ error: error.message });
      }
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
