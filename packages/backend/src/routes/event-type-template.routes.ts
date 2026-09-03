import { Router, Request, Response } from 'express';
import { authenticateToken, requireRole } from '../middleware/auth.middleware';
import { audited } from '../middleware/audit.middleware';
import { AppError } from '../middleware/errors';
import { logger } from '../config/logger';
import { eventTypeTemplateService } from '../services/event-type-template.service';

/**
 * Event type templates, and the rules a federation fixes on them.
 *
 * Task S0-4 of docs/EVENT_SCHEDULING_TASKS_S0_S1.md. **Platform
 * administrators only** — every route here is `requireRole('super-admin')`.
 * The club's own view of the same data is three routes in
 * `orgadmin-organisation.routes.ts`, which see published templates their
 * capabilities reveal and nothing else.
 *
 * The organisation-type rules hang off the template rather than off
 * `/api/admin/organization-types/:id`, because they are one template's settings
 * seen from one federation, and putting them here keeps the whole feature in
 * one router under one mount.
 */

const router = Router();

/**
 * Answer with the right status, or fail honestly.
 *
 * The service raises `NotFoundError`, `BadRequestError` and `ForbiddenError`
 * for things a caller can correct. Wrapping every handler in a bare
 * `catch → 500` — the pattern in the older admin routers — would turn "no such
 * template" into "the server broke", so a carried status code is used and only
 * an unrecognised error becomes a 500.
 */
function handle(failureMessage: string, handler: (req: Request, res: Response) => Promise<void>) {
  return async (req: Request, res: Response): Promise<void> => {
    try {
      await handler(req, res);
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
 * @swagger
 * /api/admin/event-type-templates:
 *   get:
 *     summary: Every event type template, drafts included (super admin only)
 *     tags: [EventTypeTemplates]
 *     responses:
 *       200:
 *         description: The templates, by display name
 *       403:
 *         description: Forbidden - super admin only
 */
router.get(
  '/',
  authenticateToken(),
  requireRole('super-admin'),
  handle('Failed to load event type templates', async (_req, res) => {
    res.json(await eventTypeTemplateService.listTemplates());
  })
);

/**
 * @swagger
 * /api/admin/event-type-templates/{id}:
 *   get:
 *     summary: One event type template (super admin only)
 *     tags: [EventTypeTemplates]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: The template
 *       404:
 *         description: No such template
 */
router.get(
  '/:id',
  authenticateToken(),
  requireRole('super-admin'),
  handle('Failed to load the event type template', async (req, res) => {
    res.json(await eventTypeTemplateService.getTemplate(req.params.id));
  })
);

/**
 * @swagger
 * /api/admin/event-type-templates:
 *   post:
 *     summary: Create an event type template (super admin only)
 *     description: >
 *       Created as a draft unless a status is given. A draft is invisible to
 *       clubs, so a half-defined discipline cannot be pointed at by an event.
 *     tags: [EventTypeTemplates]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [key, displayName]
 *             properties:
 *               key: { type: string, example: equestrian.eventing }
 *               displayName: { type: string }
 *               description: { type: string, nullable: true }
 *               capability:
 *                 type: string
 *                 nullable: true
 *                 description: Which capability reveals this template to a club. Null means no gate beyond event-scheduling.
 *               schedulerKind: { type: string, default: sequential-phases }
 *               shape: { type: object }
 *               defaultSettings:
 *                 type: object
 *                 description: A flat map of dotted keys, e.g. `minutesPerCompetitor.dressage`.
 *               status: { type: string, enum: [draft, published] }
 *     responses:
 *       201:
 *         description: Created
 *       403:
 *         description: Forbidden - super admin only
 */
router.post(
  '/',
  authenticateToken(),
  requireRole('super-admin'),
  audited({
    action: 'event-template.updated',
    entityType: 'event-type-template',
    kind: 'create',
    label: (after) => (after?.displayName as string) ?? undefined,
  }),
  handle('Failed to create the event type template', async (req, res) => {
    res.status(201).json(await eventTypeTemplateService.createTemplate(req.body));
  })
);

/**
 * @swagger
 * /api/admin/event-type-templates/{id}:
 *   put:
 *     summary: Update an event type template (super admin only)
 *     description: >
 *       Only the fields present are changed. `capability` is the exception that
 *       accepts an explicit null, because null is one of its meanings.
 *     tags: [EventTypeTemplates]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { type: object }
 *     responses:
 *       200:
 *         description: The updated template
 *       404:
 *         description: No such template
 */
router.put(
  '/:id',
  authenticateToken(),
  requireRole('super-admin'),
  audited({
    action: 'event-template.updated',
    entityType: 'event-type-template',
    kind: 'update',
    label: (after) => (after?.displayName as string) ?? undefined,
  }),
  handle('Failed to update the event type template', async (req, res) => {
    res.json(await eventTypeTemplateService.updateTemplate(req.params.id, req.body));
  })
);

/**
 * @swagger
 * /api/admin/event-type-templates/{id}/rules/organisation-type/{organizationTypeId}:
 *   get:
 *     summary: A template's settings as one organisation type sees them (super admin only)
 *     description: >
 *       Two levels rather than three — the template's defaults with the type's
 *       overrides applied — plus the keys the type has locked. `sources` says
 *       where each value came from, which is the screen's `From` column.
 *     tags: [EventTypeTemplates]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: organizationTypeId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Resolved settings, their sources and the locked keys
 *       404:
 *         description: No such template
 */
router.get(
  '/:id/rules/organisation-type/:organizationTypeId',
  authenticateToken(),
  requireRole('super-admin'),
  handle('Failed to load the event rules', async (req, res) => {
    res.json(
      await eventTypeTemplateService.resolveSettingsForType(
        req.params.id,
        req.params.organizationTypeId
      )
    );
  })
);

/**
 * @swagger
 * /api/admin/event-type-templates/{id}/rules/organisation-type/{organizationTypeId}:
 *   put:
 *     summary: Set an organisation type's event rules, and fix keys against its clubs (super admin only)
 *     description: >
 *       `settings` holds **only what differs** from the template, so raising a
 *       platform default still reaches every type that never overrode it.
 *       `lockedKeys` names settings no club of this type may change; a key may
 *       be locked without being set, which fixes the template's own value.
 *     tags: [EventTypeTemplates]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: organizationTypeId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               settings: { type: object }
 *               lockedKeys: { type: array, items: { type: string } }
 *     responses:
 *       200:
 *         description: The rules as they now resolve for this type
 *       400:
 *         description: A locked key names a setting the template does not define
 *       404:
 *         description: No such template
 */
router.put(
  '/:id/rules/organisation-type/:organizationTypeId',
  authenticateToken(),
  requireRole('super-admin'),
  audited({
    action: 'event-rules.updated',
    entityType: 'event-type-template',
    kind: 'update',
    values: (req) => ({
      organizationTypeId: req.params.organizationTypeId,
      settings: req.body?.settings ?? {},
      lockedKeys: req.body?.lockedKeys ?? [],
    }),
  }),
  handle('Failed to save the event rules', async (req, res) => {
    res.json(
      await eventTypeTemplateService.saveTypeOverride(
        req.params.id,
        req.params.organizationTypeId,
        { settings: req.body?.settings ?? {}, lockedKeys: req.body?.lockedKeys }
      )
    );
  })
);

export default router;
