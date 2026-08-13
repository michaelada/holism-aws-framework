/* eslint-disable camelcase */

/**
 * Checkout support: Stripe Connect application fees and webhook idempotency.
 *
 * Two things the cart tables from phase 4 do not cover.
 *
 * **1. Where the platform's cut is recorded.** Charges are made on the
 * platform's Stripe account on behalf of the club's connected account, with the
 * handling fee taken as `application_fee_amount`. The amount and the connected
 * account both have to be recorded against the payment, or there is no way to
 * reconcile what the platform earned without querying Stripe.
 *
 * **2. Webhook idempotency.** Stripe retries a webhook until it gets a 2xx, and
 * will send the same event more than once regardless. Without a record of what
 * has already been processed, a retry fulfils an order twice — issuing two
 * entries, or two memberships, for one payment. The table is the guard.
 *
 * The connected account id itself needs no migration: it lives in the `settings`
 * JSONB on `organizations`, at `settings.stripeConnect.accountId` — deliberately
 * NOT under `paymentSettings`, which `updatePaymentSettings` rebuilds wholesale
 * on every save.
 */

exports.up = (pgm) => {
  pgm.addColumns('payments', {
    /** The handling fee taken by the platform, in minor units. */
    application_fee_amount: {
      type: 'integer',
      notNull: true,
      default: 0,
    },
    /**
     * The connected account the funds settled into.
     *
     * Stored per payment rather than read from the organisation at reporting
     * time, because a club that changes or re-onboards its Stripe account must
     * not retroactively rewrite where past payments went.
     */
    provider_account_id: {
      type: 'varchar(255)',
    },
  });

  pgm.createTable('processed_webhook_events', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    /** `stripe`, `helix`, … — the same vocabulary as `payments.payment_provider`. */
    provider: {
      type: 'varchar(50)',
      notNull: true,
    },
    /** The provider's own event id, e.g. Stripe's `evt_...`. */
    event_id: {
      type: 'varchar(255)',
      notNull: true,
    },
    event_type: {
      type: 'varchar(100)',
      notNull: true,
    },
    /**
     * Null when the event arrived for something this platform does not know
     * about — recorded anyway, so a retry of an irrelevant event is still
     * cheap and traceable.
     */
    payment_id: {
      type: 'uuid',
      references: 'payments(id)',
      onDelete: 'SET NULL',
    },
    processed_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('CURRENT_TIMESTAMP'),
    },
  });

  /*
   * The idempotency guard itself. Inserting before doing the work and letting
   * this constraint reject a duplicate is what makes "process exactly once"
   * hold under concurrent retries — checking first and then inserting leaves a
   * window where two workers both see nothing and both fulfil the order.
   */
  pgm.addConstraint(
    'processed_webhook_events',
    'processed_webhook_events_provider_event_unique',
    { unique: ['provider', 'event_id'] }
  );

  pgm.createIndex('processed_webhook_events', 'payment_id');
  // `payments.provider_transaction_id` is already indexed by an earlier
  // migration — creating it again fails the whole migration.
};

exports.down = (pgm) => {
  pgm.dropTable('processed_webhook_events');
  pgm.dropColumns('payments', ['application_fee_amount', 'provider_account_id']);
};
