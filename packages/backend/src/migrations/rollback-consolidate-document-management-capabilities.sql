-- Rollback Migration: Consolidate Document Management Capabilities
-- Date: 2024-01-30
-- Description: Rolls back the consolidation of document management capabilities.
--              Restores the three original capabilities (membership-document-management,
--              event-document-management, registration-document-management) and migrates
--              organizations back to the original state.
--              This provides a safety net for production deployment.

-- ============================================================================
-- PART 1: Restore three original capability records
-- ============================================================================

-- Restore membership-document-management capability
INSERT INTO capabilities (name, display_name, description, category, is_active, created_at)
VALUES (
  'membership-document-management',
  'Membership Document Management',
  'Manage document uploads for membership forms',
  'additional-feature',
  true,
  NOW()
)
ON CONFLICT (name) DO UPDATE
SET is_active = true,
    display_name = EXCLUDED.display_name,
    description = EXCLUDED.description;

-- Restore event-document-management capability
INSERT INTO capabilities (name, display_name, description, category, is_active, created_at)
VALUES (
  'event-document-management',
  'Event Document Management',
  'Manage document uploads for event forms',
  'additional-feature',
  true,
  NOW()
)
ON CONFLICT (name) DO UPDATE
SET is_active = true,
    display_name = EXCLUDED.display_name,
    description = EXCLUDED.description;

-- Restore registration-document-management capability
INSERT INTO capabilities (name, display_name, description, category, is_active, created_at)
VALUES (
  'registration-document-management',
  'Registration Document Management',
  'Manage document uploads for registration forms',
  'additional-feature',
  true,
  NOW()
)
ON CONFLICT (name) DO UPDATE
SET is_active = true,
    display_name = EXCLUDED.display_name,
    description = EXCLUDED.description;

-- ============================================================================
-- PART 2: Migrate organization capabilities back to original state
-- ============================================================================

-- Add all three original capabilities to organizations that have document-management
UPDATE organizations
SET enabled_capabilities = (
  SELECT jsonb_agg(DISTINCT elem)
  FROM (
    -- Get all existing capabilities
    SELECT jsonb_array_elements_text(enabled_capabilities) AS elem
    FROM organizations AS o2
    WHERE o2.id = organizations.id
    
    UNION
    
    -- Add all three original capabilities if document-management exists
    SELECT 'membership-document-management'
    WHERE enabled_capabilities::jsonb ? 'document-management'
    
    UNION
    
    SELECT 'event-document-management'
    WHERE enabled_capabilities::jsonb ? 'document-management'
    
    UNION
    
    SELECT 'registration-document-management'
    WHERE enabled_capabilities::jsonb ? 'document-management'
  ) AS combined
)
WHERE enabled_capabilities::jsonb ? 'document-management';

-- Remove document-management capability from all organizations
UPDATE organizations
SET enabled_capabilities = (
  SELECT COALESCE(jsonb_agg(elem), '[]'::jsonb)
  FROM jsonb_array_elements_text(enabled_capabilities) AS elem
  WHERE elem != 'document-management'
)
WHERE enabled_capabilities::jsonb ? 'document-management';

-- ============================================================================
-- PART 3: Migrate organization type default capabilities back
-- ============================================================================

-- Add all three original capabilities to organization types that have document-management
UPDATE organization_types
SET default_capabilities = (
  SELECT jsonb_agg(DISTINCT elem)
  FROM (
    -- Get all existing capabilities
    SELECT jsonb_array_elements_text(default_capabilities) AS elem
    FROM organization_types AS ot2
    WHERE ot2.id = organization_types.id
    
    UNION
    
    -- Add all three original capabilities if document-management exists
    SELECT 'membership-document-management'
    WHERE default_capabilities::jsonb ? 'document-management'
    
    UNION
    
    SELECT 'event-document-management'
    WHERE default_capabilities::jsonb ? 'document-management'
    
    UNION
    
    SELECT 'registration-document-management'
    WHERE default_capabilities::jsonb ? 'document-management'
  ) AS combined
)
WHERE default_capabilities::jsonb ? 'document-management';

-- Remove document-management capability from all organization types
UPDATE organization_types
SET default_capabilities = (
  SELECT COALESCE(jsonb_agg(elem), '[]'::jsonb)
  FROM jsonb_array_elements_text(default_capabilities) AS elem
  WHERE elem != 'document-management'
)
WHERE default_capabilities::jsonb ? 'document-management';

-- ============================================================================
-- PART 4: Remove document-management capability
-- ============================================================================

-- Mark document-management capability as inactive (soft delete for safety)
UPDATE capabilities
SET is_active = false
WHERE name = 'document-management';

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================
--
-- HOW TO USE THESE QUERIES:
-- 1. Run these queries BEFORE the rollback to capture current state
-- 2. Run the rollback migration
-- 3. Run these queries AFTER the rollback to verify correctness
-- 4. Compare before/after results to ensure proper restoration
--
-- EXPECTED RESULTS AFTER ROLLBACK:
-- - Query 1: Should return 3 rows with original capabilities (all is_active = true)
-- - Query 2: Should return 1 row with document-management (is_active = false)
-- - Query 3: Should show organizations that previously had document-management now have all 3 old capabilities
-- - Query 4: Should return 0 rows (no organizations should have document-management)
-- - Query 5: Should show organization types that previously had document-management now have all 3 old capabilities
-- - Query 6: Should return 0 rows (no organization types should have document-management in defaults)
-- - Query 7: Should show same counts as before rollback (fields preserved)
-- - Query 8: Should return 0 rows (each old capability added exactly once per organization)
-- - Query 9: Should match count from Query 3 (all orgs with document-management got old caps)
-- ============================================================================

