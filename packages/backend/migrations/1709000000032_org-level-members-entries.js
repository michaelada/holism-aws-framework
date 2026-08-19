/* eslint-disable camelcase */

/**
 * Entries open to members of every club in the same organisation type.
 *
 * A third answer to "who can enter", for federated bodies — a pony club branch
 * running a rally that any branch's members may enter, a county board's open
 * competition. The organisation type is the federation: every club under
 * `irish-pony-clubs` is a branch of the same thing, and this says "my members"
 * means all of theirs too.
 *
 * ## Two separate switches, deliberately
 *
 * `organisation-level-members` is a **capability**, granted per organisation by
 * a super admin, and it only decides whether the option is *offered*. The
 * activity's own `entry_eligibility` decides whether it is *used*. A club can
 * hold the capability and still run every activity for its own members only.
 *
 * Not a default capability: it changes who may enter a club's events, which is
 * the club's decision to be given rather than one to discover it already has.
 *
 * ## Why the constraint is replaced rather than widened in place
 *
 * Postgres has no "alter check constraint". Dropping and recreating is the only
 * route, and doing it in one migration keeps the table from ever being
 * unconstrained — a window in which a bad write could land a value that the new
 * constraint then refuses to let anyone fix.
 *
 * See docs/MEMBERS_ONLY_ENTRIES.md §7.
 */

exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.dropConstraint('event_activities', 'event_activities_entry_eligibility_check');
  pgm.addConstraint('event_activities', 'event_activities_entry_eligibility_check', {
    check: "entry_eligibility IN ('all', 'members', 'org-type-members')",
  });

  /*
   * Seeded onto no organisation.
   *
   * Granting it here would hand every club the ability to open its events to
   * other clubs' members without anyone having decided that — and the clubs
   * whose members gained entry would not have been asked either.
   */
  pgm.sql(`
    INSERT INTO capabilities (name, display_name, description, category)
    SELECT 'organisation-level-members',
           'Organisation Level Members',
           'Lets this organisation open event entries to members of every organisation of the same type.',
           'additional-feature'
    WHERE NOT EXISTS (SELECT 1 FROM capabilities WHERE name = 'organisation-level-members')
  `);
};

exports.down = (pgm) => {
  /*
   * Activities using the third option are returned to "members only" rather
   * than to "open to all". Rolling back must never *widen* who may enter a
   * club's event — a migration that quietly threw an event open to the public
   * would be a far worse outcome than one that closed it too far.
   */
  pgm.sql(`
    UPDATE event_activities
       SET entry_eligibility = 'members'
     WHERE entry_eligibility = 'org-type-members'
  `);

  pgm.dropConstraint('event_activities', 'event_activities_entry_eligibility_check');
  pgm.addConstraint('event_activities', 'event_activities_entry_eligibility_check', {
    check: "entry_eligibility IN ('all', 'members')",
  });

  /*
   * Capabilities are a jsonb list on the organisation, not a join table, so
   * withdrawing one means rewriting the array minus that element.
   */
  pgm.sql(`
    UPDATE organizations
       SET enabled_capabilities = COALESCE(
             (SELECT jsonb_agg(value)
                FROM jsonb_array_elements(enabled_capabilities) AS value
               WHERE value <> '"organisation-level-members"'::jsonb),
             '[]'::jsonb
           )
     WHERE enabled_capabilities @> '["organisation-level-members"]'::jsonb
  `);
  pgm.sql(`DELETE FROM capabilities WHERE name = 'organisation-level-members'`);
};
