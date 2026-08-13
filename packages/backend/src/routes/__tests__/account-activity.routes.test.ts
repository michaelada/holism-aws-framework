import express from 'express';
import type { Server } from 'http';
import request from 'supertest';

/**
 * Route-level behaviour for the "my activity" endpoints (C1, C2, C4).
 *
 * The service's own logic is tested separately; what matters here is the
 * wiring, and above all **that the member whose records are returned comes from
 * the resolved session and never from the request**. A handler that passed a
 * client-supplied id through would leak one member's entries to another, and
 * nothing about the response shape would reveal it.
 */

jest.mock('../../config/logger');

jest.mock('../../services/account-activity.service', () => ({
  accountActivityService: {
    listEntries: jest.fn(),
    listBookings: jest.fn(),
    listMemberships: jest.fn(),
    getEntry: jest.fn(),
  },
}));

jest.mock('../../services/account-organisation.service', () => ({
  accountOrganisationService: {
    listPublicOrganisations: jest.fn(),
    getPublicOrganisationByCode: jest.fn(),
    getOrganisationsForUser: jest.fn(),
    resolveMembership: jest.fn(),
    getAccountUserProfile: jest.fn(),
    getOrganisationIdByCode: jest.fn(),
  },
}));

jest.mock('../../services/account-registration.service', () => ({
  accountRegistrationService: { register: jest.fn() },
}));

jest.mock('../../middleware/auth.middleware', () => ({
  authenticateToken: () => (req: any, res: any, next: any) => {
    const userId = req.headers['x-test-user'];
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    req.user = { userId, email: 'm@example.com', username: 'm', roles: [], groups: [] };
    return next();
  },
}));

import { accountActivityService } from '../../services/account-activity.service';
import { accountOrganisationService } from '../../services/account-organisation.service';
import { NotFoundError } from '../../middleware/errors';
import accountRoutes from '../account.routes';

const activity = accountActivityService as jest.Mocked<typeof accountActivityService>;
const organisations = accountOrganisationService as jest.Mocked<
  typeof accountOrganisationService
>;

const app = express();
app.use(express.json());
app.use('/api/account', accountRoutes);

const MEMBERSHIP = {
  organisationId: 'org-1',
  organisationUserId: 'ou-1',
  urlCode: 'khpc',
  displayName: 'Kildare Hunt Pony Club',
  currency: 'EUR',
  language: 'en',
  capabilities: ['event-management', 'memberships', 'calendar-bookings'],
  status: 'active',
};

const asMember = (path: string) => request(server).get(path).set('x-test-user', 'kc-1');


/*
 * One listener for the whole file: `request(server)` starts a server on a fresh
 * ephemeral port per call, and that churn ends in ports being reused while the
 * last connection's packets are still in flight — the client then reads bytes
 * that are not a response at all.
 */
let server: Server;

beforeAll((done) => {
  server = app.listen(0, done);
});

afterAll((done) => {
  server.close(done);
});

describe('account activity routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    organisations.resolveMembership.mockResolvedValue({
      ok: true,
      membership: MEMBERSHIP,
    } as any);
    activity.listEntries.mockResolvedValue([]);
    activity.listBookings.mockResolvedValue([]);
    activity.listMemberships.mockResolvedValue([]);
  });

  describe.each([
    ['/api/account/khpc/entries', () => activity.listEntries],
    ['/api/account/khpc/bookings', () => activity.listBookings],
    ['/api/account/khpc/memberships', () => activity.listMemberships],
  ])('%s', (path, getMock) => {
    it('refuses an anonymous caller', async () => {
      await request(server).get(path).expect(401);
      expect(getMock()).not.toHaveBeenCalled();
    });

    /**
     * The security property worth pinning: the organisation and the member both
     * come from the resolved membership. Nothing the caller sent reaches the
     * query.
     */
    it('scopes to the resolved member, not to anything the caller sent', async () => {
      await asMember(path).expect(200);

      expect(getMock()).toHaveBeenCalledWith('org-1', 'ou-1');
    });

    it('passes a refusal from the organisation gate straight through', async () => {
      organisations.resolveMembership.mockResolvedValue({
        ok: false,
        reason: 'PENDING_APPROVAL',
      } as any);

      const response = await asMember(path).expect(403);

      // The account app shows a different screen per code, so the code has to
      // survive rather than collapsing into a bare 403.
      expect(response.body.error.code).toBe('PENDING_APPROVAL');
      expect(getMock()).not.toHaveBeenCalled();
    });

    it('reports a failure without leaking the underlying error', async () => {
      getMock().mockRejectedValue(new Error('relation "x" does not exist'));

      const response = await asMember(path).expect(500);
      expect(JSON.stringify(response.body)).not.toContain('relation');
    });
  });

  describe('GET /:orgCode/entries', () => {
    it('returns the entries the service gives it', async () => {
      activity.listEntries.mockResolvedValue([
        { id: 'entry-1', eventName: 'Summer Regatta', status: 'confirmed' },
      ] as any);

      const response = await asMember('/api/account/khpc/entries').expect(200);
      expect(response.body[0]).toMatchObject({ id: 'entry-1', status: 'confirmed' });
    });
  });

  describe('GET /:orgCode/entries/:entryId', () => {
    it('returns one entry', async () => {
      activity.getEntry.mockResolvedValue({ id: 'entry-1' } as any);

      const response = await asMember('/api/account/khpc/entries/entry-1').expect(200);

      expect(activity.getEntry).toHaveBeenCalledWith('org-1', 'ou-1', 'entry-1');
      expect(response.body.id).toBe('entry-1');
    });

    it("reports another member's entry as not found, not forbidden", async () => {
      // A 403 would confirm the id exists to someone probing for it.
      activity.getEntry.mockRejectedValue(new NotFoundError('Entry not found'));

      const response = await asMember('/api/account/khpc/entries/someone-elses').expect(404);
      expect(response.body.error.code).toBe('ENTRY_NOT_FOUND');
    });

    it('is not swallowed by the list route declared before it', async () => {
      activity.getEntry.mockResolvedValue({ id: 'entry-1' } as any);

      await asMember('/api/account/khpc/entries/entry-1').expect(200);
      expect(activity.listEntries).not.toHaveBeenCalled();
    });
  });
});
