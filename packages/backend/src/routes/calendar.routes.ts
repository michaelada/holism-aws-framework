import { Router, Request, Response } from 'express';
import { calendarService } from '../services/calendar.service';
import { authenticateToken } from '../middleware/auth.middleware';
import { logger } from '../config/logger';
import { db } from '../database/pool';

const router = Router();

/**
 * Middleware to check if organisation has calendar-bookings capability
 */
async function requireCalendarBookingsCapability(
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

    // Check if organisation has calendar-bookings capability
    const result = await db.query(
      `SELECT enabled_capabilities FROM organizations WHERE id = $1`,
      [organisationId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Organisation not found' });
      return;
    }

    const enabledCapabilities = result.rows[0].enabled_capabilities || [];
    
    if (!enabledCapabilities.includes('calendar-bookings')) {
      res.status(403).json({ 
        error: 'Organisation does not have calendar-bookings capability enabled' 
      });
      return;
    }

    next();
  } catch (error) {
    logger.error('Error checking calendar-bookings capability:', error);
    res.status(500).json({ error: 'Failed to verify capability' });
  }
}

// ============================================================================
// Calendar Routes
// ============================================================================

/**
 * @swagger
 * /api/orgadmin/organisations/{organisationId}/calendars:
 *   get:
 *     summary: Get all calendars for an organisation
 *     tags: [Calendars]
 *     parameters:
 *       - in: path
 *         name: organisationId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of calendars
 */
router.get(
  '/organisations/:organisationId/calendars',
  authenticateToken(),
  requireCalendarBookingsCapability,
  async (req: Request, res: Response) => {
    try {
      const { organisationId } = req.params;
      const calendars = await calendarService.getCalendarsByOrganisation(organisationId);
      res.json(calendars);
    } catch (error) {
      logger.error('Error in GET /calendars:', error);
      res.status(500).json({ error: 'Failed to fetch calendars' });
    }
  }
);

/**
 * @swagger
 * /api/orgadmin/calendars/{id}:
 *   get:
 *     summary: Get calendar by ID
 *     tags: [Calendars]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Calendar details
 *       404:
 *         description: Calendar not found
 */
router.get(
  '/calendars/:id',
  authenticateToken(),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const calendar = await calendarService.getCalendarById(id);
      
      if (!calendar) {
        return res.status(404).json({ error: 'Calendar not found' });
      }
      
      return res.json(calendar);
    } catch (error) {
      logger.error('Error in GET /calendars/:id:', error);
      return res.status(500).json({ error: 'Failed to fetch calendar' });
    }
  }
);

/**
 * @swagger
 * /api/orgadmin/calendars:
 *   post:
 *     summary: Create a new calendar
 *     tags: [Calendars]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       201:
 *         description: Calendar created
 */
router.post(
  '/calendars',
  authenticateToken(),
  requireCalendarBookingsCapability,
  async (req: Request, res: Response) => {
    try {
      const calendar = await calendarService.createCalendar(req.body);
      res.status(201).json(calendar);
    } catch (error) {
      logger.error('Error in POST /calendars:', error);
      if (error instanceof Error) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Failed to create calendar' });
      }
    }
  }
);

/**
 * @swagger
 * /api/orgadmin/calendars/{id}:
 *   put:
 *     summary: Update a calendar
 *     tags: [Calendars]
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
 *         description: Calendar updated
 *       404:
 *         description: Calendar not found
 */
router.put(
  '/calendars/:id',
  authenticateToken(),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const calendar = await calendarService.updateCalendar(id, req.body);
      res.json(calendar);
    } catch (error) {
      logger.error('Error in PUT /calendars/:id:', error);
      if (error instanceof Error) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Failed to update calendar' });
      }
    }
  }
);

/**
 * @swagger
 * /api/orgadmin/calendars/{id}:
 *   delete:
 *     summary: Delete a calendar
 *     tags: [Calendars]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       204:
 *         description: Calendar deleted
 *       404:
 *         description: Calendar not found
 */
router.delete(
  '/calendars/:id',
  authenticateToken(),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      await calendarService.deleteCalendar(id);
      res.status(204).send();
    } catch (error) {
      logger.error('Error in DELETE /calendars/:id:', error);
      if (error instanceof Error && error.message.includes('not found')) {
        res.status(404).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Failed to delete calendar' });
      }
    }
  }
);

// ============================================================================
// Booking Routes
// ============================================================================

/**
 * @swagger
 * /api/orgadmin/calendars/{calendarId}/bookings:
 *   get:
 *     summary: Get all bookings for a calendar
 *     tags: [Bookings]
 *     parameters:
 *       - in: path
 *         name: calendarId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of bookings
 */
router.get(
  '/calendars/:calendarId/bookings',
  authenticateToken(),
  async (req: Request, res: Response) => {
    try {
      const { calendarId } = req.params;
      const bookings = await calendarService.getBookingsByCalendar(calendarId);
      res.json(bookings);
    } catch (error) {
      logger.error('Error in GET /calendars/:calendarId/bookings:', error);
      res.status(500).json({ error: 'Failed to fetch bookings' });
    }
  }
);

/**
 * @swagger
 * /api/orgadmin/bookings/{id}:
 *   get:
 *     summary: Get booking by ID
 *     tags: [Bookings]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Booking details
 *       404:
 *         description: Booking not found
 */
router.get(
  '/bookings/:id',
  authenticateToken(),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const booking = await calendarService.getBookingById(id);
      
      if (!booking) {
        return res.status(404).json({ error: 'Booking not found' });
      }
      
      return res.json(booking);
    } catch (error) {
      logger.error('Error in GET /bookings/:id:', error);
      return res.status(500).json({ error: 'Failed to fetch booking' });
    }
  }
);

/**
 * @swagger
 * /api/orgadmin/bookings:
 *   post:
 *     summary: Create a new booking
 *     tags: [Bookings]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       201:
 *         description: Booking created
 */
router.post(
  '/bookings',
  authenticateToken(),
  async (req: Request, res: Response) => {
    try {
      const booking = await calendarService.createBooking(req.body);
      res.status(201).json(booking);
    } catch (error) {
      logger.error('Error in POST /bookings:', error);
      if (error instanceof Error) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Failed to create booking' });
      }
    }
  }
);

export default router;