-- 1. Verify three original capabilities are active
-- SELECT name, display_name, description, category, is_active, created_at 
-- FROM capabilities 
-- WHERE name IN ('membership-document-management', 'event-document-management', 'registration-document-management')
-- ORDER BY name;

-- 2. Verify document-management capability is inactive
-- SELECT name, display_name, is_active 
-- FROM capabilities 
-- WHERE name = 'document-management';

-- 3. Check organizations with original capabilities
-- SELECT id, name, enabled_capabilities 
-- FROM organizations 
-- WHERE enabled_capabilities::jsonb ? 'membership-document-management'
--    OR enabled_capabilities::jsonb ? 'event-document-management'
--    OR enabled_capabilities::jsonb ? 'registration-document-management'
-- ORDER BY name;

-- 4. Verify no organizations have document-management capability (should return 0 rows)
-- SELECT id, name, enabled_capabilities 
-- FROM organizations 
-- WHERE enabled_capabilities::jsonb ? 'document-management';

-- 5. Check organization types with original capabilities in defaults
-- SELECT id, name, default_capabilities 
-- FROM organization_types 
-- WHERE default_capabilities::jsonb ? 'membership-document-management'
--    OR default_capabilities::jsonb ? 'event-document-management'
--    OR default_capabilities::jsonb ? 'registration-document-management'
-- ORDER BY name;

-- 6. Verify no organization types have document-management in defaults (should return 0 rows)
-- SELECT id, name, default_capabilities 
-- FROM organization_types 
-- WHERE default_capabilities::jsonb ? 'document-management';

-- 7. Verify existing document upload fields are still preserved
-- Run this BEFORE and AFTER rollback - counts should match exactly
-- SELECT 
--   (SELECT COUNT(*) FROM field_definitions WHERE datatype = 'file') as file_fields_count,
--   (SELECT COUNT(*) FROM field_definitions WHERE datatype = 'image') as image_fields_count,
--   (SELECT COUNT(*) FROM field_definitions WHERE datatype IN ('file', 'image')) as total_document_fields;

-- 8. Verify each old capability added exactly once per organization (should return 0 rows)
-- This checks for duplicate entries which would indicate a rollback error
-- SELECT id, name, enabled_capabilities,
--   (SELECT COUNT(*) FROM jsonb_array_elements_text(enabled_capabilities) AS cap WHERE cap = 'membership-document-management') as membership_count,
--   (SELECT COUNT(*) FROM jsonb_array_elements_text(enabled_capabilities) AS cap WHERE cap = 'event-document-management') as event_count,
--   (SELECT COUNT(*) FROM jsonb_array_elements_text(enabled_capabilities) AS cap WHERE cap = 'registration-document-management') as registration_count
-- FROM organizations
-- WHERE (enabled_capabilities::jsonb ? 'membership-document-management'
--    OR enabled_capabilities::jsonb ? 'event-document-management'
--    OR enabled_capabilities::jsonb ? 'registration-document-management')
--   AND ((SELECT COUNT(*) FROM jsonb_array_elements_text(enabled_capabilities) AS cap WHERE cap = 'membership-document-management') > 1
--    OR (SELECT COUNT(*) FROM jsonb_array_elements_text(enabled_capabilities) AS cap WHERE cap = 'event-document-management') > 1
--    OR (SELECT COUNT(*) FROM jsonb_array_elements_text(enabled_capabilities) AS cap WHERE cap = 'registration-document-management') > 1);

-- 9. Verify rollback completeness - count organizations that should have received old capabilities
-- This should match the count from Query 3
-- SELECT COUNT(DISTINCT id) as orgs_that_had_document_management
-- FROM organizations
-- WHERE enabled_capabilities::jsonb ? 'document-management';
-- Note: Run this BEFORE rollback to get expected count, then compare with Query 3 results AFTER rollback

-- 10. Detailed field preservation check - verify all document fields by organization
-- Run this BEFORE and AFTER rollback - results should be identical
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

-- 11. Verify all organizations with document-management received all three old capabilities
-- This query checks that the rollback properly restored all three capabilities
-- SELECT 
--   id,
--   name,
--   enabled_capabilities,
--   (enabled_capabilities::jsonb ? 'membership-document-management') as has_membership,
--   (enabled_capabilities::jsonb ? 'event-document-management') as has_event,
--   (enabled_capabilities::jsonb ? 'registration-document-management') as has_registration
-- FROM organizations
-- WHERE enabled_capabilities::jsonb ? 'membership-document-management'
--    OR enabled_capabilities::jsonb ? 'event-document-management'
--    OR enabled_capabilities::jsonb ? 'registration-document-management'
-- ORDER BY name;
-- Note: All three boolean columns should be TRUE for each organization that had document-management

-- ============================================================================
-- NOTES
-- ============================================================================

-- This rollback migration:
-- 1. Restores the three original capability records (or reactivates if they exist)
-- 2. Adds all three original capabilities to any organization with document-management
-- 3. Removes document-management from all organizations
-- 4. Updates organization type defaults similarly
-- 5. Marks document-management capability as inactive (preserves data)
-- 6. Does NOT modify any field_definitions (preserves existing document fields)

-- The rollback is idempotent - it can be run multiple times safely due to:
-- - ON CONFLICT DO UPDATE for capability restoration
-- - Conditional updates based on existence checks
-- - Soft delete of document-management capability

-- Important considerations:
-- - Organizations that had document-management will get ALL THREE original capabilities
-- - This is intentional to ensure no loss of functionality during rollback
-- - Administrators can manually remove unneeded capabilities after rollback if desired
-- - All existing document upload fields remain functional throughout the rollback

-- To re-apply the consolidation after rollback, run the forward migration again.
