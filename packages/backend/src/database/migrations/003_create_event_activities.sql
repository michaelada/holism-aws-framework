-- Migration: Create event_activities table
-- Description: Store activities associated with events

-- Create event_activities table
CREATE TABLE IF NOT EXISTS event_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  show_publicly BOOLEAN DEFAULT true,
  application_form_id UUID,
  limit_applicants BOOLEAN DEFAULT false,
  applicants_limit INTEGER,
  allow_specify_quantity BOOLEAN DEFAULT false,
  use_terms_and_conditions BOOLEAN DEFAULT false,
  terms_and_conditions TEXT,
  fee DECIMAL(10, 2) DEFAULT 0,
  allowed_payment_method VARCHAR(20) DEFAULT 'both' CHECK (allowed_payment_method IN ('card', 'cheque', 'both')),
  handling_fee_included BOOLEAN DEFAULT false,
  cheque_payment_instructions TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create index on event_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_event_activities_event_id ON event_activities(event_id);

-- Add comment to table
COMMENT ON TABLE event_activities IS 'Activities associated with events that users can register for';
