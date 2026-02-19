/**
 * Property-Based Tests for Payment Method Service
 * Feature: payment-methods-config
 */

import * as fc from 'fast-check';
import { paymentMethodService } from '../payment-method.service';
import { db } from '../../database/pool';

// Arbitraries for property-based testing
const paymentMethodNameArb = fc.stringMatching(/^[a-z][a-z0-9-]{2,49}$/);
const displayNameArb = fc.string({ minLength: 1, maxLength: 100 });
const descriptionArb = fc.option(fc.string({ minLength: 0, maxLength: 500 }), { nil: undefined });
const requiresActivationArb = fc.boolean();

describe('Payment Method Service Property-Based Tests', () => {
  // Initialize database before all tests
  beforeAll(async () => {
    try {
      await db.initialize();
    } catch (error) {
      // Database might already be initialized, which is fine
      console.log('Database initialization:', error instanceof Error ? error.message : 'Already initialized');
    }
  });

  // Clean up test data after each test
  afterEach(async () => {
    try {
      await db.query('DELETE FROM payment_methods WHERE name LIKE $1', ['test-pm-%']);
    } catch (error) {
      console.error('Cleanup error:', error);
    }
  });

  afterAll(async () => {
    // Close database connections
    try {
      await db.close();
    } catch (error) {
      console.error('Database close error:', error);
    }
  });

  describe('Property 1: Payment method name uniqueness', () => {
    // Feature: payment-methods-config, Property 1: Payment method name uniqueness
    // Validates: Requirements 1.2, 9.6
    
    it('should fail when creating payment method with duplicate name', async () => {
      await fc.assert(
        fc.asyncProperty(
          paymentMethodNameArb,
          displayNameArb,
          descriptionArb,
          requiresActivationArb,
          fc.integer({ min: 1, max: 100000 }),
          async (name, displayName, description, requiresActivation, randomId) => {
            const testName = `test-pm-${name}-${randomId}`;
            
            // Create first payment method
            const first = await paymentMethodService.createPaymentMethod({
              name: testName,
              displayName: displayName || 'Test Payment Method',
              description,
              requiresActivation
            });

            expect(first.name).toBe(testName);

            // Attempt to create second payment method with same name
            await expect(
              paymentMethodService.createPaymentMethod({
                name: testName,
                displayName: 'Different Display Name',
                description: 'Different description',
                requiresActivation: !requiresActivation
              })
            ).rejects.toThrow('Payment method with this name already exists');

            // Clean up
            await db.query('DELETE FROM payment_methods WHERE id = $1', [first.id]);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should allow creating payment methods with different names', async () => {
      await fc.assert(
        fc.asyncProperty(
          paymentMethodNameArb,
          paymentMethodNameArb,
          displayNameArb,
          displayNameArb,
          fc.integer({ min: 1, max: 100000 }),
          async (name1, name2, displayName1, displayName2, randomId) => {
            // Skip if names are the same
            fc.pre(name1 !== name2);

            const testName1 = `test-pm-${name1}-${randomId}`;
            const testName2 = `test-pm-${name2}-${randomId}`;

            // Create first payment method
            const first = await paymentMethodService.createPaymentMethod({
              name: testName1,
              displayName: displayName1 || 'Test Payment Method 1',
              requiresActivation: false
            });

            // Create second payment method with different name
            const second = await paymentMethodService.createPaymentMethod({
              name: testName2,
              displayName: displayName2 || 'Test Payment Method 2',
              requiresActivation: true
            });

            expect(first.name).toBe(testName1);
            expect(second.name).toBe(testName2);
            expect(first.id).not.toBe(second.id);

            // Clean up
            await db.query('DELETE FROM payment_methods WHERE id IN ($1, $2)', [first.id, second.id]);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 2: Payment method data completeness', () => {
    // Feature: payment-methods-config, Property 2: Payment method data completeness
    // Validates: Requirements 1.3, 1.4, 1.5, 1.6, 1.7
    
    it('should have all required fields populated after creation', async () => {
      await fc.assert(
        fc.asyncProperty(
          paymentMethodNameArb,
          displayNameArb,
          descriptionArb,
          requiresActivationArb,
          fc.integer({ min: 1, max: 100000 }),
          async (name, displayName, description, requiresActivation, randomId) => {
            const testName = `test-pm-${name}-${randomId}`;
            
            const created = await paymentMethodService.createPaymentMethod({
              name: testName,
              displayName: displayName || 'Test Payment Method',
              description,
              requiresActivation
            });

            // Verify all required fields are present
            expect(created).toHaveProperty('id');
            expect(created.id).toBeTruthy();
            expect(typeof created.id).toBe('string');

            expect(created).toHaveProperty('name');
            expect(created.name).toBe(testName);

            expect(created).toHaveProperty('displayName');
            expect(created.displayName).toBe(displayName || 'Test Payment Method');

            expect(created).toHaveProperty('description');
            if (description !== undefined) {
              expect(created.description).toBe(description);
            }

            expect(created).toHaveProperty('requiresActivation');
            expect(created.requiresActivation).toBe(requiresActivation);

            expect(created).toHaveProperty('isActive');
            expect(created.isActive).toBe(true);

            expect(created).toHaveProperty('createdAt');
            expect(created.createdAt).toBeInstanceOf(Date);

            expect(created).toHaveProperty('updatedAt');
            expect(created.updatedAt).toBeInstanceOf(Date);

            // Clean up
            await db.query('DELETE FROM payment_methods WHERE id = $1', [created.id]);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should preserve all fields through retrieve operation', async () => {
      await fc.assert(
        fc.asyncProperty(
          paymentMethodNameArb,
          displayNameArb,
          descriptionArb,
          requiresActivationArb,
          fc.integer({ min: 1, max: 100000 }),
          async (name, displayName, description, requiresActivation, randomId) => {
            const testName = `test-pm-${name}-${randomId}`;
            
            // Create payment method
            const created = await paymentMethodService.createPaymentMethod({
              name: testName,
              displayName: displayName || 'Test Payment Method',
              description,
              requiresActivation
            });

            // Retrieve by ID
            const retrievedById = await paymentMethodService.getPaymentMethodById(created.id);
            expect(retrievedById).not.toBeNull();
            expect(retrievedById!.id).toBe(created.id);
            expect(retrievedById!.name).toBe(created.name);
            expect(retrievedById!.displayName).toBe(created.displayName);
            expect(retrievedById!.description).toBe(created.description);
            expect(retrievedById!.requiresActivation).toBe(created.requiresActivation);
            expect(retrievedById!.isActive).toBe(created.isActive);

            // Retrieve by name
            const retrievedByName = await paymentMethodService.getPaymentMethodByName(testName);
            expect(retrievedByName).not.toBeNull();
            expect(retrievedByName!.id).toBe(created.id);
            expect(retrievedByName!.name).toBe(created.name);
            expect(retrievedByName!.displayName).toBe(created.displayName);

            // Clean up
            await db.query('DELETE FROM payment_methods WHERE id = $1', [created.id]);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should preserve fields through update operation', async () => {
      await fc.assert(
        fc.asyncProperty(
          paymentMethodNameArb,
          displayNameArb,
          displayNameArb,
          descriptionArb,
          descriptionArb,
          requiresActivationArb,
          requiresActivationArb,
          fc.integer({ min: 1, max: 100000 }),
          async (name, initialDisplayName, updatedDisplayName, initialDesc, updatedDesc, initialReqActivation, updatedReqActivation, randomId) => {
            const testName = `test-pm-${name}-${randomId}`;
            let createdId: string | null = null;
            
            try {
              // Create payment method
              const created = await paymentMethodService.createPaymentMethod({
                name: testName,
                displayName: initialDisplayName || 'Initial Display Name',
                description: initialDesc,
                requiresActivation: initialReqActivation
              });
              
              createdId = created.id;

              // Update payment method
              const updated = await paymentMethodService.updatePaymentMethod(created.id, {
                displayName: updatedDisplayName || 'Updated Display Name',
                description: updatedDesc,
                requiresActivation: updatedReqActivation
              });

              // Verify updates
              expect(updated.id).toBe(created.id);
              expect(updated.name).toBe(testName); // Name should not change
              expect(updated.displayName).toBe(updatedDisplayName || 'Updated Display Name');
              // If updatedDesc is undefined, the field is not updated, so it keeps the initial value
              // Database converts undefined to null on creation, but preserves empty strings
              const expectedDesc = updatedDesc === undefined 
                ? (initialDesc === undefined ? null : initialDesc)
                : updatedDesc;
              expect(updated.description).toBe(expectedDesc);
              expect(updated.requiresActivation).toBe(updatedReqActivation);

              // Verify all required fields still present
              expect(updated).toHaveProperty('id');
              expect(updated).toHaveProperty('name');
              expect(updated).toHaveProperty('displayName');
              expect(updated).toHaveProperty('description');
              expect(updated).toHaveProperty('requiresActivation');
              expect(updated).toHaveProperty('isActive');
              expect(updated).toHaveProperty('createdAt');
              expect(updated).toHaveProperty('updatedAt');
            } finally {
              // Clean up - ensure deletion even if test fails
              if (createdId) {
                try {
                  await db.query('DELETE FROM payment_methods WHERE id = $1', [createdId]);
                } catch (cleanupError) {
                  // Ignore cleanup errors
                }
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
