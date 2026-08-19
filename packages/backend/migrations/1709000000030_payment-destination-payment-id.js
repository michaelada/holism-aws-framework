/* eslint-disable camelcase */

/**
 * The one identifier that ties a club's lodgement back to what was bought.
 *
 * A Connect destination charge produces **two** charge objects for a single
 * payment. The platform sees `ch_…` under the PaymentIntent we already store in
 * `provider_transaction_id`. The club's connected account sees its own `py_…` —
 * and that is the one, and the only one, that appears in the club's payout.
 *
 * Nothing on the club-side charge names our payment. Stripe does not copy
 * PaymentIntent metadata onto a destination payment, so reconciling a payout
 * otherwise means walking
 *
 *     py_… → source_transfer tr_… → source_transaction ch_… → payment_intent pi_…
 *
 * which is three API calls for every payment in the payout — 150 of them for a
 * payout of fifty. Storing the club-side id once turns opening a lodgement into
 * a single `WHERE provider_destination_payment_id = ANY($1)`.
 *
 * A column and not a `metadata` key precisely because it is looked up in bulk:
 * a few hundred ids matched against the table at once, which wants an index.
 *
 * Nullable, and expected to stay null for two legitimate cases: offline
 * payments, which never touch Stripe, and anything taken before this column
 * existed. The lodgements service resolves the latter lazily the first time a
 * payout containing them is opened, and writes the answer back here — so the
 * backfill happens where someone is actually looking, rather than as a
 * migration that walks every historical payment against a rate-limited API.
 *
 * See docs/LODGEMENTS.md §3.
 */

exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.addColumn('payments', {
    provider_destination_payment_id: { type: 'varchar(255)' },
  });

  /*
   * Partial: the column is null for every offline payment and for anything
   * predating it, and none of those rows can ever be the target of the lookup.
   */
  pgm.createIndex('payments', 'provider_destination_payment_id', {
    name: 'payments_destination_payment_id_index',
    where: 'provider_destination_payment_id IS NOT NULL',
  });
};

exports.down = (pgm) => {
  pgm.dropIndex('payments', 'provider_destination_payment_id', {
    name: 'payments_destination_payment_id_index',
  });
  pgm.dropColumn('payments', 'provider_destination_payment_id');
};
