/* eslint-disable camelcase */

/**
 * Two columns that let existing features reach the two capabilities that were
 * missing them.
 *
 * ### `merchandise_types.discount_ids`
 *
 * A club could already **create** merchandise discounts — the pages are there,
 * gated on `merchandise-discounts` — but there was nowhere to record which
 * products a discount applied to. Every other sellable thing carries the same
 * column (`events`, `event_activities`, `membership_types`, `calendars`,
 * `registration_types`, all added in `1709000000008`), and the front ends read
 * it to decide what to offer. Merchandise was the one omission, so its discount
 * pages produced discounts that could never be applied to anything.
 *
 * Shaped identically to the others — a `jsonb` array of discount ids defaulting
 * to `[]` — rather than as a join table, because the services already bind
 * `JSON.stringify(ids || [])` for every other target and a second mechanism
 * would need its own read path in the cart.
 *
 * ### `calendars.display_icon`
 *
 * The name of a Material icon, shown beside the calendar wherever it is
 * offered. A club's bookable things are not interchangeable — a court, an
 * arena and a clubhouse read very differently at a glance — and colour alone
 * does not carry that.
 *
 * A name rather than an uploaded file: the icon set ships with the front ends,
 * so it renders instantly, needs no bucket, and survives offline. Nullable,
 * because a calendar without one is not broken; the screens fall back to a
 * generic marker.
 */

exports.up = (pgm) => {
  pgm.addColumns('merchandise_types', {
    discount_ids: {
      type: 'jsonb',
      notNull: true,
      default: '[]',
    },
  });

  pgm.addColumns('calendars', {
    display_icon: {
      // Long enough for any Material icon name; short enough that it cannot
      // quietly become a store for something else.
      type: 'varchar(64)',
    },
  });
};

exports.down = (pgm) => {
  pgm.dropColumns('merchandise_types', ['discount_ids']);
  pgm.dropColumns('calendars', ['display_icon']);
};
