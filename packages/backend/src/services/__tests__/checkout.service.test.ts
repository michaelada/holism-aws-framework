import { CheckoutService, cartFingerprint, contextIdFrom } from '../checkout.service';
import { BASKET_HOLD_MINUTES, CHECKOUT_HOLD_MINUTES } from '../../utils/holds';
import { db } from '../../database/pool';
import { cartService } from '../cart.service';
import { ValidationError, NotFoundError } from '../../middleware/errors';
import { createMockClient } from '../../test-helpers/mock-db-client';
import { fulfilmentService } from '../fulfilment.service';
import { orderAvailabilityService } from '../order-availability.service';

jest.mock('../../database/pool');
jest.mock('../../config/logger');
jest.mock('../cart.service', () => ({
  cartService: { getCart: jest.fn() },
}));
jest.mock('../fulfilment.service', () => ({
  fulfilmentService: { fulfilPayment: jest.fn() },
}));
jest.mock('../order-availability.service', () => ({
  orderAvailabilityService: { check: jest.fn() },
}));

const mockDb = db as jest.Mocked<typeof db>;
const mockCart = cartService as jest.Mocked<typeof cartService>;
const mockFulfilment = fulfilmentService as jest.Mocked<typeof fulfilmentService>;
const mockAvailability = orderAvailabilityService as jest.Mocked<typeof orderAvailabilityService>;

const ORG = 'org-1';
const MEMBER = 'ou-1';
const ACCOUNT = 'acct_club';

const cartItem = (over: Record<string, any> = {}) => ({
  id: 'item-1',
  itemType: 'event-entry',
  contextRef: { activityId: '11111111-1111-4111-8111-111111111111' },
  description: 'Junior Single Sculls',
  formSubmissionId: null,
  quantity: 1,
  unitFee: 2500,
  fee: 2500,
  discountAmount: 0,
  paymentMethodId: 'pm-card',
  paymentMethodName: 'card',
  paymentMethodDisplayName: 'Card',
  isCard: true,
  handlingFeeIncluded: true,
  ...over,
});

const cart = (over: Record<string, any> = {}) => ({
  id: 'cart-1',
  organisationId: ORG,
  currency: 'EUR',
  status: 'open',
  items: [cartItem()],
  warnings: [],
  summary: {},
  totals: {
    offlineSubtotal: 0,
    cardSubtotal: 2500,
    feeBearingBase: 2500,
    handlingFee: { base: 2500, net: 100, tax: 23, total: 123 },
    chargedToCardNow: 2623,
    orderTotal: 2623,
    perMethod: [],
    allocations: { 'item-1': 123 },
  },
  ...over,
});

/**
 * A provider registry whose card provider is this spy.
 *
 * `get` as well as `forCardPayment`: retiring a stale payment looks the
 * provider up by name to cancel its intent, and a registry without it fails
 * with "this.providers.get is not a function" rather than anything meaningful.
 */
const registryFor = (provider: any) =>
  ({ forCardPayment: () => provider, get: () => provider }) as any;

const stripeLike = () => ({
  name: 'stripe',
  isConfigured: () => true,
  createPaymentIntent: jest.fn().mockResolvedValue({
    providerTransactionId: 'pi_1',
    clientSecret: 'pi_1_secret',
    destinationAccountId: ACCOUNT,
  }),
  parseWebhook: jest.fn(),
});

describe('contextIdFrom', () => {
  it('finds the identifying uuid whatever the item type calls it', () => {
    expect(contextIdFrom({ membershipTypeId: '22222222-2222-4222-8222-222222222222' })).toBe(
      '22222222-2222-4222-8222-222222222222'
    );
  });

  it('ignores values that are not uuids', () => {
    // The column is a uuid; a slot label or a sku would fail the insert, and
    // losing a payment over an unrecognised context shape would be far worse
    // than storing null.
    expect(contextIdFrom({ id: 'court-1' })).toBeNull();
    expect(contextIdFrom({})).toBeNull();
    expect(contextIdFrom(null)).toBeNull();
  });
});

