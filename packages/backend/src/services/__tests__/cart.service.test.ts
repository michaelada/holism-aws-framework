import { CartService } from '../cart.service';
import { db } from '../../database/pool';
import { organizationTypePaymentFeeService } from '../organization-type-payment-fee.service';
import { ValidationError, NotFoundError } from '../../middleware/errors';

jest.mock('../../database/pool');
jest.mock('../../config/logger');
jest.mock('../organization-type-payment-fee.service', () => ({
  organizationTypePaymentFeeService: { resolveForOrganisation: jest.fn() },
}));

const mockDb = db as jest.Mocked<typeof db>;
const mockFees = organizationTypePaymentFeeService.resolveForOrganisation as jest.Mock;

const ORG = 'org-1';
const USER = 'ou-1';
const CART = 'cart-1';

/** Stripe on the Pony Club type, in minor units — the documented rates. */
const STRIPE_CONFIG = { fixedFee: 25, percentageFee: 1.5, taxPercentage: 23 };

const itemRow = (over: Record<string, any> = {}) => ({
  id: 'item-1',
  cart_id: CART,
  item_type: 'event_entry',
  context_ref: { supportedPaymentMethodIds: ['pm-stripe', 'pm-offline'] },
  description: 'Spring Hunter Trials — Class 2',
  form_submission_id: null,
  quantity: 1,
  unit_fee: 4500,
  fee: 4500,
  payment_method_id: 'pm-stripe',
  payment_method_name: 'stripe',
  payment_method_display_name: 'Pay By Card (Stripe)',
  handling_fee_included: false,
  discount_amount: 0,
  expires_at: null,
  ...over,
});

const openCartRow = { id: CART, currency: 'EUR', status: 'open' };

