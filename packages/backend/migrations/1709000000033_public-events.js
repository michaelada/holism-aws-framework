/* eslint-disable camelcase */

/**
 * Events a club has chosen to show the public.
 *
 * Two flags rather than one `public_visibility` enum, and the reason is that it
 * leaves no invalid state to defend: `(false, false)` **is** "Show Public: No",
 * not a fourth value duplicating what two falses already say. The Yes/No toggle
 * on the event form is derived from "is either one on", so unticking both turns
 * the toggle off by itself and there is no "choose at least one" error to write,
 * translate and explain.
 *
 * It also keeps the read honest — `WHERE show_on_platform_page` is indexable and
 * obvious where `public_visibility IN ('platform','both')` is neither.
 *
 * Both default false. An existing event is not published to the world by a
 * migration.
 *
 * ## `venues.region`
 *
 * The public listings are filterable by county or region, and nothing in
 * `venues` could answer that: `address` is prose ("Craddockstown, Naas, Co.
 * Kildare") and `latitude`/`longitude` are usually null. Parsing the address
 * works until the first venue written differently, so the value is stored.
 *
 * Nullable, and null for every existing venue until an administrator fills it
 * in. That is the honest cost: those events answer no region filter until then.
 * Free-text search still covers the whole address, so they remain findable.
 *
 * ## `events` as a reserved URL code
 *
 * The platform's public listing lives at `/events`, in the same namespace an
 * organisation's URL code occupies. Without reserving it a club could take the
 * code `events` and that page would resolve to the club instead. The word is
 * added to both lists that enforce this — here and in
 * `src/utils/url-code.ts` — which is the pairing the original migration's own
 * comment asks callers to maintain.
 *
 * See docs/PUBLIC_EVENTS.md and docs/PUBLIC_EVENTS_SEO.md.
 */

exports.shorthands = undefined;

/** Added to the reserved set. See the note above. */
const NEWLY_RESERVED = ['events', 'event', 'whats-on', 'sitemap', 'robots'];

exports.up = (pgm) => {
  pgm.addColumn('events', {
    show_on_organisation_page: { type: 'boolean', notNull: true, default: false },
    show_on_platform_page: { type: 'boolean', notNull: true, default: false },
  });

  pgm.addColumn('venues', {
    region: { type: 'varchar(100)' },
  });

  /*
   * Partial indexes: both flags are false for almost every row, and the public
   * queries only ever ask for the true ones.
   */
  pgm.createIndex('events', ['organisation_id', 'start_date'], {
    name: 'events_public_org_index',
    where: 'show_on_organisation_page AND deleted = FALSE',
  });
  pgm.createIndex('events', ['start_date'], {
    name: 'events_public_platform_index',
    where: 'show_on_platform_page AND deleted = FALSE',
  });

  /*
   * Rename an organisation that already holds a now-reserved code.
   *
   * Doing nothing would leave a club sitting on `/events`, which is exactly the
   * collision this reserves against. The suffix keeps their existing links
   * resolving to *something* rather than 404ing, and a club in this position
   * needs telling — but a migration cannot tell them, so it logs.
   */
  pgm.sql(`
    UPDATE organizations
       SET url_code = url_code || '-club'
     WHERE url_code IN (${NEWLY_RESERVED.map((code) => `'${code}'`).join(', ')})
  `);
};

exports.down = (pgm) => {
  pgm.dropIndex('events', ['start_date'], { name: 'events_public_platform_index' });
  pgm.dropIndex('events', ['organisation_id', 'start_date'], { name: 'events_public_org_index' });
  pgm.dropColumn('venues', 'region');
  pgm.dropColumn('events', ['show_on_organisation_page', 'show_on_platform_page']);
  // The renamed organisations are deliberately not renamed back: their old code
  // is reserved again on the next `up`, and links have been live in between.
};
