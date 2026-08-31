/**
 * Reporting a sign-out.
 *
 * A sign-out is a redirect to Keycloak, so no request ever reaches this process
 * as the session ends. `auth.logout` had a label, six translations and a place
 * in the viewer, and nothing that could emit it — every trail showed sign-ins
 * with no sign-outs. This endpoint is the producer.
 */

jest.mock('../../middleware/auth.middleware', () => ({
  authenticateToken: () => (req: any, _res: any, next: any) => {
    if (!req.headers.authorization) return _res.status(401).json({ error: 'no token' });
    req.user = { userId: 'kc-1', sessionId: 'sid-1', email: 'admin@club.test' };
    next();
  },
  requireRole: () => (_req: any, _res: any, next: any) => next(),
}));

jest.mock('../../middleware/audit-auth.middleware', () => ({
  recordSessionEvent: jest.fn().mockResolvedValue(undefined),
  forgetSession: jest.fn(),
}));

jest.mock('../../services/audit', () => ({
  audit: { record: jest.fn(), fromRequest: jest.fn() },
  auditQueryService: {},
  actorFromRequest: jest.fn(() => ({ keycloakUserId: 'kc-1', userType: 'org-admin' })),
  contextFromRequest: jest.fn(() => ({ ip: '10.0.0.1' })),
  queryFromRequest: jest.fn(),
}));

jest.mock('../../services/session.service', () => ({ sessionService: {} }));
jest.mock('../../config/logger', () => ({ logger: { warn: jest.fn(), error: jest.fn() } }));

import express from 'express';
import request from 'supertest';
import { sessionReportRouter } from '../../routes/audit.routes';
import { recordSessionEvent, forgetSession } from '../../middleware/audit-auth.middleware';

const app = express();
app.use(express.json());
app.use('/api/audit', sessionReportRouter);

const mockRecord = recordSessionEvent as jest.Mock;
const mockForget = forgetSession as jest.Mock;

beforeEach(() => jest.clearAllMocks());

describe('POST /api/audit/session/logout', () => {
  it('records auth.logout for the signed-in caller', async () => {
    await request(app)
      .post('/api/audit/session/logout')
      .set('Authorization', 'Bearer token')
      .send({ application: 'orgadmin-client' })
      .expect(202);

    expect(mockRecord).toHaveBeenCalledTimes(1);
    const [action, keycloakUserId, , context] = mockRecord.mock.calls[0];
    expect(action).toBe('auth.logout');
    expect(keycloakUserId).toBe('kc-1');
    expect(context).toMatchObject({ application: 'orgadmin-client' });
  });

  it('forgets the session, so the next sign-in is recorded as one', async () => {
    await request(app)
      .post('/api/audit/session/logout')
      .set('Authorization', 'Bearer token')
      .send({})
      .expect(202);

    expect(mockForget).toHaveBeenCalledWith('sid-1');
  });

  it('refuses an unauthenticated report', async () => {
    // The actor must come from the token: otherwise anybody could write a
    // sign-out naming anybody.
    await request(app).post('/api/audit/session/logout').send({}).expect(401);

    expect(mockRecord).not.toHaveBeenCalled();
  });

  it('ignores an application name that is not a string', async () => {
    await request(app)
      .post('/api/audit/session/logout')
      .set('Authorization', 'Bearer token')
      .send({ application: { nested: 'object' } })
      .expect(202);

    expect(mockRecord.mock.calls[0][3].application).toBeUndefined();
  });

  it('still answers 202 when recording throws', async () => {
    mockRecord.mockRejectedValueOnce(new Error('audit store unreachable'));

    // A failed report must never be able to block somebody signing out.
    await request(app)
      .post('/api/audit/session/logout')
      .set('Authorization', 'Bearer token')
      .send({})
      .expect(202);
  });
});
