/**
 * Migration: Columns the services already write but the schema never had
 *
 * Six tables were missing columns that their services INSERT and SELECT, so
 * those create and update paths failed with `column ... does not exist`.
 * Concretely, creating an event, an event activity, a membership type, a
 * registration type or a calendar was broken, as was storing an account user's
 * phone number.
 *
 * The service code and the org-admin forms are the specification here — every
 * type below is taken from an existing column of the same name elsewhere in the
 * schema, not invented:
 *
 *   discount_ids               jsonb, default '[]'   services bind JSON.stringify(ids || [])
 *   supported_payment_methods  jsonb, default '[]'   as on the other four sellable types
 *   fee                        decimal(10,2)         as on event_activities.fee
 *   application_form_id        uuid                  as on event_activities / merchandise_types
 *   event_type_id / venue_id   uuid                  plain uuid; see the note below
 *   phone                      varchar(50)           as on organizations.contact_mobile
 *
 * Note on money: `fee` here is `decimal(10,2)`, matching the existing domain
 * tables. The newer cart tables use integer minor units. The two must be
 * converted at the boundary, never mixed.
 *
 * Note on event_activities: the table has both `allowed_payment_method`
 * (varchar, the original single-method form) and now `supported_payment_methods`
 * (jsonb, what the service and form actually use). The old column is left in
 * place rather than dropped — nothing reads it, but removing it is a separate
 * decision from making the code work.
 */

exports.shorthands = undefined;

const JSONB_ARRAY = { type: 'jsonb', notNull: true, default: '[]' };

exports.up = (pgm) => {
  pgm.addColumns('events', {
    discount_ids: { ...JSONB_ARRAY },
    event_type_id: { type: 'uuid' },
    venue_id: { type: 'uuid' },
  });

  pgm.addColumns('event_activities', {
    discount_ids: { ...JSONB_ARRAY },
    supported_payment_methods: { ...JSONB_ARRAY },
  });

  pgm.addColumns('membership_types', {
    discount_ids: { ...JSONB_ARRAY },
    fee: { type: 'decimal(10,2)', notNull: true, default: 0 },
  });

  pgm.addColumns('registration_types', {
    discount_ids: { ...JSONB_ARRAY },
    fee: { type: 'decimal(10,2)', notNull: true, default: 0 },
  });

  pgm.addColumns('calendars', {
    discount_ids: { ...JSONB_ARRAY },
    application_form_id: { type: 'uuid' },
  });

  pgm.addColumns('organization_users', {
    phone: { type: 'varchar(50)' },
  });

  // No foreign keys on event_type_id / venue_id: the `event_types` and
  // `venues` tables do not exist. Their services, org-admin pages and
  // capabilities all do, but no migration ever created them — see the schema
  // audit in docs/SCHEMA_DRIFT_AUDIT.md. Plain uuid columns match how
  // `application_form_id` is already handled on event_activities and
  // merchandise_types, so this is the schema's existing convention rather than
  // a workaround invented here. Add the constraints when the tables land.
  pgm.createIndex('events', 'event_type_id');
  pgm.createIndex('events', 'venue_id');
};

exports.down = (pgm) => {
  pgm.dropIndex('events', 'event_type_id');
  pgm.dropIndex('events', 'venue_id');

  pgm.dropColumns('organization_users', ['phone']);
  pgm.dropColumns('calendars', ['discount_ids', 'application_form_id']);
  pgm.dropColumns('registration_types', ['discount_ids', 'fee']);
  pgm.dropColumns('membership_types', ['discount_ids', 'fee']);
  pgm.dropColumns('event_activities', ['discount_ids', 'supported_payment_methods']);
  pgm.dropColumns('events', ['discount_ids', 'event_type_id', 'venue_id']);
};
