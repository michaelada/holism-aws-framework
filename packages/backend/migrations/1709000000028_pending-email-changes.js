/* eslint-disable camelcase */

/**
 * An email change that has been asked for but not yet proved.
 *
 * An account user's Keycloak **username is their email address**, so changing
 * the address changes the credential they sign in with. A mistyped address is
 * therefore not a misdirected newsletter — it is a login the member does not
 * own, and a password reset that can never reach them.
 *
 * So the change waits here until a link sent to the new address is followed.
 * Until then the member signs in exactly as before, and a typo costs them an
 * email that never arrives rather than their account.
 *
 * See docs/ACCOUNT_SELF_SERVICE_CREDENTIALS.md.
 */

exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.createTable('pending_email_changes', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },

    /*
     * The identity, not one club's row for it. A member of four clubs has four
     * `organization_users` rows and one address; the change applies to all of
     * them, and keying this on a single row would make "which one asked?" a
     * question the confirmation has to answer for no benefit.
     */
    keycloak_user_id: { type: 'text', notNull: true },

    new_email: { type: 'text', notNull: true },

    /*
     * A SHA-256 of the token, never the token. Anyone able to read this table —
     * through a backup, a support query, a log — must not be able to complete a
     * change they did not request.
     */
    token_hash: { type: 'text', notNull: true },

    requested_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },

    /*
     * `timestamptz`, not `timestamp`, because this is compared against `NOW()`.
     * The same fault as the hold expiry (1709000000026): a naive column keeps a
     * wall-clock reading, so the comparison is correct only while the server's
     * offset happens to be zero.
     */
    expires_at: { type: 'timestamptz', notNull: true },

    /** Set in the same transaction that applies the change, so a link works once. */
    consumed_at: { type: 'timestamptz' },
  });

  pgm.createIndex('pending_email_changes', 'token_hash');

  /*
   * One live request per identity. Asking again supersedes the last one —
   * two valid tokens for two different addresses is a question with no good
   * answer, and the service deletes the earlier row rather than relying on this
   * alone. The constraint is what makes that guarantee rather than a habit.
   */
  pgm.createIndex('pending_email_changes', 'keycloak_user_id', {
    unique: true,
    where: 'consumed_at IS NULL',
    name: 'pending_email_changes_one_live_per_user',
  });
};

exports.down = (pgm) => {
  pgm.dropTable('pending_email_changes');
};
