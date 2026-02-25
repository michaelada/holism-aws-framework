/**
 * Migration: Create Onboarding Preferences Table
 * 
 * This migration creates the user_onboarding_preferences table for storing
 * user preferences related to the onboarding and help system.
 * 
 * Fields:
 * - user_id: Reference to the user (organization_users table)
 * - welcome_dismissed: Boolean indicating if welcome dialog was dismissed
 * - modules_visited: Array of module IDs that the user has visited
 * - last_updated: Timestamp of last preference update
 */

exports.shorthands = undefined;

exports.up = (pgm) => {
  // Create user_onboarding_preferences table
  pgm.createTable('user_onboarding_preferences', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    user_id: {
      type: 'uuid',
      notNull: true,
      references: 'organization_users(id)',
      onDelete: 'CASCADE',
      unique: true, // One preference record per user
    },
    welcome_dismissed: {
      type: 'boolean',
      notNull: true,
      default: false,
    },
    modules_visited: {
      type: 'jsonb',
      notNull: true,
      default: '[]',
    },
    last_updated: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('CURRENT_TIMESTAMP'),
    },
    created_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('CURRENT_TIMESTAMP'),
    },
  });

  // Create index on user_id for efficient lookups
  pgm.createIndex('user_onboarding_preferences', 'user_id');

  // Create index on last_updated for potential cleanup/analytics queries
  pgm.createIndex('user_onboarding_preferences', 'last_updated');

  // Add comment to table
  pgm.sql(`
    COMMENT ON TABLE user_onboarding_preferences IS 
    'Stores user preferences for onboarding dialogs and module introductions';
  `);

  // Add comments to columns
  pgm.sql(`
    COMMENT ON COLUMN user_onboarding_preferences.user_id IS 
    'Reference to the organization user';
  `);
  
  pgm.sql(`
    COMMENT ON COLUMN user_onboarding_preferences.welcome_dismissed IS 
    'Whether the user has dismissed the welcome dialog with "don''t show again"';
  `);
  
  pgm.sql(`
    COMMENT ON COLUMN user_onboarding_preferences.modules_visited IS 
    'Array of module IDs (dashboard, users, forms, events, memberships, calendar, payments) that the user has visited';
  `);
  
  pgm.sql(`
    COMMENT ON COLUMN user_onboarding_preferences.last_updated IS 
    'Timestamp of the last preference update';
  `);
};

exports.down = (pgm) => {
  pgm.dropTable('user_onboarding_preferences');
};
