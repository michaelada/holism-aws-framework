/**
 * One entry, in full.
 *
 * The org-admin app had no screen for a single entry: a payment line linked to
 * the entrant *list* for the whole event, which answers neither "what did they
 * write on the form" nor "what did they pay". This endpoint is what that screen
 * reads, and it carries two fixes that were only visible from the routing
 * table: the export path was being read as an entry id, and the entry lookup
 * ignored the event it was supposed to belong to.
 */

/*
 * The router imports its guards from the middleware barrel, so the barrel is
 * what has to be replaced. Each is a pass-through: what this file is about is
 * the routing and the handlers, and the guards have their own suites.
 */
const pass = (_req: any, _res: any, next: any) => next();

jest.mock('../../middleware', () => ({
  authenticateToken: () => (req: any, _res: any, next: any) => {
    req.user = { userId: 'kc-1' };
    next();
  },
  byParam: () => pass,
  byResource: () => pass,
  byBodyOrCurrent: () => pass,
  byCurrentOrganisation: () => pass,
  requireOrgAdminCapability: () => [pass],
  requireRole: () => pass,
}));

jest.mock('../../middleware/audit.middleware', () => ({
  audited: () => (_req: any, _res: any, next: any) => next(),
}));

jest.mock('../../services/event-entry.service', () => ({
  eventEntryService: {
    getEntryById: jest.fn(),
    getEntriesByEvent: jest.fn(),
    exportEntriesToExcel: jest.fn(),
    updateEntryAnswers: jest.fn(),
  },
}));

jest.mock('../../services/audit/sensitive-fields', () => ({
  sensitiveFieldsFor: jest.fn().mockResolvedValue(new Set()),
}));

jest.mock('../../services/event.service', () => ({
  eventService: { getEventById: jest.fn() },
}));

jest.mock('../../config/logger', () => ({
  logger: { warn: jest.fn(), error: jest.fn(), info: jest.fn() },
}));

import express from 'express';
import request from 'supertest';
import eventRouter from '../../routes/event.routes';
import { eventEntryService } from '../../services/event-entry.service';
import { eventService } from '../../services/event.service';

const app = express();
app.use(express.json());
app.use('/api/orgadmin', eventRouter);

const getEntry = eventEntryService.getEntryById as jest.Mock;
const updateAnswers = eventEntryService.updateEntryAnswers as jest.Mock;
const exportEntries = eventEntryService.exportEntriesToExcel as jest.Mock;
const getEvent = eventService.getEventById as jest.Mock;

const EVENT = '11111111-1111-1111-1111-111111111111';
const ENTRY = '22222222-2222-2222-2222-222222222222';

const entry = (over: Record<string, unknown> = {}) => ({
  id: ENTRY,
  eventId: EVENT,
  eventActivityId: 'act-1',
  firstName: 'Áine',
  lastName: 'McGrath',
  email: 'aine@example.test',
  paymentStatus: 'paid',
  entryDate: '2026-08-01T10:00:00.000Z',
  activityName: 'Intermediate',
  activityDescription: 'Open to riders who have not won at this level',
  activityFee: 25,
  eventName: 'Spring League',
  formSummary: [{ label: 'Pony name', value: 'Bramble' }],
  paymentId: 'pay-1',
  paymentAmount: 185.23,
  memberName: 'Áine McGrath',
  ...over,
});

beforeEach(() => jest.clearAllMocks());