describe('CheckoutService', () => {
  let service: CheckoutService;
  let provider: ReturnType<typeof stripeLike>;
  let client: ReturnType<typeof createMockClient>;

  beforeEach(() => {
    mockDb.query.mockReset();
    mockCart.getCart.mockReset();
    mockFulfilment.fulfilPayment.mockReset();

    client = createMockClient();
    client.query.mockResolvedValue({ rows: [{ id: 'pay-1' }], rowCount: 1 });
    (mockDb.getClient as unknown as jest.Mock).mockResolvedValue(client);

    // No in-flight payment; the connected account is configured; no fee rows.
    mockDb.query.mockResolvedValue({ rows: [], rowCount: 0 } as any);

    provider = stripeLike();
    service = new CheckoutService(registryFor(provider));
    mockCart.getCart.mockResolvedValue(cart() as any);
  });

  /**
   * The connected-account lookup answers with a fully onboarded account by
   * default — an id alone is not enough to take a payment, so the fixture has
   * to carry `charges_enabled` as well.
   */
  const withConnectedAccount = (
    accountId: string | null = ACCOUNT,
    applicationFee: { fixed: number | null; percentage: number | null } | null = null,
    chargesEnabled = true
  ) => {
    mockDb.query.mockImplementation((sql: string) => {
      const text = String(sql);
      if (text.includes('stripeConnect')) {
        return Promise.resolve({
          rows: [{ account_id: accountId, charges_enabled: chargesEnabled }],
          rowCount: 1,
        } as any);
      }
      if (text.includes('application_fee_fixed') && text.includes('payment_methods pm')) {
        return Promise.resolve({
          rows: applicationFee
            ? [
                {
                  application_fee_fixed: applicationFee.fixed,
                  application_fee_percentage: applicationFee.percentage,
                },
              ]
            : [],
          rowCount: applicationFee ? 1 : 0,
        } as any);
      }
      return Promise.resolve({ rows: [], rowCount: 0 } as any);
    });
  };

  describe('startCheckout', () => {
    it('refuses an empty basket', async () => {
      mockCart.getCart.mockResolvedValue(cart({ items: [], totals: cart().totals }) as any);

      await expect(service.startCheckout(ORG, MEMBER, 'EUR')).rejects.toThrow(ValidationError);
    });

    it('refuses a basket whose holds have lapsed', async () => {
      // Charging for a place that is no longer reserved is worse than making
      // the member re-add it.
      mockCart.getCart.mockResolvedValue(
        cart({ warnings: [{ itemId: 'item-1', code: 'HOLD_EXPIRED', message: 'gone' }] }) as any
      );

      await expect(service.startCheckout(ORG, MEMBER, 'EUR')).rejects.toThrow(/no longer held/i);
    });

    /**
     * The answer to "what if they start paying and never finish".
     *
     * Two minutes is nowhere near enough for a card form plus a 3-D Secure
     * round trip. Without this the hold would lapse mid-payment, somebody else
     * could take the slot, and fulfilment would refuse a member who had already
     * paid — a refund and a very reasonable complaint.
     */
    it('extends the holds to cover the payment attempt', async () => {
      withConnectedAccount();
      await service.startCheckout(ORG, MEMBER, 'EUR');

      const extend = mockDb.query.mock.calls.find(
        ([sql]) => String(sql).includes('UPDATE cart_items') && String(sql).includes('expires_at')
      );

      expect(extend).toBeDefined();
      expect(extend![1]).toEqual(['cart-1', String(CHECKOUT_HOLD_MINUTES)]);
    });

    it('extends only the lines that were already holding something', async () => {
      // A membership or a jumper must not acquire an expiry it never had: an
      // expired line drops out of the basket total.
      withConnectedAccount();
      await service.startCheckout(ORG, MEMBER, 'EUR');

      const [sql] = mockDb.query.mock.calls.find(([text]) =>
        String(text).includes('UPDATE cart_items')
      )!;

      expect(String(sql)).toContain('expires_at IS NOT NULL');
    });

    it('does not revive a hold that had already lapsed', async () => {
      // Somebody else may have taken the slot in the meantime; the basket is
      // refused as a whole instead.
      withConnectedAccount();
      await service.startCheckout(ORG, MEMBER, 'EUR');

      const [sql] = mockDb.query.mock.calls.find(([text]) =>
        String(text).includes('UPDATE cart_items')
      )!;

      expect(String(sql)).toContain('expires_at > NOW()');
    });

    it('charges the amount the server calculated, not anything the client sent', async () => {
      withConnectedAccount();
      await service.startCheckout(ORG, MEMBER, 'EUR');

      expect(provider.createPaymentIntent).toHaveBeenCalledWith(
        expect.objectContaining({ amount: 2623, currency: 'EUR' })
      );
    });

    /** The whole reason charges go through Connect. */
    it('takes the handling fee as the application fee and routes the rest to the club', async () => {
      withConnectedAccount();
      await service.startCheckout(ORG, MEMBER, 'EUR');

      expect(provider.createPaymentIntent).toHaveBeenCalledWith(
        expect.objectContaining({
          applicationFeeAmount: 123,
          destinationAccountId: ACCOUNT,
        })
      );
    });

    /**
     * The default that must not drift. Before organisation types could
     * configure a split, the platform took exactly the handling fee — an
     * unconfigured type has to keep doing that, or the platform's revenue
     * quietly transfers to the clubs.
     */
    it('falls back to the handling fee when the type configures no application fee', async () => {
      withConnectedAccount(ACCOUNT, null);
      await service.startCheckout(ORG, MEMBER, 'EUR');

      expect(provider.createPaymentIntent).toHaveBeenCalledWith(
        expect.objectContaining({ applicationFeeAmount: 123 })
      );
    });

    it('uses the organisation type\'s configured application fee when set', async () => {
      // 25 fixed + 2% of the 2500 card subtotal = 75, not the 123 handling fee.
      withConnectedAccount(ACCOUNT, { fixed: 25, percentage: 2 });
      await service.startCheckout(ORG, MEMBER, 'EUR');

      expect(provider.createPaymentIntent).toHaveBeenCalledWith(
        expect.objectContaining({ applicationFeeAmount: 75 })
      );
    });

    /**
     * Resolution order, asserted on the query itself because the stub above
     * answers with an already-resolved row.
     *
     * The organisation's own value must win. A CASE on the presence of the
     * organisation's row rather than COALESCE on its values, because COALESCE
     * cannot tell "this club deliberately takes the handling fee" from "this
     * club has no row" — both are NULL and they mean opposite things.
     */
    it("resolves the application fee from the organisation before its type", async () => {
      withConnectedAccount(ACCOUNT, { fixed: 25, percentage: 2 });
      await service.startCheckout(ORG, MEMBER, 'EUR');

      const resolution = mockDb.query.mock.calls
        .map((call) => String(call[0]))
        .find(
          (sql) =>
            sql.includes('application_fee_fixed') &&
            sql.includes('payment_methods pm') &&
            sql.includes('LIMIT 1')
        );

      expect(resolution).toBeDefined();
      expect(resolution).toContain('organization_payment_application_fees');
      expect(resolution).toContain('CASE WHEN oaf.id IS NOT NULL');
      // The type is still reachable, as the fallback for a method added to a
      // type after the organisation was created.
      expect(resolution).toContain('organization_type_payment_fees');
    });

    it('does not change what the member is charged when the split changes', async () => {
      // The application fee decides the platform/club split; the member's total
      // is settled by the cart and must be untouched by it.
      withConnectedAccount(ACCOUNT, { fixed: 500, percentage: 5 });
      await service.startCheckout(ORG, MEMBER, 'EUR');

      expect(provider.createPaymentIntent).toHaveBeenCalledWith(
        expect.objectContaining({ amount: 2623 })
      );
    });

    it('records the application fee actually taken, not the handling fee', async () => {
      withConnectedAccount(ACCOUNT, { fixed: 25, percentage: 2 });
      await service.startCheckout(ORG, MEMBER, 'EUR');

      const update = mockDb.query.mock.calls.find((call) =>
        String(call[0]).includes('application_fee_amount = $5')
      );
      expect(update?.[1]).toContain(75);
    });

    it('keys the intent on the payment, so a double submit is one charge', async () => {
      withConnectedAccount();
      await service.startCheckout(ORG, MEMBER, 'EUR');

      expect(provider.createPaymentIntent).toHaveBeenCalledWith(
        expect.objectContaining({ idempotencyKey: 'payment_pay-1' })
      );
    });

    it('carries the payment id in metadata, which is all the webhook has', async () => {
      withConnectedAccount();
      await service.startCheckout(ORG, MEMBER, 'EUR');

      expect(provider.createPaymentIntent).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({ paymentId: 'pay-1' }),
        })
      );
    });

    it('reuses an in-flight payment rather than creating a second', async () => {
      mockDb.query.mockResolvedValue({
        rows: [
          {
            id: 'pay-existing',
            currency: 'EUR',
            card_amount: 2623,
            offline_amount: 0,
            handling_fee: 123,
            payment_provider: 'stripe',
            provider_transaction_id: 'pi_1',
            /*
             * The fingerprint of the basket this payment was priced for. It has
             * to match the cart the test hands back, or the payment is
             * correctly judged stale and replaced — which is the whole point of
             * the check, and not what this case is about.
             */
            metadata: {
              clientSecret: 'existing_secret',
              cartFingerprint: cartFingerprint(cart() as any),
            },
          },
        ],
        rowCount: 1,
      } as any);

      const result = await service.startCheckout(ORG, MEMBER, 'EUR');

      // A member who reloads the checkout page must not be charged twice.
      expect(result.paymentId).toBe('pay-existing');
      expect(provider.createPaymentIntent).not.toHaveBeenCalled();
    });

    it('refuses when the club has not connected a payment account', async () => {
      // Without a destination the club's own money settles into the platform's
      // balance.
      withConnectedAccount(null);

      await expect(service.startCheckout(ORG, MEMBER, 'EUR')).rejects.toThrow(
        /not finished connecting/i
      );
    });

    it('refuses when the club started onboarding but cannot yet take charges', async () => {
      /*
       * The state a club is in after clicking "Connect with Stripe" and then
       * stopping — at the bank-account screen, or at Stripe's terms. It has an
       * `acct_…` recorded, so a presence check passes, but Stripe reports
       * charges_enabled: false and would reject the destination charge with its
       * own wording about account capabilities. The member holding the card
       * would see a failed payment rather than a setup problem.
       */
      withConnectedAccount(ACCOUNT, null, false);

      await expect(service.startCheckout(ORG, MEMBER, 'EUR')).rejects.toThrow(
        /not finished connecting/i
      );
      expect(provider.createPaymentIntent).not.toHaveBeenCalled();
    });

    it('refuses when no card provider is configured', async () => {
      service = new CheckoutService(registryFor(null));
      withConnectedAccount();

      await expect(service.startCheckout(ORG, MEMBER, 'EUR')).rejects.toThrow(
        /cannot take card payments/i
      );
    });

    it('completes an entirely offline order without going near a provider', async () => {
      withConnectedAccount();
      mockCart.getCart.mockResolvedValue(
        cart({
          items: [cartItem({ isCard: false, paymentMethodName: 'cheque' })],
          totals: {
            ...cart().totals,
            cardSubtotal: 0,
            chargedToCardNow: 0,
            offlineSubtotal: 2500,
            handlingFee: { base: 0, net: 0, tax: 0, total: 0 },
          },
        }) as any
      );

      const result = await service.startCheckout(ORG, MEMBER, 'EUR');

      expect(result.completed).toBe(true);
      expect(result.clientSecret).toBeNull();
      expect(provider.createPaymentIntent).not.toHaveBeenCalled();
    });

    /**
     * An offline order is fulfilled at checkout rather than when the money
     * arrives, so the member has their entry — and their ticket — on the day
     * without waiting weeks for a cheque to be recorded. The entry is created
     * `pending`, so nothing claims the order has been paid for.
     */
    it('fulfils an entirely offline order at checkout', async () => {
      withConnectedAccount();
      mockCart.getCart.mockResolvedValue(
        cart({
          items: [cartItem({ isCard: false, paymentMethodName: 'cheque' })],
          totals: {
            ...cart().totals,
            cardSubtotal: 0,
            chargedToCardNow: 0,
            offlineSubtotal: 2500,
            handlingFee: { base: 0, net: 0, tax: 0, total: 0 },
          },
        }) as any
      );

      await service.startCheckout(ORG, MEMBER, 'EUR');

      expect(mockFulfilment.fulfilPayment).toHaveBeenCalledWith('pay-1');
    });

    /**
     * The order is placed and the payment row exists. A fulfilment problem is
     * for an administrator to resolve, not a reason to fail a checkout the
     * member has already completed.
     */
    it('still completes the offline order when fulfilment fails', async () => {
      withConnectedAccount();
      mockFulfilment.fulfilPayment.mockRejectedValueOnce(new Error('fulfilment is down'));
      mockCart.getCart.mockResolvedValue(
        cart({
          items: [cartItem({ isCard: false, paymentMethodName: 'cheque' })],
          totals: {
            ...cart().totals,
            cardSubtotal: 0,
            chargedToCardNow: 0,
            offlineSubtotal: 2500,
            handlingFee: { base: 0, net: 0, tax: 0, total: 0 },
          },
        }) as any
      );

      const result = await service.startCheckout(ORG, MEMBER, 'EUR');

      expect(result.completed).toBe(true);
    });

    /** A card order waits for Stripe; nothing is created at checkout. */
    it('does not fulfil a card order at checkout', async () => {
      withConnectedAccount();

      await service.startCheckout(ORG, MEMBER, 'EUR');

      expect(mockFulfilment.fulfilPayment).not.toHaveBeenCalled();
    });

    it('marks the payment failed but keeps the row when the provider refuses', async () => {
      withConnectedAccount();
      provider.createPaymentIntent.mockRejectedValue(new Error('card network down'));

      await expect(service.startCheckout(ORG, MEMBER, 'EUR')).rejects.toThrow();

      // Deleting it would lose the record that a member tried to pay.
      const statements = mockDb.query.mock.calls.map((call) => String(call[0]));
      expect(statements.some((sql) => sql.includes("payment_status = 'failed'"))).toBe(true);
    });

    it('writes one transaction line per item, carrying its share of the fee', async () => {
      withConnectedAccount();
      await service.startCheckout(ORG, MEMBER, 'EUR');

      const inserts = client.query.mock.calls.filter((call) =>
        String(call[0]).includes('INSERT INTO payment_transactions')
      );
      expect(inserts).toHaveLength(1);
      // The allocation for item-1 — the parts must sum to the fee charged.
      expect(inserts[0][1]).toContain(123);
    });

    it('snapshots the fee configuration onto the payment', async () => {
      withConnectedAccount();
      await service.startCheckout(ORG, MEMBER, 'EUR');

      // Without this, changing an organisation type's fees silently re-prices
      // completed orders when a report is opened.
      const insert = client.query.mock.calls.find((call) =>
        String(call[0]).includes('INSERT INTO payments')
      );
      expect(String(insert?.[0])).toContain('fee_config_snapshot');
    });

    it('rolls back the payment if writing its lines fails', async () => {
      withConnectedAccount();
      client.query.mockImplementation((sql: string) =>
        String(sql).includes('INSERT INTO payment_transactions')
          ? Promise.reject(new Error('constraint violated'))
          : Promise.resolve({ rows: [{ id: 'pay-1' }], rowCount: 1 })
      );

      await expect(service.startCheckout(ORG, MEMBER, 'EUR')).rejects.toThrow();
      expect(client.query).toHaveBeenCalledWith('ROLLBACK');
    });
  });

  describe('confirmPayment', () => {
    beforeEach(() => {
      client.query.mockResolvedValue({
        rows: [{ id: 'pay-1', payment_status: 'pending', cart_id: 'cart-1' }],
        rowCount: 1,
      });
    });

    it('marks the payment paid and closes the cart', async () => {
      const confirmed = await service.confirmPayment('pay-1', 'pi_1');

      expect(confirmed).toBe(true);
      const statements = client.query.mock.calls.map((call) => String(call[0]));
      expect(statements.some((sql) => sql.includes("payment_status = 'paid'"))).toBe(true);
      expect(statements.some((sql) => sql.includes("status = 'ordered'"))).toBe(true);
    });

    /** Second line of defence behind the webhook's idempotency claim. */
    it('does nothing for a payment that is already paid', async () => {
      client.query.mockResolvedValue({
        rows: [{ id: 'pay-1', payment_status: 'paid', cart_id: 'cart-1' }],
        rowCount: 1,
      });

      await expect(service.confirmPayment('pay-1', 'pi_1')).resolves.toBe(false);
    });

    it('locks the row before deciding, so concurrent events cannot both proceed', async () => {
      await service.confirmPayment('pay-1', 'pi_1');

      const select = client.query.mock.calls.find((call) =>
        String(call[0]).includes('FROM payments')
      );
      expect(String(select?.[0])).toContain('FOR UPDATE');
    });

    it('reports an unknown payment as not found', async () => {
      client.query.mockResolvedValue({ rows: [], rowCount: 0 });
      await expect(service.confirmPayment('nope', 'pi_1')).rejects.toThrow(NotFoundError);
    });
  });

  describe('getPaymentStatus', () => {
    it("refuses another member's payment", async () => {
      mockDb.query.mockResolvedValue({ rows: [], rowCount: 0 } as any);

      await expect(service.getPaymentStatus(ORG, MEMBER, 'someone-elses')).rejects.toThrow(
        NotFoundError
      );
    });

    it('scopes by organisation and member, not by payment id alone', async () => {
      mockDb.query.mockResolvedValue({
        rows: [{ id: 'pay-1', payment_status: 'paid', currency: 'EUR', metadata: {} }],
        rowCount: 1,
      } as any);

      await service.getPaymentStatus(ORG, MEMBER, 'pay-1');

      const [sql, params] = mockDb.query.mock.calls[0];
      expect(String(sql)).toContain('organisation_id = $2');
      expect(String(sql)).toContain('user_id = $3');
      expect(params).toEqual(['pay-1', ORG, MEMBER]);
    });
  });
});

