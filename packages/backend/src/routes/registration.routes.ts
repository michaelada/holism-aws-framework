import { Router, Request, Response } from 'express';
import { registrationService } from '../services/registration.service';
import { authenticateToken } from '../middleware/auth.middleware';
import { logger } from '../config/logger';
import { db } from '../database/pool';

const router = Router();

/**
 * Middleware to check if organisation has registrations capability
 */
async function requireRegistrationsCapability(
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

    // Check if organisation has registrations capability
    const result = await db.query(
      `SELECT enabled_capabilities FROM organizations WHERE id = $1`,
      [organisationId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Organisation not found' });
      return;
    }

    const enabledCapabilities = result.rows[0].enabled_capabilities || [];
    
    if (!enabledCapabilities.includes('registrations')) {
      res.status(403).json({ 
        error: 'Organisation does not have registrations capability enabled' 
      });
      return;
    }

    next();
  } catch (error) {
    logger.error('Error checking registrations capability:', error);
    res.status(500).json({ error: 'Failed to verify capability' });
  }
}

// ============================================================================
// Registration Types Routes
// ============================================================================

/**
 * @swagger
 * /api/orgadmin/organisations/{organisationId}/registration-types:
 *   get:
 *     summary: Get all registration types for an organisation
 *     tags: [Registration Types]
 *     parameters:
 *       - in: path
 *         name: organisationId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of registration types
 */
router.get(
  '/organisations/:organisationId/registration-types',
  authenticateToken(),
  requireRegistrationsCapability,
  async (req: Request, res: Response) => {
    try {
      const { organisationId } = req.params;
      const registrationTypes = await registrationService.getRegistrationTypesByOrganisation(organisationId);
      res.json(registrationTypes);
    } catch (error) {
      logger.error('Error in GET /registration-types:', error);
      res.status(500).json({ error: 'Failed to fetch registration types' });
    }
  }
);

/**
 * @swagger
 * /api/orgadmin/registration-types/{id}:
 *   get:
 *     summary: Get registration type by ID
 *     tags: [Registration Types]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Registration type details
 *       404:
 *         description: Registration type not found
 */
router.get(
  '/registration-types/:id',
  authenticateToken(),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const registrationType = await registrationService.getRegistrationTypeById(id);
      
      if (!registrationType) {
        return res.status(404).json({ error: 'Registration type not found' });
      }
      
      return res.json(registrationType);
    } catch (error) {
      logger.error('Error in GET /registration-types/:id:', error);
      return res.status(500).json({ error: 'Failed to fetch registration type' });
    }
  }
);

/**
 * @swagger
 * /api/orgadmin/registration-types:
 *   post:
 *     summary: Create a new registration type
 *     tags: [Registration Types]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       201:
 *         description: Registration type created
 */
router.post(
  '/registration-types',
  authenticateToken(),
  requireRegistrationsCapability,
  async (req: Request, res: Response) => {
    try {
      const registrationType = await registrationService.createRegistrationType(req.body);
      res.status(201).json(registrationType);
    } catch (error) {
      logger.error('Error in POST /registration-types:', error);
      if (error instanceof Error) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Failed to create registration type' });
      }
    }
  }
);

/**
 * @swagger
 * /api/orgadmin/registration-types/{id}:
 *   put:
 *     summary: Update a registration type
 *     tags: [Registration Types]
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
 *         description: Registration type updated
 *       404:
 *         description: Registration type not found
 */
router.put(
  '/registration-types/:id',
  authenticateToken(),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const registrationType = await registrationService.updateRegistrationType(id, req.body);
      res.json(registrationType);
    } catch (error) {
      logger.error('Error in PUT /registration-types/:id:', error);
      if (error instanceof Error) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Failed to update registration type' });
      }
    }
  }
);

/**
 * @swagger
 * /api/orgadmin/registration-types/{id}:
 *   delete:
 *     summary: Delete a registration type
 *     tags: [Registration Types]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       204:
 *         description: Registration type deleted
 *       404:
 *         description: Registration type not found
 */
router.delete(
  '/registration-types/:id',
  authenticateToken(),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      await registrationService.deleteRegistrationType(id);
      res.status(204).send();
    } catch (error) {
      logger.error('Error in DELETE /registration-types/:id:', error);
      if (error instanceof Error && error.message.includes('not found')) {
        res.status(404).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Failed to delete registration type' });
      }
    }
  }
);

// ============================================================================
// Registrations Routes
// ============================================================================

/**
 * @swagger
 * /api/orgadmin/organisations/{organisationId}/registrations:
 *   get:
 *     summary: Get all registrations for an organisation with optional filtering
 *     tags: [Registrations]
 *     parameters:
 *       - in: path
 *         name: organisationId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: status
 *         schema:
 *           type: array
 *           items:
 *             type: string
 *             enum: [active, pending, elapsed]
 *       - in: query
 *         name: registrationTypeId
 *         schema:
 *           type: string
 *       - in: query
 *         name: searchTerm
 *         schema:
 *           type: string
 *       - in: query
 *         name: processed
 *         schema:
 *           type: boolean
 *     responses:
 *       200:
 *         description: List of registrations
 */
