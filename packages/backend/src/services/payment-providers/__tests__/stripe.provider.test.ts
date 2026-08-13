import { StripeProvider } from '../stripe.provider';
import { HelixPayProvider } from '../helix-pay.provider';
import { PaymentProviderRegistry } from '../index';
import { PaymentProviderError, WebhookVerificationError } from '../payment-provider';

jest.mock('../../../config/logger');

const CONFIG = { secretKey: 'sk_test_x', webhookSecret: 'whsec_x' };

/** A stand-in for the Stripe client, so no network call is made. */
const stripeClient = () => ({
  paymentIntents: {
    create: jest.fn().mockResolvedValue({ id: 'pi_1', client_secret: 'pi_1_secret' }),
  },
  webhooks: { constructEvent: jest.fn() },
});

const request = (over: Record<string, unknown> = {}) => ({
  amount: 2623,
  currency: 'EUR',
  applicationFeeAmount: 123,
  destinationAccountId: 'acct_club',
  metadata: { paymentId: 'pay-1' },
  idempotencyKey: 'payment_pay-1',
  ...over,
});

describe('StripeProvider', () => {
  let client: ReturnType<typeof stripeClient>;
  let provider: StripeProvider;

  beforeEach(() => {
    client = stripeClient();
    provider = new StripeProvider(CONFIG, client as any);
  });

  describe('createPaymentIntent', () => {
    /**
     * The Connect shape. The charge is on the platform's account, the club's
     * share is transferred onward, and the handling fee is what the platform
     * keeps. Losing `transfer_data` puts the club's money in the platform's
     * balance; losing `application_fee_amount` gives the fee away.
     */
    it('charges on the platform account and transfers the club its share', async () => {
      await provider.createPaymentIntent(request() as any);

      const [params] = client.paymentIntents.create.mock.calls[0];
      expect(params).toMatchObject({
        amount: 2623,
        application_fee_amount: 123,
        transfer_data: { destination: 'acct_club' },
      });
    });

    it('sends the idempotency key as a request option, not as a parameter', async () => {
      await provider.createPaymentIntent(request() as any);

      const [, options] = client.paymentIntents.create.mock.calls[0];
      expect(options).toEqual({ idempotencyKey: 'payment_pay-1' });
    });

    it('lower-cases the currency, which Stripe requires', async () => {
      await provider.createPaymentIntent(request({ currency: 'EUR' }) as any);

      const [params] = client.paymentIntents.create.mock.calls[0];
      expect(params.currency).toBe('eur');
    });

    it('omits the application fee entirely when there is none', async () => {
      // An order of only fee-free items still needs a charge; Stripe rejects a
      // zero application fee rather than treating it as absent.
      await provider.createPaymentIntent(request({ applicationFeeAmount: 0 }) as any);

      const [params] = client.paymentIntents.create.mock.calls[0];
      expect(params).not.toHaveProperty('application_fee_amount');
    });

    it('refuses a charge with no destination', async () => {
      await expect(
        provider.createPaymentIntent(request({ destinationAccountId: '' }) as any)
      ).rejects.toThrow(/not connected to Stripe/i);
      expect(client.paymentIntents.create).not.toHaveBeenCalled();
    });

    it('refuses a fee larger than the amount', async () => {
      await expect(
        provider.createPaymentIntent(request({ applicationFeeAmount: 99999 }) as any)
      ).rejects.toThrow(/cannot exceed/i);
    });

    it('refuses when Stripe is not configured', async () => {
      const unconfigured = new StripeProvider({ secretKey: '', webhookSecret: '' });
      await expect(unconfigured.createPaymentIntent(request() as any)).rejects.toThrow(
        /not configured/i
      );
    });

    it('fails rather than returning an intent with no client secret', async () => {
      client.paymentIntents.create.mockResolvedValue({ id: 'pi_1', client_secret: null });

      await expect(provider.createPaymentIntent(request() as any)).rejects.toThrow(
        /client secret/i
      );
    });

    it('marks a transient API failure retryable', async () => {
      client.paymentIntents.create.mockRejectedValue({ type: 'api_error', message: 'blip' });

      await expect(provider.createPaymentIntent(request() as any)).rejects.toMatchObject({
        retryable: true,
      });
    });

    it('does not mark a card decline retryable', async () => {
      // Retrying a decline just charges the member again.
      client.paymentIntents.create.mockRejectedValue({
        type: 'card_error',
        message: 'Your card was declined',
      });

      await expect(provider.createPaymentIntent(request() as any)).rejects.toMatchObject({
        retryable: false,
      });
    });
  });

  describe('parseWebhook', () => {
    it('reports a succeeded payment with the payment id from metadata', () => {
      client.webhooks.constructEvent.mockReturnValue({
        id: 'evt_1',
        type: 'payment_intent.succeeded',
        data: { object: { id: 'pi_1', metadata: { paymentId: 'pay-1' } } },
      });

      expect(provider.parseWebhook('{}', 'sig')).toEqual({
        id: 'evt_1',
        type: 'payment_intent.succeeded',
        outcome: 'succeeded',
        paymentId: 'pay-1',
        providerTransactionId: 'pi_1',
      });
    });

    it('reports a failure with the reason the member should see', () => {
      client.webhooks.constructEvent.mockReturnValue({
        id: 'evt_2',
        type: 'payment_intent.payment_failed',
        data: {
          object: {
            id: 'pi_2',
            metadata: { paymentId: 'pay-2' },
            last_payment_error: { message: 'Your card was declined' },
          },
        },
      });

      expect(provider.parseWebhook('{}', 'sig')).toMatchObject({
        outcome: 'failed',
        failureMessage: 'Your card was declined',
      });
    });

    /**
     * Stripe sends far more than this application cares about. Erroring on them
     * would make Stripe retry an event that will never be actioned, forever.
     */
    it('ignores an event type it does not act on rather than erroring', () => {
      client.webhooks.constructEvent.mockReturnValue({
        id: 'evt_3',
        type: 'charge.updated',
        data: { object: { id: 'ch_1', metadata: {} } },
      });

      expect(provider.parseWebhook('{}', 'sig').outcome).toBe('ignored');
    });

    /** An unverified webhook is an unauthenticated request that marks payments paid. */
    it('rejects a webhook whose signature does not verify', () => {
      client.webhooks.constructEvent.mockImplementation(() => {
        throw new Error('No signatures found matching the expected signature');
      });

      expect(() => provider.parseWebhook('{}', 'bad')).toThrow(WebhookVerificationError);
    });

    it('rejects webhooks when no webhook secret is configured', () => {
      const noSecret = new StripeProvider({ secretKey: 'sk', webhookSecret: '' }, client as any);
      expect(() => noSecret.parseWebhook('{}', 'sig')).toThrow(WebhookVerificationError);
    });

    it('passes the raw body through untouched', () => {
      // Stripe signs the exact bytes; re-serialising invalidates every
      // signature, so the body must reach constructEvent unchanged.
      const raw = Buffer.from('{"id":"evt_1"}');
      client.webhooks.constructEvent.mockReturnValue({
        id: 'evt_1',
        type: 'charge.updated',
        data: { object: {} },
      });

      provider.parseWebhook(raw, 'sig');

      expect(client.webhooks.constructEvent).toHaveBeenCalledWith(raw, 'sig', 'whsec_x');
    });
  });

  describe('isConfigured', () => {
    it('needs both a secret key and a webhook secret', () => {
      expect(new StripeProvider(CONFIG, client as any).isConfigured()).toBe(true);
      expect(
        new StripeProvider({ secretKey: 'sk', webhookSecret: '' }, client as any).isConfigured()
      ).toBe(false);
      expect(new StripeProvider({ secretKey: '', webhookSecret: 'whsec' }).isConfigured()).toBe(
        false
      );
    });
  });
});

