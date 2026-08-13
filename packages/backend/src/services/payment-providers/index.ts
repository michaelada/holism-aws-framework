import { PaymentProvider } from './payment-provider';
import { StripeProvider, stripeConfigFromEnv } from './stripe.provider';
import { HelixPayProvider } from './helix-pay.provider';

export * from './payment-provider';
export { StripeProvider, stripeConfigFromEnv } from './stripe.provider';
export { HelixPayProvider } from './helix-pay.provider';

/**
 * Chooses the provider for a card payment.
 *
 * Providers are constructed once and reused: the Stripe client holds a
 * connection pool, and building one per checkout would be wasteful and would
 * lose keep-alive between charges.
 *
 * Selection is by name, matching the vocabulary already used by
 * `utils/payment-method.ts` — payment methods are classified by *name*
 * (`card`/`stripe`/`helix`) throughout this codebase, so the registry speaks
 * the same language rather than introducing a second one.
 */
export class PaymentProviderRegistry {
  private readonly providers = new Map<string, PaymentProvider>();

  constructor(providers?: PaymentProvider[]) {
    const list = providers ?? [new StripeProvider(stripeConfigFromEnv()), new HelixPayProvider()];
    for (const provider of list) {
      this.providers.set(provider.name, provider);
    }
  }

  /**
   * The provider for a name, or null when it is unknown or unconfigured.
   *
   * Null rather than a throw: an organisation that has not finished setting up
   * payments is a configuration state the checkout explains, not an exception.
   */
  get(name: string): PaymentProvider | null {
    const provider = this.providers.get(name.toLowerCase());
    if (!provider || !provider.isConfigured()) return null;
    return provider;
  }

  /**
   * The provider a card payment should use.
   *
   * `card` is the generic name a payment method carries when a club has not
   * named a specific processor, and Stripe is the only implemented one — so it
   * resolves there. When Helix Pay is implemented this becomes a choice driven
   * by the organisation's settings.
   */
  forCardPayment(preferred?: string): PaymentProvider | null {
    if (preferred && preferred.toLowerCase() !== 'card') {
      return this.get(preferred);
    }
    return this.get('stripe');
  }
}

export const paymentProviderRegistry = new PaymentProviderRegistry();
