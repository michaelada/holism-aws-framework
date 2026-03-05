import { Router, Request, Response } from 'express';
import { membershipService } from '../services/membership.service';
import { authenticateToken } from '../middleware/auth.middleware';
import { requireOrgAdmin } from '../middleware/orgadmin-role.middleware';
import { logger } from '../config/logger';
import { db } from '../database/pool';
import { orgPaymentMethodDataService } from '../services/org-payment-method-data.service';

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
 * /api/orgadmin/membership-types:
 *   get:
 *     summary: Get all membership types for the authenticated user's organisation
 *     tags: [Membership Types]
 *     responses:
 *       200:
 *         description: List of membership types
 */
router.get(
  '/membership-types',
  authenticateToken(),
  async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      if (!user?.userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }
      
      // Get user's organisation from organization_users table
      const orgResult = await db.query(
        `SELECT organization_id FROM organization_users 
         WHERE keycloak_user_id = $1 AND user_type = 'org-admin' AND status = 'active'
         LIMIT 1`,
        [user.userId]
      );
      
      if (orgResult.rows.length === 0) {
        return res.status(403).json({ error: 'User is not an organization administrator' });
      }
      
      const organisationId = orgResult.rows[0].organization_id;
      const membershipTypes = await membershipService.getMembershipTypesByOrganisation(organisationId);
      return res.json(membershipTypes);
    } catch (error) {
      logger.error('Error in GET /membership-types:', error);
      return res.status(500).json({ error: 'Failed to fetch membership types' });
    }
  }
);

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
  async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      if (!user?.userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }
      
      // Get user's organisation from organization_users table
      const orgResult = await db.query(
        `SELECT organization_id FROM organization_users 
         WHERE keycloak_user_id = $1 AND user_type = 'org-admin' AND status = 'active'
         LIMIT 1`,
        [user.userId]
      );
      
      if (orgResult.rows.length === 0) {
        return res.status(403).json({ error: 'User is not an organization administrator' });
      }
      
      const organisationId = orgResult.rows[0].organization_id;
      
      // Check if organisation has memberships capability
      const capabilityResult = await db.query(
        `SELECT enabled_capabilities FROM organizations WHERE id = $1`,
        [organisationId]
      );
      
      if (capabilityResult.rows.length === 0) {
        return res.status(404).json({ error: 'Organisation not found' });
      }
      
      const enabledCapabilities = capabilityResult.rows[0].enabled_capabilities || [];
      
      if (!enabledCapabilities.includes('memberships')) {
        return res.status(403).json({ 
          error: 'Organisation does not have memberships capability enabled' 
        });
      }
      
      // Add organisationId to request body
      const membershipTypeData = {
        ...req.body,
        organisationId
      };
      
      const membershipType = await membershipService.createMembershipType(membershipTypeData);
      return res.status(201).json(membershipType);
    } catch (error) {
      logger.error('Error in POST /membership-types:', error);
      if (error instanceof Error) {
        return res.status(400).json({ error: error.message });
      } else {
        return res.status(500).json({ error: 'Failed to create membership type' });
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
 * /api/orgadmin/members:
 *   get:
 *     summary: Get all members for the authenticated user's organisation
 *     tags: [Members]
 *     responses:
 *       200:
 *         description: List of members
 */
router.get(
  '/members',
  authenticateToken(),
  async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      if (!user?.userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }
      
      // Get user's organisation from organization_users table
      const orgResult = await db.query(
        `SELECT organization_id FROM organization_users 
         WHERE keycloak_user_id = $1 AND user_type = 'org-admin' AND status = 'active'
         LIMIT 1`,
        [user.userId]
      );
      
      if (orgResult.rows.length === 0) {
        return res.status(403).json({ error: 'User is not an organization administrator' });
      }
      
      const organisationId = orgResult.rows[0].organization_id;
      const members = await membershipService.getMembersByOrganisation(organisationId);
      return res.json(members);
    } catch (error) {
      logger.error('Error in GET /members:', error);
      return res.status(500).json({ error: 'Failed to fetch members' });
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

/**
 * @swagger
 * /api/orgadmin/members:
 *   post:
 *     summary: Create a new member
 *     tags: [Members]
 *     security:
 *       - bearerAuth: []
 *     description: Creates a new member. Requires Organization Administrator role.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - organisationId
 *               - membershipTypeId
 *               - userId
 *               - firstName
 *               - lastName
 *               - formSubmissionId
 *               - status
 *             properties:
 *               organisationId:
 *                 type: string
 *               membershipTypeId:
 *                 type: string
 *               userId:
 *                 type: string
 *               firstName:
 *                 type: string
 *               lastName:
 *                 type: string
 *               formSubmissionId:
 *                 type: string
 *               status:
 *                 type: string
 *                 enum: [active, pending]
 *     responses:
 *       201:
 *         description: Member created successfully
 *       400:
 *         description: Invalid request data
 *       403:
 *         description: Access denied - requires Organization Administrator role
 */
router.post(
  '/members',
  authenticateToken(),
  requireOrgAdmin(),
  requireMembershipsCapability,
  async (req: Request, res: Response) => {
    try {
      const member = await membershipService.createMember(req.body);
      res.status(201).json(member);
    } catch (error) {
      logger.error('Error in POST /members:', error);
      if (error instanceof Error) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Failed to create member' });
      }
    }
  }
);

// ============================================================================
// Member Filters Routes
// ============================================================================

/**
 * @swagger
 * /api/orgadmin/member-filters:
 *   get:
 *     summary: Get all custom member filters for the authenticated user's organisation
 *     tags: [Member Filters]
 *     responses:
 *       200:
 *         description: List of custom filters
 */
router.get(
  '/member-filters',
  authenticateToken(),
  async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      if (!user?.userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }
      
      // Get user's organisation from organization_users table
      const orgResult = await db.query(
        `SELECT organization_id FROM organization_users 
         WHERE keycloak_user_id = $1 AND user_type = 'org-admin' AND status = 'active'
         LIMIT 1`,
        [user.userId]
      );
      
      if (orgResult.rows.length === 0) {
        return res.status(403).json({ error: 'User is not an organization administrator' });
      }
      
      // For now, return empty array - full implementation would query member_filters table
      return res.json([]);
    } catch (error) {
      logger.error('Error in GET /member-filters:', error);
      return res.status(500).json({ error: 'Failed to fetch member filters' });
    }
  }
);

