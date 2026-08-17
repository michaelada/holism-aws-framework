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
  /**
   * The platform's **publishable** key, handed to the browser to mount the card
   * form.
   *
   * Served by the API rather than configured separately in each front end. It
   * is public by definition — it ships to every browser — and keeping it beside
   * the secret key means the two cannot drift onto different Stripe accounts,
   * which is a failure that presents as a card form that silently refuses every
   * payment.
   *
   * Optional because a platform that has not configured one is a real state —
   * and the state that produced this field, since the account app's Pay button
   * was dead for exactly that reason. `publishableKey` on the provider
   * normalises it to an empty string.
   */
  publishableKey?: string;
}

export function stripeConfigFromEnv(): StripePlatformConfig {
  return {
    secretKey: process.env.STRIPE_SECRET_KEY || '',
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
    /*
     * `VITE_`-prefixed because that is where it already lives in
     * `packages/backend/.env`; `STRIPE_PUBLISHABLE_KEY` is accepted too, since
     * the prefix means nothing to a server.
     */
    publishableKey:
      process.env.STRIPE_PUBLISHABLE_KEY || process.env.VITE_STRIPE_PUBLISHABLE_KEY || '',
  };
}

export class StripeProvider implements PaymentProvider {
  readonly name = 'stripe';

  /** What the browser needs to mount the card form; empty when unconfigured. */
  get publishableKey(): string {
    return this.config.publishableKey ?? '';
  }

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
          /*
           * Authorise now, take the money later.
           *
           * Confirming puts the intent in `requires_capture` — the funds are
           * held on the card but nothing has moved. The platform then re-checks
           * that the slots and capped entries in the order are still there and
           * either captures or reverses.
           *
           * This is what makes a lost race cheap. With automatic capture the
           * money is taken the instant the member confirms, so a slot that went
           * in the meantime leaves the club owing a refund. Reversing an
           * authorisation costs nothing and leaves nothing on the statement
           * beyond a pending line that drops off.
           *
           * The price: `automatic_payment_methods` will now only offer methods
           * that support manual capture — cards and card-backed wallets. Bank
           * redirects such as iDEAL, Bancontact and SEPA are excluded by
           * Stripe, deliberately, because they cannot authorise without taking.
           */
          capture_method: 'manual',
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
   * Take the money that was authorised.
   *
   * Idempotent by inspection rather than by idempotency key: Stripe refuses a
   * capture on an intent that is already `succeeded`, and a redelivered webhook
   * must not turn that refusal into a failed order. So an intent that has
   * already been captured is treated as success, which is what it is.
   */
  async capturePayment(providerTransactionId: string): Promise<void> {
    if (!this.client) {
      throw new PaymentProviderError('Stripe is not configured', this.name);
    }

    try {
      await this.client.paymentIntents.capture(providerTransactionId);
    } catch (error) {
      const stripeError = error as { code?: string; message?: string };

      if (await this.alreadySettled(providerTransactionId, 'succeeded')) {
        logger.info('Stripe payment intent was already captured', {
          providerTransactionId,
        });
        return;
      }

      logger.error('Stripe capture failed:', {
        providerTransactionId,
        code: stripeError?.code,
      });

      /*
       * Retryable, always. An authorisation that is never captured expires
       * silently after a few days and the club is simply never paid, which is a
       * worse failure than a webhook Stripe retries.
       */
      throw new PaymentProviderError(
        stripeError?.message || 'Could not take the authorised payment',
        this.name,
        true
      );
    }
  }

  /**
   * Release an authorisation without taking anything.
   *
   * Deliberately quiet about losing the race. Cancelling an intent that has
   * already succeeded is not an error worth propagating: it means the capture
   * won, the member has been charged for something they can have, and the
   * caller's decision to cancel was simply stale.
   */
  async cancelPayment(providerTransactionId: string, reason?: string): Promise<void> {
    if (!this.client) {
      throw new PaymentProviderError('Stripe is not configured', this.name);
    }

    try {
      await this.client.paymentIntents.cancel(providerTransactionId, {
        // Stripe's own vocabulary; `abandoned` is the honest description of a
        // member who walked away, and it is what shows in the dashboard.
        cancellation_reason: reason === 'abandoned' ? 'abandoned' : 'requested_by_customer',
      });
    } catch (error) {
      const stripeError = error as { code?: string; message?: string };

      if (await this.alreadySettled(providerTransactionId, 'canceled', 'succeeded')) {
        logger.info('Stripe payment intent could not be cancelled; it is already settled', {
          providerTransactionId,
        });
        return;
      }

      logger.error('Stripe cancellation failed:', {
        providerTransactionId,
        code: stripeError?.code,
      });

      throw new PaymentProviderError(
        stripeError?.message || 'Could not release the payment',
        this.name,
        true
      );
    }
  }

  /**
   * Whether an intent has already reached one of these states.
   *
   * Asked only after an operation failed, to tell "this was already done" from
   * "this genuinely broke". A failure to *read* the intent is reported as not
   * settled, so the caller raises the original error rather than swallowing it.
   */
  private async alreadySettled(
    providerTransactionId: string,
    ...states: string[]
  ): Promise<boolean> {
    try {
      const intent = await this.client!.paymentIntents.retrieve(providerTransactionId);
      return states.includes(intent.status);
    } catch {
      return false;
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

      /*
       * The member confirmed and the card authorised: funds held, nothing
       * taken. This is the decision point manual capture exists to create — the
       * platform re-checks the order and then either captures or reverses.
       *
       * `payment_intent.succeeded` still arrives afterwards, once the capture
       * goes through, and that is what confirms the payment and fulfils it. So
       * this event settles nothing by itself.
       */
      case 'payment_intent.amount_capturable_updated':
        return { id: event.id, type: event.type, outcome: 'authorised', paymentId, providerTransactionId };

      /*
       * A reversed authorisation, whether the platform asked for it or Stripe
       * expired it. Carried as a failure because that is what it is from the
       * member's point of view — the order did not happen — and the failure
       * path is already what releases their holds.
       */
      case 'payment_intent.canceled':
        return {
          id: event.id,
          type: event.type,
          outcome: 'failed',
          paymentId,
          providerTransactionId,
          failureMessage: 'The payment was cancelled before it completed',
        };

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
