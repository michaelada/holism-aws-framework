import { Router, Request, Response } from 'express';
import { ticketingService } from '../services/ticketing.service';
import { authenticateToken } from '../middleware/auth.middleware';
import { logger } from '../config/logger';
import { db } from '../database/pool';

const router = Router();

/**
 * Middleware to check if organisation has event-ticketing capability
 */
async function requireEventTicketingCapability(
  req: Request,
  res: Response,
  next: Function
): Promise<void> {
  try {
    const organisationId = req.params.organisationId || req.body.organisationId;
    
    if (!organisationId) {
      res.status(400).json({ error: 'Organisation ID is required' });
      return;
    }

    // Check if organisation has event-ticketing capability
    const result = await db.query(
      `SELECT enabled_capabilities FROM organizations WHERE id = $1`,
      [organisationId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Organisation not found' });
      return;
    }

    const enabledCapabilities = result.rows[0].enabled_capabilities || [];
    
    if (!enabledCapabilities.includes('event-ticketing')) {
      res.status(403).json({ 
        error: 'Organisation does not have event-ticketing capability enabled' 
      });
      return;
    }

    next();
  } catch (error) {
    logger.error('Error checking event-ticketing capability:', error);
    res.status(500).json({ error: 'Failed to verify capability' });
  }
}

/**
 * @swagger
 * /api/orgadmin/organisations/{organisationId}/ticketed-events:
 *   get:
 *     summary: Get all ticketed events for an organisation
 *     tags: [Ticketing]
 *     parameters:
 *       - in: path
 *         name: organisationId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of ticketed events
 */
router.get(
  '/organisations/:organisationId/ticketed-events',
  authenticateToken(),
  requireEventTicketingCapability,
  async (req: Request, res: Response) => {
    try {
      const { organisationId } = req.params;
      const ticketedEvents = await ticketingService.getTicketedEventsByOrganisation(organisationId);
      res.json(ticketedEvents);
    } catch (error) {
      logger.error('Error in GET /ticketed-events:', error);
      res.status(500).json({ error: 'Failed to fetch ticketed events' });
    }
  }
);

/**
 * @swagger
 * /api/orgadmin/events/{eventId}/ticketing-config:
 *   get:
 *     summary: Get ticketing configuration for an event
 *     tags: [Ticketing]
 *     parameters:
 *       - in: path
 *         name: eventId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Ticketing configuration
 *       404:
 *         description: Configuration not found
 */
router.get(
  '/events/:eventId/ticketing-config',
  authenticateToken(),
  async (req: Request, res: Response) => {
    try {
      const { eventId } = req.params;
      const config = await ticketingService.getTicketingConfigByEvent(eventId);
      
      if (!config) {
        return res.status(404).json({ error: 'Ticketing configuration not found' });
      }
      
      return res.json(config);
    } catch (error) {
      logger.error('Error in GET /events/:eventId/ticketing-config:', error);
      return res.status(500).json({ error: 'Failed to fetch ticketing configuration' });
    }
  }
);

/**
 * @swagger
 * /api/orgadmin/events/{eventId}/ticketing-config:
 *   post:
 *     summary: Create ticketing configuration for an event
 *     tags: [Ticketing]
 *     parameters:
 *       - in: path
 *         name: eventId
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
 *       201:
 *         description: Ticketing configuration created
 */
router.post(
  '/events/:eventId/ticketing-config',
  authenticateToken(),
  async (req: Request, res: Response) => {
    try {
      const { eventId } = req.params;
      const configData = { ...req.body, eventId };
      const config = await ticketingService.createTicketedEvent(configData);
      res.status(201).json(config);
    } catch (error) {
      logger.error('Error in POST /events/:eventId/ticketing-config:', error);
      if (error instanceof Error) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Failed to create ticketing configuration' });
      }
    }
  }
);

/**
 * @swagger
 * /api/orgadmin/events/{eventId}/ticketing-config:
 *   put:
 *     summary: Update ticketing configuration for an event
 *     tags: [Ticketing]
 *     parameters:
 *       - in: path
 *         name: eventId
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
 *         description: Ticketing configuration updated
 *       404:
 *         description: Configuration not found
 */
router.put(
  '/events/:eventId/ticketing-config',
  authenticateToken(),
  async (req: Request, res: Response) => {
    try {
      const { eventId } = req.params;
      const config = await ticketingService.updateTicketedEvent(eventId, req.body);
      res.json(config);
    } catch (error) {
      logger.error('Error in PUT /events/:eventId/ticketing-config:', error);
      if (error instanceof Error) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Failed to update ticketing configuration' });
      }
    }
  }
);

/**
 * @swagger
 * /api/orgadmin/events/{eventId}/ticketing-config:
 *   delete:
 *     summary: Delete ticketing configuration for an event
 *     tags: [Ticketing]
 *     parameters:
 *       - in: path
 *         name: eventId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       204:
 *         description: Ticketing configuration deleted
 *       404:
 *         description: Configuration not found
 */
