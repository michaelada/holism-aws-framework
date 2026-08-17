import { WebhookService } from '../webhook.service';
import { db } from '../../database/pool';
import { WebhookEvent } from '../payment-providers';

jest.mock('../../database/pool');
jest.mock('../../config/logger');

const mockDb = db as jest.Mocked<typeof db>;

const event = (over: Partial<WebhookEvent> = {}): WebhookEvent => ({
  id: 'evt_1',
  type: 'payment_intent.succeeded',
  outcome: 'succeeded',
  paymentId: 'pay-1',
  providerTransactionId: 'pi_1',
  ...over,
});

/** Postgres unique violation, which is how a duplicate claim is detected. */
const uniqueViolation = () => Object.assign(new Error('duplicate'), { code: '23505' });

describe('WebhookService', () => {
  let service: WebhookService;
  let checkout: {
    confirmPayment: jest.Mock;
    failPayment: jest.Mock;
    settleAuthorisation: jest.Mock;
  };
  let fulfilment: { fulfilPayment: jest.Mock };

  beforeEach(() => {
    mockDb.query.mockReset();
    mockDb.query.mockResolvedValue({ rows: [], rowCount: 0 } as any);

    checkout = {
      confirmPayment: jest.fn().mockResolvedValue(true),
      failPayment: jest.fn().mockResolvedValue(undefined),
      settleAuthorisation: jest.fn().mockResolvedValue('captured'),
    };
    fulfilment = {
      fulfilPayment: jest.fn().mockResolvedValue({ fulfilled: 1, failed: 0, complete: true }),
    };
    service = new WebhookService(checkout as any, fulfilment as any);
  });

  it('confirms the payment for a successful charge', async () => {
    const result = await service.process('stripe', event());

    expect(result).toEqual({ processed: true, outcome: 'succeeded' });
    expect(checkout.confirmPayment).toHaveBeenCalledWith('pay-1', 'pi_1');
  });

  /**
   * The core property. A provider retries until it gets a 2xx and will resend
   * an event regardless — processing twice means two entries for one payment.
   */
  it('processes an event only once', async () => {
    mockDb.query.mockRejectedValueOnce(uniqueViolation());

    const result = await service.process('stripe', event());

    expect(result.processed).toBe(false);
    expect(checkout.confirmPayment).not.toHaveBeenCalled();
  });

  /**
   * The claim guards *event processing*; it is not a record that the order was
   * completed. A previous delivery can have confirmed the payment and then
   * failed to create what it paid for — if a redelivery stopped at the claim,
   * that order would stay unfulfilled with the member charged.
   *
   * Safe because fulfilment is idempotent per line: a redelivery can only
   * complete outstanding work, never duplicate it.
   */
  it('still finishes outstanding fulfilment on a redelivery', async () => {
    mockDb.query.mockRejectedValueOnce(uniqueViolation());

    await service.process('stripe', event());

    expect(fulfilment.fulfilPayment).toHaveBeenCalledWith('pay-1');
  });

  it('does not attempt fulfilment on a redelivered failure event', async () => {
    mockDb.query.mockRejectedValueOnce(uniqueViolation());

    await service.process('stripe', event({ outcome: 'failed' }));

    expect(fulfilment.fulfilPayment).not.toHaveBeenCalled();
  });

  it('fulfils the order once the payment is confirmed', async () => {
    await service.process('stripe', event());
    expect(fulfilment.fulfilPayment).toHaveBeenCalledWith('pay-1');
  });

  it('fulfils even when this delivery did not confirm the payment', async () => {
    // confirmPayment returns false for an already-paid payment, which may still
    // have lines outstanding.
    checkout.confirmPayment.mockResolvedValue(false);

    await service.process('stripe', event());

    expect(fulfilment.fulfilPayment).toHaveBeenCalledWith('pay-1');
  });

  it('reports success even when a line could not be fulfilled', async () => {
    // Retrying will not fix a membership with no application form, and a
    // provider hammering the endpoint over it helps nobody — the reason is
    // recorded on the line instead.
    fulfilment.fulfilPayment.mockResolvedValue({ fulfilled: 0, failed: 1, complete: false });

    const result = await service.process('stripe', event());

    expect(result.processed).toBe(true);
  });

  /**
   * Claiming before working — rather than checking then inserting — is what
   * makes that hold under concurrency. Two simultaneous deliveries would both
   * find nothing on a read-first check and both proceed.
   */
  it('claims the event before doing any work', async () => {
    await service.process('stripe', event());

    const firstStatement = String(mockDb.query.mock.calls[0][0]);
    expect(firstStatement).toContain('INSERT INTO processed_webhook_events');
  });

  it('records a failed charge without confirming it', async () => {
    await service.process(
      'stripe',
      event({ type: 'payment_intent.payment_failed', outcome: 'failed', failureMessage: 'Card declined' })
    );

    expect(checkout.failPayment).toHaveBeenCalledWith('pay-1', 'Card declined');
    expect(checkout.confirmPayment).not.toHaveBeenCalled();
  });

  it('claims and drops an event it does not act on', async () => {
    // Recording it is what stops the provider retrying an irrelevant event
    // forever.
    const result = await service.process('stripe', event({ outcome: 'ignored', type: 'charge.updated' }));

    expect(result).toEqual({ processed: true, outcome: 'ignored' });
    expect(checkout.confirmPayment).not.toHaveBeenCalled();
    expect(String(mockDb.query.mock.calls[0][0])).toContain('INSERT INTO processed_webhook_events');
  });

  it('does nothing with an event that names no payment', async () => {
    const result = await service.process('stripe', event({ paymentId: null }));

    expect(result.processed).toBe(true);
    expect(checkout.confirmPayment).not.toHaveBeenCalled();
  });

  /**
   * Without the release, a transient database failure would permanently mark
   * the event handled — the member is charged and never gets their order.
   */
  it('releases its claim when processing fails, so the retry can work', async () => {
    checkout.confirmPayment.mockRejectedValue(new Error('database went away'));

    await expect(service.process('stripe', event())).rejects.toThrow('database went away');

    const statements = mockDb.query.mock.calls.map((call) => String(call[0]));
    expect(statements.some((sql) => sql.includes('DELETE FROM processed_webhook_events'))).toBe(true);
  });

  it('re-raises the failure rather than reporting success', async () => {
    checkout.confirmPayment.mockRejectedValue(new Error('boom'));
    await expect(service.process('stripe', event())).rejects.toThrow('boom');
  });

  it('links the event to the payment it settled', async () => {
    await service.process('stripe', event());

    const statements = mockDb.query.mock.calls.map((call) => String(call[0]));
    expect(statements.some((sql) => sql.includes('UPDATE processed_webhook_events'))).toBe(true);
  });

  it('does not link when the payment was already settled', async () => {
    // confirmPayment returns false for an already-paid payment.
    checkout.confirmPayment.mockResolvedValue(false);

    await service.process('stripe', event());

    const statements = mockDb.query.mock.calls.map((call) => String(call[0]));
    expect(statements.some((sql) => sql.includes('UPDATE processed_webhook_events'))).toBe(false);
  });

  it('propagates a database error that is not a duplicate claim', async () => {
    mockDb.query.mockRejectedValueOnce(new Error('connection refused'));
    await expect(service.process('stripe', event())).rejects.toThrow('connection refused');
  });
});

