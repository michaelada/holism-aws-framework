/**
 * Card handling fee arithmetic.
 *
 * Implements the rules in docs/ACCOUNT_USER_APP_WIREFRAMES.md Part 4. Kept
 * pure and free of database access so the rules can be tested exhaustively —
 * this is the calculation a member sees on every cart, and getting it wrong
 * either overcharges them or leaves the organisation out of pocket.
 *
 * Everything is in **integer minor units** (cents). Money in floating point
 * drifts by a cent on a cart of this shape, and the drift lands in a total the
 * member is asked to approve. Callers convert at the boundary.
 *
 * The four rules that are easy to get wrong, all encoded below:
 *
 *   1. The percentage applies to the fee-bearing base, not to the whole card
 *      subtotal. An item whose fee already absorbs its handling fee is
 *      excluded — charging on it bills the member twice.
 *   2. The fixed element is charged once per payment, not once per item. One
 *      checkout produces one transaction per provider, and the provider
 *      charges once.
 *   3. No fee-bearing items means no fee at all, including no fixed element.
 *   4. Tax applies to the handling fee, never to the order.
 */

/** Rates in force, as configured on the organisation type. */
export interface HandlingFeeConfig {
  /** Flat amount per card payment, in minor units. */
  fixedFee: number;
  /** Percentage of the fee-bearing base. 1.5 means 1.5%. */
  percentageFee: number;
  /** Percentage applied to the handling fee. 0 means no tax element. */
  taxPercentage: number;
}

export interface CartLine {
  id: string;
  /** Fee in minor units, after any discount. */
  fee: number;
  paymentMethodId: string;
  isCard: boolean;
  /** Whether the fee already absorbs the handling fee. */
  handlingFeeIncluded: boolean;
}

export interface HandlingFeeBreakdown {
  /** Sum of the fees the fee is charged on. */
  base: number;
  /** Fixed + percentage, before tax. */
  net: number;
  /** Tax on the net fee. */
  tax: number;
  /** net + tax — what the member actually pays. */
  total: number;
}

export interface CartTotals {
  offlineSubtotal: number;
  cardSubtotal: number;
  feeBearingBase: number;
  handlingFee: HandlingFeeBreakdown;
  /** Card subtotal plus handling fee — the amount sent to the provider. */
  chargedToCardNow: number;
  orderTotal: number;
  /** One breakdown per card provider present in the cart. */
  perMethod: Array<HandlingFeeBreakdown & { paymentMethodId: string }>;
  /** Handling fee attributed to each fee-bearing line, summing to the total. */
  allocations: Record<string, number>;
}

export const ZERO_FEE: HandlingFeeBreakdown = { base: 0, net: 0, tax: 0, total: 0 };

/**
 * Round half up, tolerating binary floating-point representation error.
 *
 * `118 * 23 / 100` is 27.139999999999997 in IEEE 754; without the nudge a value
 * that is mathematically x.5 can round down.
 */
function roundHalfUp(value: number): number {
  return Math.round(value + Number.EPSILON * Math.abs(value));
}

/**
 * The handling fee on a given base.
 *
 * Rounds exactly twice — once on the net fee, once on the tax. Rounding at
 * every intermediate step drifts; rounding later loses the distinction between
 * the fee and its tax, which both have to be shown separately.
 */
export function calculateHandlingFee(
  base: number,
  config: HandlingFeeConfig
): HandlingFeeBreakdown {
  // Rule 3 — nothing to charge on means no fee, not just no percentage.
  if (base <= 0) return { ...ZERO_FEE };

  const net = roundHalfUp(config.fixedFee + (base * config.percentageFee) / 100);
  const tax = roundHalfUp((net * config.taxPercentage) / 100);

  return { base, net, tax, total: net + tax };
}

/**
 * Split a handling fee across the lines that bear it, pro rata by fee.
 *
 * Uses the largest-remainder method so the parts always sum to the whole. The
 * naive alternative — rounding each share independently — leaves the payment's
 * lines disagreeing with its total by a cent or two, which shows up on a
 * receipt.
 *
 * Never re-derive a line's share from the rate: that reintroduces the fixed
 * element on every line.
 */
export function allocateHandlingFee(
  lines: CartLine[],
  totalFee: number
): Record<string, number> {
  const bearing = lines.filter((l) => l.isCard && !l.handlingFeeIncluded);
  const base = bearing.reduce((sum, l) => sum + l.fee, 0);

  const allocations: Record<string, number> = {};
  if (totalFee <= 0 || base <= 0 || bearing.length === 0) {
    bearing.forEach((l) => {
      allocations[l.id] = 0;
    });
    return allocations;
  }

  const exact = bearing.map((l) => (l.fee * totalFee) / base);
  const floors = exact.map((v) => Math.floor(v));
  let remainder = totalFee - floors.reduce((a, b) => a + b, 0);

  // Hand out the leftover cents to the largest fractional parts first, ties
  // broken by position so the result is stable across identical carts.
  const order = exact
    .map((v, i) => ({ i, frac: v - Math.floor(v) }))
    .sort((a, b) => (b.frac - a.frac) || (a.i - b.i));

  const extra = new Array(bearing.length).fill(0);
  for (let k = 0; k < order.length && remainder > 0; k += 1) {
    extra[order[k].i] = 1;
    remainder -= 1;
  }

  bearing.forEach((l, i) => {
    allocations[l.id] = floors[i] + extra[i];
  });
  return allocations;
}

