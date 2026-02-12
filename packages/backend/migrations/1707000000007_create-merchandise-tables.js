/**
 * Migration: Create Merchandise Tables
 * 
 * This migration creates the merchandise management structure:
 * - merchandise_types
 * - merchandise_option_types
 * - merchandise_option_values
 * - delivery_rules
 * - merchandise_orders
 * - merchandise_order_history
 */

exports.shorthands = undefined;

exports.up = (pgm) => {
  // 1. Create merchandise_types table
  pgm.createTable('merchandise_types', {
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
    images: {
      type: 'jsonb',
      default: '[]',
    },
    status: {
      type: 'varchar(50)',
      default: 'active',
    },
    track_stock_levels: {
      type: 'boolean',
      default: false,
    },
    low_stock_alert: {
      type: 'integer',
    },
    out_of_stock_behavior: {
      type: 'varchar(50)',
    },
    delivery_type: {
      type: 'varchar(50)',
      notNull: true,
    },
    delivery_fee: {
      type: 'decimal(10,2)',
    },
    min_order_quantity: {
      type: 'integer',
      default: 1,
    },
    max_order_quantity: {
      type: 'integer',
    },
    quantity_increments: {
      type: 'integer',
    },
    require_application_form: {
      type: 'boolean',
      default: false,
    },
    application_form_id: {
      type: 'uuid',
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
    admin_notification_emails: {
      type: 'text',
    },
    custom_confirmation_message: {
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

  pgm.createIndex('merchandise_types', 'organisation_id');
  pgm.createIndex('merchandise_types', 'status');

  // 2. Create merchandise_option_types table
  pgm.createTable('merchandise_option_types', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    merchandise_type_id: {
      type: 'uuid',
      notNull: true,
      references: 'merchandise_types(id)',
      onDelete: 'CASCADE',
    },
    name: {
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

  pgm.createIndex('merchandise_option_types', 'merchandise_type_id');

  // 3. Create merchandise_option_values table
  pgm.createTable('merchandise_option_values', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    option_type_id: {
      type: 'uuid',
      notNull: true,
      references: 'merchandise_option_types(id)',
      onDelete: 'CASCADE',
    },
    name: {
      type: 'varchar(255)',
      notNull: true,
    },
    price: {
      type: 'decimal(10,2)',
      notNull: true,
    },
    sku: {
      type: 'varchar(100)',
    },
    stock_quantity: {
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

  pgm.createIndex('merchandise_option_values', 'option_type_id');

  // 4. Create delivery_rules table
  pgm.createTable('delivery_rules', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    merchandise_type_id: {
      type: 'uuid',
      notNull: true,
      references: 'merchandise_types(id)',
      onDelete: 'CASCADE',
    },
    min_quantity: {
      type: 'integer',
      notNull: true,
    },
    max_quantity: {
      type: 'integer',
    },
    delivery_fee: {
      type: 'decimal(10,2)',
      notNull: true,
    },
    order: {
      type: 'integer',
      notNull: true,
    },
  });

  pgm.createIndex('delivery_rules', 'merchandise_type_id');

  // 5. Create merchandise_orders table
  pgm.createTable('merchandise_orders', {
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
    merchandise_type_id: {
      type: 'uuid',
      notNull: true,
      references: 'merchandise_types(id)',
      onDelete: 'CASCADE',
    },
    user_id: {
      type: 'uuid',
      notNull: true,
      references: 'organization_users(id)',
    },
    selected_options: {
      type: 'jsonb',
      notNull: true,
    },
    quantity: {
      type: 'integer',
      notNull: true,
    },
    unit_price: {
      type: 'decimal(10,2)',
      notNull: true,
    },
    subtotal: {
      type: 'decimal(10,2)',
      notNull: true,
    },
    delivery_fee: {
      type: 'decimal(10,2)',
      notNull: true,
    },
    total_price: {
      type: 'decimal(10,2)',
      notNull: true,
    },
    form_submission_id: {
      type: 'uuid',
    },
    payment_status: {
      type: 'varchar(50)',
      default: 'pending',
    },
    payment_method: {
      type: 'varchar(50)',
    },
    order_status: {
      type: 'varchar(50)',
      default: 'pending',
    },
    admin_notes: {
      type: 'text',
    },
    order_date: {
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

  pgm.createIndex('merchandise_orders', 'organisation_id');
  pgm.createIndex('merchandise_orders', 'merchandise_type_id');
  pgm.createIndex('merchandise_orders', 'user_id');
  pgm.createIndex('merchandise_orders', 'order_status');
  pgm.createIndex('merchandise_orders', 'payment_status');

  // 6. Create merchandise_order_history table
  pgm.createTable('merchandise_order_history', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    order_id: {
      type: 'uuid',
      notNull: true,
      references: 'merchandise_orders(id)',
      onDelete: 'CASCADE',
    },
    user_id: {
      type: 'uuid',
      notNull: true,
      references: 'organization_users(id)',
    },
    previous_status: {
      type: 'varchar(50)',
    },
    new_status: {
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

  pgm.createIndex('merchandise_order_history', 'order_id');
};

exports.down = (pgm) => {
  pgm.dropTable('merchandise_order_history');
  pgm.dropTable('merchandise_orders');
  pgm.dropTable('delivery_rules');
  pgm.dropTable('merchandise_option_values');
  pgm.dropTable('merchandise_option_types');
  pgm.dropTable('merchandise_types');
};
