/* eslint-disable camelcase */

/**
 * Let a cart reach the status the checkout actually sets.
 *
 * `checkout.service.confirmPayment` moves the cart to `'ordered'` once the
 * money is in, but `carts_status_check` only ever allowed `open`,
 * `checked_out` and `abandoned`. The update therefore raised a check
 * constraint violation inside the confirm transaction, rolling back the whole
 * confirmation.
 *
 * That matters more now that baskets hold slots. A hold is only counted while
 * its cart is `open`, so `'ordered'` is what hands the slot on from the hold to
 * the booking that replaces it. A cart that cannot leave `open` keeps holding a
 * slot it has already paid for.
 *
 * `checked_out` is kept even though nothing writes it today: rows may carry it
 * from earlier runs, and dropping a value from a check constraint is how you
 * make old rows unwritable.
 */

exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.dropConstraint('carts', 'carts_status_check');
  pgm.addConstraint('carts', 'carts_status_check', {
    check: "status IN ('open', 'checked_out', 'ordered', 'abandoned')",
  });

  /*
   * Every calendar and event listing now asks which lines are holding
   * something, and holds are a small minority of `cart_items`. A partial index
   * keeps that lookup off a full scan without carrying the rows — memberships,
   * merchandise — that never hold anything.
   */
  pgm.createIndex('cart_items', ['item_type', 'expires_at'], {
    name: 'cart_items_live_holds_idx',
    where: 'expires_at IS NOT NULL',
  });
};

exports.down = (pgm) => {
  pgm.dropIndex('cart_items', ['item_type', 'expires_at'], {
    name: 'cart_items_live_holds_idx',
  });

  // Anything already ordered has to go somewhere the old constraint permits,
  // or re-adding it fails on existing rows.
  pgm.sql("UPDATE carts SET status = 'checked_out' WHERE status = 'ordered'");
  pgm.dropConstraint('carts', 'carts_status_check');
  pgm.addConstraint('carts', 'carts_status_check', {
    check: "status IN ('open', 'checked_out', 'abandoned')",
  });
};
