import { Router, Response } from 'express';
import { requireAuth, requireAdminRole, AuthenticatedRequest } from '../middleware/auth.middleware';
import { UserService } from '../services/user.service';
import { RoleService } from '../services/role.service';
import { createKeycloakAdminService } from '../services/keycloak-admin.factory';
import { db } from '../database/pool';
import { recordAudit } from '../services/audit/with-audit';

const router = Router();

// Initialize services
const kcAdminService = createKeycloakAdminService();
const userService = new UserService(kcAdminService, db);
const roleService = new RoleService(kcAdminService, db);

// Apply authentication and admin role check to all admin routes
router.use(requireAuth());
router.use(requireAdminRole());

/**
 * Tenant Management Routes
 */

/*
 * Tenants were removed here.
 *
 * The five endpoints under /api/admin/tenants created, listed, updated and
 * deleted rows in a table nothing else in the platform read. `organizations`
 * never had a `tenant_id`; the boundary that actually groups organisations is
 * the **organisation type**. See docs/RETIRE_TENANTS.md.
 */

/**
 * @swagger
 * /api/admin/users:
 *   post:
 *     summary: Create a new user
 *     description: Create a new user in Keycloak with profile, credentials, organisation, and roles
 *     tags: [Admin - Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - email
 *               - firstName
 *               - lastName
 *             properties:
 *               username:
 *                 type: string
 *               email:
 *                 type: string
 *               firstName:
 *                 type: string
 *               lastName:
 *                 type: string
 *               password:
 *                 type: string
 *               temporaryPassword:
 *                 type: boolean
 *               emailVerified:
 *                 type: boolean
 *               phoneNumber:
 *                 type: string
 *               department:
 *                 type: string
 *               organizationId:
 *                 type: string
 *               roles:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       201:
 *         description: User created successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - requires admin role
 *       409:
 *         description: Conflict - user already exists
 *       500:
 *         description: Internal server error
 */
router.post('/users', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userData = req.body;

    // Validation
    if (!userData.username || !userData.email || !userData.firstName || !userData.lastName) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Missing required fields: username, email, firstName, and lastName are required',
        },
      });
    }

    // Create user
    const user = await userService.createUser(userData);

    // Log admin action
    recordAudit(req, {
      action: 'user.org-admin-created',
      entityType: 'user',
      entityId: user.id,
      values: { username: userData.username, email: userData.email, organizationId: userData.organizationId, roles: userData.roles },
    });

    return res.status(201).json(user);
  } catch (error: any) {
    console.error('Error creating user:', error);

    if (error.message?.includes('already exists') || error.code === '23505') {
      return res.status(409).json({
        error: {
          code: 'CONFLICT',
          message: 'User with this username or email already exists',
        },
      });
    }

    return res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to create user',
      },
    });
  }
});

/**
 * @swagger
 * /api/admin/users:
 *   get:
 *     summary: List all users
 *     description: Retrieve all users with optional filters
 *     tags: [Admin - Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search term for username or email
 *       - in: query
 *         name: email
 *         schema:
 *           type: string
 *         description: Filter by email
 *       - in: query
 *         name: organizationId
 *         schema:
 *           type: string
 *         description: Filter by organisation ID
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Maximum number of results
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *         description: Offset for pagination
 *     responses:
 *       200:
 *         description: List of users
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - requires admin role
 *       500:
 *         description: Internal server error
 */
router.get('/users', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const filters = {
      search: req.query.search as string,
      email: req.query.email as string,
      organizationId: req.query.organizationId as string,
      limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
      offset: req.query.offset ? parseInt(req.query.offset as string) : undefined,
    };

    const users = await userService.getUsers(filters);
    return res.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    return res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch users',
      },
    });
  }
});

/**
 * @swagger
 * /api/admin/users/{id}:
 *   get:
 *     summary: Get user by ID
 *     description: Retrieve a single user by their ID
 *     tags: [Admin - Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *     responses:
 *       200:
 *         description: User found
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - requires admin role
 *       404:
 *         description: User not found
 *       500:
 *         description: Internal server error
 */
