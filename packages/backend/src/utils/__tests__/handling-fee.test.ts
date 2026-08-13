import {
  calculateHandlingFee,
  allocateHandlingFee,
  calculateCartTotals,
  describeCartSummary,
  CartLine,
  HandlingFeeConfig,
  calculateApplicationFee,
} from '../handling-fee';

/** Stripe on the Pony Club organisation type, as used in the design document. */
const STRIPE: HandlingFeeConfig = {
  fixedFee: 25,        // €0.25
  percentageFee: 1.5,
  taxPercentage: 23,
};

const HELIX: HandlingFeeConfig = {
  fixedFee: 20,
  percentageFee: 1.75,
  taxPercentage: 23,
};

const NO_TAX: HandlingFeeConfig = { fixedFee: 25, percentageFee: 1.5, taxPercentage: 0 };

const line = (over: Partial<CartLine> & { id: string; fee: number }): CartLine => ({
  paymentMethodId: 'stripe',
  isCard: true,
  handlingFeeIncluded: false,
  ...over,
});

describe('calculateHandlingFee', () => {
  it('applies fixed + percentage, then tax on the result', () => {
    // 25 + 1.5% of 6200 = 25 + 93 = 118; tax 23% of 118 = 27.14 -> 27
    expect(calculateHandlingFee(6200, STRIPE)).toEqual({
      base: 6200,
      net: 118,
      tax: 27,
      total: 145,
    });
  });

  it('charges nothing at all on an empty base, not even the fixed element', () => {
    expect(calculateHandlingFee(0, STRIPE)).toEqual({ base: 0, net: 0, tax: 0, total: 0 });
    expect(calculateHandlingFee(-100, STRIPE)).toEqual({ base: 0, net: 0, tax: 0, total: 0 });
  });

  it('omits the tax element when the rate is zero', () => {
    const fee = calculateHandlingFee(6200, NO_TAX);
    expect(fee.tax).toBe(0);
    expect(fee.total).toBe(fee.net);
  });

  it('charges the fixed element even when the percentage is zero', () => {
    const fee = calculateHandlingFee(1000, { fixedFee: 25, percentageFee: 0, taxPercentage: 0 });
    expect(fee).toEqual({ base: 1000, net: 25, tax: 0, total: 25 });
  });

  it('rounds half up rather than truncating', () => {
    // 0 + 50% of 5 = 2.5 -> 3
    expect(calculateHandlingFee(5, { fixedFee: 0, percentageFee: 50, taxPercentage: 0 }).net)
      .toBe(3);
  });

  it('is not thrown off by binary floating point', () => {
    // 1.5% of 8110 is 121.65 in decimal but 121.64999... in IEEE 754
    expect(calculateHandlingFee(8110, { fixedFee: 0, percentageFee: 1.5, taxPercentage: 0 }).net)
      .toBe(122);
  });
});

describe('calculateCartTotals — the worked example from the design document', () => {
  // Entry €45 card fee-included, membership €180 offline,
  // booking €12 card fee-added, polo €50 card fee-added.
  const cart: CartLine[] = [
    line({ id: 'entry', fee: 4500, handlingFeeIncluded: true }),
    line({ id: 'membership', fee: 18000, isCard: false, paymentMethodId: 'offline' }),
    line({ id: 'booking', fee: 1200 }),
    line({ id: 'polo', fee: 5000 }),
  ];
  const totals = calculateCartTotals(cart, new Map([['stripe', STRIPE]]));

  it('splits the subtotals by payment method', () => {
    expect(totals.offlineSubtotal).toBe(18000);
    expect(totals.cardSubtotal).toBe(10700);
  });

  it('charges the percentage on the fee-bearing base only, excluding the included item', () => {
    expect(totals.feeBearingBase).toBe(6200);
    expect(totals.handlingFee).toEqual({ base: 6200, net: 118, tax: 27, total: 145 });
  });

  it('collects only the card portion plus its handling fee', () => {
    expect(totals.chargedToCardNow).toBe(10845);
  });

  it('reports an order total covering both portions', () => {
    expect(totals.orderTotal).toBe(28845);
  });

  it('allocates the fee across the bearing lines, and nothing to the others', () => {
    // 1200/6200 x 145 = 28.06 -> 28; 5000/6200 x 145 = 116.9 -> 117
    expect(totals.allocations).toEqual({ booking: 28, polo: 117, entry: 0 });
  });

  it('does not charge the fee-included item twice', () => {
    const naive = calculateHandlingFee(totals.cardSubtotal, STRIPE);
    expect(naive.total).toBeGreaterThan(totals.handlingFee.total);
    expect(totals.allocations.entry).toBe(0);
  });
});

