-- Migration: Add payment fee configuration columns
-- Description: Adds fee and handling_fee_included columns to membership_types, registration_types, calendars, and merchandise_types tables
-- Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7

-- Membership types: fee amount and handling fee toggle
ALTER TABLE membership_types ADD COLUMN IF NOT EXISTS fee DECIMAL(10,2) DEFAULT 0.00;
ALTER TABLE membership_types ADD COLUMN IF NOT EXISTS handling_fee_included BOOLEAN DEFAULT false;

-- Registration types: fee amount and handling fee toggle
ALTER TABLE registration_types ADD COLUMN IF NOT EXISTS fee DECIMAL(10,2) DEFAULT 0.00;
ALTER TABLE registration_types ADD COLUMN IF NOT EXISTS handling_fee_included BOOLEAN DEFAULT false;

-- Calendars: handling fee toggle (pricing is defined via time slots)
ALTER TABLE calendars ADD COLUMN IF NOT EXISTS handling_fee_included BOOLEAN DEFAULT false;

-- Merchandise types: handling fee toggle (pricing is defined via merchandise options)
ALTER TABLE merchandise_types ADD COLUMN IF NOT EXISTS handling_fee_included BOOLEAN DEFAULT false;
