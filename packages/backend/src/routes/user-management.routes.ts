import { Router, Request, Response } from 'express';
import { orgAdminUserService } from '../services/org-admin-user.service';
import { accountUserService } from '../services/account-user.service';
import { organizationAdminRoleService } from '../services/organization-admin-role.service';
import { authenticateToken } from '../middleware/auth.middleware';
import { byParam, byResource } from '../middleware/organisation-scope.middleware';
import { logger } from '../config/logger';

const router = Router();

/*
 * Authentication for every route here — and, from now on, an organisation check
 * on every route as well.
 *
 * These are the credential routes: creating administrators, resetting their
 * passwords, deleting them. They carried `authenticateToken()` and nothing
 * else, so **any signed-in user of any club** could set any administrator's
 * password in any organisation, or make themselves one. Authentication says who
 * somebody is; it never said which club they may act in.
 *
 * Each route now declares what it is scoped by: `:organizationId` where the
 * path already names one (American spelling here, unlike the newer routes), or
 * the organisation that owns the person being acted on.
 *
 * See docs/ORGADMIN_MULTI_ORGANISATION.md §0.
 */
router.use(authenticateToken());

/** The person in `:id` — an administrator or an account user — and their club. */
const scopedToTheUser = byResource('organisationUser', 'id');
/** The club named in the path. */
const scopedToTheOrganisation = byParam('organizationId');

/**
 * Org Admin Users Routes
 * Base path: /api/orgadmin/users/admins
 */

/**
 * GET /api/orgadmin/users/admins/:organizationId
 * Get all admin users for an organization
 */
router.get('/admins/:organizationId', scopedToTheOrganisation, async (req: Request, res: Response): Promise<void> => {
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
router.post('/admins/:organizationId', scopedToTheOrganisation, async (req: Request, res: Response): Promise<void> => {
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
    const statusCode = (error as any).statusCode || 500;
    res.status(statusCode).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create admin user'
    });
  }
});

/**
 * PUT /api/orgadmin/users/admins/:id
 * Update an admin user
 */
router.put('/admins/:id', scopedToTheUser, async (req: Request, res: Response): Promise<void> => {
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
router.delete('/admins/:id', scopedToTheUser, async (req: Request, res: Response): Promise<void> => {
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
router.post('/admins/:id/roles', scopedToTheUser, async (req: Request, res: Response): Promise<void> => {
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

    logger.info('Syncing roles for admin user', { id, roleIds });

    const assignedBy = (req as any).user?.sub;

    await orgAdminUserService.syncRoles(id, roleIds, assignedBy);

    res.json({
      success: true,
      message: 'Roles updated successfully'
    });
  } catch (error) {
    logger.error('Error syncing roles:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update roles'
    });
  }
});

/**
 * DELETE /api/orgadmin/users/admins/:id/roles/:roleId
 * Remove a role from an admin user
 */
router.delete('/admins/:id/roles/:roleId', scopedToTheUser, async (req: Request, res: Response): Promise<void> => {
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
 * POST /api/orgadmin/users/admins/:id/resend-invite
 * Resend invitation email to an admin user who hasn't activated
 */
router.post('/admins/:id/resend-invite', scopedToTheUser, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    logger.info('Resending invite for admin user', { id });

    await orgAdminUserService.resendInvite(id);

    res.json({
      success: true,
      message: 'Invitation resent successfully'
    });
  } catch (error) {
    logger.error('Error resending invite:', error);
    const statusCode = (error as any).statusCode || 500;
    res.status(statusCode).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to resend invitation'
    });
  }
});

/**
 * POST /api/orgadmin/users/admins/:id/reset-password
 * Reset admin user password
 */
router.post('/admins/:id/reset-password', scopedToTheUser, async (req: Request, res: Response): Promise<void> => {
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
router.get('/accounts/:organizationId', scopedToTheOrganisation, async (req: Request, res: Response): Promise<void> => {
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
router.post('/accounts/:organizationId', scopedToTheOrganisation, async (req: Request, res: Response): Promise<void> => {
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
router.put('/accounts/:id', scopedToTheUser, async (req: Request, res: Response): Promise<void> => {
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
router.delete('/accounts/:id', scopedToTheUser, async (req: Request, res: Response): Promise<void> => {
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
router.post('/accounts/:id/reset-password', scopedToTheUser, async (req: Request, res: Response): Promise<void> => {
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

/**
 * GET /api/orgadmin/users/roles/:organizationId
 * Get all admin roles for an organization (accessible by org admins)
 */
router.get('/roles/:organizationId', scopedToTheOrganisation, async (req: Request, res: Response): Promise<void> => {
  try {
    const { organizationId } = req.params;

    logger.info('Getting organization roles', { organizationId });

    const roles = await organizationAdminRoleService.getRolesByOrganization(organizationId);

    res.json(roles);
  } catch (error) {
    logger.error('Error getting organization roles:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get roles'
    });
  }
});

export default router;
