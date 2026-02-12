/**
 * Migration: Create Events and Activities Tables
 * 
 * This migration creates the event management structure:
 * - events
 * - event_activities
 * - event_entries
 */

exports.shorthands = undefined;

exports.up = (pgm) => {
  // 1. Create events table
  pgm.createTable('events', {
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
    event_owner: {
      type: 'uuid',
      notNull: true,
      references: 'organization_users(id)',
    },
    email_notifications: {
      type: 'text',
    },
    start_date: {
      type: 'date',
      notNull: true,
    },
    end_date: {
      type: 'date',
      notNull: true,
    },
    open_date_entries: {
      type: 'timestamp',
    },
    entries_closing_date: {
      type: 'timestamp',
    },
    limit_entries: {
      type: 'boolean',
      default: false,
    },
    entries_limit: {
      type: 'integer',
    },
    add_confirmation_message: {
      type: 'boolean',
      default: false,
    },
    confirmation_message: {
      type: 'text',
    },
    status: {
      type: 'varchar(50)',
      default: 'draft',
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

  pgm.createIndex('events', 'organisation_id');
  pgm.createIndex('events', 'start_date');
  pgm.createIndex('events', 'end_date');
  pgm.createIndex('events', 'status');

  // 2. Create event_activities table
  pgm.createTable('event_activities', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    event_id: {
      type: 'uuid',
      notNull: true,
      references: 'events(id)',
      onDelete: 'CASCADE',
    },
    name: {
      type: 'varchar(255)',
      notNull: true,
    },
    description: {
      type: 'text',
    },
    show_publicly: {
      type: 'boolean',
      default: true,
    },
    application_form_id: {
      type: 'uuid',
    },
    limit_applicants: {
      type: 'boolean',
      default: false,
    },
    applicants_limit: {
      type: 'integer',
    },
    allow_specify_quantity: {
      type: 'boolean',
      default: false,
    },
    use_terms_and_conditions: {
      type: 'boolean',
      default: false,
    },
    terms_and_conditions: {
      type: 'text',
    },
    fee: {
      type: 'decimal(10,2)',
      default: 0.00,
    },
    allowed_payment_method: {
      type: 'varchar(50)',
    },
    handling_fee_included: {
      type: 'boolean',
      default: false,
    },
    cheque_payment_instructions: {
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

  pgm.createIndex('event_activities', 'event_id');

  // 3. Create event_entries table
  pgm.createTable('event_entries', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    event_id: {
      type: 'uuid',
      notNull: true,
      references: 'events(id)',
      onDelete: 'CASCADE',
    },
    event_activity_id: {
      type: 'uuid',
      notNull: true,
      references: 'event_activities(id)',
      onDelete: 'CASCADE',
    },
    user_id: {
      type: 'uuid',
      notNull: true,
      references: 'organization_users(id)',
    },
    first_name: {
      type: 'varchar(255)',
      notNull: true,
    },
    last_name: {
      type: 'varchar(255)',
      notNull: true,
    },
    email: {
      type: 'varchar(255)',
      notNull: true,
    },
    form_submission_id: {
      type: 'uuid',
    },
    quantity: {
      type: 'integer',
      default: 1,
    },
    payment_status: {
      type: 'varchar(50)',
      default: 'pending',
    },
    payment_method: {
      type: 'varchar(50)',
    },
    entry_date: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('CURRENT_TIMESTAMP'),
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

  pgm.createIndex('event_entries', 'event_id');
  pgm.createIndex('event_entries', 'event_activity_id');
  pgm.createIndex('event_entries', 'user_id');
  pgm.createIndex('event_entries', 'payment_status');
};

exports.down = (pgm) => {
  pgm.dropTable('event_entries');
  pgm.dropTable('event_activities');
  pgm.dropTable('events');
};
