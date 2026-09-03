import { Router, Request, Response } from 'express';
import { gateScanService } from '../services/gate-scan.service';
import { authenticateToken } from '../middleware/auth.middleware';
import { requireOrgAdminCapability, OrganisationRequest } from '../middleware/capability.middleware';
import { byResource } from '../middleware/organisation-scope.middleware';
import { audited } from '../middleware/audit.middleware';
import { ValidationError, NotFoundError } from '../middleware/errors';
import { logger } from '../config/logger';

/**
 * The club's side of gate scanning: hand out the right to scan, and take it
 * back.
 *
 * Separate from `/api/scan/*`, which is the gate itself. These routes need an
 * administrator and the `event-ticketing` capability; those need neither, and
 * keeping the two in one file would mean a reader had to check each route to
 * know which kind they were looking at.
 *
 * See docs/GATE_SCANNING.md.
 */

const router = Router({ mergeParams: true });

/**
 * Built per route rather than once at module scope — calling the factories at
 * import time breaks any suite that mocks `auth.middleware` partially.
 */
const guards = () => [authenticateToken(), ...requireOrgAdminCapability('event-ticketing')];

const organisationOf = (req: Request): string => (req as OrganisationRequest).organisationId!;

function fail(res: Response, error: unknown, whileDoing: string) {
  if (error instanceof ValidationError) return res.status(400).json({ error: error.message });
  if (error instanceof NotFoundError) return res.status(404).json({ error: error.message });
  logger.error(`Error ${whileDoing}:`, error);
  return res.status(500).json({ error: `Failed to ${whileDoing}` });
}

/**
 * @openapi
 * /api/orgadmin/events/{eventId}/scan-sessions:
 *   post:
 *     summary: Create a scanning link and PIN for this event
 *     description: >
 *       **The PIN is in this response and nowhere else.** What is stored is a
 *       hash, so a club that loses it creates another session rather than being
 *       told what the old one was.
 *     tags: [Ticketing]
 *     responses:
 *       201:
 *         description: The session, its link token, and the PIN — once
 */
router.post(
  '/events/:eventId/scan-sessions',
  ...guards(),
  byResource('event', 'eventId'),
  audited({
    action: 'ticket-scanning.session-created',
    entityType: 'scan-session',
    kind: 'create',
    label: () => 'Gate scanning link',
  }),
  async (req, res) => {
    try {
      const created = await gateScanService.createSession(
        organisationOf(req),
        req.params.eventId,
        {
          hours: Number(req.body?.hours) || undefined,
          createdBy: (req as OrganisationRequest).organisationUserId ?? null,
        }
      );
      return res.status(201).json(created);
    } catch (error) {
      return fail(res, error, 'create the scanning link');
    }
  }
);

/**
 * @openapi
 * /api/orgadmin/events/{eventId}/scan-sessions:
 *   get:
 *     summary: The scanning sessions for this event, and who is scanning
 *     tags: [Ticketing]
 *     responses:
 *       200:
 *         description: Sessions newest first, each with its stewards
 */
router.get(
  '/events/:eventId/scan-sessions',
  ...guards(),
  byResource('event', 'eventId'),
  async (req, res) => {
    try {
      return res.json({
        sessions: await gateScanService.listSessions(organisationOf(req), req.params.eventId),
      });
    } catch (error) {
      return fail(res, error, 'load the scanning sessions');
    }
  }
);

/**
 * @openapi
 * /api/orgadmin/scan-sessions/{sessionId}:
 *   delete:
 *     summary: Stop a scanning session now
 *     description: >
 *       Every phone on that session stops at its next request, which is the
 *       point of them sharing one — a phone left in a field is cut off without
 *       changing anybody else's afternoon.
 *     tags: [Ticketing]
 *     responses:
 *       204:
 *         description: Revoked
 */
router.delete(
  '/scan-sessions/:sessionId',
  ...guards(),
  byResource('scanSession', 'sessionId'),
  audited({
    action: 'ticket-scanning.session-revoked',
    entityType: 'scan-session',
    param: 'sessionId',
    kind: 'delete',
    label: () => 'Gate scanning link',
  }),
  async (req, res) => {
    try {
      await gateScanService.revokeSession(organisationOf(req), req.params.sessionId);
      return res.status(204).send();
    } catch (error) {
      return fail(res, error, 'stop the scanning session');
    }
  }
);

export default router;
