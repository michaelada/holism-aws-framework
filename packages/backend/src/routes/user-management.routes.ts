import { Router, Request, Response } from 'express';
import { orgAdminUserService } from '../services/org-admin-user.service';
import { accountUserService } from '../services/account-user.service';
import { authenticateToken } from '../middleware/auth.middleware';
import { logger } from '../config/logger';

const router = Router();

// Apply authentication middleware to all routes
router.use(authenticateToken);

/**
 * Org Admin Users Routes
 * Base path: /api/orgadmin/users/admins
 */

/**
 * GET /api/orgadmin/users/admins/:organizationId
 * Get all admin users for an organization
 */
router.get('/admins/:organizationId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { organizationId } = req.params;

    logger.info('Getting admin users', { organizationId });

    const users = await orgAdminUserService.getAdminUsersByOrganisation(organizationId);

    res.json({
      success: true,
      data: users,
      count: users.length
    });
  } catch (error) {
    logger.error('Error getting admin users:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get admin users'
    });
  }
});

/**
 * POST /api/orgadmin/users/admins/:organizationId
 * Create a new admin user
 */
router.post('/admins/:organizationId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { organizationId } = req.params;
    const { email, firstName, lastName, temporaryPassword, roleIds } = req.body;

    // Validation
    if (!email || !firstName || !lastName) {
      res.status(400).json({
        success: false,
        error: 'Email, first name, and last name are required'
      });
      return;
    }

    logger.info('Creating admin user', { organizationId, email });

    const createdBy = (req as any).user?.sub; // Get user ID from JWT token

    const user = await orgAdminUserService.createAdminUser(
      organizationId,
      { email, firstName, lastName, temporaryPassword, roleIds },
      createdBy
    );

    res.status(201).json({
      success: true,
      data: user
    });
  } catch (error) {
    logger.error('Error creating admin user:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create admin user'
    });
  }
});

/**
 * PUT /api/orgadmin/users/admins/:id
 * Update an admin user
 */
router.put('/admins/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { firstName, lastName, status } = req.body;

    logger.info('Updating admin user', { id });

    const user = await orgAdminUserService.updateAdminUser(id, {
      firstName,
      lastName,
      status
    });

    res.json({
      success: true,
      data: user
    });
  } catch (error) {
    logger.error('Error updating admin user:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update admin user'
    });
  }
});

/**
 * DELETE /api/orgadmin/users/admins/:id
 * Delete an admin user
 */
router.delete('/admins/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    logger.info('Deleting admin user', { id });

    await orgAdminUserService.deleteAdminUser(id);

    res.json({
      success: true,
      message: 'Admin user deleted successfully'
    });
  } catch (error) {
    logger.error('Error deleting admin user:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete admin user'
    });
  }
});

/**
 * POST /api/orgadmin/users/admins/:id/roles
 * Assign roles to an admin user
 */
router.post('/admins/:id/roles', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { roleIds } = req.body;

    if (!roleIds || !Array.isArray(roleIds)) {
      res.status(400).json({
        success: false,
        error: 'roleIds must be an array'
      });
      return;
    }

    logger.info('Assigning roles to admin user', { id, roleIds });

    const assignedBy = (req as any).user?.sub;

    await orgAdminUserService.assignRoles(id, roleIds, assignedBy);

    res.json({
      success: true,
      message: 'Roles assigned successfully'
    });
  } catch (error) {
    logger.error('Error assigning roles:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to assign roles'
    });
  }
});

/**
 * DELETE /api/orgadmin/users/admins/:id/roles/:roleId
 * Remove a role from an admin user
 */
router.delete('/admins/:id/roles/:roleId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id, roleId } = req.params;

    logger.info('Removing role from admin user', { id, roleId });

    await orgAdminUserService.removeRole(id, roleId);

    res.json({
      success: true,
      message: 'Role removed successfully'
    });
  } catch (error) {
    logger.error('Error removing role:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to remove role'
    });
  }
});

/**
 * POST /api/orgadmin/users/admins/:id/reset-password
 * Reset admin user password
 */
router.post('/admins/:id/reset-password', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { newPassword } = req.body;

    if (!newPassword) {
      res.status(400).json({
        success: false,
        error: 'newPassword is required'
      });
      return;
    }

    logger.info('Resetting admin user password', { id });

    await orgAdminUserService.resetPassword(id, newPassword);

    res.json({
      success: true,
      message: 'Password reset successfully'
    });
  } catch (error) {
    logger.error('Error resetting password:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to reset password'
    });
  }
});

/**
 * Account Users Routes
 * Base path: /api/orgadmin/users/accounts
 */

/**
 * GET /api/orgadmin/users/accounts/:organizationId
 * Get all account users for an organization
 */
router.get('/accounts/:organizationId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { organizationId } = req.params;

    logger.info('Getting account users', { organizationId });

    const users = await accountUserService.getAccountUsersByOrganisation(organizationId);

    res.json({
      success: true,
      data: users,
      count: users.length
    });
  } catch (error) {
    logger.error('Error getting account users:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get account users'
    });
  }
});

/**
 * POST /api/orgadmin/users/accounts/:organizationId
 * Create a new account user
 */
router.post('/accounts/:organizationId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { organizationId } = req.params;
    const { email, firstName, lastName, phone, temporaryPassword } = req.body;

    // Validation
    if (!email || !firstName || !lastName) {
      res.status(400).json({
        success: false,
        error: 'Email, first name, and last name are required'
      });
      return;
    }

    logger.info('Creating account user', { organizationId, email });

    const createdBy = (req as any).user?.sub;

    const user = await accountUserService.createAccountUser(
      organizationId,
      { email, firstName, lastName, phone, temporaryPassword },
      createdBy
    );

    res.status(201).json({
      success: true,
      data: user
    });
  } catch (error) {
    logger.error('Error creating account user:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create account user'
    });
  }
});

/**
 * PUT /api/orgadmin/users/accounts/:id
 * Update an account user
 */
router.put('/accounts/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { firstName, lastName, phone, status } = req.body;

    logger.info('Updating account user', { id });

    const user = await accountUserService.updateAccountUser(id, {
      firstName,
      lastName,
      phone,
      status
    });

    res.json({
      success: true,
      data: user
    });
  } catch (error) {
    logger.error('Error updating account user:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update account user'
    });
  }
});

/**
 * DELETE /api/orgadmin/users/accounts/:id
 * Delete an account user
 */
router.delete('/accounts/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    logger.info('Deleting account user', { id });

    await accountUserService.deleteAccountUser(id);

    res.json({
      success: true,
      message: 'Account user deleted successfully'
    });
  } catch (error) {
    logger.error('Error deleting account user:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete account user'
    });
  }
});

/**
 * POST /api/orgadmin/users/accounts/:id/reset-password
 * Reset account user password
 */
router.post('/accounts/:id/reset-password', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { newPassword } = req.body;

    if (!newPassword) {
      res.status(400).json({
        success: false,
        error: 'newPassword is required'
      });
      return;
    }

    logger.info('Resetting account user password', { id });

    await accountUserService.resetPassword(id, newPassword);

    res.json({
      success: true,
      message: 'Password reset successfully'
    });
  } catch (error) {
    logger.error('Error resetting password:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to reset password'
    });
  }
});

export default router;
