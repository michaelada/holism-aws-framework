import { Router, Request, Response } from 'express';
import multer from 'multer';
import { announcementService, ImagePlacement } from '../services/announcement.service';
import { fileUploadService } from '../services/file-upload.service';
import { authenticateToken } from '../middleware/auth.middleware';
import { requireOrgAdminCapability } from '../middleware/capability.middleware';
import { byResource, byCurrentOrganisation } from '../middleware/organisation-scope.middleware';
import { OrganisationRequest } from '../middleware/capability.middleware';
import { audited } from '../middleware/audit.middleware';
import { ValidationError, NotFoundError } from '../middleware/errors';
import { logger } from '../config/logger';

/**
 * A club's announcements — the administrator's side.
 *
 * Every route is gated twice, and both gates are doing different work:
 * `byResource` / `byCurrentOrganisation` establish **which club** this request
 * concerns and refuse a caller who does not administer it;
 * `requireOrgAdminCapability` refuses a club that has not bought the feature.
 * A club without the capability that somehow reaches a URL gets 403 rather than
 * a working screen, because hiding a menu item is not access control.
 *
 * The members' read is not here. It rides on the account dashboard, which
 * already returns the whole home screen in one call.
 */

const router = Router();

const upload = multer({
  // Enough for a photograph of a clubhouse, small enough that a home page stays
  // a home page. `validateFile` re-checks the type and the size.
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

/**
 * Built per route rather than once at module scope.
 *
 * Calling the middleware factories at import time runs them the instant this
 * file is loaded, so a test that mocks `auth.middleware` with only the function
 * it needs takes the whole suite down with "requireCapability is not a
 * function" — in a file that has nothing to do with announcements.
 */
const guards = () => [authenticateToken(), ...requireOrgAdminCapability('org-announcements')];

/** Shape a thrown error into the status it deserves. */
function fail(res: Response, error: unknown, whileDoing: string) {
  if (error instanceof ValidationError) {
    return res.status(400).json({ error: error.message });
  }
  if (error instanceof NotFoundError) {
    return res.status(404).json({ error: error.message });
  }
  logger.error(`Error ${whileDoing}:`, error);
  return res.status(500).json({ error: `Failed to ${whileDoing}` });
}

const organisationOf = (req: Request): string => (req as OrganisationRequest).organisationId!;

/** The label an audit entry carries: the announcement's title. */
const titleOf = (after: any) => after?.title ?? 'Announcement';

/**
 * @openapi
 * /api/orgadmin/announcements:
 *   get:
 *     summary: Every announcement this club has written
 *     description: >
 *       Finished ones included — the list is a record as well as a working
 *       screen, and a club looking for what they said last summer would
 *       otherwise have nowhere to look.
 *     tags: [OrgAdmin]
 *     responses:
 *       200:
 *         description: The announcements, newest window first
 */
router.get('/announcements', ...guards(), byCurrentOrganisation(), async (req, res) => {
  try {
    return res.json({ announcements: await announcementService.list(organisationOf(req)) });
  } catch (error) {
    return fail(res, error, 'load the announcements');
  }
});

/**
 * @openapi
 * /api/orgadmin/announcements/{id}:
 *   get:
 *     summary: One announcement, for the editor
 *     tags: [OrgAdmin]
 *     responses:
 *       200:
 *         description: The announcement
 *       404:
 *         description: No such announcement in this organisation
 */
router.get(
  '/announcements/:id',
  ...guards(),
  byResource('announcement', 'id'),
  async (req, res) => {
    try {
      return res.json(await announcementService.get(organisationOf(req), req.params.id));
    } catch (error) {
      return fail(res, error, 'load the announcement');
    }
  }
);

/**
 * @openapi
 * /api/orgadmin/announcements:
 *   post:
 *     summary: Write an announcement
 *     tags: [OrgAdmin]
 *     responses:
 *       201:
 *         description: Created
 *       400:
 *         description: No title, or a window that ends before it begins
 */
router.post(
  '/announcements',
  ...guards(),
  byCurrentOrganisation(),
  audited({
    action: 'announcement.created',
    entityType: 'announcement',
    kind: 'create',
    label: (row) => titleOf(row),
  }),
  async (req, res) => {
    try {
      const created = await announcementService.create(
        organisationOf(req),
        req.body,
        (req as OrganisationRequest).organisationUserId ?? null
      );
      return res.status(201).json(created);
    } catch (error) {
      return fail(res, error, 'save the announcement');
    }
  }
);

/**
 * @openapi
 * /api/orgadmin/announcements/{id}:
 *   put:
 *     summary: Change an announcement
 *     tags: [OrgAdmin]
 *     responses:
 *       200:
 *         description: Saved
 */
router.put(
  '/announcements/:id',
  ...guards(),
  byResource('announcement', 'id'),
  audited({
    action: 'announcement.updated',
    resource: 'announcement',
    entityType: 'announcement',
    param: 'id',
    kind: 'update',
    label: (row) => titleOf(row),
  }),
  async (req, res) => {
    try {
      return res.json(
        await announcementService.update(organisationOf(req), req.params.id, req.body)
      );
    } catch (error) {
      return fail(res, error, 'save the announcement');
    }
  }
);

/**
 * @openapi
 * /api/orgadmin/announcements/{id}:
 *   delete:
 *     summary: Remove an announcement
 *     description: >
 *       A real delete, unlike most of this product. An announcement has no
 *       history hanging off it — nothing was paid, nothing was granted — and a
 *       club that has taken a notice down means it to be gone.
 *     tags: [OrgAdmin]
 *     responses:
 *       204:
 *         description: Gone
 */
router.delete(
  '/announcements/:id',
  ...guards(),
  byResource('announcement', 'id'),
  audited({
    action: 'announcement.deleted',
    resource: 'announcement',
    entityType: 'announcement',
    param: 'id',
    kind: 'delete',
    label: (row) => titleOf(row),
  }),
  async (req, res) => {
    try {
      const { imageKey } = await announcementService.remove(organisationOf(req), req.params.id);
      if (imageKey) await deleteObjectQuietly(imageKey);
      return res.status(204).send();
    } catch (error) {
      return fail(res, error, 'remove the announcement');
    }
  }
);

/**
 * @openapi
 * /api/orgadmin/announcements/{id}/image:
 *   post:
 *     summary: Attach an image
 *     description: >
 *       A separate step from saving the announcement: the S3 key is derived
 *       from the row's id, so the row has to exist first — and a form that
 *       uploaded before saving would leave an orphan object behind every time
 *       somebody changed their mind.
 *     tags: [OrgAdmin]
 *     responses:
 *       200:
 *         description: The announcement, with its image
 *       400:
 *         description: No file, or not an image we accept
 */
router.post(
  '/announcements/:id/image',
  ...guards(),
  byResource('announcement', 'id'),
  upload.single('file'),
  audited({
    action: 'announcement.updated',
    entityType: 'announcement',
    param: 'id',
    kind: 'action',
    label: (row) => titleOf(row),
  }),
  async (req, res) => {
    try {
      const file = (req as any).file;
      if (!file) throw new ValidationError('Choose an image to upload');

      const validation = fileUploadService.validateFile(file, 'image');
      if (!validation.valid) throw new ValidationError(validation.errors.join(', '));

      const uploaded = await fileUploadService.uploadAnnouncementImage({
        organisationId: organisationOf(req),
        announcementId: req.params.id,
        file,
      });

      const { announcement, previousKey } = await announcementService.setImage(
        organisationOf(req),
        req.params.id,
        {
          s3Key: uploaded.s3Key,
          mimeType: uploaded.mimeType,
          placement: (req.body?.placement as ImagePlacement) || null,
        }
      );

      // Replacing an image leaves the old object behind unless it is removed,
      // and nothing else will ever know the key.
      if (previousKey && previousKey !== uploaded.s3Key) await deleteObjectQuietly(previousKey);

      return res.json(announcement);
    } catch (error) {
      return fail(res, error, 'upload the image');
    }
  }
);

/**
 * @openapi
 * /api/orgadmin/announcements/{id}/image:
 *   delete:
 *     summary: Remove the image, keeping the announcement
 *     tags: [OrgAdmin]
 *     responses:
 *       200:
 *         description: The announcement, without its image
 */
router.delete(
  '/announcements/:id/image',
  ...guards(),
  byResource('announcement', 'id'),
  audited({
    action: 'announcement.updated',
    entityType: 'announcement',
    param: 'id',
    kind: 'action',
    label: (row) => titleOf(row),
  }),
  async (req, res) => {
    try {
      const { announcement, previousKey } = await announcementService.clearImage(
        organisationOf(req),
        req.params.id
      );
      if (previousKey) await deleteObjectQuietly(previousKey);
      return res.json(announcement);
    } catch (error) {
      return fail(res, error, 'remove the image');
    }
  }
);

/**
 * Best-effort tidying of the bucket.
 *
 * The row is the record; the object is a copy of a picture. A failure to delete
 * it is worth a log line and nothing more — turning it into a failed request
 * would mean a club could not remove a notice because of a transient S3 error.
 */
async function deleteObjectQuietly(key: string): Promise<void> {
  try {
    await fileUploadService.deleteFile(key);
  } catch (error) {
    logger.warn('Could not delete an announcement image from S3', { key, error });
  }
}

export default router;
