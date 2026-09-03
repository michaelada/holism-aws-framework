/**
 * A club's own event rules, over the wire (task S0-4).
 *
 * Two acceptance criteria live here rather than in the service, because both
 * are about what the *caller* is told.
 *
 *  - A **locked** setting comes back as a **403 naming the key**, not a 200
 *    with the value quietly discarded. A club shown its old value back with no
 *    explanation cannot tell a federation's rule from a bug, and would try
 *    again.
 *  - The template the club may not use is a **404**, so the error does not
 *    confirm that a discipline it has not been granted exists.
 *
 * The router resolves the organisation itself from the token and the
 * `X-Organisation-Id` header, so the pool is mocked at that one query and every
 * other service it imports is stubbed away.
 */

jest.mock('../../middleware/auth.middleware', () => ({
  authenticateToken: () => (req: any, res: any, next: any) => {
    if (!req.headers.authorization) return res.status(401).json({ error: 'no token' });
    req.user = { userId: 'kc-1' };
    next();
  },
  requireRole: () => (_req: any, _res: any, next: any) => next(),
}));

jest.mock('../../middleware/audit.middleware', () => ({
  audited: () => (_req: any, _res: any, next: any) => next(),
}));

const ORGANISATION = '22222222-2222-4222-8222-222222222222';

jest.mock('../../database/pool', () => ({
  db: { query: jest.fn().mockResolvedValue({ rows: [{ organization_id: ORGANISATION }] }) },
}));

jest.mock('../../services/event-type-template.service', () => ({
  eventTypeTemplateService: {
    listTemplatesForOrganisation: jest.fn(),
    assertTemplateVisible: jest.fn(),
    resolveSettings: jest.fn(),
    saveOrganisationOverride: jest.fn(),
  },
}));

// Everything else the router imports, stubbed: none of it is on these paths.
jest.mock('../../services/organization-payment-settings.service', () => ({
  organizationPaymentSettingsService: {},
}));
jest.mock('../../services/payment.service', () => ({ paymentService: {} }));
jest.mock('../../services/lodgement.service', () => ({ lodgementService: {} }));
jest.mock('../../services/stripe-connect.service', () => ({ stripeConnectService: {} }));
jest.mock('../../services/organization-branding.service', () => ({
  organizationBrandingService: {},
}));
jest.mock('../../services/organization-email-templates.service', () => ({
  organizationEmailTemplatesService: {},
}));
jest.mock('../../services/account-registration.service', () => ({
  accountRegistrationService: {},
}));
jest.mock('../../services/audit', () => ({
  auditQueryService: {},
  queryFromRequest: jest.fn(),
  actorFromRequest: jest.fn(),
}));
jest.mock('../../config/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

import express from 'express';
import request from 'supertest';
import router from '../../routes/orgadmin-organisation.routes';
import { eventTypeTemplateService } from '../../services/event-type-template.service';
import { NotFoundError, ForbiddenError } from '../../middleware/errors';

const app = express();
app.use(express.json());
app.use('/api/orgadmin/organisation', router);

const service = eventTypeTemplateService as jest.Mocked<typeof eventTypeTemplateService>;
const TEMPLATE = '11111111-1111-4111-8111-111111111111';
const signedIn = (r: request.Test) => r.set('Authorization', 'Bearer t');

beforeEach(() => jest.clearAllMocks());

describe('GET /event-templates', () => {
  it('returns what the club may use, for the club the caller administers', async () => {
    service.listTemplatesForOrganisation.mockResolvedValue([{ key: 'equestrian.eventing' } as any]);

    const res = await signedIn(request(app).get('/api/orgadmin/organisation/event-templates')).expect(
      200
    );

    expect(res.body).toEqual([{ key: 'equestrian.eventing' }]);
    expect(service.listTemplatesForOrganisation).toHaveBeenCalledWith(ORGANISATION);
  });

  it('is empty rather than forbidden for a club without the module', async () => {
    // The list is the gate: no capability, no templates, no error to interpret.
    service.listTemplatesForOrganisation.mockResolvedValue([]);

    const res = await signedIn(
      request(app).get('/api/orgadmin/organisation/event-templates')
    ).expect(200);

    expect(res.body).toEqual([]);
  });
});

describe('GET /event-rules/:templateId', () => {
  it('checks the template is one this club may use before resolving it', async () => {
    service.assertTemplateVisible.mockResolvedValue({ id: TEMPLATE } as any);
    service.resolveSettings.mockResolvedValue({ settings: { a: 1 }, locked: [] } as any);

    await signedIn(request(app).get(`/api/orgadmin/organisation/event-rules/${TEMPLATE}`)).expect(
      200
    );

    expect(service.assertTemplateVisible).toHaveBeenCalledWith(TEMPLATE, ORGANISATION);
  });

  it('is a 404 for a template the club may not use', async () => {
    service.assertTemplateVisible.mockRejectedValue(new NotFoundError('not found'));

    await signedIn(request(app).get(`/api/orgadmin/organisation/event-rules/${TEMPLATE}`)).expect(
      404
    );

    expect(service.resolveSettings).not.toHaveBeenCalled();
  });
});

describe('PUT /event-rules/:templateId', () => {
  it('saves the club’s own differences', async () => {
    service.saveOrganisationOverride.mockResolvedValue({ settings: { gap: 15 } } as any);

    await signedIn(
      request(app)
        .put(`/api/orgadmin/organisation/event-rules/${TEMPLATE}`)
        .send({ settings: { gap: 15 } })
    ).expect(200);

    expect(service.saveOrganisationOverride).toHaveBeenCalledWith(TEMPLATE, ORGANISATION, {
      gap: 15,
    });
  });

  it('refuses a locked setting with a 403 that names it', async () => {
    service.saveOrganisationOverride.mockRejectedValue(
      new ForbiddenError('"gap" is fixed by your organisation type and cannot be changed here')
    );

    const res = await signedIn(
      request(app)
        .put(`/api/orgadmin/organisation/event-rules/${TEMPLATE}`)
        .send({ settings: { gap: 15 } })
    ).expect(403);

    expect(res.body.error).toContain('gap');
  });

  it('treats an empty body as "reset to template" rather than a bad request', async () => {
    service.saveOrganisationOverride.mockResolvedValue({ settings: {} } as any);

    await signedIn(request(app).put(`/api/orgadmin/organisation/event-rules/${TEMPLATE}`).send({}))
      .expect(200);

    expect(service.saveOrganisationOverride).toHaveBeenCalledWith(TEMPLATE, ORGANISATION, {});
  });

  it('refuses a caller with no token', async () => {
    await request(app)
      .put(`/api/orgadmin/organisation/event-rules/${TEMPLATE}`)
      .send({ settings: {} })
      .expect(401);
  });
});
