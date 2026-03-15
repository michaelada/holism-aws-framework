-- Rollback Migration: Remove initialized membership number sequences
-- Description: Removes all sequence records created during initialization
-- This rollback is safe as it only removes sequence tracking, not actual member data

-- Remove all sequence records
-- Note: This does not affect existing member records or their membership numbers
DELETE FROM membership_number_sequences;

-- Reset the table comment
COMMENT ON TABLE membership_number_sequences IS 'Tracks sequential membership number generation for organizations using internal numbering mode';
