/* eslint-disable camelcase */

/**
 * The string a ticket's QR code actually carries.
 *
 * `qr_code` stays exactly what it was — the ticket's opaque identifier, unique,
 * indexed, and what every lookup and the gate's atomic `UPDATE` still match on.
 * What changes is that the **printed** code is no longer that identifier
 * verbatim but a signed token containing it, so a gate can tell a forgery and a
 * ticket for another event apart from a real one before asking us anything.
 *
 * Stored rather than derived, for one reason: the ticket in somebody's inbox is
 * a picture taken at issue. Re-deriving would produce a different (equally
 * valid) string the day a club edits the event's dates, and then the manifest,
 * the preview and the email would disagree about what the ticket "is" — three
 * answers where a gate needs one.
 *
 * **Nullable, and deliberately not backfilled.** A ticket issued before this
 * has a bare UUID in an email nobody can recall; the app must show that same
 * code, or the screen and the email would scan differently. `qr_token ?? qr_code`
 * is the rendered code, and `parseTicketCode` accepts both.
 *
 * See docs/SIGNED_TICKET_CODES.md.
 */

exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.addColumns('electronic_tickets', {
    qr_token: { type: 'text' },
  });

  /*
   * Not unique. Two tokens can name one ticket — a key rotation re-signs the
   * same identifier — and uniqueness belongs to `qr_code`, which already has
   * it. An index here would be indexing a value nothing looks up by: the gate
   * resolves the token to an identifier first and matches on that.
   */
  pgm.addConstraint('electronic_tickets', 'electronic_tickets_qr_token_length_check', {
    check: 'qr_token IS NULL OR char_length(qr_token) BETWEEN 16 AND 512',
  });
};

exports.down = (pgm) => {
  pgm.dropConstraint('electronic_tickets', 'electronic_tickets_qr_token_length_check');
  pgm.dropColumns('electronic_tickets', ['qr_token']);
};
