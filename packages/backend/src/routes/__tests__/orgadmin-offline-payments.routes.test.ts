import express from 'express';
import type { Server } from 'http';
import request from 'supertest';

/**
 * The club's side of money paid outside the system (I1, I2).
 *
 * The organisation is never taken from the URL. It is chosen from among the
 * clubs the caller's token proves they administer — narrowed by the club the
 * app says is open, when it says so — which is what keeps an administrator of
 * one club from settling another's payments. See "choosing the organisation"
 * at the foot of this file.
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
import { auditService } from '../../services/audit/audit.service';
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

  /*
   * The settlement is only auditable if it says who. `offline_received_by` was
   * written from the first release and never read back, so the interface could
   * report when a payment was marked received but not by whom — which is the
   * half somebody needs when it turns out to have been marked in error.
   */
  it('reports who recorded a settlement, not only when', async () => {
    respond([
      paymentRow({
        offline_received_at: new Date('2026-08-04'),
        received_by_first_name: 'Peig',
        received_by_last_name: 'Ni Bhriain',
        received_by_email: 'peig@kildarehunt.test',
      }),
    ]);

    const response = await request(app)
      .get('/api/orgadmin/organisation/payments/offline?settled=true')
      .expect(200);

    expect(response.body[0].receivedBy).toBe('Peig Ni Bhriain');
  });

  it('falls back to the email when the recorder has no name on file', async () => {
    respond([
      paymentRow({
        offline_received_at: new Date('2026-08-04'),
        received_by_first_name: null,
        received_by_last_name: null,
        received_by_email: 'peig@kildarehunt.test',
      }),
    ]);

    const response = await request(app)
      .get('/api/orgadmin/organisation/payments/offline?settled=true')
      .expect(200);

    expect(response.body[0].receivedBy).toBe('peig@kildarehunt.test');
  });

  it('returns a settlement with no recorder rather than failing', async () => {
    /*
     * The administrator who recorded it may since have left the organisation.
     * The money still arrived, so the row must still render — with a date and
     * no name.
     */
    respond([paymentRow({ offline_received_at: new Date('2026-08-04') })]);

    const response = await request(app)
      .get('/api/orgadmin/organisation/payments/offline?settled=true')
      .expect(200);

    expect(response.body[0].receivedAt).toBeTruthy();
    expect(response.body[0].receivedBy).toBeNull();
  });
});

/**
 * Which club the request is about.
 *
 * An administrator may run more than one. This router used to answer that with
 * `SELECT … LIMIT 1` and no `ORDER BY` — an arbitrary row — while the org-admin
 * app was already sending the club the administrator had actually opened in
 * `X-Organisation-Id`. Signed in to one club, the API served another: the
 * offline payments list showed the wrong club's money, and payment settings,
 * branding and Stripe Connect read and wrote against a club that had not been
 * opened. Both were legitimately theirs, so nothing looked wrong.
 */
/**
 * The trail a settlement leaves.
 *
 * Recording a cheque as arrived is money changing hands and is exactly the kind
 * of thing an auditor comes looking for. Three separate faults made it
 * invisible or useless, all fixed here:
 *
 *  - the event was written with **no organisation**, because this router
 *    resolves the club itself rather than from the URL and never put it on the
 *    request — and the org-admin audit log filters on precisely that;
 *  - the receipt and its **undo shared one action**, so a reversal could not be
 *    told from the thing it reversed;
 *  - the body of both routes is empty, so the generic "record what was sent"
 *    wrote `{}` against a uuid.
 */