/**
 * Handing the slots back when a payment will not now happen.
 *
 * The other half of the abandoned-Stripe question. `startCheckout` stretches
 * the holds to cover the attempt; without this they would keep a Saturday court
 * out of circulation for the rest of that window with nobody paying for it.
 */
describe('CheckoutService — releasing holds after a failed payment', () => {
  const provider = {
    name: 'stripe',
    isConfigured: () => true,
    createPaymentIntent: jest.fn(),
  };
  const service = new CheckoutService({ forCardPayment: () => provider } as any);

  beforeEach(() => {
    jest.clearAllMocks();
    mockDb.query.mockResolvedValue({ rows: [{ cart_id: 'cart-1' }], rowCount: 1 } as any);
  });

  it('drops the holds back to the browsing window', async () => {
    await service.failPayment('pay-1', 'Card declined');

    const extend = mockDb.query.mock.calls.find(([sql]) =>
      String(sql).includes('UPDATE cart_items')
    );

    expect(extend).toBeDefined();
    expect(extend![1]).toEqual(['cart-1', String(BASKET_HOLD_MINUTES)]);
  });

  it('still records the failure itself', async () => {
    await service.failPayment('pay-1', 'Card declined');

    const [sql, params] = mockDb.query.mock.calls[0];
    expect(String(sql)).toContain("payment_status = 'failed'");
    expect(params).toEqual(['pay-1', 'Card declined']);
  });

  it('leaves a paid payment alone rather than releasing its slots', async () => {
    // The guard is in the SQL: a payment already `paid` matches no row, so
    // nothing comes back and there is no cart to release.
    mockDb.query.mockResolvedValue({ rows: [], rowCount: 0 } as any);

    await service.failPayment('pay-1');

    expect(
      mockDb.query.mock.calls.some(([sql]) => String(sql).includes('UPDATE cart_items'))
    ).toBe(false);
  });

  it('copes with a payment that has no cart behind it', async () => {
    mockDb.query.mockResolvedValue({ rows: [{ cart_id: null }], rowCount: 1 } as any);

    await expect(service.failPayment('pay-1')).resolves.toBeUndefined();
  });
});

