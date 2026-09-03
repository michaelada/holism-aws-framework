/**
 * What a payment bought.
 *
 * `GET /payments/:id` used to return the payment row alone — a total and a
 * `contextId` — so the org-admin screen could not say which two entries, which
 * membership and which shirt made up €185. The basket now travels with it.
 */

jest.mock('../../middleware/auth.middleware', () => ({
  authenticateToken: () => (req: any, _res: any, next: any) => {
    req.user = { userId: 'kc-1' };
    next();
  },
  requireRole: () => (_req: any, _res: any, next: any) => next(),
}));

jest.mock('../../middleware/organisation-scope.middleware', () => ({
  byParam: () => (_req: any, _res: any, next: any) => next(),
  byResource: () => (_req: any, _res: any, next: any) => next(),
}));

jest.mock('../../middleware/audit.middleware', () => ({
  audited: () => (_req: any, _res: any, next: any) => next(),
}));

jest.mock('../../services/payment.service', () => ({
  paymentService: {
    getPaymentById: jest.fn(),
    getPaymentLines: jest.fn(),
    getRefundsForPayment: jest.fn(),
    getSettlementHistory: jest.fn(),
    listRefunds: jest.fn(),
    requestRefund: jest.fn(),
  },
}));

jest.mock('../../config/logger', () => ({
  logger: { warn: jest.fn(), error: jest.fn(), info: jest.fn() },
}));

import express from 'express';
import request from 'supertest';
import paymentRouter from '../../routes/payment.routes';
import { paymentService } from '../../services/payment.service';

const app = express();
app.use(express.json());
app.use('/api/orgadmin', paymentRouter);
// Mounted twice in the application, as it is here: the front end addresses the
// scoped form, and the refunds list is guarded by `byParam('organisationId')`.
app.use('/api/orgadmin/organisations/:organisationId', paymentRouter);

const getPayment = paymentService.getPaymentById as jest.Mock;
const getLines = paymentService.getPaymentLines as jest.Mock;
const getRefunds = paymentService.getRefundsForPayment as jest.Mock;
const getSettlement = paymentService.getSettlementHistory as jest.Mock;
const listRefunds = paymentService.listRefunds as jest.Mock;
const requestRefund = paymentService.requestRefund as jest.Mock;

const payment = {
  id: 'pay-1',
  organisationId: 'org-1',
  amount: 185.23,
  paymentStatus: 'paid',
};

const line = {
  id: 'line-1',
  itemType: 'event_entry',
  description: 'Intermediate',
  fee: 2500,
  handlingFee: 62,
  paymentMethod: 'stripe',
  status: 'paid',
  fulfilled: true,
  fulfilmentRef: 'entry-1',
  subjectName: 'Aine McGrath',
  contextRef: { eventId: 'evt-9' },
};

beforeEach(() => {
  jest.clearAllMocks();
  // The detail answers three questions at once; a test about one of them
  // should not have to say so about the other two.
  getLines.mockResolvedValue([]);
  getRefunds.mockResolvedValue([]);
  getSettlement.mockResolvedValue([]);
});

describe('GET /api/orgadmin/payments/:id', () => {
  it('returns the payment with the basket behind it', async () => {
    getPayment.mockResolvedValue(payment);
    getLines.mockResolvedValue([line]);

    const res = await request(app).get('/api/orgadmin/payments/pay-1');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: 'pay-1', amount: 185.23 });
    expect(res.body.lines).toHaveLength(1);
    expect(res.body.lines[0]).toMatchObject({ itemType: 'event_entry', subjectName: 'Aine McGrath' });
  });

  it('reads the lines under the payment’s own organisation', async () => {
    /*
     * Not the caller's current organisation. `byResource` has already
     * established that the caller administers the payment's club, and passing
     * anything else would return an empty basket for a payment that has one.
     */
    getPayment.mockResolvedValue(payment);
    getLines.mockResolvedValue([]);

    await request(app).get('/api/orgadmin/payments/pay-1');

    expect(getLines).toHaveBeenCalledWith('pay-1', 'org-1');
  });

  it('returns an empty basket rather than omitting the field', async () => {
    // The screen maps over `lines`; an absent field would be a crash.
    getPayment.mockResolvedValue(payment);
    getLines.mockResolvedValue([]);

    const res = await request(app).get('/api/orgadmin/payments/pay-1');

    expect(res.body.lines).toEqual([]);
  });

  it('404s for a payment that does not exist, without asking for its lines', async () => {
    getPayment.mockResolvedValue(null);

    const res = await request(app).get('/api/orgadmin/payments/nope');

    expect(res.status).toBe(404);
    expect(getLines).not.toHaveBeenCalled();
  });

  it('500s when the basket cannot be read, rather than reporting no items', async () => {
    getPayment.mockResolvedValue(payment);
    getLines.mockRejectedValue(new Error('connection lost'));

    const res = await request(app).get('/api/orgadmin/payments/pay-1');

    expect(res.status).toBe(500);
    expect(res.body.lines).toBeUndefined();
  });
});

