import { Response, NextFunction } from 'express';
import {
  loadOrganisationCapabilities,
  organisationOfRequest,
  OrganisationRequest,
} from '../capability.middleware';
import { requireOrgAdminRole } from '../orgadmin-role.middleware';
import { db } from '../../database/pool';

jest.mock('../../database/pool');
jest.mock('../../config/logger');

const mockDb = db as jest.Mocked<typeof db>;

/**
 * An org admin may only act on an organisation they administer.
 *
 * This was not true. The data routes take the organisation from the URL —
 * `/organisations/:organisationId/events` — while the guard looked up the
 * *caller's own* organisation from the token, checked the capability against
 * that, and attached it. The handler then used `req.params.organisationId`
 * instead, and nothing compared the two.
 *
 * So an administrator of one club could substitute another club's id and be
 * served, provided their own club had the capability. Thirty routes across
 * twelve files were shaped that way, and it was reproduced against a live
 * database before being fixed.
 *
 * The same condition that closes it is what makes an administrator of several
 * organisations possible, which is why these are one test file: the question
 * stops being "what is this administrator's organisation?" and becomes "is this
 * one of them?".
 *
 * See docs/ORGADMIN_MULTI_ORGANISATION.md §0.
 */
describe('org-admin tenancy', () => {
  const MINE = '11111111-1111-4111-8111-111111111111';
  const THEIRS = '22222222-2222-4222-8222-222222222222';

  let req: Partial<OrganisationRequest>;
  let res: Partial<Response>;
  let next: NextFunction;

  beforeEach(() => {
    jest.clearAllMocks();
    req = { user: { userId: 'kc-1' }, params: {}, headers: {} } as Partial<OrganisationRequest>;
    res = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };
    next = jest.fn();
  });

  /** A membership row, as the resolver's query would return it. */
  const membership = (organisationId: string, capabilities = ['event-management']) => ({
    rows: [
      {
        user_id: 'ou-1',
        organization_id: organisationId,
        enabled_capabilities: capabilities,
        org_status: 'active',
      },
    ],
  });

  /** No row: they do not administer what they asked for. */
  const noMembership = { rows: [] };

  const run = () =>
    loadOrganisationCapabilities()(req as OrganisationRequest, res as Response, next);

  const sqlOf = (call = 0) => (mockDb.query as jest.Mock).mock.calls[call][0] as string;
  const paramsOf = (call = 0) => (mockDb.query as jest.Mock).mock.calls[call][1] as unknown[];

  describe('an organisation named in the URL', () => {
    it('is what membership is checked against', async () => {
      mockDb.query.mockResolvedValueOnce(membership(THEIRS) as never);
      req.params = { organisationId: THEIRS };

      await run();

      // The requested organisation reaches the query, not the caller's own.
      expect(sqlOf()).toContain('ou.organization_id = $2::uuid');
      expect(paramsOf()).toEqual(['kc-1', THEIRS]);
    });

    it('is refused when they do not administer it', async () => {
      // The hole itself. Before the fix this returned the caller's *own* row and
      // the handler went on to read the organisation named in the URL.
      mockDb.query.mockResolvedValueOnce(noMembership as never);
      req.params = { organisationId: THEIRS };

      await run();

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
      expect(req.organisationId).toBeUndefined();
    });

    it('is allowed when they do', async () => {
      mockDb.query.mockResolvedValueOnce(membership(MINE) as never);
      req.params = { organisationId: MINE };

      await run();

      expect(next).toHaveBeenCalled();
      expect(req.organisationId).toBe(MINE);
    });

    it('decides the capabilities, so they are never borrowed from another club', async () => {
      /*
       * The second half of the same fault. Reading capabilities from the
       * caller's own organisation while acting on another means a club that
       * never bought a module could have it exercised on their data by an
       * administrator elsewhere who did.
       */
      mockDb.query.mockResolvedValueOnce(membership(THEIRS, ['memberships']) as never);
      req.params = { organisationId: THEIRS };

      await run();

      expect(req.capabilities).toEqual(['memberships']);
    });
  });

  describe('an organisation named in the header', () => {
    it('is checked the same way as one in the URL', async () => {
      mockDb.query.mockResolvedValueOnce(membership(MINE) as never);
      req.headers = { 'x-organisation-id': MINE };

      await run();

      expect(paramsOf()).toEqual(['kc-1', MINE]);
      expect(req.organisationId).toBe(MINE);
    });

    it('is refused when they do not administer it', async () => {
      mockDb.query.mockResolvedValueOnce(noMembership as never);
      req.headers = { 'x-organisation-id': THEIRS };

      await run();

      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('loses to the URL when both are present', async () => {
      /*
       * An address naming an organisation is unambiguous. A header quietly
       * overriding it would make the same URL mean different things in
       * different tabs — and would be a way to aim a request somewhere its own
       * path denies.
       */
      mockDb.query.mockResolvedValueOnce(membership(MINE) as never);
      req.params = { organisationId: MINE };
      req.headers = { 'x-organisation-id': THEIRS };

      await run();

      expect(paramsOf()).toEqual(['kc-1', MINE]);
    });
  });

  describe('an id that is not one', () => {
    it('is refused without reaching the database', async () => {
      // `$2::uuid` would raise `invalid input syntax for type uuid` and answer
      // 500 — telling the caller their id was the wrong *shape*, which is a bit
      // more than a refusal should give away.
      req.params = { organisationId: 'not-a-uuid' };

      await run();

      expect(res.status).toHaveBeenCalledWith(403);
      expect(mockDb.query).not.toHaveBeenCalled();
    });
  });

  describe('what a refusal says', () => {
    it('reads the same whether it is not theirs or does not exist', async () => {
      // Both are "no row". Distinguishing them would let anyone holding an
      // org-admin session enumerate which organisation ids are real.
      mockDb.query.mockResolvedValueOnce(noMembership as never);
      req.params = { organisationId: THEIRS };
      await run();

      expect(res.json).toHaveBeenCalledWith({
        error: { code: 'FORBIDDEN', message: 'You do not administer this organisation' },
      });
    });
  });

  describe('when nothing names an organisation', () => {
    it('still resolves one, and deterministically', async () => {
      /*
       * The routes that infer it. `LIMIT 1` over an unordered set was harmless
       * while everyone had one organisation and arbitrary the moment they had
       * two — possibly a different one per request.
       */
      mockDb.query.mockResolvedValueOnce(membership(MINE) as never);

      await run();

      expect(sqlOf()).toContain('ORDER BY');
      expect(sqlOf()).toContain('org_admin_last_organisation');
      expect(next).toHaveBeenCalled();
      expect(req.organisationId).toBe(MINE);
    });

    it('refuses somebody who administers nothing', async () => {
      mockDb.query.mockResolvedValueOnce(noMembership as never);

      await run();

      expect(res.status).toHaveBeenCalledWith(403);
    });
  });

  describe('roles are held in an organisation, not on the platform', () => {
    const roleRows = (names: string[]) => ({ rows: names.map((name) => ({ name })) });

    it('scopes the role check to the organisation being acted on', async () => {
      /*
       * This gathered every role the identity held anywhere, with no
       * organisation filter. Identical output while everyone had one club; a
       * privilege escalation the moment they had two, since a role at one would
       * satisfy a check against the other.
       */
      mockDb.query
        .mockResolvedValueOnce(membership(THEIRS) as never) // organisationOfRequest
        .mockResolvedValueOnce(roleRows(['full-administrator']) as never);
      req.params = { organisationId: THEIRS };

      await requireOrgAdminRole('full-administrator')(
        req as OrganisationRequest,
        res as Response,
        next
      );

      expect(next).toHaveBeenCalled();
      expect(sqlOf(1)).toContain('ou.organization_id = $2::uuid');
      expect(paramsOf(1)).toEqual(['kc-1', THEIRS]);
    });

    it('refuses when the caller does not administer the organisation at all', async () => {
      mockDb.query.mockResolvedValueOnce(noMembership as never);
      req.params = { organisationId: THEIRS };

      await requireOrgAdminRole('full-administrator')(
        req as OrganisationRequest,
        res as Response,
        next
      );

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('reuses an organisation the capability chain already verified', async () => {
      // Both run on most routes; asking twice would be a second query to reach
      // an answer that has already been established — and a chance for the two
      // to disagree about which club the request is about.
      req.organisationId = MINE;
      mockDb.query.mockResolvedValueOnce(roleRows(['full-administrator']) as never);

      await requireOrgAdminRole('full-administrator')(
        req as OrganisationRequest,
        res as Response,
        next
      );

      expect(mockDb.query).toHaveBeenCalledTimes(1);
      expect(paramsOf(0)).toEqual(['kc-1', MINE]);
    });
  });

  describe('organisationOfRequest', () => {
    it('does not hand back an organisation that is inactive', async () => {
      mockDb.query.mockResolvedValueOnce({
        rows: [{ user_id: 'ou-1', organization_id: MINE, enabled_capabilities: [], org_status: 'inactive' }],
      } as never);
      req.params = { organisationId: MINE };

      await expect(organisationOfRequest(req as OrganisationRequest)).resolves.toBeNull();
    });

    it('is null for a caller with no session', async () => {
      await expect(organisationOfRequest({} as OrganisationRequest)).resolves.toBeNull();
    });
  });
});
