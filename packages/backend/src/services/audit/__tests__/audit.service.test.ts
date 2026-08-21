/**
 * Writing the audit trail.
 *
 * Two properties matter more than the rest, and both are about what this must
 * *not* do: it must never break the thing it is auditing, and a failed write
 * must never try to audit itself. The second is the loop — if the table is what
 * is broken, recording "the write failed" fails too, and triggers another.
 *
 * See docs/AUDIT_TRAIL_AND_SESSIONS.md §2.6.
 */

jest.mock('../../../config/logger');
jest.mock('../../../database/pool', () => ({ db: { query: jest.fn() } }));

import { db } from '../../../database/pool';
import { logger } from '../../../config/logger';
import { auditService } from '../audit.service';
import { actorFromRequest, contextFromRequest } from '../audit.service';

const mockDb = db as jest.Mocked<typeof db>;

const actor = {
  keycloakUserId: 'kc-1',
  userType: 'org-admin' as const,
  display: 'Aoife Byrne',
  email: 'admin@kildarehunt.test',
};

beforeEach(() => {
  jest.clearAllMocks();
  mockDb.query.mockResolvedValue({ rows: [] } as any);
});

describe('never breaking the thing it audits', () => {
  it('does not throw when the database refuses the write', async () => {
    /*
     * The entry is the business; the log is the record of it. A member's entry
     * must not fail because the audit table is full. The service this replaced
     * rethrew, which is backwards.
     */
    mockDb.query.mockRejectedValue(new Error('relation "audit_events" does not exist'));

    auditService.record({ category: 'events', action: 'entry.created', actor });

    await expect(auditService.flushNow()).resolves.toBeUndefined();
  });

  it('does not throw when the event itself is malformed', async () => {
    const circular: any = {};
    circular.self = circular;

    expect(() =>
      auditService.record({ category: 'events', action: 'entry.created', actor, changes: circular })
    ).not.toThrow();
  });

  it('records without waiting for the database', () => {
    // `record` is deliberately not async: an audit write must not sit on the
    // critical path of the mutation it describes.
    auditService.record({ category: 'events', action: 'entry.created', actor });

    expect(mockDb.query).not.toHaveBeenCalled();
    expect(auditService.health().queued).toBeGreaterThan(0);
  });
});

describe('a failed write does not audit itself', () => {
  it('counts and logs the failure instead of recording another event', async () => {
    /*
     * The whole answer to "would recording the failure loop?". It would, if the
     * record went through `record()`. It does not — a counter and the
     * application logger, neither of which touches the table that just failed.
     */
    mockDb.query.mockRejectedValue(new Error('disk full'));
    const before = auditService.health().failures;

    auditService.record({ category: 'events', action: 'entry.created', actor });
    await auditService.flushNow();

    expect(auditService.health().failures).toBe(before + 1);
    expect(logger.error).toHaveBeenCalledWith('Audit write failed', expect.any(Object));
    // Nothing was re-queued: the queue is empty, not growing.
    expect(auditService.health().queued).toBe(0);
  });

  it('drops the batch rather than retrying it forever', async () => {
    // A retry loop against a table refusing writes grows the queue without
    // bound. The honest outcome of "the store is down" is a recorded gap.
    mockDb.query.mockRejectedValue(new Error('disk full'));

    auditService.record({ category: 'events', action: 'entry.created', actor });
    await auditService.flushNow();
    mockDb.query.mockResolvedValue({ rows: [] } as any);
    await auditService.flushNow();

    expect(mockDb.query).toHaveBeenCalledTimes(1);
  });
});

describe('what gets written', () => {
  it('writes one statement for a batch, not one per event', async () => {
    for (let i = 0; i < 5; i += 1) {
      auditService.record({ category: 'events', action: 'entry.created', actor });
    }
    await auditService.flushNow();

    expect(mockDb.query).toHaveBeenCalledTimes(1);
    const [sql] = mockDb.query.mock.calls[0];
    expect(sql).toContain('INSERT INTO audit_events');
  });

  it('carries the actor, denormalised', async () => {
    /*
     * Not a foreign key, and copied at write time: an audit row has to outlive
     * the user it describes, and a later rename must not rewrite history.
     */
    auditService.record({ category: 'events', action: 'entry.created', actor });
    await auditService.flushNow();

    const params = mockDb.query.mock.calls[0][1] as any[];
    expect(params).toContain('kc-1');
    expect(params).toContain('org-admin');
    expect(params).toContain('Aoife Byrne');
  });

  it('defaults the outcome to success, so a filter on failure means something', async () => {
    auditService.record({ category: 'events', action: 'entry.created', actor });
    await auditService.flushNow();

    expect(mockDb.query.mock.calls[0][1]).toContain('success');
  });

  it('shouts about an action that is not in the registry', () => {
    // A typo produces an event nobody can filter for, so it is recorded and
    // complained about rather than silently accepted.
    auditService.record({ category: 'events', action: 'entry.nonsense' as any, actor });

    expect(logger.error).toHaveBeenCalledWith(
      'Audit action is not in the registry',
      expect.objectContaining({ action: 'entry.nonsense' })
    );
  });

  it('flattens the searchable text so free-text filtering has something to hit', async () => {
    auditService.record({
      category: 'memberships',
      action: 'membership.created',
      actor,
      entityLabel: 'Senior Member',
      changes: { created: { membershipNumber: 'KHP-0241' } },
    });
    await auditService.flushNow();

    const params = mockDb.query.mock.calls[0][1] as any[];
    const searchText = params.find((p) => typeof p === 'string' && p.includes('KHP-0241'));
    expect(searchText).toContain('Aoife Byrne');
    expect(searchText).toContain('Senior Member');
  });
});

describe('who the actor is, from a request', () => {
  const request = (over: Record<string, unknown> = {}) => ({ headers: {}, socket: {}, ...over }) as any;

  it('reads a super admin from the token roles', () => {
    const result = actorFromRequest(
      request({ user: { userId: 'kc-1', roles: ['super-admin', 'admin'], email: 'sam@x.test' } })
    );

    expect(result.userType).toBe('super-admin');
  });

  it('calls a signed-in member an account user', () => {
    // `req.account` is set by the account middleware and is what distinguishes
    // a member from an administrator who happens to have no roles.
    const result = actorFromRequest(
      request({ user: { userId: 'kc-2', roles: [], email: 'n@x.test' }, account: { organisationId: 'o' } })
    );

    expect(result.userType).toBe('account-user');
  });

  it('calls nobody anonymous rather than guessing', () => {
    // A failed sign-in has no authenticated actor. "anonymous" is a fact; a
    // blank would read as a bug.
    const result = actorFromRequest(request());

    expect(result.userType).toBe('anonymous');
    expect(result.keycloakUserId).toBeNull();
  });
});

describe('the context of a request', () => {
  it('prefers the forwarded address, because everything is behind nginx', () => {
    const context = contextFromRequest({
      headers: { 'x-forwarded-for': '203.0.113.7, 10.0.0.1' },
      socket: { remoteAddress: '10.0.0.1' },
    } as any);

    expect(context.ip).toBe('203.0.113.7');
  });

  it('carries the session id, so an event ties to a row on the Sessions screen', () => {
    const context = contextFromRequest({
      headers: {},
      socket: {},
      user: { sessionId: 'sid-1' },
    } as any);

    expect(context.sessionId).toBe('sid-1');
  });
});
