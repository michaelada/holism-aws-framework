import express from 'express';
import type { Server } from 'http';
import request from 'supertest';

/**
 * Route-level behaviour for the account-user API surface.
 *
 * Exercises the wiring rather than the service logic: that /api/public/* needs
 * no token, that /api/account/* does, that the organisation is resolved from
 * the path, and — the easy one to get wrong — that /organisations is not
 * swallowed by the /:orgCode route declared after it.
 */

jest.mock('../../config/logger');
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

// authenticateToken is replaced with a stub driven by an x-test-user header, so
// these tests cover routing and authorisation without needing Keycloak.
jest.mock('../../middleware/auth.middleware', () => ({
  authenticateToken: () => (req: any, res: any, next: any) => {
    const userId = req.headers['x-test-user'];
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    req.user = {
      userId,
      email: 'm@example.com',
      username: 'm',
      roles: [],
      groups: [],
      // The claims a real Keycloak token carries with the `profile` scope.
      firstName: 'Darragh',
      lastName: "O'Toole",
    };
    return next();
  },
}));

import { accountOrganisationService } from '../../services/account-organisation.service';
import { accountRegistrationService } from '../../services/account-registration.service';
import publicRoutes from '../public.routes';
import accountRoutes from '../account.routes';

const mocked = accountOrganisationService as jest.Mocked<typeof accountOrganisationService>;
const mockedRegistration = accountRegistrationService as jest.Mocked<typeof accountRegistrationService>;

const app = express();
app.use(express.json());
app.use('/api/public', publicRoutes);
app.use('/api/account', accountRoutes);

const membership = {
  organisationId: 'org-1',
  organisationUserId: 'ou-1',
  urlCode: 'khpc',
  displayName: 'Kildare Hunt Pony Club',
  currency: 'EUR',
  language: 'en-GB',
  capabilities: ['memberships'],
  status: 'active',
};

beforeEach(() => jest.clearAllMocks());


/*
 * One listener for the whole file.
 *
 * `request(app)` starts a server on a fresh ephemeral port for every call. Over
 * a run that makes thousands of them, ports get reused while the previous
 * connection's packets are still in flight, and the client reads bytes that are
 * not a response at all — "Parse Error: Expected HTTP/", a hang-up, or somebody
 * else's reply. One listener per file removes that churn.
 */
let server: Server;

beforeAll((done) => {
  server = app.listen(0, done);
});

afterAll((done) => {
  server.close(done);
});

describe('GET /api/public/organisations', () => {

  it('needs no authentication', async () => {
    mocked.listPublicOrganisations.mockResolvedValue({ organisations: [], total: 0 });

    const res = await request(server).get('/api/public/organisations');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ organisations: [], total: 0 });
  });

  it('passes the search term through', async () => {
    mocked.listPublicOrganisations.mockResolvedValue({ organisations: [], total: 0 });

    await request(server).get('/api/public/organisations?q=pony&limit=10&offset=20');

    expect(mocked.listPublicOrganisations).toHaveBeenCalledWith({
      query: 'pony',
      limit: 10,
      offset: 20,
    });
  });

  it('ignores non-numeric paging rather than passing NaN to the query', async () => {
    mocked.listPublicOrganisations.mockResolvedValue({ organisations: [], total: 0 });

    await request(server).get('/api/public/organisations?limit=lots&offset=soon');

    expect(mocked.listPublicOrganisations).toHaveBeenCalledWith({
      query: undefined,
      limit: undefined,
      offset: undefined,
    });
  });

  it('returns 500 rather than leaking an error to an anonymous caller', async () => {
    mocked.listPublicOrganisations.mockRejectedValue(new Error('boom'));

    const res = await request(server).get('/api/public/organisations');

    expect(res.status).toBe(500);
    expect(JSON.stringify(res.body)).not.toContain('boom');
  });
});

describe('GET /api/public/organisations/:code', () => {
  it('returns the organisation for the gateway', async () => {
    mocked.getPublicOrganisationByCode.mockResolvedValue({
      urlCode: 'khpc',
      displayName: 'Kildare Hunt Pony Club',
      organisationType: 'Pony Club',
      branding: { logoUrl: '', primaryColor: '#1976d2', bookingsLabel: '' },
      capabilities: ['memberships'],
      currency: 'EUR',
      language: 'en-GB',
      registrationOpen: true,
    });

    const res = await request(server).get('/api/public/organisations/khpc');

    expect(res.status).toBe(200);
    expect(res.body.urlCode).toBe('khpc');
  });

  it('returns 404 with a code the gateway can act on', async () => {
    mocked.getPublicOrganisationByCode.mockResolvedValue(null);

    const res = await request(server).get('/api/public/organisations/nope');

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('ORGANISATION_UNAVAILABLE');
  });
});