router.get('/users/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const user = await userService.getUserById(id);

    if (!user) {
      return res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: `User with ID '${id}' not found`,
        },
      });
    }

    return res.json(user);
  } catch (error) {
    console.error('Error fetching user:', error);
    return res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch user',
      },
    });
  }
});

/**
 * @swagger
 * /api/admin/users/{id}:
 *   put:
 *     summary: Update a user
 *     description: Update user information in both Keycloak and database
 *     tags: [Admin - Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *               firstName:
 *                 type: string
 *               lastName:
 *                 type: string
 *               enabled:
 *                 type: boolean
 *               phoneNumber:
 *                 type: string
 *               department:
 *                 type: string
 *               organizationId:
 *                 type: string
 *               roles:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: User updated successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - requires admin role
 *       404:
 *         description: User not found
 *       500:
 *         description: Internal server error
 */
router.put('/users/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const user = await userService.updateUser(id, updates);

    if (!user) {
      return res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: `User with ID '${id}' not found`,
        },
      });
    }

    // Log admin action
    recordAudit(req, {
      action: 'user.org-admin-updated',
      entityType: 'user',
      entityId: id,
      values: updates,
    });

    return res.json(user);
  } catch (error) {
    console.error('Error updating user:', error);
    return res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to update user',
      },
    });
  }
});

/**
 * @swagger
 * /api/admin/users/{id}:
 *   delete:
 *     summary: Delete a user
 *     description: Delete user from both Keycloak and database
 *     tags: [Admin - Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *     responses:
 *       204:
 *         description: User deleted successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - requires admin role
 *       404:
 *         description: User not found
 *       500:
 *         description: Internal server error
 */
router.delete('/users/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    await userService.deleteUser(id);

    // Log admin action
    recordAudit(req, {
      action: 'user.org-admin-deleted',
      entityType: 'user',
      entityId: id,
    });

    return res.status(204).send();
  } catch (error: any) {
    console.error('Error deleting user:', error);

    if (error.message?.includes('not found')) {
      return res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: `User with ID '${req.params.id}' not found`,
        },
      });
    }

    return res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to delete user',
      },
    });
  }
});

/**
 * @swagger
 * /api/admin/users/{id}/reset-password:
 *   post:
 *     summary: Reset user password
 *     description: Reset a user's password with optional temporary flag
 *     tags: [Admin - Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - password
 *             properties:
 *               password:
 *                 type: string
 *               temporary:
 *                 type: boolean
 *                 default: true
 *     responses:
 *       200:
 *         description: Password reset successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - requires admin role
 *       404:
 *         description: User not found
 *       500:
 *         description: Internal server error
 */
router.post('/users/:id/reset-password', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { password, temporary = true } = req.body;

    // Validation
    if (!password) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Password is required',
        },
      });
    }

    await userService.resetPassword(id, password, temporary);

    // Log admin action
    recordAudit(req, {
      action: 'auth.password-reset-requested',
      entityType: 'user',
      entityId: id,
      values: { temporary },
    });

    return res.json({ message: 'Password reset successfully' });
  } catch (error: any) {
    console.error('Error resetting password:', error);

    if (error.message?.includes('not found')) {
      return res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: `User with ID '${req.params.id}' not found`,
        },
      });
    }

    return res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to reset password',
      },
    });
  }
});

/**
 * @swagger
 * /api/admin/users/{id}/roles:
 *   post:
 *     summary: Assign role to user
 *     description: Assign a realm role to a user
 *     tags: [Admin - Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - roleName
 *             properties:
 *               roleName:
 *                 type: string
 *     responses:
 *       200:
 *         description: Role assigned successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - requires admin role
 *       404:
 *         description: User or role not found
 *       500:
 *         description: Internal server error
 */
router.post('/users/:id/roles', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { roleName } = req.body;

    // Validation
    if (!roleName) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Role name is required',
        },
      });
    }

    await userService.assignRoleToUser(id, roleName);

    // Log admin action
    recordAudit(req, {
      action: 'role.assigned',
      entityType: 'user',
      entityId: id,
      values: { roleName },
    });

    return res.json({ message: 'Role assigned successfully' });
  } catch (error: any) {
    console.error('Error assigning role:', error);

    if (error.message?.includes('not found')) {
      return res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: error.message,
        },
      });
    }

    return res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to assign role',
      },
    });
  }
});