// ============================================================================
// Payment Methods Routes
// ============================================================================

/**
 * @swagger
 * /api/orgadmin/payment-methods:
 *   get:
 *     summary: Get all payment methods for the authenticated user's organisation
 *     tags: [Payment Methods]
 *     responses:
 *       200:
 *         description: List of payment methods available to the organisation
 */
router.get(
  '/payment-methods',
  authenticateToken(),
  async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      if (!user?.userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }
      
      // Get user's organisation from organization_users table
      const orgResult = await db.query(
        `SELECT organization_id FROM organization_users 
         WHERE keycloak_user_id = $1 AND user_type = 'org-admin' AND status = 'active'
         LIMIT 1`,
        [user.userId]
      );
      
      if (orgResult.rows.length === 0) {
        return res.status(403).json({ error: 'User is not an organization administrator' });
      }
      
      const organisationId = orgResult.rows[0].organization_id;
      const paymentMethods = await orgPaymentMethodDataService.getOrgPaymentMethods(organisationId);
      
      // Transform to simpler format for frontend: { id, name }
      const simplifiedPaymentMethods = paymentMethods.map(pm => ({
        id: pm.paymentMethod?.id || pm.paymentMethodId,
        name: pm.paymentMethod?.displayName || pm.paymentMethod?.name || 'Unknown'
      }));
      
      return res.json(simplifiedPaymentMethods);
    } catch (error) {
      logger.error('Error in GET /payment-methods:', error);
      return res.status(500).json({ error: 'Failed to fetch payment methods' });
    }
  }
);

export default router;
