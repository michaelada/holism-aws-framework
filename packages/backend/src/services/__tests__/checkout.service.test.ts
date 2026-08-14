import { CheckoutService, contextIdFrom } from '../checkout.service';
import { db } from '../../database/pool';
import { cartService } from '../cart.service';
import { ValidationError, NotFoundError } from '../../middleware/errors';
import { createMockClient } from '../../test-helpers/mock-db-client';
import { fulfilmentService } from '../fulfilment.service';

jest.mock('../../database/pool');
jest.mock('../../config/logger');
jest.mock('../cart.service', () => ({
  cartService: { getCart: jest.fn() },
}));
jest.mock('../fulfilment.service', () => ({
  fulfilmentService: { fulfilPayment: jest.fn() },
}));

const mockDb = db as jest.Mocked<typeof db>;
const mockCart = cartService as jest.Mocked<typeof cartService>;
const mockFulfilment = fulfilmentService as jest.Mocked<typeof fulfilmentService>;

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

/** A provider registry whose card provider is this spy. */
const registryFor = (provider: any) => ({ forCardPayment: () => provider }) as any;

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
            metadata: { clientSecret: 'existing_secret' },
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
