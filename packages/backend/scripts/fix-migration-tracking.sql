-- Fix Migration Tracking for Onboarding Preferences
-- 
-- This script manually marks migration #23 as completed in the pgmigrations table
-- Use this when the table already exists but the migration wasn't tracked
--
-- IMPORTANT: Only run this if you've confirmed that the user_onboarding_preferences
-- table already exists in your database

-- Check if the table exists
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_schema = 'public' 
  AND table_name = 'user_onboarding_preferences'
);
-- If the above returns 't' (true), proceed with the insert below

-- Manually mark migration #23 as completed
INSERT INTO pgmigrations (name, run_on)
VALUES ('1707000000023_create-onboarding-preferences-table', NOW())
ON CONFLICT (name) DO NOTHING;

-- Verify the migration is now tracked
SELECT * FROM pgmigrations 
WHERE name = '1707000000023_create-onboarding-preferences-table';