describe('GET /api/orgadmin/events/:eventId/entries/:entryId', () => {
  it('returns the entry with its answers and its payment', async () => {
    getEntry.mockResolvedValue(entry());

    const res = await request(app).get(`/api/orgadmin/events/${EVENT}/entries/${ENTRY}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      firstName: 'Áine',
      activityName: 'Intermediate',
      activityFee: 25,
      paymentId: 'pay-1',
    });
    expect(res.body.formSummary).toEqual([{ label: 'Pony name', value: 'Bramble' }]);
  });

  it('404s for an entry belonging to a different event', async () => {
    /*
     * The guard authorises the event, not the entry. Without this check an
     * entry id from another club could be read by naming one of your own
     * events — and a 403 would confirm the id exists, so it is a 404.
     */
    getEntry.mockResolvedValue(entry({ eventId: '33333333-3333-3333-3333-333333333333' }));

    const res = await request(app).get(`/api/orgadmin/events/${EVENT}/entries/${ENTRY}`);

    expect(res.status).toBe(404);
    expect(res.body).not.toHaveProperty('firstName');
  });

  it('404s for an entry that does not exist', async () => {
    getEntry.mockResolvedValue(null);

    const res = await request(app).get(`/api/orgadmin/events/${EVENT}/entries/${ENTRY}`);

    expect(res.status).toBe(404);
  });

  it('500s rather than answering with a half-loaded entry', async () => {
    getEntry.mockRejectedValue(new Error('connection lost'));

    const res = await request(app).get(`/api/orgadmin/events/${EVENT}/entries/${ENTRY}`);

    expect(res.status).toBe(500);
  });
});

describe('GET /api/orgadmin/events/:eventId/entries/export', () => {
  it('exports rather than being read as an entry id', async () => {
    // Declared after `/entries/:entryId`, "export" matched the parameter: the
    // export never ran and the entry lookup was handed the word.
    getEvent.mockResolvedValue({ id: EVENT, name: 'Spring League' });
    exportEntries.mockResolvedValue(Buffer.from('xlsx'));

    const res = await request(app).get(`/api/orgadmin/events/${EVENT}/entries/export`);

    expect(res.status).toBe(200);
    expect(exportEntries).toHaveBeenCalledWith(EVENT);
    expect(getEntry).not.toHaveBeenCalled();
    expect(res.headers['content-disposition']).toContain('Spring_League_entries.xlsx');
  });
});

/**
 * Correcting an entry.
 *
 * A club's remedy for a member's mistake. The endpoint carries the name and the
 * answers together because they are corrected together — the name typed in a
 * hurry is usually noticed at the same time as the answer beneath it.
 */
describe('PUT /api/orgadmin/events/:eventId/entries/:entryId/answers', () => {
  beforeEach(() => updateAnswers.mockResolvedValue(entry()));

  it('passes the answers and the name through', async () => {
    const res = await request(app)
      .put(`/api/orgadmin/events/${EVENT}/entries/${ENTRY}/answers`)
      .send({ name: 'Áine de Búrca', answers: { pony_name: 'Cloud' } });

    expect(res.status).toBe(200);
    expect(updateAnswers).toHaveBeenCalledWith(
      EVENT,
      ENTRY,
      { pony_name: 'Cloud' },
      'Áine de Búrca'
    );
  });

  it('accepts a correction to the name alone', async () => {
    // An activity that asks nothing still has a name to fix.
    const res = await request(app)
      .put(`/api/orgadmin/events/${EVENT}/entries/${ENTRY}/answers`)
      .send({ name: 'Bríd McNamara' });

    expect(res.status).toBe(200);
    expect(updateAnswers).toHaveBeenCalledWith(EVENT, ENTRY, {}, 'Bríd McNamara');
  });

  it('names each answer that needs correcting', async () => {
    const { ValidationError } = jest.requireActual('../../middleware/errors');
    updateAnswers.mockRejectedValue(
      new ValidationError('Some answers need correcting', [
        { field: 'dob', label: 'Date of birth', message: 'Must be a valid date' },
      ])
    );

    const res = await request(app)
      .put(`/api/orgadmin/events/${EVENT}/entries/${ENTRY}/answers`)
      .send({ answers: { dob: 'sometime in May' } });

    expect(res.status).toBe(400);
    expect(res.body.fields[0]).toMatchObject({ label: 'Date of birth' });
  });

  it('404s for an entry on another event', async () => {
    const { NotFoundError } = jest.requireActual('../../middleware/errors');
    updateAnswers.mockRejectedValue(new NotFoundError('Entry not found'));

    const res = await request(app)
      .put(`/api/orgadmin/events/${EVENT}/entries/${ENTRY}/answers`)
      .send({ answers: {} });

    expect(res.status).toBe(404);
  });

  it('refuses a body whose answers are not an object', async () => {
    const res = await request(app)
      .put(`/api/orgadmin/events/${EVENT}/entries/${ENTRY}/answers`)
      .send({ answers: 'Cloud' });

    expect(res.status).toBe(400);
    expect(updateAnswers).not.toHaveBeenCalled();
  });
});
