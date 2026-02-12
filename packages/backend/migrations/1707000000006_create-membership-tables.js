/**
 * Migration: Create Membership Tables
 * 
 * This migration creates the membership management structure:
 * - membership_types
 * - members
 * - member_filters
 */

exports.shorthands = undefined;

exports.up = (pgm) => {
  // 1. Create membership_types table
  pgm.createTable('membership_types', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    organisation_id: {
      type: 'uuid',
      notNull: true,
      references: 'organizations(id)',
      onDelete: 'CASCADE',
    },
    name: {
      type: 'varchar(255)',
      notNull: true,
    },
    description: {
      type: 'text',
      notNull: true,
    },
    membership_form_id: {
      type: 'uuid',
      notNull: true,
    },
    membership_status: {
      type: 'varchar(50)',
      default: 'open',
    },
    is_rolling_membership: {
      type: 'boolean',
      default: false,
    },
    valid_until: {
      type: 'date',
    },
    number_of_months: {
      type: 'integer',
    },
    automatically_approve: {
      type: 'boolean',
      default: false,
    },
    member_labels: {
      type: 'jsonb',
      default: '[]',
    },
    supported_payment_methods: {
      type: 'jsonb',
      default: '[]',
    },
    use_terms_and_conditions: {
      type: 'boolean',
      default: false,
    },
    terms_and_conditions: {
      type: 'text',
    },
    membership_type_category: {
      type: 'varchar(50)',
      default: 'single',
    },
    max_people_in_application: {
      type: 'integer',
    },
    min_people_in_application: {
      type: 'integer',
    },
    person_titles: {
      type: 'jsonb',
    },
    person_labels: {
      type: 'jsonb',
    },
    field_configuration: {
      type: 'jsonb',
    },
    created_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('CURRENT_TIMESTAMP'),
    },
    updated_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('CURRENT_TIMESTAMP'),
    },
  });

  pgm.createIndex('membership_types', 'organisation_id');
  pgm.createIndex('membership_types', 'membership_status');

  // 2. Create members table
  pgm.createTable('members', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    organisation_id: {
      type: 'uuid',
      notNull: true,
      references: 'organizations(id)',
      onDelete: 'CASCADE',
    },
    membership_type_id: {
      type: 'uuid',
      notNull: true,
      references: 'membership_types(id)',
      onDelete: 'CASCADE',
    },
    user_id: {
      type: 'uuid',
      notNull: true,
      references: 'organization_users(id)',
    },
    membership_number: {
      type: 'varchar(100)',
      notNull: true,
      unique: true,
    },
    first_name: {
      type: 'varchar(255)',
      notNull: true,
    },
    last_name: {
      type: 'varchar(255)',
      notNull: true,
    },
    form_submission_id: {
      type: 'uuid',
      notNull: true,
    },
    date_last_renewed: {
      type: 'date',
      notNull: true,
    },
    status: {
      type: 'varchar(50)',
      default: 'pending',
    },
    valid_until: {
      type: 'date',
      notNull: true,
    },
    labels: {
      type: 'jsonb',
      default: '[]',
    },
    processed: {
      type: 'boolean',
      default: false,
    },
    payment_status: {
      type: 'varchar(50)',
      default: 'pending',
    },
    payment_method: {
      type: 'varchar(50)',
    },
    group_membership_id: {
      type: 'uuid',
    },
    person_slot: {
      type: 'integer',
    },
    created_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('CURRENT_TIMESTAMP'),
    },
    updated_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('CURRENT_TIMESTAMP'),
    },
  });

  pgm.createIndex('members', 'organisation_id');
  pgm.createIndex('members', 'membership_type_id');
  pgm.createIndex('members', 'user_id');
  pgm.createIndex('members', 'status');
  pgm.createIndex('members', 'membership_number');
  pgm.createIndex('members', 'group_membership_id');

  // 3. Create member_filters table
  pgm.createTable('member_filters', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    organisation_id: {
      type: 'uuid',
      notNull: true,
      references: 'organizations(id)',
      onDelete: 'CASCADE',
    },
    user_id: {
      type: 'uuid',
      notNull: true,
      references: 'organization_users(id)',
    },
    name: {
      type: 'varchar(255)',
      notNull: true,
    },
    member_status: {
      type: 'jsonb',
      default: '[]',
    },
    date_last_renewed_before: {
      type: 'date',
    },
    date_last_renewed_after: {
      type: 'date',
    },
    valid_until_before: {
      type: 'date',
    },
    valid_until_after: {
      type: 'date',
    },
    member_labels: {
      type: 'jsonb',
      default: '[]',
    },
    created_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('CURRENT_TIMESTAMP'),
    },
    updated_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('CURRENT_TIMESTAMP'),
    },
  });

  pgm.createIndex('member_filters', 'organisation_id');
  pgm.createIndex('member_filters', 'user_id');
};

exports.down = (pgm) => {
  pgm.dropTable('member_filters');
  pgm.dropTable('members');
  pgm.dropTable('membership_types');
};
