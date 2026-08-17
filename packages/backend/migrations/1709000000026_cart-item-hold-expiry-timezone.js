/* eslint-disable camelcase */

/**
 * Make a hold's expiry an instant rather than a wall-clock reading.
 *
 * `cart_items.expires_at` was `timestamp without time zone`, following the
 * convention `created_at` and `updated_at` set. That is harmless for a column
 * nothing compares, and this one was never compared until baskets started
 * holding slots.
 *
 * Now it is, and the mismatch bites. The API sends a JavaScript `Date`, which
 * node-postgres renders with the server's offset; a `timestamp` column drops
 * that offset and keeps the local reading. `NOW()` in a UTC session is then an
 * hour behind it, so a two-minute hold measured live at **one hour and two
 * minutes**.
 *
 * Worse than the size of the error is its shape: Ireland is UTC+1 in summer and
 * UTC+0 in winter, so holds would have behaved correctly for half the year and
 * held slots for an extra hour for the other half — the kind of fault that gets
 * blamed on anything but the clock.
 *
 * `timestamptz` stores the instant, so the comparison means the same thing
 * whatever zone the API server or the database session is in.
 *
 * `created_at` and `updated_at` are deliberately left alone: they are audit
 * columns nobody compares against `NOW()`, and rewriting the whole table's time
 * convention is a much larger change than this fault calls for.
 */

exports.shorthands = undefined;

exports.up = (pgm) => {
  /*
   * Existing values are naive readings written by an API server whose offset we
   * cannot recover from the row. Reading them as UTC is the safe choice: it can
   * only make a stale hold expire sooner, never hold a slot for longer than it
   * should. Holds live for minutes, so nothing meaningful is being converted.
   */
  pgm.alterColumn('cart_items', 'expires_at', {
    type: 'timestamptz',
    using: "expires_at AT TIME ZONE 'UTC'",
  });
};

exports.down = (pgm) => {
  pgm.alterColumn('cart_items', 'expires_at', {
    type: 'timestamp',
    using: "expires_at AT TIME ZONE 'UTC'",
  });
};
