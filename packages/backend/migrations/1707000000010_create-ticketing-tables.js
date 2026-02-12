/**
 * Migration: Create Ticketing Tables
 * 
 * This migration creates the event ticketing structure:
 * - event_ticketing_config
 * - electronic_tickets
 * - ticket_scan_history
 */

exports.shorthands = undefined;

exports.up = (pgm) => {
  // 1. Create event_ticketing_config table
  pgm.createTable('event_ticketing_config', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    event_id: {
      type: 'uuid',
      notNull: true,
      unique: true,
      references: 'events(id)',
      onDelete: 'CASCADE',
    },
    generate_electronic_tickets: {
      type: 'boolean',
      default: false,
    },
    ticket_header_text: {
      type: 'text',
    },
    ticket_instructions: {
      type: 'text',
    },
    ticket_footer_text: {
      type: 'text',
    },
    ticket_validity_period: {
      type: 'integer',
    },
    include_event_logo: {
      type: 'boolean',
      default: false,
    },
    ticket_background_color: {
      type: 'varchar(7)',
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

  pgm.createIndex('event_ticketing_config', 'event_id');

  // 2. Create electronic_tickets table
  pgm.createTable('electronic_tickets', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    ticket_reference: {
      type: 'varchar(100)',
      notNull: true,
      unique: true,
    },
    qr_code: {
      type: 'uuid',
      notNull: true,
      unique: true,
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
      references: 'event_activities(id)',
      onDelete: 'CASCADE',
    },
    event_entry_id: {
      type: 'uuid',
      notNull: true,
      references: 'event_entries(id)',
      onDelete: 'CASCADE',
    },
    user_id: {
      type: 'uuid',
      notNull: true,
      references: 'organization_users(id)',
    },
    customer_name: {
      type: 'varchar(255)',
      notNull: true,
    },
    customer_email: {
      type: 'varchar(255)',
      notNull: true,
    },
    issue_date: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('CURRENT_TIMESTAMP'),
    },
    valid_from: {
      type: 'timestamp',
    },
    valid_until: {
      type: 'timestamp',
      notNull: true,
    },
    scan_status: {
      type: 'varchar(50)',
      default: 'not_scanned',
    },
    scan_date: {
      type: 'timestamp',
    },
    scan_location: {
      type: 'varchar(255)',
    },
    scan_count: {
      type: 'integer',
      default: 0,
    },
    status: {
      type: 'varchar(50)',
      default: 'issued',
    },
    ticket_data: {
      type: 'jsonb',
      default: '{}',
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

  pgm.createIndex('electronic_tickets', 'event_id');
  pgm.createIndex('electronic_tickets', 'event_activity_id');
  pgm.createIndex('electronic_tickets', 'event_entry_id');
  pgm.createIndex('electronic_tickets', 'user_id');
  pgm.createIndex('electronic_tickets', 'scan_status');
  pgm.createIndex('electronic_tickets', 'status');
  pgm.createIndex('electronic_tickets', 'qr_code');

  // 3. Create ticket_scan_history table
  pgm.createTable('ticket_scan_history', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    ticket_id: {
      type: 'uuid',
      notNull: true,
      references: 'electronic_tickets(id)',
      onDelete: 'CASCADE',
    },
    scan_date: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('CURRENT_TIMESTAMP'),
    },
    scan_location: {
      type: 'varchar(255)',
    },
    scanned_by: {
      type: 'uuid',
      references: 'organization_users(id)',
    },
    scan_result: {
      type: 'varchar(50)',
      notNull: true,
    },
    notes: {
      type: 'text',
    },
    created_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('CURRENT_TIMESTAMP'),
    },
  });

  pgm.createIndex('ticket_scan_history', 'ticket_id');
  pgm.createIndex('ticket_scan_history', 'scan_date');
};

exports.down = (pgm) => {
  pgm.dropTable('ticket_scan_history');
  pgm.dropTable('electronic_tickets');
  pgm.dropTable('event_ticketing_config');
};