describe('calculateCartTotals — structure', () => {
  it('charges one fixed element for many bearing items, not one each', () => {
    const one = calculateCartTotals(
      [line({ id: 'a', fee: 6200 })],
      new Map([['stripe', STRIPE]])
    );
    const many = calculateCartTotals(
      [line({ id: 'a', fee: 3100 }), line({ id: 'b', fee: 3100 })],
      new Map([['stripe', STRIPE]])
    );
    expect(many.handlingFee.total).toBe(one.handlingFee.total);
  });

  it('charges one fixed element per provider when a cart mixes two', () => {
    const totals = calculateCartTotals(
      [
        line({ id: 'a', fee: 3100, paymentMethodId: 'stripe' }),
        line({ id: 'b', fee: 3100, paymentMethodId: 'helix' }),
      ],
      new Map([['stripe', STRIPE], ['helix', HELIX]])
    );
    expect(totals.perMethod).toHaveLength(2);
    // Two transactions, so both fixed elements apply.
    const singleProvider = calculateCartTotals(
      [line({ id: 'a', fee: 6200 })],
      new Map([['stripe', STRIPE]])
    );
    expect(totals.handlingFee.total).toBeGreaterThan(singleProvider.handlingFee.total);
  });

  it('charges no fee when every card item already includes it', () => {
    const totals = calculateCartTotals(
      [line({ id: 'a', fee: 4500, handlingFeeIncluded: true })],
      new Map([['stripe', STRIPE]])
    );
    expect(totals.handlingFee.total).toBe(0);
    expect(totals.chargedToCardNow).toBe(4500);
  });

  it('charges no fee on an all-offline cart', () => {
    const totals = calculateCartTotals(
      [line({ id: 'a', fee: 18000, isCard: false, paymentMethodId: 'offline' })],
      new Map([['stripe', STRIPE]])
    );
    expect(totals.handlingFee.total).toBe(0);
    expect(totals.chargedToCardNow).toBe(0);
    expect(totals.orderTotal).toBe(18000);
  });

  it('falls back to no fee when a card method has no configured rate', () => {
    const totals = calculateCartTotals(
      [line({ id: 'a', fee: 6200, paymentMethodId: 'unconfigured' })],
      new Map()
    );
    expect(totals.handlingFee.total).toBe(0);
    expect(totals.cardSubtotal).toBe(6200);
  });

  it('handles an empty cart', () => {
    const totals = calculateCartTotals([], new Map([['stripe', STRIPE]]));
    expect(totals.orderTotal).toBe(0);
    expect(totals.handlingFee.total).toBe(0);
    expect(totals.allocations).toEqual({});
  });
});

describe('allocateHandlingFee', () => {
  it('always sums to the total it was given', () => {
    const lines = [
      line({ id: 'a', fee: 333 }),
      line({ id: 'b', fee: 333 }),
      line({ id: 'c', fee: 334 }),
    ];
    const allocations = allocateHandlingFee(lines, 100);
    const sum = Object.values(allocations).reduce((a, b) => a + b, 0);
    expect(sum).toBe(100);
  });

  it('sums to the total across a wide range of awkward splits', () => {
    for (let total = 0; total <= 200; total += 7) {
      for (let n = 1; n <= 6; n += 1) {
        const lines = Array.from({ length: n }, (_, i) =>
          line({ id: `l${i}`, fee: 100 + i * 37 })
        );
        const sum = Object.values(allocateHandlingFee(lines, total))
          .reduce((a, b) => a + b, 0);
        expect(sum).toBe(total);
      }
    }
  });

  it('gives leftover cents to the largest fractional share, deterministically', () => {
    const lines = [line({ id: 'small', fee: 100 }), line({ id: 'large', fee: 900 })];
    expect(allocateHandlingFee(lines, 11)).toEqual({ small: 1, large: 10 });
    expect(allocateHandlingFee(lines, 11)).toEqual(allocateHandlingFee(lines, 11));
  });

  it('allocates nothing when there is nothing to allocate', () => {
    expect(allocateHandlingFee([line({ id: 'a', fee: 100 })], 0)).toEqual({ a: 0 });
    expect(allocateHandlingFee([], 100)).toEqual({});
  });

  it('ignores lines that do not bear the fee', () => {
    const lines = [
      line({ id: 'included', fee: 4500, handlingFeeIncluded: true }),
      line({ id: 'offline', fee: 1000, isCard: false }),
      line({ id: 'bearing', fee: 1000 }),
    ];
    expect(allocateHandlingFee(lines, 50)).toEqual({ bearing: 50 });
  });
});

