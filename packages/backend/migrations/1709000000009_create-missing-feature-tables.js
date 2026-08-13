/**
 * Migration: Tables whose services and UI shipped without them
 *
 * Nine tables were referenced by service code — and in most cases by org-admin
 * pages and a capability flag — but no migration ever created them. Every code
 * path reaching one of them failed at the database.
 *
 * Sources, in order of authority:
 *
 *   discounts, discount_applications, discount_usage
 *       Specified in docs/DISCOUNT_SYSTEM_PROPOSAL.md. Taken from there, with
 *       the table names corrected to the ones this schema actually uses
 *       (`organizations`, `organization_users` — the proposal wrote the British
 *       spelling and referenced the `account_users` view, which matches nothing).
 *
 *   event_types, venues, slot_reservations, membership_number_sequences,
 *   user_groups, user_group_members
 *       Derived from the columns their services INSERT, SELECT and map in their
 *       row-to-object functions. Nothing here is speculative: every column is
 *       one the code already reads or writes.
 *
 * Note on `organisation_id`: these tables use the British spelling for the
 * column because that is what the services query, while the `organizations`
 * table itself is American. That inconsistency predates this migration and is
 * followed rather than fixed, since changing it would break the services this
 * is meant to unblock.
 *
 * See docs/SCHEMA_DRIFT_AUDIT.md.
 */

exports.shorthands = undefined;

const ID = { type: 'uuid', primaryKey: true, default: 'gen_random_uuid()' };
const CREATED = { type: 'timestamp', notNull: true, default: 'CURRENT_TIMESTAMP' };