describe('the audit record a settlement leaves', () => {
  const recorded = jest.spyOn(auditService, 'record').mockResolvedValue(undefined as never);

  /** `audited` writes on the response's `finish`, which can trail the client. */
  const lastEvent = async (): Promise<any> => {
    for (let attempt = 0; attempt < 20 && !recorded.mock.calls.length; attempt += 1) {
      await new Promise((resolve) => setImmediate(resolve));
    }
    return recorded.mock.calls.at(-1)?.[0];
  };

  const paid = {
    payment: {
      id: 'pay-1',
      amount: 45,
      currency: 'EUR',
      paymentStatus: 'paid',
      paymentDate: '2026-09-01T10:00:00.000Z',
      userName: 'Fionn Doyle',
      userEmail: 'fionn@example.com',
    },
    fulfilment: { fulfilled: 1, failed: 0, complete: true },
  };

  beforeEach(() => recorded.mockClear());
  afterAll(() => recorded.mockRestore());

  it('records the receipt against the club whose money it is', async () => {
    respond();
    mockPayments.markOfflinePaymentReceived.mockResolvedValue(paid as any);

    await request(server).post('/api/orgadmin/organisation/payments/pay-1/received');

    const event = await lastEvent();
    expect(event).toMatchObject({
      action: 'offline-payment.recorded',
      organisationId: 'org-1',
      entityType: 'payment',
      entityId: 'pay-1',
      outcome: 'success',
    });
  });

  it('says how much, from whom, and what the money released', async () => {
    respond();
    mockPayments.markOfflinePaymentReceived.mockResolvedValue(paid as any);

    await request(server).post('/api/orgadmin/organisation/payments/pay-1/received');

    expect((await lastEvent()).changes).toEqual({
      created: expect.objectContaining({
        payer: 'Fionn Doyle',
        amount: 45,
        currency: 'EUR',
        paymentStatus: 'paid',
        itemsCreated: 1,
        itemsFailed: 0,
      }),
    });
  });

  it('names the payment by its payer and amount, not by its uuid', async () => {
    respond();
    mockPayments.markOfflinePaymentReceived.mockResolvedValue(paid as any);

    await request(server).post('/api/orgadmin/organisation/payments/pay-1/received');

    expect((await lastEvent()).entityLabel).toBe('Fionn Doyle — EUR 45.00');
  });

  it('falls back to the email when the payer has no name recorded', async () => {
    respond();
    mockPayments.markOfflinePaymentReceived.mockResolvedValue({
      ...paid,
      payment: { ...paid.payment, userName: null },
    } as any);

    await request(server).post('/api/orgadmin/organisation/payments/pay-1/received');

    expect((await lastEvent()).entityLabel).toBe('fionn@example.com — EUR 45.00');
  });

  it('records an undo as its own action', async () => {
    respond();
    mockPayments.undoOfflinePaymentReceived.mockResolvedValue({
      ...paid.payment,
      paymentStatus: 'awaiting_offline',
      paymentDate: null,
    } as any);

    await request(server).delete('/api/orgadmin/organisation/payments/pay-1/received');

    const event = await lastEvent();
    expect(event.action).toBe('offline-payment.receipt-undone');
    expect(event.organisationId).toBe('org-1');
    expect(event.changes).toEqual({
      created: expect.objectContaining({ payer: 'Fionn Doyle', paymentStatus: 'awaiting_offline' }),
    });
  });

  it('records a refused undo as a failure, with the reason', async () => {
    // The refusal is the interesting entry: somebody tried to reverse a receipt
    // that had already produced records.
    respond();
    mockPayments.undoOfflinePaymentReceived.mockRejectedValue(
      new ValidationError('This payment has already produced memberships, bookings or orders.')
    );

    await request(server).delete('/api/orgadmin/organisation/payments/pay-1/received');

    const event = await lastEvent();
    expect(event.outcome).toBe('failure');
    expect(event.context.error).toMatch(/already produced/i);
  });
});

describe('choosing the organisation', () => {
  const OTHER = '3752a3be-6cb1-4f71-9d3d-2e6bfd23797c';

  it('uses the organisation the request names', async () => {
    /*
     * Mocked here rather than through `respond`, which always answers the
     * membership lookup with `org-1`. The real query is scoped to the club that
     * was asked for, so it can only return that one — and the assertion below
     * is that the listing then uses it.
     */
    mockDb.query = jest
      .fn()
      .mockResolvedValueOnce({ rows: [{ organization_id: OTHER }], rowCount: 1 })
      .mockResolvedValue({ rows: [], rowCount: 0 });

    await request(app)
      .get('/api/orgadmin/organisation/payments/offline')
      .set('X-Organisation-Id', OTHER)
      .expect(200);

    // The membership check is made against the club that was asked for...
    const [lookupSql, lookupParams] = (mockDb.query as jest.Mock).mock.calls[0];
    expect(lookupSql).toContain('organization_id = $2');
    expect(lookupParams).toEqual(['kc-admin', OTHER]);

    // ...and the listing is then read for that same club, not another.
    const [, listParams] = (mockDb.query as jest.Mock).mock.calls[1];
    expect(listParams[0]).toBe(OTHER);
  });

  it('refuses a club the caller does not administer, rather than serving a different one', async () => {
    /*
     * The important half. Falling back to one of the caller's own clubs here
     * would reintroduce exactly the defect: a request about one club, answered
     * with another's money.
     */
    mockDb.query = jest.fn().mockResolvedValue({ rows: [], rowCount: 0 });

    const response = await request(app)
      .get('/api/orgadmin/organisation/payments/offline')
      .set('X-Organisation-Id', OTHER)
      .expect(403);

    expect(response.body.error).toMatch(/requested organisation/);
    // Refused before any data was read.
    expect(mockDb.query).toHaveBeenCalledTimes(1);
  });

  it('refuses a malformed id without putting it near the database', async () => {
    // `$2::uuid` on a non-uuid raises a database error, which would surface as
    // a 500 — an invalid request answered as though the server were at fault.
    mockDb.query = jest.fn();

    await request(app)
      .get('/api/orgadmin/organisation/payments/offline')
      .set('X-Organisation-Id', 'not-a-uuid')
      .expect(403);

    expect(mockDb.query).not.toHaveBeenCalled();
  });

  it('picks deterministically when the request names no club', async () => {
    // Direct callers still work. They simply must not get a different club on
    // each request, which is what the unordered LIMIT 1 allowed.
    respond([]);

    await request(app).get('/api/orgadmin/organisation/payments/offline').expect(200);

    const [lookupSql, lookupParams] = (mockDb.query as jest.Mock).mock.calls[0];
    expect(lookupSql).toContain('ORDER BY');
    expect(lookupParams).toEqual(['kc-admin']);
  });
});
