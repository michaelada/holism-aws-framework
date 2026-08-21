/**
 * Recording a route without touching the route.
 *
 * Two of these tests exist because of bugs that would have been invisible in
 * the interface: the spelling mismatch between a `SELECT *` and a response
 * body, which turns every update into "all fields changed", and the response
 * envelope, which would have filled the trail with `{success: true}`.
 */

jest.mock('../../database/pool', () => ({ db: { query: jest.fn() } }));
jest.mock('../../services/audit/audit.service', () => ({
  auditService: { record: jest.fn() },
  actorFromRequest: jest.fn(() => ({ keycloakUserId: 'kc-1', userType: 'org-admin' })),
  contextFromRequest: jest.fn(() => ({ ip: '10.0.0.1' })),
}));

import { EventEmitter } from 'events';
import type { Request, Response } from 'express';
import { db } from '../../database/pool';
import { auditService } from '../../services/audit/audit.service';
import { audited } from '../audit.middleware';

const mockDb = db as jest.Mocked<typeof db>;
const record = auditService.record as jest.Mock;
const lastEvent = () => record.mock.calls[record.mock.calls.length - 1][0];

const ORG = '11111111-1111-1111-1111-111111111111';
const ID = '22222222-2222-2222-2222-222222222222';

/** A response that behaves like the real one for the two things we use: `json` and `finish`. */
class FakeResponse extends EventEmitter {
  statusCode = 200;

  /** What the client was actually sent, recorded by the *original* `json`. */
  sent: unknown[] = [];

  json = (value: unknown) => {
    this.sent.push(value);
    return value;
  };

  /** What Express does at the end of a response. */
  finish(status = this.statusCode) {
    this.statusCode = status;
    this.emit('finish');
  }
}

const request = (overrides: Partial<Request> = {}) =>
  ({
    method: 'PUT',
    params: { id: ID },
    body: {},
    headers: {},
    organisationId: ORG,
    ...overrides,
  }) as unknown as Request;

/** Runs the middleware and returns the fake response, ready to be finished. */
const run = async (options: Parameters<typeof audited>[0], req: Request) => {
  const res = new FakeResponse();
  const next = jest.fn();
  await audited(options)(req, res as unknown as Response, next);
  expect(next).toHaveBeenCalled();
  return res;
};

beforeEach(() => {
  jest.clearAllMocks();
  mockDb.query.mockResolvedValue({ rows: [] } as any);
});

describe('the two spellings', () => {
  it('does not report every field as changed when the row is snake_case', async () => {
    /*
     * `before` is `SELECT *` — `entry_fee`. `after` is the response body, which
     * the service already mapped to `entryFee`. Diffed as-is, every field reads
     * as removed and re-added, and the trail is useless on exactly the updates
     * it exists for.
     */
    mockDb.query.mockResolvedValue({
      rows: [{ id: ID, name: 'Autumn Trial', entry_fee: 2500, organisation_id: ORG }],
    } as any);

    const res = await run(
      { action: 'event.updated', resource: 'event', label: 'name' },
      request()
    );

    res.json({ id: ID, name: 'Autumn Trial', entryFee: 3000, organisationId: ORG });
    res.finish(200);

    expect(lastEvent().changes).toEqual({ entryFee: { from: 2500, to: 3000 } });
  });

  it('leaves the housekeeping columns out of the diff', async () => {
    mockDb.query.mockResolvedValue({
      rows: [{ id: ID, name: 'Autumn Trial', updated_at: '2026-01-01', created_at: '2025-01-01' }],
    } as any);

    const res = await run({ action: 'event.updated', resource: 'event' }, request());
    res.json({ id: ID, name: 'Autumn Trial II', updatedAt: '2026-08-21', createdAt: '2025-01-01' });
    res.finish(200);

    expect(lastEvent().changes).toEqual({ name: { from: 'Autumn Trial', to: 'Autumn Trial II' } });
  });
});

describe('finding the row in the response', () => {
  it('unwraps a { data } envelope', async () => {
    const res = await run(
      { action: 'event.created', resource: 'event' },
      request({ method: 'POST', params: {} } as Partial<Request>)
    );

    res.json({ success: true, data: { id: ID, name: 'Autumn Trial' } });
    res.finish(201);

    // The uuid is the row's plumbing, not what it was created with — it is
    // already the event's `entityId`.
    expect(lastEvent().changes).toEqual({ created: { name: 'Autumn Trial' } });
    expect(lastEvent().entityId).toBe(ID);
    expect(lastEvent().entityLabel).toBe('Autumn Trial');
  });

  it('unwraps a single-key envelope such as { event }', async () => {
    const res = await run(
      { action: 'event.created', resource: 'event' },
      request({ method: 'POST', params: {} } as Partial<Request>)
    );

    res.json({ event: { id: ID, name: 'Hunter Trial' } });
    res.finish(201);

    expect(lastEvent().entityLabel).toBe('Hunter Trial');
  });

  it('takes the body as the row when it is not an envelope', async () => {
    const res = await run(
      { action: 'venue.created', resource: 'venue' },
      request({ method: 'POST', params: {} } as Partial<Request>)
    );

    res.json({ id: ID, name: 'Punchestown' });
    res.finish(201);

    expect(lastEvent().entityLabel).toBe('Punchestown');
  });

  it('falls back to what the client sent when the handler answers 204', async () => {
    mockDb.query.mockResolvedValue({ rows: [{ id: ID, name: 'Old', capacity: 40 }] } as any);

    const res = await run(
      { action: 'venue.updated', resource: 'venue' },
      request({ body: { capacity: 60 } } as Partial<Request>)
    );
    res.finish(204);

    // Merged onto the old row, so a partial update does not read as every
    // absent field being cleared.
    expect(lastEvent().changes).toEqual({ capacity: { from: 40, to: 60 } });
  });
});