describe('GET /api/account/organisations', () => {
  it('requires a token', async () => {
    const res = await request(server).get('/api/account/organisations');
    expect(res.status).toBe(401);
  });

  it('returns the caller\'s organisations', async () => {
    mocked.getOrganisationsForUser.mockResolvedValue([
      {
        urlCode: 'khpc',
        displayName: 'Kildare Hunt Pony Club',
        organisationType: 'Pony Club',
        branding: { logoUrl: '', primaryColor: '#1976d2', bookingsLabel: '' },
        status: 'active',
        capabilities: ['memberships'],
      },
    ]);

    const res = await request(server)
      .get('/api/account/organisations')
      .set('x-test-user', 'kc-1');

    expect(res.status).toBe(200);
    expect(res.body.organisations).toHaveLength(1);
    expect(mocked.getOrganisationsForUser).toHaveBeenCalledWith('kc-1');
  });

  it('is not captured by the /:orgCode route declared after it', async () => {
    // The failure mode this guards: "organisations" being read as an
    // organisation code, which would 404 the switcher for everyone.
    mocked.getOrganisationsForUser.mockResolvedValue([]);

    const res = await request(server)
      .get('/api/account/organisations')
      .set('x-test-user', 'kc-1');

    expect(res.status).toBe(200);
    expect(mocked.resolveMembership).not.toHaveBeenCalled();
  });
});

describe('GET /api/account/:orgCode/me', () => {
  it('requires a token', async () => {
    const res = await request(server).get('/api/account/khpc/me');
    expect(res.status).toBe(401);
    expect(mocked.resolveMembership).not.toHaveBeenCalled();
  });

  it('returns the member and organisation context in one call', async () => {
    mocked.resolveMembership.mockResolvedValue({ ok: true, membership });
    mocked.getAccountUserProfile.mockResolvedValue({
      id: 'ou-1',
      email: 'm@example.com',
      firstName: 'Michael',
      lastName: 'Adams',
      status: 'active',
      // Added when a member's language became their own rather than the
      // club's; the profile shape requires it (P1).
      preferredLanguage: null,
      lastLogin: null,
      memberSince: new Date('2019-03-18'),
    });

    const res = await request(server)
      .get('/api/account/khpc/me')
      .set('x-test-user', 'kc-1');

    expect(res.status).toBe(200);
    expect(res.body.user.firstName).toBe('Michael');
    expect(res.body.organisation).toMatchObject({
      urlCode: 'khpc',
      currency: 'EUR',
      capabilities: ['memberships'],
    });
  });

  it('resolves the organisation from the path for the authenticated user', async () => {
    mocked.resolveMembership.mockResolvedValue({ ok: true, membership });
    mocked.getAccountUserProfile.mockResolvedValue(null);

    await request(server).get('/api/account/bdtc/me').set('x-test-user', 'kc-9');

    expect(mocked.resolveMembership).toHaveBeenCalledWith('kc-9', 'bdtc');
  });

  it('reads the profile by the id the server resolved, not one supplied', async () => {
    mocked.resolveMembership.mockResolvedValue({ ok: true, membership });
    mocked.getAccountUserProfile.mockResolvedValue(null);

    await request(server)
      .get('/api/account/khpc/me?organisationUserId=someone-else')
      .set('x-test-user', 'kc-1');

    expect(mocked.getAccountUserProfile).toHaveBeenCalledWith('ou-1');
  });

  it.each([
    ['NOT_CONNECTED', 403],
    ['PENDING_APPROVAL', 403],
    ['REGISTRATION_REJECTED', 403],
    ['ORGANISATION_UNAVAILABLE', 404],
  ])('surfaces %s so the client can pick a screen', async (reason, status) => {
    mocked.resolveMembership.mockResolvedValue({ ok: false, reason } as any);

    const res = await request(server)
      .get('/api/account/khpc/me')
      .set('x-test-user', 'kc-1');

    expect(res.status).toBe(status);
    expect(res.body.error.code).toBe(reason);
  });

  it('does not load a profile when membership is refused', async () => {
    mocked.resolveMembership.mockResolvedValue({
      ok: false,
      reason: 'NOT_CONNECTED',
    } as any);

    await request(server).get('/api/account/khpc/me').set('x-test-user', 'kc-1');

    expect(mocked.getAccountUserProfile).not.toHaveBeenCalled();
  });
});

