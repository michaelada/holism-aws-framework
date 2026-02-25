-- Migration: Create user_onboarding_preferences table
-- Description: Stores user preferences for onboarding dialogs and help system
-- Requirements: 4.1, 4.2, 9.5

-- Create user onboarding preferences table
CREATE TABLE IF NOT EXISTS user_onboarding_preferences (
  user_id VARCHAR(255) PRIMARY KEY,
  welcome_dismissed BOOLEAN NOT NULL DEFAULT FALSE,
  modules_visited JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_updated TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_onboarding_preferences_user_id 
  ON user_onboarding_preferences(user_id);

-- Add comment to table
COMMENT ON TABLE user_onboarding_preferences IS 'Stores user preferences for onboarding dialogs and contextual help system';
COMMENT ON COLUMN user_onboarding_preferences.user_id IS 'User ID from Keycloak JWT token';
COMMENT ON COLUMN user_onboarding_preferences.welcome_dismissed IS 'Whether the user has permanently dismissed the welcome dialog';
COMMENT ON COLUMN user_onboarding_preferences.modules_visited IS 'Array of module IDs whose introduction dialogs have been dismissed';
COMMENT ON COLUMN user_onboarding_preferences.created_at IS 'Timestamp when the preferences were first created';
COMMENT ON COLUMN user_onboarding_preferences.last_updated IS 'Timestamp when the preferences were last updated';
