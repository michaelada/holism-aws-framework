-- Migration: Add discount_ids column to registration_types table
-- Description: Adds support for storing discount IDs associated with registration types
-- Bug_Condition: isBugCondition(input) — no discount_ids column exists on registration_types table
-- Requirements: 2.1, 2.2, 2.3

-- Add discount_ids column as JSONB array (existing rows get default empty array)
ALTER TABLE registration_types ADD COLUMN IF NOT EXISTS discount_ids JSONB DEFAULT '[]'::jsonb;

-- Create GIN index for efficient querying of discount IDs (used by getRegistrationTypesUsingDiscount)
CREATE INDEX IF NOT EXISTS idx_registration_types_discount_ids ON registration_types USING GIN (discount_ids);

-- Add comment for documentation
COMMENT ON COLUMN registration_types.discount_ids IS 'Array of discount IDs that apply to this registration type';
