/**
 * Migration: Create Payments and Refunds Tables
 * 
 * This migration creates the payment management structure:
 * - payments
 * - refunds
 */

exports.shorthands = undefined;

exports.up = (pgm) => {
  // 1. Create payments table
  pgm.createTable('payments', {
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
    payment_type: {
      type: 'varchar(50)',
      notNull: true,
    },
    context_id: {
      type: 'uuid',
      notNull: true,
    },
    amount: {
      type: 'decimal(10,2)',
      notNull: true,
    },
    currency: {
      type: 'varchar(3)',
      default: 'USD',
    },
    payment_method: {
      type: 'varchar(50)',
      notNull: true,
    },
    payment_status: {
      type: 'varchar(50)',
      default: 'pending',
    },
    payment_provider: {
      type: 'varchar(50)',
    },
    provider_transaction_id: {
      type: 'varchar(255)',
    },
    payment_date: {
      type: 'timestamp',
    },
    metadata: {
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

  pgm.createIndex('payments', 'organisation_id');
  pgm.createIndex('payments', 'user_id');
  pgm.createIndex('payments', 'payment_status');
  pgm.createIndex('payments', 'payment_type');
  pgm.createIndex('payments', ['payment_type', 'context_id']);
  pgm.createIndex('payments', 'provider_transaction_id');

  // 2. Create refunds table
  pgm.createTable('refunds', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    payment_id: {
      type: 'uuid',
      notNull: true,
      references: 'payments(id)',
      onDelete: 'CASCADE',
    },
    organisation_id: {
      type: 'uuid',
      notNull: true,
      references: 'organizations(id)',
      onDelete: 'CASCADE',
    },
    refund_amount: {
      type: 'decimal(10,2)',
      notNull: true,
    },
    refund_reason: {
      type: 'text',
    },
    refund_status: {
      type: 'varchar(50)',
      default: 'pending',
    },
    refund_provider: {
      type: 'varchar(50)',
    },
    provider_refund_id: {
      type: 'varchar(255)',
    },
    refund_date: {
      type: 'timestamp',
    },
    requested_by: {
      type: 'uuid',
      notNull: true,
      references: 'organization_users(id)',
    },
    requested_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('CURRENT_TIMESTAMP'),
    },
    metadata: {
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

  pgm.createIndex('refunds', 'payment_id');
  pgm.createIndex('refunds', 'organisation_id');
  pgm.createIndex('refunds', 'refund_status');
  pgm.createIndex('refunds', 'requested_by');
};

exports.down = (pgm) => {
  pgm.dropTable('refunds');
  pgm.dropTable('payments');
};
