/**
 * Migration: a payment line keeps the whole basket line, not just an id
 *
 * `cart_items` carries `context_ref` (free-form JSONB — an activity, a
 * membership type, a slot, an item plus the size and colour chosen) and
 * `quantity`. Checkout copied neither: `payment_transactions` had a single
 * `context_id` uuid, chosen from `context_ref` by trying the common keys.
 *
 * That was enough while only entries and memberships could be bought — one id
 * identifies both. It is not enough for anything else. Fulfilment happens
 * *after* payment, from the payment line alone, and by then "one club polo" has
 * lost the size and the "three of them" has lost the three. The basket row is
 * not a substitute: it is emptied at checkout, and a webhook redelivered days
 * later must still be able to create the order.
 *
 * Both columns are additive and nullable, so existing rows and the two item
 * types that never needed them are untouched.
 *
 * @see docs/ACCOUNT_USER_APP_PHASE11_CATALOGUE_COMPLETION.md
 */

exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.addColumns('payment_transactions', {
    /**
     * The basket line's `context_ref`, verbatim. `context_id` stays as the
     * indexed, queryable identity; this is everything else the line needs to
     * be fulfilled.
     */
    context_ref: { type: 'jsonb' },
    /** How many were bought. Null on lines from before this column existed. */
    quantity: { type: 'integer' },
  });

  pgm.sql(`
    COMMENT ON COLUMN payment_transactions.context_ref IS
    'The cart line''s context_ref, copied at checkout so fulfilment can run from the payment alone.';
  `);

  pgm.sql(`
    COMMENT ON COLUMN payment_transactions.quantity IS
    'Units bought on this line. Null means one — lines predating the column, and item types that cannot be multiple.';
  `);
};

exports.down = (pgm) => {
  pgm.dropColumns('payment_transactions', ['context_ref', 'quantity']);
};
