-- Migration: Add discount_ids column to membership_types table
-- Date: 2024-01-30
-- Description: Adds support for storing discount IDs associated with membership types

-- Add discount_ids column as JSONB array
ALTER TABLE membership_types ADD COLUMN IF NOT EXISTS discount_ids JSONB DEFAULT '[]'::jsonb;

-- Create GIN index for efficient querying of discount IDs
CREATE INDEX IF NOT EXISTS idx_membership_types_discount_ids ON membership_types USING GIN (discount_ids);

-- Add comment for documentation
COMMENT ON COLUMN membership_types.discount_ids IS 'Array of discount IDs that apply to this membership type';
