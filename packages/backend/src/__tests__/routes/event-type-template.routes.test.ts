/**
 * The platform administrator's template routes (task S0-4).
 *
 * Three things are worth a route test rather than a service test.
 *
 *  - **Every route is super-admin only.** A template defines how every club's
 *    events are built, so the gate is the point of the router.
 *  - **A carried status survives.** The older admin routers wrap each handler
 *    in `catch → 500`, which turns "no such template" into "the server broke";
 *    this one maps an `AppError` to its own status, and that is easy to lose in
 *    a later edit.
 *  - **The writes are audited**, with the actions the six locales have labels
 *    for. An action name is a string, and a typo in one is invisible until an
 *    audit log shows a raw identifier.
 */

jest.mock('../../middleware/auth.middleware', () => ({
  authenticateToken: () => (req: any, res: any, next: any) => {
    if (!req.headers.authorization) return res.status(401).json({ error: 'no token' });
    req.user = { userId: 'kc-1', roles: req.headers['x-test-roles']?.split(',') ?? [] };
    next();
  },
  requireRole: (role: string) => (req: any, res: any, next: any) =>
    (req.user?.roles ?? []).includes(role)
      ? next()
      : res.status(403).json({ error: 'Forbidden' }),
}));

const auditedCalls: any[] = [];
jest.mock('../../middleware/audit.middleware', () => ({
  audited: (options: any) => {
    auditedCalls.push(options);
    return (_req: any, _res: any, next: any) => next();
  },
}));

jest.mock('../../services/event-type-template.service', () => ({
  eventTypeTemplateService: {
    listTemplates: jest.fn(),
    getTemplate: jest.fn(),
    createTemplate: jest.fn(),
    updateTemplate: jest.fn(),
    resolveSettingsForType: jest.fn(),
    saveTypeOverride: jest.fn(),
  },
}));