describe('labels', () => {
  it('assembles a person from two columns', async () => {
    mockDb.query.mockResolvedValue({
      rows: [{ id: ID, first_name: 'Saoirse', last_name: 'Ní Bhriain' }],
    } as any);

    const res = await run({ action: 'member.updated', resource: 'member' }, request());
    res.finish(204);

    expect(lastEvent().entityLabel).toBe('Saoirse Ní Bhriain');
  });

  it('falls back to the before-row when the response carries no name', async () => {
    mockDb.query.mockResolvedValue({ rows: [{ id: ID, name: 'Autumn Trial' }] } as any);

    const res = await run({ action: 'event.deleted', resource: 'event' }, request());
    res.finish(204);

    expect(lastEvent().entityLabel).toBe('Autumn Trial');
  });
});

describe('outcome', () => {
  it('records a rejected change as a failure, with what was attempted', async () => {
    const res = await run(
      { action: 'event.created', resource: 'event' },
      request({ method: 'POST', params: {}, body: { name: '' } } as Partial<Request>)
    );

    res.json({ error: 'Event name is required' });
    res.finish(400);

    expect(lastEvent()).toMatchObject({
      outcome: 'failure',
      changes: { attempted: { name: '' } },
      context: expect.objectContaining({ status: 400, error: 'Event name is required' }),
    });
  });

  it('records a 403 as denied rather than as a failure', async () => {
    const res = await run({ action: 'event.deleted', resource: 'event' }, request());
    res.json({ error: { code: 'FORBIDDEN', message: 'You do not administer this organisation' } });
    res.finish(403);

    expect(lastEvent()).toMatchObject({
      outcome: 'denied',
      context: expect.objectContaining({ error: 'You do not administer this organisation' }),
    });
  });
});

describe('never breaking the route', () => {
  it('calls next when the before-load fails', async () => {
    mockDb.query.mockRejectedValue(new Error('connection reset'));

    const res = await run({ action: 'event.updated', resource: 'event' }, request());
    res.json({ id: ID, name: 'Autumn Trial' });
    res.finish(200);

    expect(lastEvent().changes).toBeDefined();
  });

  it('passes the response body through to the caller unchanged', async () => {
    // The middleware replaces `res.json` to see the row. The client must still
    // get exactly what the handler passed, by identity.
    const res = await run({ action: 'event.updated', resource: 'event' }, request());
    const body = { id: ID, name: 'Autumn Trial' };

    const returned = res.json(body);

    expect(res.sent).toEqual([body]);
    expect(returned).toBe(body);
  });

  it('does no before-query for a create', async () => {
    await run(
      { action: 'event.created', resource: 'event' },
      request({ method: 'POST', params: {} } as Partial<Request>)
    );

    expect(mockDb.query).not.toHaveBeenCalled();
  });

  it('does no before-query when the id is not a uuid', async () => {
    await run({ action: 'event.updated', resource: 'event' }, request({ params: { id: 'me' } } as Partial<Request>));
    expect(mockDb.query).not.toHaveBeenCalled();
  });

  it('honours skip', async () => {
    const res = new FakeResponse();
    const next = jest.fn();

    await audited({ action: 'event.updated', resource: 'event', skip: () => true })(
      request(),
      res as unknown as Response,
      next
    );

    res.finish(200);

    expect(next).toHaveBeenCalled();
    expect(record).not.toHaveBeenCalled();
  });
});

describe('deletes', () => {
  it('records the row that is gone', async () => {
    mockDb.query.mockResolvedValue({
      rows: [{ id: ID, name: 'Autumn Trial', entry_fee: 2500 }],
    } as any);

    const res = await run(
      { action: 'event.deleted', resource: 'event' },
      request({ method: 'DELETE' } as Partial<Request>)
    );
    res.finish(204);

    expect(lastEvent().changes).toEqual({
      deleted: { name: 'Autumn Trial', entryFee: 2500 },
    });
  });
});

