/* eslint-disable camelcase */

/**
 * Who may enter an activity, and who an entry is actually for.
 *
 * Two columns for one feature, because a members-only activity raises a second
 * question the schema could not previously answer. A login may hold several
 * memberships — a parent holds their children's, which the account dashboard
 * already treats as the normal case — so "this account may enter" and "this
 * person is entered" stop being the same statement.
 *
 * ## `entry_eligibility`
 *
 * Defaults to `'all'`, which is exactly today's behaviour, so every existing
 * activity is unchanged and no backfill is needed. A club that never turns this
 * on never notices it.
 *
 * A constrained varchar rather than a boolean `members_only`. The question is
 * "who can enter", and the honest answer today has two values but is the kind
 * that grows — a club will eventually ask for a particular membership type, or
 * for a named group. A boolean forces that future change to either add a second
 * flag that can contradict the first, or migrate live data out of a column name
 * that has become a lie.
 *
 * ## `event_entries.member_id`
 *
 * Which membership the entry was made against. Null for every open-entry
 * activity, which is most of them, and null for everything that already exists.
 *
 * `ON DELETE SET NULL`, not `CASCADE`: removing a membership record must never
 * remove an entry. The person turned up and rode; the club's record of that is
 * not contingent on the membership still being on file, and a cascade here would
 * quietly delete history as a side effect of tidying a member list.
 *
 * See docs/MEMBERS_ONLY_ENTRIES.md.
 */

exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.addColumn('event_activities', {
    entry_eligibility: {
      type: 'varchar(20)',
      notNull: true,
      default: 'all',
    },
  });

  pgm.addConstraint('event_activities', 'event_activities_entry_eligibility_check', {
    check: "entry_eligibility IN ('all', 'members')",
  });

  pgm.addColumn('event_entries', {
    member_id: {
      type: 'uuid',
      references: 'members',
      onDelete: 'SET NULL',
    },
  });

  /*
   * Partial, and this is the index the duplicate check reads.
   *
   * "Already entered" becomes per member for members-only activities, so the
   * question asked on every entry attempt is "does a row exist for this
   * activity and this member". Null for open activities, which can never be the
   * target of that lookup.
   */
  pgm.createIndex('event_entries', ['event_activity_id', 'member_id'], {
    name: 'event_entries_activity_member_index',
    where: 'member_id IS NOT NULL',
  });
};

exports.down = (pgm) => {
  pgm.dropIndex('event_entries', ['event_activity_id', 'member_id'], {
    name: 'event_entries_activity_member_index',
  });
  pgm.dropColumn('event_entries', 'member_id');
  pgm.dropConstraint('event_activities', 'event_activities_entry_eligibility_check');
  pgm.dropColumn('event_activities', 'entry_eligibility');
};
