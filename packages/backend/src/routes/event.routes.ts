import { Router, Request, Response } from 'express';
import { eventService } from '../services/event.service';
import { eventActivityService } from '../services/event-activity.service';
import { eventEntryService } from '../services/event-entry.service';
import { authenticateToken, requireOrgAdminCapability } from '../middleware';
import { logger } from '../config/logger';

const router = Router();

/**
 * @swagger
 * /api/orgadmin/organisations/{organisationId}/events:
 *   get:
 *     summary: Get all events for an organisation
 *     tags: [Events]
 *     parameters:
 *       - in: path
 *         name: organisationId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of events
 */
router.get(
  '/organisations/:organisationId/events',
  authenticateToken(),
  ...requireOrgAdminCapability('event-management'),
  async (req: Request, res: Response) => {
    try {
      const { organisationId } = req.params;
      const events = await eventService.getEventsByOrganisation(organisationId);
      res.json(events);
    } catch (error) {
      logger.error('Error in GET /events:', error);
      res.status(500).json({ error: 'Failed to fetch events' });
    }
  }
);

/**
 * @swagger
 * /api/orgadmin/events/{id}:
 *   get:
 *     summary: Get event by ID
 *     tags: [Events]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Event details
 *       404:
 *         description: Event not found
 */
router.get(
  '/events/:id',
  authenticateToken(),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const event = await eventService.getEventById(id);
      
      if (!event) {
        return res.status(404).json({ error: 'Event not found' });
      }
      
      return res.json(event);
    } catch (error) {
      logger.error('Error in GET /events/:id:', error);
      return res.status(500).json({ error: 'Failed to fetch event' });
    }
  }
);

/**
 * @swagger
 * /api/orgadmin/events:
 *   post:
 *     summary: Create a new event
 *     tags: [Events]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       201:
 *         description: Event created
 */
router.post(
  '/events',
  authenticateToken(),
  ...requireOrgAdminCapability('event-management'),
  async (req: Request, res: Response) => {
    try {
      const event = await eventService.createEvent(req.body);
      res.status(201).json(event);
    } catch (error) {
      logger.error('Error in POST /events:', error);
      if (error instanceof Error) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Failed to create event' });
      }
    }
  }
);

/**
 * @swagger
 * /api/orgadmin/events/{id}:
 *   put:
 *     summary: Update an event
 *     tags: [Events]
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
 *         description: Event updated
 *       404:
 *         description: Event not found
 */
router.put(
  '/events/:id',
  authenticateToken(),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const event = await eventService.updateEvent(id, req.body);
      res.json(event);
    } catch (error) {
      logger.error('Error in PUT /events/:id:', error);
      if (error instanceof Error) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Failed to update event' });
      }
    }
  }
);

/**
 * @swagger
 * /api/orgadmin/events/{id}:
 *   delete:
 *     summary: Delete an event
 *     tags: [Events]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       204:
 *         description: Event deleted
 *       404:
 *         description: Event not found
 */
router.delete(
  '/events/:id',
  authenticateToken(),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      await eventService.deleteEvent(id);
      res.status(204).send();
    } catch (error) {
      logger.error('Error in DELETE /events/:id:', error);
      if (error instanceof Error && error.message.includes('not found')) {
        res.status(404).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Failed to delete event' });
      }
    }
  }
);

// ============================================================================
// Event Activities Routes
// ============================================================================

/**
 * @swagger
 * /api/orgadmin/events/{eventId}/activities:
 *   get:
 *     summary: Get all activities for an event
 *     tags: [Event Activities]
 *     parameters:
 *       - in: path
 *         name: eventId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of event activities
 */
router.get(
  '/events/:eventId/activities',
  authenticateToken(),
  async (req: Request, res: Response) => {
    try {
      const { eventId } = req.params;
      const activities = await eventActivityService.getActivitiesByEvent(eventId);
      res.json(activities);
    } catch (error) {
      logger.error('Error in GET /events/:eventId/activities:', error);
      res.status(500).json({ error: 'Failed to fetch activities' });
    }
  }
);

/**
 * @swagger
 * /api/orgadmin/events/{eventId}/activities:
 *   post:
 *     summary: Create a new event activity
 *     tags: [Event Activities]
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
 *         description: Activity created
 */
router.post(
  '/events/:eventId/activities',
  authenticateToken(),
  async (req: Request, res: Response) => {
    try {
      const { eventId } = req.params;
      const activityData = { ...req.body, eventId };
      const activity = await eventActivityService.createActivity(activityData);
      res.status(201).json(activity);
    } catch (error) {
      logger.error('Error in POST /events/:eventId/activities:', error);
      if (error instanceof Error) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Failed to create activity' });
      }
    }
  }
);

