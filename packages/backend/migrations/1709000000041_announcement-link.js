/* eslint-disable camelcase */

/**
 * An announcement can point somewhere.
 *
 * "Summer camp booking is open" is only half a notice if the member then has to
 * find the camps page themselves. The platform's own posts have carried links
 * from the start; this is the same idea one tier down, for a club talking to its
 * own members.
 *
 * ## One link, not a list
 *
 * `platform_posts.links` is a JSONB array, because a release note may well point
 * at three things. A club notice points at the thing it is about — the booking
 * page, the fixture list, the form — and a list would buy a rarely-used degree
 * of freedom at the cost of a repeating sub-form on the editor and an array to
 * validate on the way in. Two columns say exactly what a single link is, and
 * the constraint below can then enforce the one rule that matters.
 *
 * If a second link is ever genuinely wanted, this becomes a JSONB column and the
 * two values move into it; nothing outside the service reads the columns.
 *
 * ## Both or neither
 *
 * A label with no URL is a button that does nothing; a URL with no label is a
 * link with nothing to click. Enforced in the database as well as in the
 * service, because these two columns can be set by anything that can write the
 * row and there is no sensible thing to render for half a link.
 *
 * See docs/ORG_ANNOUNCEMENTS.md.
 */

exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.addColumns('organisation_announcements', {
    /** The words on the button — "Book a place", not the URL. */
    link_label: { type: 'varchar(120)' },
    /**
     * Where it goes. `http`/`https` only, refused on write by the service.
     *
     * 2048 characters because that is the practical ceiling browsers agree on;
     * a club pasting a long tracking URL should not be truncated into a link
     * that leads somewhere else.
     */
    link_url: { type: 'varchar(2048)' },
  });

  pgm.addConstraint('organisation_announcements', 'organisation_announcements_link_check', {
    check: '(link_label IS NULL) = (link_url IS NULL)',
  });
};

exports.down = (pgm) => {
  pgm.dropConstraint('organisation_announcements', 'organisation_announcements_link_check');
  pgm.dropColumns('organisation_announcements', ['link_label', 'link_url']);
};
