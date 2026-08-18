import { Response, NextFunction } from 'express';
import { byBodyOrCurrent, byCurrentOrganisation, byParam, byResource } from '../organisation-scope.middleware';
import { OrganisationRequest } from '../capability.middleware';
import { db } from '../../database/pool';

jest.mock('../../database/pool');
jest.mock('../../config/logger');

const mockDb = db as jest.Mocked<typeof db>;

/**
 * "Which organisation is this request about, and may you act there?"
 *
 * Most org-admin routes name a *resource* rather than an organisation —
 * `/events/:id`, `/tickets/:ticketId` — and 127 of them asked neither question.
 * Authentication says who somebody is; it never said where they may act, and a
 * route that forgets the second looks exactly like one that asks it.
 */
describe('scoping an org-admin request to an organisation', () => {
  const MINE = '11111111-1111-4111-8111-111111111111';
  const THEIRS = '22222222-2222-4222-8222-222222222222';
  /*
   * A real uuid, because the guard refuses a malformed id before it queries
   * anything. Written as 'event-1' these cases passed for the wrong reason —
   * "refused" was about the shape of the id rather than about who owns it.
   */
  const RESOURCE = '44444444-4444-4444-8444-444444444444';

  let req: Partial<OrganisationRequest>;
  let res: Partial<Response>;
  let next: NextFunction;

  beforeEach(() => {
    jest.clearAllMocks();
    req = { user: { userId: 'kc-1' }, params: {}, headers: {}, body: {} } as Partial<OrganisationRequest>;
    res = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };
    next = jest.fn();
  });

  /** The owner lookup, then the membership check. */
  const owns = (organisationId: string | null, member = true) => {
    mockDb.query = jest
      .fn()
      .mockResolvedValueOnce({ rows: organisationId ? [{ organisation_id: organisationId }] : [] })
      .mockResolvedValueOnce({
        rows: member ? [{ user_id: 'ou-1', enabled_capabilities: ['event-management'] }] : [],
      }) as any;
  };

  describe('by resource', () => {
    it('allows a resource in an organisation the caller administers', async () => {
      owns(MINE);
      req.params = { id: RESOURCE };

      await byResource('event', 'id')(req as OrganisationRequest, res as Response, next);

      expect(next).toHaveBeenCalled();
      expect(req.organisationId).toBe(MINE);
      expect(req.capabilities).toEqual(['event-management']);
    });

    it('refuses a resource in somebody else’s organisation', async () => {
      /*
       * The fault this exists for. `GET /events/:id` returned another club's
       * event and `PUT /events/:id` wrote to it, for any signed-in user.
       */
      owns(THEIRS, false);
      req.params = { id: RESOURCE };

      await byResource('event', 'id')(req as OrganisationRequest, res as Response, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
      expect(req.organisationId).toBeUndefined();
    });

    it('answers the same way for a resource that does not exist', async () => {
      // Otherwise every one of these routes becomes a way of asking whether an
      // id is real.
      owns(null);
      req.params = { id: '33333333-3333-4333-8333-333333333333' };

      await byResource('event', 'id')(req as OrganisationRequest, res as Response, next);

      expect(res.json).toHaveBeenCalledWith({
        error: { code: 'FORBIDDEN', message: 'You do not administer this organisation' },
      });
    });

    it('refuses a malformed id without reaching the database', async () => {
      mockDb.query = jest.fn() as any;
      req.params = { id: 'not-a-uuid' };

      await byResource('event', 'id')(req as OrganisationRequest, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(mockDb.query).not.toHaveBeenCalled();
    });

    it('resolves a child resource through its parent', async () => {
      // A booking has no organisation of its own; its calendar does. Joining
      // keeps the answer true rather than copying the id onto every child table.
      owns(MINE);
      req.params = { id: RESOURCE };

      await byResource('booking', 'id')(req as OrganisationRequest, res as Response, next);

      const [sql] = (mockDb.query as jest.Mock).mock.calls[0];
      expect(sql).toContain('JOIN calendars');
      expect(next).toHaveBeenCalled();
    });

    it('accepts a QR code, which is not a uuid', async () => {
      // The one lookup keyed on something other than an id.
      owns(MINE);
      req.params = { qrCode: 'TICKET-ABC-123' };

      await byResource('ticketByQr', 'qrCode')(req as OrganisationRequest, res as Response, next);

      expect(next).toHaveBeenCalled();
    });

    it('refuses when the route names no id at all', async () => {
      mockDb.query = jest.fn() as any;

      await byResource('event', 'id')(req as OrganisationRequest, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(403);
    });
  });

  describe('when the path names an organisation too', () => {
    it('allows it when it agrees with the resource', async () => {
      // The routers are mounted at `/organisations/:organisationId/...` as well
      // as bare, so both are present on a scoped request.
      owns(MINE);
      req.params = { organisationId: MINE, id: RESOURCE };

      await byResource('event', 'id')(req as OrganisationRequest, res as Response, next);

      expect(next).toHaveBeenCalled();
    });

    it('refuses when it does not', async () => {
      /*
       * An administrator of two clubs could otherwise put club A in the path
       * and club B's event id after it. Both checks pass alone, and the URL
       * ends up describing something the request did not do — a prefix that can
       * lie is worse than no prefix.
       */
      owns(THEIRS);
      req.params = { organisationId: MINE, id: RESOURCE };

      await byResource('event', 'id')(req as OrganisationRequest, res as Response, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
    });
  });

  describe('by param', () => {
    it('takes the organisation from the path under whatever name it has', async () => {
      // `:organizationId`, American, in the user-management routes.
      mockDb.query = jest
        .fn()
        .mockResolvedValueOnce({ rows: [{ user_id: 'ou-1', enabled_capabilities: [] }] }) as any;
      req.params = { organizationId: MINE };

      await byParam('organizationId')(req as OrganisationRequest, res as Response, next);

      expect(next).toHaveBeenCalled();
      expect(req.organisationId).toBe(MINE);
    });

    it('refuses one the caller does not administer', async () => {
      mockDb.query = jest.fn().mockResolvedValueOnce({ rows: [] }) as any;
      req.params = { organizationId: THEIRS };

      await byParam('organizationId')(req as OrganisationRequest, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(403);
    });
  });

  describe('by body', () => {
    it('verifies the organisation a create names', async () => {
      mockDb.query = jest
        .fn()
        .mockResolvedValueOnce({ rows: [{ user_id: 'ou-1', enabled_capabilities: [] }] }) as any;
      req.body = { organisationId: MINE, name: 'A new event' };

      await byBodyOrCurrent()(req as OrganisationRequest, res as Response, next);

      expect(next).toHaveBeenCalled();
    });

    it('refuses a create aimed at another club', async () => {
      // Otherwise anybody could add an event, a discount or a calendar to a
      // club they have nothing to do with.
      mockDb.query = jest.fn().mockResolvedValueOnce({ rows: [] }) as any;
      req.body = { organisationId: THEIRS };

      await byBodyOrCurrent()(req as OrganisationRequest, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('falls back to the organisation being worked in when the body names none', async () => {
      /*
       * `POST /events` has always let the server decide, and its handler reads
       * `req.organisationId`. Demanding the field would have broken creating an
       * event — a guard that breaks the thing it protects gets removed.
       */
      mockDb.query = jest.fn().mockResolvedValue({
        rows: [{ user_id: 'ou-1', organization_id: MINE, enabled_capabilities: [], org_status: 'active' }],
      }) as any;
      req.headers = { 'x-organisation-id': MINE };

      await byBodyOrCurrent()(req as OrganisationRequest, res as Response, next);

      expect(next).toHaveBeenCalled();
      expect(req.organisationId).toBe(MINE);
    });

    it('refuses when neither the body nor the request names one', async () => {
      mockDb.query = jest.fn().mockResolvedValue({ rows: [] }) as any;

      await byBodyOrCurrent()(req as OrganisationRequest, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('by the organisation being worked in', () => {
    it('uses the header, already verified by the shared resolver', async () => {
      mockDb.query = jest.fn().mockResolvedValue({
        rows: [{ user_id: 'ou-1', organization_id: MINE, enabled_capabilities: [], org_status: 'active' }],
      }) as any;
      req.headers = { 'x-organisation-id': MINE };

      await byCurrentOrganisation()(req as OrganisationRequest, res as Response, next);

      expect(next).toHaveBeenCalled();
      expect(req.organisationId).toBe(MINE);
    });

    it('refuses a caller who administers nothing', async () => {
      mockDb.query = jest.fn().mockResolvedValue({ rows: [] }) as any;

      await byCurrentOrganisation()(req as OrganisationRequest, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(403);
    });
  });

  describe('a caller with no session', () => {
    it('is 401, not 403', async () => {
      // Not signed in is a different answer from signed in and not allowed.
      await byResource('event', 'id')({} as OrganisationRequest, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(401);
    });
  });

  describe('when the lookup itself fails', () => {
    it('is a 500, never a silent pass', async () => {
      mockDb.query = jest.fn().mockRejectedValue(new Error('database is unhappy')) as any;
      req.params = { id: MINE };

      await byResource('event', 'id')(req as OrganisationRequest, res as Response, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });
});
