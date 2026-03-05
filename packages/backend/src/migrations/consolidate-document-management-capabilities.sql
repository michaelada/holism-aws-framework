-- Migration: Consolidate Document Management Capabilities
-- Date: 2024-01-30
-- Description: Consolidates three separate document management capabilities 
--              (membership-document-management, event-document-management, registration-document-management)
--              into a single unified 'document-management' capability.
--              This migration preserves all existing functionality while simplifying capability management.

-- ============================================================================
-- PART 1: Create new unified capability
-- ============================================================================

-- Insert the new document-management capability
INSERT INTO capabilities (name, display_name, description, category, is_active, created_at)
VALUES (
  'document-management',
  'Document Management',
  'Manage document uploads across all modules',
  'additional-feature',
  true,
  NOW()
)
ON CONFLICT (name) DO NOTHING;

-- ============================================================================
-- PART 2: Migrate organization enabled capabilities
-- ============================================================================

-- Add document-management capability to organizations that have any of the old capabilities
-- This uses a subquery to identify organizations with at least one old capability
UPDATE organizations
SET enabled_capabilities = (
  SELECT jsonb_agg(DISTINCT elem)
  FROM (
    -- Get all existing capabilities
    SELECT jsonb_array_elements_text(enabled_capabilities) AS elem
    FROM organizations AS o2
    WHERE o2.id = organizations.id
    
    UNION
    
    -- Add document-management if any old capability exists
    SELECT 'document-management'
    WHERE EXISTS (
      SELECT 1
      FROM jsonb_array_elements_text(organizations.enabled_capabilities) AS cap
      WHERE cap IN ('membership-document-management', 'event-document-management', 'registration-document-management')
    )
  ) AS combined
)
WHERE EXISTS (
  SELECT 1
  FROM jsonb_array_elements_text(enabled_capabilities) AS cap
  WHERE cap IN ('membership-document-management', 'event-document-management', 'registration-document-management')
);

-- Remove old document management capabilities from all organizations
UPDATE organizations
SET enabled_capabilities = (
  SELECT COALESCE(jsonb_agg(elem), '[]'::jsonb)
  FROM jsonb_array_elements_text(enabled_capabilities) AS elem
  WHERE elem NOT IN ('membership-document-management', 'event-document-management', 'registration-document-management')
)
WHERE enabled_capabilities::jsonb ? 'membership-document-management'
   OR enabled_capabilities::jsonb ? 'event-document-management'
   OR enabled_capabilities::jsonb ? 'registration-document-management';

-- ============================================================================
-- PART 3: Migrate organization type default capabilities
-- ============================================================================

-- Add document-management to organization types that have any of the old capabilities
UPDATE organization_types
SET default_capabilities = (
  SELECT jsonb_agg(DISTINCT elem)
  FROM (
    -- Get all existing capabilities
    SELECT jsonb_array_elements_text(default_capabilities) AS elem
    FROM organization_types AS ot2
    WHERE ot2.id = organization_types.id
    
    UNION
    
    -- Add document-management if any old capability exists
    SELECT 'document-management'
    WHERE EXISTS (
      SELECT 1
      FROM jsonb_array_elements_text(organization_types.default_capabilities) AS cap
      WHERE cap IN ('membership-document-management', 'event-document-management', 'registration-document-management')
    )
  ) AS combined
)
WHERE EXISTS (
  SELECT 1
  FROM jsonb_array_elements_text(default_capabilities) AS cap
  WHERE cap IN ('membership-document-management', 'event-document-management', 'registration-document-management')
);

-- Remove old document management capabilities from all organization types
UPDATE organization_types
SET default_capabilities = (
  SELECT COALESCE(jsonb_agg(elem), '[]'::jsonb)
  FROM jsonb_array_elements_text(default_capabilities) AS elem
  WHERE elem NOT IN ('membership-document-management', 'event-document-management', 'registration-document-management')
)
WHERE default_capabilities::jsonb ? 'membership-document-management'
   OR default_capabilities::jsonb ? 'event-document-management'
   OR default_capabilities::jsonb ? 'registration-document-management';

-- ============================================================================
-- PART 4: Remove old capability records
-- ============================================================================

-- Mark old capabilities as inactive (soft delete for safety)
UPDATE capabilities
SET is_active = false
WHERE name IN ('membership-document-management', 'event-document-management', 'registration-document-management');

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================
-- 
-- HOW TO USE THESE QUERIES:
-- 1. Run these queries BEFORE the migration to capture baseline state
-- 2. Run the migration
-- 3. Run these queries AFTER the migration to verify correctness
-- 4. Compare before/after results to ensure data integrity
--
-- EXPECTED RESULTS AFTER MIGRATION:
-- - Query 1: Should return 1 row with document-management capability (is_active = true)
-- - Query 2: Should return 3 rows with old capabilities (is_active = false)
-- - Query 3: Should show organizations that previously had any old capability now have document-management
-- - Query 4: Should return 0 rows (no organizations should have old capabilities)
-- - Query 5: Should show organization types that previously had any old capability now have document-management
-- - Query 6: Should return 0 rows (no organization types should have old capabilities in defaults)
-- - Query 7: Should show same counts as before migration (fields preserved)
-- - Query 8: Should return 0 rows (document-management added exactly once per organization)
-- - Query 9: Should match count from Query 3 (all orgs with old caps got new cap)
-- ============================================================================

