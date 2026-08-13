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
 */
const router = Router();

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

    try {
      const result = await webhookService.process(provider.name, event);
      return res.status(200).json({ received: true, processed: result.processed });
    } catch (error) {
      logger.error('Failed to process a Stripe webhook:', error);
      // 500 so the provider retries — the claim has already been released.
      return res.status(500).json({ error: 'Processing failed' });
    }
  }
);

export default router;
