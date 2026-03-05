/**
 * Migration: Consolidate Document Management Capabilities
 * Date: 2024-01-30
 * 
 * Consolidates three separate document management capabilities into a single unified capability:
 * - membership-document-management
 * - event-document-management  
 * - registration-document-management
 * 
 * Becomes: document-management
 * 
 * This migration:
 * 1. Creates new 'document-management' capability
 * 2. Migrates organization enabled capabilities
 * 3. Migrates organization type default capabilities
 * 4. Removes old capability records
 */

exports.shorthands = undefined;

exports.up = (pgm) => {
  // ============================================================================
  // PART 1: Create new unified capability
  // ============================================================================
  
  pgm.sql(`
    INSERT INTO capabilities (name, display_name, description, category, is_active, created_at)
    VALUES (
      'document-management',
      'Document Management',
      'Manage document uploads across all modules',
      'additional-feature',
      true,
      NOW()
    )
    ON CONFLICT (name) DO NOTHING
  `);

  // ============================================================================
  // PART 2: Migrate organization enabled capabilities
  // ============================================================================
  
  // Add document-management capability to organizations that have any of the old capabilities
  pgm.sql(`
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
    )
  `);

  // Remove old document management capabilities from all organizations
  pgm.sql(`
    UPDATE organizations
    SET enabled_capabilities = (
      SELECT COALESCE(jsonb_agg(elem), '[]'::jsonb)
      FROM jsonb_array_elements_text(enabled_capabilities) AS elem
      WHERE elem NOT IN ('membership-document-management', 'event-document-management', 'registration-document-management')
    )
    WHERE enabled_capabilities::jsonb ? 'membership-document-management'
       OR enabled_capabilities::jsonb ? 'event-document-management'
       OR enabled_capabilities::jsonb ? 'registration-document-management'
  `);

  // ============================================================================
  // PART 3: Migrate organization type default capabilities
  // ============================================================================
  
  // Add document-management to organization types that have any of the old capabilities
  pgm.sql(`
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
    )
  `);

  // Remove old document management capabilities from all organization types
  pgm.sql(`
    UPDATE organization_types
    SET default_capabilities = (
      SELECT COALESCE(jsonb_agg(elem), '[]'::jsonb)
      FROM jsonb_array_elements_text(default_capabilities) AS elem
      WHERE elem NOT IN ('membership-document-management', 'event-document-management', 'registration-document-management')
    )
    WHERE default_capabilities::jsonb ? 'membership-document-management'
       OR default_capabilities::jsonb ? 'event-document-management'
       OR default_capabilities::jsonb ? 'registration-document-management'
  `);

  // ============================================================================
  // PART 4: Remove old capability records
  // ============================================================================
  
  pgm.sql(`
    DELETE FROM capabilities
    WHERE name IN ('membership-document-management', 'event-document-management', 'registration-document-management')
  `);
};

exports.down = (pgm) => {
  // ============================================================================
  // ROLLBACK: Restore original three capabilities
  // ============================================================================
  
  // Restore the three original capability records
  const oldCapabilities = [
    ['membership-document-management', 'Membership Document Management', 'Manage document uploads for memberships', 'additional-feature'],
    ['event-document-management', 'Event Document Management', 'Manage document uploads for events', 'additional-feature'],
    ['registration-document-management', 'Registration Document Management', 'Manage document uploads for registrations', 'additional-feature'],
  ];

  oldCapabilities.forEach(([name, displayName, description, category]) => {
    pgm.sql(`
      INSERT INTO capabilities (name, display_name, description, category, is_active, created_at)
      VALUES ('${name}', '${displayName}', '${description}', '${category}', true, NOW())
      ON CONFLICT (name) DO NOTHING
    `);
  });

  // ============================================================================
  // ROLLBACK: Migrate organization capabilities back
  // ============================================================================
  
  // Add all three old capabilities to organizations that have document-management
  pgm.sql(`
    UPDATE organizations
    SET enabled_capabilities = (
      SELECT jsonb_agg(DISTINCT elem)
      FROM (
        -- Get all existing capabilities
        SELECT jsonb_array_elements_text(enabled_capabilities) AS elem
        FROM organizations AS o2
        WHERE o2.id = organizations.id
        
        UNION
        
        -- Add all three old capabilities if document-management exists
        SELECT unnest(ARRAY[
          'membership-document-management',
          'event-document-management',
          'registration-document-management'
        ])
        WHERE EXISTS (
          SELECT 1
          FROM jsonb_array_elements_text(organizations.enabled_capabilities) AS cap
          WHERE cap = 'document-management'
        )
      ) AS combined
    )
    WHERE enabled_capabilities::jsonb ? 'document-management'
  `);

  // Remove document-management from all organizations
  pgm.sql(`
    UPDATE organizations
    SET enabled_capabilities = (
      SELECT COALESCE(jsonb_agg(elem), '[]'::jsonb)
      FROM jsonb_array_elements_text(enabled_capabilities) AS elem
      WHERE elem != 'document-management'
    )
    WHERE enabled_capabilities::jsonb ? 'document-management'
  `);

  // ============================================================================
  // ROLLBACK: Migrate organization type default capabilities back
  // ============================================================================
  
  // Add all three old capabilities to organization types that have document-management
  pgm.sql(`
    UPDATE organization_types
    SET default_capabilities = (
      SELECT jsonb_agg(DISTINCT elem)
      FROM (
        -- Get all existing capabilities
        SELECT jsonb_array_elements_text(default_capabilities) AS elem
        FROM organization_types AS ot2
        WHERE ot2.id = organization_types.id
        
        UNION
        
        -- Add all three old capabilities if document-management exists
        SELECT unnest(ARRAY[
          'membership-document-management',
          'event-document-management',
          'registration-document-management'
        ])
        WHERE EXISTS (
          SELECT 1
          FROM jsonb_array_elements_text(organization_types.default_capabilities) AS cap
          WHERE cap = 'document-management'
        )
      ) AS combined
    )
    WHERE default_capabilities::jsonb ? 'document-management'
  `);

  // Remove document-management from all organization types
  pgm.sql(`
    UPDATE organization_types
    SET default_capabilities = (
      SELECT COALESCE(jsonb_agg(elem), '[]'::jsonb)
      FROM jsonb_array_elements_text(default_capabilities) AS elem
      WHERE elem != 'document-management'
    )
    WHERE default_capabilities::jsonb ? 'document-management'
  `);

  // ============================================================================
  // ROLLBACK: Remove document-management capability
  // ============================================================================
  
  pgm.sql(`
    DELETE FROM capabilities
    WHERE name = 'document-management'
  `);
};
