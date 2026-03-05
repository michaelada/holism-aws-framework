/**
 * Integration Tests for Document Management Capability Consolidation Migration
 * 
 * Feature: document-management-capability-consolidation
 * 
 * These tests validate the complete migration execution on a real database with realistic data.
 * Tests cover:
 * - Full forward migration execution
 * - Data transformation verification
 * - Rollback migration execution
 * - Data restoration verification
 * 
 * **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5, 2.1-2.7, 6.1-6.7, 7.2-7.5**
 */

import { Pool } from 'pg';
import { config } from 'dotenv';
import path from 'path';
import fs from 'fs';

// Load test environment
const testEnvPath = path.resolve(__dirname, '../../../.env.test');
config({ path: testEnvPath });

describe('Document Management Capability Consolidation - Integration Tests', () => {
  let pool: Pool;
  let forwardMigrationSQL: string;
  let rollbackMigrationSQL: string;

  beforeAll(() => {
    // Create a connection pool for testing
    pool = new Pool({
      host: process.env.DATABASE_HOST || 'localhost',
      port: parseInt(process.env.DATABASE_PORT || '5432'),
      database: process.env.DATABASE_NAME || 'aws_framework_test',
      user: process.env.DATABASE_USER || 'postgres',
      password: process.env.DATABASE_PASSWORD || 'postgres',
    });

    // Load migration SQL files
    const forwardMigrationPath = path.resolve(__dirname, '../../migrations/consolidate-document-management-capabilities.sql');
    const rollbackMigrationPath = path.resolve(__dirname, '../../migrations/rollback-consolidate-document-management-capabilities.sql');

    forwardMigrationSQL = fs.readFileSync(forwardMigrationPath, 'utf8');
    rollbackMigrationSQL = fs.readFileSync(rollbackMigrationPath, 'utf8');
  });

  afterAll(async () => {
    await pool.end();
  });

  describe('Migration File Validation', () => {
    it('should have valid forward migration file', () => {
      expect(forwardMigrationSQL).toBeDefined();
      expect(forwardMigrationSQL.length).toBeGreaterThan(0);
      expect(forwardMigrationSQL).toContain('document-management');
    });

    it('should have valid rollback migration file', () => {
      expect(rollbackMigrationSQL).toBeDefined();
      expect(rollbackMigrationSQL.length).toBeGreaterThan(0);
      expect(rollbackMigrationSQL).toContain('membership-document-management');
    });
  });

  describe('Forward Migration Execution', () => {
    beforeEach(async () => {
      // Clean up and prepare test data
      await pool.query('BEGIN');
      
      // Remove any existing test data
      await pool.query(`
        DELETE FROM capabilities 
        WHERE name IN (
          'document-management',
          'membership-document-management',
          'event-document-management',
          'registration-document-management'
        );
      `);

      // Create old capabilities
      await pool.query(`
        INSERT INTO capabilities (name, display_name, description, category, is_active, created_at)
        VALUES 
          ('membership-document-management', 'Membership Document Management', 'Manage membership documents', 'additional-feature', true, NOW()),
          ('event-document-management', 'Event Document Management', 'Manage event documents', 'additional-feature', true, NOW()),
          ('registration-document-management', 'Registration Document Management', 'Manage registration documents', 'additional-feature', true, NOW())
        ON CONFLICT (name) DO UPDATE SET is_active = true;
      `);

      await pool.query('COMMIT');
    });

    afterEach(async () => {
      // Clean up after each test
      await pool.query('BEGIN');
      await pool.query(`
        DELETE FROM capabilities 
        WHERE name IN (
          'document-management',
          'membership-document-management',
          'event-document-management',
          'registration-document-management'
        );
      `);
      await pool.query('COMMIT');
    });

    it('should create new document-management capability', async () => {
      // Execute forward migration
      await pool.query('BEGIN');
      await pool.query(forwardMigrationSQL);
      await pool.query('COMMIT');

      // Verify new capability exists
      const result = await pool.query(`
        SELECT * FROM capabilities 
        WHERE name = 'document-management' AND is_active = true;
      `);

      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].name).toBe('document-management');
      expect(result.rows[0].display_name).toBe('Document Management');
      expect(result.rows[0].category).toBe('additional-feature');
      expect(result.rows[0].is_active).toBe(true);
    });

    it('should mark old capabilities as inactive', async () => {
      // Execute forward migration
      await pool.query('BEGIN');
      await pool.query(forwardMigrationSQL);
      await pool.query('COMMIT');

      // Verify old capabilities are inactive
      const result = await pool.query(`
        SELECT name, is_active FROM capabilities 
        WHERE name IN (
          'membership-document-management',
          'event-document-management',
          'registration-document-management'
        );
      `);

      expect(result.rows).toHaveLength(3);
      result.rows.forEach(row => {
        expect(row.is_active).toBe(false);
      });
    });

    it('should be idempotent - running twice produces same result', async () => {
      // Execute forward migration twice
      await pool.query('BEGIN');
      await pool.query(forwardMigrationSQL);
      await pool.query('COMMIT');

      await pool.query('BEGIN');
      await pool.query(forwardMigrationSQL);
      await pool.query('COMMIT');

      // Verify only one active document-management capability exists
      const result = await pool.query(`
        SELECT COUNT(*) as count FROM capabilities 
        WHERE name = 'document-management' AND is_active = true;
      `);

      expect(result.rows[0].count).toBe('1');
    });
  });

  describe('Organization Capability Migration', () => {
    let testOrgIds: string[];
    let testOrgTypeId: string;

    beforeEach(async () => {
      await pool.query('BEGIN');

      // Clean up
      await pool.query(`
        DELETE FROM capabilities 
        WHERE name IN (
          'document-management',
          'membership-document-management',
          'event-document-management',
          'registration-document-management'
        );
      `);

      // Create old capabilities
      await pool.query(`
        INSERT INTO capabilities (name, display_name, description, category, is_active, created_at)
        VALUES 
          ('membership-document-management', 'Membership Document Management', 'Manage membership documents', 'additional-feature', true, NOW()),
          ('event-document-management', 'Event Document Management', 'Manage event documents', 'additional-feature', true, NOW()),
          ('registration-document-management', 'Registration Document Management', 'Manage registration documents', 'additional-feature', true, NOW())
        ON CONFLICT (name) DO UPDATE SET is_active = true;
      `);

      // Create test organization type
      const typeResult = await pool.query(`
        INSERT INTO organization_types (name, display_name, default_capabilities, created_at)
        VALUES ('Test Type Migration', 'Test Type Migration', '[]', NOW())
        RETURNING id;
      `);
      testOrgTypeId = typeResult.rows[0].id;

      // Create test organizations with various capability combinations
      const orgResult = await pool.query(`
        INSERT INTO organizations (name, display_name, organization_type_id, status, keycloak_group_id, language, currency, enabled_capabilities, created_at)
        VALUES 
          ('Test Org 1 - Membership Only', 'Test Org 1', $1, 'active', 'test-group-1', 'en', 'GBP', '["membership-document-management", "events"]', NOW()),
          ('Test Org 2 - Event Only', 'Test Org 2', $1, 'active', 'test-group-2', 'en', 'GBP', '["event-document-management", "memberships"]', NOW()),
          ('Test Org 3 - Registration Only', 'Test Org 3', $1, 'active', 'test-group-3', 'en', 'GBP', '["registration-document-management", "calendar"]', NOW()),
          ('Test Org 4 - All Three', 'Test Org 4', $1, 'active', 'test-group-4', 'en', 'GBP', '["membership-document-management", "event-document-management", "registration-document-management", "forms"]', NOW()),
          ('Test Org 5 - None', 'Test Org 5', $1, 'active', 'test-group-5', 'en', 'GBP', '["events", "memberships"]', NOW())
        RETURNING id;
      `, [testOrgTypeId]);

      testOrgIds = orgResult.rows.map(row => row.id);

      await pool.query('COMMIT');
    });

    afterEach(async () => {
      await pool.query('BEGIN');
      
      // Clean up test organizations
      if (testOrgIds && testOrgIds.length > 0) {
        await pool.query(`
          DELETE FROM organizations WHERE id = ANY($1);
        `, [testOrgIds]);
      }

      // Clean up organization type
      if (testOrgTypeId) {
        await pool.query(`
          DELETE FROM organization_types WHERE id = $1;
        `, [testOrgTypeId]);
      }

      // Clean up capabilities
      await pool.query(`
        DELETE FROM capabilities 
        WHERE name IN (
          'document-management',
          'membership-document-management',
          'event-document-management',
          'registration-document-management'
        );
      `);

      await pool.query('COMMIT');
    });

    it('should migrate organizations with old capabilities to new capability', async () => {
      // Execute forward migration
      await pool.query('BEGIN');
      await pool.query(forwardMigrationSQL);
      await pool.query('COMMIT');

      // Verify organizations with old capabilities now have document-management
      const result = await pool.query(`
        SELECT name, enabled_capabilities 
        FROM organizations 
        WHERE id = ANY($1)
        ORDER BY name;
      `, [testOrgIds]);

      const org1 = result.rows.find(r => r.name === 'Test Org 1 - Membership Only');
      expect(org1.enabled_capabilities).toContain('document-management');
      expect(org1.enabled_capabilities).not.toContain('membership-document-management');
      expect(org1.enabled_capabilities).toContain('events');

      const org2 = result.rows.find(r => r.name === 'Test Org 2 - Event Only');
      expect(org2.enabled_capabilities).toContain('document-management');
      expect(org2.enabled_capabilities).not.toContain('event-document-management');
      expect(org2.enabled_capabilities).toContain('memberships');

      const org3 = result.rows.find(r => r.name === 'Test Org 3 - Registration Only');
      expect(org3.enabled_capabilities).toContain('document-management');
      expect(org3.enabled_capabilities).not.toContain('registration-document-management');
      expect(org3.enabled_capabilities).toContain('calendar');

      const org4 = result.rows.find(r => r.name === 'Test Org 4 - All Three');
      expect(org4.enabled_capabilities).toContain('document-management');
      expect(org4.enabled_capabilities).not.toContain('membership-document-management');
      expect(org4.enabled_capabilities).not.toContain('event-document-management');
      expect(org4.enabled_capabilities).not.toContain('registration-document-management');
      expect(org4.enabled_capabilities).toContain('forms');
      // Should have exactly one document-management
      const docMgmtCount = org4.enabled_capabilities.filter((c: string) => c === 'document-management').length;
      expect(docMgmtCount).toBe(1);

      const org5 = result.rows.find(r => r.name === 'Test Org 5 - None');
      expect(org5.enabled_capabilities).not.toContain('document-management');
      expect(org5.enabled_capabilities).toContain('events');
      expect(org5.enabled_capabilities).toContain('memberships');
    });

    it('should preserve all non-document-management capabilities', async () => {
      // Execute forward migration
      await pool.query('BEGIN');
      await pool.query(forwardMigrationSQL);
      await pool.query('COMMIT');

      // Verify all other capabilities are preserved
      const result = await pool.query(`
        SELECT name, enabled_capabilities 
        FROM organizations 
        WHERE id = ANY($1);
      `, [testOrgIds]);

      result.rows.forEach(org => {
        const caps = org.enabled_capabilities;
        
        // Check that non-document capabilities are preserved
        if (org.name.includes('Org 1')) {
          expect(caps).toContain('events');
        }
        if (org.name.includes('Org 2')) {
          expect(caps).toContain('memberships');
        }
        if (org.name.includes('Org 3')) {
          expect(caps).toContain('calendar');
        }
        if (org.name.includes('Org 4')) {
          expect(caps).toContain('forms');
        }
        if (org.name.includes('Org 5')) {
          expect(caps).toContain('events');
          expect(caps).toContain('memberships');
        }
      });
    });

    it('should remove all old capabilities from all organizations', async () => {
      // Execute forward migration
      await pool.query('BEGIN');
      await pool.query(forwardMigrationSQL);
      await pool.query('COMMIT');

      // Verify no organization has old capabilities
      const result = await pool.query(`
        SELECT name, enabled_capabilities 
        FROM organizations 
        WHERE id = ANY($1);
      `, [testOrgIds]);

      result.rows.forEach(org => {
        expect(org.enabled_capabilities).not.toContain('membership-document-management');
        expect(org.enabled_capabilities).not.toContain('event-document-management');
        expect(org.enabled_capabilities).not.toContain('registration-document-management');
      });
    });
  });

  describe('Organization Type Default Capabilities Migration', () => {
    let testOrgTypeIds: string[];

    beforeEach(async () => {
      await pool.query('BEGIN');

      // Clean up
      await pool.query(`
        DELETE FROM capabilities 
        WHERE name IN (
          'document-management',
          'membership-document-management',
          'event-document-management',
          'registration-document-management'
        );
      `);

      // Create old capabilities
      await pool.query(`
        INSERT INTO capabilities (name, display_name, description, category, is_active, created_at)
        VALUES 
          ('membership-document-management', 'Membership Document Management', 'Manage membership documents', 'additional-feature', true, NOW()),
          ('event-document-management', 'Event Document Management', 'Manage event documents', 'additional-feature', true, NOW()),
          ('registration-document-management', 'Registration Document Management', 'Manage registration documents', 'additional-feature', true, NOW())
        ON CONFLICT (name) DO UPDATE SET is_active = true;
      `);

      // Create test organization types with various default capability combinations
      const orgTypeResult = await pool.query(`
        INSERT INTO organization_types (name, display_name, default_capabilities, created_at)
        VALUES 
          ('Type 1 - Membership Default', 'Type 1', '["membership-document-management", "events"]', NOW()),
          ('Type 2 - Event Default', 'Type 2', '["event-document-management", "memberships"]', NOW()),
          ('Type 3 - All Three Default', 'Type 3', '["membership-document-management", "event-document-management", "registration-document-management", "forms"]', NOW()),
          ('Type 4 - None Default', 'Type 4', '["events", "memberships"]', NOW())
        RETURNING id;
      `);

      testOrgTypeIds = orgTypeResult.rows.map(row => row.id);

      await pool.query('COMMIT');
    });

    afterEach(async () => {
      await pool.query('BEGIN');
      
      // Clean up test organization types
      if (testOrgTypeIds && testOrgTypeIds.length > 0) {
        await pool.query(`
          DELETE FROM organization_types WHERE id = ANY($1);
        `, [testOrgTypeIds]);
      }

      // Clean up capabilities
      await pool.query(`
        DELETE FROM capabilities 
        WHERE name IN (
          'document-management',
          'membership-document-management',
          'event-document-management',
          'registration-document-management'
        );
      `);

      await pool.query('COMMIT');
    });

    it('should migrate organization type default capabilities', async () => {
      // Execute forward migration
      await pool.query('BEGIN');
      await pool.query(forwardMigrationSQL);
      await pool.query('COMMIT');

      // Verify organization types with old capabilities now have document-management
      const result = await pool.query(`
        SELECT name, default_capabilities 
        FROM organization_types 
        WHERE id = ANY($1)
        ORDER BY name;
      `, [testOrgTypeIds]);

      const type1 = result.rows.find(r => r.name === 'Type 1 - Membership Default');
      expect(type1.default_capabilities).toContain('document-management');
      expect(type1.default_capabilities).not.toContain('membership-document-management');
      expect(type1.default_capabilities).toContain('events');

      const type2 = result.rows.find(r => r.name === 'Type 2 - Event Default');
      expect(type2.default_capabilities).toContain('document-management');
      expect(type2.default_capabilities).not.toContain('event-document-management');
      expect(type2.default_capabilities).toContain('memberships');

      const type3 = result.rows.find(r => r.name === 'Type 3 - All Three Default');
      expect(type3.default_capabilities).toContain('document-management');
      expect(type3.default_capabilities).not.toContain('membership-document-management');
      expect(type3.default_capabilities).not.toContain('event-document-management');
      expect(type3.default_capabilities).not.toContain('registration-document-management');
      expect(type3.default_capabilities).toContain('forms');
      // Should have exactly one document-management
      const docMgmtCount = type3.default_capabilities.filter((c: string) => c === 'document-management').length;
      expect(docMgmtCount).toBe(1);

      const type4 = result.rows.find(r => r.name === 'Type 4 - None Default');
      expect(type4.default_capabilities).not.toContain('document-management');
      expect(type4.default_capabilities).toContain('events');
      expect(type4.default_capabilities).toContain('memberships');
    });

    it('should remove all old capabilities from organization type defaults', async () => {
      // Execute forward migration
      await pool.query('BEGIN');
      await pool.query(forwardMigrationSQL);
      await pool.query('COMMIT');

      // Verify no organization type has old capabilities
      const result = await pool.query(`
        SELECT name, default_capabilities 
        FROM organization_types 
        WHERE id = ANY($1);
      `, [testOrgTypeIds]);

      result.rows.forEach(orgType => {
        expect(orgType.default_capabilities).not.toContain('membership-document-management');
        expect(orgType.default_capabilities).not.toContain('event-document-management');
        expect(orgType.default_capabilities).not.toContain('registration-document-management');
      });
    });
  });


  describe('Rollback Migration Execution', () => {
    let testOrgIds: string[];
    let testOrgTypeId: string;

    beforeEach(async () => {
      await pool.query('BEGIN');

      // Clean up
      await pool.query(`
        DELETE FROM capabilities 
        WHERE name IN (
          'document-management',
          'membership-document-management',
          'event-document-management',
          'registration-document-management'
        );
      `);

      // Create old capabilities
      await pool.query(`
        INSERT INTO capabilities (name, display_name, description, category, is_active, created_at)
        VALUES 
          ('membership-document-management', 'Membership Document Management', 'Manage membership documents', 'additional-feature', true, NOW()),
          ('event-document-management', 'Event Document Management', 'Manage event documents', 'additional-feature', true, NOW()),
          ('registration-document-management', 'Registration Document Management', 'Manage registration documents', 'additional-feature', true, NOW())
        ON CONFLICT (name) DO UPDATE SET is_active = true;
      `);

      // Create test organization type
      const typeResult = await pool.query(`
        INSERT INTO organization_types (name, display_name, default_capabilities, created_at)
        VALUES ('Test Type Rollback', 'Test Type Rollback', '[]', NOW())
        RETURNING id;
      `);
      testOrgTypeId = typeResult.rows[0].id;

      // Create test organizations
      const orgResult = await pool.query(`
        INSERT INTO organizations (name, display_name, organization_type_id, status, keycloak_group_id, language, currency, enabled_capabilities, created_at)
        VALUES 
          ('Rollback Org 1', 'Rollback Org 1', $1, 'active', 'test-rollback-1', 'en', 'GBP', '["membership-document-management", "events"]', NOW()),
          ('Rollback Org 2', 'Rollback Org 2', $1, 'active', 'test-rollback-2', 'en', 'GBP', '["event-document-management", "memberships"]', NOW())
        RETURNING id;
      `, [testOrgTypeId]);

      testOrgIds = orgResult.rows.map(row => row.id);

      // Execute forward migration first
      await pool.query(forwardMigrationSQL);

      await pool.query('COMMIT');
    });

    afterEach(async () => {
      await pool.query('BEGIN');
      
      // Clean up test organizations
      if (testOrgIds && testOrgIds.length > 0) {
        await pool.query(`
          DELETE FROM organizations WHERE id = ANY($1);
        `, [testOrgIds]);
      }

      // Clean up organization type
      if (testOrgTypeId) {
        await pool.query(`
          DELETE FROM organization_types WHERE id = $1;
        `, [testOrgTypeId]);
      }

      // Clean up capabilities
      await pool.query(`
        DELETE FROM capabilities 
        WHERE name IN (
          'document-management',
          'membership-document-management',
          'event-document-management',
          'registration-document-management'
        );
      `);

      await pool.query('COMMIT');
    });

    it('should restore all three original capabilities', async () => {
      // Execute rollback migration
      await pool.query('BEGIN');
      await pool.query(rollbackMigrationSQL);
      await pool.query('COMMIT');

      // Verify all three original capabilities are active
      const result = await pool.query(`
        SELECT name, is_active FROM capabilities 
        WHERE name IN (
          'membership-document-management',
          'event-document-management',
          'registration-document-management'
        )
        ORDER BY name;
      `);

      expect(result.rows).toHaveLength(3);
      result.rows.forEach(row => {
        expect(row.is_active).toBe(true);
      });
    });

    it('should mark document-management as inactive', async () => {
      // Execute rollback migration
      await pool.query('BEGIN');
      await pool.query(rollbackMigrationSQL);
      await pool.query('COMMIT');

      // Verify document-management is inactive
      const result = await pool.query(`
        SELECT name, is_active FROM capabilities 
        WHERE name = 'document-management';
      `);

      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].is_active).toBe(false);
    });

    it('should restore all three original capabilities to organizations', async () => {
      // Execute rollback migration
      await pool.query('BEGIN');
      await pool.query(rollbackMigrationSQL);
      await pool.query('COMMIT');

      // Verify organizations have all three original capabilities
      const result = await pool.query(`
        SELECT name, enabled_capabilities 
        FROM organizations 
        WHERE id = ANY($1);
      `, [testOrgIds]);

      result.rows.forEach(org => {
        expect(org.enabled_capabilities).toContain('membership-document-management');
        expect(org.enabled_capabilities).toContain('event-document-management');
        expect(org.enabled_capabilities).toContain('registration-document-management');
        expect(org.enabled_capabilities).not.toContain('document-management');
      });
    });

    it('should preserve non-document capabilities during rollback', async () => {
      // Execute rollback migration
      await pool.query('BEGIN');
      await pool.query(rollbackMigrationSQL);
      await pool.query('COMMIT');

      // Verify other capabilities are preserved
      const result = await pool.query(`
        SELECT name, enabled_capabilities 
        FROM organizations 
        WHERE id = ANY($1);
      `, [testOrgIds]);

      const org1 = result.rows.find(r => r.name === 'Rollback Org 1');
      expect(org1.enabled_capabilities).toContain('events');

      const org2 = result.rows.find(r => r.name === 'Rollback Org 2');
      expect(org2.enabled_capabilities).toContain('memberships');
    });

    it('should be idempotent - running rollback twice produces same result', async () => {
      // Execute rollback migration twice
      await pool.query('BEGIN');
      await pool.query(rollbackMigrationSQL);
      await pool.query('COMMIT');

      await pool.query('BEGIN');
      await pool.query(rollbackMigrationSQL);
      await pool.query('COMMIT');

      // Verify all three capabilities are active
      const result = await pool.query(`
        SELECT COUNT(*) as count FROM capabilities 
        WHERE name IN (
          'membership-document-management',
          'event-document-management',
          'registration-document-management'
        ) AND is_active = true;
      `);

      expect(result.rows[0].count).toBe('3');
    });
  });


  describe('Complete Migration Cycle', () => {
    let testOrgIds: string[];
    let testOrgTypeId: string;

    beforeEach(async () => {
      await pool.query('BEGIN');

      // Clean up
      await pool.query(`
        DELETE FROM capabilities 
        WHERE name IN (
          'document-management',
          'membership-document-management',
          'event-document-management',
          'registration-document-management'
        );
      `);

      // Create old capabilities
      await pool.query(`
        INSERT INTO capabilities (name, display_name, description, category, is_active, created_at)
        VALUES 
          ('membership-document-management', 'Membership Document Management', 'Manage membership documents', 'additional-feature', true, NOW()),
          ('event-document-management', 'Event Document Management', 'Manage event documents', 'additional-feature', true, NOW()),
          ('registration-document-management', 'Registration Document Management', 'Manage registration documents', 'additional-feature', true, NOW())
        ON CONFLICT (name) DO UPDATE SET is_active = true;
      `);

      // Create test organization type
      const typeResult = await pool.query(`
        INSERT INTO organization_types (name, display_name, default_capabilities, created_at)
        VALUES ('Test Type Cycle', 'Test Type Cycle', '[]', NOW())
        RETURNING id;
      `);
      testOrgTypeId = typeResult.rows[0].id;

      // Create test organizations
      const orgResult = await pool.query(`
        INSERT INTO organizations (name, display_name, organization_type_id, status, keycloak_group_id, language, currency, enabled_capabilities, created_at)
        VALUES 
          ('Cycle Test Org', 'Cycle Test Org', $1, 'active', 'test-cycle-1', 'en', 'GBP', '["membership-document-management", "events", "forms"]', NOW())
        RETURNING id;
      `, [testOrgTypeId]);

      testOrgIds = orgResult.rows.map(row => row.id);

      await pool.query('COMMIT');
    });

    afterEach(async () => {
      await pool.query('BEGIN');
      
      // Clean up test organizations
      if (testOrgIds && testOrgIds.length > 0) {
        await pool.query(`
          DELETE FROM organizations WHERE id = ANY($1);
        `, [testOrgIds]);
      }

      // Clean up organization type
      if (testOrgTypeId) {
        await pool.query(`
          DELETE FROM organization_types WHERE id = $1;
        `, [testOrgTypeId]);
      }

      // Clean up capabilities
      await pool.query(`
        DELETE FROM capabilities 
        WHERE name IN (
          'document-management',
          'membership-document-management',
          'event-document-management',
          'registration-document-management'
        );
      `);

      await pool.query('COMMIT');
    });

    it('should successfully execute forward migration then rollback', async () => {
      // Execute forward migration
      await pool.query('BEGIN');
      await pool.query(forwardMigrationSQL);
      await pool.query('COMMIT');

      // Verify forward migration worked
      const afterForward = await pool.query(`
        SELECT enabled_capabilities FROM organizations WHERE id = $1;
      `, [testOrgIds[0]]);

      expect(afterForward.rows[0].enabled_capabilities).toContain('document-management');
      expect(afterForward.rows[0].enabled_capabilities).not.toContain('membership-document-management');
      expect(afterForward.rows[0].enabled_capabilities).toContain('events');
      expect(afterForward.rows[0].enabled_capabilities).toContain('forms');

      // Execute rollback migration
      await pool.query('BEGIN');
      await pool.query(rollbackMigrationSQL);
      await pool.query('COMMIT');

      // Verify rollback worked
      const afterRollback = await pool.query(`
        SELECT enabled_capabilities FROM organizations WHERE id = $1;
      `, [testOrgIds[0]]);

      expect(afterRollback.rows[0].enabled_capabilities).toContain('membership-document-management');
      expect(afterRollback.rows[0].enabled_capabilities).toContain('event-document-management');
      expect(afterRollback.rows[0].enabled_capabilities).toContain('registration-document-management');
      expect(afterRollback.rows[0].enabled_capabilities).not.toContain('document-management');
      expect(afterRollback.rows[0].enabled_capabilities).toContain('events');
      expect(afterRollback.rows[0].enabled_capabilities).toContain('forms');
    });

    it('should preserve data integrity throughout migration cycle', async () => {
      // Get initial state
      const initial = await pool.query(`
        SELECT enabled_capabilities FROM organizations WHERE id = $1;
      `, [testOrgIds[0]]);

      const initialOtherCaps = initial.rows[0].enabled_capabilities.filter(
        (c: string) => !['membership-document-management', 'event-document-management', 'registration-document-management', 'document-management'].includes(c)
      );

      // Execute forward migration
      await pool.query('BEGIN');
      await pool.query(forwardMigrationSQL);
      await pool.query('COMMIT');

      // Execute rollback migration
      await pool.query('BEGIN');
      await pool.query(rollbackMigrationSQL);
      await pool.query('COMMIT');

      // Get final state
      const final = await pool.query(`
        SELECT enabled_capabilities FROM organizations WHERE id = $1;
      `, [testOrgIds[0]]);

      const finalOtherCaps = final.rows[0].enabled_capabilities.filter(
        (c: string) => !['membership-document-management', 'event-document-management', 'registration-document-management', 'document-management'].includes(c)
      );

      // Verify non-document capabilities are preserved
      expect(finalOtherCaps.sort()).toEqual(initialOtherCaps.sort());
    });
  });
});