describe('CartService', () => {
  let service: CartService;

  beforeEach(() => {
    mockDb.query.mockReset();
    mockFees.mockReset();
    mockFees.mockResolvedValue(new Map([['pm-stripe', STRIPE_CONFIG]]));
    service = new CartService();
  });

  describe('getOrCreateOpenCart', () => {
    it('returns the existing open cart', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [openCartRow] } as any);

      const cart = await service.getOrCreateOpenCart(ORG, USER, 'EUR');

      expect(cart.id).toBe(CART);
      expect(mockDb.query).toHaveBeenCalledTimes(1);
    });

    it('scopes the lookup to the organisation as well as the user', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [openCartRow] } as any);
      await service.getOrCreateOpenCart(ORG, USER, 'EUR');

      const [sql, params] = mockDb.query.mock.calls[0];
      expect(String(sql)).toContain('organisation_id = $1');
      expect(String(sql)).toContain('user_id = $2');
      expect(String(sql)).toContain("status = 'open'");
      expect(params).toEqual([ORG, USER]);
    });

    it('creates one in the organisation currency when none is open', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [] } as any)
        .mockResolvedValueOnce({ rows: [openCartRow] } as any);

      await service.getOrCreateOpenCart(ORG, USER, 'EUR');

      const [, params] = mockDb.query.mock.calls[1];
      expect(params).toEqual([ORG, USER, 'EUR']);
    });
  });

  describe('getCart totals', () => {
    /** Cart load: find cart, load items, (fees are mocked separately). */
    const withItems = (rows: any[]) => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [openCartRow] } as any)
        .mockResolvedValueOnce({ rows } as any);
    };

    it('reproduces the worked example from the design document', async () => {
      withItems([
        itemRow({ id: 'entry', fee: 4500, handling_fee_included: true }),
        itemRow({
          id: 'membership',
          fee: 18000,
          payment_method_id: 'pm-offline',
          payment_method_name: 'pay-offline',
        }),
        itemRow({ id: 'booking', fee: 1200 }),
        itemRow({ id: 'polo', fee: 5000 }),
      ]);

      const cart = await service.getCart(ORG, USER, 'EUR');

      expect(cart.totals.offlineSubtotal).toBe(18000);
      expect(cart.totals.cardSubtotal).toBe(10700);
      expect(cart.totals.feeBearingBase).toBe(6200);
      expect(cart.totals.handlingFee).toEqual({ base: 6200, net: 118, tax: 27, total: 145 });
      expect(cart.totals.chargedToCardNow).toBe(10845);
      expect(cart.totals.orderTotal).toBe(28845);
      expect(cart.totals.allocations).toEqual({ booking: 28, polo: 117, entry: 0 });
    });

    it('describes a mixed cart with the right summary layout', async () => {
      withItems([
        itemRow({ id: 'a', fee: 6200 }),
        itemRow({
          id: 'b',
          fee: 1000,
          payment_method_id: 'pm-offline',
          payment_method_name: 'pay-offline',
        }),
      ]);

      const cart = await service.getCart(ORG, USER, 'EUR');
      expect(cart.summary.layout).toBe('mixed');
      expect(cart.summary.showTax).toBe(true);
    });

    it('classifies a payment method as card by name', async () => {
      withItems([
        itemRow({ id: 'a', payment_method_name: 'helix-pay' }),
        itemRow({
          id: 'b',
          payment_method_name: 'pay-offline',
          payment_method_id: 'pm-offline',
        }),
      ]);

      const cart = await service.getCart(ORG, USER, 'EUR');
      expect(cart.items[0].isCard).toBe(true);
      expect(cart.items[1].isCard).toBe(false);
    });

    it('flags the "(plus handling fee)" note only on fee-bearing card lines', async () => {
      withItems([
        itemRow({ id: 'added', handling_fee_included: false }),
        itemRow({ id: 'included', handling_fee_included: true }),
        itemRow({
          id: 'offline',
          payment_method_id: 'pm-offline',
          payment_method_name: 'pay-offline',
          handling_fee_included: false,
        }),
      ]);

      const cart = await service.getCart(ORG, USER, 'EUR');
      expect(cart.items.map((i) => i.showsHandlingFeeNote)).toEqual([true, false, false]);
    });

    it('returns zeroed totals for an empty cart', async () => {
      withItems([]);

      const cart = await service.getCart(ORG, USER, 'EUR');
      expect(cart.totals.orderTotal).toBe(0);
      expect(cart.totals.handlingFee.total).toBe(0);
      expect(cart.summary.layout).toBe('single_total');
    });

    it('excludes an expired hold from the totals and warns about it', async () => {
      const past = new Date(Date.now() - 60_000);
      withItems([
        itemRow({ id: 'live', fee: 6200 }),
        itemRow({ id: 'lapsed', fee: 5000, expires_at: past }),
      ]);

      const cart = await service.getCart(ORG, USER, 'EUR');

      // An item the member can no longer buy must not inflate a total they are
      // about to approve — but it is still shown, with an explanation.
      expect(cart.totals.feeBearingBase).toBe(6200);
      expect(cart.items).toHaveLength(2);
      expect(cart.warnings).toEqual([
        expect.objectContaining({ itemId: 'lapsed', code: 'HOLD_EXPIRED' }),
      ]);
    });

    it('keeps an item whose hold has not yet lapsed', async () => {
      const future = new Date(Date.now() + 600_000);
      withItems([itemRow({ id: 'held', fee: 6200, expires_at: future })]);

      const cart = await service.getCart(ORG, USER, 'EUR');
      expect(cart.warnings).toEqual([]);
      expect(cart.totals.feeBearingBase).toBe(6200);
    });

    it('charges no handling fee when the organisation type has no rates', async () => {
      mockFees.mockResolvedValue(new Map());
      withItems([itemRow({ id: 'a', fee: 6200 })]);

      const cart = await service.getCart(ORG, USER, 'EUR');
      expect(cart.totals.handlingFee.total).toBe(0);
      expect(cart.totals.chargedToCardNow).toBe(6200);
    });

    it('resolves fees for the organisation the cart belongs to', async () => {
      withItems([itemRow()]);
      await service.getCart(ORG, USER, 'EUR');
      expect(mockFees).toHaveBeenCalledWith(ORG);
    });
  });

  describe('addItem', () => {
    const validItem = {
      itemType: 'event_entry' as const,
      contextRef: { activityId: 'act-1' },
      description: 'Class 2',
      unitFee: 4500,
      paymentMethodId: 'pm-stripe',
      handlingFeeIncluded: false,
      supportedPaymentMethodIds: ['pm-stripe', 'pm-offline'],
    };

    const expectInsert = () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [openCartRow] } as any)   // find cart
        .mockResolvedValueOnce({ rows: [{ id: 'item-9' }] } as any) // insert
        .mockResolvedValueOnce({ rows: [] } as any)               // touch
        .mockResolvedValueOnce({ rows: [itemRow({ id: 'item-9' })] } as any);
    };

    it('stores the fee net of discount, in minor units', async () => {
      expectInsert();
      await service.addItem(ORG, USER, 'EUR', {
        ...validItem,
        quantity: 2,
        discountAmount: 500,
      });

      const params = mockDb.query.mock.calls[1][1] as any[];
      // 2 × 4500 − 500
      expect(params).toContain(8500);
    });

    it('snapshots the accepted payment methods onto the item', async () => {
      expectInsert();
      await service.addItem(ORG, USER, 'EUR', validItem);

      const params = mockDb.query.mock.calls[1][1] as any[];
      const contextRef = JSON.parse(params[2]);
      expect(contextRef.supportedPaymentMethodIds).toEqual(['pm-stripe', 'pm-offline']);
      expect(contextRef.activityId).toBe('act-1');
    });

    it('rejects a payment method the item does not accept', async () => {
      await expect(
        service.addItem(ORG, USER, 'EUR', { ...validItem, paymentMethodId: 'pm-helix' })
      ).rejects.toThrow(ValidationError);
      expect(mockDb.query).not.toHaveBeenCalled();
    });

    it('rejects a fractional or negative fee', async () => {
      await expect(
        service.addItem(ORG, USER, 'EUR', { ...validItem, unitFee: 45.5 })
      ).rejects.toThrow(/minor units/);
      await expect(
        service.addItem(ORG, USER, 'EUR', { ...validItem, unitFee: -1 })
      ).rejects.toThrow(/minor units/);
    });

    it('rejects a quantity below one', async () => {
      await expect(
        service.addItem(ORG, USER, 'EUR', { ...validItem, quantity: 0 })
      ).rejects.toThrow(/at least 1/);
    });

    it('rejects a discount larger than the item fee', async () => {
      // Otherwise the line total goes negative and quietly credits the member.
      await expect(
        service.addItem(ORG, USER, 'EUR', { ...validItem, discountAmount: 9999 })
      ).rejects.toThrow(/cannot exceed/);
    });
  });

  describe('setItemPaymentMethod', () => {
    it('switches to a method the item accepts', async () => {
      mockDb.query
        .mockResolvedValueOnce({
          rows: [{ context_ref: { supportedPaymentMethodIds: ['pm-stripe', 'pm-offline'] } }],
        } as any)
        .mockResolvedValue({ rows: [] } as any);

      await service.setItemPaymentMethod(CART, 'item-1', 'pm-offline');

      const [sql, params] = mockDb.query.mock.calls[1];
      expect(String(sql)).toContain('UPDATE cart_items SET payment_method_id');
      expect(params).toEqual(['pm-offline', 'item-1']);
    });

    it('refuses a method the item never accepted', async () => {
      // The list was snapshotted at add time, so a later change to the source
      // item cannot retroactively widen the member's choice.
      mockDb.query.mockResolvedValueOnce({
        rows: [{ context_ref: { supportedPaymentMethodIds: ['pm-offline'] } }],
      } as any);

      await expect(
        service.setItemPaymentMethod(CART, 'item-1', 'pm-stripe')
      ).rejects.toThrow(ValidationError);
    });

    it('scopes the item to the cart, so one member cannot edit another\'s', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [] } as any);

      await expect(
        service.setItemPaymentMethod(CART, 'someone-elses-item', 'pm-offline')
      ).rejects.toThrow(NotFoundError);

      const [sql, params] = mockDb.query.mock.calls[0];
      expect(String(sql)).toContain('cart_id = $2');
      expect(params).toEqual(['someone-elses-item', CART]);
    });
  });

  describe('removeItem', () => {
    it('removes an item belonging to the cart', async () => {
      mockDb.query.mockResolvedValue({ rowCount: 1, rows: [] } as any);
      await expect(service.removeItem(CART, 'item-1')).resolves.toBeUndefined();
    });

    it('reports a missing item rather than silently succeeding', async () => {
      mockDb.query.mockResolvedValue({ rowCount: 0, rows: [] } as any);
      await expect(service.removeItem(CART, 'nope')).rejects.toThrow(NotFoundError);
    });
  });

  describe('removeExpiredItems', () => {
    it('deletes only lapsed holds and reports how many', async () => {
      mockDb.query.mockResolvedValue({ rowCount: 2, rows: [] } as any);

      const removed = await service.removeExpiredItems(CART);

      expect(removed).toBe(2);
      const [sql] = mockDb.query.mock.calls[0];
      expect(String(sql)).toContain('expires_at IS NOT NULL');
      expect(String(sql)).toContain('expires_at <= $2');
    });
  });
});