router.delete(
  '/events/:eventId/ticketing-config',
  authenticateToken(),
  async (req: Request, res: Response) => {
    try {
      const { eventId } = req.params;
      await ticketingService.deleteTicketedEvent(eventId);
      res.status(204).send();
    } catch (error) {
      logger.error('Error in DELETE /events/:eventId/ticketing-config:', error);
      if (error instanceof Error && error.message.includes('not found')) {
        res.status(404).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Failed to delete ticketing configuration' });
      }
    }
  }
);

/**
 * @swagger
 * /api/orgadmin/events/{eventId}/ticket-sales:
 *   get:
 *     summary: Get ticket sales summary for an event
 *     tags: [Ticketing]
 *     parameters:
 *       - in: path
 *         name: eventId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Ticket sales summary
 */
router.get(
  '/events/:eventId/ticket-sales',
  authenticateToken(),
  async (req: Request, res: Response) => {
    try {
      const { eventId } = req.params;
      const sales = await ticketingService.getTicketSalesByEvent(eventId);
      res.json(sales);
    } catch (error) {
      logger.error('Error in GET /events/:eventId/ticket-sales:', error);
      if (error instanceof Error && error.message.includes('not found')) {
        res.status(404).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Failed to fetch ticket sales' });
      }
    }
  }
);

/**
 * @swagger
 * /api/orgadmin/tickets/{ticketId}:
 *   get:
 *     summary: Get ticket by ID
 *     tags: [Ticketing]
 *     parameters:
 *       - in: path
 *         name: ticketId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Ticket details
 *       404:
 *         description: Ticket not found
 */
router.get(
  '/tickets/:ticketId',
  authenticateToken(),
  async (req: Request, res: Response) => {
    try {
      const { ticketId } = req.params;
      const ticket = await ticketingService.getTicketById(ticketId);
      
      if (!ticket) {
        return res.status(404).json({ error: 'Ticket not found' });
      }
      
      return res.json(ticket);
    } catch (error) {
      logger.error('Error in GET /tickets/:ticketId:', error);
      return res.status(500).json({ error: 'Failed to fetch ticket' });
    }
  }
);

/**
 * @swagger
 * /api/orgadmin/tickets/qr/{qrCode}:
 *   get:
 *     summary: Get ticket by QR code
 *     tags: [Ticketing]
 *     parameters:
 *       - in: path
 *         name: qrCode
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Ticket details
 *       404:
 *         description: Ticket not found
 */
router.get(
  '/tickets/qr/:qrCode',
  authenticateToken(),
  async (req: Request, res: Response) => {
    try {
      const { qrCode } = req.params;
      const ticket = await ticketingService.getTicketByQRCode(qrCode);
      
      if (!ticket) {
        return res.status(404).json({ error: 'Ticket not found' });
      }
      
      return res.json(ticket);
    } catch (error) {
      logger.error('Error in GET /tickets/qr/:qrCode:', error);
      return res.status(500).json({ error: 'Failed to fetch ticket' });
    }
  }
);

/**
 * @swagger
 * /api/orgadmin/tickets/{ticketId}/scan-status:
 *   put:
 *     summary: Update ticket scan status
 *     tags: [Ticketing]
 *     parameters:
 *       - in: path
 *         name: ticketId
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
 *               scanStatus:
 *                 type: string
 *                 enum: [scanned, not_scanned]
 *               scanLocation:
 *                 type: string
 *               scannedBy:
 *                 type: string
 *     responses:
 *       200:
 *         description: Ticket scan status updated
 *       404:
 *         description: Ticket not found
 */
router.put(
  '/tickets/:ticketId/scan-status',
  authenticateToken(),
  async (req: Request, res: Response) => {
    try {
      const { ticketId } = req.params;
      const { scanStatus, scanLocation, scannedBy } = req.body;
      
      if (!scanStatus || !['scanned', 'not_scanned'].includes(scanStatus)) {
        return res.status(400).json({ error: 'Invalid scan status' });
      }
      
      const ticket = await ticketingService.updateTicketScanStatus(
        ticketId,
        scanStatus,
        scanLocation,
        scannedBy
      );
      
      return res.json(ticket);
    } catch (error) {
      logger.error('Error in PUT /tickets/:ticketId/scan-status:', error);
      if (error instanceof Error && error.message.includes('not found')) {
        return res.status(404).json({ error: error.message });
      } else {
        return res.status(500).json({ error: 'Failed to update ticket scan status' });
      }
    }
  }
);

/**
 * @swagger
 * /api/orgadmin/tickets/{ticketId}/scan-history:
 *   get:
 *     summary: Get scan history for a ticket
 *     tags: [Ticketing]
 *     parameters:
 *       - in: path
 *         name: ticketId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Ticket scan history
 */
router.get(
  '/tickets/:ticketId/scan-history',
  authenticateToken(),
  async (req: Request, res: Response) => {
    try {
      const { ticketId } = req.params;
      const history = await ticketingService.getTicketScanHistory(ticketId);
      res.json(history);
    } catch (error) {
      logger.error('Error in GET /tickets/:ticketId/scan-history:', error);
      res.status(500).json({ error: 'Failed to fetch scan history' });
    }
  }
);

export default router;
