-- Migration: Add discount_ids column to event_activities table
-- Date: 2024-01-29
-- Description: Adds support for storing discount IDs associated with event activities

-- Add discount_ids column as JSONB array
ALTER TABLE event_activities ADD COLUMN IF NOT EXISTS discount_ids JSONB DEFAULT '[]'::jsonb;

-- Create GIN index for efficient querying of discount IDs
CREATE INDEX IF NOT EXISTS idx_event_activities_discount_ids ON event_activities USING GIN (discount_ids);

-- Add comment for documentation
COMMENT ON COLUMN event_activities.discount_ids IS 'Array of discount IDs that apply to this activity';
