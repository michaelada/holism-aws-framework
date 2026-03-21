-- Migration: Add discount_ids column to calendars table
-- Allows associating discounts with specific calendars (same pattern as membership_types)

ALTER TABLE calendars ADD COLUMN IF NOT EXISTS discount_ids JSONB DEFAULT '[]'::jsonb;
