import { Router, Request, Response } from 'express';
import { venueService } from '../services/venue.service';
import { authenticateToken, requireOrgAdminCapability } from '../middleware';
import { logger } from '../config/logger';

const router = Router();

/**
 * @swagger
 * /api/orgadmin/organisations/{organisationId}/venues:
 *   get:
 *     summary: Get all venues for an organisation
 *     tags: [Venues]
 *     parameters:
 *       - in: path
 *         name: organisationId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of venues
 */
router.get(
  '/organisations/:organisationId/venues',
  authenticateToken(),
  ...requireOrgAdminCapability('event-management'),
  async (req: Request, res: Response) => {
    try {
      const { organisationId } = req.params;
      const venues = await venueService.getByOrganisation(organisationId);
      res.json(venues);
    } catch (error) {
      logger.error('Error in GET /venues:', error);
      res.status(500).json({ error: 'Failed to fetch venues' });
    }
  }
);

/**
 * @swagger
 * /api/orgadmin/organisations/{organisationId}/venues:
 *   post:
 *     summary: Create a new venue
 *     tags: [Venues]
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
 *               address:
 *                 type: string
 *               latitude:
 *                 type: number
 *               longitude:
 *                 type: number
 *     responses:
 *       201:
 *         description: Venue created
 *       400:
 *         description: Validation error
 */
router.post(
  '/organisations/:organisationId/venues',
  authenticateToken(),
  ...requireOrgAdminCapability('event-management'),
  async (req: Request, res: Response) => {
    try {
      const { organisationId } = req.params;
      
      const venueData = {
        ...req.body,
        organisationId,
      };
      
      const venue = await venueService.create(venueData);
      return res.status(201).json(venue);
    } catch (error) {
      logger.error('Error in POST /venues:', error);
      if (error instanceof Error) {
        return res.status(400).json({ error: error.message });
      } else {
        return res.status(500).json({ error: 'Failed to create venue' });
      }
    }
  }
);

/**
 * @swagger
 * /api/orgadmin/venues/{id}:
 *   get:
 *     summary: Get venue by ID
 *     tags: [Venues]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Venue details
 *       404:
 *         description: Venue not found
 */
router.get(
  '/venues/:id',
  authenticateToken(),
  ...requireOrgAdminCapability('event-management'),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const venue = await venueService.getById(id);
      
      if (!venue) {
        return res.status(404).json({ error: 'Venue not found' });
      }
      
      return res.json(venue);
    } catch (error) {
      logger.error('Error in GET /venues/:id:', error);
      return res.status(500).json({ error: 'Failed to fetch venue' });
    }
  }
);

/**
 * @swagger
 * /api/orgadmin/venues/{id}:
 *   put:
 *     summary: Update a venue
 *     tags: [Venues]
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
 *               address:
 *                 type: string
 *               latitude:
 *                 type: number
 *               longitude:
 *                 type: number
 *     responses:
 *       200:
 *         description: Venue updated
 *       404:
 *         description: Venue not found
 */
router.put(
  '/venues/:id',
  authenticateToken(),
  ...requireOrgAdminCapability('event-management'),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const venue = await venueService.update(id, req.body);
      res.json(venue);
    } catch (error) {
      logger.error('Error in PUT /venues/:id:', error);
      if (error instanceof Error) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Failed to update venue' });
      }
    }
  }
);

/**
 * @swagger
 * /api/orgadmin/venues/{id}:
 *   delete:
 *     summary: Delete a venue
 *     tags: [Venues]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       204:
 *         description: Venue deleted
 *       404:
 *         description: Venue not found
 *       422:
 *         description: Venue is in use
 */
router.delete(
  '/venues/:id',
  authenticateToken(),
  ...requireOrgAdminCapability('event-management'),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      await venueService.delete(id);
      res.status(204).send();
    } catch (error) {
      logger.error('Error in DELETE /venues/:id:', error);
      if (error instanceof Error) {
        if (error.message.includes('not found')) {
          res.status(404).json({ error: error.message });
        } else if (error.message.includes('used in events')) {
          res.status(422).json({ error: error.message });
        } else {
          res.status(400).json({ error: error.message });
        }
      } else {
        res.status(500).json({ error: 'Failed to delete venue' });
      }
    }
  }
);

export default router;
