/* eslint-disable camelcase */

/**
 * `include_event_logo` never showed anybody a logo.
 *
 * The column, the DTOs and two checkboxes existed — one on the event form, one
 * on the ticketing settings — and no ticket template ever drew a logo. The one
 * template that *could* have took a `logoURL` that nothing passed, so a club
 * that ticked the box saw a ticket identical to the one it had before.
 *
 * The ticket **image**, with its four placements, is what the setting was
 * reaching for, and it arrived in `1709000000042_ticket-design`. Two ways to
 * put a picture on a ticket — one of which does nothing — is worse than one.
 *
 * The `down` restores the column, defaulted off. The booleans themselves are
 * not restored, and losing them costs nothing: nothing ever read them.
 */

exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.dropColumns('event_ticketing_config', ['include_event_logo']);
};

exports.down = (pgm) => {
  pgm.addColumns('event_ticketing_config', {
    include_event_logo: { type: 'boolean', default: false },
  });
};
