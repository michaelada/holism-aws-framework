/* eslint-disable camelcase */

/**
 * A club's own announcements, shown to its members when they sign in.
 *
 * `platform_posts` — the super admin's notices on the two login pages — said
 * this table was coming: *"an organisation's own announcements, if they are
 * ever wanted, are a different table with a tenancy column and a different
 * audience."* This is that table. The audience is the difference that matters:
 * a platform post is read by everybody signing in to the product, and one of
 * these is read only by the members of one club, on a screen they have signed
 * in to reach.
 *
 * ## The window is the only control
 *
 * There is no draft or published flag. `starts_at` and `ends_at` decide
 * everything: an announcement that starts tomorrow is not showing today, and
 * one whose end has passed is gone without anybody remembering to take it down.
 * A status column alongside would mean publishing is two facts that can
 * disagree — a club would take a notice down by unticking a box, and then have
 * to remember what the dates were to put it back.
 *
 * Both are `notNull`, and the check constraint refuses a window that ends
 * before it begins: such a row can never be shown, so nothing downstream would
 * ever report it as wrong.
 *
 * ## The image is a key, not a URL
 *
 * The same choice `platform_posts` made, for the same reason: a URL belongs to
 * a deployment, and a bucket rename or a move to a CDN would rewrite every row.
 * The key is the durable fact and the URL is derived at read time — here a
 * signed one, because a club's notices are for its members rather than for
 * anyone holding an id.
 *
 * See docs/ORG_ANNOUNCEMENTS.md.
 */

exports.shorthands = undefined;

exports.up = (pgm) => {
  /*
   * The capability, in the table that defines what a capability *is*.
   *
   * `1709000000027_strip-unknown-capabilities` deletes any name from an
   * organisation that does not appear here, so a capability that skips this row
   * would be silently removed from every organisation it was granted to.
   */
  pgm.sql(`
    INSERT INTO capabilities (name, display_name, description, category, is_active)
    VALUES (
      'org-announcements',
      'Org Announcements',
      'Post announcements shown to members on their home page',
      'additional-feature',
      true
    )
    ON CONFLICT (name) DO NOTHING
  `);

  pgm.createTable('organisation_announcements', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    organisation_id: {
      type: 'uuid',
      notNull: true,
      references: 'organizations',
      onDelete: 'CASCADE',
    },
    title: { type: 'varchar(255)', notNull: true },
    /*
     * HTML from the same rich-text editor the rest of the org-admin uses, and
     * rendered through the shared `RichText`, which sanitises on the way out.
     * Sanitising on the way in would silently destroy content the author can
     * still see in the editor they typed it into.
     */
    description: { type: 'text', notNull: true, default: '' },
    starts_at: { type: 'timestamp', notNull: true },
    ends_at: { type: 'timestamp', notNull: true },
    image_key: { type: 'varchar(500)' },
    image_mime: { type: 'varchar(100)' },
    /**
     * How the image is used: as the card's background, above the text, or
     * below it.
     *
     * Null where there is no image, rather than defaulted — a card claiming a
     * background it has no picture for is a state the renderer would have to
     * second-guess.
     */
    image_placement: { type: 'varchar(20)' },
    /**
     * Who wrote it, as an `organization_users` row.
     *
     * Nullable and `ON DELETE SET NULL`: an announcement outlives the
     * administrator who wrote it, and losing the notice because somebody left
     * the committee would be the wrong end of the trade.
     */
    created_by: { type: 'uuid', references: 'organization_users', onDelete: 'SET NULL' },
    created_at: { type: 'timestamp', notNull: true, default: pgm.func('CURRENT_TIMESTAMP') },
    updated_at: { type: 'timestamp', notNull: true, default: pgm.func('CURRENT_TIMESTAMP') },
  });

  pgm.addConstraint('organisation_announcements', 'organisation_announcements_window_check', {
    check: 'ends_at > starts_at',
  });

  pgm.addConstraint('organisation_announcements', 'organisation_announcements_placement_check', {
    check: "image_placement IS NULL OR image_placement IN ('background', 'header', 'footer')",
  });

  /*
   * The index the members' home page uses.
   *
   * Every account read is "this club's announcements whose window contains
   * now", and it runs on every sign-in of every member of every club that has
   * the capability — by some distance the most frequent read this table will
   * ever see.
   */
  pgm.createIndex('organisation_announcements', ['organisation_id', 'starts_at', 'ends_at'], {
    name: 'organisation_announcements_window_index',
  });
};

exports.down = (pgm) => {
  pgm.dropTable('organisation_announcements');
  pgm.sql(`DELETE FROM capabilities WHERE name = 'org-announcements'`);
  pgm.sql(`
    UPDATE organizations
    SET enabled_capabilities = enabled_capabilities - 'org-announcements'
    WHERE enabled_capabilities ? 'org-announcements'
  `);
  pgm.sql(`
    UPDATE organization_types
    SET default_capabilities = default_capabilities - 'org-announcements'
    WHERE default_capabilities ? 'org-announcements'
  `);
};
