import express from 'express';
import type { Server } from 'http';
import request from 'supertest';

/**
 * Where "Don't show this again" is recorded.
 *
 * The failure this suite exists for is a quiet one: the route rejected module
 * ids it did not recognise, the front end reverted its optimistic update
 * without telling anyone, and the user saw the dialog they had just dismissed
 * come back on their next visit. So the acceptance of *every* module the front
 * end can send is asserted here by name, not by example.
 */

jest.mock('../../config/logger');

jest.mock('../../services/user-preferences.service', () => ({
  userPreferencesService: {
    getOnboardingPreferences: jest.fn(),
    updateOnboardingPreferences: jest.fn(),
  },
}));

jest.mock('../../middleware/auth.middleware', () => ({
  authenticateToken: () => (req: any, _res: any, next: any) => {
    req.user = { userId: 'kc-1', email: 'a@example.com', username: 'a', roles: [], groups: [] };
    return next();
  },
}));

import { userPreferencesService } from '../../services/user-preferences.service';
import { ONBOARDING_MODULE_IDS } from '../../utils/onboarding-modules';
import userPreferencesRoutes from '../user-preferences.routes';

const mocked = userPreferencesService as jest.Mocked<typeof userPreferencesService>;

const app = express();
app.use(express.json());
app.use('/api/user-preferences', userPreferencesRoutes);

beforeEach(() => {
  jest.clearAllMocks();
  mocked.getOnboardingPreferences.mockResolvedValue({
    welcomeDismissed: false,
    modulesVisited: [],
  });
  mocked.updateOnboardingPreferences.mockImplementation(async (_userId, preferences) => ({
    welcomeDismissed: preferences.welcomeDismissed ?? false,
    modulesVisited: preferences.modulesVisited ?? [],
  }));
});


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

describe('GET /api/user-preferences/onboarding', () => {
  it('returns the stored preferences', async () => {
    mocked.getOnboardingPreferences.mockResolvedValue({
      welcomeDismissed: true,
      modulesVisited: ['events'],
    });

    const response = await request(server).get('/api/user-preferences/onboarding');

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual({ welcomeDismissed: true, modulesVisited: ['events'] });
  });
});

describe('PUT /api/user-preferences/onboarding', () => {
  it('records the welcome dialog as dismissed', async () => {
    const response = await request(server)
      .put('/api/user-preferences/onboarding')
      .send({ welcomeDismissed: true });

    expect(response.status).toBe(200);
    expect(mocked.updateOnboardingPreferences).toHaveBeenCalledWith('kc-1', {
      welcomeDismissed: true,
    });
  });

  /**
   * Every module, individually. A loop rather than a sample, because the bug
   * was one absent name — and a sample is exactly what missed it.
   */
  it.each(ONBOARDING_MODULE_IDS)('records a dismissal for the %s module', async (moduleId) => {
    const response = await request(server)
      .put('/api/user-preferences/onboarding')
      .send({ modulesVisited: [moduleId] });

    expect(response.status).toBe(200);
    expect(mocked.updateOnboardingPreferences).toHaveBeenCalledWith('kc-1', {
      modulesVisited: [moduleId],
    });
  });

  it('records a whole set of dismissals at once', async () => {
    const response = await request(server)
      .put('/api/user-preferences/onboarding')
      .send({ modulesVisited: [...ONBOARDING_MODULE_IDS] });

    expect(response.status).toBe(200);
  });

  it('refuses a module id that is not a module, and stores nothing', async () => {
    const response = await request(server)
      .put('/api/user-preferences/onboarding')
      .send({ modulesVisited: ['events', 'not-a-module'] });

    expect(response.status).toBe(400);
    expect(response.body.error.message).toContain('not-a-module');
    expect(mocked.updateOnboardingPreferences).not.toHaveBeenCalled();
  });

  it('refuses values of the wrong shape', async () => {
    expect(
      (await request(server).put('/api/user-preferences/onboarding').send({ welcomeDismissed: 'yes' }))
        .status
    ).toBe(400);
    expect(
      (await request(server).put('/api/user-preferences/onboarding').send({ modulesVisited: 'events' }))
        .status
    ).toBe(400);
    expect((await request(server).put('/api/user-preferences/onboarding').send({})).status).toBe(400);
  });
});
