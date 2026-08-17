import {
  BASKET_HOLD_MINUTES,
  CHECKOUT_HOLD_MINUTES,
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
  it('holds a basket item for the two minutes the clubs were promised', () => {
    expect(BASKET_HOLD_MINUTES).toBe(2);
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
