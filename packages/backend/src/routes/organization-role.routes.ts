import { Router, Request, Response } from 'express';
import { organizationAdminRoleService } from '../services/organization-admin-role.service';
import { authenticateToken, requireRole } from '../middleware/auth.middleware';
import { logger } from '../config/logger';

const router = Router();

/**
 * @swagger
 * /api/admin/organizations/{organizationId}/roles:
 *   get:
 *     summary: Get all roles for an organization
 *     tags: [Organization Roles]
 *     parameters:
 *       - in: path
 *         name: organizationId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of roles
 */
router.get(
  '/:organizationId/roles',
  authenticateToken(),
  async (req: Request, res: Response) => {
    try {
      const { organizationId } = req.params;
      const roles = await organizationAdminRoleService.getRolesByOrganization(organizationId);

      return res.json(roles);
    } catch (error) {
      logger.error('Error in GET /organizations/:organizationId/roles:', error);
      return res.status(500).json({ error: 'Failed to fetch roles' });
    }
  }
);

/**
 * @swagger
 * /api/admin/organizations/{organizationId}/roles/{id}:
 *   get:
 *     summary: Get role by ID
 *     tags: [Organization Roles]
 *     parameters:
 *       - in: path
 *         name: organizationId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Role details
 *       404:
 *         description: Role not found
 */
router.get(
  '/:organizationId/roles/:id',
  authenticateToken(),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const role = await organizationAdminRoleService.getRoleById(id);

      if (!role) {
        return res.status(404).json({ error: 'Role not found' });
      }

      return res.json(role);
    } catch (error) {
      logger.error('Error in GET /organizations/:organizationId/roles/:id:', error);
      return res.status(500).json({ error: 'Failed to fetch role' });
    }
  }
);

/**
 * @swagger
 * /api/admin/organizations/{organizationId}/roles:
 *   post:
 *     summary: Create role
 *     tags: [Organization Roles]
 *     parameters:
 *       - in: path
 *         name: organizationId
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
 *               - displayName
 *               - capabilityPermissions
 *             properties:
 *               name:
 *                 type: string
 *               displayName:
 *                 type: string
 *               description:
 *                 type: string
 *               capabilityPermissions:
 *                 type: object
 *     responses:
 *       201:
 *         description: Role created
 */
router.post(
  '/:organizationId/roles',
  authenticateToken(),
  requireRole('super-admin'),
  async (req: Request, res: Response) => {
    try {
      const { organizationId } = req.params;
      const role = await organizationAdminRoleService.createRole(organizationId, req.body);

      return res.status(201).json(role);
    } catch (error) {
      logger.error('Error in POST /organizations/:organizationId/roles:', error);
      if (error instanceof Error) {
        return res.status(400).json({ error: error.message });
      }
      return res.status(500).json({ error: 'Failed to create role' });
    }
  }
);

/**
 * @swagger
 * /api/admin/organizations/{organizationId}/roles/{id}:
 *   put:
 *     summary: Update role
 *     tags: [Organization Roles]
 *     parameters:
 *       - in: path
 *         name: organizationId
 *         required: true
 *         schema:
 *           type: string
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
 *         description: Role updated
 */
router.put(
  '/:organizationId/roles/:id',
  authenticateToken(),
  requireRole('super-admin'),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const role = await organizationAdminRoleService.updateRole(id, req.body);

      return res.json(role);
    } catch (error) {
      logger.error('Error in PUT /organizations/:organizationId/roles/:id:', error);
      if (error instanceof Error) {
        return res.status(400).json({ error: error.message });
      }
      return res.status(500).json({ error: 'Failed to update role' });
    }
  }
);

/**
 * @swagger
 * /api/admin/organizations/{organizationId}/roles/{id}:
 *   delete:
 *     summary: Delete role
 *     tags: [Organization Roles]
 *     parameters:
 *       - in: path
 *         name: organizationId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       204:
 *         description: Role deleted
 */
router.delete(
  '/:organizationId/roles/:id',
  authenticateToken(),
  requireRole('super-admin'),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      await organizationAdminRoleService.deleteRole(id);

      return res.status(204).send();
    } catch (error) {
      logger.error('Error in DELETE /organizations/:organizationId/roles/:id:', error);
      if (error instanceof Error) {
        return res.status(400).json({ error: error.message });
      }
      return res.status(500).json({ error: 'Failed to delete role' });
    }
  }
);

/**
 * @swagger
 * /api/admin/organizations/{organizationId}/roles/{id}/users:
 *   get:
 *     summary: Get users assigned to role
 *     tags: [Organization Roles]
 *     parameters:
 *       - in: path
 *         name: organizationId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of user IDs
 */
router.get(
  '/:organizationId/roles/:id/users',
  authenticateToken(),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const userIds = await organizationAdminRoleService.getRoleUsers(id);

      return res.json(userIds);
    } catch (error) {
      logger.error('Error in GET /organizations/:organizationId/roles/:id/users:', error);
      return res.status(500).json({ error: 'Failed to fetch role users' });
    }
  }
);

export default router;
