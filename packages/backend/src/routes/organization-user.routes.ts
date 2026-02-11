import { Router, Request, Response } from 'express';
import { organizationUserService } from '../services/organization-user.service';
import { authenticateToken, requireRole } from '../middleware/auth.middleware';
import { logger } from '../config/logger';

const router = Router();

/**
 * @swagger
 * /api/admin/organizations/{organizationId}/users:
 *   get:
 *     summary: Get all users for an organization
 *     tags: [Organization Users]
 *     parameters:
 *       - in: path
 *         name: organizationId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: userType
 *         schema:
 *           type: string
 *           enum: [org-admin, account-user]
 *     responses:
 *       200:
 *         description: List of users
 */
router.get(
  '/:organizationId/users',
  authenticateToken(),
  async (req: Request, res: Response) => {
    try {
      const { organizationId } = req.params;
      const { userType } = req.query;

      const users = await organizationUserService.getUsersByOrganization(
        organizationId,
        userType as any
      );

      return res.json(users);
    } catch (error) {
      logger.error('Error in GET /organizations/:organizationId/users:', error);
      return res.status(500).json({ error: 'Failed to fetch users' });
    }
  }
);

/**
 * @swagger
 * /api/admin/organizations/{organizationId}/users/{id}:
 *   get:
 *     summary: Get user by ID
 *     tags: [Organization Users]
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
 *         description: User details
 *       404:
 *         description: User not found
 */
router.get(
  '/:organizationId/users/:id',
  authenticateToken(),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const user = await organizationUserService.getUserById(id);

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      return res.json(user);
    } catch (error) {
      logger.error('Error in GET /organizations/:organizationId/users/:id:', error);
      return res.status(500).json({ error: 'Failed to fetch user' });
    }
  }
);

/**
 * @swagger
 * /api/admin/organizations/{organizationId}/users/admin:
 *   post:
 *     summary: Create organization admin user
 *     tags: [Organization Users]
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
 *               - email
 *               - firstName
 *               - lastName
 *               - roleId
 *             properties:
 *               email:
 *                 type: string
 *               firstName:
 *                 type: string
 *               lastName:
 *                 type: string
 *               roleId:
 *                 type: string
 *               temporaryPassword:
 *                 type: string
 *     responses:
 *       201:
 *         description: Admin user created
 */
router.post(
  '/:organizationId/users/admin',
  authenticateToken(),
  requireRole('super-admin'),
  async (req: Request, res: Response) => {
    try {
      const { organizationId } = req.params;
      const userId = (req as any).user?.sub;

      const user = await organizationUserService.createAdminUser(
        organizationId,
        { ...req.body, userType: 'org-admin' },
        userId
      );

      return res.status(201).json(user);
    } catch (error) {
      logger.error('Error in POST /organizations/:organizationId/users/admin:', error);
      if (error instanceof Error) {
        return res.status(400).json({ error: error.message });
      }
      return res.status(500).json({ error: 'Failed to create admin user' });
    }
  }
);

/**
 * @swagger
 * /api/admin/organizations/{organizationId}/users/account:
 *   post:
 *     summary: Create account user
 *     tags: [Organization Users]
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
 *               - email
 *               - firstName
 *               - lastName
 *             properties:
 *               email:
 *                 type: string
 *               firstName:
 *                 type: string
 *               lastName:
 *                 type: string
 *               temporaryPassword:
 *                 type: string
 *     responses:
 *       201:
 *         description: Account user created
 */
router.post(
  '/:organizationId/users/account',
  authenticateToken(),
  async (req: Request, res: Response) => {
    try {
      const { organizationId } = req.params;
      const userId = (req as any).user?.sub;

      const user = await organizationUserService.createAccountUser(
        organizationId,
        { ...req.body, userType: 'account-user' },
        userId
      );

      return res.status(201).json(user);
    } catch (error) {
      logger.error('Error in POST /organizations/:organizationId/users/account:', error);
      if (error instanceof Error) {
        return res.status(400).json({ error: error.message });
      }
      return res.status(500).json({ error: 'Failed to create account user' });
    }
  }
);

