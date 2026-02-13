/**
 * Migration: Create Application Forms and Unified Submission Tables
 * 
 * This migration creates the application forms structure (separate from metadata):
 * - application_forms
 * - application_fields
 * - application_form_fields
 * - form_submissions (unified across all contexts)
 * - form_submission_files
 */

exports.shorthands = undefined;

exports.up = (pgm) => {
  // 1. Create application_forms table (similar to object_definitions)
  pgm.createTable('application_forms', {
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

  pgm.createIndex('application_forms', 'organisation_id');
  pgm.createIndex('application_forms', 'status');

  // 2. Create application_fields table (similar to field_definitions, includes document_upload)
  pgm.createTable('application_fields', {
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
    label: {
      type: 'varchar(255)',
      notNull: true,
    },
    description: {
      type: 'text',
    },
    datatype: {
      type: 'varchar(50)',
      notNull: true,
    },
    validation: {
      type: 'jsonb',
    },
    options: {
      type: 'jsonb',
    },
    allowed_file_types: {
      type: 'jsonb',
    },
    max_file_size: {
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

  pgm.createIndex('application_fields', 'organisation_id');
  pgm.createIndex('application_fields', 'datatype');

  // 3. Create application_form_fields table (similar to object_fields)
  pgm.createTable('application_form_fields', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    form_id: {
      type: 'uuid',
      notNull: true,
      references: 'application_forms(id)',
      onDelete: 'CASCADE',
    },
    field_id: {
      type: 'uuid',
      notNull: true,
      references: 'application_fields(id)',
      onDelete: 'CASCADE',
    },
    order: {
      type: 'integer',
      notNull: true,
    },
    group_name: {
      type: 'varchar(255)',
    },
    group_order: {
      type: 'integer',
    },
    wizard_step: {
      type: 'integer',
    },
    wizard_step_title: {
      type: 'varchar(255)',
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

  pgm.createIndex('application_form_fields', 'form_id');
  pgm.createIndex('application_form_fields', 'field_id');
  pgm.addConstraint('application_form_fields', 'application_form_fields_form_field_unique', {
    unique: ['form_id', 'field_id'],
  });

  // 4. Create form_submissions table (unified across all contexts)
  pgm.createTable('form_submissions', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    form_id: {
      type: 'uuid',
      notNull: true,
      references: 'application_forms(id)',
      onDelete: 'CASCADE',
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
    submission_type: {
      type: 'varchar(50)',
      notNull: true,
    },
    context_id: {
      type: 'uuid',
      notNull: true,
    },
    submission_data: {
      type: 'jsonb',
      notNull: true,
    },
    status: {
      type: 'varchar(50)',
      default: 'pending',
    },
    submitted_at: {
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

  pgm.createIndex('form_submissions', 'form_id');
  pgm.createIndex('form_submissions', 'organisation_id');
  pgm.createIndex('form_submissions', 'user_id');
  pgm.createIndex('form_submissions', 'submission_type');
  pgm.createIndex('form_submissions', 'context_id');
  pgm.createIndex('form_submissions', ['submission_type', 'context_id']);

  // 5. Create form_submission_files table (tracks S3 uploads)
  pgm.createTable('form_submission_files', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    submission_id: {
      type: 'uuid',
      notNull: true,
      references: 'form_submissions(id)',
      onDelete: 'CASCADE',
    },
    field_id: {
      type: 'uuid',
      notNull: true,
      references: 'application_fields(id)',
    },
    file_name: {
      type: 'varchar(255)',
      notNull: true,
    },
    file_size: {
      type: 'integer',
      notNull: true,
    },
    file_type: {
      type: 'varchar(100)',
      notNull: true,
    },
    s3_key: {
      type: 'text',
      notNull: true,
    },
    s3_bucket: {
      type: 'varchar(255)',
      notNull: true,
    },
    uploaded_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('CURRENT_TIMESTAMP'),
    },
  });

  pgm.createIndex('form_submission_files', 'submission_id');
  pgm.createIndex('form_submission_files', 'field_id');
  pgm.createIndex('form_submission_files', 's3_key');
};

exports.down = (pgm) => {
  pgm.dropTable('form_submission_files');
  pgm.dropTable('form_submissions');
  pgm.dropTable('application_form_fields');
  pgm.dropTable('application_fields');
  pgm.dropTable('application_forms');
};