/**
 * The capture decision.
 *
 * Manual capture exists to create exactly this moment: the card is authorised,
 * the funds are held, and nothing has moved yet. What happens next depends on
 * whether the order is still available — and getting that wrong in either
 * direction is expensive. Capture something that has gone and the club owes a
 * refund; reverse something that is fine and the member is turned away for no
 * reason.
 */
describe('CheckoutService — settling an authorisation', () => {
  const provider = {
    name: 'stripe',
    isConfigured: () => true,
    createPaymentIntent: jest.fn(),
    capturePayment: jest.fn().mockResolvedValue(undefined),
    cancelPayment: jest.fn().mockResolvedValue(undefined),
  };

  const service = new CheckoutService({ forCardPayment: () => provider, get: () => provider } as any);

  const payment = (over: Record<string, any> = {}) => ({
    id: 'pay-1',
    cart_id: 'cart-1',
    payment_status: 'pending',
    payment_provider: 'stripe',
    provider_transaction_id: 'pi_1',
    ...over,
  });

  /** The payment lookup first, then whatever the branch needs. */
  const withPayment = (row: Record<string, any> | null) => {
    mockDb.query.mockImplementation((sql: string) => {
      if (String(sql).includes('FROM payments')) {
        return Promise.resolve({ rows: row ? [row] : [], rowCount: row ? 1 : 0 } as any);
      }
      return Promise.resolve({ rows: [{ cart_id: 'cart-1' }], rowCount: 1 } as any);
    });
  };

  beforeEach(() => {
    jest.clearAllMocks();
    provider.capturePayment.mockResolvedValue(undefined);
    provider.cancelPayment.mockResolvedValue(undefined);
  });

  it('captures when everything in the order is still there', async () => {
    withPayment(payment());
    mockAvailability.check.mockResolvedValue({ available: true, reason: null });

    await expect(service.settleAuthorisation('pay-1', 'pi_1')).resolves.toBe('captured');
    expect(provider.capturePayment).toHaveBeenCalledWith('pi_1');
    expect(provider.cancelPayment).not.toHaveBeenCalled();
  });

  it('reverses the authorisation when a slot went while they were paying', async () => {
    withPayment(payment());
    mockAvailability.check.mockResolvedValue({
      available: false,
      reason: 'Outdoor arena: that slot is fully booked',
    });

    await expect(service.settleAuthorisation('pay-1', 'pi_1')).resolves.toBe('released');
    expect(provider.cancelPayment).toHaveBeenCalledWith('pi_1', 'requested_by_customer');
    expect(provider.capturePayment).not.toHaveBeenCalled();
  });

  it('records why, so the member is told which line failed', async () => {
    withPayment(payment());
    mockAvailability.check.mockResolvedValue({
      available: false,
      reason: 'Outdoor arena: that slot is fully booked',
    });

    await service.settleAuthorisation('pay-1', 'pi_1');

    const failure = mockDb.query.mock.calls.find(([sql]) =>
      String(sql).includes("payment_status = 'failed'")
    );
    expect(failure![1]).toEqual(['pay-1', 'Outdoor arena: that slot is fully booked']);
  });

  it('never charges twice when the webhook is redelivered', async () => {
    // A payment already captured is past deciding; deciding again could only
    // charge a second time or reverse money already taken.
    withPayment(payment({ payment_status: 'paid' }));

    await expect(service.settleAuthorisation('pay-1', 'pi_1')).resolves.toBe('ignored');
    expect(provider.capturePayment).not.toHaveBeenCalled();
    expect(mockAvailability.check).not.toHaveBeenCalled();
  });

  it('leaves an already-reversed payment alone', async () => {
    withPayment(payment({ payment_status: 'failed' }));

    await expect(service.settleAuthorisation('pay-1', 'pi_1')).resolves.toBe('ignored');
    expect(provider.cancelPayment).not.toHaveBeenCalled();
  });

  it('will still decide for a payment left mid-settlement', async () => {
    // A first delivery that recorded `authorised` and then died must not leave
    // the funds held and never captured — the authorisation would expire and
    // the club would simply never be paid.
    withPayment(payment({ payment_status: 'authorised' }));
    mockAvailability.check.mockResolvedValue({ available: true, reason: null });

    await expect(service.settleAuthorisation('pay-1', 'pi_1')).resolves.toBe('captured');
  });

  it('marks the payment authorised before deciding, so a stuck one is visible', async () => {
    withPayment(payment());
    mockAvailability.check.mockResolvedValue({ available: true, reason: null });

    await service.settleAuthorisation('pay-1', 'pi_1');

    expect(
      mockDb.query.mock.calls.some(([sql]) => String(sql).includes("payment_status = 'authorised'"))
    ).toBe(true);
  });

  it('reports an unknown payment rather than guessing', async () => {
    withPayment(null);

    await expect(service.settleAuthorisation('pay-1', 'pi_1')).rejects.toThrow(NotFoundError);
  });

  it('falls back to the recorded intent when the event carries none', async () => {
    withPayment(payment());
    mockAvailability.check.mockResolvedValue({ available: true, reason: null });

    await service.settleAuthorisation('pay-1', null);

    expect(provider.capturePayment).toHaveBeenCalledWith('pi_1');
  });
});