jest.mock('../../config/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

import express from 'express';
import request from 'supertest';
import router from '../../routes/event-type-template.routes';
import { eventTypeTemplateService } from '../../services/event-type-template.service';
import { NotFoundError, BadRequestError } from '../../middleware/errors';

const app = express();
app.use(express.json());
app.use('/api/admin/event-type-templates', router);

const service = eventTypeTemplateService as jest.Mocked<typeof eventTypeTemplateService>;
const asSuperAdmin = (r: request.Test) =>
  r.set('Authorization', 'Bearer t').set('x-test-roles', 'super-admin');

const TEMPLATE = '11111111-1111-4111-8111-111111111111';
const TYPE = '33333333-3333-4333-8333-333333333333';

beforeEach(() => jest.clearAllMocks());

describe('who may reach these routes', () => {
  it('refuses an org admin', async () => {
    await request(app)
      .get('/api/admin/event-type-templates')
      .set('Authorization', 'Bearer t')
      .set('x-test-roles', 'org-admin')
      .expect(403);

    expect(service.listTemplates).not.toHaveBeenCalled();
  });

  it('refuses a caller with no token', async () => {
    await request(app).get('/api/admin/event-type-templates').expect(401);
  });

  it.each([
    ['get', '/api/admin/event-type-templates'],
    ['get', `/api/admin/event-type-templates/${TEMPLATE}`],
    ['post', '/api/admin/event-type-templates'],
    ['put', `/api/admin/event-type-templates/${TEMPLATE}`],
    ['get', `/api/admin/event-type-templates/${TEMPLATE}/rules/organisation-type/${TYPE}`],
    ['put', `/api/admin/event-type-templates/${TEMPLATE}/rules/organisation-type/${TYPE}`],
  ])('gates %s %s', async (method, path) => {
    // Named one by one rather than trusted to a shared `router.use`, because a
    // route added later without the guard would still pass a spot check.
    await (request(app) as any)
      [method](path)
      .set('Authorization', 'Bearer t')
      .set('x-test-roles', 'org-admin')
      .send({})
      .expect(403);
  });
});

describe('reading templates', () => {
  it('lists them', async () => {
    service.listTemplates.mockResolvedValue([{ key: 'equestrian.eventing' } as any]);

    const res = await asSuperAdmin(request(app).get('/api/admin/event-type-templates')).expect(200);

    expect(res.body).toEqual([{ key: 'equestrian.eventing' }]);
  });

  it('answers 404 for a template that is not there, not 500', async () => {
    service.getTemplate.mockRejectedValue(new NotFoundError('Event type template not found'));

    const res = await asSuperAdmin(
      request(app).get(`/api/admin/event-type-templates/${TEMPLATE}`)
    ).expect(404);

    expect(res.body.error).toMatch(/not found/i);
  });

  it('still answers 500 for something unrecognised', async () => {
    service.getTemplate.mockRejectedValue(new Error('connection reset'));

    const res = await asSuperAdmin(
      request(app).get(`/api/admin/event-type-templates/${TEMPLATE}`)
    ).expect(500);

    // The internal message does not travel.
    expect(res.body.error).not.toMatch(/connection reset/);
  });
});

describe('writing', () => {
  it('creates and answers 201', async () => {
    service.createTemplate.mockResolvedValue({ id: TEMPLATE } as any);

    await asSuperAdmin(
      request(app)
        .post('/api/admin/event-type-templates')
        .send({ key: 'equestrian.eventing', displayName: 'Eventing' })
    ).expect(201);

    expect(service.createTemplate).toHaveBeenCalledWith({
      key: 'equestrian.eventing',
      displayName: 'Eventing',
    });
  });

  it('passes the settings and the locked keys through to the type override', async () => {
    service.saveTypeOverride.mockResolvedValue({ locked: ['arenaCount'] } as any);

    await asSuperAdmin(
      request(app)
        .put(`/api/admin/event-type-templates/${TEMPLATE}/rules/organisation-type/${TYPE}`)
        .send({ settings: { arenaCount: 2 }, lockedKeys: ['arenaCount'] })
    ).expect(200);

    expect(service.saveTypeOverride).toHaveBeenCalledWith(TEMPLATE, TYPE, {
      settings: { arenaCount: 2 },
      lockedKeys: ['arenaCount'],
    });
  });

  it('reports a lock on a setting the template does not define as a 400', async () => {
    service.saveTypeOverride.mockRejectedValue(new BadRequestError('Cannot lock a setting'));

    await asSuperAdmin(
      request(app)
        .put(`/api/admin/event-type-templates/${TEMPLATE}/rules/organisation-type/${TYPE}`)
        .send({ settings: {}, lockedKeys: ['typo'] })
    ).expect(400);
  });

  it('survives a body with no settings at all', async () => {
    service.saveTypeOverride.mockResolvedValue({} as any);

    await asSuperAdmin(
      request(app)
        .put(`/api/admin/event-type-templates/${TEMPLATE}/rules/organisation-type/${TYPE}`)
        .send({})
    ).expect(200);

    expect(service.saveTypeOverride).toHaveBeenCalledWith(TEMPLATE, TYPE, {
      settings: {},
      lockedKeys: undefined,
    });
  });
});

describe('what the audit trail is told', () => {
  it('audits both writes, with actions the locales have labels for', () => {
    const actions = auditedCalls.map((options) => options.action);

    expect(actions).toContain('event-template.updated');
    expect(actions).toContain('event-rules.updated');
    expect(auditedCalls.every((options) => options.entityType === 'event-type-template')).toBe(true);
  });

  it('records which organisation type the rules were set for', () => {
    // The audited action alone would not say whose rules changed.
    const rules = auditedCalls.find((options) => options.action === 'event-rules.updated');
    const values = rules.values(
      { params: { organizationTypeId: TYPE }, body: { settings: { a: 1 } } },
      null
    );

    expect(values.organizationTypeId).toBe(TYPE);
    expect(values.settings).toEqual({ a: 1 });
  });
});
