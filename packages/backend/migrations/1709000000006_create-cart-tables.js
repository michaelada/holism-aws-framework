/**
 * Migration: Shopping cart and multi-item payments
 *
 * `payments` is one-payment-per-thing: `payment_type` + `context_id` point at
 * exactly one entry, membership or booking. A checkout covering an entry *and*
 * a membership *and* three bookings has nowhere to live, and "drill into a
 * payment to see its transactions" has nothing to drill into.
 *
 * This adds:
 *
 *   carts / cart_items      What a member has assembled but not yet paid for.
 *   payment_transactions    The lines of a payment — what the detail screen
 *                           reads, and what carries a per-item handling fee.
 *
 * and relaxes `payments` so one row can be the parent of many transactions.
 * Existing single-context payments keep working untouched: they simply have no
 * `cart_id` and no transaction rows.
 *
 * See G3 in docs/ACCOUNT_USER_APP_WIREFRAMES.md.
 */

exports.shorthands = undefined;

const ITEM_TYPES = [
  'event_entry',
  'membership',
  'registration',
  'booking',
  'merchandise',
];

exports.up = (pgm) => {
  const itemTypeCheck = `item_type IN (${ITEM_TYPES.map((t) => `'${t}'`).join(', ')})`;

  // 1. Carts
  pgm.createTable('carts', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    organisation_id: {
      type: 'uuid',
      notNull: true,
      references: 'organizations(id)',
      onDelete: 'CASCADE',
    },
    user_id: {
      type: 'uuid',
      notNull: true,
      references: 'organization_users(id)',
      onDelete: 'CASCADE',
    },
    status: { type: 'varchar(30)', notNull: true, default: 'open' },
    // One currency per cart, taken from the organisation. Two organisations'
    // items can never share a cart — different currencies, different providers.
    currency: { type: 'varchar(3)', notNull: true },
    created_at: { type: 'timestamp', notNull: true, default: pgm.func('CURRENT_TIMESTAMP') },
    updated_at: { type: 'timestamp', notNull: true, default: pgm.func('CURRENT_TIMESTAMP') },
  });

  pgm.addConstraint('carts', 'carts_status_check', {
    check: "status IN ('open', 'checked_out', 'abandoned')",
  });

  // A member has at most one open cart per organisation. Partial unique index
  // rather than a plain constraint so historic checked-out carts stay.
  pgm.createIndex('carts', ['organisation_id', 'user_id'], {
    unique: true,
    where: "status = 'open'",
    name: 'carts_one_open_per_user_per_org',
  });
  pgm.createIndex('carts', 'user_id');

  // 2. Cart items
  pgm.createTable('cart_items', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    cart_id: {
      type: 'uuid',
      notNull: true,
      references: 'carts(id)',
      onDelete: 'CASCADE',
    },
    item_type: { type: 'varchar(30)', notNull: true },
    // What the item points at — activity id, membership type id, slot, variant.
    // Deliberately JSONB: the five item types reference entirely different
    // things, and five nullable FK columns would be worse.
    context_ref: { type: 'jsonb', notNull: true, default: '{}' },
    description: { type: 'text' },
    /** The completed application form, captured before the item entered the cart. */
    form_submission_id: { type: 'uuid' },
    quantity: { type: 'integer', notNull: true, default: 1 },
    /** Minor units, so cart arithmetic never touches floating point. */
    unit_fee: { type: 'integer', notNull: true, default: 0 },
    fee: { type: 'integer', notNull: true, default: 0 },
    payment_method_id: {
      type: 'uuid',
      notNull: true,
      references: 'payment_methods(id)',
    },
    /** Snapshot from the source item at add-to-cart time, not a live lookup. */
    handling_fee_included: { type: 'boolean', notNull: true, default: false },
    discount_id: { type: 'uuid' },
    discount_amount: { type: 'integer', notNull: true, default: 0 },
    /** Soft hold, so a long application form does not lose a capped place. */
    expires_at: { type: 'timestamp' },
    created_at: { type: 'timestamp', notNull: true, default: pgm.func('CURRENT_TIMESTAMP') },
    updated_at: { type: 'timestamp', notNull: true, default: pgm.func('CURRENT_TIMESTAMP') },
  });

  pgm.addConstraint('cart_items', 'cart_items_item_type_check', { check: itemTypeCheck });
  pgm.addConstraint('cart_items', 'cart_items_amounts_check', {
    check: 'quantity > 0 AND unit_fee >= 0 AND fee >= 0 AND discount_amount >= 0',
  });
  pgm.createIndex('cart_items', 'cart_id');
  pgm.createIndex('cart_items', 'expires_at');

  // 3. Payment transactions — the lines of a payment
  pgm.createTable('payment_transactions', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    payment_id: {
      type: 'uuid',
      notNull: true,
      references: 'payments(id)',
      onDelete: 'CASCADE',
    },
    organisation_id: {
      type: 'uuid',
      notNull: true,
      references: 'organizations(id)',
      onDelete: 'CASCADE',
    },
    item_type: { type: 'varchar(30)', notNull: true },
    /** The entry / membership / booking this line created. */
    context_id: { type: 'uuid' },
    description: { type: 'text' },
    fee: { type: 'integer', notNull: true, default: 0 },
    /**
     * This line's share of the payment's handling fee, allocated pro rata.
     * Stored rather than derived: re-deriving from the rate reintroduces the
     * fixed element per line and the parts stop summing to the total.
     */
    handling_fee: { type: 'integer', notNull: true, default: 0 },
    payment_method_id: { type: 'uuid', references: 'payment_methods(id)' },
    form_submission_id: { type: 'uuid' },
    status: { type: 'varchar(50)', notNull: true, default: 'pending' },
    created_at: { type: 'timestamp', notNull: true, default: pgm.func('CURRENT_TIMESTAMP') },
    updated_at: { type: 'timestamp', notNull: true, default: pgm.func('CURRENT_TIMESTAMP') },
  });

  pgm.addConstraint('payment_transactions', 'payment_transactions_item_type_check', {
    check: itemTypeCheck,
  });
  pgm.createIndex('payment_transactions', 'payment_id');
  pgm.createIndex('payment_transactions', 'organisation_id');
  pgm.createIndex('payment_transactions', ['item_type', 'context_id']);

  // 4. Let a payment be the parent of many transactions
  pgm.addColumns('payments', {
    cart_id: { type: 'uuid', references: 'carts(id)' },
    /** Minor units, mirroring the cart. Null on legacy single-context rows. */
    handling_fee: { type: 'integer' },
    offline_amount: { type: 'integer' },
    card_amount: { type: 'integer' },
    /**
     * The fee rates in force at checkout. A super admin changing an
     * organisation type's rates must not retroactively change what a historical
     * receipt says.
     */
    fee_config_snapshot: { type: 'jsonb' },
    offline_received_at: { type: 'timestamp' },
    offline_received_by: { type: 'uuid', references: 'organization_users(id)' },
  });

  // A basket payment covers many things, so it has no single context. Existing
  // rows keep theirs.
  pgm.alterColumn('payments', 'payment_type', { notNull: false });
  pgm.alterColumn('payments', 'context_id', { notNull: false });

  pgm.createIndex('payments', 'cart_id');
  pgm.createIndex('payments', 'offline_received_at');
};

exports.down = (pgm) => {
  pgm.dropIndex('payments', 'cart_id');
  pgm.dropIndex('payments', 'offline_received_at');
  pgm.dropColumns('payments', [
    'cart_id',
    'handling_fee',
    'offline_amount',
    'card_amount',
    'fee_config_snapshot',
    'offline_received_at',
    'offline_received_by',
  ]);

  // Rows created by a cart checkout have no payment_type/context_id, so they
  // must go before the columns can be mandatory again.
  pgm.sql('DELETE FROM payments WHERE payment_type IS NULL OR context_id IS NULL');
  pgm.alterColumn('payments', 'payment_type', { notNull: true });
  pgm.alterColumn('payments', 'context_id', { notNull: true });

  pgm.dropTable('payment_transactions');
  pgm.dropTable('cart_items');
  pgm.dropTable('carts');
};