describe('HelixPayProvider', () => {
  const provider = new HelixPayProvider();

  /**
   * Deliberately unimplemented — Helix Pay's API contract is not available, and
   * a guessed payment integration fails when a member is trying to pay, not at
   * build time.
   */
  it('never reports itself configured', () => {
    expect(provider.isConfigured()).toBe(false);
  });

  it('refuses to create a payment', async () => {
    await expect(provider.createPaymentIntent({} as any)).rejects.toThrow(PaymentProviderError);
  });

  it('refuses to parse a webhook', () => {
    expect(() => provider.parseWebhook('{}', 'sig')).toThrow(PaymentProviderError);
  });
});

describe('PaymentProviderRegistry', () => {
  const stripe = new StripeProvider(CONFIG, stripeClient() as any);

  it('resolves a generic card payment to Stripe', () => {
    const registry = new PaymentProviderRegistry([stripe, new HelixPayProvider()]);
    expect(registry.forCardPayment()?.name).toBe('stripe');
    expect(registry.forCardPayment('card')?.name).toBe('stripe');
  });

  it('never selects an unconfigured provider', () => {
    // Helix would otherwise be chosen and then throw mid-charge.
    const registry = new PaymentProviderRegistry([stripe, new HelixPayProvider()]);
    expect(registry.get('helix')).toBeNull();
  });

  it('returns null for an unknown provider rather than throwing', () => {
    const registry = new PaymentProviderRegistry([stripe]);
    expect(registry.get('paypal')).toBeNull();
  });

  it('returns null when the platform has no Stripe configured at all', () => {
    const registry = new PaymentProviderRegistry([
      new StripeProvider({ secretKey: '', webhookSecret: '' }),
    ]);
    expect(registry.forCardPayment()).toBeNull();
  });
});