router.get(
  '/organisations/:organisationId/registrations',
  authenticateToken(),
  requireRegistrationsCapability,
  async (req: Request, res: Response) => {
    try {
      const { organisationId } = req.params;
      const { status, registrationTypeId, searchTerm, processed, labels } = req.query;

      const filter: any = { organisationId };

      if (status) {
        filter.status = Array.isArray(status) ? status : [status];
      }
      if (registrationTypeId) {
        filter.registrationTypeId = registrationTypeId as string;
      }
      if (searchTerm) {
        filter.searchTerm = searchTerm as string;
      }
      if (processed !== undefined) {
        filter.processed = processed === 'true';
      }
      if (labels) {
        filter.labels = Array.isArray(labels) ? labels : [labels];
      }

      const registrations = await registrationService.getRegistrationsByOrganisation(filter);
      res.json(registrations);
    } catch (error) {
      logger.error('Error in GET /registrations:', error);
      res.status(500).json({ error: 'Failed to fetch registrations' });
    }
  }
);

/**
 * @swagger
 * /api/orgadmin/registrations/{id}:
 *   get:
 *     summary: Get registration by ID
 *     tags: [Registrations]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Registration details
 *       404:
 *         description: Registration not found
 */
router.get(
  '/registrations/:id',
  authenticateToken(),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const registration = await registrationService.getRegistrationById(id);
      
      if (!registration) {
        return res.status(404).json({ error: 'Registration not found' });
      }
      
      return res.json(registration);
    } catch (error) {
      logger.error('Error in GET /registrations/:id:', error);
      return res.status(500).json({ error: 'Failed to fetch registration' });
    }
  }
);

/**
 * @swagger
 * /api/orgadmin/registrations/{id}/status:
 *   put:
 *     summary: Update registration status
 *     tags: [Registrations]
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
 *               status:
 *                 type: string
 *                 enum: [active, pending, elapsed]
 *     responses:
 *       200:
 *         description: Registration status updated
 *       404:
 *         description: Registration not found
 */
router.put(
  '/registrations/:id/status',
  authenticateToken(),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { status } = req.body;

      if (!status || !['active', 'pending', 'elapsed'].includes(status)) {
        return res.status(400).json({ error: 'Invalid status value' });
      }

      const registration = await registrationService.updateRegistrationStatus(id, status);
      return res.json(registration);
    } catch (error) {
      logger.error('Error in PUT /registrations/:id/status:', error);
      if (error instanceof Error && error.message.includes('not found')) {
        return res.status(404).json({ error: error.message });
      }
      return res.status(500).json({ error: 'Failed to update registration status' });
    }
  }
);

// ============================================================================
// Batch Operations Routes
// ============================================================================

/**
 * @swagger
 * /api/orgadmin/registrations/batch/add-labels:
 *   post:
 *     summary: Add labels to multiple registrations
 *     tags: [Registrations]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               registrationIds:
 *                 type: array
 *                 items:
 *                   type: string
 *               labels:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Labels added successfully
 */
router.post(
  '/registrations/batch/add-labels',
  authenticateToken(),
  async (req: Request, res: Response) => {
    try {
      const { registrationIds, labels } = req.body;

      if (!Array.isArray(registrationIds) || !Array.isArray(labels)) {
        return res.status(400).json({ error: 'registrationIds and labels must be arrays' });
      }

      const count = await registrationService.addLabelsToRegistrations(registrationIds, labels);
      return res.json({ message: `Labels added to ${count} registrations`, count });
    } catch (error) {
      logger.error('Error in POST /registrations/batch/add-labels:', error);
      return res.status(500).json({ error: 'Failed to add labels' });
    }
  }
);

/**
 * @swagger
 * /api/orgadmin/registrations/batch/remove-labels:
 *   post:
 *     summary: Remove labels from multiple registrations
 *     tags: [Registrations]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               registrationIds:
 *                 type: array
 *                 items:
 *                   type: string
 *               labels:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Labels removed successfully
 */
router.post(
  '/registrations/batch/remove-labels',
  authenticateToken(),
  async (req: Request, res: Response) => {
    try {
      const { registrationIds, labels } = req.body;

      if (!Array.isArray(registrationIds) || !Array.isArray(labels)) {
        return res.status(400).json({ error: 'registrationIds and labels must be arrays' });
      }

      const count = await registrationService.removeLabelsFromRegistrations(registrationIds, labels);
      return res.json({ message: `Labels removed from ${count} registrations`, count });
    } catch (error) {
      logger.error('Error in POST /registrations/batch/remove-labels:', error);
      return res.status(500).json({ error: 'Failed to remove labels' });
    }
  }
);