/**
 * @swagger
 * /api/admin/organizations/{organizationId}/users/{id}:
 *   put:
 *     summary: Update user
 *     tags: [Organization Users]
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
 *         description: User updated
 */
router.put(
  '/:organizationId/users/:id',
  authenticateToken(),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const userId = (req as any).user?.sub;

      const user = await organizationUserService.updateUser(id, req.body, userId);

      return res.json(user);
    } catch (error) {
      logger.error('Error in PUT /organizations/:organizationId/users/:id:', error);
      if (error instanceof Error) {
        return res.status(400).json({ error: error.message });
      }
      return res.status(500).json({ error: 'Failed to update user' });
    }
  }
);

/**
 * @swagger
 * /api/admin/organizations/{organizationId}/users/{id}:
 *   delete:
 *     summary: Delete user
 *     tags: [Organization Users]
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
 *         description: User deleted
 */
router.delete(
  '/:organizationId/users/:id',
  authenticateToken(),
  requireRole('super-admin'),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      await organizationUserService.deleteUser(id);

      return res.status(204).send();
    } catch (error) {
      logger.error('Error in DELETE /organizations/:organizationId/users/:id:', error);
      return res.status(500).json({ error: 'Failed to delete user' });
    }
  }
);

/**
 * @swagger
 * /api/admin/organizations/{organizationId}/users/{id}/roles:
 *   post:
 *     summary: Assign role to user
 *     tags: [Organization Users]
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
 *             required:
 *               - roleId
 *             properties:
 *               roleId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Role assigned
 */
router.post(
  '/:organizationId/users/:id/roles',
  authenticateToken(),
  requireRole('super-admin'),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { roleId } = req.body;
      const userId = (req as any).user?.sub;

      await organizationUserService.assignRole(id, roleId, userId);

      return res.json({ message: 'Role assigned successfully' });
    } catch (error) {
      logger.error('Error in POST /organizations/:organizationId/users/:id/roles:', error);
      return res.status(500).json({ error: 'Failed to assign role' });
    }
  }
);

/**
 * @swagger
 * /api/admin/organizations/{organizationId}/users/{id}/roles/{roleId}:
 *   delete:
 *     summary: Remove role from user
 *     tags: [Organization Users]
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
 *       - in: path
 *         name: roleId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Role removed
 */
router.delete(
  '/:organizationId/users/:id/roles/:roleId',
  authenticateToken(),
  requireRole('super-admin'),
  async (req: Request, res: Response) => {
    try {
      const { id, roleId } = req.params;
      await organizationUserService.removeRole(id, roleId);

      return res.json({ message: 'Role removed successfully' });
    } catch (error) {
      logger.error('Error in DELETE /organizations/:organizationId/users/:id/roles/:roleId:', error);
      return res.status(500).json({ error: 'Failed to remove role' });
    }
  }
);

/**
 * @swagger
 * /api/admin/organizations/{organizationId}/users/{id}/reset-password:
 *   post:
 *     summary: Reset user password
 *     tags: [Organization Users]
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
 *             required:
 *               - newPassword
 *             properties:
 *               newPassword:
 *                 type: string
 *     responses:
 *       200:
 *         description: Password reset
 */
router.post(
  '/:organizationId/users/:id/reset-password',
  authenticateToken(),
  requireRole('super-admin'),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { newPassword } = req.body;

      await organizationUserService.resetPassword(id, newPassword);

      return res.json({ message: 'Password reset successfully' });
    } catch (error) {
      logger.error('Error in POST /organizations/:organizationId/users/:id/reset-password:', error);
      return res.status(500).json({ error: 'Failed to reset password' });
    }
  }
);

export default router;
