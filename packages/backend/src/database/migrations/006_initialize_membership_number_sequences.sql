-- Migration: Initialize membership number sequences for existing organizations
-- Description: Populates sequences for existing organizations with internal numbering
-- Requirements: 6.1, 6.2

-- Initialize sequences for organizations with organization-level uniqueness
-- This finds the highest numeric membership number per organization and sets next_number accordingly
INSERT INTO membership_number_sequences (organization_type_id, organization_id, next_number)
SELECT 
  o.organization_type_id,
  o.id as organization_id,
  COALESCE(
    (
      SELECT MAX(
        CASE 
          -- Extract numeric value from membership numbers that are purely numeric
          WHEN m.membership_number ~ '^\d+$' 
          THEN CAST(m.membership_number AS INTEGER)
          -- Extract numeric value from membership numbers with non-numeric characters
          -- This handles formats like "PREFIX-123" or "ABC123"
          WHEN m.membership_number ~ '\d+' 
          THEN CAST(REGEXP_REPLACE(m.membership_number, '[^\d]', '', 'g') AS INTEGER)
          ELSE NULL
        END
      ) + 1
      FROM members m
      WHERE m.organisation_id = o.id
      AND (
        m.membership_number ~ '^\d+$' 
        OR m.membership_number ~ '\d+'
      )
    ),
    -- Use the configured initial_membership_number from organization_types, or default to 1000000
    COALESCE(ot.initial_membership_number, 1000000)
  ) as next_number
FROM organizations o
JOIN organization_types ot ON ot.id = o.organization_type_id
WHERE ot.membership_numbering = 'internal'
  AND ot.membership_number_uniqueness = 'organization'
ON CONFLICT (organization_type_id, organization_id) DO NOTHING;

-- Initialize sequences for organizations with organization type-level uniqueness
-- This finds the highest numeric membership number across all organizations of the same type
INSERT INTO membership_number_sequences (organization_type_id, organization_id, next_number)
SELECT 
  ot.id as organization_type_id,
  NULL as organization_id,
  COALESCE(
    (
      SELECT MAX(
        CASE 
          -- Extract numeric value from membership numbers that are purely numeric
          WHEN m.membership_number ~ '^\d+$' 
          THEN CAST(m.membership_number AS INTEGER)
          -- Extract numeric value from membership numbers with non-numeric characters
          WHEN m.membership_number ~ '\d+' 
          THEN CAST(REGEXP_REPLACE(m.membership_number, '[^\d]', '', 'g') AS INTEGER)
          ELSE NULL
        END
      ) + 1
      FROM members m
      JOIN organizations o ON o.id = m.organisation_id
      WHERE o.organization_type_id = ot.id
      AND (
        m.membership_number ~ '^\d+$' 
        OR m.membership_number ~ '\d+'
      )
    ),
    -- Use the configured initial_membership_number from organization_types, or default to 1000000
    COALESCE(ot.initial_membership_number, 1000000)
  ) as next_number
FROM organization_types ot
WHERE ot.membership_numbering = 'internal'
  AND ot.membership_number_uniqueness = 'organization_type'
ON CONFLICT (organization_type_id, organization_id) DO NOTHING;

-- Add comments for documentation
COMMENT ON TABLE membership_number_sequences IS 'Initialized with highest existing membership numbers + 1, or default initial_membership_number';
