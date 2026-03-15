/**
 * Integration tests for organization type membership numbering configuration
 * Tests the complete flow of creating organization types with numbering configuration
 */

import { db } from '../../database/pool';
import { organizationTypeService } from '../organization-type.service';

describe('OrganizationType Membership Numbering Integration', () => {
  let testOrgTypeIds: string[] = [];

  beforeAll(async () => {
    // Initialize database connection
    try {
      await db.initialize();
    } catch (error) {
      console.log('Database initialization:', error instanceof Error ? error.message : 'Already initialized');
    }

    // Add membership numbering columns to organization_types table if they don't exist
    try {
      await db.query(`
        ALTER TABLE organization_types
        ADD COLUMN IF NOT EXISTS membership_numbering VARCHAR(20) DEFAULT 'internal',
        ADD COLUMN IF NOT EXISTS membership_number_uniqueness VARCHAR(20) DEFAULT 'organization',
        ADD COLUMN IF NOT EXISTS initial_membership_number INTEGER DEFAULT 1000000;
      `);

      await db.query(`
        ALTER TABLE organization_types
        DROP CONSTRAINT IF EXISTS check_membership_numbering;
        
        ALTER TABLE organization_types
        ADD CONSTRAINT check_membership_numbering 
        CHECK (membership_numbering IN ('internal', 'external'));
      `);

      await db.query(`
        ALTER TABLE organization_types
        DROP CONSTRAINT IF EXISTS check_membership_number_uniqueness;
        
        ALTER TABLE organization_types
        ADD CONSTRAINT check_membership_number_uniqueness 
        CHECK (membership_number_uniqueness IN ('organization_type', 'organization'));
      `);

      await db.query(`
        ALTER TABLE organization_types
        DROP CONSTRAINT IF EXISTS check_initial_membership_number;
        
        ALTER TABLE organization_types
        ADD CONSTRAINT check_initial_membership_number 
        CHECK (initial_membership_number > 0);
      `);
    } catch (error) {
      console.log('Column setup:', error instanceof Error ? error.message : 'Columns may already exist');
    }

    // Ensure membership_number_sequences table exists
    await db.query(`
      CREATE TABLE IF NOT EXISTS membership_number_sequences (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_type_id UUID NOT NULL,
        organization_id UUID,
        next_number INTEGER NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT unique_sequence_scope UNIQUE(organization_type_id, organization_id)
      );
    `);
  });

  afterEach(async () => {
    // Clean up test data
    for (const id of testOrgTypeIds) {
      try {
        await db.query('DELETE FROM membership_number_sequences WHERE organization_type_id = $1', [id]);
        await db.query('DELETE FROM organization_types WHERE id = $1', [id]);
      } catch (error) {
        // Ignore cleanup errors
      }
    }
    testOrgTypeIds = [];
  });

  describe('Internal Numbering Mode', () => {
    it('should create organization type with default internal numbering settings', async () => {
      const orgType = await organizationTypeService.createOrganizationType({
        name: 'test-club-default',
        displayName: 'Test Club Default',
        currency: 'GBP',
        language: 'en',
        defaultCapabilities: []
      });

      testOrgTypeIds.push(orgType.id);

      expect(orgType.membershipNumbering).toBe('internal');
      expect(orgType.membershipNumberUniqueness).toBe('organization');
      expect(orgType.initialMembershipNumber).toBe(1000000);
    });

    it('should create organization type with organization type-level uniqueness and initialize sequence', async () => {
      const orgType = await organizationTypeService.createOrganizationType({
        name: 'test-club-org-type',
        displayName: 'Test Club Org Type',
        currency: 'GBP',
        language: 'en',
        defaultCapabilities: [],
        membershipNumbering: 'internal',
        membershipNumberUniqueness: 'organization_type',
        initialMembershipNumber: 2000000
      });

      testOrgTypeIds.push(orgType.id);

      expect(orgType.membershipNumbering).toBe('internal');
      expect(orgType.membershipNumberUniqueness).toBe('organization_type');
      expect(orgType.initialMembershipNumber).toBe(2000000);

      // Verify sequence was created
      const seqResult = await db.query(
        'SELECT * FROM membership_number_sequences WHERE organization_type_id = $1 AND organization_id IS NULL',
        [orgType.id]
      );

      expect(seqResult.rows).toHaveLength(1);
      expect(seqResult.rows[0].next_number).toBe(2000000);
    });

    it('should create organization type with organization-level uniqueness without initializing sequence', async () => {
      const orgType = await organizationTypeService.createOrganizationType({
        name: 'test-club-org-level',
        displayName: 'Test Club Org Level',
        currency: 'GBP',
        language: 'en',
        defaultCapabilities: [],
        membershipNumbering: 'internal',
        membershipNumberUniqueness: 'organization',
        initialMembershipNumber: 3000000
      });

      testOrgTypeIds.push(orgType.id);

      expect(orgType.membershipNumbering).toBe('internal');
      expect(orgType.membershipNumberUniqueness).toBe('organization');
      expect(orgType.initialMembershipNumber).toBe(3000000);

      // Verify no sequence was created (sequences are created per organization, not at type level)
      const seqResult = await db.query(
        'SELECT * FROM membership_number_sequences WHERE organization_type_id = $1',
        [orgType.id]
      );

      expect(seqResult.rows).toHaveLength(0);
    });
  });

  describe('External Numbering Mode', () => {
    it('should create organization type with external numbering', async () => {
      const orgType = await organizationTypeService.createOrganizationType({
        name: 'test-club-external',
        displayName: 'Test Club External',
        currency: 'GBP',
        language: 'en',
        defaultCapabilities: [],
        membershipNumbering: 'external'
      });

      testOrgTypeIds.push(orgType.id);

      expect(orgType.membershipNumbering).toBe('external');
      // Default values should still be set even for external mode
      expect(orgType.membershipNumberUniqueness).toBe('organization');
      expect(orgType.initialMembershipNumber).toBe(1000000);

      // Verify no sequence was created
      const seqResult = await db.query(
        'SELECT * FROM membership_number_sequences WHERE organization_type_id = $1',
        [orgType.id]
      );

      expect(seqResult.rows).toHaveLength(0);
    });
  });

  describe('Validation', () => {
    it('should reject uniqueness field when mode is external', async () => {
      await expect(
        organizationTypeService.createOrganizationType({
          name: 'test-invalid-1',
          displayName: 'Test Invalid 1',
          currency: 'GBP',
          language: 'en',
          defaultCapabilities: [],
          membershipNumbering: 'external',
          membershipNumberUniqueness: 'organization_type'
        })
      ).rejects.toThrow('Membership number uniqueness can only be set for internal numbering mode');
    });

    it('should reject initial number field when mode is external', async () => {
      await expect(
        organizationTypeService.createOrganizationType({
          name: 'test-invalid-2',
          displayName: 'Test Invalid 2',
          currency: 'GBP',
          language: 'en',
          defaultCapabilities: [],
          membershipNumbering: 'external',
          initialMembershipNumber: 5000000
        })
      ).rejects.toThrow('Initial membership number can only be set for internal numbering mode');
    });

    it('should reject negative initial membership number', async () => {
      await expect(
        organizationTypeService.createOrganizationType({
          name: 'test-invalid-3',
          displayName: 'Test Invalid 3',
          currency: 'GBP',
          language: 'en',
          defaultCapabilities: [],
          membershipNumbering: 'internal',
          initialMembershipNumber: -100
        })
      ).rejects.toThrow('Initial membership number must be a positive integer');
    });

    it('should reject zero initial membership number', async () => {
      await expect(
        organizationTypeService.createOrganizationType({
          name: 'test-invalid-4',
          displayName: 'Test Invalid 4',
          currency: 'GBP',
          language: 'en',
          defaultCapabilities: [],
          membershipNumbering: 'internal',
          initialMembershipNumber: 0
        })
      ).rejects.toThrow('Initial membership number must be a positive integer');
    });
  });

  describe('Retrieval', () => {
    it('should retrieve organization type with all numbering fields', async () => {
      const created = await organizationTypeService.createOrganizationType({
        name: 'test-club-retrieve',
        displayName: 'Test Club Retrieve',
        currency: 'GBP',
        language: 'en',
        defaultCapabilities: [],
        membershipNumbering: 'internal',
        membershipNumberUniqueness: 'organization_type',
        initialMembershipNumber: 4000000
      });

      testOrgTypeIds.push(created.id);

      const retrieved = await organizationTypeService.getOrganizationTypeById(created.id);

      expect(retrieved).not.toBeNull();
      expect(retrieved!.id).toBe(created.id);
      expect(retrieved!.membershipNumbering).toBe('internal');
      expect(retrieved!.membershipNumberUniqueness).toBe('organization_type');
      expect(retrieved!.initialMembershipNumber).toBe(4000000);
    });
  });
});
