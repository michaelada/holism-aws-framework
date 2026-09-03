/**
 * The endpoint the confirmation screen polls.
 *
 * It used to re-read a row that only a webhook could change. Where the webhook
 * does not arrive — Stripe cannot reach a laptop without `stripe listen`, and a
 * production delivery can be missed — the money is taken and nothing else
 * happens: "Confirming your payment" forever, the basket still full, and the
 * entry or membership never created. Polling now drives a reconcile.
 */

jest.mock('../../config/logger');

jest.mock('../../middleware/auth.middleware', () => ({
  authenticateToken: () => (req: any, res: any, next: any) => {
    if (!req.headers.authorization) return res.status(401).json({ error: 'no token' });
    req.user = { userId: 'kc-1', email: 'm@example.com' };
    return next();
  },
}));

jest.mock('../../middleware/account-auth.middleware', () => ({
  resolveAccountOrganisation: () => (req: any, _res: any, next: any) => {
    req.account = { organisationId: 'org-1', organisationUserId: 'ou-1', orgCode: 'khpc' };
    return next();
  },
  requireAccountCapability: () => (_req: any, _res: any, next: any) => next(),
}));

jest.mock('../../services/checkout.service', () => ({
  checkoutService: { getPaymentStatus: jest.fn() },
}));

jest.mock('../../services/webhook.service', () => ({
  webhookService: { reconcilePayment: jest.fn() },
}));

import express from 'express';
import request from 'supertest';
import accountRoutes from '../account.routes';
import { checkoutService } from '../../services/checkout.service';
import { webhookService } from '../../services/webhook.service';

const app = express();
app.use(express.json());
app.use('/api/account', accountRoutes);

const getStatus = checkoutService.getPaymentStatus as jest.Mock;
const reconcile = webhookService.reconcilePayment as jest.Mock;

const ask = () =>
  request(app).get('/api/account/khpc/payments/pay-1').set('Authorization', 'Bearer t');

beforeEach(() => {
  jest.clearAllMocks();
});

describe('GET /api/account/:orgCode/payments/:paymentId', () => {
  it('reports a settled payment without going near the provider', async () => {
    getStatus.mockResolvedValue({ id: 'pay-1', status: 'paid' });

    const res = await ask().expect(200);

    expect(res.body.status).toBe('paid');
    expect(reconcile).not.toHaveBeenCalled();
  });

  it.each(['pending', 'authorised'])('reconciles one still %s', async (status) => {
    getStatus.mockResolvedValueOnce({ id: 'pay-1', status });
    reconcile.mockResolvedValue('paid');
    getStatus.mockResolvedValueOnce({ id: 'pay-1', status: 'paid' });

    const res = await ask().expect(200);

    expect(reconcile).toHaveBeenCalledWith('pay-1');
    // The status *after* reconciling, or the screen would keep waiting for a
    // change that has already happened.
    expect(res.body.status).toBe('paid');
  });

  it('does not re-read when reconciling changed nothing', async () => {
    getStatus.mockResolvedValue({ id: 'pay-1', status: 'pending' });
    reconcile.mockResolvedValue('unchanged');

    const res = await ask().expect(200);

    expect(getStatus).toHaveBeenCalledTimes(1);
    expect(res.body.status).toBe('pending');
  });

  /*
   * A provider that cannot be reached must not turn a slow confirmation into an
   * error page. The status just read is still the honest answer.
   */
  it('answers with what it read when reconciling throws', async () => {
    getStatus.mockResolvedValue({ id: 'pay-1', status: 'pending' });
    reconcile.mockRejectedValue(new Error('Stripe is away'));

    const res = await ask().expect(200);

    expect(res.body.status).toBe('pending');
  });

  /*
   * Read first, so an unknown or somebody else's payment is refused before this
   * process goes anywhere near the provider on its behalf.
   */
  it('refuses an unknown payment before reconciling anything', async () => {
    const { NotFoundError } = jest.requireActual('../../middleware/errors');
    getStatus.mockRejectedValue(new NotFoundError('Payment not found'));

    await ask().expect(404);

    expect(reconcile).not.toHaveBeenCalled();
  });

  it('needs a token', async () => {
    await request(app).get('/api/account/khpc/payments/pay-1').expect(401);
  });
});
