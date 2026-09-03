import { Response, NextFunction } from 'express';
import { db } from '../database/pool';
import { logger } from '../config/logger';
import { OrganisationRequest, organisationOfRequest } from './capability.middleware';

/**
 * Which organisation an org-admin request is about — for the routes that name a
 * **resource** rather than an organisation.
 *
 * ### Why this exists
 *
 * `/organisations/:organisationId/events` says which club it means, and
 * `capability.middleware` verifies membership of it. Most org-admin routes do
 * not: they say `/events/:id`, `/discounts/:id`, `/tickets/:ticketId`. For those
 * the organisation is a property of the *resource*, and 127 such routes carried
 * `authenticateToken()` and nothing else — no capability check, no role check,
 * no organisation check.
 *
 * Verified against a live database, signed in as an ordinary member with no
 * org-admin row anywhere: `GET /events/:id` returned another club's event and
 * `PUT /events/:id` **wrote to it**. `POST /users/admins/:id/reset-password`
 * would set any administrator's password in any organisation.
 *
 * ### What it does
 *
 * Resolves the owning organisation, then runs it through the same membership
 * check every other org-admin route uses. One guard, one answer to "may this
 * caller act here?", so the two cannot drift apart.
 *
 * ### Where the organisation comes from
 *
 * Four sources, because the routes genuinely differ:
 *
 * - `resource` — look it up from the thing being acted on. The common case.
 * - `param` — an organisation id already in the path under another name
 *   (`:organizationId`, American, in the user-management routes).
 * - `body` — a create: the organisation it names in the payload, or, when it
 *   names none, the one being worked in.
 * - `current` — a collection with nothing to key on, which means "the
 *   organisation I am working in": the `X-Organisation-Id` header.
 *
 * A resource that does not exist and a resource in somebody else's organisation
 * answer identically. Distinguishing them turns any of these routes into a way
 * of asking whether an id is real.
 *
 * See docs/ORGADMIN_MULTI_ORGANISATION.md §0.
 */

/**
 * How to get from a resource id to the organisation that owns it.
 *
 * Note the two spellings. `organisation_id` (British) is used by the tables
 * added for the club-facing modules; `organization_id` (American) by the older
 * platform tables. Both are in the live schema and neither is going to be
 * renamed for this, so the map records which is which rather than guessing.
 */
const OWNER_SQL: Record<string, string> = {
  event: 'SELECT organisation_id FROM events WHERE id = $1',
  eventType: 'SELECT organisation_id FROM event_types WHERE id = $1',
  venue: 'SELECT organisation_id FROM venues WHERE id = $1',
  discount: 'SELECT organisation_id FROM discounts WHERE id = $1',
  membershipType: 'SELECT organisation_id FROM membership_types WHERE id = $1',
  member: 'SELECT organisation_id FROM members WHERE id = $1',
  merchandiseType: 'SELECT organisation_id FROM merchandise_types WHERE id = $1',
  merchandiseOrder: 'SELECT organisation_id FROM merchandise_orders WHERE id = $1',
  calendar: 'SELECT organisation_id FROM calendars WHERE id = $1',
  registrationType: 'SELECT organisation_id FROM registration_types WHERE id = $1',
  registration: 'SELECT organisation_id FROM registrations WHERE id = $1',
  applicationForm: 'SELECT organisation_id FROM application_forms WHERE id = $1',
  applicationField: 'SELECT organisation_id FROM application_fields WHERE id = $1',
  formSubmission: 'SELECT organisation_id FROM form_submissions WHERE id = $1',
  payment: 'SELECT organisation_id FROM payments WHERE id = $1',
  memberFilter: 'SELECT organisation_id FROM member_filters WHERE id = $1',
  userGroup: 'SELECT organisation_id FROM user_groups WHERE id = $1',
  announcement: 'SELECT organisation_id FROM organisation_announcements WHERE id = $1',

  /*
   * Owned through a parent. A booking belongs to a calendar and a ticket to an
   * event; joining is what keeps the answer true when a resource is moved,
   * rather than copying the organisation onto every child table.
   */
  booking: `SELECT c.organisation_id FROM bookings b
              JOIN calendars c ON c.id = b.calendar_id WHERE b.id = $1`,
  reservation: `SELECT c.organisation_id FROM slot_reservations r
                  JOIN calendars c ON c.id = r.calendar_id WHERE r.id = $1`,
  eventActivity: `SELECT e.organisation_id FROM event_activities a
                    JOIN events e ON e.id = a.event_id WHERE a.id = $1`,
  ticket: `SELECT e.organisation_id FROM electronic_tickets t
             JOIN events e ON e.id = t.event_id WHERE t.id = $1`,
  ticketByQr: `SELECT e.organisation_id FROM electronic_tickets t
                 JOIN events e ON e.id = t.event_id WHERE t.qr_code = $1`,
  /*
   * A gate scanning session names its organisation directly: it is a grant made
   * *by* a club, and it outlives nothing else that could carry the ownership.
   */
  scanSession: 'SELECT organisation_id FROM ticket_scan_sessions WHERE id = $1',
  submissionFile: `SELECT s.organisation_id FROM form_submission_files f
                     JOIN form_submissions s ON s.id = f.submission_id WHERE f.id = $1`,

  /*
   * People. `organization_users` covers administrators and members alike, and
   * an admin role belongs to the organisation that defined it.
   */
  organisationUser: 'SELECT organization_id FROM organization_users WHERE id = $1',
  adminRole: 'SELECT organization_id FROM organization_admin_roles WHERE id = $1',
};

export type ResourceKind = keyof typeof OWNER_SQL;

