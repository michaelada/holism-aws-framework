/* eslint-disable camelcase */

/**
 * Remove capability names that are not capabilities.
 *
 * `organization_types.default_capabilities` and
 * `organizations.enabled_capabilities` are free-form jsonb arrays — nothing
 * constrains them to the `capabilities` catalogue on the way in. The admin API
 * validates on the way *out*, though: every update re-validates the whole list.
 *
 * A record holding a name that is not in the catalogue is therefore **writable
 * once and never editable again**. The failure surfaces far from its cause: a
 * super-admin changing an organisation type's application fee is refused with
 * "Invalid capabilities provided", about names they did not enter and cannot
 * see. That is what happened to `irish-pony-clubs`, which carried `discounts`,
 * `email-notifications` and `document-uploads` — three plausible names that
 * gate nothing and appear in no catalogue.
 *
 * ## Why deleting them is safe
 *
 * A capability is only ever consulted by name: `requireCapability('memberships')`
 * asks whether the list contains it. A name nothing asks about grants nothing,
 * so removing it cannot take a feature away. The three above were confirmed
 * unused across the backend and all four front ends before this was written.
 *
 * The migration is deliberately **general** rather than naming those three: any
 * record carrying an unknown name is in the same unsaveable state, and a
 * deployment that accumulated a different typo deserves the same repair.
 *
 * ## Why there is no constraint
 *
 * Enforcing this in the database would need a trigger per table validating
 * every element against another table. The application already validates on
 * write, the seed now checks itself, and this repairs what predates both — a
 * trigger would add a failure mode without closing a path that is still open.
 */

exports.shorthands = undefined;

exports.up = (pgm) => {
  /*
   * Rebuilt from the elements that survive the filter rather than by removing
   * the known-bad names, so the result is correct whatever a given row holds.
   * `COALESCE` keeps a row whose every capability was unknown as an empty
   * array rather than turning it null.
   */
  pgm.sql(`
    UPDATE organization_types t
    SET default_capabilities = COALESCE((
          SELECT jsonb_agg(value ORDER BY ordinality)
          FROM jsonb_array_elements_text(t.default_capabilities) WITH ORDINALITY AS e(value, ordinality)
          WHERE value IN (SELECT name FROM capabilities)
        ), '[]'::jsonb),
        updated_at = NOW()
    WHERE EXISTS (
      SELECT 1 FROM jsonb_array_elements_text(t.default_capabilities) AS v(value)
      WHERE value NOT IN (SELECT name FROM capabilities)
    )
  `);

  pgm.sql(`
    UPDATE organizations o
    SET enabled_capabilities = COALESCE((
          SELECT jsonb_agg(value ORDER BY ordinality)
          FROM jsonb_array_elements_text(o.enabled_capabilities) WITH ORDINALITY AS e(value, ordinality)
          WHERE value IN (SELECT name FROM capabilities)
        ), '[]'::jsonb),
        updated_at = NOW()
    WHERE EXISTS (
      SELECT 1 FROM jsonb_array_elements_text(o.enabled_capabilities) AS v(value)
      WHERE value NOT IN (SELECT name FROM capabilities)
    )
  `);
};

exports.down = () => {
  /*
   * Deliberately empty.
   *
   * The removed names are not recoverable — nothing recorded which rows held
   * which — and re-adding them would restore records that cannot be saved.
   * There is nothing to go back to that is worth having.
   */
};
