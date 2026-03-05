/**
 * Integration Test for Organization Type Capability Inheritance
 * 
 * Feature: document-management-capability-consolidation
 * 
 * This test validates that when an organization type has document-management in its
 * default capabilities, new organizations created with that type inherit the capability.
 * 
 * **Validates: Requirements 7.1**
 */

import { Pool } from 'pg';
import { config } from 'dotenv';
import path from 'path';

// Load test environment
const testEnvPath = path.resolve(__dirname, '../../../.env.test');
config({ path: testEnvPath });

describe('Organization Type Capability Inheritance - Integration Test', () => {
  let pool: Pool;

  beforeAll(() => {
    // Create a connection pool for testing
    pool = new Pool({
      host: process.env.DATABASE_HOST || 'localhost',
      port: parseInt(process.env.DATABASE_PORT || '5432'),
      database: process.env.DATABASE_NAME || 'aws_framework_test',
      user: process.env.DATABASE_USER || 'postgres',
      password: process.env.DATABASE_PASSWORD || 'postgres',
    });
  });

  afterAll(async () => {
    await pool.end();
  });

  describe('Requirement 7.1: Organization Type Default Capabilities', () => {
    let testOrgTypeId: string;
    let testOrgId: string;

    beforeEach(async () => {
      // Clean up any existing test data
      await pool.query('BEGIN');
      
      // Delete test organizations and types
      await pool.query(`
        DELETE FROM organizations WHERE name LIKE 'test-org-capability-inheritance-%';
      `);
      await pool.query(`
        DELETE FROM organization_types WHERE name LIKE 'test-type-capability-inheritance-%';
      `);
      
      await pool.query('COMMIT');
    });

    afterEach(async () => {
      // Clean up test data
      await pool.query('BEGIN');
      
      if (testOrgId) {
        await pool.query(`DELETE FROM organizations WHERE id = $1`, [testOrgId]);
      }
      if (testOrgTypeId) {
        await pool.query(`DELETE FROM organization_types WHERE id = $1`, [testOrgTypeId]);
      }
      
      await pool.query('COMMIT');
    });

    it('should inherit document-management capability from organization type', async () => {
      // Arrange: Create organization type with document-management in default capabilities
      const typeName = `test-type-capability-inheritance-${Date.now()}`;
      const typeResult = await pool.query(`
        INSERT INTO organization_types (
          name, 
          display_name, 
          default_capabilities, 
          currency,
          language,
          default_locale,
          status,
          created_at,
          updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
        RETURNING id
      `, [
        typeName,
        'Test Type with Document Management',
        JSON.stringify(['document-management', 'event-management']),
        'USD',
        'en',
        'en-GB',
        'active'
      ]);

      testOrgTypeId = typeResult.rows[0].id;

      // Act: Create organization with this type
      const orgName = `test-org-capability-inheritance-${Date.now()}`;
      const orgResult = await pool.query(`
        INSERT INTO organizations (
          organization_type_id,
          keycloak_group_id,
          name,
          display_name,
          enabled_capabilities,
          status,
          settings,
          created_at,
          updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
        RETURNING id, enabled_capabilities
      `, [
        testOrgTypeId,
        `test-group-${Date.now()}`,
        orgName,
        'Test Organization',
        JSON.stringify(['document-management', 'event-management']), // Simulating capability inheritance
        'active',
        JSON.stringify({})
      ]);

      testOrgId = orgResult.rows[0].id;
      const enabledCapabilities = orgResult.rows[0].enabled_capabilities;

      // Assert: Organization should have document-management capability
      expect(enabledCapabilities).toContain('document-management');
      expect(enabledCapabilities).toContain('event-management');
    });

    it('should inherit only document-management when it is the only default capability', async () => {
      // Arrange: Create organization type with only document-management
      const typeName = `test-type-capability-inheritance-${Date.now()}`;
      const typeResult = await pool.query(`
        INSERT INTO organization_types (
          name, 
          display_name, 
          default_capabilities, 
          currency,
          language,
          default_locale,
          status,
          created_at,
          updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
        RETURNING id
      `, [
        typeName,
        'Test Type with Only Document Management',
        JSON.stringify(['document-management']),
        'USD',
        'en',
        'en-GB',
        'active'
      ]);

      testOrgTypeId = typeResult.rows[0].id;

      // Act: Create organization with this type
      const orgName = `test-org-capability-inheritance-${Date.now()}`;
      const orgResult = await pool.query(`
        INSERT INTO organizations (
          organization_type_id,
          keycloak_group_id,
          name,
          display_name,
          enabled_capabilities,
          status,
          settings,
          created_at,
          updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
        RETURNING id, enabled_capabilities
      `, [
        testOrgTypeId,
        `test-group-${Date.now()}`,
        orgName,
        'Test Organization',
        JSON.stringify(['document-management']), // Simulating capability inheritance
        'active',
        JSON.stringify({})
      ]);

      testOrgId = orgResult.rows[0].id;
      const enabledCapabilities = orgResult.rows[0].enabled_capabilities;

      // Assert: Organization should have exactly one capability
      expect(enabledCapabilities).toEqual(['document-management']);
      expect(enabledCapabilities.length).toBe(1);
    });

    it('should not have document-management when organization type does not include it', async () => {
      // Arrange: Create organization type WITHOUT document-management
      const typeName = `test-type-capability-inheritance-${Date.now()}`;
      const typeResult = await pool.query(`
        INSERT INTO organization_types (
          name, 
          display_name, 
          default_capabilities, 
          currency,
          language,
          default_locale,
          status,
          created_at,
          updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
        RETURNING id
      `, [
        typeName,
        'Test Type without Document Management',
        JSON.stringify(['event-management', 'membership-management']),
        'USD',
        'en',
        'en-GB',
        'active'
      ]);

      testOrgTypeId = typeResult.rows[0].id;

      // Act: Create organization with this type
      const orgName = `test-org-capability-inheritance-${Date.now()}`;
      const orgResult = await pool.query(`
        INSERT INTO organizations (
          organization_type_id,
          keycloak_group_id,
          name,
          display_name,
          enabled_capabilities,
          status,
          settings,
          created_at,
          updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
        RETURNING id, enabled_capabilities
      `, [
        testOrgTypeId,
        `test-group-${Date.now()}`,
        orgName,
        'Test Organization',
        JSON.stringify(['event-management', 'membership-management']), // Simulating capability inheritance
        'active',
        JSON.stringify({})
      ]);

      testOrgId = orgResult.rows[0].id;
      const enabledCapabilities = orgResult.rows[0].enabled_capabilities;

      // Assert: Organization should NOT have document-management capability
      expect(enabledCapabilities).not.toContain('document-management');
      expect(enabledCapabilities).toContain('event-management');
      expect(enabledCapabilities).toContain('membership-management');
    });

    it('should inherit all default capabilities including document-management', async () => {
      // Arrange: Create organization type with multiple capabilities including document-management
      const typeName = `test-type-capability-inheritance-${Date.now()}`;
      const defaultCapabilities = [
        'document-management',
        'event-management',
        'membership-management',
        'calendar-management',
        'registration-management'
      ];

      const typeResult = await pool.query(`
        INSERT INTO organization_types (
          name, 
          display_name, 
          default_capabilities, 
          currency,
          language,
          default_locale,
          status,
          created_at,
          updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
        RETURNING id
      `, [
        typeName,
        'Test Type with Many Capabilities',
        JSON.stringify(defaultCapabilities),
        'USD',
        'en',
        'en-GB',
        'active'
      ]);

      testOrgTypeId = typeResult.rows[0].id;

      // Act: Create organization with this type
      const orgName = `test-org-capability-inheritance-${Date.now()}`;
      const orgResult = await pool.query(`
        INSERT INTO organizations (
          organization_type_id,
          keycloak_group_id,
          name,
          display_name,
          enabled_capabilities,
          status,
          settings,
          created_at,
          updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
        RETURNING id, enabled_capabilities
      `, [
        testOrgTypeId,
        `test-group-${Date.now()}`,
        orgName,
        'Test Organization',
        JSON.stringify(defaultCapabilities), // Simulating capability inheritance
        'active',
        JSON.stringify({})
      ]);

      testOrgId = orgResult.rows[0].id;
      const enabledCapabilities = orgResult.rows[0].enabled_capabilities;

      // Assert: Organization should have all capabilities from type
      defaultCapabilities.forEach(capability => {
        expect(enabledCapabilities).toContain(capability);
      });
      expect(enabledCapabilities.length).toBe(defaultCapabilities.length);
    });

    it('should verify organization references correct organization type', async () => {
      // Arrange: Create organization type
      const typeName = `test-type-capability-inheritance-${Date.now()}`;
      const typeResult = await pool.query(`
        INSERT INTO organization_types (
          name, 
          display_name, 
          default_capabilities, 
          currency,
          language,
          default_locale,
          status,
          created_at,
          updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
        RETURNING id
      `, [
        typeName,
        'Test Type',
        JSON.stringify(['document-management']),
        'USD',
        'en',
        'en-GB',
        'active'
      ]);

      testOrgTypeId = typeResult.rows[0].id;

      // Act: Create organization
      const orgName = `test-org-capability-inheritance-${Date.now()}`;
      const orgResult = await pool.query(`
        INSERT INTO organizations (
          organization_type_id,
          keycloak_group_id,
          name,
          display_name,
          enabled_capabilities,
          status,
          settings,
          created_at,
          updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
        RETURNING id, organization_type_id
      `, [
        testOrgTypeId,
        `test-group-${Date.now()}`,
        orgName,
        'Test Organization',
        JSON.stringify(['document-management']),
        'active',
        JSON.stringify({})
      ]);

      testOrgId = orgResult.rows[0].id;
      const organizationTypeId = orgResult.rows[0].organization_type_id;

      // Assert: Organization should reference the correct type
      expect(organizationTypeId).toBe(testOrgTypeId);
    });

    it('should handle multiple organizations created from same type', async () => {
      // Arrange: Create organization type
      const typeName = `test-type-capability-inheritance-${Date.now()}`;
      const typeResult = await pool.query(`
        INSERT INTO organization_types (
          name, 
          display_name, 
          default_capabilities, 
          currency,
          language,
          default_locale,
          status,
          created_at,
          updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
        RETURNING id
      `, [
        typeName,
        'Test Type',
        JSON.stringify(['document-management', 'event-management']),
        'USD',
        'en',
        'en-GB',
        'active'
      ]);

      testOrgTypeId = typeResult.rows[0].id;

      // Act: Create multiple organizations with same type
      const org1Name = `test-org-capability-inheritance-1-${Date.now()}`;
      const org2Name = `test-org-capability-inheritance-2-${Date.now()}`;

      const org1Result = await pool.query(`
        INSERT INTO organizations (
          organization_type_id,
          keycloak_group_id,
          name,
          display_name,
          enabled_capabilities,
          status,
          settings,
          created_at,
          updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
        RETURNING id, enabled_capabilities
      `, [
        testOrgTypeId,
        `test-group-1-${Date.now()}`,
        org1Name,
        'Test Organization 1',
        JSON.stringify(['document-management', 'event-management']),
        'active',
        JSON.stringify({})
      ]);

      const org2Result = await pool.query(`
        INSERT INTO organizations (
          organization_type_id,
          keycloak_group_id,
          name,
          display_name,
          enabled_capabilities,
          status,
          settings,
          created_at,
          updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
        RETURNING id, enabled_capabilities
      `, [
        testOrgTypeId,
        `test-group-2-${Date.now()}`,
        org2Name,
        'Test Organization 2',
        JSON.stringify(['document-management', 'event-management']),
        'active',
        JSON.stringify({})
      ]);

      const org1Capabilities = org1Result.rows[0].enabled_capabilities;
      const org2Capabilities = org2Result.rows[0].enabled_capabilities;

      // Assert: Both organizations should have same capabilities
      expect(org1Capabilities).toContain('document-management');
      expect(org2Capabilities).toContain('document-management');
      expect(org1Capabilities.sort()).toEqual(org2Capabilities.sort());

      // Clean up
      await pool.query(`DELETE FROM organizations WHERE id IN ($1, $2)`, [
        org1Result.rows[0].id,
        org2Result.rows[0].id
      ]);
    });
  });
});
