/* eslint-disable camelcase */

/**
 * Organisation status becomes two states: `active` and `inactive`.
 *
 * ### Why `blocked` is going
 *
 * The column allowed three values but nothing in the system ever distinguished
 * two of them. Every gate — the public club directory, the lookup by
 * `url_code`, a member's organisation list, `/me` — tested `status = 'active'`,
 * so `inactive` and `blocked` produced byte-for-byte identical behaviour. The
 * only place they differed was the admin UI, which coloured one grey and the
 * other red and so implied a severity the platform did not implement.
 *
 * A distinction that exists only in a chip colour is worse than no distinction:
 * an operator reasonably assumes "blocked" is more forceful than "inactive",
 * and acts on that belief. Collapsing to two states makes the model honest.
 *
 * ### What `inactive` now means
 *
 * Nobody can reach the organisation. Members cannot see it in the directory,
 * its `/account/:code` link does not resolve, and — new in this change — its
 * administrators cannot sign in to the org-admin area either. Setting it back
 * to `active` restores all of that. Nothing is deleted.
 *
 * This is also what replaces deleting an organisation, which is no longer
 * offered: see docs/ORGANISATION_STATUS_AND_DEACTIVATION.md.
 *
 * ### The constraint
 *
 * The column was a bare `varchar(50)` with no `CHECK`, which is how a third
 * value was able to accumulate meaning it never had. Constraining it now means
 * a fourth cannot appear the same way.
 */

exports.up = (pgm) => {
  // Anything blocked was, in behavioural terms, already inactive. This renames
  // it rather than changing what it does.
  pgm.sql(`UPDATE organizations SET status = 'inactive' WHERE status = 'blocked'`);

  // Defensive: a NULL status would fail the constraint below, and the column
  // has only ever had a default rather than NOT NULL.
  pgm.sql(`UPDATE organizations SET status = 'active' WHERE status IS NULL`);

  pgm.addConstraint('organizations', 'organizations_status_valid', {
    check: "status IN ('active', 'inactive')",
  });
};

exports.down = (pgm) => {
  pgm.dropConstraint('organizations', 'organizations_status_valid');
  // Deliberately not restoring `blocked` on the way down: which of the
  // organisations now marked inactive had been blocked is not recoverable, and
  // guessing would be worse than leaving them all inactive — which is exactly
  // how they behaved either way.
};