/**
 * @swagger
 * /api/orgadmin/events/{eventId}/activities/{activityId}:
 *   put:
 *     summary: Update an event activity
 *     tags: [Event Activities]
 *     parameters:
 *       - in: path
 *         name: eventId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: activityId
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
 *         description: Activity updated
 *       404:
 *         description: Activity not found
 */
router.put(
  '/events/:eventId/activities/:activityId',
  authenticateToken(),
  async (req: Request, res: Response) => {
    try {
      const { activityId } = req.params;
      const activity = await eventActivityService.updateActivity(activityId, req.body);
      res.json(activity);
    } catch (error) {
      logger.error('Error in PUT /events/:eventId/activities/:activityId:', error);
      if (error instanceof Error) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Failed to update activity' });
      }
    }
  }
);

/**
 * @swagger
 * /api/orgadmin/events/{eventId}/activities/{activityId}:
 *   delete:
 *     summary: Delete an event activity
 *     tags: [Event Activities]
 *     parameters:
 *       - in: path
 *         name: eventId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: activityId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       204:
 *         description: Activity deleted
 *       404:
 *         description: Activity not found
 */
router.delete(
  '/events/:eventId/activities/:activityId',
  authenticateToken(),
  async (req: Request, res: Response) => {
    try {
      const { activityId } = req.params;
      await eventActivityService.deleteActivity(activityId);
      res.status(204).send();
    } catch (error) {
      logger.error('Error in DELETE /events/:eventId/activities/:activityId:', error);
      if (error instanceof Error && error.message.includes('not found')) {
        res.status(404).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Failed to delete activity' });
      }
    }
  }
);

// ============================================================================
// Event Entries Routes
// ============================================================================

/**
 * @swagger
 * /api/orgadmin/events/{eventId}/entries:
 *   get:
 *     summary: Get all entries for an event
 *     tags: [Event Entries]
 *     parameters:
 *       - in: path
 *         name: eventId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: eventActivityId
 *         schema:
 *           type: string
 *         description: Filter by activity
 *       - in: query
 *         name: searchName
 *         schema:
 *           type: string
 *         description: Search by name
 *     responses:
 *       200:
 *         description: List of event entries
 */
router.get(
  '/events/:eventId/entries',
  authenticateToken(),
  async (req: Request, res: Response) => {
    try {
      const { eventId } = req.params;
      const { eventActivityId, searchName } = req.query;
      
      const filters = {
        eventActivityId: eventActivityId as string,
        searchName: searchName as string,
      };
      
      const entries = await eventEntryService.getEntriesByEvent(eventId, filters);
      res.json(entries);
    } catch (error) {
      logger.error('Error in GET /events/:eventId/entries:', error);
      res.status(500).json({ error: 'Failed to fetch entries' });
    }
  }
);

/**
 * @swagger
 * /api/orgadmin/events/{eventId}/entries/{entryId}:
 *   get:
 *     summary: Get entry by ID
 *     tags: [Event Entries]
 *     parameters:
 *       - in: path
 *         name: eventId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: entryId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Entry details
 *       404:
 *         description: Entry not found
 */
router.get(
  '/events/:eventId/entries/:entryId',
  authenticateToken(),
  async (req: Request, res: Response) => {
    try {
      const { entryId } = req.params;
      const entry = await eventEntryService.getEntryById(entryId);
      
      if (!entry) {
        return res.status(404).json({ error: 'Entry not found' });
      }
      
      return res.json(entry);
    } catch (error) {
      logger.error('Error in GET /events/:eventId/entries/:entryId:', error);
      return res.status(500).json({ error: 'Failed to fetch entry' });
    }
  }
);

/**
 * @swagger
 * /api/orgadmin/events/{eventId}/entries/export:
 *   get:
 *     summary: Export entries to Excel
 *     tags: [Event Entries]
 *     parameters:
 *       - in: path
 *         name: eventId
 *         required: true
 *         schema:
 *           type: string
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
  '/events/:eventId/entries/export',
  authenticateToken(),
  async (req: Request, res: Response) => {
    try {
      const { eventId } = req.params;
      
      // Get event name for filename
      const event = await eventService.getEventById(eventId);
      if (!event) {
        return res.status(404).json({ error: 'Event not found' });
      }
      
      const buffer = await eventEntryService.exportEntriesToExcel(eventId);
      
      // Set headers for file download
      const filename = `${event.name.replace(/[^a-z0-9]/gi, '_')}_entries.xlsx`;
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      
      return res.send(buffer);
    } catch (error) {
      logger.error('Error in GET /events/:eventId/entries/export:', error);
      return res.status(500).json({ error: 'Failed to export entries' });
    }
  }
);

export default router;
