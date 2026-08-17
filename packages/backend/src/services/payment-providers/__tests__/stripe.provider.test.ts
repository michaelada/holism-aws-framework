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
    capture: jest.fn().mockResolvedValue({ id: 'pi_1', status: 'succeeded' }),
    cancel: jest.fn().mockResolvedValue({ id: 'pi_1', status: 'canceled' }),
    retrieve: jest.fn().mockResolvedValue({ id: 'pi_1', status: 'requires_capture' }),
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

/**
 * Manual capture: authorise now, take the money once the order is checked.
 *
 * The behaviour that matters is what happens when an operation loses a race.
 * Both capture and cancel are driven by webhooks, which Stripe redelivers, so
 * "this was already done" must be told apart from "this broke" — otherwise a
 * redelivery turns a completed order into a failed one.
 */
describe('StripeProvider — manual capture', () => {
  const CONFIG = { secretKey: 'sk_test_x', webhookSecret: 'whsec_x' };

  let client: any;
  let provider: StripeProvider;

  beforeEach(() => {
    client = {
      paymentIntents: {
        create: jest.fn().mockResolvedValue({ id: 'pi_1', client_secret: 'pi_1_secret' }),
        capture: jest.fn().mockResolvedValue({ id: 'pi_1', status: 'succeeded' }),
        cancel: jest.fn().mockResolvedValue({ id: 'pi_1', status: 'canceled' }),
        retrieve: jest.fn().mockResolvedValue({ id: 'pi_1', status: 'requires_capture' }),
      },
      webhooks: { constructEvent: jest.fn() },
    };
    provider = new StripeProvider(CONFIG, client as any);
  });

  it('authorises rather than charging, so a lost race costs a reversal not a refund', async () => {
    await provider.createPaymentIntent({
      amount: 2623,
      currency: 'EUR',
      applicationFeeAmount: 123,
      destinationAccountId: 'acct_club',
      metadata: { paymentId: 'pay-1' },
      idempotencyKey: 'payment_pay-1',
    } as any);

    const [params] = client.paymentIntents.create.mock.calls[0];
    expect(params.capture_method).toBe('manual');
  });

  describe('capturePayment', () => {
    it('takes the authorised money', async () => {
      await provider.capturePayment('pi_1');

      expect(client.paymentIntents.capture).toHaveBeenCalledWith('pi_1');
    });

    it('treats an already-captured intent as success, not as a failure', async () => {
      // A redelivered webhook must not turn a completed order into a failed one.
      client.paymentIntents.capture.mockRejectedValue({ code: 'payment_intent_unexpected_state' });
      client.paymentIntents.retrieve.mockResolvedValue({ id: 'pi_1', status: 'succeeded' });

      await expect(provider.capturePayment('pi_1')).resolves.toBeUndefined();
    });

    it('raises a retryable error when the capture genuinely failed', async () => {
      // An authorisation never captured expires silently and the club is never
      // paid, so this must be retried rather than swallowed.
      client.paymentIntents.capture.mockRejectedValue({ message: 'network blip' });
      client.paymentIntents.retrieve.mockResolvedValue({ id: 'pi_1', status: 'requires_capture' });

      await expect(provider.capturePayment('pi_1')).rejects.toMatchObject({
        retryable: true,
      });
    });

    it('does not swallow a failure it cannot check', async () => {
      client.paymentIntents.capture.mockRejectedValue({ message: 'network blip' });
      client.paymentIntents.retrieve.mockRejectedValue(new Error('also down'));

      await expect(provider.capturePayment('pi_1')).rejects.toBeInstanceOf(PaymentProviderError);
    });
  });

  describe('cancelPayment', () => {
    it('releases the authorisation', async () => {
      await provider.cancelPayment('pi_1');

      expect(client.paymentIntents.cancel).toHaveBeenCalledWith('pi_1', {
        cancellation_reason: 'requested_by_customer',
      });
    });

    it('records an expired hold as abandoned, which is what it is', async () => {
      await provider.cancelPayment('pi_1', 'abandoned');

      expect(client.paymentIntents.cancel).toHaveBeenCalledWith('pi_1', {
        cancellation_reason: 'abandoned',
      });
    });

    it('is quiet about losing the race to a capture', async () => {
      // The capture won: the member has been charged for something they can
      // have, and the decision to cancel was simply stale.
      client.paymentIntents.cancel.mockRejectedValue({ code: 'payment_intent_unexpected_state' });
      client.paymentIntents.retrieve.mockResolvedValue({ id: 'pi_1', status: 'succeeded' });

      await expect(provider.cancelPayment('pi_1')).resolves.toBeUndefined();
    });

    it('is quiet about an intent already cancelled', async () => {
      client.paymentIntents.cancel.mockRejectedValue({ code: 'payment_intent_unexpected_state' });
      client.paymentIntents.retrieve.mockResolvedValue({ id: 'pi_1', status: 'canceled' });

      await expect(provider.cancelPayment('pi_1')).resolves.toBeUndefined();
    });

    it('raises when the cancellation genuinely failed', async () => {
      client.paymentIntents.cancel.mockRejectedValue({ message: 'network blip' });

      await expect(provider.cancelPayment('pi_1')).rejects.toBeInstanceOf(PaymentProviderError);
    });
  });

  describe('webhooks', () => {
    const parse = (type: string, object: Record<string, unknown> = {}) => {
      client.webhooks.constructEvent.mockReturnValue({
        id: 'evt_1',
        type,
        data: { object: { id: 'pi_1', metadata: { paymentId: 'pay-1' }, ...object } },
      });
      return provider.parseWebhook('{}', 'sig');
    };

    it('reports an authorisation as its own outcome, not as a payment', async () => {
      // Funds held, nothing taken. Confirming or fulfilling here would hand out
      // an entry for money that has not moved.
      expect(parse('payment_intent.amount_capturable_updated')).toMatchObject({
        outcome: 'authorised',
        paymentId: 'pay-1',
        providerTransactionId: 'pi_1',
      });
    });

    it('reports a reversed authorisation as a failure', () => {
      // From the member's side the order did not happen, and the failure path
      // is already what hands their holds back.
      expect(parse('payment_intent.canceled')).toMatchObject({
        outcome: 'failed',
        paymentId: 'pay-1',
      });
    });

    it('still reports a captured payment as succeeded', () => {
      expect(parse('payment_intent.succeeded')).toMatchObject({ outcome: 'succeeded' });
    });
  });
});
