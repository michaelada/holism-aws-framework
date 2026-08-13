/* eslint-disable camelcase */

/**
 * Give `events` the soft-delete columns its service has always assumed.
 *
 * `event.service.ts` deletes an event by marking it — `UPDATE events SET
 * deleted = TRUE, deleted_at = NOW(), deleted_by = $2` — and both list queries
 * filter `deleted = FALSE`. None of those three columns has ever existed, so
 * every one of those statements fails with `42703 column e.deleted does not
 * exist`:
 *
 *   - `getEventsByOrganisation` → the org-admin events list 500s;
 *   - `account-catalogue.service` → the member-facing catalogue 500s, which is
 *     the account app's Browse screen;
 *   - `deleteEvent` → deleting an event fails outright.
 *
 * **Why add the columns rather than drop the filter.** Deletion here is
 * deliberately reversible and attributed: the service records who removed an
 * event and when. Rewriting it to a hard `DELETE` would satisfy the schema and
 * silently make event removal permanent, destroying the entries and tickets
 * that reference it by foreign key. Restoring the intent is the smaller and
 * safer change.
 *
 * **No convention to follow.** No other table in this database has a `deleted`
 * column — events are the only soft-deleted entity — so the shape here is set
 * by what the service already writes, not by a house style. Anything else that
 * grows a soft delete later should match this.
 *
 * `deleted` is `NOT NULL DEFAULT FALSE` so existing rows become "not deleted",
 * which is true of every one of them, and so the `= FALSE` filters work without
 * needing to handle NULL.
 */

exports.up = (pgm) => {
  pgm.addColumns('events', {
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
      // `event.routes.ts` passes the acting `organisation_users.id`.
      // ON DELETE SET NULL rather than CASCADE: removing an administrator must
      // not remove the record that an event was deleted.
      type: 'uuid',
      notNull: false,
      references: 'organization_users(id)',
      onDelete: 'SET NULL',
    },
  });

  /*
   * Both list queries filter on organisation and the flag together, and both
   * run on every page load of their respective screens.
   */
  pgm.createIndex('events', ['organisation_id', 'deleted']);
};

exports.down = (pgm) => {
  pgm.dropIndex('events', ['organisation_id', 'deleted']);
  pgm.dropColumns('events', ['deleted', 'deleted_at', 'deleted_by']);
};
