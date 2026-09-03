/**
 * The contract every payment provider implements.
 *
 * Two providers are in scope — Stripe and Helix Pay — and only Stripe has a
 * published API this repository has access to. The abstraction exists so that
 * absence is an explicit, single-file gap rather than a reshaping of the
 * checkout service later: `HelixPayProvider` implements this interface and
 * throws, and nothing about how a payment is created or confirmed is guessed.
 *
 * **Money is always in integer minor units** — cents, not euros. Every amount
 * crossing this boundary has already been through `utils/handling-fee.ts`,
 * which works in minor units precisely so that no float rounding reaches a
 * charge. A provider implementation must not convert.
 */

export interface PaymentIntentRequest {
  /** What the member is charged now, including the handling fee. Minor units. */
  amount: number;
  currency: string;
  /**
   * The platform's cut, taken from `amount`. Minor units.
   *
   * This is the handling fee, and it is the reason charges go through Connect
   * at all: the club receives the item price, the platform receives this.
   */
  applicationFeeAmount: number;
  /**
   * The club's connected account — where the remainder settles.
   *
   * Required. A charge with no destination would land wholly in the platform's
   * own balance, which is the club's money.
   */
  destinationAccountId: string;
  /** Echoed back on the webhook, so an event can be tied to a payment. */
  metadata: Record<string, string>;
  description?: string;
  /**
   * Makes retrying a failed create safe. The checkout service derives it from
   * the payment id, so a member who double-submits gets one charge rather than
   * two.
   */
  idempotencyKey: string;
}

export interface PaymentIntentResult {
  /** The provider's id for the attempt — stored as `provider_transaction_id`. */
  providerTransactionId: string;
  /**
   * What the client needs to complete the payment. For Stripe this is the
   * PaymentIntent client secret.
   */
  clientSecret: string;
  /** Where the funds are destined, recorded against the payment. */
  destinationAccountId: string;
}

/**
 * The outcome of a provider event, normalised.
 *
 * `authorised` is the money being *held on the card, not taken* — the state a
 * manual-capture payment reaches when the member confirms. It is the point at
 * which the platform decides whether to capture or to reverse, and it exists
 * precisely so that decision can be made after re-checking what was bought.
 */
export type PaymentOutcome = 'succeeded' | 'authorised' | 'failed' | 'ignored';

export interface WebhookEvent {
  /** The provider's own event id — the idempotency key for processing. */
  id: string;
  type: string;
  outcome: PaymentOutcome;
  /** The payment this event concerns, from the metadata sent at creation. */
  paymentId: string | null;
  providerTransactionId: string | null;
  /** Present on a failure, for the member-facing message. */
  failureMessage?: string;
  /**
   * The connected account, on events that concern one rather than a payment.
   *
   * Deliberately loosely typed: the contract is provider-agnostic, and only the
   * Stripe implementation has a notion of connected accounts at all.
   */
  account?: unknown;
}

export interface PaymentProvider {
  /** Matches `payments.payment_provider`. */
  readonly name: string;

  /**
   * A public key the browser needs to mount the provider's payment form, if it
   * has such a thing. Empty when the provider needs none, or is unconfigured.
   *
   * Served to the client by the API so a front end needs no payment provider
   * configuration of its own — the account app previously carried its own copy
   * in a `.env` that did not exist, which left the Pay button permanently
   * disabled with nothing on screen to say why.
   */
  readonly publishableKey?: string;

  /** Whether this organisation has finished configuring the provider. */
  isConfigured(): boolean;

  createPaymentIntent(request: PaymentIntentRequest): Promise<PaymentIntentResult>;

  /**
   * What the provider currently believes about a payment.
   *
   * The provider is the authority on whether money moved; this application only
   * ever hears about it. Normally it hears through a webhook, and this exists
   * for when it does not — so a payment can be reconciled by asking rather than
   * by waiting to be told.
   *
   *   `authorised`  taken but not captured, waiting to be settled
   *   `succeeded`   captured; the money is the club's
   *   `failed`      declined, cancelled or expired
   *   `pending`     still in flight — the member may be mid 3-D Secure
   *   `unknown`     the provider could not be asked
   */
  getPaymentState(
    providerTransactionId: string
  ): Promise<'authorised' | 'succeeded' | 'failed' | 'pending' | 'unknown'>;

  /**
   * Take the money the member authorised.
   *
   * The second half of a manual-capture payment. Between authorising and this
   * call the platform re-checks that what was bought is still there, so a
   * capture means "we can honour this order", not merely "the card worked".
   *
   * Must be idempotent: a webhook can arrive twice, and capturing an already
   * captured payment must not charge twice or throw.
   */
  capturePayment(providerTransactionId: string): Promise<void>;

  /**
   * Let the authorisation go without taking anything.
   *
   * Used when the slot went while the member was paying, and when a hold lapses
   * before they confirm at all. **This is not a refund**: no money moved, so
   * there is no refund fee and nothing lands on the member's statement beyond a
   * pending authorisation that drops off.
   *
   * Must be idempotent, and must not throw when the payment is already settled
   * — losing that race is expected, and is what the capture-time re-check and
   * fulfilment exist to catch.
   */
  cancelPayment(providerTransactionId: string, reason?: string): Promise<void>;

  /**
   * Verify a webhook's signature and normalise it.
   *
   * Verification belongs to the provider because only it knows the scheme, and
   * it must happen before the body is trusted — an unverified webhook is an
   * unauthenticated request that marks payments as paid.
   *
   * Throws if the signature does not verify.
   */
  parseWebhook(rawBody: Buffer | string, signature: string): WebhookEvent;
}

/** Thrown when a provider is asked to do something it cannot. */
export class PaymentProviderError extends Error {
  constructor(
    message: string,
    public readonly provider: string,
    /** True when retrying might succeed — a network blip rather than a refusal. */
    public readonly retryable = false
  ) {
    super(message);
    this.name = 'PaymentProviderError';
  }
}

/** Thrown when a webhook's signature does not verify. */
export class WebhookVerificationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WebhookVerificationError';
  }
}
