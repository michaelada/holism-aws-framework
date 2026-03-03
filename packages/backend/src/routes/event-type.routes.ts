import { Router, Request, Response } from 'express';
import { eventTypeService } from '../services/event-type.service';
import { authenticateToken, requireOrgAdminCapability } from '../middleware';
import { logger } from '../config/logger';

const router = Router();

/**
 * @swagger
 * /api/orgadmin/organisations/{organisationId}/event-types:
 *   get:
 *     summary: Get all event types for an organisation
 *     tags: [Event Types]
 *     parameters:
 *       - in: path
 *         name: organisationId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of event types
 */
router.get(
  '/organisations/:organisationId/event-types',
  authenticateToken(),
  ...requireOrgAdminCapability('event-management'),
  async (req: Request, res: Response) => {
    try {
      const { organisationId } = req.params;
      const eventTypes = await eventTypeService.getByOrganisation(organisationId);
      res.json(eventTypes);
    } catch (error) {
      logger.error('Error in GET /event-types:', error);
      res.status(500).json({ error: 'Failed to fetch event types' });
    }
  }
);

/**
 * @swagger
 * /api/orgadmin/organisations/{organisationId}/event-types:
 *   post:
 *     summary: Create a new event type
 *     tags: [Event Types]
 *     parameters:
 *       - in: path
 *         name: organisationId
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
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *     responses:
 *       201:
 *         description: Event type created
 *       400:
 *         description: Validation error
 */
router.post(
  '/organisations/:organisationId/event-types',
  authenticateToken(),
  ...requireOrgAdminCapability('event-management'),
  async (req: Request, res: Response) => {
    try {
      const { organisationId } = req.params;
      
      const eventTypeData = {
        ...req.body,
        organisationId,
      };
      
      const eventType = await eventTypeService.create(eventTypeData);
      return res.status(201).json(eventType);
    } catch (error) {
      logger.error('Error in POST /event-types:', error);
      if (error instanceof Error) {
        return res.status(400).json({ error: error.message });
      } else {
        return res.status(500).json({ error: 'Failed to create event type' });
      }
    }
  }
);

/**
 * @swagger
 * /api/orgadmin/event-types/{id}:
 *   get:
 *     summary: Get event type by ID
 *     tags: [Event Types]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Event type details
 *       404:
 *         description: Event type not found
 */
router.get(
  '/event-types/:id',
  authenticateToken(),
  ...requireOrgAdminCapability('event-management'),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const eventType = await eventTypeService.getById(id);
      
      if (!eventType) {
        return res.status(404).json({ error: 'Event type not found' });
      }
      
      return res.json(eventType);
    } catch (error) {
      logger.error('Error in GET /event-types/:id:', error);
      return res.status(500).json({ error: 'Failed to fetch event type' });
    }
  }
);

/**
 * @swagger
 * /api/orgadmin/event-types/{id}:
 *   put:
 *     summary: Update an event type
 *     tags: [Event Types]
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
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *     responses:
 *       200:
 *         description: Event type updated
 *       404:
 *         description: Event type not found
 */
router.put(
  '/event-types/:id',
  authenticateToken(),
  ...requireOrgAdminCapability('event-management'),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const eventType = await eventTypeService.update(id, req.body);
      res.json(eventType);
    } catch (error) {
      logger.error('Error in PUT /event-types/:id:', error);
      if (error instanceof Error) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Failed to update event type' });
      }
    }
  }
);

/**
 * @swagger
 * /api/orgadmin/event-types/{id}:
 *   delete:
 *     summary: Delete an event type
 *     tags: [Event Types]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       204:
 *         description: Event type deleted
 *       404:
 *         description: Event type not found
 *       422:
 *         description: Event type is in use
 */
router.delete(
  '/event-types/:id',
  authenticateToken(),
  ...requireOrgAdminCapability('event-management'),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      await eventTypeService.delete(id);
      res.status(204).send();
    } catch (error) {
      logger.error('Error in DELETE /event-types/:id:', error);
      if (error instanceof Error) {
        if (error.message.includes('not found')) {
          res.status(404).json({ error: error.message });
        } else if (error.message.includes('used in events')) {
          res.status(422).json({ error: error.message });
        } else {
          res.status(400).json({ error: error.message });
        }
      } else {
        res.status(500).json({ error: 'Failed to delete event type' });
      }
    }
  }
);

export default router;
