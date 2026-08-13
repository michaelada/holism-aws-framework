/* eslint-disable camelcase */

/**
 * Soft delete for the remaining things an organisation configures and sells:
 * merchandise types, membership types, registration types and calendars.
 *
 * All four were hard `DELETE`s. That is the wrong shape for anything a member
 * may already have bought or booked against: `merchandise_orders`, `members`,
 * `registrations` and `bookings` all reference these rows, so removing one
 * either fails on a foreign key or takes the history with it. An organisation
 * that stops offering a membership type still needs last season's members to
 * have a membership type.
 *
 * Follows `events` (migration 1709000000017), which was the first table to work
 * this way — same three columns, same `organisation_id`-paired index, same
 * `organization_users` reference for attribution.
 *
 * **Deliberately not included: `bookings`.** A booking already has
 * `booking_status`, `cancelled_at`, `cancelled_by` and `cancellation_reason`,
 * and `cancelBookingWithRefund` uses them. Adding `deleted` beside that would
 * create a second, competing answer to "is this booking still real?", and every
 * query would have to remember both. Cancellation is the domain's own soft
 * delete and it carries more information than a boolean.
 *
 * `deleted` is `NOT NULL DEFAULT FALSE`, so every existing row reads as live —
 * which it is — and the `= FALSE` filters need no NULL handling.
 */

const TABLES = ['merchandise_types', 'membership_types', 'registration_types', 'calendars'];

exports.up = (pgm) => {
  for (const table of TABLES) {
    pgm.addColumns(table, {
      deleted: {
        type: 'boolean',
        notNull: true,
        default: false,
      },
      deleted_at: {
        type: 'timestamp',
        notNull: false,
      },
      deleted_by: {
        // The acting organisation user, as `events.deleted_by` records.
        // SET NULL, not CASCADE: losing an administrator must not erase the
        // record that something was withdrawn.
        type: 'uuid',
        notNull: false,
        references: 'organization_users(id)',
        onDelete: 'SET NULL',
      },
    });

    // Every list query for these filters by organisation and the flag together.
    pgm.createIndex(table, ['organisation_id', 'deleted']);
  }
};

exports.down = (pgm) => {
  for (const table of TABLES) {
    pgm.dropIndex(table, ['organisation_id', 'deleted']);
    pgm.dropColumns(table, ['deleted', 'deleted_at', 'deleted_by']);
  }
};
