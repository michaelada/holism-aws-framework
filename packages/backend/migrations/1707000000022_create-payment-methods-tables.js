/**
 * Migration: Create Payment Methods Configuration Tables
 * 
 * This migration creates the payment methods configuration system:
 * - payment_methods: System-wide payment method definitions
 * - org_payment_method_data: Organization-specific payment method associations and configuration
 * 
 * Also seeds initial payment methods and associates existing organizations with pay-offline.
 */

exports.shorthands = undefined;

exports.up = async (pgm) => {
  // 1. Create payment_methods table
  pgm.createTable('payment_methods', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    name: {
      type: 'varchar(100)',
      notNull: true,
      unique: true,
    },
    display_name: {
      type: 'varchar(255)',
      notNull: true,
    },
    description: {
      type: 'text',
    },
    requires_activation: {
      type: 'boolean',
      notNull: true,
      default: false,
    },
    is_active: {
      type: 'boolean',
      notNull: true,
      default: true,
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

  // Add indexes for payment_methods
  pgm.createIndex('payment_methods', 'is_active');
  pgm.createIndex('payment_methods', 'name');

  // 2. Create org_payment_method_data table
  pgm.createTable('org_payment_method_data', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    organization_id: {
      type: 'uuid',
      notNull: true,
      references: 'organizations(id)',
      onDelete: 'CASCADE',
    },
    payment_method_id: {
      type: 'uuid',
      notNull: true,
      references: 'payment_methods(id)',
      onDelete: 'CASCADE',
    },
    status: {
      type: 'varchar(50)',
      notNull: true,
      default: 'inactive',
    },
    payment_data: {
      type: 'jsonb',
      notNull: true,
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

  // Add unique constraint on (organization_id, payment_method_id)
  pgm.addConstraint('org_payment_method_data', 'org_payment_method_data_org_method_unique', {
    unique: ['organization_id', 'payment_method_id'],
  });

  // Add indexes for org_payment_method_data
  pgm.createIndex('org_payment_method_data', 'organization_id');
  pgm.createIndex('org_payment_method_data', 'status');

  // 3. Seed initial payment methods
  pgm.sql(`
    INSERT INTO payment_methods (name, display_name, description, requires_activation, is_active)
    VALUES
      (
        'pay-offline',
        'Pay Offline',
        'Payment instructions will be provided in the confirmation email. No card details required.',
        false,
        true
      ),
      (
        'stripe',
        'Pay By Card (Stripe)',
        'Accept card payments through Stripe. Requires Stripe Connect activation.',
        true,
        true
      ),
      (
        'helix-pay',
        'Pay By Card (Helix-Pay)',
        'Accept card payments through Helix-Pay. Requires account activation.',
        true,
        true
      );
  `);

  // 4. Associate existing organizations with pay-offline
  pgm.sql(`
    INSERT INTO org_payment_method_data (organization_id, payment_method_id, status, payment_data)
    SELECT 
      o.id,
      pm.id,
      'active',
      '{}'::jsonb
    FROM organizations o
    CROSS JOIN payment_methods pm
    WHERE pm.name = 'pay-offline';
  `);
};

exports.down = (pgm) => {
  // Drop tables in reverse order due to foreign key constraints
  pgm.dropTable('org_payment_method_data');
  pgm.dropTable('payment_methods');
};