exports.up = (pgm) => {
  const id = { ...ID, default: pgm.func('gen_random_uuid()') };
  const created_at = { ...CREATED, default: pgm.func('CURRENT_TIMESTAMP') };
  const updated_at = { ...CREATED, default: pgm.func('CURRENT_TIMESTAMP') };
  const orgRef = {
    type: 'uuid',
    notNull: true,
    references: 'organizations(id)',
    onDelete: 'CASCADE',
  };

  // ---------------------------------------------------------------- events

  pgm.createTable('event_types', {
    id,
    organisation_id: orgRef,
    name: { type: 'varchar(255)', notNull: true },
    description: { type: 'text' },
    created_at,
    updated_at,
  });
  // The service turns 23505 into "an event type with this name already exists
  // for this organisation", so that constraint has to exist for the message to
  // ever appear.
  pgm.addConstraint('event_types', 'event_types_name_unique_per_org', {
    unique: ['organisation_id', 'name'],
  });
  pgm.createIndex('event_types', 'organisation_id');

  pgm.createTable('venues', {
    id,
    organisation_id: orgRef,
    name: { type: 'varchar(255)', notNull: true },
    address: { type: 'text' },
    // The service parses these with parseFloat, so numeric rather than a
    // geography type — no PostGIS dependency is implied anywhere.
    latitude: { type: 'decimal(10,7)' },
    longitude: { type: 'decimal(10,7)' },
    created_at,
    updated_at,
  });
  pgm.addConstraint('venues', 'venues_name_unique_per_org', {
    unique: ['organisation_id', 'name'],
  });
  pgm.createIndex('venues', 'organisation_id');

  // Now that the tables exist, the columns added in 1709000000008 can carry
  // their foreign keys. Deleting an event type or venue leaves the events that
  // used it intact and unclassified.
  pgm.addConstraint('events', 'events_event_type_id_fkey', {
    foreignKeys: {
      columns: 'event_type_id',
      references: 'event_types(id)',
      onDelete: 'SET NULL',
    },
  });
  pgm.addConstraint('events', 'events_venue_id_fkey', {
    foreignKeys: {
      columns: 'venue_id',
      references: 'venues(id)',
      onDelete: 'SET NULL',
    },
  });

  // ------------------------------------------------------------- discounts

  pgm.createTable('discounts', {
    id,
    organisation_id: orgRef,
    module_type: { type: 'varchar(50)', notNull: true },
    name: { type: 'varchar(255)', notNull: true },
    description: { type: 'text' },
    /** Optional code a member types at checkout. */
    code: { type: 'varchar(50)' },
    discount_type: { type: 'varchar(20)', notNull: true },
    discount_value: { type: 'decimal(10,2)', notNull: true },
    application_scope: { type: 'varchar(50)', notNull: true },
    quantity_rules: { type: 'jsonb' },
    eligibility_criteria: { type: 'jsonb' },
    valid_from: { type: 'timestamp' },
    valid_until: { type: 'timestamp' },
    /**
     * Holds the configured limits and, under `currentUsageCount`, the running
     * total — the service increments it with jsonb_set inside the same
     * transaction that records the usage row.
     */
    usage_limits: { type: 'jsonb' },
    combinable: { type: 'boolean', notNull: true, default: true },
    priority: { type: 'integer', notNull: true, default: 0 },
    status: { type: 'varchar(20)', notNull: true, default: 'active' },
    created_at,
    updated_at,
    created_by: { type: 'uuid', references: 'organization_users(id)' },
  });

  pgm.addConstraint('discounts', 'discounts_type_check', {
    check: "discount_type IN ('percentage', 'fixed')",
  });
  pgm.addConstraint('discounts', 'discounts_scope_check', {
    check: "application_scope IN ('item', 'category', 'cart', 'quantity-based')",
  });
  pgm.addConstraint('discounts', 'discounts_status_check', {
    check: "status IN ('active', 'inactive', 'expired')",
  });
  pgm.createIndex('discounts', 'organisation_id');
  pgm.createIndex('discounts', 'module_type');
  pgm.createIndex('discounts', 'code');
  pgm.createIndex('discounts', 'status');

  pgm.createTable('discount_applications', {
    id,
    discount_id: {
      type: 'uuid',
      notNull: true,
      references: 'discounts(id)',
      onDelete: 'CASCADE',
    },
    /** Polymorphic: 'event', 'event_activity', 'membership_type', … */
    target_type: { type: 'varchar(50)', notNull: true },
    target_id: { type: 'uuid', notNull: true },
    applied_at: created_at,
    applied_by: { type: 'uuid', references: 'organization_users(id)' },
  });
  // The service applies discounts with ON CONFLICT (discount_id, target_type,
  // target_id) DO NOTHING, which needs exactly this unique index to work.
  pgm.addConstraint('discount_applications', 'discount_applications_unique_target', {
    unique: ['discount_id', 'target_type', 'target_id'],
  });
  pgm.createIndex('discount_applications', 'discount_id');
  pgm.createIndex('discount_applications', ['target_type', 'target_id']);

  pgm.createTable('discount_usage', {
    id,
    discount_id: {
      type: 'uuid',
      notNull: true,
      references: 'discounts(id)',
      onDelete: 'CASCADE',
    },
    // The proposal referenced `account_users`, which is a view matching nothing.
    // The real target is organization_users, as on payments.user_id.
    user_id: {
      type: 'uuid',
      notNull: true,
      references: 'organization_users(id)',
    },
    transaction_type: { type: 'varchar(50)', notNull: true },
    transaction_id: { type: 'uuid', notNull: true },
    original_amount: { type: 'decimal(10,2)', notNull: true },
    discount_amount: { type: 'decimal(10,2)', notNull: true },
    final_amount: { type: 'decimal(10,2)', notNull: true },
    applied_at: created_at,
  });
  pgm.createIndex('discount_usage', 'discount_id');
  pgm.createIndex('discount_usage', 'user_id');
  pgm.createIndex('discount_usage', ['transaction_type', 'transaction_id']);
  // Redemption limits are counted per member with COUNT(*) WHERE discount_id
  // AND user_id, so that pair is the access path worth indexing.
  pgm.createIndex('discount_usage', ['discount_id', 'user_id']);

  // ----------------------------------------------------------- user groups

  pgm.createTable('user_groups', {
    id,
    organisation_id: orgRef,
    name: { type: 'varchar(255)', notNull: true },
    description: { type: 'text' },
    created_at,
    updated_at,
  });
  pgm.addConstraint('user_groups', 'user_groups_name_unique_per_org', {
    unique: ['organisation_id', 'name'],
  });

  pgm.createTable('user_group_members', {
    id,
    user_group_id: {
      type: 'uuid',
      notNull: true,
      references: 'user_groups(id)',
      onDelete: 'CASCADE',
    },
    user_id: {
      type: 'uuid',
      notNull: true,
      references: 'organization_users(id)',
      onDelete: 'CASCADE',
    },
    created_at,
  });
  pgm.addConstraint('user_group_members', 'user_group_members_unique', {
    unique: ['user_group_id', 'user_id'],
  });
  // Eligibility is checked as user_id = $1 AND user_group_id = ANY($2).
  pgm.createIndex('user_group_members', ['user_id', 'user_group_id']);

  // -------------------------------------------------------------- calendar

  pgm.createTable('slot_reservations', {
    id,
    calendar_id: {
      type: 'uuid',
      notNull: true,
      references: 'calendars(id)',
      onDelete: 'CASCADE',
    },
    /** The org admin who held the slot. */
    reserved_by: { type: 'uuid', references: 'organization_users(id)' },
    slot_date: { type: 'date', notNull: true },
    start_time: { type: 'time', notNull: true },
    /** Minutes, matching the calendar's duration options. */
    duration: { type: 'integer', notNull: true },
    reason: { type: 'text' },
    created_at,
    updated_at,
  });
  // Reservations are read by calendar over a date range.
  pgm.createIndex('slot_reservations', ['calendar_id', 'slot_date']);

  // ----------------------------------------------------- membership numbers

  pgm.createTable('membership_number_sequences', {
    id,
    organization_type_id: {
      type: 'uuid',
      notNull: true,
      references: 'organization_types(id)',
      onDelete: 'CASCADE',
    },
    /**
     * Null when numbering is unique across the whole organisation type; set
     * when each organisation numbers independently.
     */
    organization_id: {
      type: 'uuid',
      references: 'organizations(id)',
      onDelete: 'CASCADE',
    },
    next_number: { type: 'integer', notNull: true, default: 1 },
    created_at,
    updated_at,
  });

  // NULLS NOT DISTINCT is required, not cosmetic: the generator upserts with
  // ON CONFLICT (organization_type_id, organization_id), and by default
  // Postgres treats every NULL organization_id as distinct — so the
  // organisation-type-level row would be inserted again on every allocation
  // instead of conflicting. Needs Postgres 15+; this project runs 16.
  pgm.sql(`
    CREATE UNIQUE INDEX membership_number_sequences_scope_unique
    ON membership_number_sequences (organization_type_id, organization_id)
    NULLS NOT DISTINCT
  `);
};

exports.down = (pgm) => {
  pgm.dropConstraint('events', 'events_event_type_id_fkey');
  pgm.dropConstraint('events', 'events_venue_id_fkey');

  pgm.dropTable('membership_number_sequences');
  pgm.dropTable('slot_reservations');
  pgm.dropTable('user_group_members');
  pgm.dropTable('user_groups');
  pgm.dropTable('discount_usage');
  pgm.dropTable('discount_applications');
  pgm.dropTable('discounts');
  pgm.dropTable('venues');
  pgm.dropTable('event_types');
};