/**
 * What happened to the payment afterwards.
 *
 * A refunded payment used to render a "Refund Information" card of "N/A": the
 * fields it read are in the `refunds` table, which the endpoint never touched.
 * An offline settlement was worse — the payment row holds only the current
 * state, so a receipt that had been undone left no trace at all.
 */
describe('GET /api/orgadmin/payments/:id — what happened afterwards', () => {
  const refund = {
    id: 'refund-1',
    refundAmount: 25,
    refundReason: 'Withdrew before the closing date',
    refundStatus: 'pending',
    requestedAt: '2026-08-30T09:00:00.000Z',
    requestedByName: 'Aoife Byrne',
  };

  const settled = {
    occurredAt: '2026-09-01T11:53:55.000Z',
    kind: 'received',
    actorName: 'Deirdre Ó Ceallaigh',
    itemsCreated: 2,
    itemsFailed: 0,
  };

  it('carries the refunds recorded against it', async () => {
    getPayment.mockResolvedValue(payment);
    getRefunds.mockResolvedValue([refund]);

    const res = await request(app).get('/api/orgadmin/payments/pay-1');

    expect(res.body.refunds).toHaveLength(1);
    expect(res.body.refunds[0]).toMatchObject({
      refundAmount: 25,
      requestedByName: 'Aoife Byrne',
    });
  });

  it('carries the settlement history, so an undo is not invisible', async () => {
    getPayment.mockResolvedValue(payment);
    getSettlement.mockResolvedValue([settled, { ...settled, kind: 'undone' }]);

    const res = await request(app).get('/api/orgadmin/payments/pay-1');

    expect(res.body.settlement.map((entry: any) => entry.kind)).toEqual(['received', 'undone']);
  });

  it('reads both under the payment’s own organisation', async () => {
    getPayment.mockResolvedValue(payment);

    await request(app).get('/api/orgadmin/payments/pay-1');

    expect(getRefunds).toHaveBeenCalledWith('pay-1', 'org-1');
    expect(getSettlement).toHaveBeenCalledWith('pay-1', 'org-1');
  });

  it('asks for none of it once the payment is missing', async () => {
    getPayment.mockResolvedValue(null);

    await request(app).get('/api/orgadmin/payments/nope');

    expect(getRefunds).not.toHaveBeenCalled();
    expect(getSettlement).not.toHaveBeenCalled();
  });

  it('returns empty arrays rather than omitting the fields', async () => {
    // The screen maps over all three; an absent field would be a crash.
    getPayment.mockResolvedValue(payment);

    const res = await request(app).get('/api/orgadmin/payments/pay-1');

    expect(res.body).toMatchObject({ lines: [], refunds: [], settlement: [] });
  });
});

/**
 * Every refund the club has made, listed in its own right.
 */
describe('GET /api/orgadmin/organisations/:organisationId/refunds', () => {
  it('lists the club’s refunds', async () => {
    listRefunds.mockResolvedValue([
      { id: 'refund-1', refundAmount: 25, paymentAmount: 50, payerName: 'Fionn Doyle' },
    ]);

    const res = await request(app).get('/api/orgadmin/organisations/org-1/refunds');

    expect(res.status).toBe(200);
    expect(res.body[0]).toMatchObject({ refundAmount: 25, payerName: 'Fionn Doyle' });
  });

  it('500s rather than reporting that a club has refunded nothing', async () => {
    listRefunds.mockRejectedValue(new Error('connection lost'));

    const res = await request(app).get('/api/orgadmin/organisations/org-1/refunds');

    expect(res.status).toBe(500);
  });
});

/**
 * Asking for a refund.
 *
 * The endpoint required `requestedBy` in the body and the screen had never sent
 * one, so every refund from the interface was refused with a 400 — the button
 * looked like it worked and did nothing. Who is asking is the token's to say:
 * it is the accountability record for money going back, and a client-supplied
 * one is a client-supplied answer to "who authorised this".
 */
describe('POST /api/orgadmin/payments/:id/refund', () => {
  it('takes the requester from the token', async () => {
    requestRefund.mockResolvedValue({ id: 'refund-1', refundAmount: 25 });

    const res = await request(app)
      .post('/api/orgadmin/payments/pay-1/refund')
      .send({ refundAmount: 25, refundReason: 'Withdrew' });

    expect(res.status).toBe(201);
    expect(requestRefund).toHaveBeenCalledWith(
      expect.objectContaining({ paymentId: 'pay-1', refundAmount: 25, requestedBy: 'kc-1' })
    );
  });

  it('ignores a requester named in the body', async () => {
    requestRefund.mockResolvedValue({ id: 'refund-1' });

    await request(app)
      .post('/api/orgadmin/payments/pay-1/refund')
      .send({ refundAmount: 25, requestedBy: 'somebody-else' });

    expect(requestRefund).toHaveBeenCalledWith(
      expect.objectContaining({ requestedBy: 'kc-1' })
    );
  });

  it('still refuses a refund with no amount', async () => {
    const res = await request(app)
      .post('/api/orgadmin/payments/pay-1/refund')
      .send({ refundReason: 'Withdrew' });

    expect(res.status).toBe(400);
    expect(requestRefund).not.toHaveBeenCalled();
  });
});
