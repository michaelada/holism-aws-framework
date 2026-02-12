/**
 * Migration: Create Reports Table
 * 
 * This migration creates the reports structure:
 * - reports (for saved/scheduled reports)
 */

exports.shorthands = undefined;

exports.up = (pgm) => {
  // Create reports table
  pgm.createTable('reports', {
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
    report_type: {
      type: 'varchar(50)',
      notNull: true,
    },
    report_name: {
      type: 'varchar(255)',
      notNull: true,
    },
    report_description: {
      type: 'text',
    },
    report_parameters: {
      type: 'jsonb',
      default: '{}',
    },
    report_data: {
      type: 'jsonb',
    },
    generated_by: {
      type: 'uuid',
      notNull: true,
      references: 'organization_users(id)',
    },
    generated_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('CURRENT_TIMESTAMP'),
    },
    is_scheduled: {
      type: 'boolean',
      default: false,
    },
    schedule_frequency: {
      type: 'varchar(50)',
    },
    next_run_at: {
      type: 'timestamp',
    },
    status: {
      type: 'varchar(50)',
      default: 'completed',
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

  pgm.createIndex('reports', 'organisation_id');
  pgm.createIndex('reports', 'report_type');
  pgm.createIndex('reports', 'generated_by');
  pgm.createIndex('reports', 'is_scheduled');
  pgm.createIndex('reports', 'next_run_at');
};

exports.down = (pgm) => {
  pgm.dropTable('reports');
};
