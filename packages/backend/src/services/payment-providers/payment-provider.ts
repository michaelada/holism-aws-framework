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

/** The outcome of a provider event, normalised. */
export type PaymentOutcome = 'succeeded' | 'failed' | 'ignored';

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

  /** Whether this organisation has finished configuring the provider. */
  isConfigured(): boolean;

  createPaymentIntent(request: PaymentIntentRequest): Promise<PaymentIntentResult>;

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
