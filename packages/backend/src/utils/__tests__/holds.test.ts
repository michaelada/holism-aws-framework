import {
  BASKET_HOLD_MINUTES,
  CHECKOUT_HOLD_MINUTES,
  DEFAULT_HOLD_WINDOWS,
  HOLD_LIMITS,
  holdWindowsError,
  holdWindowsFrom,
  HOLDABLE_ITEM_TYPES,
  holdExpiry,
  isHoldableItemType,
  isHoldLive,
} from '../holds';

/**
 * The hold policy.
 *
 * Mostly constants, but constants with consequences: the relationship between
 * the two windows is what stops a member losing a slot while their card is
 * being authorised, and the set of holdable types is what stops a t-shirt
 * acquiring an expiry that would drop it out of the basket total.
 */
describe('hold policy', () => {
  it('holds a basket item for three minutes by default', () => {
    // The platform default, which a club may override; see `holdWindowsFrom`.
    expect(BASKET_HOLD_MINUTES).toBe(3);
  });

  it('gives a payment attempt materially longer than browsing', () => {
    /*
     * The invariant, not the exact number. Two minutes cannot cover a card
     * form plus a 3-D Secure round trip, and a hold that lapses mid-payment
     * means a member pays for a slot fulfilment then refuses them.
     */
    expect(CHECKOUT_HOLD_MINUTES).toBeGreaterThan(BASKET_HOLD_MINUTES);
    expect(CHECKOUT_HOLD_MINUTES).toBeGreaterThanOrEqual(10);
  });

  it('holds only the things that can actually run out', () => {
    // A membership or a jumper has no slot for a second member to lose.
    expect([...HOLDABLE_ITEM_TYPES].sort()).toEqual(['booking', 'event_entry']);
    expect(isHoldableItemType('booking')).toBe(true);
    expect(isHoldableItemType('membership')).toBe(false);
    expect(isHoldableItemType('merchandise')).toBe(false);
    expect(isHoldableItemType(undefined)).toBe(false);
  });

  it('dates a hold forward from the moment it was taken', () => {
    const from = new Date('2026-08-16T13:00:00.000Z');

    expect(holdExpiry(2, from).toISOString()).toBe('2026-08-16T13:02:00.000Z');
    expect(holdExpiry(15, from).toISOString()).toBe('2026-08-16T13:15:00.000Z');
  });

  describe('isHoldLive', () => {
    const now = new Date('2026-08-16T13:00:00.000Z');

    it('is live up to its expiry and not after', () => {
      expect(isHoldLive('2026-08-16T13:00:01.000Z', now)).toBe(true);
      expect(isHoldLive('2026-08-16T12:59:59.000Z', now)).toBe(false);
    });

    it('treats the exact instant of expiry as gone', () => {
      // Matches `expires_at > NOW()` in the availability queries; the two must
      // not disagree about the boundary.
      expect(isHoldLive('2026-08-16T13:00:00.000Z', now)).toBe(false);
    });

    it('treats a line with no expiry as holding nothing', () => {
      expect(isHoldLive(null, now)).toBe(false);
      expect(isHoldLive(undefined, now)).toBe(false);
    });

    it('treats an unreadable stamp as gone rather than as forever', () => {
      expect(isHoldLive('not a date', now)).toBe(false);
    });
  });
});


/**
 * A club's own hold windows.
 *
 * The right window is a property of the club, not of the platform: a riding
 * school taking bookings all day wants a short basket hold so slots come back
 * quickly, and a club selling a handful of entries a season does not care.
 *
 * Reading is deliberately forgiving and writing deliberately strict. A mistyped
 * setting must not stop a member adding something to a basket, but an
 * administrator who typed 500 should be told the limit rather than silently
 * given 180.
 */
describe('holdWindowsFrom', () => {
  it('falls back to the platform defaults when a club has set nothing', () => {
    expect(holdWindowsFrom(null)).toEqual(DEFAULT_HOLD_WINDOWS);
    expect(holdWindowsFrom({})).toEqual(DEFAULT_HOLD_WINDOWS);
    expect(holdWindowsFrom({ holds: null })).toEqual(DEFAULT_HOLD_WINDOWS);
  });

  it('takes what the club set', () => {
    expect(holdWindowsFrom({ holds: { basketMinutes: 10, checkoutMinutes: 30 } })).toEqual({
      basketMinutes: 10,
      checkoutMinutes: 30,
    });
  });

  it('takes one setting without losing the other', () => {
    expect(holdWindowsFrom({ holds: { basketMinutes: 10 } })).toEqual({
      basketMinutes: 10,
      checkoutMinutes: DEFAULT_HOLD_WINDOWS.checkoutMinutes,
    });
  });

  it('clamps a value that reached the column out of range', () => {
    // Enforced on read as well as on write: a number that got there another
    // way still has to produce a sane hold.
    expect(holdWindowsFrom({ holds: { basketMinutes: 5000 } }).basketMinutes).toBe(
      HOLD_LIMITS.basketMinutes.max
    );
    expect(holdWindowsFrom({ holds: { checkoutMinutes: 1 } }).checkoutMinutes).toBe(
      HOLD_LIMITS.checkoutMinutes.min
    );
  });

  it('ignores nonsense rather than throwing', () => {
    // Asked while a member is adding to a basket; refusing that over a
    // mistyped setting would be a far worse outcome than a standard hold.
    expect(holdWindowsFrom({ holds: { basketMinutes: 'soon' } })).toEqual(DEFAULT_HOLD_WINDOWS);
    expect(holdWindowsFrom({ holds: { basketMinutes: 0 } })).toEqual(DEFAULT_HOLD_WINDOWS);
    expect(holdWindowsFrom({ holds: { basketMinutes: -5 } })).toEqual(DEFAULT_HOLD_WINDOWS);
  });

  it('never hands back the shared defaults object', () => {
    // A caller that adjusted the result would otherwise change the default for
    // every club in the process.
    const windows = holdWindowsFrom(null);
    windows.basketMinutes = 99;

    expect(DEFAULT_HOLD_WINDOWS.basketMinutes).toBe(3);
  });
});

describe('holdWindowsError', () => {
  it('accepts what is in range, and silence for what was not set', () => {
    expect(holdWindowsError({ basketMinutes: 3, checkoutMinutes: 15 })).toBeNull();
    expect(holdWindowsError({})).toBeNull();
  });

  it('names the limit rather than clamping', () => {
    expect(holdWindowsError({ basketMinutes: 500 })).toMatch(/between 1 and 60/);
    expect(holdWindowsError({ checkoutMinutes: 2 })).toMatch(/between 5 and 180/);
  });

  it('refuses a fraction of a minute', () => {
    expect(holdWindowsError({ basketMinutes: 2.5 })).toMatch(/whole number/);
  });
});
