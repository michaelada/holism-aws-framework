import { Router, Request, Response } from 'express';
import { membershipService } from '../services/membership.service';
import { authenticateToken } from '../middleware/auth.middleware';
import { logger } from '../config/logger';
import { db } from '../database/pool';

const router = Router();

/**
 * Middleware to check if organisation has memberships capability
 */
async function requireMembershipsCapability(
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

    // Check if organisation has memberships capability
    const result = await db.query(
      `SELECT enabled_capabilities FROM organizations WHERE id = $1`,
      [organisationId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Organisation not found' });
      return;
    }

    const enabledCapabilities = result.rows[0].enabled_capabilities || [];
    
    if (!enabledCapabilities.includes('memberships')) {
      res.status(403).json({ 
        error: 'Organisation does not have memberships capability enabled' 
      });
      return;
    }

    next();
  } catch (error) {
    logger.error('Error checking memberships capability:', error);
    res.status(500).json({ error: 'Failed to verify capability' });
  }
}

// ============================================================================
// Membership Types Routes
// ============================================================================

/**
 * @swagger
 * /api/orgadmin/organisations/{organisationId}/membership-types:
 *   get:
 *     summary: Get all membership types for an organisation
 *     tags: [Membership Types]
 *     parameters:
 *       - in: path
 *         name: organisationId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of membership types
 */
router.get(
  '/organisations/:organisationId/membership-types',
  authenticateToken(),
  requireMembershipsCapability,
  async (req: Request, res: Response) => {
    try {
      const { organisationId } = req.params;
      const membershipTypes = await membershipService.getMembershipTypesByOrganisation(organisationId);
      res.json(membershipTypes);
    } catch (error) {
      logger.error('Error in GET /membership-types:', error);
      res.status(500).json({ error: 'Failed to fetch membership types' });
    }
  }
);

/**
 * @swagger
 * /api/orgadmin/membership-types/{id}:
 *   get:
 *     summary: Get membership type by ID
 *     tags: [Membership Types]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Membership type details
 *       404:
 *         description: Membership type not found
 */
router.get(
  '/membership-types/:id',
  authenticateToken(),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const membershipType = await membershipService.getMembershipTypeById(id);
      
      if (!membershipType) {
        return res.status(404).json({ error: 'Membership type not found' });
      }
      
      return res.json(membershipType);
    } catch (error) {
      logger.error('Error in GET /membership-types/:id:', error);
      return res.status(500).json({ error: 'Failed to fetch membership type' });
    }
  }
);

/**
 * @swagger
 * /api/orgadmin/membership-types:
 *   post:
 *     summary: Create a new membership type
 *     tags: [Membership Types]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       201:
 *         description: Membership type created
 */
router.post(
  '/membership-types',
  authenticateToken(),
  requireMembershipsCapability,
  async (req: Request, res: Response) => {
    try {
      const membershipType = await membershipService.createMembershipType(req.body);
      res.status(201).json(membershipType);
    } catch (error) {
      logger.error('Error in POST /membership-types:', error);
      if (error instanceof Error) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Failed to create membership type' });
      }
    }
  }
);

/**
 * @swagger
 * /api/orgadmin/membership-types/{id}:
 *   put:
 *     summary: Update a membership type
 *     tags: [Membership Types]
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
 *         description: Membership type updated
 *       404:
 *         description: Membership type not found
 */
router.put(
  '/membership-types/:id',
  authenticateToken(),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const membershipType = await membershipService.updateMembershipType(id, req.body);
      res.json(membershipType);
    } catch (error) {
      logger.error('Error in PUT /membership-types/:id:', error);
      if (error instanceof Error) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Failed to update membership type' });
      }
    }
  }
);

/**
 * @swagger
 * /api/orgadmin/membership-types/{id}:
 *   delete:
 *     summary: Delete a membership type
 *     tags: [Membership Types]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       204:
 *         description: Membership type deleted
 *       404:
 *         description: Membership type not found
 */
router.delete(
  '/membership-types/:id',
  authenticateToken(),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      await membershipService.deleteMembershipType(id);
      res.status(204).send();
    } catch (error) {
      logger.error('Error in DELETE /membership-types/:id:', error);
      if (error instanceof Error && error.message.includes('not found')) {
        res.status(404).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Failed to delete membership type' });
      }
    }
  }
);

// ============================================================================
// Members Routes
// ============================================================================

/**
 * @swagger
 * /api/orgadmin/organisations/{organisationId}/members:
 *   get:
 *     summary: Get all members for an organisation
 *     tags: [Members]
 *     parameters:
 *       - in: path
 *         name: organisationId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of members
 */
router.get(
  '/organisations/:organisationId/members',
  authenticateToken(),
  requireMembershipsCapability,
  async (req: Request, res: Response) => {
    try {
      const { organisationId } = req.params;
      const members = await membershipService.getMembersByOrganisation(organisationId);
      res.json(members);
    } catch (error) {
      logger.error('Error in GET /members:', error);
      res.status(500).json({ error: 'Failed to fetch members' });
    }
  }
);

/**
 * @swagger
 * /api/orgadmin/members/{id}:
 *   get:
 *     summary: Get member by ID
 *     tags: [Members]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Member details
 *       404:
 *         description: Member not found
 */
router.get(
  '/members/:id',
  authenticateToken(),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const member = await membershipService.getMemberById(id);
      
      if (!member) {
        return res.status(404).json({ error: 'Member not found' });
      }
      
      return res.json(member);
    } catch (error) {
      logger.error('Error in GET /members/:id:', error);
      return res.status(500).json({ error: 'Failed to fetch member' });
    }
  }
);

export default router;
