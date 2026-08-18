import express from 'express';
import request from 'supertest';

/**
 * Signing in when you administer more than one club.
 *
 * `organization_users` is unique on `(organization_id, keycloak_user_id)`, so
 * one identity holding several rows is what the schema has always expected —
 * account users already live that way. What stopped org admins was this
 * endpoint ending in `LIMIT 1` over an unordered set: harmless with one row,
 * arbitrary with two, and possibly a *different* arbitrary one each sign-in.
 *
 * See docs/ORGADMIN_MULTI_ORGANISATION.md.
 */

jest.mock('../../config/logger');
jest.mock('../../database/pool', () => ({ db: { query: jest.fn() } }));

jest.mock('../../middleware/auth.middleware', () => ({
  authenticateToken: () => (req: any, _res: any, next: any) => {
    req.user = { userId: 'kc-admin', email: 'ada@example.com', roles: [], groups: [] };
    return next();
  },
}));

import { db } from '../../database/pool';
import orgadminAuthRoutes from '../orgadmin-auth.routes';

const mockDb = db as jest.Mocked<typeof db>;

const app = express();
app.use(express.json());
app.use('/api/orgadmin', orgadminAuthRoutes);

const KILDARE = '11111111-1111-4111-8111-111111111111';
const LAOIS = '22222222-2222-4222-8222-222222222222';

const membership = (
  orgId: string,
  displayName: string,
  over: Record<string, any> = {}
) => ({
  id: `ou-${orgId}`,
  email: 'ada@example.com',
  first_name: 'Ada',
  last_name: 'Adams',
  status: 'active',
  org_id: orgId,
  org_name: displayName.toLowerCase().replace(/\s+/g, '-'),
  org_display_name: displayName,
  org_url_code: displayName.slice(0, 4).toLowerCase(),
  org_status: 'active',
  currency: 'EUR',
  language: 'en-GB',
  enabled_capabilities: ['memberships'],
  settings: {},
  organization_type_id: 'type-1',
  keycloak_group_id: 'group-1',
  org_created_at: new Date('2025-01-01'),
  org_updated_at: new Date('2025-01-01'),
  was_last_used: false,
  ...over,
});

/** The memberships query, then last_login, then (maybe) the remembered row, then roles. */
const respond = (rows: any[], roles: any[] = [{ id: 'r1', name: 'full-administrator', display_name: 'Full administrator', capability_permissions: { memberships: ['read'] } }]) => {
  mockDb.query = jest.fn().mockImplementation((sql: string) => {
    if (sql.includes('FROM organization_users ou')) return { rows, rowCount: rows.length };
    if (sql.includes('organization_user_roles')) return { rows: roles, rowCount: roles.length };
    return { rows: [], rowCount: 0 };
  }) as any;
};

const me = (headers: Record<string, string> = {}) =>
  request(app).get('/api/orgadmin/auth/me').set(headers);

describe('GET /api/orgadmin/auth/me', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('an administrator of one organisation', () => {
    it('sees exactly what it always returned, plus a list of one', async () => {
      respond([membership(KILDARE, 'Kildare Hunt Pony Club')]);

      const res = await me();

      expect(res.status).toBe(200);
      expect(res.body.organisation.id).toBe(KILDARE);
      expect(res.body.organisations).toHaveLength(1);
      expect(res.body.organisations[0]).toEqual(
        expect.objectContaining({ id: KILDARE, displayName: 'Kildare Hunt Pony Club', isCurrent: true })
      );
    });

    it('is not asked to remember anything', async () => {
      // Nothing to choose between, so nothing to come back to.
      respond([membership(KILDARE, 'Kildare Hunt Pony Club')]);

      await me();

      // The write specifically — the memberships query joins that table to find
      // out where they were, and reading it is not remembering.
      const remembered = (mockDb.query as jest.Mock).mock.calls.some(([sql]) =>
        sql.includes('INSERT INTO org_admin_last_organisation')
      );
      expect(remembered).toBe(false);
    });
  });

  describe('an administrator of several', () => {
    const both = () => [
      membership(KILDARE, 'Kildare Hunt Pony Club'),
      membership(LAOIS, 'Laois Hunt Pony Club'),
    ];

    it('gets every one of them, and one marked current', async () => {
      respond(both());

      const res = await me();

      expect(res.body.organisations.map((o: any) => o.displayName)).toEqual([
        'Kildare Hunt Pony Club',
        'Laois Hunt Pony Club',
      ]);
      expect(res.body.organisations.filter((o: any) => o.isCurrent)).toHaveLength(1);
    });

    it('opens on the one the request asked for', async () => {
      respond(both());

      const res = await me({ 'x-organisation-id': LAOIS });

      expect(res.body.organisation.id).toBe(LAOIS);
      expect(res.body.organisation.displayName).toBe('Laois Hunt Pony Club');
    });

    it('opens on where they were last, when the request says nothing', async () => {
      respond([
        membership(KILDARE, 'Kildare Hunt Pony Club'),
        membership(LAOIS, 'Laois Hunt Pony Club', { was_last_used: true }),
      ]);

      const res = await me();

      // Not the alphabetically first — a switcher that forgets is a switcher
      // used twice per sign-in.
      expect(res.body.organisation.id).toBe(LAOIS);
    });

    it('falls back to the first by name, deterministically', async () => {
      // The `LIMIT 1` this replaces had no ORDER BY, so "the first" meant
      // whichever row Postgres returned — possibly a different one each time.
      respond(both());

      const res = await me();

      expect(res.body.organisation.id).toBe(KILDARE);
    });

    it('ignores a header naming a club they do not administer', async () => {
      /*
       * Not a refusal. This endpoint answers "who are you and where can you
       * work?", and a stale header from a club they have since left should land
       * them somewhere useful rather than locked out of the whole application.
       * The routes that *act* on an organisation refuse it — see
       * orgadmin-tenancy.middleware.test.ts.
       */
      respond(both());

      const res = await me({ 'x-organisation-id': '99999999-9999-4999-8999-999999999999' });

      expect(res.status).toBe(200);
      expect(res.body.organisation.id).toBe(KILDARE);
    });

    it('remembers where they ended up', async () => {
      respond(both());

      await me({ 'x-organisation-id': LAOIS });

      const write = (mockDb.query as jest.Mock).mock.calls.find(([sql]) =>
        sql.includes('INSERT INTO org_admin_last_organisation')
      );
      expect(write).toBeDefined();
      expect(write[1]).toEqual(['kc-admin', LAOIS]);
    });

    it('leaves an inactive organisation out of the list entirely', async () => {
      // It admits nobody, its own administrators included, so offering it in a
      // switcher would be offering a door that does not open.
      respond([
        membership(KILDARE, 'Kildare Hunt Pony Club'),
        membership(LAOIS, 'Laois Hunt Pony Club', { org_status: 'inactive' }),
      ]);

      const res = await me();

      expect(res.body.organisations).toHaveLength(1);
      expect(res.body.organisations[0].id).toBe(KILDARE);
    });
  });

  describe('somebody who administers nothing', () => {
    it('is refused', async () => {
      respond([]);

      const res = await me();

      expect(res.status).toBe(403);
    });
  });
});
