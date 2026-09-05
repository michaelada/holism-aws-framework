import { Router, Request, Response } from 'express';
import express from 'express';
import { logger } from '../config/logger';
import { webhookService } from '../services/webhook.service';
import {
  paymentProviderRegistry,
  WebhookVerificationError,
} from '../services/payment-providers';

/**
 * Payment provider webhooks. **Unauthenticated by design** — the provider has
 * no session — so the signature *is* the authentication.
 *
 * Two things about this router are load-bearing:
 *
 * **1. The raw body.** `express.raw()` is applied here rather than the global
 * `express.json()`, because a signature covers the exact bytes the provider
 * sent. Parsing and re-serialising the JSON changes them, and every signature
 * then fails to verify. `src/index.ts` must mount this router **before** the
 * global JSON parser for that to hold.
 *
 * **2. What gets a 2xx.** A provider retries anything that is not a 2xx. So:
 *
 *   - bad signature → **400**, and it should never be retried;
 *   - genuine processing failure → **500**, so the provider retries and the
 *     payment is eventually confirmed;
 *   - already processed, or an event we ignore → **200**, or the provider
 *     retries forever an event that will never be actioned.
 *
 * Getting the last one wrong is the subtle failure: the endpoint appears
 * healthy while the provider quietly hammers it.
 *
 * **3. Answering in time.** Stripe abandons a delivery after about 20 seconds
 * and records it as a timeout. Processing a payment event is not a fast
 * operation — it confirms the payment, then fulfils every line of the order —
 * and it makes calls back to Stripe along the way. So the response is raced
 * against a deadline well inside Stripe's, and the work is allowed to finish in
 * the background if it loses.
 */
const router = Router();

/**
 * How long a webhook may take before we answer without it.
 *
 * Stripe waits about 20 seconds. Ten leaves room for the Stripe call inside the
 * handler to hit its own 8-second timeout and still be reported properly,
 * rather than both deadlines expiring at once and Stripe seeing nothing.
 *
 * Read on each request rather than captured at import, so it can be turned down
 * in a test and adjusted by an operator without a rebuild — a deployment whose
 * database is slow may want to answer sooner, not later.
 */
const DEFAULT_RESPONSE_DEADLINE_MS = 10_000;

function responseDeadlineMs(): number {
  const configured = Number(process.env.WEBHOOK_RESPONSE_DEADLINE_MS);
  return Number.isFinite(configured) && configured > 0
    ? configured
    : DEFAULT_RESPONSE_DEADLINE_MS;
}

const DEADLINE = Symbol('deadline');

/**
 * Resolve with the work, or with `DEADLINE` if it takes too long.
 *
 * The work is **not cancelled** — a promise cannot be — and that is deliberate.
 * It holds the claim on the event, so letting it run to completion is what
 * makes the provider's redelivery cheap: it arrives to find the work already
 * done and takes the idempotent already-claimed path. Abandoning it would be
 * worse than useless, because the claim would still be held by nothing.
 */
async function withDeadline<T>(work: Promise<T>, ms: number): Promise<T | typeof DEADLINE> {
  let timer: NodeJS.Timeout | undefined;
  const deadline = new Promise<typeof DEADLINE>((resolve) => {
    timer = setTimeout(() => resolve(DEADLINE), ms);
  });
  try {
    return await Promise.race([work, deadline]);
  } finally {
    // Or the timer keeps the event loop alive for ten seconds after every
    // webhook that answered promptly.
    if (timer) clearTimeout(timer);
  }
}

router.post(
  '/stripe',
  express.raw({ type: 'application/json' }),
  async (req: Request, res: Response) => {
    const signature = req.headers['stripe-signature'];

    if (typeof signature !== 'string') {
      return res.status(400).json({ error: 'Missing signature' });
    }

    const provider = paymentProviderRegistry.get('stripe');
    if (!provider) {
      // Not configured. 500 rather than 400: this is the platform's fault, and
      // the retry may well succeed once the deployment is fixed.
      logger.error('Stripe webhook received but the provider is not configured');
      return res.status(500).json({ error: 'Payment provider not configured' });
    }

    let event;
    try {
      event = provider.parseWebhook(req.body, signature);
    } catch (error) {
      if (error instanceof WebhookVerificationError) {
        // Unverified: an unauthenticated request that would otherwise mark
        // payments as paid. Refuse it, and do not invite a retry.
        logger.warn('Rejected a Stripe webhook with an invalid signature');
        return res.status(400).json({ error: 'Invalid signature' });
      }
      throw error;
    }

    const work = webhookService.process(provider.name, event);

    /*
     * Attached before anything can reject.
     *
     * Past the deadline nobody is awaiting this promise, and an unhandled
     * rejection takes the whole process down under Node's default — turning one
     * slow webhook into an outage. The service has already logged the cause and
     * released the claim by this point; this only stops the rejection escaping.
     */
    work.catch(() => undefined);

    let result;
    try {
      result = await withDeadline(work, responseDeadlineMs());
    } catch (error) {
      logger.error('Failed to process a Stripe webhook:', error);
      // 500 so the provider retries — the claim has already been released.
      return res.status(500).json({ error: 'Processing failed' });
    }

    if (result === DEADLINE) {
      /*
       * Still working. Answering with a 500 rather than holding the connection
       * is the point: Stripe hears from us in ten seconds instead of giving up
       * at twenty, and it retries — by which time the work has almost certainly
       * finished and the redelivery is the cheap already-claimed path.
       *
       * Should the work fail after this, it releases its own claim, so the
       * retry reprocesses the event in full. Either way the payment is not lost.
       */
      logger.warn('A Stripe webhook outran its deadline; answering while it finishes', {
        eventId: event.id,
        type: event.type,
        deadlineMs: responseDeadlineMs(),
      });
      return res.status(500).json({ error: 'Still processing' });
    }

    return res.status(200).json({ received: true, processed: result.processed });
  }
);

export default router;