/**
 * Giving up on a payment the member never completed.
 *
 * What makes an expired hold mean something on the payment screen: without the
 * cancellation the client secret in a stale tab stays valid, and a laptop woken
 * an hour later could still pay for a slot that has since gone.
 */
describe('CheckoutService — abandoning a checkout', () => {
  const provider = {
    name: 'stripe',
    isConfigured: () => true,
    createPaymentIntent: jest.fn(),
    capturePayment: jest.fn(),
    cancelPayment: jest.fn().mockResolvedValue(undefined),
  };

  const service = new CheckoutService({ forCardPayment: () => provider, get: () => provider } as any);

  const withPayment = (row: Record<string, any> | null) => {
    mockDb.query.mockImplementation((sql: string) => {
      if (String(sql).includes('FROM payments')) {
        return Promise.resolve({ rows: row ? [row] : [], rowCount: row ? 1 : 0 } as any);
      }
      return Promise.resolve({ rows: [{ cart_id: 'cart-1' }], rowCount: 1 } as any);
    });
  };

  const pending = {
    id: 'pay-1',
    cart_id: 'cart-1',
    payment_status: 'pending',
    payment_provider: 'stripe',
    provider_transaction_id: 'pi_1',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    provider.cancelPayment.mockResolvedValue(undefined);
  });

  it('cancels the intent, so a stale tab can no longer pay', async () => {
    withPayment(pending);

    await expect(service.abandonCheckout(ORG, MEMBER, 'pay-1')).resolves.toEqual({
      abandoned: true,
    });
    expect(provider.cancelPayment).toHaveBeenCalledWith('pi_1', 'abandoned');
  });

  it('scopes to the member, not to the payment id alone', async () => {
    withPayment(pending);

    await service.abandonCheckout(ORG, MEMBER, 'pay-1');

    const [, params] = mockDb.query.mock.calls[0];
    expect(params).toEqual(['pay-1', ORG, MEMBER]);
  });

  it("reports somebody else's payment as not found", async () => {
    withPayment(null);

    await expect(service.abandonCheckout(ORG, MEMBER, 'pay-1')).rejects.toThrow(NotFoundError);
  });

  it('refuses to cancel underneath a settlement already in progress', async () => {
    // `authorised` is mid-decision on the server. Cancelling here would race
    // the capture and could reverse an order that is about to succeed.
    withPayment({ ...pending, payment_status: 'authorised' });

    await expect(service.abandonCheckout(ORG, MEMBER, 'pay-1')).resolves.toEqual({
      abandoned: false,
    });
    expect(provider.cancelPayment).not.toHaveBeenCalled();
  });

  it('leaves a paid payment alone', async () => {
    withPayment({ ...pending, payment_status: 'paid' });

    await expect(service.abandonCheckout(ORG, MEMBER, 'pay-1')).resolves.toEqual({
      abandoned: false,
    });
  });

  it('still tells the member, even when Stripe cannot be reached', async () => {
    // They are being told their hold expired. Failing that message because a
    // best-effort tidy-up failed would leave them at a form that no longer works.
    withPayment(pending);
    provider.cancelPayment.mockRejectedValue(new Error('stripe is down'));

    await expect(service.abandonCheckout(ORG, MEMBER, 'pay-1')).resolves.toEqual({
      abandoned: true,
    });
  });
});