/**
 * Authorisation events, under manual capture.
 *
 * The rule that matters: **an authorisation is not money.** Confirming or
 * fulfilling on this event would hand out an entry for funds that have only
 * been held, and which the platform may be about to release.
 */
describe('WebhookService — authorisations', () => {
  let service: WebhookService;
  let checkout: {
    confirmPayment: jest.Mock;
    failPayment: jest.Mock;
    settleAuthorisation: jest.Mock;
  };
  let fulfilment: { fulfilPayment: jest.Mock };

  const authorised = (over: Partial<WebhookEvent> = {}): WebhookEvent => ({
    id: 'evt_2',
    type: 'payment_intent.amount_capturable_updated',
    outcome: 'authorised',
    paymentId: 'pay-1',
    providerTransactionId: 'pi_1',
    ...over,
  });

  beforeEach(() => {
    mockDb.query.mockReset();
    mockDb.query.mockResolvedValue({ rows: [], rowCount: 0 } as any);

    checkout = {
      confirmPayment: jest.fn().mockResolvedValue(true),
      failPayment: jest.fn().mockResolvedValue(undefined),
      settleAuthorisation: jest.fn().mockResolvedValue('captured'),
    };
    fulfilment = {
      fulfilPayment: jest.fn().mockResolvedValue({ fulfilled: 1, failed: 0, complete: true }),
    };
    service = new WebhookService(checkout as any, fulfilment as any);
  });

  it('asks the checkout to decide, and reports what it decided', async () => {
    const result = await service.process('stripe', authorised());

    expect(checkout.settleAuthorisation).toHaveBeenCalledWith('pay-1', 'pi_1');
    expect(result).toMatchObject({ processed: true, outcome: 'authorised', settlement: 'captured' });
  });

  it('neither confirms nor fulfils on an authorisation', async () => {
    // Funds are held, not taken. The order is settled by the
    // `payment_intent.succeeded` that follows the capture.
    await service.process('stripe', authorised());

    expect(checkout.confirmPayment).not.toHaveBeenCalled();
    expect(fulfilment.fulfilPayment).not.toHaveBeenCalled();
  });

  it('reports a reversal without treating it as a completed order', async () => {
    checkout.settleAuthorisation.mockResolvedValue('released');

    const result = await service.process('stripe', authorised());

    expect(result).toMatchObject({ settlement: 'released' });
    expect(fulfilment.fulfilPayment).not.toHaveBeenCalled();
  });

  it('still settles when the event is redelivered', async () => {
    /*
     * The important one. If the first delivery claimed the event and then died
     * before capturing, returning early here would leave the funds authorised
     * and never taken — the authorisation expires after a few days and the club
     * is simply never paid.
     */
    mockDb.query.mockRejectedValueOnce(uniqueViolation());

    const result = await service.process('stripe', authorised());

    expect(result.processed).toBe(false);
    expect(checkout.settleAuthorisation).toHaveBeenCalledWith('pay-1', 'pi_1');
  });

  it('ignores an authorisation with no payment behind it', async () => {
    await service.process('stripe', authorised({ paymentId: null }));

    expect(checkout.settleAuthorisation).not.toHaveBeenCalled();
  });

  it('fails a reversed authorisation through the ordinary failure path', async () => {
    // Which is what hands the member's holds back.
    await service.process(
      'stripe',
      authorised({ type: 'payment_intent.canceled', outcome: 'failed' })
    );

    expect(checkout.failPayment).toHaveBeenCalled();
    expect(checkout.settleAuthorisation).not.toHaveBeenCalled();
  });
});
