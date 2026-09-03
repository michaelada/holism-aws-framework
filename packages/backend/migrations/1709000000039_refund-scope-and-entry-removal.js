/**
 * Refunding part of a payment, and what that does to what it bought.
 *
 * Three things the schema could not express:
 *
 *  - **Which lines a refund covered.** `refunds` recorded an amount against a
 *    payment and nothing else, so "refund this entry" and "refund €25 of it"
 *    were the same record — and neither could be prevented from being done
 *    twice.
 *  - **Why a payment is short.** A payment part-refunded had no status of its
 *    own: it stayed `paid`, which reads as untouched.
 *  - **An entry that is no longer coming.** Refunding an entry left it on the
 *    entrant list, so a club printing a class list got a rider who had been
 *    refunded. Deleting it would lose the record of a real entry that was
 *    really paid for and really refunded.
 *
 * See docs/PARTIAL_REFUNDS.md.
 */

exports.shorthands = undefined;

exports.up = (pgm) => {
  /*
   * How the amount was arrived at, rather than only what it was.
   *
   * `full` and `less_handling_fee` settle the payment; `items` and `amount` are
   * partial and can be repeated until the payment is covered. Knowing which is
   * what lets the payment take the right status without inferring it from
   * arithmetic that cannot tell "everything" from "everything that was left".
   */
  pgm.addColumns('refunds', {
    refund_scope: { type: 'varchar(30)', notNull: true, default: 'full' },
  });

  /**
   * Which lines a refund covered.
   *
   * A join table rather than a column on either side: one refund can cover
   * several lines, and one line can be refunded in parts over time — a member
   * who withdraws one of two children from a class refunds one line, and the
   * hoodie may go back a week later.
   */
  pgm.createTable('refund_transactions', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    refund_id: {
      type: 'uuid',
      notNull: true,
      references: 'refunds',
      onDelete: 'CASCADE',
    },
    payment_transaction_id: {
      type: 'uuid',
      notNull: true,
      references: 'payment_transactions',
      onDelete: 'CASCADE',
    },
    /** Minor units, as `payment_transactions.fee` holds it. */
    amount: { type: 'integer', notNull: true },
    created_at: { type: 'timestamp', notNull: true, default: pgm.func('CURRENT_TIMESTAMP') },
  });

  pgm.createIndex('refund_transactions', 'refund_id');
  pgm.createIndex('refund_transactions', 'payment_transaction_id');

  /*
   * An entry that has been refunded and withdrawn.
   *
   * `entry_status`, not a `deleted` flag: the entry happened, was paid for and
   * was refunded, and all three are worth keeping. It simply stops appearing on
   * the entrant list — which is the list a club prints on the day.
   */
  pgm.addColumns('event_entries', {
    entry_status: { type: 'varchar(20)', notNull: true, default: 'active' },
    removed_at: { type: 'timestamp' },
    removed_by: { type: 'uuid', references: 'organization_users' },
    removal_reason: { type: 'text' },
  });

  pgm.createIndex('event_entries', ['event_id', 'entry_status']);
};

exports.down = (pgm) => {
  pgm.dropIndex('event_entries', ['event_id', 'entry_status']);
  pgm.dropColumns('event_entries', ['entry_status', 'removed_at', 'removed_by', 'removal_reason']);
  pgm.dropTable('refund_transactions');
  pgm.dropColumns('refunds', ['refund_scope']);
};
