import express from 'express';
import type { Server } from 'http';
import request from 'supertest';

/**
 * The endpoint a member's application-form answers arrive at.
 *
 * The client validates first and names the offending field, but this is a
 * plain authenticated POST and the submission it creates is what a membership
 * or an entry is built from afterwards — `members.form_submission_id` is NOT
 * NULL. So the check is asserted here, at the door, not only in the page.
 */

jest.mock('../../config/logger');

jest.mock('../../services/account-organisation.service', () => ({
  accountOrganisationService: {
    resolveMembership: jest.fn(),
    getOrganisationIdByCode: jest.fn(),
  },
}));

jest.mock('../../services/application-form.service', () => ({
  applicationFormService: { getApplicationFormWithFields: jest.fn() },
}));

/*
 * `FormSubmissionService` is also constructed by `membership.service`, which
 * this router pulls in transitively — so the mock has to keep the class, not
 * just the singleton, or the import chain dies before any test runs.
 */
jest.mock('../../services/form-submission.service', () => ({
  FormSubmissionService: class {},
  formSubmissionService: { createSubmission: jest.fn() },
}));

jest.mock('../../middleware/auth.middleware', () => ({
  authenticateToken: () => (req: any, _res: any, next: any) => {
    req.user = { userId: 'kc-1', email: 'm@example.com', username: 'm', roles: [], groups: [] };
    return next();
  },
}));

import { accountOrganisationService } from '../../services/account-organisation.service';
import { applicationFormService } from '../../services/application-form.service';
import { formSubmissionService } from '../../services/form-submission.service';
import accountRoutes from '../account.routes';

const mockedOrg = accountOrganisationService as jest.Mocked<typeof accountOrganisationService>;
const mockedForms = applicationFormService as jest.Mocked<typeof applicationFormService>;
const mockedSubmissions = formSubmissionService as jest.Mocked<typeof formSubmissionService>;

const app = express();
app.use(express.json());
app.use('/api/account', accountRoutes);

const form = {
  id: 'form-1',
  organisationId: 'org-1',
  fields: [
    { name: 'email', label: 'Email', datatype: 'email', required: true },
    { name: 'mobile', label: 'Mobile', datatype: 'phone' },
    { name: 'age_group', label: 'Age group', datatype: 'radio', options: ['Under 12'] },
  ],
};

const post = (submissionData: Record<string, unknown>) =>
  request(server)
    .post('/api/account/khpc/form-submissions')
    .send({
      formId: 'form-1',
      contextId: 'act-1',
      submissionType: 'event_entry',
      submissionData,
    });

beforeEach(() => {
  jest.clearAllMocks();
  mockedOrg.resolveMembership.mockResolvedValue({
    ok: true,
    membership: {
      organisationId: 'org-1',
      organisationUserId: 'ou-1',
      urlCode: 'khpc',
      displayName: 'Kildare Hunt Pony Club',
      currency: 'EUR',
      language: 'en-GB',
      capabilities: [],
      status: 'active',
    },
  } as any);
  mockedForms.getApplicationFormWithFields.mockResolvedValue(form as any);
  mockedSubmissions.createSubmission.mockResolvedValue({ id: 'sub-1' } as any);
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

describe('POST /api/account/:orgCode/form-submissions', () => {
  it('stores a submission whose answers are all good', async () => {
    const response = await post({
      email: 'member@club.ie',
      mobile: '+353 1 234 5678',
      age_group: 'Under 12',
    });

    expect(response.status).toBe(201);
    expect(mockedSubmissions.createSubmission).toHaveBeenCalled();
  });

  it('refuses an email that is not an email, and stores nothing', async () => {
    const response = await post({ email: 'not an email' });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('INVALID_SUBMISSION');
    expect(response.body.error.fields).toEqual([
      expect.objectContaining({ field: 'email', label: 'Email' }),
    ]);
    expect(mockedSubmissions.createSubmission).not.toHaveBeenCalled();
  });

  it('refuses letters in a phone number', async () => {
    const response = await post({ email: 'member@club.ie', mobile: 'call the club' });

    expect(response.status).toBe(400);
    expect(response.body.error.fields.map((f: any) => f.field)).toEqual(['mobile']);
    expect(mockedSubmissions.createSubmission).not.toHaveBeenCalled();
  });

  /** Not reachable through the form — so it did not come from the form. */
  it('refuses a choice that was never offered', async () => {
    const response = await post({ email: 'member@club.ie', age_group: 'Under 21' });

    expect(response.status).toBe(400);
    expect(response.body.error.fields.map((f: any) => f.field)).toEqual(['age_group']);
  });

  it('refuses a submission missing a required answer', async () => {
    const response = await post({ mobile: '+353 1 234 5678' });

    expect(response.status).toBe(400);
    expect(response.body.error.fields.map((f: any) => f.field)).toEqual(['email']);
  });

  it('names every bad answer at once rather than one per attempt', async () => {
    const response = await post({ email: 'nope', mobile: 'ring us', age_group: 'Under 21' });

    expect(response.body.error.fields.map((f: any) => f.field)).toEqual([
      'email',
      'mobile',
      'age_group',
    ]);
  });
});