/**
 * A pending payment must not outlive the basket it was priced for.
 *
 * `startCheckout` reuses an in-flight payment so that reloading the page does
 * not create a second charge. That idempotency was unconditional, and a basket
 * is not frozen when checkout starts — so a member who went back and changed
 * theirs got the *old* payment: the old total, the old Stripe intent, and a
 * summary listing items they had since removed.
 *
 * Reported as "the payments section seems confused: one item in my basket, and
 * a pending payment showing the same item twice". The display was the visible
 * half; being charged last time's total was the other.
 */
describe('CheckoutService — a basket that changed under a pending payment', () => {
  const provider = {
    name: 'stripe',
    isConfigured: () => true,
    createPaymentIntent: jest.fn().mockResolvedValue({
      providerTransactionId: 'pi_new',
      clientSecret: 'pi_new_secret',
      destinationAccountId: ACCOUNT,
    }),
    capturePayment: jest.fn(),
    cancelPayment: jest.fn().mockResolvedValue(undefined),
  };

  let service: CheckoutService;

  /**
   * Answers the checkout sequence, with a pending payment already on the cart
   * whose fingerprint is `storedFingerprint`.
   */
  const withPendingPayment = (storedFingerprint: string | undefined) => {
    mockDb.query.mockImplementation((sql: string) => {
      const text = String(sql);

      if (text.includes('FROM payments') && text.includes("payment_status = 'pending'")) {
        return Promise.resolve({
          rows: [
            {
              id: 'pay-old',
              currency: 'EUR',
              card_amount: 4288,
              offline_amount: 0,
              handling_fee: 88,
              payment_provider: 'stripe',
              provider_transaction_id: 'pi_old',
              /*
               * A client secret as well as a fingerprint: this payment reached
               * the provider, which is what makes it resumable at all. Without
               * one it is an orphan and is replaced — covered by its own case
               * below.
               */
              metadata:
                storedFingerprint === undefined
                  ? { clientSecret: 'pi_old_secret' }
                  : { cartFingerprint: storedFingerprint, clientSecret: 'pi_old_secret' },
            },
          ],
          rowCount: 1,
        } as any);
      }
      if (text.includes('stripeConnect')) {
        return Promise.resolve({
          rows: [{ account_id: ACCOUNT, charges_enabled: true }],
          rowCount: 1,
        } as any);
      }
      if (text.includes('MIN(expires_at)')) {
        return Promise.resolve({ rows: [{ expires_at: null }], rowCount: 1 } as any);
      }
      return Promise.resolve({ rows: [], rowCount: 0 } as any);
    });
  };

  beforeEach(() => {
    jest.clearAllMocks();
    provider.cancelPayment.mockResolvedValue(undefined);
    service = new CheckoutService({ forCardPayment: () => provider, get: () => provider } as any);
    mockCart.getCart.mockResolvedValue(cart() as any);
  });

  it('reuses the payment when the basket is untouched', async () => {
    // The idempotency that stops a reload creating a second charge. It must
    // survive the fix, or every page refresh churns a new payment and intent.
    const fingerprint = cartFingerprint(cart() as any);
    withPendingPayment(fingerprint);

    const result = await service.startCheckout(ORG, MEMBER, 'EUR');

    expect(result.paymentId).toBe('pay-old');
    expect(provider.cancelPayment).not.toHaveBeenCalled();
  });

  it('will not reuse a payment priced for a different basket', async () => {
    withPendingPayment('a-fingerprint-from-an-older-basket');

    const result = await service.startCheckout(ORG, MEMBER, 'EUR');

    expect(result.paymentId).not.toBe('pay-old');
  });

  it('retires the stale payment rather than leaving it pending', async () => {
    // Left `pending` it keeps appearing in the member's payment history as an
    // order they never placed.
    withPendingPayment('stale');

    await service.startCheckout(ORG, MEMBER, 'EUR');

    const retire = mockDb.query.mock.calls.find(([sql]) =>
      String(sql).includes("payment_status = 'abandoned'")
    );
    expect(retire).toBeDefined();
    expect(retire![1]).toEqual(['pay-old']);
  });

  it('cancels the intent behind it, so nothing can pay the old amount', async () => {
    withPendingPayment('stale');

    await service.startCheckout(ORG, MEMBER, 'EUR');

    expect(provider.cancelPayment).toHaveBeenCalledWith('pi_old', 'abandoned');
  });

  it('treats a payment with no fingerprint as stale', async () => {
    // Predates the check. There is no way to tell whether it still matches, and
    // guessing wrong means charging the wrong amount.
    withPendingPayment(undefined);

    const result = await service.startCheckout(ORG, MEMBER, 'EUR');

    expect(result.paymentId).not.toBe('pay-old');
  });

  it('still replaces the payment when Stripe cannot be reached', async () => {
    // Continuing to reuse a payment for the wrong basket would be worse than an
    // abandoned intent, which expires on Stripe's own schedule anyway.
    withPendingPayment('stale');
    provider.cancelPayment.mockRejectedValue(new Error('stripe is down'));

    const result = await service.startCheckout(ORG, MEMBER, 'EUR');

    expect(result.paymentId).not.toBe('pay-old');
  });
});

