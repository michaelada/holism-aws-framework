/**
 * Wrapping a mutation so it records itself.
 *
 * The property under test throughout is that the wrapper is *transparent*: the
 * operation's result, its errors, and its timing are unchanged by being
 * audited. Everything else here is about capturing the before-state, which is
 * the only reason a wrapper exists rather than middleware.
 */

jest.mock('../audit.service', () => ({
  auditService: { record: jest.fn() },
  actorFromRequest: jest.fn(() => ({
    keycloakUserId: 'kc-1',
    userType: 'org-admin',
    display: 'Aoife Byrne',
    email: 'admin@kildarehunt.test',
  })),
  contextFromRequest: jest.fn(() => ({ ip: '10.0.0.1', method: 'PUT' })),
}));

import type { Request } from 'express';
import { auditService } from '../audit.service';
import { withAudit, recordAudit, organisationFromRequest } from '../with-audit';

const record = auditService.record as jest.Mock;

const ORG = '11111111-1111-1111-1111-111111111111';

const request = (extra: Record<string, unknown> = {}) =>
  ({ params: {}, body: {}, headers: {}, organisationId: ORG, ...extra }) as unknown as Request;

const lastEvent = () => record.mock.calls[record.mock.calls.length - 1][0];

beforeEach(() => jest.clearAllMocks());

describe('transparency', () => {
  it('returns exactly what the operation returned', async () => {
    const result = await withAudit(
      request(),
      { action: 'event.created', entityType: 'event' },
      async () => ({ id: 'e1', name: 'Autumn Hunter Trial' })
    );

    expect(result).toEqual({ id: 'e1', name: 'Autumn Hunter Trial' });
  });

  it('rethrows the operation error unchanged', async () => {
    const boom = new Error('event has entries and cannot be deleted');

    await expect(
      withAudit(request(), { action: 'event.deleted', entityType: 'event' }, async () => {
        throw boom;
      })
    ).rejects.toBe(boom);
  });

  it('records a failure event when the operation throws', async () => {
    await expect(
      withAudit(
        request(),
        { action: 'event.deleted', entityType: 'event', entityId: 'e1', label: 'Autumn Trial' },
        async () => {
          throw new Error('event has entries');
        }
      )
    ).rejects.toThrow();

    expect(lastEvent()).toMatchObject({
      action: 'event.deleted',
      outcome: 'failure',
      entityId: 'e1',
      entityLabel: 'Autumn Trial',
      context: expect.objectContaining({ error: 'event has entries' }),
    });
  });

  it('does not load the before-state for a create', async () => {
    const before = jest.fn();

    await withAudit(
      request(),
      { action: 'event.created', entityType: 'event', before },
      async () => ({ id: 'e1' })
    );

    // A create has nothing to load, and the query would be pure cost.
    expect(before).not.toHaveBeenCalled();
  });

  it('still performs the mutation when the before-load fails', async () => {
    /*
     * A row that cannot be read is recorded as a change with no before-state.
     * The alternative is a 500 on a delete that would otherwise have worked —
     * the log breaking the thing it audits, which is the one thing forbidden.
     */
    const operation = jest.fn(async () => ({ id: 'e1' }));

    const result = await withAudit(
      request(),
      {
        action: 'event.deleted',
        entityType: 'event',
        before: async () => {
          throw new Error('connection reset');
        },
      },
      operation
    );

    expect(operation).toHaveBeenCalled();
    expect(result).toEqual({ id: 'e1' });
  });
});

