/**
 * Forms and fields belong to one club, and the API has to enforce that.
 *
 * The seed writes a separate set of forms and fields per organisation — same
 * names, different rows — so an endpoint that forgets to scope itself does not
 * fail loudly. It quietly serves four clubs' worth of identical-looking
 * records. Three routes did:
 *
 *   GET /application-fields                              ran unfiltered
 *   GET /organisations/:id/application-forms             trusted the path
 *   GET /organisations/:id/form-submissions              trusted the path
 *
 * These tests run the **real** `organisation-scope.middleware` against a
 * stubbed database, so what is being checked is the refusal itself rather than
 * the presence of a middleware in a list.
 */

jest.mock('../../middleware/auth.middleware', () => ({
  authenticateToken: () => (req: any, res: any, next: any) => {
    if (!req.headers.authorization) return res.status(401).json({ error: 'no token' });
    req.user = { userId: 'kc-admin', email: 'admin@kildare.test' };
    next();
  },
  requireRole: () => (_req: any, _res: any, next: any) => next(),
}));

jest.mock('../../middleware/audit.middleware', () => ({
  audited: () => (_req: any, _res: any, next: any) => next(),
}));

jest.mock('../../config/logger', () => ({
  logger: { warn: jest.fn(), error: jest.fn(), info: jest.fn(), debug: jest.fn() },
}));

jest.mock('../../services/application-form.service', () => ({
  applicationFormService: {
    getAllApplicationFields: jest.fn().mockResolvedValue([]),
    getApplicationFormsByOrganisation: jest.fn().mockResolvedValue([]),
  },
}));

jest.mock('../../services/form-submission.service', () => ({
  formSubmissionService: {
    getSubmissionsByOrganisation: jest.fn().mockResolvedValue([]),
  },
}));

jest.mock('../../database/pool', () => ({
  db: { query: jest.fn() },
}));

import express from 'express';
import request from 'supertest';
import applicationFormRoutes from '../../routes/application-form.routes';
import { applicationFormService } from '../../services/application-form.service';
import { formSubmissionService } from '../../services/form-submission.service';
import { db } from '../../database/pool';

/** The club the caller administers, and one they do not. */
const KILDARE = '11111111-1111-4111-8111-111111111111';
const LAOIS = '22222222-2222-4222-8222-222222222222';

const app = express();
app.use(express.json());
// Mounted exactly as `index.ts` mounts it: bare first, then scoped.
app.use('/api/orgadmin', applicationFormRoutes);
app.use('/api/orgadmin/organisations/:organisationId', applicationFormRoutes);

const mockQuery = db.query as jest.Mock;
const mockFields = applicationFormService.getAllApplicationFields as jest.Mock;
const mockForms = applicationFormService.getApplicationFormsByOrganisation as jest.Mock;
const mockSubmissions = formSubmissionService.getSubmissionsByOrganisation as jest.Mock;

const membershipRow = {
  user_id: 'ou-1',
  organization_id: KILDARE,
  enabled_capabilities: [],
  org_status: 'active',
  status: 'active',
};

beforeEach(() => {
  jest.clearAllMocks();

  /*
   * One stub for both org-admin lookups the guards make. The organisation
   * asked about is the second parameter where the request named one, and the
   * caller's own club where it did not — and this caller administers Kildare
   * and nothing else.
   */
  mockQuery.mockImplementation(async (sql: string, params: any[] = []) => {
    if (/organization_users/.test(sql)) {
      const asked = params.length > 1 ? params[1] : KILDARE;
      return { rows: asked === KILDARE ? [membershipRow] : [] };
    }
    return { rows: [] };
  });
});

const asAdmin = (path: string) => request(app).get(path).set('Authorization', 'Bearer t');

describe('GET /api/orgadmin/application-fields', () => {
  it('lists only the fields of the organisation being worked in', async () => {
    await asAdmin('/api/orgadmin/application-fields').expect(200);

    expect(mockFields).toHaveBeenCalledWith(KILDARE);
  });

  it('never calls the service without an organisation', async () => {
    await asAdmin('/api/orgadmin/application-fields').expect(200);

    expect(mockFields).toHaveBeenCalledTimes(1);
    expect(mockFields.mock.calls[0][0]).toBeTruthy();
  });

  it('refuses a request that names a club the caller does not administer', async () => {
    await request(app)
      .get('/api/orgadmin/application-fields')
      .set('Authorization', 'Bearer t')
      .set('x-organisation-id', LAOIS)
      .expect(403);

    expect(mockFields).not.toHaveBeenCalled();
  });

  it('scopes to the club named in the path when the scoped mount is used', async () => {
    await asAdmin(`/api/orgadmin/organisations/${KILDARE}/application-fields`).expect(200);

    expect(mockFields).toHaveBeenCalledWith(KILDARE);
  });

  it('needs a token', async () => {
    await request(app).get('/api/orgadmin/application-fields').expect(401);
  });
});

describe('GET /api/orgadmin/organisations/:organisationId/application-forms', () => {
  it('serves the caller’s own club', async () => {
    await asAdmin(`/api/orgadmin/organisations/${KILDARE}/application-forms`).expect(200);

    expect(mockForms).toHaveBeenCalledWith(KILDARE);
  });

  it('refuses another club, rather than serving its forms', async () => {
    await asAdmin(`/api/orgadmin/organisations/${LAOIS}/application-forms`).expect(403);

    expect(mockForms).not.toHaveBeenCalled();
  });

  it('refuses a malformed organisation id without reaching the service', async () => {
    await asAdmin('/api/orgadmin/organisations/not-a-uuid/application-forms').expect(403);

    expect(mockForms).not.toHaveBeenCalled();
  });
});

describe('GET /api/orgadmin/organisations/:organisationId/form-submissions', () => {
  it('serves the caller’s own club', async () => {
    await asAdmin(`/api/orgadmin/organisations/${KILDARE}/form-submissions`).expect(200);

    expect(mockSubmissions).toHaveBeenCalledWith(KILDARE, expect.any(Object));
  });

  it('refuses another club, rather than serving its submitted answers', async () => {
    await asAdmin(`/api/orgadmin/organisations/${LAOIS}/form-submissions`).expect(403);

    expect(mockSubmissions).not.toHaveBeenCalled();
  });
});
