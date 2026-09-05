/**
 * Answering Stripe in time.
 *
 * Stripe abandons a webhook delivery after about 20 seconds and records it as a
 * timeout. A run of 85 of them on a working test system was the symptom; the
 * cause was that this endpoint did all of its work — confirming the payment,
 * fulfilling every line, calling back to Stripe — before it said anything at
 * all, with no bound on how long that could take.
 *
 * Three behaviours are worth pinning down, because each is invisible until it
 * matters:
 *
 *  - The response is **raced against a deadline**, so Stripe always hears
 *    something well inside its own window.
 *  - The work is **not abandoned** when the deadline wins. It holds the claim on
 *    the event, so letting it finish is what makes Stripe's redelivery cheap.
 *  - A rejection **after** the response cannot escape. Nobody is awaiting the
 *    promise by then, and an unhandled rejection takes the process down.
 */

jest.mock('../../services/webhook.service', () => ({
  webhookService: { process: jest.fn() },
}));

jest.mock('../../services/payment-providers', () => {
  class WebhookVerificationError extends Error {}
  return {
    WebhookVerificationError,
    paymentProviderRegistry: { get: jest.fn() },
  };
});

jest.mock('../../config/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

import express from 'express';
import request from 'supertest';
import router from '../../routes/webhook.routes';
import { webhookService } from '../../services/webhook.service';
import {
  paymentProviderRegistry,
  WebhookVerificationError,
} from '../../services/payment-providers';

const app = express();
app.use('/api/webhooks', router);

const process_ = webhookService.process as jest.Mock;
const registryGet = paymentProviderRegistry.get as jest.Mock;

const EVENT = { id: 'evt_1', type: 'payment_intent.succeeded', outcome: 'succeeded', paymentId: 'pay-1' };

const provider = {
  name: 'stripe',
  parseWebhook: jest.fn(() => EVENT),
};

const post = () =>
  request(app)
    .post('/api/webhooks/stripe')
    .set('stripe-signature', 't=1,v1=abc')
    .set('Content-Type', 'application/json')
    .send(Buffer.from(JSON.stringify({ id: 'evt_1' })));

beforeEach(() => {
  jest.clearAllMocks();
  delete process.env.WEBHOOK_RESPONSE_DEADLINE_MS;
  registryGet.mockReturnValue(provider);
  provider.parseWebhook.mockReturnValue(EVENT);
});

afterEach(() => {
  delete process.env.WEBHOOK_RESPONSE_DEADLINE_MS;
});

/**
 * A deadline short enough to expire during the test.
 *
 * Real timers, not fake ones: supertest drives a real socket, and freezing the
 * clock underneath it stops the request ever reaching the handler.
 */
const withShortDeadline = () => {
  process.env.WEBHOOK_RESPONSE_DEADLINE_MS = '25';
};

describe('the ordinary path', () => {
  it('acknowledges with a 200 when the work finishes in time', async () => {
    process_.mockResolvedValue({ processed: true, outcome: 'succeeded' });

    const res = await post().expect(200);

    expect(res.body).toEqual({ received: true, processed: true });
  });

  it('answers 400 for a missing signature, and does no work', async () => {
    await request(app).post('/api/webhooks/stripe').send().expect(400);

    expect(process_).not.toHaveBeenCalled();
  });

  it('answers 400 for a bad signature so it is never retried', async () => {
    provider.parseWebhook.mockImplementation(() => {
      throw new WebhookVerificationError('bad');
    });

    await post().expect(400);
    expect(process_).not.toHaveBeenCalled();
  });

  it('answers 500 when processing genuinely fails, so Stripe retries', async () => {
    process_.mockRejectedValue(new Error('database down'));

    await post().expect(500);
  });
});

describe('when the work outruns the deadline', () => {
  /** Work that never settles on its own within the test. */
  const hangingWork = () => {
    let settle: (value: unknown) => void = () => undefined;
    let fail: (reason: unknown) => void = () => undefined;
    process_.mockReturnValue(
      new Promise((resolve, reject) => {
        settle = resolve;
        fail = reject;
      })
    );
    return { settle: (v: unknown) => settle(v), fail: (r: unknown) => fail(r) };
  };

  it('answers rather than letting Stripe time out', async () => {
    withShortDeadline();
    const work = hangingWork();

    const res = await post();
    expect(res.status).toBe(500);
    // A non-2xx, so Stripe retries — by which time the work has finished and
    // the redelivery takes the cheap already-claimed path.
    expect(res.body).toEqual({ error: 'Still processing' });

    work.settle({ processed: true, outcome: 'succeeded' });
  });

  it('does not abandon the work, because it holds the claim on the event', async () => {
    withShortDeadline();
    const work = hangingWork();

    await post();

    // Still the one call: the handler answered without cancelling anything, and
    // did not start a second attempt.
    expect(process_).toHaveBeenCalledTimes(1);
    work.settle({ processed: true, outcome: 'succeeded' });
  });

  it('swallows a rejection that arrives after the response', async () => {
    // Nobody is awaiting the promise by now. Under Node's default an unhandled
    // rejection ends the process, turning one slow webhook into an outage.
    withShortDeadline();
    const work = hangingWork();

    await post();

    const unhandled = jest.fn();
    process.on('unhandledRejection', unhandled);
    work.fail(new Error('failed long after we answered'));
    await new Promise((resolve) => setImmediate(resolve));
    process.off('unhandledRejection', unhandled);

    expect(unhandled).not.toHaveBeenCalled();
  });
});

describe('the deadline timer', () => {
  it('does not hold the response until the deadline when the work is quick', async () => {
    /*
     * The race must resolve on the work, not wait out the clock. Left running,
     * the timer also keeps the event loop alive for the whole deadline after
     * every webhook — which is how a process that should exit quietly does not.
     */
    process.env.WEBHOOK_RESPONSE_DEADLINE_MS = '30000';
    process_.mockResolvedValue({ processed: true, outcome: 'succeeded' });

    const started = Date.now();
    await post().expect(200);

    expect(Date.now() - started).toBeLessThan(2_000);
  });

  it('ignores a deadline that is not a usable number', async () => {
    // A blank or mistyped environment variable must fall back to the default,
    // not to zero — which would answer 500 to every webhook instantly.
    process.env.WEBHOOK_RESPONSE_DEADLINE_MS = 'soon';
    process_.mockResolvedValue({ processed: true, outcome: 'succeeded' });

    await post().expect(200);
  });
});
