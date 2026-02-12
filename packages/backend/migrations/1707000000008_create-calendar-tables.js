/**
 * Migration: Create Calendar and Bookings Tables
 * 
 * This migration creates the calendar booking structure:
 * - calendars
 * - schedule_rules
 * - time_slot_configurations
 * - duration_options
 * - blocked_periods
 * - bookings
 * - booking_history
 */

exports.shorthands = undefined;

exports.up = (pgm) => {
  // 1. Create calendars table
  pgm.createTable('calendars', {
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
    display_colour: {
      type: 'varchar(7)',
      notNull: true,
    },
    status: {
      type: 'varchar(50)',
      default: 'open',
    },
    enable_automated_schedule: {
      type: 'boolean',
      default: false,
    },
    min_days_in_advance: {
      type: 'integer',
      default: 0,
    },
    max_days_in_advance: {
      type: 'integer',
      default: 90,
    },
    use_terms_and_conditions: {
      type: 'boolean',
      default: false,
    },
    terms_and_conditions: {
      type: 'text',
    },
    supported_payment_methods: {
      type: 'jsonb',
      default: '[]',
    },
    allow_cancellations: {
      type: 'boolean',
      default: false,
    },
    cancel_days_in_advance: {
      type: 'integer',
    },
    refund_payment_automatically: {
      type: 'boolean',
      default: false,
    },
    admin_notification_emails: {
      type: 'text',
    },
    send_reminder_emails: {
      type: 'boolean',
      default: false,
    },
    reminder_hours_before: {
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

  pgm.createIndex('calendars', 'organisation_id');
  pgm.createIndex('calendars', 'status');

  // 2. Create schedule_rules table
  pgm.createTable('schedule_rules', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    calendar_id: {
      type: 'uuid',
      notNull: true,
      references: 'calendars(id)',
      onDelete: 'CASCADE',
    },
    start_date: {
      type: 'date',
      notNull: true,
    },
    end_date: {
      type: 'date',
    },
    action: {
      type: 'varchar(50)',
      notNull: true,
    },
    time_of_day: {
      type: 'varchar(5)',
    },
    reason: {
      type: 'text',
    },
    order: {
      type: 'integer',
      notNull: true,
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

  pgm.createIndex('schedule_rules', 'calendar_id');

  // 3. Create time_slot_configurations table
  pgm.createTable('time_slot_configurations', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    calendar_id: {
      type: 'uuid',
      notNull: true,
      references: 'calendars(id)',
      onDelete: 'CASCADE',
    },
    days_of_week: {
      type: 'jsonb',
      notNull: true,
    },
    start_time: {
      type: 'varchar(5)',
      notNull: true,
    },
    effective_date_start: {
      type: 'date',
      notNull: true,
    },
    effective_date_end: {
      type: 'date',
    },
    recurrence_weeks: {
      type: 'integer',
      default: 1,
    },
    places_available: {
      type: 'integer',
      default: 1,
    },
    min_places_required: {
      type: 'integer',
    },
    order: {
      type: 'integer',
      notNull: true,
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

  pgm.createIndex('time_slot_configurations', 'calendar_id');

  // 4. Create duration_options table
  pgm.createTable('duration_options', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    time_slot_configuration_id: {
      type: 'uuid',
      notNull: true,
      references: 'time_slot_configurations(id)',
      onDelete: 'CASCADE',
    },
    duration: {
      type: 'integer',
      notNull: true,
    },
    price: {
      type: 'decimal(10,2)',
      notNull: true,
    },
    label: {
      type: 'varchar(255)',
      notNull: true,
    },
    order: {
      type: 'integer',
      notNull: true,
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

  pgm.createIndex('duration_options', 'time_slot_configuration_id');

  // 5. Create blocked_periods table
  pgm.createTable('blocked_periods', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    calendar_id: {
      type: 'uuid',
      notNull: true,
      references: 'calendars(id)',
      onDelete: 'CASCADE',
    },
    block_type: {
      type: 'varchar(50)',
      notNull: true,
    },
    start_date: {
      type: 'date',
    },
    end_date: {
      type: 'date',
    },
    days_of_week: {
      type: 'jsonb',
    },
    start_time: {
      type: 'varchar(5)',
    },
    end_time: {
      type: 'varchar(5)',
    },
    reason: {
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

  pgm.createIndex('blocked_periods', 'calendar_id');

  // 6. Create bookings table
  pgm.createTable('bookings', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    booking_reference: {
      type: 'varchar(100)',
      notNull: true,
      unique: true,
    },
    calendar_id: {
      type: 'uuid',
      notNull: true,
      references: 'calendars(id)',
      onDelete: 'CASCADE',
    },
    user_id: {
      type: 'uuid',
      notNull: true,
      references: 'organization_users(id)',
    },
    booking_date: {
      type: 'date',
      notNull: true,
    },
    start_time: {
      type: 'varchar(5)',
      notNull: true,
    },
    duration: {
      type: 'integer',
      notNull: true,
    },
    end_time: {
      type: 'varchar(5)',
      notNull: true,
    },
    places_booked: {
      type: 'integer',
      default: 1,
    },
    price_per_place: {
      type: 'decimal(10,2)',
      notNull: true,
    },
    total_price: {
      type: 'decimal(10,2)',
      notNull: true,
    },
    booking_status: {
      type: 'varchar(50)',
      default: 'confirmed',
    },
    payment_status: {
      type: 'varchar(50)',
      default: 'pending',
    },
    payment_method: {
      type: 'varchar(50)',
    },
    form_submission_id: {
      type: 'uuid',
    },
    cancelled_at: {
      type: 'timestamp',
    },
    cancelled_by: {
      type: 'uuid',
    },
    cancellation_reason: {
      type: 'text',
    },
    refund_processed: {
      type: 'boolean',
      default: false,
    },
    refunded_at: {
      type: 'timestamp',
    },
    admin_notes: {
      type: 'text',
    },
    booked_at: {
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

  pgm.createIndex('bookings', 'calendar_id');
  pgm.createIndex('bookings', 'user_id');
  pgm.createIndex('bookings', 'booking_date');
  pgm.createIndex('bookings', 'booking_status');
  pgm.createIndex('bookings', 'payment_status');

  // 7. Create booking_history table
  pgm.createTable('booking_history', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    booking_id: {
      type: 'uuid',
      notNull: true,
      references: 'bookings(id)',
      onDelete: 'CASCADE',
    },
    user_id: {
      type: 'uuid',
      notNull: true,
      references: 'organization_users(id)',
    },
    action: {
      type: 'varchar(100)',
      notNull: true,
    },
    previous_value: {
      type: 'text',
    },
    new_value: {
      type: 'text',
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

  pgm.createIndex('booking_history', 'booking_id');
};

exports.down = (pgm) => {
  pgm.dropTable('booking_history');
  pgm.dropTable('bookings');
  pgm.dropTable('blocked_periods');
  pgm.dropTable('duration_options');
  pgm.dropTable('time_slot_configurations');
  pgm.dropTable('schedule_rules');
  pgm.dropTable('calendars');
};
