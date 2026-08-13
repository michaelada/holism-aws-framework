import express from 'express';
import type { Server } from 'http';
import request from 'supertest';

/**
 * The club's side of money paid outside the system (I1, I2).
 *
 * The organisation is resolved from the caller's token, never from the URL —
 * the rule every newer org-admin route follows, and the one that keeps an
 * administrator of one club from settling another's payments.
 */

jest.mock('../../config/logger');

jest.mock('../../database/pool', () => ({
  db: { query: jest.fn() },
}));

jest.mock('../../services/payment.service', () => ({
  paymentService: {
    markOfflinePaymentReceived: jest.fn(),
    undoOfflinePaymentReceived: jest.fn(),
  },
}));

jest.mock('../../services/organization-payment-settings.service', () => ({
  organizationPaymentSettingsService: {},
}));
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

jest.mock('../../middleware/auth.middleware', () => ({
  authenticateToken: () => (req: any, _res: any, next: any) => {
    req.user = { userId: 'kc-admin', email: 'a@example.com', roles: [], groups: [] };
    return next();
  },
}));

import { db } from '../../database/pool';
import { paymentService } from '../../services/payment.service';
import { ValidationError, NotFoundError } from '../../middleware/errors';
import orgadminOrganisationRoutes from '../orgadmin-organisation.routes';

const mockDb = db as jest.Mocked<typeof db>;
const mockPayments = paymentService as jest.Mocked<typeof paymentService>;

const app = express();
app.use(express.json());
app.use('/api/orgadmin/organisation', orgadminOrganisationRoutes);

/** The org-admin lookup `withOrganisation` does, then whatever the route asks. */
const respond = (rows: any[] = []) => {
  mockDb.query = jest
    .fn()
    .mockResolvedValueOnce({ rows: [{ organization_id: 'org-1' }], rowCount: 1 })
    .mockResolvedValue({ rows, rowCount: rows.length });
};

const paymentRow = (over: Record<string, any> = {}) => ({
  id: 'pay-1',
  currency: 'EUR',
  payment_status: 'awaiting_offline',
  created_at: new Date('2026-08-01'),
  payment_date: null,
  offline_amount: 18000,
  card_amount: 0,
  handling_fee: 0,
  offline_received_at: null,
  first_name: 'Sam',
  last_name: 'Rivers',
  email: 'sam@example.com',
  lines: [{ description: 'Family Membership 2026', fee: 18000 }],
  ...over,
});

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

describe('GET /api/orgadmin/organisation/payments/offline', () => {

  it('lists what is outstanding, oldest first, with who owes it', async () => {
    respond([paymentRow()]);

    const response = await request(server).get('/api/orgadmin/organisation/payments/offline');

    expect(response.status).toBe(200);
    expect(response.body[0]).toMatchObject({
      id: 'pay-1',
      memberName: 'Sam Rivers',
      offlineAmount: 18000,
      status: 'awaiting_offline',
    });
    // Oldest first: the longest-outstanding cheque is the one to chase.
    expect(String(mockDb.query.mock.calls[1][0])).toContain('ORDER BY p.created_at ASC');
  });

  /** What was bought — the club is matching a cheque against an order. */
  it('carries the lines so a cheque can be matched to what it paid for', async () => {
    respond([paymentRow()]);

    const response = await request(server).get('/api/orgadmin/organisation/payments/offline');

    expect(response.body[0].lines).toEqual([
      { description: 'Family Membership 2026', fee: 18000 },
    ]);
  });

  it('falls back to the email when a member has no name recorded', async () => {
    respond([paymentRow({ first_name: null, last_name: null })]);

    const response = await request(server).get('/api/orgadmin/organisation/payments/offline');

    expect(response.body[0].memberName).toBe('sam@example.com');
  });

  /** So an administrator can find what they just recorded, and undo it. */
  it('can show the settled ones instead', async () => {
    respond([paymentRow({ payment_status: 'paid', offline_received_at: new Date() })]);

    await request(server).get('/api/orgadmin/organisation/payments/offline?settled=true');

    expect(mockDb.query.mock.calls[1][1]).toEqual(['org-1', true]);
  });

  it('scopes to the caller’s own organisation, taken from the token', async () => {
    respond([]);

    await request(server).get('/api/orgadmin/organisation/payments/offline');

    // Never from the URL: an id in the path would let one club settle another's.
    expect((mockDb.query.mock.calls[1][1] as unknown[])[0]).toBe('org-1');
  });
});

describe('POST /api/orgadmin/organisation/payments/:id/received', () => {
  it('records it and reports what fulfilment produced', async () => {
    respond();
    mockPayments.markOfflinePaymentReceived.mockResolvedValue({
      payment: { id: 'pay-1' } as any,
      fulfilment: { fulfilled: 2, failed: 0, complete: true },
    });

    const response = await request(server).post('/api/orgadmin/organisation/payments/pay-1/received');

    expect(response.status).toBe(200);
    expect(response.body.fulfilment).toEqual({ fulfilled: 2, failed: 0, complete: true });
    expect(mockPayments.markOfflinePaymentReceived).toHaveBeenCalledWith(
      'org-1',
      'pay-1',
      'kc-admin'
    );
  });

  it('passes a refusal through with its reason', async () => {
    respond();
    mockPayments.markOfflinePaymentReceived.mockRejectedValue(
      new ValidationError('That payment is not awaiting an offline settlement')
    );

    const response = await request(server).post('/api/orgadmin/organisation/payments/pay-1/received');

    expect(response.status).toBe(400);
    expect(response.body.error).toMatch(/not awaiting/i);
  });

  it('reports another club’s payment as not found', async () => {
    respond();
    mockPayments.markOfflinePaymentReceived.mockRejectedValue(new NotFoundError('Payment not found'));

    expect(
      (await request(server).post('/api/orgadmin/organisation/payments/pay-1/received')).status
    ).toBe(404);
  });
});

describe('DELETE /api/orgadmin/organisation/payments/:id/received', () => {
  it('puts it back to awaiting settlement', async () => {
    respond();
    mockPayments.undoOfflinePaymentReceived.mockResolvedValue({ id: 'pay-1' } as any);

    const response = await request(server).delete(
      '/api/orgadmin/organisation/payments/pay-1/received'
    );

    expect(response.status).toBe(200);
    expect(mockPayments.undoOfflinePaymentReceived).toHaveBeenCalledWith('org-1', 'pay-1');
  });

  /** The refusal an administrator most needs to read. */
  it('explains why an undo is refused once records exist', async () => {
    respond();
    mockPayments.undoOfflinePaymentReceived.mockRejectedValue(
      new ValidationError(
        'This payment has already produced memberships, bookings or orders. Refund it or cancel those individually instead of undoing the receipt.'
      )
    );

    const response = await request(server).delete(
      '/api/orgadmin/organisation/payments/pay-1/received'
    );

    expect(response.status).toBe(400);
    expect(response.body.error).toMatch(/Refund it or cancel those individually/);
  });
});