describe('describeCartSummary', () => {
  const totals = (lines: CartLine[], config = STRIPE) =>
    calculateCartTotals(lines, new Map([['stripe', config]]));

  it('shows a single total when everything is offline', () => {
    const s = describeCartSummary(totals([line({ id: 'a', fee: 100, isCard: false })]));
    expect(s).toEqual({ layout: 'single_total', showHandlingFee: false, showTax: false });
  });

  it('shows a single total when every card item includes its fee', () => {
    const s = describeCartSummary(
      totals([line({ id: 'a', fee: 4500, handlingFeeIncluded: true })])
    );
    expect(s.layout).toBe('single_total');
    expect(s.showHandlingFee).toBe(false);
  });

  it('breaks out the fee when card items add it on', () => {
    const s = describeCartSummary(totals([line({ id: 'a', fee: 6200 })]));
    expect(s).toEqual({ layout: 'card_with_fee', showHandlingFee: true, showTax: true });
  });

  it('uses the mixed layout when both payment methods are present', () => {
    const s = describeCartSummary(
      totals([
        line({ id: 'a', fee: 6200 }),
        line({ id: 'b', fee: 1000, isCard: false }),
      ])
    );
    expect(s.layout).toBe('mixed');
  });

  it('suppresses the tax line entirely when the rate is zero', () => {
    const s = describeCartSummary(totals([line({ id: 'a', fee: 6200 })], NO_TAX));
    expect(s.showHandlingFee).toBe(true);
    expect(s.showTax).toBe(false);
  });
});

describe('calculateApplicationFee', () => {
  /**
   * The safe default. Before organisation types could configure a split, the
   * platform took exactly the handling fee — an unconfigured type must keep
   * behaving that way, or the platform's revenue silently transfers to the
   * clubs.
   */
  it('takes the handling fee when nothing is configured', () => {
    expect(calculateApplicationFee(2500, 2623, 123, null)).toBe(123);
    expect(calculateApplicationFee(2500, 2623, 123, undefined)).toBe(123);
    expect(
      calculateApplicationFee(2500, 2623, 123, { fixedFee: null, percentageFee: null })
    ).toBe(123);
  });

  it('treats a half-configured pair as unconfigured rather than as zero', () => {
    // The database refuses this state, but a stale row or a hand-edited record
    // must not be read as "the platform takes nothing".
    expect(
      calculateApplicationFee(2500, 2623, 123, { fixedFee: 50, percentageFee: null })
    ).toBe(123);
    expect(
      calculateApplicationFee(2500, 2623, 123, { fixedFee: null, percentageFee: 2 })
    ).toBe(123);
  });

  it('applies the configured fixed and percentage elements', () => {
    // 25 + 2% of 2500 = 25 + 50 = 75
    expect(
      calculateApplicationFee(2500, 2623, 123, { fixedFee: 25, percentageFee: 2 })
    ).toBe(75);
  });

  /**
   * The percentage is on the value sold, not on the charge. Taking a
   * percentage of our own surcharge would compound it.
   */
  it('charges the percentage on the items, not on the handling fee', () => {
    const withFee = calculateApplicationFee(2500, 2623, 123, {
      fixedFee: 0,
      percentageFee: 10,
    });
    const withoutFee = calculateApplicationFee(2500, 2500, 0, {
      fixedFee: 0,
      percentageFee: 10,
    });
    expect(withFee).toBe(250);
    expect(withFee).toBe(withoutFee);
  });

  it('can be configured to take more than the handling fee', () => {
    // "Charge the member 1.5% but take 3% of the sale" — the arrangement the
    // old fixed behaviour could not express.
    expect(
      calculateApplicationFee(10000, 10150, 150, { fixedFee: 0, percentageFee: 3 })
    ).toBe(300);
  });

  it('can be configured to take less, leaving the club part of the surcharge', () => {
    expect(
      calculateApplicationFee(10000, 10150, 150, { fixedFee: 0, percentageFee: 0.5 })
    ).toBe(50);
  });

  it('allows a genuine zero once configured', () => {
    // Explicitly set, this means the platform takes nothing — distinct from
    // "not configured".
    expect(
      calculateApplicationFee(2500, 2623, 123, { fixedFee: 0, percentageFee: 0 })
    ).toBe(0);
  });

  /**
   * Stripe rejects a fee larger than the charge, and it would leave the club
   * with nothing. Capping keeps the sale working; refusing it would punish the
   * member for a misconfiguration they cannot see.
   */
  it('never exceeds the amount charged', () => {
    expect(
      calculateApplicationFee(500, 520, 20, { fixedFee: 5000, percentageFee: 0 })
    ).toBe(520);
  });

  it('caps an unconfigured fee at the charge too', () => {
    expect(calculateApplicationFee(100, 100, 500, null)).toBe(100);
  });

  it('takes nothing when nothing is being charged', () => {
    expect(calculateApplicationFee(0, 0, 0, { fixedFee: 25, percentageFee: 2 })).toBe(0);
    expect(calculateApplicationFee(0, 0, 0, null)).toBe(0);
  });

  it('rounds to whole minor units', () => {
    // 0 + 1.5% of 999 = 14.985 -> 15
    const fee = calculateApplicationFee(999, 999, 0, { fixedFee: 0, percentageFee: 1.5 });
    expect(Number.isInteger(fee)).toBe(true);
    expect(fee).toBe(15);
  });

  it('never returns a negative fee', () => {
    expect(
      calculateApplicationFee(-100, 1000, -50, { fixedFee: -10, percentageFee: 0 })
    ).toBeGreaterThanOrEqual(0);
  });
});
