/**
 * Migration: `handling_fee_included` on the remaining sellable types
 *
 * The cart rules apply the "fee included / fee added on" distinction to entry,
 * membership, calendar, registration *and* merchandise fees. Only
 * `event_activities` had the flag; the other four tables carried
 * `supported_payment_methods` but no way to say whether their fee already
 * absorbs the card handling fee.
 *
 * Defaults to false — "the handling fee is added on top" — which matches the
 * existing behaviour of `event_activities` and is the safer default: an
 * organisation that meant to absorb the fee will notice the extra line, whereas
 * defaulting to true would quietly leave them out of pocket on every sale.
 *
 * See G4 in docs/ACCOUNT_USER_APP_WIREFRAMES.md.
 */

exports.shorthands = undefined;

const TABLES = [
  'membership_types',
  'registration_types',
  'merchandise_types',
  'calendars',
];

exports.up = (pgm) => {
  TABLES.forEach((table) => {
    pgm.addColumns(table, {
      handling_fee_included: {
        type: 'boolean',
        notNull: true,
        default: false,
      },
    });
  });
};

exports.down = (pgm) => {
  TABLES.forEach((table) => {
    pgm.dropColumns(table, ['handling_fee_included']);
  });
};
