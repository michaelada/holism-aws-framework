import Stripe from 'stripe';
import { logger } from '../../config/logger';
import {
  PaymentProvider,
  PaymentIntentRequest,
  PaymentIntentResult,
  PaymentProviderError,
  WebhookEvent,
  WebhookVerificationError,
} from './payment-provider';

/**
 * Stripe, using **Connect destination charges**.
 *
 * The shape matters, so it is worth stating plainly. The charge is created on
 * the **platform's** account, with:
 *
 *   - `transfer_data.destination` — the club's connected account, which
 *     receives the item price;
 *   - `application_fee_amount` — the handling fee, which stays with the
 *     platform.
 *
 * This is why the platform's secret key comes from the environment and *not*
 * from the organisation's settings. A per-organisation secret key is the
 * direct-charge model: it would put the whole amount, handling fee included,
 * into the club's own balance, and the platform would have to invoice for its
 * fee afterwards.
 *
 * The per-organisation key fields left over from that earlier model have been
 * removed — from the settings tab, from the `PaymentSettings` contract, and
 * from stored data by migration 1709000000014. See
 * docs/ACCOUNT_USER_APP_PHASE8_CHECKOUT.md §1.
 *
 * One webhook endpoint serves every club, because every charge is on the
 * platform account. There is no per-organisation webhook secret in this model
 * either.
 */

/** Pinned so a Stripe-side API change cannot alter behaviour without a deploy. */
const STRIPE_API_VERSION = '2025-10-29.clover';

export interface StripePlatformConfig {
  secretKey: string;
  webhookSecret: string;
}

export function stripeConfigFromEnv(): StripePlatformConfig {
  return {
    secretKey: process.env.STRIPE_SECRET_KEY || '',
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
  };
}

export class StripeProvider implements PaymentProvider {
  readonly name = 'stripe';

  private readonly client: Stripe | null;

  constructor(
    private readonly config: StripePlatformConfig,
    /** Injected in tests; production builds its own from the secret key. */
    client?: Stripe
  ) {
    if (client) {
      this.client = client;
    } else if (config.secretKey) {
      this.client = new Stripe(config.secretKey, {
        apiVersion: STRIPE_API_VERSION as Stripe.LatestApiVersion,
      });
    } else {
      // Not an error at construction — the platform may simply not have Stripe
      // configured yet, and every other part of the application must still run.
      this.client = null;
    }
  }

  isConfigured(): boolean {
    return Boolean(this.client && this.config.webhookSecret);
  }

  async createPaymentIntent(request: PaymentIntentRequest): Promise<PaymentIntentResult> {
    if (!this.client) {
      throw new PaymentProviderError('Stripe is not configured', this.name);
    }
    if (!request.destinationAccountId) {
      // Without a destination the whole charge, including the club's money,
      // settles into the platform's balance.
      throw new PaymentProviderError(
        'This organisation is not connected to Stripe',
        this.name
      );
    }
    if (request.applicationFeeAmount > request.amount) {
      // Stripe would reject this, but failing here names the actual fault.
      throw new PaymentProviderError(
        'The handling fee cannot exceed the amount charged',
        this.name
      );
    }

    try {
      const intent = await this.client.paymentIntents.create(
        {
          amount: request.amount,
          currency: request.currency.toLowerCase(),
          description: request.description,
          metadata: request.metadata,
          // Zero is legitimate — an order of only fee-free items still needs a
          // charge, it simply earns the platform nothing.
          ...(request.applicationFeeAmount > 0
            ? { application_fee_amount: request.applicationFeeAmount }
            : {}),
          transfer_data: { destination: request.destinationAccountId },
          automatic_payment_methods: { enabled: true },
        },
        { idempotencyKey: request.idempotencyKey }
      );

      if (!intent.client_secret) {
        throw new PaymentProviderError(
          'Stripe returned no client secret',
          this.name
        );
      }

      return {
        providerTransactionId: intent.id,
        clientSecret: intent.client_secret,
        destinationAccountId: request.destinationAccountId,
      };
    } catch (error) {
      if (error instanceof PaymentProviderError) throw error;

      const stripeError = error as { type?: string; code?: string; message?: string };
      logger.error('Stripe payment intent creation failed:', {
        type: stripeError?.type,
        code: stripeError?.code,
      });

      /*
       * Connection, API and rate-limit failures are transient and worth
       * retrying; a card decline or a malformed request is not, and retrying
       * one of those just charges the member again.
       *
       * Connection failures are identified by class — they never reach Stripe,
       * so they carry no API error `type`. The rest are matched on the raw
       * snake_case values Stripe actually sends (`api_error`), not on the
       * error class names, which do not appear in this field.
       */
      const retryable =
        error instanceof Stripe.errors.StripeConnectionError ||
        stripeError?.type === 'api_error' ||
        stripeError?.type === 'rate_limit_error' ||
        stripeError?.type === 'rate_limit';

      throw new PaymentProviderError(
        stripeError?.message || 'Could not start the payment',
        this.name,
        retryable
      );
    }
  }

  /**
   * Verify and normalise a webhook.
   *
   * The **raw** body must be passed, not a parsed object: Stripe signs the
   * exact bytes it sent, so anything that re-serialises the JSON first — which
   * `express.json()` does — invalidates every signature.
   */
  parseWebhook(rawBody: Buffer | string, signature: string): WebhookEvent {
    if (!this.client || !this.config.webhookSecret) {
      throw new WebhookVerificationError('Stripe webhooks are not configured');
    }

    let event: Stripe.Event;
    try {
      event = this.client.webhooks.constructEvent(
        rawBody,
        signature,
        this.config.webhookSecret
      );
    } catch (error) {
      // An unverified webhook is an unauthenticated request that would mark
      // payments as paid, so this must fail closed and loudly.
      throw new WebhookVerificationError(
        error instanceof Error ? error.message : 'Invalid webhook signature'
      );
    }

    const intent = event.data?.object as Stripe.PaymentIntent | undefined;
    const paymentId = intent?.metadata?.paymentId ?? null;
    const providerTransactionId = intent?.id ?? null;

    switch (event.type) {
      case 'payment_intent.succeeded':
        return { id: event.id, type: event.type, outcome: 'succeeded', paymentId, providerTransactionId };

      case 'payment_intent.payment_failed':
        return {
          id: event.id,
          type: event.type,
          outcome: 'failed',
          paymentId,
          providerTransactionId,
          failureMessage: intent?.last_payment_error?.message,
        };

      case 'account.updated':
        /*
         * How Stripe reports that a club finished onboarding, or that its
         * requirements changed. Carried as `ignored` because it settles no
         * payment; the account itself rides along so the webhook layer can
         * refresh the club's cached Connect state without calling Stripe back.
         */
        return {
          id: event.id,
          type: event.type,
          outcome: 'ignored',
          paymentId: null,
          providerTransactionId: null,
          account: event.data?.object as Stripe.Account,
        };

      default:
        // Stripe sends far more than this application cares about. Ignoring
        // them explicitly — rather than erroring — is what stops Stripe
        // retrying an event forever because the endpoint 500s on it.
        return {
          id: event.id,
          type: event.type,
          outcome: 'ignored',
          paymentId,
          providerTransactionId,
        };
    }
  }
}
