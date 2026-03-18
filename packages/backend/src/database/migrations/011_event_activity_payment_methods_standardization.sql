-- Migration: Standardize event_activities payment method storage
-- Description: Replace allowed_payment_method VARCHAR(20) with supported_payment_methods JSONB array
-- Bug_Condition: isBugCondition(input) where input.field == 'paymentMethodStorage' — database stores VARCHAR(20) instead of JSONB array
-- Expected_Behavior: Database stores supported_payment_methods as JSONB array of UUID strings
-- Preservation: All other columns in event_activities table remain unchanged
-- Requirements: 2.6, 1.6

-- Step 1: Add new supported_payment_methods column as JSONB array (existing rows get default empty array)
ALTER TABLE event_activities ADD COLUMN IF NOT EXISTS supported_payment_methods JSONB DEFAULT '[]'::jsonb;

-- Step 2: Migrate existing data — convert allowed_payment_method values to empty arrays
-- Note: The old column stored hardcoded strings ('card', 'cheque', 'both') which do not correspond
-- to payment method UUIDs, so we initialize all rows with empty arrays. Admins will need to
-- re-select their payment methods from the new dynamic multi-select dropdown.
UPDATE event_activities SET supported_payment_methods = '[]'::jsonb WHERE supported_payment_methods IS NULL;

-- Step 3: Drop the old allowed_payment_method column and its CHECK constraint
ALTER TABLE event_activities DROP COLUMN IF EXISTS allowed_payment_method;

-- Add comment for documentation
COMMENT ON COLUMN event_activities.supported_payment_methods IS 'Array of payment method UUIDs that are supported for this activity';