export type OrganisationSource =
  | { from: 'resource'; kind: ResourceKind; param: string }
  | { from: 'param'; name: string }
  | { from: 'body'; name?: string }
  | { from: 'current' };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const refuse = (res: Response) =>
  res.status(403).json({
    error: { code: 'FORBIDDEN', message: 'You do not administer this organisation' },
  });

/** The organisation that owns a resource, or null if there is no such resource. */
async function ownerOf(kind: ResourceKind, id: string): Promise<string | null> {
  const sql = OWNER_SQL[kind];
  if (!sql) throw new Error(`No owning-organisation lookup for "${kind}"`);

  // A qr code is not a uuid; everything else here is, and a malformed id must
  // read as "not found" rather than as a Postgres cast error.
  if (kind !== 'ticketByQr' && !UUID.test(id)) return null;

  const result = await db.query(sql, [id]);
  return result.rows[0]?.organisation_id ?? result.rows[0]?.organization_id ?? null;
}

/**
 * Refuse the request unless the caller administers the organisation it concerns.
 *
 * Sets `req.organisationId`, `req.organisationUserId` and `req.capabilities`
 * from the caller's membership of *that* organisation, so a handler downstream
 * can rely on them — and so a capability check placed after this one asks about
 * the right club.
 */
export function scopeToOrganisation(source: OrganisationSource) {
  return async (req: OrganisationRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Authentication required' } });
        return;
      }

      let organisationId: string | null = null;

      switch (source.from) {
        case 'resource': {
          const id = (req.params as Record<string, string>)?.[source.param];
          if (!id) {
            logger.warn('Refused a request whose path carries no resource id to scope by', {
              kind: source.kind,
              param: source.param,
              path: req.originalUrl,
            });
            return void refuse(res);
          }
          organisationId = await ownerOf(source.kind, id);
          /*
           * A resource that does not exist is refused rather than reported as
           * missing, so this cannot be used to discover which ids are real.
           *
           * That is the right response and a poor diagnosis: "no such row" and
           * "belongs to another club" become the same opaque 403, with nothing
           * in the log to tell them apart. Say which it was here — the client
           * still learns nothing.
           */
          if (!organisationId) {
            logger.warn('Refused a request for a resource that no organisation owns', {
              kind: source.kind,
              resourceId: id,
              keycloakUserId: req.user.userId,
              path: req.originalUrl,
            });
            return void refuse(res);
          }
          break;
        }
        case 'param':
          organisationId = (req.params as Record<string, string>)?.[source.name] ?? null;
          break;
        case 'body':
          /*
           * A create. Most name their organisation in the payload; some leave it
           * to the server, and their handlers read `req.organisationId`
           * instead — `POST /events` has always worked that way, and demanding
           * the field would have broken it.
           *
           * Either way the value is verified before anything is written, so a
           * handler that goes on to read `req.body.organisationId` is reading
           * something already checked.
           */
          organisationId =
            (req.body ?? {})[source.name ?? 'organisationId'] ??
            (await organisationOfRequest(req));
          break;
        case 'current':
          /*
           * Nothing in the request identifies a resource, so it means "the
           * organisation I am working in" — the header the shell sends, or the
           * caller's only organisation.
           */
          organisationId = await organisationOfRequest(req);
          break;
      }

      if (!organisationId || !UUID.test(organisationId)) return void refuse(res);

      /*
       * When the path names an organisation as well, the two must agree.
       *
       * These routers are mounted twice, so `/organisations/:organisationId/...`
       * and the bare form reach the same handlers. Without this, an
       * administrator of two clubs could put club A in the path and club B's
       * event id after it: both checks would pass on their own, and the URL
       * would describe something the request did not do. A prefix that can lie
       * is worse than no prefix.
       */
      const pathOrganisation = (req.params as Record<string, string>)?.organisationId;
      if (pathOrganisation && pathOrganisation !== organisationId) {
        logger.warn('Refused a request whose path names a different organisation from its subject', {
          pathOrganisation,
          subjectOrganisation: organisationId,
          path: req.originalUrl,
        });
        return void refuse(res);
      }

      const membership = await db.query(
        `SELECT ou.id AS user_id, o.enabled_capabilities
           FROM organization_users ou
           INNER JOIN organizations o ON ou.organization_id = o.id
          WHERE ou.keycloak_user_id = $1
            AND ou.user_type = 'org-admin'
            AND ou.status = 'active'
            AND o.status = 'active'
            AND ou.organization_id = $2::uuid`,
        [req.user.userId, organisationId]
      );

      if (membership.rows.length === 0) {
        logger.warn('Refused an org-admin request for an organisation the caller does not administer', {
          keycloakUserId: req.user.userId,
          organisationId,
          path: req.originalUrl,
        });
        return void refuse(res);
      }

      req.organisationId = organisationId;
      req.organisationUserId = membership.rows[0].user_id;
      req.capabilities = membership.rows[0].enabled_capabilities || [];
      next();
    } catch (error) {
      logger.error('Could not establish which organisation a request concerns', {
        path: req.originalUrl,
        error: error instanceof Error ? error.message : String(error),
      });
      res.status(500).json({
        error: { code: 'INTERNAL_ERROR', message: 'Failed to authorise the request' },
      });
    }
  };
}

/** Shorthands, so a route reads as what it is scoped by. */
export const byResource = (kind: ResourceKind, param = 'id') =>
  scopeToOrganisation({ from: 'resource', kind, param });
export const byParam = (name: string) => scopeToOrganisation({ from: 'param', name });
/** A create: the organisation it names, or the one being worked in. */
export const byBodyOrCurrent = (name?: string) => scopeToOrganisation({ from: 'body', name });
export const byCurrentOrganisation = () => scopeToOrganisation({ from: 'current' });
