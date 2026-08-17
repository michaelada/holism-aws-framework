import {
  PaymentProvider,
  PaymentIntentRequest,
  PaymentIntentResult,
  PaymentProviderError,
  WebhookEvent,
} from './payment-provider';

/**
 * Helix Pay — **not implemented**.
 *
 * This is a deliberate stub, not an oversight. Helix Pay's API contract is not
 * available in this repository or its documentation, and a payment integration
 * is the last place to guess: an invented request shape does not fail loudly at
 * build time, it fails when a member is trying to pay.
 *
 * It exists as a class so the gap is one file rather than a shape the rest of
 * the checkout has to grow later. `isConfigured()` returns false, so
 * `PaymentProviderRegistry` never selects it and the checkout refuses the
 * organisation's configuration cleanly rather than throwing mid-charge.
 *
 * **To implement:** fill in `createPaymentIntent` and `parseWebhook` against
 * the real API, then make `isConfigured()` reflect the credentials actually
 * needed. Note that the Connect-style split the Stripe provider relies on —
 * charging on the platform's account and routing the club's share onward —
 * has to be expressed in whatever terms Helix offers, or the handling fee has
 * nowhere to go. That is a commercial question as much as a technical one.
 */
export class HelixPayProvider implements PaymentProvider {
  readonly name = 'helix';

  /** Always false: an unimplemented provider must never be selected. */
  isConfigured(): boolean {
    return false;
  }

  async createPaymentIntent(_request: PaymentIntentRequest): Promise<PaymentIntentResult> {
    throw new PaymentProviderError(
      'Helix Pay is not yet supported for online payment',
      this.name
    );
  }

  async capturePayment(_providerTransactionId: string): Promise<void> {
    throw new PaymentProviderError(
      'Helix Pay is not yet supported for online payment',
      this.name
    );
  }

  async cancelPayment(_providerTransactionId: string, _reason?: string): Promise<void> {
    throw new PaymentProviderError(
      'Helix Pay is not yet supported for online payment',
      this.name
    );
  }

  parseWebhook(_rawBody: Buffer | string, _signature: string): WebhookEvent {
    throw new PaymentProviderError(
      'Helix Pay is not yet supported for online payment',
      this.name
    );
  }
}
