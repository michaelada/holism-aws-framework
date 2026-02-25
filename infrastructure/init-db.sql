-- Initialize databases for the AWS Web Application Framework

-- Create keycloak database for Keycloak service
CREATE DATABASE keycloak;

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE aws_framework TO framework_user;
GRANT ALL PRIVILEGES ON DATABASE keycloak TO framework_user;

-- Connect to aws_framework database and create extensions
\c aws_framework;

-- Enable UUID extension for generating UUIDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create initial schema placeholder (migrations will handle actual tables)
CREATE SCHEMA IF NOT EXISTS public;

-- User onboarding preferences table
-- Stores user preferences for onboarding dialogs and help system
CREATE TABLE IF NOT EXISTS user_onboarding_preferences (
  user_id VARCHAR(255) PRIMARY KEY,
  welcome_dismissed BOOLEAN NOT NULL DEFAULT FALSE,
  modules_visited JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_updated TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_onboarding_preferences_user_id ON user_onboarding_preferences(user_id);
