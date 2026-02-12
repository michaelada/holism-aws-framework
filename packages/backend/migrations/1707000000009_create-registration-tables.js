/**
 * Migration: Create Registration Tables
 * 
 * This migration creates the registration management structure:
 * - registration_types
 * - registrations
 * - registration_filters
 */

exports.shorthands = undefined;

exports.up = (pgm) => {
  // 1. Create registration_types table
  pgm.createTable('registration_types', {
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
    entity_name: {
      type: 'varchar(255)',
      notNull: true,
    },
    registration_form_id: {
      type: 'uuid',
      notNull: true,
    },
    registration_status: {
      type: 'varchar(50)',
      default: 'open',
    },
    is_rolling_registration: {
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
    registration_labels: {
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

  pgm.createIndex('registration_types', 'organisation_id');
  pgm.createIndex('registration_types', 'registration_status');

  // 2. Create registrations table
  pgm.createTable('registrations', {
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
    registration_type_id: {
      type: 'uuid',
      notNull: true,
      references: 'registration_types(id)',
      onDelete: 'CASCADE',
    },
    user_id: {
      type: 'uuid',
      notNull: true,
      references: 'organization_users(id)',
    },
    registration_number: {
      type: 'varchar(100)',
      notNull: true,
      unique: true,
    },
    entity_name: {
      type: 'varchar(255)',
      notNull: true,
    },
    owner_name: {
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

  pgm.createIndex('registrations', 'organisation_id');
  pgm.createIndex('registrations', 'registration_type_id');
  pgm.createIndex('registrations', 'user_id');
  pgm.createIndex('registrations', 'status');
  pgm.createIndex('registrations', 'registration_number');

  // 3. Create registration_filters table
  pgm.createTable('registration_filters', {
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
    registration_status: {
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
    registration_labels: {
      type: 'jsonb',
      default: '[]',
    },
    registration_types: {
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

  pgm.createIndex('registration_filters', 'organisation_id');
  pgm.createIndex('registration_filters', 'user_id');
};

exports.down = (pgm) => {
  pgm.dropTable('registration_filters');
  pgm.dropTable('registrations');
  pgm.dropTable('registration_types');
};