/**
 * Every figure a cart needs to display, and the amount to collect.
 *
 * `configs` is keyed by payment method id. A cart mixing two card providers is
 * calculated per provider and summed — there are two transactions, so there
 * are two fixed elements. A card line whose method has no configured rate
 * contributes to the card subtotal but attracts no fee, which is the safe
 * direction to fail.
 */
export function calculateCartTotals(
  lines: CartLine[],
  configs: Map<string, HandlingFeeConfig>
): CartTotals {
  const offlineSubtotal = lines
    .filter((l) => !l.isCard)
    .reduce((sum, l) => sum + l.fee, 0);

  const cardLines = lines.filter((l) => l.isCard);
  const cardSubtotal = cardLines.reduce((sum, l) => sum + l.fee, 0);

  const byMethod = new Map<string, CartLine[]>();
  cardLines
    .filter((l) => !l.handlingFeeIncluded)
    .forEach((l) => {
      const group = byMethod.get(l.paymentMethodId);
      if (group) group.push(l);
      else byMethod.set(l.paymentMethodId, [l]);
    });

  const perMethod: CartTotals['perMethod'] = [];
  const allocations: Record<string, number> = {};

  byMethod.forEach((group, paymentMethodId) => {
    const config = configs.get(paymentMethodId);
    const base = group.reduce((sum, l) => sum + l.fee, 0);
    const fee = config ? calculateHandlingFee(base, config) : { ...ZERO_FEE, base };

    perMethod.push({ paymentMethodId, ...fee });
    Object.assign(allocations, allocateHandlingFee(group, fee.total));
  });

  // Fee-included card lines bear no fee, but still need an entry so callers can
  // write a handling fee against every transaction without special-casing.
  cardLines
    .filter((l) => l.handlingFeeIncluded)
    .forEach((l) => {
      allocations[l.id] = 0;
    });

  const feeBearingBase = perMethod.reduce((sum, m) => sum + m.base, 0);
  const handlingFee: HandlingFeeBreakdown = {
    base: feeBearingBase,
    net: perMethod.reduce((sum, m) => sum + m.net, 0),
    tax: perMethod.reduce((sum, m) => sum + m.tax, 0),
    total: perMethod.reduce((sum, m) => sum + m.total, 0),
  };

  const chargedToCardNow = cardSubtotal + handlingFee.total;

  return {
    offlineSubtotal,
    cardSubtotal,
    feeBearingBase,
    handlingFee,
    chargedToCardNow,
    orderTotal: offlineSubtotal + chargedToCardNow,
    perMethod,
    allocations,
  };
}

/**
 * How the cart summary should be laid out, per the display rules in Part 4.5.
 *
 * A zero tax element is suppressed rather than shown as 0.00 — an organisation
 * type with no tax configured should produce a summary with no trace of tax.
 */
export function describeCartSummary(totals: CartTotals): {
  layout: 'single_total' | 'card_with_fee' | 'mixed';
  showHandlingFee: boolean;
  showTax: boolean;
} {
  const hasOffline = totals.offlineSubtotal > 0;
  const hasCard = totals.cardSubtotal > 0;
  const hasFee = totals.handlingFee.total > 0;

  const layout = hasOffline && hasCard
    ? 'mixed'
    : hasCard && hasFee
      ? 'card_with_fee'
      : 'single_total';

  return { layout, showHandlingFee: hasFee, showTax: totals.handlingFee.tax > 0 };
}

/* ------------------------------------------------------------------ *
 * The Stripe Connect application fee
 * ------------------------------------------------------------------ */

/**
 * The platform's cut, configured per organisation type and payment method.
 *
 * `null` means the super admin has not configured one, which is treated as
 * "take the handling fee" — the arrangement in force before this was
 * configurable. See `calculateApplicationFee`.
 */
export interface ApplicationFeeConfig {
  fixedFee: number | null;
  percentageFee: number | null;
}

/**
 * How much of a charge the platform keeps.
 *
 * **This does not change what the member pays.** The member's total is decided
 * by `calculateCartTotals`; this only decides how that money is split between
 * the platform and the club, via Stripe Connect's `application_fee_amount`.
 *
 * The percentage applies to `cardSubtotal` — the value of the items sold — and
 * **not** to the handling fee. Taking a percentage of our own surcharge would
 * compound it, and the platform's commission is on what the club sold.
 *
 * @param cardSubtotal   value of the card-paid items, minor units
 * @param amountCharged  what the card is actually charged, minor units
 * @param handlingFee    the surcharge included in `amountCharged`, minor units
 */
export function calculateApplicationFee(
  cardSubtotal: number,
  amountCharged: number,
  handlingFee: number,
  config: ApplicationFeeConfig | null | undefined
): number {
  // Not configured — the platform takes the handling fee, as it always has.
  if (
    !config ||
    config.fixedFee === null ||
    config.fixedFee === undefined ||
    config.percentageFee === null ||
    config.percentageFee === undefined
  ) {
    return Math.min(Math.max(handlingFee, 0), Math.max(amountCharged, 0));
  }

  // Nothing being charged means nothing to take a share of.
  if (amountCharged <= 0) return 0;

  const fee = roundHalfUp(
    config.fixedFee + (Math.max(cardSubtotal, 0) * config.percentageFee) / 100
  );

  /*
   * Stripe rejects an application fee larger than the charge, and it would mean
   * the club received nothing — so the configured fee is capped at the amount
   * charged. Capping rather than throwing is the lesser evil: refusing the sale
   * punishes the member for a misconfiguration they cannot see, and the cap is
   * visible in the recorded `application_fee_amount` on the payment.
   */
  return Math.min(Math.max(fee, 0), amountCharged);
}