/**
 * @swagger
 * /api/admin/users/{id}/roles/{roleId}:
 *   delete:
 *     summary: Remove role from user
 *     description: Remove a realm role from a user
 *     tags: [Admin - Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *       - in: path
 *         name: roleId
 *         required: true
 *         schema:
 *           type: string
 *         description: Role name
 *     responses:
 *       200:
 *         description: Role removed successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - requires admin role
 *       404:
 *         description: User or role not found
 *       500:
 *         description: Internal server error
 */
router.delete('/users/:id/roles/:roleId', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id, roleId } = req.params;

    await userService.removeRoleFromUser(id, roleId);

    // Log admin action
    recordAudit(req, {
      action: 'role.removed',
      entityType: 'user',
      entityId: id,
      values: { roleName: roleId },
    });

    return res.json({ message: 'Role removed successfully' });
  } catch (error: any) {
    console.error('Error removing role:', error);

    if (error.message?.includes('not found')) {
      return res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: error.message,
        },
      });
    }

    return res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to remove role',
      },
    });
  }
});

/**
 * Role Management Routes
 */

/**
 * @swagger
 * /api/admin/roles:
 *   post:
 *     summary: Create a new role
 *     description: Create a new realm role in Keycloak with metadata in database
 *     tags: [Admin - Roles]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - displayName
 *             properties:
 *               name:
 *                 type: string
 *               displayName:
 *                 type: string
 *               description:
 *                 type: string
 *               permissions:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       201:
 *         description: Role created successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - requires admin role
 *       409:
 *         description: Conflict - role already exists
 *       500:
 *         description: Internal server error
 */
router.post('/roles', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const roleData = req.body;

    // Validation
    if (!roleData.name || !roleData.displayName) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Missing required fields: name and displayName are required',
        },
      });
    }

    // Create role
    const role = await roleService.createRole(roleData);

    // Log admin action
    recordAudit(req, {
      action: 'role.created',
      entityType: 'role',
      entityId: role.id,
      values: { name: roleData.name, displayName: roleData.displayName },
    });

    return res.status(201).json(role);
  } catch (error: any) {
    console.error('Error creating role:', error);

    if (error.message?.includes('already exists') || error.code === '23505') {
      return res.status(409).json({
        error: {
          code: 'CONFLICT',
          message: 'Role with this name already exists',
        },
      });
    }

    return res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to create role',
      },
    });
  }
});

/**
 * @swagger
 * /api/admin/roles:
 *   get:
 *     summary: List all roles
 *     description: Retrieve all realm roles from Keycloak
 *     tags: [Admin - Roles]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of roles
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - requires admin role
 *       500:
 *         description: Internal server error
 */
router.get('/roles', async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const roles = await roleService.getRoles();
    return res.json(roles);
  } catch (error) {
    console.error('Error fetching roles:', error);
    return res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch roles',
      },
    });
  }
});

/**
 * @swagger
 * /api/admin/roles/{id}:
 *   delete:
 *     summary: Delete a role
 *     description: Delete role from both Keycloak and database
 *     tags: [Admin - Roles]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Role ID (role name)
 *     responses:
 *       204:
 *         description: Role deleted successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - requires admin role
 *       404:
 *         description: Role not found
 *       500:
 *         description: Internal server error
 */
router.delete('/roles/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    await roleService.deleteRole(id);

    // Log admin action
    recordAudit(req, {
      action: 'role.deleted',
      entityType: 'role',
      entityId: id,
    });

    return res.status(204).send();
  } catch (error: any) {
    console.error('Error deleting role:', error);

    if (error.message?.includes('not found')) {
      return res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: `Role with ID '${req.params.id}' not found`,
        },
      });
    }

    return res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to delete role',
      },
    });
  }
});

export default router;