describe('cartFingerprint', () => {
  it('is stable for an unchanged basket', () => {
    expect(cartFingerprint(cart() as any)).toBe(cartFingerprint(cart() as any));
  });

  it('changes when an item is added', () => {
    const bigger = cart({ items: [cartItem(), cartItem({ id: 'item-2' })] });

    expect(cartFingerprint(bigger as any)).not.toBe(cartFingerprint(cart() as any));
  });

  it('changes when a quantity changes', () => {
    const more = cart({ items: [cartItem({ quantity: 2 })] });

    expect(cartFingerprint(more as any)).not.toBe(cartFingerprint(cart() as any));
  });

  it('changes when the chosen payment method changes', () => {
    // It moves money between the card and offline totals, so the amount to
    // charge changes even though the items did not.
    const offline = cart({ items: [cartItem({ paymentMethodId: 'pm-offline', isCard: false })] });

    expect(cartFingerprint(offline as any)).not.toBe(cartFingerprint(cart() as any));
  });

  it('changes when the total moves without any line changing', () => {
    // A club can alter its handling fee between one checkout and the next.
    const dearer = cart({ totals: { ...cart().totals, orderTotal: 9999 } });

    expect(cartFingerprint(dearer as any)).not.toBe(cartFingerprint(cart() as any));
  });

  it('does not depend on the order items come back in', () => {
    const a = cart({ items: [cartItem(), cartItem({ id: 'item-2' })] });
    const b = cart({ items: [cartItem({ id: 'item-2' }), cartItem()] });

    expect(cartFingerprint(a as any)).toBe(cartFingerprint(b as any));
  });
});

/**
 * An order paid directly to the club.
 *
 * Reported as: two slots checked out with Pay Offline, and afterwards **the
 * items were still in the basket**. The member did the only sensible thing and
 * checked out again — producing a second payment for the same order, then a
 * third. Five had accumulated against one pair of slots before it was reported.
 *
 * The card path closes the cart in `confirmPayment`. The offline path had no
 * equivalent, so nothing ever moved it off `open`.
 */
