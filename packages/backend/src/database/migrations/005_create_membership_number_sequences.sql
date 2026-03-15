-- Migration: Create membership_number_sequences table
-- Description: Tracks sequential membership number generation for internal numbering mode
-- Requirements: FR1, 2.3

-- Create membership_number_sequences table
CREATE TABLE IF NOT EXISTS membership_number_sequences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_type_id UUID NOT NULL,
  organization_id UUID,
  next_number INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  -- Ensure one sequence per scope (organization_type_id, organization_id combination)
  CONSTRAINT unique_sequence_scope UNIQUE(organization_type_id, organization_id)
);

-- Add foreign key constraints
-- Note: These reference tables that should already exist in the system
ALTER TABLE membership_number_sequences
  ADD CONSTRAINT fk_sequences_organization_type
  FOREIGN KEY (organization_type_id) 
  REFERENCES organization_types(id) 
  ON DELETE CASCADE;

ALTER TABLE membership_number_sequences
  ADD CONSTRAINT fk_sequences_organization
  FOREIGN KEY (organization_id) 
  REFERENCES organizations(id) 
  ON DELETE CASCADE;

-- Create indexes for performance optimization
CREATE INDEX IF NOT EXISTS idx_sequences_org_type 
  ON membership_number_sequences(organization_type_id);

CREATE INDEX IF NOT EXISTS idx_sequences_org 
  ON membership_number_sequences(organization_id);

-- Add table and column comments
COMMENT ON TABLE membership_number_sequences IS 'Tracks sequential membership number generation for organizations using internal numbering mode';
COMMENT ON COLUMN membership_number_sequences.id IS 'Unique identifier for the sequence record';
COMMENT ON COLUMN membership_number_sequences.organization_type_id IS 'Reference to the organization type this sequence belongs to';
COMMENT ON COLUMN membership_number_sequences.organization_id IS 'Reference to the organization (NULL for organization type-level sequences)';
COMMENT ON COLUMN membership_number_sequences.next_number IS 'The next membership number to be assigned';
COMMENT ON COLUMN membership_number_sequences.created_at IS 'Timestamp when the sequence was created';
COMMENT ON COLUMN membership_number_sequences.updated_at IS 'Timestamp when the sequence was last updated';
