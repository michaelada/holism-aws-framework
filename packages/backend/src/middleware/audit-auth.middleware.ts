import type { Request, Response, NextFunction } from 'express';
import { audit, actorFromRequest, contextFromRequest } from '../services/audit';
import { db } from '../database/pool';
import { logger } from '../config/logger';

/**
 * The security events that have no service call to hang off.
 *
 * Everything else in the audit trail is recorded by the service that does the
 * work. Sign-ins, sign-outs and refusals happen in the middleware — or inside
 * Keycloak — so they are recorded here instead.
 *
 * ## What this can and cannot see
 *
 * **Keycloak owns authentication.** A wrong password never reaches this
 * process: the browser posts it to Keycloak, which answers with an error page,
 * and we see nothing. So `auth.login-failed` cannot be observed here, and the
 * applications report it instead (`POST /api/audit/session`), which is why that
 * endpoint exists and why this file does not pretend to cover it.
 *
 * What *is* observable here is the moment a token is first presented, and every
 * refusal — which is the more interesting half for an investigation.
 *
 * See docs/AUDIT_TRAIL_AND_SESSIONS.md §2.2.
 */

/**
 * Sessions already recorded, so one sign-in is one event.
 *
 * A token is presented on every request; without this, a member browsing for
 * ten minutes would produce hundreds of `auth.login` rows and drown the log.
 * Keyed by Keycloak's `sid`, which is stable for the life of the session.
 *
 * In memory and bounded: the consequence of losing it on restart is a duplicate
 * sign-in event per active session, which is a far better failure than an
 * unbounded map.
 */
const seenSessions = new Map<string, number>();
const SESSION_MEMORY_MS = 12 * 60 * 60 * 1000;
const MAX_TRACKED_SESSIONS = 10_000;

function rememberSession(sessionId: string): boolean {
  const now = Date.now();

  if (seenSessions.size > MAX_TRACKED_SESSIONS) {
    for (const [id, at] of seenSessions) {
      if (now - at > SESSION_MEMORY_MS) seenSessions.delete(id);
    }
    // Still oversized after the sweep: forget everything rather than grow.
    if (seenSessions.size > MAX_TRACKED_SESSIONS) seenSessions.clear();
  }

  if (seenSessions.has(sessionId)) return false;
  seenSessions.set(sessionId, now);
  return true;
}

/**
 * Record the first request a session makes as a sign-in.
 *
 * Called from inside `authenticateToken`, at the point `req.user` is set —
 * **not** mounted as global middleware, because `authenticateToken` is applied
 * per route, so anything mounted globally ahead of the routers would run before
 * there was a user to record.
 *
 * Does nothing for an anonymous request: a public page is not a sign-in.
 *
 * Belt and braces with `POST /api/audit/session`, which the applications call.
 * That endpoint catches the *failed* sign-ins this cannot see; this catches
 * sessions established by any route, including ones an application forgets to
 * report. `rememberSession` keeps them from producing two events.
 */
export function noteAuthenticatedRequest(req: Request, application?: string): void {
  try {
    const user = (req as any).user;
    const sessionId = user?.sessionId;
    if (!user?.userId || !sessionId || !rememberSession(sessionId)) return;

    const actor = actorFromRequest(req);
    const context = { ...contextFromRequest(req), application };

    /*
     * Which organisation to file this under.
     *
     * A sign-in is a security event an org admin should see in *their* trail,
     * so it needs an organisation — but the token does not carry one. Resolved
     * once per session (not per request) by the `rememberSession` guard above.
     *
     * Only when the person belongs to exactly one: somebody who administers
     * three clubs has not signed in to any particular one, and picking would put
     * the event in a trail it does not belong to. Null is the honest answer, and
     * the event stays visible at platform level.
     */
    void db
      .query(
        `SELECT DISTINCT organization_id FROM organization_users
          WHERE keycloak_user_id = $1 AND organization_id IS NOT NULL`,
        [user.userId]
      )
      .then((result) => {
        audit.record({
          category: 'security',
          action: 'auth.login',
          actor,
          organisationId: result.rows.length === 1 ? result.rows[0].organization_id : null,
          context,
        });
      })
      .catch((error) => {
        // Still record it, unattributed, rather than losing the sign-in.
        logger.warn('Could not resolve an organisation for a sign-in event', { error });
        audit.record({ category: 'security', action: 'auth.login', actor, context });
      });
  } catch {
    /*
     * Silent by design. This runs inside authentication: an audit problem must
     * never be able to stop somebody signing in.
     */
  }
}

/**
 * Record a refusal.
 *
 * Wraps `res.status(...).json(...)` rather than sitting in an error handler,
 * because refusals here are returned, not thrown: `requireRole` answers 403
 * directly, and an error-handler hook would miss every one of them.
 *
 * Only 401 and 403 are recorded. A 400 is the caller getting the shape wrong,
 * and logging those would bury the refusals that matter under validation noise.
 */
export function auditRefusals() {
  return (req: Request, res: Response, next: NextFunction): void => {
    const originalStatus = res.status.bind(res);

    (res as any).status = (code: number) => {
      if (code === 401 || code === 403) {
        audit.record({
          category: 'security',
          action: 'access.denied',
          outcome: 'denied',
          actor: actorFromRequest(req),
          entityType: 'endpoint',
          entityLabel: `${req.method} ${req.originalUrl?.split('?')[0]}`,
          context: { ...contextFromRequest(req), status: code },
        });
      }
      return originalStatus(code);
    };

    next();
  };
}
