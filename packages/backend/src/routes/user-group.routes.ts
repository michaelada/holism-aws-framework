import { Router, Response } from 'express';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth.middleware';
import { db } from '../database/pool';
import { logger } from '../config/logger';
import { AppError } from '../middleware/errors';
import { userGroupService } from '../services/user-group.service';

/**
 * Account-user groups, for an org admin.
 *
 * Mounted under /api/orgadmin. The organisation is resolved from the caller's
 * token rather than taken from the path, matching the rest of the org-admin
 * surface — so an admin can only ever manage their own organisation's groups.
 */

const router = Router();

async function resolveOrganisationId(keycloakUserId: string): Promise<string | null> {
  const result = await db.query(
    `SELECT organization_id FROM organization_users
     WHERE keycloak_user_id = $1 AND user_type = 'org-admin' AND status = 'active'
     LIMIT 1`,
    [keycloakUserId]
  );
  return result.rows.length > 0 ? result.rows[0].organization_id : null;
}

function withOrganisation(
  failureMessage: string,
  handler: (organisationId: string, req: AuthenticatedRequest, res: Response) => Promise<void>
) {
  return async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const keycloakUserId = req.user?.userId;
      if (!keycloakUserId) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      const organisationId = await resolveOrganisationId(keycloakUserId);
      if (!organisationId) {
        res.status(403).json({ error: 'User is not an organization administrator' });
        return;
      }

      await handler(organisationId, req, res);
    } catch (error) {
      if (error instanceof AppError) {
        logger.warn(`${failureMessage}: ${error.message}`);
        res.status(error.statusCode).json({ error: error.message });
        return;
      }
      logger.error(`${failureMessage}:`, error);
      res.status(500).json({ error: failureMessage });
    }
  };
}

/**
 * @openapi
 * /api/orgadmin/user-groups:
 *   get:
 *     summary: Account-user groups in this organisation
 *     tags: [OrgAdmin]
 *     responses:
 *       200:
 *         description: Groups with member counts
 */
router.get(
  '/user-groups',
  authenticateToken(),
  withOrganisation('Failed to load user groups', async (organisationId, _req, res) => {
    res.json({ groups: await userGroupService.list(organisationId) });
  })
);

/**
 * @openapi
 * /api/orgadmin/user-groups:
 *   post:
 *     summary: Create a group
 *     tags: [OrgAdmin]
 *     responses:
 *       201:
 *         description: The created group
 *       400:
 *         description: Missing name, or the name is already used
 */
router.post(
  '/user-groups',
  authenticateToken(),
  withOrganisation('Failed to create the user group', async (organisationId, req, res) => {
    const group = await userGroupService.create(organisationId, req.body ?? {});
    res.status(201).json(group);
  })
);

/**
 * @openapi
 * /api/orgadmin/user-groups/{id}:
 *   put:
 *     summary: Rename or re-describe a group
 *     tags: [OrgAdmin]
 *     responses:
 *       200:
 *         description: The updated group
 */
router.put(
  '/user-groups/:id',
  authenticateToken(),
  withOrganisation('Failed to update the user group', async (organisationId, req, res) => {
    const group = await userGroupService.update(organisationId, req.params.id, req.body ?? {});
    res.json(group);
  })
);

/**
 * @openapi
 * /api/orgadmin/user-groups/{id}:
 *   delete:
 *     summary: Delete a group
 *     description: >
 *       Memberships cascade. Reports how many discounts still name this group
 *       in their eligibility rules — those are left alone rather than rewritten.
 *     tags: [OrgAdmin]
 *     responses:
 *       200:
 *         description: Deleted, with the count of discounts still referencing it
 */
router.delete(
  '/user-groups/:id',
  authenticateToken(),
  withOrganisation('Failed to delete the user group', async (organisationId, req, res) => {
    const result = await userGroupService.remove(organisationId, req.params.id);
    res.json(result);
  })
);

/**
 * @openapi
 * /api/orgadmin/user-groups/{id}/members:
 *   get:
 *     summary: Who is in a group
 *     tags: [OrgAdmin]
 *     responses:
 *       200:
 *         description: The group's members
 */
router.get(
  '/user-groups/:id/members',
  authenticateToken(),
  withOrganisation('Failed to load group members', async (organisationId, req, res) => {
    res.json({ members: await userGroupService.listMembers(organisationId, req.params.id) });
  })
);

/**
 * @openapi
 * /api/orgadmin/user-groups/{id}/members:
 *   post:
 *     summary: Add account users to a group
 *     description: >
 *       Rejects anyone who is not an active account user of this organisation,
 *       rather than skipping them silently. Repeating the call is safe.
 *     tags: [OrgAdmin]
 *     responses:
 *       200:
 *         description: How many were newly added
 *       400:
 *         description: One or more of the people selected are not eligible
 */
router.post(
  '/user-groups/:id/members',
  authenticateToken(),
  withOrganisation('Failed to add group members', async (organisationId, req, res) => {
    const added = await userGroupService.addMembers(
      organisationId,
      req.params.id,
      req.body?.organisationUserIds ?? []
    );
    res.json({ added });
  })
);

/**
 * @openapi
 * /api/orgadmin/user-groups/{id}/members/{userId}:
 *   delete:
 *     summary: Remove someone from a group
 *     tags: [OrgAdmin]
 *     responses:
 *       204:
 *         description: Removed
 *       404:
 *         description: That person is not in this group
 */
router.delete(
  '/user-groups/:id/members/:userId',
  authenticateToken(),
  withOrganisation('Failed to remove the group member', async (organisationId, req, res) => {
    await userGroupService.removeMember(organisationId, req.params.id, req.params.userId);
    res.status(204).send();
  })
);

export default router;
