/**
 * Filing a session event under the right trail — or trails.
 *
 * The bug these exist for: a sign-in was attributed only when the person
 * belonged to exactly one organisation, and recorded with a null organisation
 * otherwise. The org-admin viewer scopes hard on `organisation_id`, so an
 * administrator of two clubs could never see their own sign-ins in either.
 */

jest.mock('../../database/pool', () => ({ db: { query: jest.fn() } }));
jest.mock('../../services/audit', () => ({
  audit: { record: jest.fn() },
  actorFromRequest: jest.fn(() => ({ keycloakUserId: 'kc-1', userType: 'org-admin' })),
  contextFromRequest: jest.fn(() => ({ ip: '10.0.0.1' })),
}));
jest.mock('../../config/logger', () => ({ logger: { warn: jest.fn(), error: jest.fn() } }));

import { db } from '../../database/pool';
import { audit } from '../../services/audit';
import { recordSessionEvent, forgetSession, noteAuthenticatedRequest } from '../audit-auth.middleware';

const mockDb = db as unknown as { query: jest.Mock };
const record = audit.record as jest.Mock;

const ACTOR = { keycloakUserId: 'kc-1', userType: 'org-admin' as const, display: null, email: null };
const CONTEXT = { ip: '10.0.0.1' };

const ORG_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const ORG_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

const orgsOf = (...ids: string[]) => ({ rows: ids.map((organization_id) => ({ organization_id })) });

beforeEach(() => {
  jest.clearAllMocks();
});

describe('recordSessionEvent', () => {
  it('files one row per organisation for somebody who administers several', async () => {
    mockDb.query.mockResolvedValue(orgsOf(ORG_A, ORG_B));

    await recordSessionEvent('auth.login', 'kc-1', ACTOR, CONTEXT);

    expect(record).toHaveBeenCalledTimes(2);
    expect(record.mock.calls.map(([e]) => e.organisationId).sort()).toEqual([ORG_A, ORG_B].sort());
    // Every row is still the same event, about the same person.
    for (const [event] of record.mock.calls) {
      expect(event).toMatchObject({ action: 'auth.login', category: 'security', actor: ACTOR });
    }
  });

  it('files a single attributed row for somebody who administers one', async () => {
    mockDb.query.mockResolvedValue(orgsOf(ORG_A));

    await recordSessionEvent('auth.login', 'kc-1', ACTOR, CONTEXT);

    expect(record).toHaveBeenCalledTimes(1);
    expect(record.mock.calls[0][0].organisationId).toBe(ORG_A);
  });

  it('records an unattributed row when the person belongs to no organisation', async () => {
    mockDb.query.mockResolvedValue({ rows: [] });

    await recordSessionEvent('auth.login', 'kc-1', ACTOR, CONTEXT);

    expect(record).toHaveBeenCalledTimes(1);
    expect(record.mock.calls[0][0].organisationId).toBeUndefined();
  });

  it('still records the event when the organisation lookup fails', async () => {
    mockDb.query.mockRejectedValue(new Error('database is down'));

    await recordSessionEvent('auth.login', 'kc-1', ACTOR, CONTEXT);

    // Losing the sign-in entirely would be worse than losing its attribution.
    expect(record).toHaveBeenCalledTimes(1);
    expect(record.mock.calls[0][0]).toMatchObject({ action: 'auth.login' });
    expect(record.mock.calls[0][0].organisationId).toBeUndefined();
  });

  it('records a sign-out the same way it records a sign-in', async () => {
    mockDb.query.mockResolvedValue(orgsOf(ORG_A, ORG_B));

    await recordSessionEvent('auth.logout', 'kc-1', ACTOR, CONTEXT);

    expect(record).toHaveBeenCalledTimes(2);
    for (const [event] of record.mock.calls) {
      expect(event.action).toBe('auth.logout');
    }
  });
});

describe('noteAuthenticatedRequest', () => {
  const requestFor = (sessionId: string) =>
    ({ user: { userId: 'kc-1', sessionId } }) as any;

  it('records the first request of a session and not the ones after it', async () => {
    mockDb.query.mockResolvedValue(orgsOf(ORG_A));

    noteAuthenticatedRequest(requestFor('sid-first'), 'orgadmin-client');
    noteAuthenticatedRequest(requestFor('sid-first'), 'orgadmin-client');
    noteAuthenticatedRequest(requestFor('sid-first'), 'orgadmin-client');
    await Promise.resolve();
    await Promise.resolve();

    expect(record).toHaveBeenCalledTimes(1);
  });

  it('ignores an anonymous request', () => {
    noteAuthenticatedRequest({} as any);
    expect(record).not.toHaveBeenCalled();
    expect(mockDb.query).not.toHaveBeenCalled();
  });

  it('records again once the session has been forgotten', async () => {
    mockDb.query.mockResolvedValue(orgsOf(ORG_A));

    noteAuthenticatedRequest(requestFor('sid-recycled'));
    await Promise.resolve();
    await Promise.resolve();
    expect(record).toHaveBeenCalledTimes(1);

    forgetSession('sid-recycled');

    noteAuthenticatedRequest(requestFor('sid-recycled'));
    await Promise.resolve();
    await Promise.resolve();
    expect(record).toHaveBeenCalledTimes(2);
  });
});