describe('POST /api/account/:orgCode/register', () => {
  it('requires a token', async () => {
    const res = await request(server).post('/api/account/khpc/register').send({});
    expect(res.status).toBe(401);
  });

  it('connects a signed-in identity that is not yet a member', async () => {
    // Deliberately not behind resolveAccountOrganisation — the caller is not a
    // member yet, which is the entire point.
    mocked.getOrganisationIdByCode.mockResolvedValue('org-1');
    mockedRegistration.register.mockResolvedValue({
      outcome: 'pending',
      organisationUserId: 'ou-1',
    });

    const res = await request(server)
      .post('/api/account/khpc/register')
      .set('x-test-user', 'kc-1')
      .send({ firstName: 'Michael', lastName: 'Adams' });

    expect(res.status).toBe(200);
    expect(res.body.outcome).toBe('pending');
    expect(mocked.resolveMembership).not.toHaveBeenCalled();
  });

  it('still reports an unexpected failure as a 500', async () => {
    mocked.getOrganisationIdByCode.mockResolvedValue('org-1');
    mockedRegistration.register.mockRejectedValue(new Error('connection reset'));

    const res = await request(server)
      .post('/api/account/khpc/register')
      .set('x-test-user', 'kc-1')
      .send({});

    expect(res.status).toBe(500);
  });

  it('connects a member whose browser sent no body at all', async () => {
    /*
     * The regression this exists for. "Connect to this club" is a single
     * button, so the request carries nothing; reading the name from the body
     * meant every such request arrived nameless and was refused as invalid,
     * and the member was told the club could not be joined.
     */
    mocked.getOrganisationIdByCode.mockResolvedValue('org-1');
    mockedRegistration.register.mockResolvedValue({
      outcome: 'active',
      organisationUserId: 'ou-1',
    });

    const res = await request(server)
      .post('/api/account/khpc/register')
      .set('x-test-user', 'kc-1');

    expect(res.status).toBe(200);
    expect(mockedRegistration.register).toHaveBeenCalledWith(
      'org-1',
      expect.objectContaining({ firstName: 'Darragh', lastName: "O'Toole" })
    );
  });

  it('takes the name from the token in preference to the body', async () => {
    // Same reasoning as the email below: a caller must not be able to register
    // under someone else's identity.
    mocked.getOrganisationIdByCode.mockResolvedValue('org-1');
    mockedRegistration.register.mockResolvedValue({
      outcome: 'active',
      organisationUserId: 'ou-1',
    });

    await request(server)
      .post('/api/account/khpc/register')
      .set('x-test-user', 'kc-1')
      .send({ firstName: 'Someone', lastName: 'Else' });

    expect(mockedRegistration.register).toHaveBeenCalledWith(
      'org-1',
      expect.objectContaining({ firstName: 'Darragh', lastName: "O'Toole" })
    );
  });

  it('takes the email from the verified token, never the body', async () => {
    // Otherwise a caller could register under someone else's address.
    mocked.getOrganisationIdByCode.mockResolvedValue('org-1');
    mockedRegistration.register.mockResolvedValue({
      outcome: 'active',
      organisationUserId: 'ou-1',
    });

    await request(server)
      .post('/api/account/khpc/register')
      .set('x-test-user', 'kc-1')
      .send({ firstName: 'M', lastName: 'A', email: 'victim@example.com' });

    expect(mockedRegistration.register).toHaveBeenCalledWith(
      'org-1',
      expect.objectContaining({ keycloakUserId: 'kc-1', email: 'm@example.com' })
    );
  });

  it('404s an unknown organisation without attempting registration', async () => {
    mocked.getOrganisationIdByCode.mockResolvedValue(null);

    const res = await request(server)
      .post('/api/account/nope/register')
      .set('x-test-user', 'kc-1')
      .send({ firstName: 'M', lastName: 'A' });

    expect(res.status).toBe(404);
    expect(mockedRegistration.register).not.toHaveBeenCalled();
  });
});

describe('GET /api/account/:orgCode/registration-status', () => {
  it('requires a token', async () => {
    const res = await request(server).get('/api/account/khpc/registration-status');
    expect(res.status).toBe(401);
  });

  it('reports a connected member', async () => {
    mocked.resolveMembership.mockResolvedValue({ ok: true, membership } as any);

    const res = await request(server)
      .get('/api/account/khpc/registration-status')
      .set('x-test-user', 'kc-1');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ state: 'connected' });
  });

  it.each([
    ['PENDING_APPROVAL', 'pending'],
    ['REGISTRATION_REJECTED', 'rejected'],
    ['NOT_CONNECTED', 'not_connected'],
    ['ACCOUNT_INACTIVE', 'inactive'],
  ])('answers %s with 200 and state %s', async (reason, state) => {
    // 200, not 403: a member waiting for approval is asking a legitimate
    // question, and the awaiting-approval screen polls this.
    mocked.resolveMembership.mockResolvedValue({ ok: false, reason } as any);

    const res = await request(server)
      .get('/api/account/khpc/registration-status')
      .set('x-test-user', 'kc-1');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ state });
  });

  it('404s an unknown organisation', async () => {
    mocked.resolveMembership.mockResolvedValue({
      ok: false,
      reason: 'ORGANISATION_UNAVAILABLE',
    } as any);

    const res = await request(server)
      .get('/api/account/nope/registration-status')
      .set('x-test-user', 'kc-1');

    expect(res.status).toBe(404);
  });
});
