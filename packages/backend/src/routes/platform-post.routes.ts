import { Router, Request, Response } from 'express';
import multer from 'multer';
import { DeleteObjectCommand } from '@aws-sdk/client-s3';
import { s3Client, S3_BUCKET_NAME } from '../config/aws.config';
import { platformPostService } from '../services/platform-post.service';
import { fileUploadService } from '../services/file-upload.service';
import { authenticateToken, requireRole } from '../middleware/auth.middleware';
import { ValidationError, NotFoundError } from '../middleware/errors';
import { logger } from '../config/logger';
import { audited } from '../middleware/audit.middleware';

/**
 * Platform posts — the super admin's side.
 *
 * Every route here is `super-admin`. These posts are shown to the entire
 * platform on a page nobody has signed in to yet, so the ability to write one
 * is the ability to put text in front of every user of the product at once.
 * That is a narrower power than "an administrator of some organisation".
 *
 * The anonymous reads live in `public.routes` with the rest of the
 * no-token surface, deliberately: keeping them here would put a route with no
 * authentication in a file whose every other route is the most privileged in
 * the system, which is exactly the arrangement somebody later reads too
 * quickly.
 */

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  // Enough for a banner photograph, small enough that a login page stays a
  // login page. `fileUploadService.validateFile` re-checks type and size.
  limits: { fileSize: 5 * 1024 * 1024 },
});

/**
 * Applied per route rather than built once at module scope.
 *
 * A module-level `[authenticateToken(), requireRole('super-admin')]` runs both
 * factories the instant this file is imported, so any test that mocks
 * `auth.middleware` with only the function *it* needs takes the whole suite
 * down with "requireRole is not a function" — a failure in a file that has
 * nothing to do with posts. Calling them inside the route list defers it, and
 * matches how every other router here does it.
 */
const adminOnly = () => [authenticateToken(), requireRole('super-admin')];

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

/**
 * @swagger
 * /api/admin/posts:
 *   get:
 *     summary: Every platform post, in the arranged order
 *     tags: [Platform posts]
 */
router.get('/', ...adminOnly(), async (_req: Request, res: Response) => {
  try {
    return res.json(await platformPostService.list());
  } catch (error) {
    return fail(res, error, 'load posts');
  }
});

/**
 * @swagger
 * /api/admin/posts/reorder:
 *   put:
 *     summary: Rearrange the posts
 *     description: >
 *       Takes the complete list of ids in their new order. Declared before
 *       `/:id` because Express matches in order and `reorder` would otherwise
 *       be read as a post id.
 *     tags: [Platform posts]
 */
router.put('/reorder', ...adminOnly(), audited({ action: 'post.reordered', entityType: 'post', kind: 'action' }), async (req: Request, res: Response) => {
  try {
    await platformPostService.reorder(req.body?.orderedIds);
    return res.json(await platformPostService.list());
  } catch (error) {
    return fail(res, error, 'reorder posts');
  }
});

/**
 * @swagger
 * /api/admin/posts/{id}:
 *   get:
 *     summary: One post, as written
 *     tags: [Platform posts]
 */
router.get('/:id', ...adminOnly(), async (req: Request, res: Response) => {
  try {
    return res.json(await platformPostService.get(req.params.id));
  } catch (error) {
    return fail(res, error, 'load the post');
  }
});

/**
 * @swagger
 * /api/admin/posts:
 *   post:
 *     summary: Write a new post
 *     tags: [Platform posts]
 */
router.post('/', ...adminOnly(), audited({ action: 'post.created', resource: 'post', entityType: 'post', label: 'title' }), async (req: Request, res: Response) => {
  try {
    return res.status(201).json(await platformPostService.create(req.body));
  } catch (error) {
    return fail(res, error, 'create the post');
  }
});

/**
 * @swagger
 * /api/admin/posts/{id}:
 *   put:
 *     summary: Edit a post
 *     tags: [Platform posts]
 */
router.put('/:id', ...adminOnly(), audited({ action: 'post.updated', resource: 'post', entityType: 'post', label: 'title' }), async (req: Request, res: Response) => {
  try {
    return res.json(await platformPostService.update(req.params.id, req.body));
  } catch (error) {
    return fail(res, error, 'update the post');
  }
});

/**
 * @swagger
 * /api/admin/posts/{id}:
 *   delete:
 *     summary: Delete a post
 *     tags: [Platform posts]
 */
router.delete('/:id', ...adminOnly(), audited({ action: 'post.deleted', resource: 'post', entityType: 'post', label: 'title' }), async (req: Request, res: Response) => {
  try {
    const { imageKey } = await platformPostService.remove(req.params.id);
    /*
     * The row is already gone, so a failure to tidy up S3 is a stray object
     * rather than a failed delete. Logged and swallowed: telling the operator
     * their delete failed, when it did not, would have them try again.
     */
    if (imageKey) await deleteObjectQuietly(imageKey);
    return res.status(204).send();
  } catch (error) {
    return fail(res, error, 'delete the post');
  }
});

/**
 * @swagger
 * /api/admin/posts/{id}/image:
 *   post:
 *     summary: Attach an image to a post
 *     tags: [Platform posts]
 */
router.post('/:id/image', ...adminOnly(), upload.single('file'), audited({ action: 'post.updated', resource: 'post', entityType: 'post', label: 'title', kind: 'action' }), async (req: Request, res: Response) => {
  try {
    const file = (req as any).file;
    if (!file) throw new ValidationError('No file was uploaded');

    const validation = fileUploadService.validateFile(file, 'image');
    if (!validation.valid) throw new ValidationError(validation.errors.join(', '));

    // Replacing an image leaves the old object behind unless it is removed
    // first, and these accumulate on a table an operator edits repeatedly.
    const existing = await platformPostService.get(req.params.id);
    const previous = await platformPostService.clearImage(existing.id);

    const uploaded = await fileUploadService.uploadPostImage({ postId: req.params.id, file });
    const post = await platformPostService.setImage(req.params.id, {
      s3Key: uploaded.s3Key,
      mimeType: uploaded.mimeType,
    });

    if (previous.imageKey) await deleteObjectQuietly(previous.imageKey);

    return res.json(post);
  } catch (error) {
    return fail(res, error, 'upload the image');
  }
});

/**
 * @swagger
 * /api/admin/posts/{id}/image:
 *   delete:
 *     summary: Remove a post's image
 *     tags: [Platform posts]
 */
router.delete('/:id/image', ...adminOnly(), audited({ action: 'post.updated', resource: 'post', entityType: 'post', label: 'title', kind: 'action' }), async (req: Request, res: Response) => {
  try {
    const { imageKey } = await platformPostService.clearImage(req.params.id);
    if (imageKey) await deleteObjectQuietly(imageKey);
    return res.json(await platformPostService.get(req.params.id));
  } catch (error) {
    return fail(res, error, 'remove the image');
  }
});

async function deleteObjectQuietly(key: string): Promise<void> {
  try {
    await s3Client.send(new DeleteObjectCommand({ Bucket: S3_BUCKET_NAME, Key: key }));
  } catch (error) {
    logger.warn('Could not delete a platform post image from S3', { key, error });
  }
}

export default router;
