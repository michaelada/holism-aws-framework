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
 * Forget a session, so the next token presented under a new one is a fresh
 * sign-in. Called on sign-out.
 */
export function forgetSession(sessionId: string): void {
  seenSessions.delete(sessionId);
}

/**
 * File a sign-in or sign-out under **every** organisation the person belongs
 * to, as one row each.
 *
 * The token does not say which club a session is "for", and for a person who
 * administers three it genuinely is not for any one of them. The previous
 * answer was to attribute the event only when there was exactly one candidate
 * and record `null` otherwise — honest about attribution, but it made the event
 * invisible: the org-admin viewer scopes hard on `organisation_id`
 * (`audit.query.ts`), so a null row appears in nobody's trail. A multi-club
 * admin could never see their own sign-ins, which is precisely the audit
 * question ("was that me?") that this event exists to answer.
 *
 * One row per organisation instead. Each club's trail then correctly shows that
 * an administrator of theirs signed in, which is true of every one of them, and
 * no club is shown anything about a club it has no relationship with. The cost
 * is N rows for an N-club admin, once per session — bounded by `rememberSession`
 * above, and small next to what a null row costs in usefulness.
 *
 * Somebody who belongs to no organisation — a platform admin — still gets a
 * single unattributed row, visible at platform level.
 */
export async function recordSessionEvent(
  action: 'auth.login' | 'auth.logout',
  keycloakUserId: string,
  actor: ReturnType<typeof actorFromRequest>,
  context: Record<string, unknown>
): Promise<void> {
  const unattributed = () => audit.record({ category: 'security', action, actor, context });

  try {
    const result = await db.query(
      `SELECT DISTINCT organization_id FROM organization_users
        WHERE keycloak_user_id = $1 AND organization_id IS NOT NULL`,
      [keycloakUserId]
    );

    const organisationIds: string[] = result.rows.map((row: any) => row.organization_id);
    if (organisationIds.length === 0) return void unattributed();

    for (const organisationId of organisationIds) {
      audit.record({ category: 'security', action, actor, organisationId, context });
    }
  } catch (error) {
    // Still record it, unattributed, rather than losing the event entirely.
    logger.warn('Could not resolve organisations for a session event', { action, error });
    unattributed();
  }
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
 * Belt and braces with `POST /api/audit/session`. That endpoint catches the
 * *failed* sign-ins and the sign-outs this cannot see; this catches sessions
 * established by any route, including ones an application forgets to report.
 * `rememberSession` keeps them from producing two events.
 */
export function noteAuthenticatedRequest(req: Request, application?: string): void {
  try {
    const user = (req as any).user;
    const sessionId = user?.sessionId;
    if (!user?.userId || !sessionId || !rememberSession(sessionId)) return;

    const actor = actorFromRequest(req);
    const context = { ...contextFromRequest(req), application };

    void recordSessionEvent('auth.login', user.userId, actor, context);
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
