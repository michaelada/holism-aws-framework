import { describe, it, expect, vi } from 'vitest';
import { isCartMutation, notifyCartChanged, onCartChanged } from '../cartActivity';

/**
 * The notification that keeps the basket count honest.
 *
 * It exists so no screen has to know the badge is there. `isCartMutation` is
 * the part worth pinning: it decides, from the request alone, whether the
 * basket may have changed — and getting it wrong in either direction is a badge
 * that lies or a page that refetches for ever.
 */
describe('isCartMutation', () => {
  it.each([
    ['/api/account/lhpc/cart/items', 'POST'],
    ['/api/account/lhpc/cart/items/item-1', 'DELETE'],
    ['/api/account/lhpc/cart/items/item-1/payment-method', 'PUT'],
    ['/api/account/mhpc/checkout', 'POST'],
    ['/api/account/mhpc/checkout/pay-1/abandon', 'POST'],
  ])('counts %s %s as a change', (url, method) => {
    expect(isCartMutation(url, method)).toBe(true);
  });

  it('does not count reading the basket as changing it', () => {
    // The count is refreshed *by* a read. Treating that as a change would have
    // it fetch itself for ever.
    expect(isCartMutation('/api/account/lhpc/cart', 'GET')).toBe(false);
  });

  it('ignores writes to anything that is not the basket', () => {
    expect(isCartMutation('/api/account/lhpc/profile', 'PUT')).toBe(false);
    expect(isCartMutation('/api/account/lhpc/bookings/b-1/cancel', 'POST')).toBe(false);
    expect(isCartMutation('/api/account/lhpc/form-submissions/fs-1', 'PUT')).toBe(false);
  });

  it('is not fooled by the word appearing elsewhere in a path', () => {
    expect(isCartMutation('/api/account/lhpc/catalogue/carts-and-horses', 'POST')).toBe(false);
  });
});

describe('cart change notifications', () => {
  it('tells every listener', () => {
    const first = vi.fn();
    const second = vi.fn();
    const offFirst = onCartChanged(first);
    const offSecond = onCartChanged(second);

    notifyCartChanged();

    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
    offFirst();
    offSecond();
  });

  it('stops telling one that has unsubscribed', () => {
    const listener = vi.fn();
    const off = onCartChanged(listener);

    off();
    notifyCartChanged();

    expect(listener).not.toHaveBeenCalled();
  });

  it('survives a listener that unsubscribes while being told', () => {
    // The shell unmounts on sign-out, which can happen during the very
    // notification that prompted a refetch. Iterating the live set would skip
    // whichever listener came next.
    const second = vi.fn();
    let off: (() => void) | undefined;
    const first = vi.fn(() => off?.());

    off = onCartChanged(first);
    const offSecond = onCartChanged(second);

    expect(() => notifyCartChanged()).not.toThrow();
    expect(second).toHaveBeenCalledTimes(1);
    offSecond();
  });
});