/**
 * @swagger
 * /api/orgadmin/registrations/batch/mark-processed:
 *   post:
 *     summary: Mark multiple registrations as processed
 *     tags: [Registrations]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               registrationIds:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Registrations marked as processed
 */
router.post(
  '/registrations/batch/mark-processed',
  authenticateToken(),
  async (req: Request, res: Response) => {
    try {
      const { registrationIds } = req.body;

      if (!Array.isArray(registrationIds)) {
        return res.status(400).json({ error: 'registrationIds must be an array' });
      }

      const count = await registrationService.markRegistrationsProcessed(registrationIds);
      return res.json({ message: `${count} registrations marked as processed`, count });
    } catch (error) {
      logger.error('Error in POST /registrations/batch/mark-processed:', error);
      return res.status(500).json({ error: 'Failed to mark registrations as processed' });
    }
  }
);

/**
 * @swagger
 * /api/orgadmin/registrations/batch/mark-unprocessed:
 *   post:
 *     summary: Mark multiple registrations as unprocessed
 *     tags: [Registrations]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               registrationIds:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Registrations marked as unprocessed
 */
router.post(
  '/registrations/batch/mark-unprocessed',
  authenticateToken(),
  async (req: Request, res: Response) => {
    try {
      const { registrationIds } = req.body;

      if (!Array.isArray(registrationIds)) {
        return res.status(400).json({ error: 'registrationIds must be an array' });
      }

      const count = await registrationService.markRegistrationsUnprocessed(registrationIds);
      return res.json({ message: `${count} registrations marked as unprocessed`, count });
    } catch (error) {
      logger.error('Error in POST /registrations/batch/mark-unprocessed:', error);
      return res.status(500).json({ error: 'Failed to mark registrations as unprocessed' });
    }
  }
);

// ============================================================================
// Export Routes
// ============================================================================

/**
 * @swagger
 * /api/orgadmin/organisations/{organisationId}/registrations/export:
 *   get:
 *     summary: Export registrations to Excel
 *     tags: [Registrations]
 *     parameters:
 *       - in: path
 *         name: organisationId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: status
 *         schema:
 *           type: array
 *           items:
 *             type: string
 *       - in: query
 *         name: registrationTypeId
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
  '/organisations/:organisationId/registrations/export',
  authenticateToken(),
  requireRegistrationsCapability,
  async (req: Request, res: Response) => {
    try {
      const { organisationId } = req.params;
      const { status, registrationTypeId, searchTerm, processed, labels } = req.query;

      const filter: any = { organisationId };

      if (status) {
        filter.status = Array.isArray(status) ? status : [status];
      }
      if (registrationTypeId) {
        filter.registrationTypeId = registrationTypeId as string;
      }
      if (searchTerm) {
        filter.searchTerm = searchTerm as string;
      }
      if (processed !== undefined) {
        filter.processed = processed === 'true';
      }
      if (labels) {
        filter.labels = Array.isArray(labels) ? labels : [labels];
      }

      const buffer = await registrationService.exportRegistrationsToExcel(filter);

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename=registrations.xlsx');
      res.send(buffer);
    } catch (error) {
      logger.error('Error in GET /registrations/export:', error);
      res.status(500).json({ error: 'Failed to export registrations' });
    }
  }
);

// ============================================================================
// Custom Filters Routes
// ============================================================================

/**
 * @swagger
 * /api/orgadmin/organisations/{organisationId}/registrations/filters:
 *   get:
 *     summary: Get custom filters for a user
 *     tags: [Registration Filters]
 *     parameters:
 *       - in: path
 *         name: organisationId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of custom filters
 */
router.get(
  '/organisations/:organisationId/registrations/filters',
  authenticateToken(),
  requireRegistrationsCapability,
  async (req: Request, res: Response) => {
    try {
      const { organisationId } = req.params;
      const { userId } = req.query;

      if (!userId) {
        return res.status(400).json({ error: 'userId query parameter is required' });
      }

      const filters = await registrationService.getCustomFilters(organisationId, userId as string);
      return res.json(filters);
    } catch (error) {
      logger.error('Error in GET /registrations/filters:', error);
      return res.status(500).json({ error: 'Failed to fetch custom filters' });
    }
  }
);

/**
 * @swagger
 * /api/orgadmin/registrations/filters:
 *   post:
 *     summary: Create a custom filter
 *     tags: [Registration Filters]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       201:
 *         description: Custom filter created
 */
router.post(
  '/registrations/filters',
  authenticateToken(),
  async (req: Request, res: Response) => {
    try {
      const filter = await registrationService.saveCustomFilter(req.body);
      res.status(201).json(filter);
    } catch (error) {
      logger.error('Error in POST /registrations/filters:', error);
      if (error instanceof Error) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Failed to create custom filter' });
      }
    }
  }
);

export default router;
