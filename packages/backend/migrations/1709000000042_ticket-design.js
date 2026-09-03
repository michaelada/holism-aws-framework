/* eslint-disable camelcase */

/**
 * What a club's ticket looks like.
 *
 * The configuration already carried words — a header, instructions, a footer —
 * and a background colour. This adds the two things a club actually asks for
 * when it looks at a plain ticket: **a picture**, and **a choice of layout**.
 *
 * ## The image is a key, and the placement is separate
 *
 * The same shape as `organisation_announcements`, deliberately: the S3 key
 * rather than a URL, because a URL belongs to a deployment and a bucket rename
 * would rewrite every row; and the placement in its own column, null where
 * there is no image, so a ticket cannot claim a background it has no picture
 * for.
 *
 * `top_right` is the one placement announcements do not have. A ticket is a
 * denser thing than a notice — it has a code, a reference and a name that must
 * all be legible — and a small mark beside the title is often all the room a
 * club's logo should take.
 *
 * ## Why a layout column rather than a stylesheet
 *
 * The three layouts differ in *arrangement*, not in styling: where the code
 * sits relative to the words, and whether the descriptions are shown in full.
 * A club picks one; the renderer knows what each means. Storing CSS would put a
 * stylesheet in a database column and make the ticket unrenderable by anything
 * that is not a browser — the same trap the PDF template already sidesteps.
 *
 * See docs/TICKET_DESIGN.md.
 */

exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.addColumns('event_ticketing_config', {
    ticket_image_key: { type: 'varchar(500)' },
    ticket_image_mime: { type: 'varchar(100)' },
    /** `header` | `footer` | `topRight` | `background`. Null with no image. */
    ticket_image_placement: { type: 'varchar(20)' },
    /**
     * `stacked` | `sideBySide` | `compact`.
     *
     * Defaulted rather than nullable: every ticket has a layout, and `stacked`
     * is what every ticket printed before this existed looked like — so a club
     * that never opens this screen sees no change.
     */
    ticket_layout: { type: 'varchar(20)', notNull: true, default: 'stacked' },
  });

  pgm.addConstraint('event_ticketing_config', 'event_ticketing_config_image_placement_check', {
    check:
      "ticket_image_placement IS NULL OR ticket_image_placement IN ('header', 'footer', 'topRight', 'background')",
  });

  pgm.addConstraint('event_ticketing_config', 'event_ticketing_config_layout_check', {
    check: "ticket_layout IN ('stacked', 'sideBySide', 'compact')",
  });
};

exports.down = (pgm) => {
  pgm.dropConstraint('event_ticketing_config', 'event_ticketing_config_layout_check');
  pgm.dropConstraint('event_ticketing_config', 'event_ticketing_config_image_placement_check');
  pgm.dropColumns('event_ticketing_config', [
    'ticket_image_key',
    'ticket_image_mime',
    'ticket_image_placement',
    'ticket_layout',
  ]);
};
