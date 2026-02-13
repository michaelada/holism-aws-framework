/**
 * Migration: Add field_groups and wizard_config to application_forms
 * 
 * This migration adds JSONB columns to store field grouping and wizard configuration
 */

exports.shorthands = undefined;

exports.up = (pgm) => {
  // Add field_groups column to store field grouping configuration
  pgm.addColumn('application_forms', {
    field_groups: {
      type: 'jsonb',
      default: '[]',
    },
  });

  // Add wizard_config column to store wizard step configuration
  pgm.addColumn('application_forms', {
    wizard_config: {
      type: 'jsonb',
    },
  });
};

exports.down = (pgm) => {
  pgm.dropColumn('application_forms', 'wizard_config');
  pgm.dropColumn('application_forms', 'field_groups');
};
