-- Migration: Add discount_ids column to events table
-- Date: 2024-01-29
-- Description: Adds support for storing discount IDs associated with events

-- Add discount_ids column as JSONB array
ALTER TABLE events ADD COLUMN IF NOT EXISTS discount_ids JSONB DEFAULT '[]'::jsonb;

-- Create GIN index for efficient querying of discount IDs
CREATE INDEX IF NOT EXISTS idx_events_discount_ids ON events USING GIN (discount_ids);

-- Add comment for documentation
COMMENT ON COLUMN events.discount_ids IS 'Array of discount IDs that apply to this event';
