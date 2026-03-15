/**
 * Unit Tests for Membership Number Validator Service
 * Feature: membership-numbering-configuration
 */

import { MembershipNumberValidator } from '../membership-number-validator.service';
import { db } from '../../database/pool';

describe('MembershipNumberValidator', () => {
  let validator: MembershipNumberValidator;
  let testOrgTypeId: string;
  let testOrgId1: string;
  let testOrgId2: string;

  beforeAll(async () => {
    try {
      await db.initialize();
    } catch (error) {
      console.log('Database initialization:', error instanceof Error ? error.message : 'Already initialized');
    }

    // Create test organization type
    const orgTypeResult = await db.query(
      `INSERT INTO organization_types (name, display_name, currency, language, default_locale, default_capabilities)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [`test-org-type-validator-${Date.now()}`, 'Test Org Type Validator', 'GBP', 'en', 'en-GB', '[]']
    );
    testOrgTypeId = orgTypeResult.rows[0].id;

    // Create test organizations
    const org1Result = await db.query(
      `INSERT INTO organizations (name, organization_type_id, language, currency, keycloak_group_id, display_name)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [`test-org-validator-1-${Date.now()}`, testOrgTypeId, 'en', 'GBP', `test-org-validator-1-${Date.now()}`, 'Test Org Validator 1']
    );
    testOrgId1 = org1Result.rows[0].id;

    const org2Result = await db.query(
      `INSERT INTO organizations (name, organization_type_id, language, currency, keycloak_group_id, display_name)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [`test-org-validator-2-${Date.now()}`, testOrgTypeId, 'en', 'GBP', `test-org-validator-2-${Date.now()}`, 'Test Org Validator 2']
    );
    testOrgId2 = org2Result.rows[0].id;
  });

  beforeEach(() => {
    validator = new MembershipNumberValidator();
  });

  afterEach(async () => {
    // Clean up test members after each test
    try {
      await db.query('DELETE FROM members WHERE organisation_id IN ($1, $2)', [testOrgId1, testOrgId2]);
    } catch (error) {
      console.error('Cleanup error:', error);
    }
  });

  afterAll(async () => {
    // Clean up test data
    try {
      await db.query('DELETE FROM members WHERE organisation_id IN ($1, $2)', [testOrgId1, testOrgId2]);
      await db.query('DELETE FROM organizations WHERE id IN ($1, $2)', [testOrgId1, testOrgId2]);
      await db.query('DELETE FROM organization_types WHERE id = $1', [testOrgTypeId]);
    } catch (error) {
      console.error('Cleanup error:', error);
    }

    try {
      await db.close();
    } catch (error) {
      console.error('Database close error:', error);
    }
  });

  describe('validateUniqueness', () => {
    it('should return valid when no duplicate exists in organization scope', async () => {
      const result = await validator.validateUniqueness(
        'TEST-12345',
        testOrgId1,
        testOrgTypeId,
        'organization'
      );

      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should return valid when no duplicate exists in organization type scope', async () => {
      const result = await validator.validateUniqueness(
        'TEST-99999',
        testOrgId1,
        testOrgTypeId,
        'organization_type'
      );

      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });
  });
});
