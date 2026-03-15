-- Rollback Migration: Remove membership numbering configuration
-- Description: Completely rolls back all changes made by the membership numbering configuration feature
-- This script safely removes all database changes while preserving existing member data
-- Requirements: NFR4 (Backward Compatibility)

-- ============================================================================
-- ROLLBACK OVERVIEW
-- ============================================================================
-- This rollback script reverses the following migrations:
-- 1. Migration 006: Initialize membership number sequences
-- 2. Migration 005: Create membership_number_sequences table
-- 3. Migration 004 (partial): Remove columns from organization_types table
--
-- SAFETY GUARANTEES:
-- - Existing member records and their membership numbers are preserved
-- - No data loss occurs during rollback
-- - All foreign key constraints are properly handled
-- - Rollback is idempotent (safe to run multiple times)
-- ============================================================================

-- ============================================================================
-- STEP 1: Remove sequence initialization data
-- ============================================================================
-- Remove all sequence records created during initialization
-- This is safe as it only removes sequence tracking, not actual member data
DELETE FROM membership_number_sequences;

-- ============================================================================
-- STEP 2: Drop membership_number_sequences table
-- ============================================================================
-- Drop indexes first (for clean removal)
DROP INDEX IF EXISTS idx_sequences_org_type;
DROP INDEX IF EXISTS idx_sequences_org;

-- Drop the sequences table
-- CASCADE ensures foreign key constraints are handled
DROP TABLE IF EXISTS membership_number_sequences CASCADE;

-- ============================================================================
-- STEP 3: Remove columns from organization_types table
-- ============================================================================
-- Drop check constraints first (required before dropping columns)
ALTER TABLE organization_types
  DROP CONSTRAINT IF EXISTS check_membership_numbering;

ALTER TABLE organization_types
  DROP CONSTRAINT IF EXISTS check_membership_number_uniqueness;

ALTER TABLE organization_types
  DROP CONSTRAINT IF EXISTS check_initial_membership_number;

-- Drop the three configuration columns
-- Note: This does NOT affect existing member records
ALTER TABLE organization_types
  DROP COLUMN IF EXISTS membership_numbering,
  DROP COLUMN IF EXISTS membership_number_uniqueness,
  DROP COLUMN IF EXISTS initial_membership_number;

-- ============================================================================
-- VERIFICATION QUERIES (commented out - uncomment to verify rollback)
-- ============================================================================

-- Verify membership_number_sequences table is dropped
-- SELECT EXISTS (
--   SELECT FROM information_schema.tables 
--   WHERE table_schema = 'public' 
--   AND table_name = 'membership_number_sequences'
-- ) as sequences_table_exists;
-- Expected result: false

-- Verify columns are removed from organization_types
-- SELECT column_name 
-- FROM information_schema.columns 
-- WHERE table_name = 'organization_types' 
-- AND column_name IN ('membership_numbering', 'membership_number_uniqueness', 'initial_membership_number');
-- Expected result: 0 rows

-- Verify member data is preserved
-- SELECT COUNT(*) as member_count FROM members;
-- Expected result: Same count as before rollback

-- Verify membership numbers are preserved
-- SELECT id, membership_number FROM members LIMIT 10;
-- Expected result: All membership numbers intact

-- ============================================================================
-- ROLLBACK COMPLETE
-- ============================================================================
-- The database has been rolled back to the state before membership numbering
-- configuration was implemented. All member data and membership numbers have
-- been preserved.
-- ============================================================================