-- 1. Verify new capability exists and is active
-- SELECT name, display_name, description, category, is_active, created_at 
-- FROM capabilities 
-- WHERE name = 'document-management';

-- 2. Verify old capabilities are marked inactive
-- SELECT name, display_name, is_active 
-- FROM capabilities 
-- WHERE name IN ('membership-document-management', 'event-document-management', 'registration-document-management')
-- ORDER BY name;

-- 3. Check organizations with document-management capability
-- SELECT id, name, enabled_capabilities 
-- FROM organizations 
-- WHERE enabled_capabilities::jsonb ? 'document-management'
-- ORDER BY name;

-- 4. Verify no organizations have old capabilities (should return 0 rows)
-- SELECT id, name, enabled_capabilities 
-- FROM organizations 
-- WHERE enabled_capabilities::jsonb ? 'membership-document-management'
--    OR enabled_capabilities::jsonb ? 'event-document-management'
--    OR enabled_capabilities::jsonb ? 'registration-document-management';

-- 5. Check organization types with document-management in defaults
-- SELECT id, name, default_capabilities 
-- FROM organization_types 
-- WHERE default_capabilities::jsonb ? 'document-management'
-- ORDER BY name;

-- 6. Verify no organization types have old capabilities in defaults (should return 0 rows)
-- SELECT id, name, default_capabilities 
-- FROM organization_types 
-- WHERE default_capabilities::jsonb ? 'membership-document-management'
--    OR default_capabilities::jsonb ? 'event-document-management'
--    OR default_capabilities::jsonb ? 'registration-document-management';

-- 7. Verify existing document upload fields are preserved
-- Run this BEFORE and AFTER migration - counts should match exactly
-- SELECT 
--   (SELECT COUNT(*) FROM field_definitions WHERE datatype = 'file') as file_fields_count,
--   (SELECT COUNT(*) FROM field_definitions WHERE datatype = 'image') as image_fields_count,
--   (SELECT COUNT(*) FROM field_definitions WHERE datatype IN ('file', 'image')) as total_document_fields;

-- 8. Verify document-management capability added exactly once per organization (should return 0 rows)
-- This checks for duplicate entries which would indicate a migration error
-- SELECT id, name, enabled_capabilities,
--   (SELECT COUNT(*) 
--    FROM jsonb_array_elements_text(enabled_capabilities) AS cap 
--    WHERE cap = 'document-management') as doc_mgmt_count
-- FROM organizations
-- WHERE enabled_capabilities::jsonb ? 'document-management'
--   AND (SELECT COUNT(*) 
--        FROM jsonb_array_elements_text(enabled_capabilities) AS cap 
--        WHERE cap = 'document-management') > 1;

-- 9. Verify migration completeness - count organizations that should have received new capability
-- This should match the count from Query 3
-- SELECT COUNT(DISTINCT id) as orgs_that_had_old_capabilities
-- FROM organizations,
--      jsonb_array_elements_text(enabled_capabilities) AS cap
-- WHERE cap IN ('membership-document-management', 'event-document-management', 'registration-document-management');
-- Note: Run this BEFORE migration to get expected count, then compare with Query 3 results AFTER migration

-- 10. Detailed field preservation check - verify all document fields by organization
-- Run this BEFORE and AFTER migration - results should be identical
-- SELECT 
--   fd.id,
--   fd.short_name,
--   fd.display_name,
--   fd.datatype,
--   fd.organisation_id,
--   o.name as organization_name
-- FROM field_definitions fd
-- JOIN organizations o ON fd.organisation_id = o.id
-- WHERE fd.datatype IN ('file', 'image')
-- ORDER BY o.name, fd.short_name;

-- ============================================================================
-- NOTES
-- ============================================================================

-- This migration:
-- 1. Creates a new 'document-management' capability
-- 2. Adds 'document-management' to any organization with at least one old capability
-- 3. Removes all three old capabilities from organizations (no duplicates)
-- 4. Updates organization type defaults similarly
-- 5. Marks old capabilities as inactive (preserves data for rollback)
-- 6. Does NOT modify any field_definitions (preserves existing document fields)

-- The migration is idempotent - it can be run multiple times safely due to:
-- - ON CONFLICT DO NOTHING for capability insertion
-- - Conditional updates based on existence checks
-- - Soft delete of old capabilities (can be restored in rollback)

-- Rollback support is provided in the companion down migration file.
