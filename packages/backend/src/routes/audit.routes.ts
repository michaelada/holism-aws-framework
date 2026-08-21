import { Router, Request, Response } from 'express';
import { authenticateToken, requireRole } from '../middleware/auth.middleware';
import { audit, auditQueryService, actorFromRequest, queryFromRequest } from '../services/audit';
import { sessionService } from '../services/session.service';
import { logger } from '../config/logger';

/**
 * The Platform Admin side: the whole platform's audit trail, and who is signed in.
 *
 * Mounted under `/api/admin`, every route `super-admin`. The organisation-scoped
 * twin lives in `orgadmin-organisation.routes` and shares the same query layer —
 * the difference between them is one parameter, which is deliberately
 * **mandatory** so a route cannot forget it and return the whole platform.
 *
 * See docs/AUDIT_TRAIL_AND_SESSIONS.md.
 */

const router = Router();
const adminOnly = () => [authenticateToken(), requireRole('super-admin')];

/**
 * @swagger
 * /api/admin/audit:
 *   get:
 *     summary: The platform-wide audit trail
 *     tags: [Audit]
 */
router.get('/audit', ...adminOnly(), async (req: Request, res: Response) => {
  try {
    const page = await auditQueryService.search(queryFromRequest(req, 'all'));
    return res.json(page);
  } catch (error) {
    logger.error('Error in GET /admin/audit:', error);
    return res.status(500).json({ error: 'Failed to load the audit trail' });
  }
});

/**
 * @swagger
 * /api/admin/audit/filters:
 *   get:
 *     summary: The values worth offering in the filter panel
 *     description: >
 *       Taken from the data rather than from the registry, so the dropdown
 *       offers what has actually happened rather than every action the platform
 *       could theoretically emit.
 *     tags: [Audit]
 */
router.get('/audit/filters', ...adminOnly(), async (_req: Request, res: Response) => {
  try {
    return res.json(await auditQueryService.filterOptions('all'));
  } catch (error) {
    logger.error('Error in GET /admin/audit/filters:', error);
    return res.status(500).json({ error: 'Failed to load the filters' });
  }
});

/**
 * @swagger
 * /api/admin/audit/health:
 *   get:
 *     summary: Whether any audit writes have failed
 *     description: >
 *       Audit writes are deliberately non-blocking, so a failure is a silence.
 *       This surfaces it where the log is read. Read from an in-memory counter,
 *       never from the audit table — recording a failed write *into* the thing
 *       that failed is the loop this design avoids.
 *     tags: [Audit]
 */
router.get('/audit/health', ...adminOnly(), (_req: Request, res: Response) => {
  return res.json(audit.health());
});

/**
 * @swagger
 * /api/admin/audit/{id}:
 *   get:
 *     summary: One event
 *     tags: [Audit]
 */
router.get('/audit/:id', ...adminOnly(), async (req: Request, res: Response) => {
  try {
    const event = await auditQueryService.findById(req.params.id, 'all');
    if (!event) return res.status(404).json({ error: 'Event not found' });
    return res.json(event);
  } catch (error) {
    logger.error('Error in GET /admin/audit/:id:', error);
    return res.status(500).json({ error: 'Failed to load the event' });
  }
});

/**
 * @swagger
 * /api/admin/sessions:
 *   get:
 *     summary: Who is signed in right now
 *     description: >
 *       Read through to Keycloak, which owns sessions. A session means somebody
 *       signed in and has not signed out or timed out — not that they are at the
 *       keyboard.
 *     tags: [Sessions]
 */
router.get('/sessions', ...adminOnly(), async (_req: Request, res: Response) => {
  try {
    return res.json(await sessionService.listLiveSessions());
  } catch (error) {
    logger.error('Error in GET /admin/sessions:', error);
    return res.status(500).json({ error: 'Failed to load sessions' });
  }
});

/**
 * @swagger
 * /api/admin/sessions/{sessionId}:
 *   delete:
 *     summary: End one session
 *     tags: [Sessions]
 */
router.delete('/sessions/:sessionId', ...adminOnly(), async (req: Request, res: Response) => {
  try {
    await sessionService.revokeSession(req.params.sessionId);

    // Signing somebody out is a power, and is recorded as one.
    audit.fromRequest(req, {
      category: 'security',
      action: 'auth.session-revoked',
      entityType: 'session',
      entityId: req.params.sessionId,
    });

    return res.status(204).send();
  } catch (error) {
    logger.error('Error in DELETE /admin/sessions/:sessionId:', error);
    return res.status(500).json({ error: 'Failed to end the session' });
  }
});

/**
 * @swagger
 * /api/admin/sessions/user/{keycloakUserId}:
 *   delete:
 *     summary: End every session for one person
 *     tags: [Sessions]
 */
router.delete(
  '/sessions/user/:keycloakUserId',
  ...adminOnly(),
  async (req: Request, res: Response) => {
    try {
      await sessionService.revokeAllForUser(req.params.keycloakUserId);

      audit.fromRequest(req, {
        category: 'security',
        action: 'auth.sessions-revoked-all',
        entityType: 'user',
        entityId: req.params.keycloakUserId,
      });

      return res.status(204).send();
    } catch (error) {
      logger.error('Error in DELETE /admin/sessions/user/:id:', error);
      return res.status(500).json({ error: 'Failed to end the sessions' });
    }
  }
);

/**
 * @swagger
 * /api/audit/session:
 *   post:
 *     summary: An application reporting the outcome of a sign-in
 *     description: >
 *       Keycloak owns authentication: a wrong password never reaches this
 *       process, so a failed sign-in cannot be observed server-side. The
 *       applications report it as they establish (or fail to establish) a
 *       session. Deliberately unauthenticated for the failure case — there is no
 *       token to present when the sign-in did not work.
 *     tags: [Audit]
 */
export const sessionReportRouter = Router();

sessionReportRouter.post('/session', async (req: Request, res: Response) => {
  try {
    const { outcome, email, application } = req.body ?? {};

    /*
     * Only the two outcomes are accepted, and the body is never trusted for
     * identity: a success is attributed from the token if one was presented,
     * and a failure is anonymous by definition. Otherwise this endpoint would
     * let anybody write an audit row naming anybody.
     */
    if (outcome !== 'success' && outcome !== 'failure') {
      return res.status(400).json({ error: 'outcome must be success or failure' });
    }

    audit.fromRequest(req, {
      category: 'security',
      action: outcome === 'success' ? 'auth.login' : 'auth.login-failed',
      outcome: outcome === 'success' ? 'success' : 'failure',
      actor:
        outcome === 'success'
          ? actorFromRequest(req)
          : { keycloakUserId: null, userType: 'anonymous', display: null, email: null },
      entityType: 'session',
      // The email that was *attempted*, which is the useful part of a failure.
      entityLabel: typeof email === 'string' ? email.slice(0, 255) : undefined,
      context: { application: typeof application === 'string' ? application : undefined },
    });

    return res.status(202).send();
  } catch (error) {
    logger.error('Error in POST /audit/session:', error);
    // Never fail the caller: this is a report, not a transaction.
    return res.status(202).send();
  }
});

export default router;