describe('what gets recorded', () => {
  it('records the whole row on a create', async () => {
    await withAudit(
      request(),
      { action: 'event.created', entityType: 'event', entityId: (r: any) => r.id, label: (r: any) => r.name },
      async () => ({ id: 'e1', name: 'Autumn Hunter Trial', entryFee: 2500 })
    );

    expect(lastEvent()).toMatchObject({
      action: 'event.created',
      entityId: 'e1',
      entityLabel: 'Autumn Hunter Trial',
      organisationId: ORG,
      changes: { created: { id: 'e1', name: 'Autumn Hunter Trial', entryFee: 2500 } },
    });
  });

  it('records only the fields that changed on an update', async () => {
    await withAudit(
      request(),
      {
        action: 'event.updated',
        entityType: 'event',
        before: async () => ({ id: 'e1', name: 'Autumn Trial', entryFee: 2500 }),
      },
      async () => ({ id: 'e1', name: 'Autumn Trial', entryFee: 3000 })
    );

    expect(lastEvent().changes).toEqual({ entryFee: { from: 2500, to: 3000 } });
  });

  it('records the row as it was on a delete', async () => {
    await withAudit(
      request(),
      {
        action: 'event.deleted',
        entityType: 'event',
        before: async () => ({ id: 'e1', name: 'Autumn Trial' }),
      },
      async () => undefined
    );

    expect(lastEvent().changes).toEqual({ deleted: { id: 'e1', name: 'Autumn Trial' } });
  });

  it('redacts fields the caller marks sensitive', async () => {
    await withAudit(
      request(),
      {
        action: 'entry.created',
        entityType: 'entry',
        sensitiveFields: new Set(['medicalNotes']),
      },
      async () => ({ id: 'x', name: 'Saoirse', medicalNotes: 'asthma inhaler' })
    );

    expect(lastEvent().changes.created.medicalNotes).toBe('[redacted]');
    expect(lastEvent().changes.created.name).toBe('Saoirse');
  });

  it('records an update that changed nothing, with an empty diff', async () => {
    // Somebody pressed Save. That is still an answer to "who touched this".
    await withAudit(
      request(),
      { action: 'event.updated', entityType: 'event', before: async () => ({ id: 'e1' }) },
      async () => ({ id: 'e1' })
    );

    expect(lastEvent()).toMatchObject({ action: 'event.updated', changes: {} });
  });

  it('carries the actor and the request context', async () => {
    await withAudit(request(), { action: 'event.created', entityType: 'event' }, async () => ({}));

    expect(lastEvent().actor).toMatchObject({ userType: 'org-admin', display: 'Aoife Byrne' });
    expect(lastEvent().context).toMatchObject({ ip: '10.0.0.1' });
  });
});

describe('the kind inferred from the action', () => {
  const kindOf = async (action: string) => {
    record.mockClear();
    await withAudit(
      request(),
      { action, entityType: 'thing', before: async () => ({ a: 1 }) },
      async () => ({ a: 2 })
    );
    const changes = lastEvent().changes;
    if (changes?.created) return 'create';
    if (changes?.deleted) return 'delete';
    if (changes && Object.keys(changes).length) return 'update';
    return 'action';
  };

  it.each([
    ['thing.created', 'create'],
    ['thing.updated', 'update'],
    ['thing.deleted', 'delete'],
    ['thing.cancelled', 'delete'],
    ['thing.renewed', 'update'],
  ])('%s is a %s', async (action, expected) => {
    expect(await kindOf(action)).toBe(expected);
  });

  it('treats an unrecognised verb as an action rather than guessing a diff', async () => {
    // A mislabelled diff files values under the wrong heading, which is worse
    // than recording no values at all.
    expect(await kindOf('entry.form-opened')).toBe('action');
  });
});

describe('resolving the organisation', () => {
  it('prefers what the scope middleware resolved', () => {
    expect(organisationFromRequest(request({ params: { organisationId: 'other' } }))).toBe(ORG);
  });

  it('falls back to the path, then the body', () => {
    expect(
      organisationFromRequest(
        request({ organisationId: undefined, params: { organisationId: 'from-path' } })
      )
    ).toBe('from-path');

    expect(
      organisationFromRequest(
        request({ organisationId: undefined, params: {}, body: { organisationId: 'from-body' } })
      )
    ).toBe('from-body');
  });

  it('accepts the American spelling the user-management routes use', () => {
    expect(
      organisationFromRequest(
        request({ organisationId: undefined, params: { organizationId: 'from-path' } })
      )
    ).toBe('from-path');
  });
});

describe('recordAudit, for things that are not mutations', () => {
  it('records the values it is given', () => {
    recordAudit(request(), {
      action: 'report.viewed',
      entityType: 'report',
      label: 'Revenue',
      values: { from: '2026-01-01', to: '2026-06-30' },
    });

    expect(lastEvent()).toMatchObject({
      action: 'report.viewed',
      entityLabel: 'Revenue',
      organisationId: ORG,
      changes: { created: { from: '2026-01-01', to: '2026-06-30' } },
      outcome: 'success',
    });
  });

  it('records nothing under changes when there are no values', () => {
    recordAudit(request(), { action: 'entry.form-opened', entityType: 'event' });
    expect(lastEvent().changes).toBeNull();
  });
});
