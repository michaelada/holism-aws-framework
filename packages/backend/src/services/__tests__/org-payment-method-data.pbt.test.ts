/**
 * Property-Based Tests for Organization Payment Method Data Service
 * Feature: payment-methods-config
 */

import * as fc from 'fast-check';
import { orgPaymentMethodDataService } from '../org-payment-method-data.service';
import { paymentMethodService } from '../payment-method.service';
import { db } from '../../database/pool';

// Arbitraries for property-based testing
const paymentDataArb = fc.jsonValue().map(val => {
  // Ensure it's an object
  if (typeof val === 'object' && val !== null && !Array.isArray(val)) {
    return val as Record<string, any>;
  }
  return {};
});

describe('Organization Payment Method Data Service Property-Based Tests', () => {
  let testOrgId: string;
  let testPaymentMethodId: string;
  let testPaymentMethodRequiringActivationId: string;

  // Initialize database and create test fixtures
  beforeAll(async () => {
    try {
      await db.initialize();
    } catch (error) {
      console.log('Database initialization:', error instanceof Error ? error.message : 'Already initialized');
    }

    // Create test organization type if it doesn't exist
    let orgTypeResult = await db.query('SELECT id FROM organization_types LIMIT 1', []);
    let orgTypeId: string;
    
    if (orgTypeResult.rows.length === 0) {
      const newOrgTypeResult = await db.query(
        `INSERT INTO organization_types (name, display_name, description)
         VALUES ($1, $2, $3)
         RETURNING id`,
        ['test-org-type-pbt', 'Test Org Type PBT', 'Test organization type for PBT']
      );
      orgTypeId = newOrgTypeResult.rows[0].id;
    } else {
      orgTypeId = orgTypeResult.rows[0].id;
    }

    // Create test organization
    const orgName = `Test Org for PBT ${Date.now()}-${Math.random().toString(36).substring(7)}`;
    const orgResult = await db.query(
      `INSERT INTO organizations (name, organization_type_id, language, currency, keycloak_group_id, display_name)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [orgName, orgTypeId, 'en', 'GBP', `test-pbt-org-${Date.now()}`, orgName]
    );
    testOrgId = orgResult.rows[0].id;

    // Create test payment methods
    const pm1 = await paymentMethodService.createPaymentMethod({
      name: `test-pbt-pm-${Date.now()}`,
      displayName: 'Test PBT Payment Method',
      requiresActivation: false
    });
    testPaymentMethodId = pm1.id;

    const pm2 = await paymentMethodService.createPaymentMethod({
      name: `test-pbt-pm-activation-${Date.now()}`,
      displayName: 'Test PBT Payment Method Requiring Activation',
      requiresActivation: true
    });
    testPaymentMethodRequiringActivationId = pm2.id;
  });

  // Clean up test data after each test
  afterEach(async () => {
    try {
      await db.query('DELETE FROM org_payment_method_data WHERE organization_id = $1', [testOrgId]);
    } catch (error) {
      console.error('Cleanup error:', error);
    }
  });

  afterAll(async () => {
    // Clean up test fixtures
    try {
      await db.query('DELETE FROM org_payment_method_data WHERE organization_id = $1', [testOrgId]);
      await db.query('DELETE FROM organizations WHERE id = $1', [testOrgId]);
      await db.query('DELETE FROM payment_methods WHERE id IN ($1, $2)', [testPaymentMethodId, testPaymentMethodRequiringActivationId]);
    } catch (error) {
      console.error('Cleanup error:', error);
    }

    // Close database connections
    try {
      await db.close();
    } catch (error) {
      console.error('Database close error:', error);
    }
  });

  describe('Property 3: Organization-payment method association creation', () => {
    // Feature: payment-methods-config, Property 3: Organization-payment method association creation
    // Validates: Requirements 2.1
    
    it('should be able to create association for any valid organization and payment method', async () => {
      await fc.assert(
        fc.asyncProperty(
          paymentDataArb,
          async (paymentData) => {
            // Create association
            const association = await orgPaymentMethodDataService.createOrgPaymentMethod({
              organizationId: testOrgId,
              paymentMethodId: testPaymentMethodId,
              paymentData
            });

            // Verify association was created
            expect(association).toBeDefined();
            expect(association.organizationId).toBe(testOrgId);
            expect(association.paymentMethodId).toBe(testPaymentMethodId);
            expect(association.id).toBeDefined();

            // Clean up for next iteration
            await orgPaymentMethodDataService.deleteOrgPaymentMethod(testOrgId, testPaymentMethodId);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 4: Association uniqueness', () => {
    // Feature: payment-methods-config, Property 4: Association uniqueness
    // Validates: Requirements 2.4, 9.5
    
    it('should fail when attempting to create duplicate association', async () => {
      await fc.assert(
        fc.asyncProperty(
          paymentDataArb,
          paymentDataArb,
          async (paymentData1, paymentData2) => {
            // Create first association
            await orgPaymentMethodDataService.createOrgPaymentMethod({
              organizationId: testOrgId,
              paymentMethodId: testPaymentMethodId,
              paymentData: paymentData1
            });

            // Attempt to create duplicate association
            await expect(
              orgPaymentMethodDataService.createOrgPaymentMethod({
                organizationId: testOrgId,
                paymentMethodId: testPaymentMethodId,
                paymentData: paymentData2
              })
            ).rejects.toThrow('Payment method already associated with organization');

            // Clean up
            await orgPaymentMethodDataService.deleteOrgPaymentMethod(testOrgId, testPaymentMethodId);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 5: Association data completeness', () => {
    // Feature: payment-methods-config, Property 5: Association data completeness
    // Validates: Requirements 2.2, 2.5
    
    it('should have all required fields populated for any created association', async () => {
      await fc.assert(
        fc.asyncProperty(
          paymentDataArb,
          async (paymentData) => {
            // Create association
            const association = await orgPaymentMethodDataService.createOrgPaymentMethod({
              organizationId: testOrgId,
              paymentMethodId: testPaymentMethodId,
              paymentData
            });

            // Verify all required fields are populated
            expect(association.id).toBeDefined();
            expect(typeof association.id).toBe('string');
            
            expect(association.organizationId).toBeDefined();
            expect(association.organizationId).toBe(testOrgId);
            
            expect(association.paymentMethodId).toBeDefined();
            expect(association.paymentMethodId).toBe(testPaymentMethodId);
            
            expect(association.status).toBeDefined();
            expect(['active', 'inactive']).toContain(association.status);
            
            expect(association.paymentData).toBeDefined();
            expect(typeof association.paymentData).toBe('object');
            
            expect(association.createdAt).toBeDefined();
            expect(association.createdAt).toBeInstanceOf(Date);
            
            expect(association.updatedAt).toBeDefined();
            expect(association.updatedAt).toBeInstanceOf(Date);

            // Clean up
            await orgPaymentMethodDataService.deleteOrgPaymentMethod(testOrgId, testPaymentMethodId);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 6: Payment data JSON round-trip', () => {
    // Feature: payment-methods-config, Property 6: Payment data JSON round-trip
    // Validates: Requirements 2.3, 5.3, 10.3
    
    it('should preserve payment data structure when storing and retrieving', async () => {
      await fc.assert(
        fc.asyncProperty(
          paymentDataArb,
          async (paymentData) => {
            // Create association with payment data
            await orgPaymentMethodDataService.createOrgPaymentMethod({
              organizationId: testOrgId,
              paymentMethodId: testPaymentMethodId,
              paymentData
            });

            // Retrieve association
            const retrieved = await orgPaymentMethodDataService.getOrgPaymentMethod(
              testOrgId,
              testPaymentMethodId
            );

            // Verify payment data is equivalent
            expect(retrieved).not.toBeNull();
            expect(retrieved!.paymentData).toEqual(paymentData);

            // Clean up
            await orgPaymentMethodDataService.deleteOrgPaymentMethod(testOrgId, testPaymentMethodId);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 7: Status initialization based on activation requirements', () => {
    // Feature: payment-methods-config, Property 7: Status initialization based on activation requirements
    // Validates: Requirements 2.6, 2.7, 2.8
    
    it('should set status to inactive for methods requiring activation', async () => {
      await fc.assert(
        fc.asyncProperty(
          paymentDataArb,
          async (paymentData) => {
            // Create association with payment method requiring activation
            const association = await orgPaymentMethodDataService.createOrgPaymentMethod({
              organizationId: testOrgId,
              paymentMethodId: testPaymentMethodRequiringActivationId,
              paymentData
            });

            // Verify status is inactive
            expect(association.status).toBe('inactive');

            // Clean up
            await orgPaymentMethodDataService.deleteOrgPaymentMethod(testOrgId, testPaymentMethodRequiringActivationId);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should set status to active for methods not requiring activation', async () => {
      await fc.assert(
        fc.asyncProperty(
          paymentDataArb,
          async (paymentData) => {
            // Create association with payment method not requiring activation
            const association = await orgPaymentMethodDataService.createOrgPaymentMethod({
              organizationId: testOrgId,
              paymentMethodId: testPaymentMethodId,
              paymentData
            });

            // Verify status is active
            expect(association.status).toBe('active');

            // Clean up
            await orgPaymentMethodDataService.deleteOrgPaymentMethod(testOrgId, testPaymentMethodId);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 8: Default payment method initialization', () => {
    // Feature: payment-methods-config, Property 8: Default payment method initialization
    // Validates: Requirements 3.1, 3.2, 3.3
    
    it('should automatically associate pay-offline with active status and empty payment data', async () => {
      // Get an existing organization type
      const orgTypeResult = await db.query('SELECT id FROM organization_types LIMIT 1', []);
      const orgTypeId = orgTypeResult.rows[0].id;

      // Create a new test organization for this property
      const newOrgResult = await db.query(
        `INSERT INTO organizations (name, organization_type_id, language, currency, keycloak_group_id, display_name)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id`,
        [`Test Org Default PM ${Date.now()}`, orgTypeId, 'en', 'GBP', `test-pbt-default-${Date.now()}`, 'Test Org Default PM']
      );
      const newOrgId = newOrgResult.rows[0].id;

      try {
        // Initialize default payment methods
        await orgPaymentMethodDataService.initializeDefaultPaymentMethods(newOrgId);

        // Get pay-offline payment method
        const payOffline = await paymentMethodService.getPaymentMethodByName('pay-offline');
        
        if (payOffline) {
          // Retrieve the association
          const association = await orgPaymentMethodDataService.getOrgPaymentMethod(
            newOrgId,
            payOffline.id
          );

          // Verify association exists with correct properties
          expect(association).not.toBeNull();
          expect(association!.status).toBe('active');
          expect(association!.paymentData).toEqual({});
        }
      } finally {
        // Clean up
        await db.query('DELETE FROM org_payment_method_data WHERE organization_id = $1', [newOrgId]);
        await db.query('DELETE FROM organizations WHERE id = $1', [newOrgId]);
      }
    });
  });
});
