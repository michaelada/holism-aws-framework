import { describe, it, expect, vi } from 'vitest';
import {
  isCartMutation,
  notifyCartChanged,
  notifyIfSettled,
  onCartChanged,
} from '../cartActivity';

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

/**
 * The settlement signal.
 *
 * A card payment empties the basket *after* the request that started checkout
 * has returned — the browser confirms with Stripe and the cart only closes once
 * the webhook lands, by which time the client is doing nothing but polling a
 * status, which is a read. Without this the badge kept its pre-payment count.
 */
describe('notifyIfSettled', () => {
  const withListener = (run: () => void) => {
    const listener = vi.fn();
    const off = onCartChanged(listener);
    run();
    off();
    return listener;
  };

  /*
   * `failed` belongs here with the other two. The basket stays open, but a
   * declined payment drops its holds back to the browsing window, so a line may
   * now be expired and out of the count.
   */
  it.each(['paid', 'awaiting_offline', 'failed'])('announces a %s payment', (status) => {
    expect(withListener(() => notifyIfSettled(status))).toHaveBeenCalledTimes(1);
  });

  it('says nothing while a payment is still pending', () => {
    /*
     * The confirmation screen polls this every couple of seconds. Announcing a
     * pending status would refetch the cart on every tick to learn nothing —
     * and the basket genuinely has not changed yet.
     */
    expect(withListener(() => notifyIfSettled('pending'))).not.toHaveBeenCalled();
  });

  it('says nothing when there is no status to read', () => {
    // A failed or in-flight fetch, not an outcome.
    expect(withListener(() => notifyIfSettled(null))).not.toHaveBeenCalled();
    expect(withListener(() => notifyIfSettled(undefined))).not.toHaveBeenCalled();
    expect(withListener(() => notifyIfSettled(''))).not.toHaveBeenCalled();
  });
});