describe('derived data is not a change', () => {
  it('ignores a joined collection the row does not own', async () => {
    /*
     * `activities` is not a column of `events` — it is a joined child list the
     * response carries. Reported as a change it went from nothing to a wall of
     * JSON on every single save, having not been touched. The before-row came
     * from `SELECT *`, so its keys are exactly the columns; anything else in
     * the response is not a stored value of this row.
     */
    mockDb.query.mockResolvedValue({
      rows: [{ id: ID, name: 'Winter Dressage', add_confirmation_message: false }],
    } as any);

    const res = await run({ action: 'event.updated', resource: 'event' }, request());

    res.json({
      id: ID,
      name: 'Winter Dressage',
      addConfirmationMessage: true,
      activities: [{ id: 'a1', name: 'Preliminary', fee: 30 }],
    });
    res.finish(200);

    expect(lastEvent().changes).toEqual({
      addConfirmationMessage: { from: false, to: true },
    });
  });

  it('records everything when there is no before-row to scope by', async () => {
    // A create has no columns to compare against, and the whole row is the record.
    const res = await run(
      { action: 'event.created', resource: 'event' },
      request({ method: 'POST', params: {} } as Partial<Request>)
    );

    res.json({ id: ID, name: 'Winter Dressage', activities: [] });
    res.finish(201);

    expect(lastEvent().changes.created).toHaveProperty('activities');
  });

  it('still reports a real change to a column the row does own', async () => {
    mockDb.query.mockResolvedValue({ rows: [{ id: ID, entries_limit: 100 }] } as any);

    const res = await run({ action: 'event.updated', resource: 'event' }, request());
    res.json({ id: ID, entriesLimit: 150, activities: [{ id: 'a1' }] });
    res.finish(200);

    expect(lastEvent().changes).toEqual({ entriesLimit: { from: 100, to: 150 } });
  });
});

describe('plumbing is not content', () => {
  it('leaves the uuid and the timestamps out of a created row', async () => {
    /*
     * A new form field arrived listing its uuid and both timestamps above its
     * actual label. None of it answers "what was this created with".
     */
    const res = await run(
      { action: 'field.created', resource: 'applicationField' },
      request({ method: 'POST', params: {} } as Partial<Request>)
    );

    res.json({
      id: ID,
      label: 'Any medical conditions?',
      datatype: 'text',
      createdAt: '2026-08-21T10:20:43.778Z',
      updatedAt: '2026-08-21T10:20:43.778Z',
      organisationId: ORG,
    });
    res.finish(201);

    expect(lastEvent().changes).toEqual({
      created: { label: 'Any medical conditions?', datatype: 'text' },
    });
  });

  it('leaves out the fields a route calls internal', async () => {
    // A field's `name` is generated from its label; both say the same thing.
    const res = await run(
      {
        action: 'field.created',
        resource: 'applicationField',
        exclude: new Set(['name']),
      },
      request({ method: 'POST', params: {} } as Partial<Request>)
    );

    res.json({ id: ID, name: 'any_medical_conditions', label: 'Any medical conditions?' });
    res.finish(201);

    expect(lastEvent().changes).toEqual({ created: { label: 'Any medical conditions?' } });
  });

  it('drops fields nobody filled in', async () => {
    const res = await run(
      { action: 'venue.created', resource: 'venue' },
      request({ method: 'POST', params: {} } as Partial<Request>)
    );

    res.json({ id: ID, name: 'Punchestown', latitude: null, notes: '', region: undefined });
    res.finish(201);

    expect(lastEvent().changes).toEqual({ created: { name: 'Punchestown' } });
  });

  it('keeps false and zero, which are values', async () => {
    const res = await run(
      { action: 'event.created', resource: 'event' },
      request({ method: 'POST', params: {} } as Partial<Request>)
    );

    res.json({ id: ID, name: 'Autumn Trial', limitEntries: false, entryFee: 0 });
    res.finish(201);

    expect(lastEvent().changes.created).toEqual({
      name: 'Autumn Trial',
      limitEntries: false,
      entryFee: 0,
    });
  });

  it('keeps a blank on a rejected change, because a blank is often the reason', async () => {
    const res = await run(
      { action: 'event.created', resource: 'event' },
      request({ method: 'POST', params: {}, body: { name: '', description: 'x' } } as Partial<Request>)
    );

    res.json({ error: 'Event name is required' });
    res.finish(400);

    expect(lastEvent().changes).toEqual({ attempted: { name: '', description: 'x' } });
  });

  it('still shows a field being cleared in a diff', async () => {
    // A snapshot omits what was never set; a diff must show what was emptied.
    mockDb.query.mockResolvedValue({ rows: [{ id: ID, description: 'Was here' }] } as any);

    const res = await run({ action: 'event.updated', resource: 'event' }, request());
    res.json({ id: ID, description: null });
    res.finish(200);

    expect(lastEvent().changes).toEqual({ description: { from: 'Was here', to: null } });
  });
});

describe('redaction', () => {
  it('hides fields the route marks sensitive', async () => {
    const res = await run(
      {
        action: 'entry.created',
        entityType: 'entry',
        sensitiveFields: new Set(['medicalNotes']),
      },
      request({ method: 'POST', params: {} } as Partial<Request>)
    );

    res.json({ id: ID, name: 'Saoirse', medicalNotes: 'asthma inhaler' });
    res.finish(201);

    expect(lastEvent().changes.created).toMatchObject({
      name: 'Saoirse',
      medicalNotes: '[redacted]',
    });
  });
});