describe('CheckoutService — placing an offline order', () => {
  const provider = {
    name: 'stripe',
    isConfigured: () => true,
    createPaymentIntent: jest.fn(),
    capturePayment: jest.fn(),
    cancelPayment: jest.fn(),
  };

  let service: CheckoutService;

  /** A basket with nothing to charge to a card. */
  const offlineCart = () =>
    cart({
      items: [cartItem({ paymentMethodId: 'pm-offline', isCard: false })],
      totals: {
        ...cart().totals,
        offlineSubtotal: 2500,
        cardSubtotal: 0,
        chargedToCardNow: 0,
        orderTotal: 2500,
      },
    });

  beforeEach(() => {
    jest.clearAllMocks();
    service = new CheckoutService({ forCardPayment: () => provider, get: () => provider } as any);
    mockCart.getCart.mockResolvedValue(offlineCart() as any);
    mockDb.query.mockImplementation((sql: string) => {
      if (String(sql).includes('MIN(expires_at)')) {
        return Promise.resolve({ rows: [{ expires_at: null }], rowCount: 1 } as any);
      }
      if (String(sql).includes('RETURNING cart_id')) {
        return Promise.resolve({ rows: [{ cart_id: 'cart-1' }], rowCount: 1 } as any);
      }
      if (String(sql).includes('RETURNING id')) {
        return Promise.resolve({ rows: [{ id: 'pay-1' }], rowCount: 1 } as any);
      }
      return Promise.resolve({ rows: [], rowCount: 0 } as any);
    });
  });

  it('closes the cart, so the items do not sit in the basket afterwards', async () => {
    await service.startCheckout(ORG, MEMBER, 'EUR');

    const closed = mockDb.query.mock.calls.find(([sql]) =>
      String(sql).includes("UPDATE carts SET status = 'ordered'")
    );

    expect(closed).toBeDefined();
    expect(closed![1]).toEqual(['cart-1']);
  });

  it('records the payment as awaiting the club’s money', async () => {
    await service.startCheckout(ORG, MEMBER, 'EUR');

    const marked = mockDb.query.mock.calls.find(([sql]) =>
      String(sql).includes("payment_status = 'awaiting_offline'")
    );

    expect(marked).toBeDefined();
  });

  it('never asks a provider to charge nothing', async () => {
    // A zero charge is rejected by Stripe, and there is nothing to charge.
    await service.startCheckout(ORG, MEMBER, 'EUR');

    expect(provider.createPaymentIntent).not.toHaveBeenCalled();
  });

  it('reports the order as complete, with nothing due by card', async () => {
    const result = await service.startCheckout(ORG, MEMBER, 'EUR');

    expect(result).toMatchObject({ completed: true, amountDue: 0, offlineAmount: 2500 });
  });
});


/**
 * Pending payments that cannot be resumed.
 *
 * `createPayment` writes the `payments` row first and asks the provider second,
 * so a failure between the two leaves a `pending` row with no provider and no
 * client secret. Two of those against one basket turned every later checkout
 * into a 500 — the registry was asked for a provider called `null` — and even
 * once that stopped throwing, handing the row back would have given the member
 * a checkout page with no card form and nothing to explain it.
 */
describe('CheckoutService — a pending payment that never reached the provider', () => {
  const provider = {
    name: 'stripe',
    isConfigured: () => true,
    createPaymentIntent: jest.fn().mockResolvedValue({
      providerTransactionId: 'pi_new',
      clientSecret: 'pi_new_secret',
      destinationAccountId: ACCOUNT,
    }),
    capturePayment: jest.fn(),
    cancelPayment: jest.fn().mockResolvedValue(undefined),
  };

  let service: CheckoutService;

  const withOrphan = (over: Record<string, unknown> = {}) => {
    mockDb.query.mockImplementation((sql: string) => {
      const text = String(sql);
      if (text.includes('FROM payments') && text.includes("payment_status = 'pending'")) {
        return Promise.resolve({
          rows: [
            {
              id: 'pay-orphan',
              currency: 'EUR',
              card_amount: 8145,
              offline_amount: 0,
              handling_fee: 145,
              // Never attached: this is the state the fault came from.
              payment_provider: null,
              provider_transaction_id: null,
              metadata: { cartFingerprint: cartFingerprint(cart() as any) },
              ...over,
            },
          ],
          rowCount: 1,
        } as any);
      }
      if (text.includes('stripeConnect')) {
        return Promise.resolve({
          rows: [{ account_id: ACCOUNT, charges_enabled: true }],
          rowCount: 1,
        } as any);
      }
      if (text.includes('MIN(expires_at)')) {
        return Promise.resolve({ rows: [{ expires_at: null }], rowCount: 1 } as any);
      }
      return Promise.resolve({ rows: [], rowCount: 0 } as any);
    });
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new CheckoutService({ forCardPayment: () => provider, get: () => provider } as any);
    mockCart.getCart.mockResolvedValue(cart() as any);
  });

  it('does not fall over asking for a provider called null', async () => {
    withOrphan();

    await expect(service.startCheckout(ORG, MEMBER, 'EUR')).resolves.toBeDefined();
  });

  it('replaces it rather than handing back a checkout with no card form', async () => {
    withOrphan();

    const result = await service.startCheckout(ORG, MEMBER, 'EUR');

    expect(result.paymentId).not.toBe('pay-orphan');
    expect(result.clientSecret).toBe('pi_new_secret');
  });

  it('retires the orphan, so it cannot be found again', async () => {
    withOrphan();

    await service.startCheckout(ORG, MEMBER, 'EUR');

    expect(
      mockDb.query.mock.calls.some(([sql]) => String(sql).includes("payment_status = 'abandoned'"))
    ).toBe(true);
  });

  it('still resumes one that did reach the provider', async () => {
    // The idempotency that stops a reload charging twice must survive the fix.
    withOrphan({
      payment_provider: 'stripe',
      provider_transaction_id: 'pi_1',
      metadata: {
        cartFingerprint: cartFingerprint(cart() as any),
        clientSecret: 'pi_1_secret',
      },
    });

    const result = await service.startCheckout(ORG, MEMBER, 'EUR');

    expect(result.paymentId).toBe('pay-orphan');
    expect(provider.createPaymentIntent).not.toHaveBeenCalled();
  });

  it('leaves an offline order alone — it has no card charge to resume', async () => {
    withOrphan({ card_amount: 0, offline_amount: 2500 });

    const result = await service.startCheckout(ORG, MEMBER, 'EUR');

    expect(result.paymentId).toBe('pay-orphan');
  });
});
