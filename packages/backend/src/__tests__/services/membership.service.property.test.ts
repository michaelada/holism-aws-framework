/**
 * Property-Based Tests for Membership Service
 * 
 * Feature: membership-discount-integration
 * 
 * These tests validate universal properties that should hold true across
 * all valid inputs for membership type discount association.
 */

import * as fc from 'fast-check';
import { MembershipService } from '../../services/membership.service';
import { db } from '../../database/pool';

// Mock the database
jest.mock('../../database/pool', () => ({
  db: {
    query: jest.fn(),
  },
}));

// Mock the logger
jest.mock('../../config/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

describe('Membership Service - Property-Based Tests', () => {
  const service = new MembershipService();
  const mockDb = db as jest.Mocked<typeof db>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  /**
   * Property 4: Discount ID Existence Validation
   * 
   * For any membership type being saved with discountIds, if any discount ID does not
   * exist in the database, the API should reject the request with a validation error.
   * 
   * **Validates: Requirements 9.1**
   */
  describe('Property 4: Discount ID Existence Validation', () => {
    /**
     * Test: Non-existent discount IDs should be rejected
     * 
     * Property: When validating discount IDs, if any discount ID does not exist in the
     * database, the validation should fail with a 'not_found' error for that discount ID.
     */
    it('should reject discount IDs that do not exist in the database', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(fc.uuid(), { minLength: 1, maxLength: 10 }),
          fc.uuid(),
          fc.array(fc.uuid(), { minLength: 0, maxLength: 10 }),
          async (requestedDiscountIds, organisationId, existingDiscountIds) => {
            // Arrange: Mock database to return only some of the requested discounts
            const existingDiscounts = existingDiscountIds.map(id => ({
              id,
              organisation_id: organisationId,
              module_type: 'memberships',
              status: 'active',
            }));

            mockDb.query.mockResolvedValueOnce({
              rows: existingDiscounts,
              command: 'SELECT',
              rowCount: existingDiscounts.length,
              oid: 0,
              fields: [],
            });

            // Act
            const result = await service.validateDiscountIds(requestedDiscountIds, organisationId);

            // Assert: Property - Validation fails if any requested ID doesn't exist
            const nonExistentIds = requestedDiscountIds.filter(
              id => !existingDiscountIds.includes(id)
            );

            if (nonExistentIds.length > 0) {
              expect(result.valid).toBe(false);
              expect(result.errors.length).toBeGreaterThan(0);

              // Property: Each non-existent ID should have a 'not_found' error
              nonExistentIds.forEach(discountId => {
                expect(result.errors).toContainEqual(
                  expect.objectContaining({
                    discountId,
                    reason: 'not_found',
                    message: expect.stringContaining(discountId),
                  })
                );
              });
            } else {
              // All requested IDs exist, so validation should pass (assuming other criteria met)
              expect(result.valid).toBe(true);
              expect(result.errors).toHaveLength(0);
            }

            // Property: Database was queried with correct parameters
            expect(mockDb.query).toHaveBeenCalledWith(
              expect.stringContaining('WHERE id = ANY($1)'),
              [requestedDiscountIds]
            );
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Test: All existing discount IDs should pass existence validation
     * 
     * Property: When all requested discount IDs exist in the database, the existence
     * check should not produce any 'not_found' errors.
     */
    it('should pass existence validation when all discount IDs exist', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(fc.uuid(), { minLength: 1, maxLength: 10 }),
          fc.uuid(),
          async (discountIds, organisationId) => {
            // Arrange: Mock database to return all requested discounts
            const existingDiscounts = discountIds.map(id => ({
              id,
              organisation_id: organisationId,
              module_type: 'memberships',
              status: 'active',
            }));

            mockDb.query.mockResolvedValueOnce({
              rows: existingDiscounts,
              command: 'SELECT',
              rowCount: existingDiscounts.length,
              oid: 0,
              fields: [],
            });

            // Act
            const result = await service.validateDiscountIds(discountIds, organisationId);

            // Assert: Property - No 'not_found' errors when all IDs exist
            const notFoundErrors = result.errors.filter(e => e.reason === 'not_found');
            expect(notFoundErrors).toHaveLength(0);

            // Property: Validation passes (assuming other criteria met)
            expect(result.valid).toBe(true);
            expect(result.errors).toHaveLength(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Test: Empty discount IDs array should always pass validation
     * 
     * Property: When no discount IDs are provided (empty array), validation should
     * always pass without querying the database.
     */
    it('should pass validation for empty discount IDs array', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          async (organisationId) => {
            // Act
            const result = await service.validateDiscountIds([], organisationId);

            // Assert: Property - Empty array always passes validation
            expect(result.valid).toBe(true);
            expect(result.errors).toHaveLength(0);

            // Property: Database should not be queried for empty array
            expect(mockDb.query).not.toHaveBeenCalled();
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Test: Single non-existent discount ID should be rejected
     * 
     * Property: When validating a single discount ID that doesn't exist,
     * validation should fail with exactly one 'not_found' error.
     */
    it('should reject single non-existent discount ID', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          fc.uuid(),
          async (discountId, organisationId) => {
            // Arrange: Mock database to return no discounts
            mockDb.query.mockResolvedValueOnce({
              rows: [],
              command: 'SELECT',
              rowCount: 0,
              oid: 0,
              fields: [],
            });

            // Act
            const result = await service.validateDiscountIds([discountId], organisationId);

            // Assert: Property - Validation fails with exactly one 'not_found' error
            expect(result.valid).toBe(false);
            expect(result.errors).toHaveLength(1);
            expect(result.errors[0]).toEqual(
              expect.objectContaining({
                discountId,
                reason: 'not_found',
                message: expect.stringContaining(discountId),
              })
            );
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Test: Partial existence should produce errors only for non-existent IDs
     * 
     * Property: When some discount IDs exist and others don't, validation should
     * produce 'not_found' errors only for the non-existent IDs.
     */
    it('should produce errors only for non-existent discount IDs', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(fc.uuid(), { minLength: 2, maxLength: 10 }),
          fc.uuid(),
          fc.integer({ min: 1, max: 9 }),
          async (allDiscountIds, organisationId, existingCount) => {
            // Ensure we have at least one existing and one non-existing
            const actualExistingCount = Math.min(existingCount, allDiscountIds.length - 1);
            const existingIds = allDiscountIds.slice(0, actualExistingCount);
            const nonExistentIds = allDiscountIds.slice(actualExistingCount);

            // Skip if we don't have both existing and non-existing
            fc.pre(existingIds.length > 0 && nonExistentIds.length > 0);

            // Arrange: Mock database to return only existing discounts
            const existingDiscounts = existingIds.map(id => ({
              id,
              organisation_id: organisationId,
              module_type: 'memberships',
              status: 'active',
            }));

            mockDb.query.mockResolvedValueOnce({
              rows: existingDiscounts,
              command: 'SELECT',
              rowCount: existingDiscounts.length,
              oid: 0,
              fields: [],
            });

            // Act
            const result = await service.validateDiscountIds(allDiscountIds, organisationId);

            // Assert: Property - Validation fails
            expect(result.valid).toBe(false);

            // Property: Errors count matches non-existent IDs count
            const notFoundErrors = result.errors.filter(e => e.reason === 'not_found');
            expect(notFoundErrors.length).toBe(nonExistentIds.length);

            // Property: Each non-existent ID has an error
            nonExistentIds.forEach(discountId => {
              expect(result.errors).toContainEqual(
                expect.objectContaining({
                  discountId,
                  reason: 'not_found',
                })
              );
            });

            // Property: No errors for existing IDs (at this stage)
            existingIds.forEach(discountId => {
              const errorsForThisId = result.errors.filter(e => e.discountId === discountId && e.reason === 'not_found');
              expect(errorsForThisId).toHaveLength(0);
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Test: Error message should contain the discount ID
     * 
     * Property: For any discount ID that doesn't exist, the error message should
     * contain that discount ID for debugging purposes.
     */
    it('should include discount ID in error message', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(fc.uuid(), { minLength: 1, maxLength: 5 }),
          fc.uuid(),
          async (discountIds, organisationId) => {
            // Arrange: Mock database to return no discounts
            mockDb.query.mockResolvedValueOnce({
              rows: [],
              command: 'SELECT',
              rowCount: 0,
              oid: 0,
              fields: [],
            });

            // Act
            const result = await service.validateDiscountIds(discountIds, organisationId);

            // Assert: Property - Each error message contains the discount ID
            result.errors.forEach(error => {
              if (error.reason === 'not_found') {
                expect(error.message).toContain(error.discountId);
              }
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Test: Validation result structure consistency
     * 
     * Property: Validation results should always have consistent structure with
     * valid boolean and errors array, regardless of input.
     */
    it('should always return consistent validation result structure', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(fc.uuid(), { minLength: 0, maxLength: 10 }),
          fc.uuid(),
          fc.array(fc.uuid(), { minLength: 0, maxLength: 10 }),
          async (requestedIds, organisationId, existingIds) => {
            // Arrange: Mock database response
            const existingDiscounts = existingIds.map(id => ({
              id,
              organisation_id: organisationId,
              module_type: 'memberships',
              status: 'active',
            }));

            if (requestedIds.length > 0) {
              mockDb.query.mockResolvedValueOnce({
                rows: existingDiscounts,
                command: 'SELECT',
                rowCount: existingDiscounts.length,
                oid: 0,
                fields: [],
              });
            }

            // Act
            const result = await service.validateDiscountIds(requestedIds, organisationId);

            // Assert: Property - Result always has valid boolean and errors array
            expect(result).toHaveProperty('valid');
            expect(typeof result.valid).toBe('boolean');
            expect(result).toHaveProperty('errors');
            expect(Array.isArray(result.errors)).toBe(true);

            // Property: valid is true if and only if errors array is empty
            expect(result.valid).toBe(result.errors.length === 0);

            // Property: Each error has required fields
            result.errors.forEach(error => {
              expect(error).toHaveProperty('discountId');
              expect(error).toHaveProperty('reason');
              expect(error).toHaveProperty('message');
              expect(typeof error.discountId).toBe('string');
              expect(typeof error.reason).toBe('string');
              expect(typeof error.message).toBe('string');
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Test: Duplicate discount IDs should be validated correctly
     * 
     * Property: When the same discount ID appears multiple times in the input array,
     * if it doesn't exist, there should be an error for each occurrence.
     */
    it('should handle duplicate discount IDs correctly', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          fc.integer({ min: 2, max: 5 }),
          fc.uuid(),
          async (discountId, duplicateCount, organisationId) => {
            // Arrange: Create array with duplicate IDs
            const discountIds = Array(duplicateCount).fill(discountId);

            // Mock database to return no discounts
            mockDb.query.mockResolvedValueOnce({
              rows: [],
              command: 'SELECT',
              rowCount: 0,
              oid: 0,
              fields: [],
            });

            // Act
            const result = await service.validateDiscountIds(discountIds, organisationId);

            // Assert: Property - Validation fails
            expect(result.valid).toBe(false);

            // Property: Each duplicate should have an error
            expect(result.errors.length).toBe(duplicateCount);
            result.errors.forEach(error => {
              expect(error.discountId).toBe(discountId);
              expect(error.reason).toBe('not_found');
            });
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 5: Discount Organization Ownership Validation
   * 
   * For any membership type being saved with discountIds, if any discount ID belongs
   * to a different organization, the API should reject the request with a validation error.
   * 
   * **Validates: Requirements 9.2**
   */
  describe('Property 5: Discount Organization Ownership Validation', () => {
    /**
     * Test: Discounts from different organizations should be rejected
     * 
     * Property: When validating discount IDs, if any discount belongs to a different
     * organization than the membership type's organization, the validation should fail
     * with a 'wrong_organisation' error for that discount ID.
     */
    it('should reject discount IDs that belong to different organizations', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(fc.uuid(), { minLength: 1, maxLength: 10 }),
          fc.uuid(),
          fc.uuid(),
          async (discountIds, membershipOrgId, differentOrgId) => {
            // Ensure the organizations are different
            fc.pre(membershipOrgId !== differentOrgId);

            // Arrange: Mock database to return discounts belonging to different organization
            const discounts = discountIds.map(id => ({
              id,
              organisation_id: differentOrgId, // Different organization
              module_type: 'memberships',
              status: 'active',
            }));

            mockDb.query.mockResolvedValueOnce({
              rows: discounts,
              command: 'SELECT',
              rowCount: discounts.length,
              oid: 0,
              fields: [],
            });

            // Act
            const result = await service.validateDiscountIds(discountIds, membershipOrgId);

            // Assert: Property - Validation fails
            expect(result.valid).toBe(false);
            expect(result.errors.length).toBe(discountIds.length);

            // Property: Each discount has a 'wrong_organisation' error
            discountIds.forEach(discountId => {
              expect(result.errors).toContainEqual(
                expect.objectContaining({
                  discountId,
                  reason: 'wrong_organisation',
                  message: expect.stringContaining(discountId),
                })
              );
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Test: Discounts from the same organization should pass ownership validation
     * 
     * Property: When all discount IDs belong to the same organization as the membership
     * type, the ownership check should not produce any 'wrong_organisation' errors.
     */
    it('should pass ownership validation when all discounts belong to same organization', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(fc.uuid(), { minLength: 1, maxLength: 10 }),
          fc.uuid(),
          async (discountIds, organisationId) => {
            // Arrange: Mock database to return discounts from same organization
            const discounts = discountIds.map(id => ({
              id,
              organisation_id: organisationId, // Same organization
              module_type: 'memberships',
              status: 'active',
            }));

            mockDb.query.mockResolvedValueOnce({
              rows: discounts,
              command: 'SELECT',
              rowCount: discounts.length,
              oid: 0,
              fields: [],
            });

            // Act
            const result = await service.validateDiscountIds(discountIds, organisationId);

            // Assert: Property - No 'wrong_organisation' errors
            const wrongOrgErrors = result.errors.filter(e => e.reason === 'wrong_organisation');
            expect(wrongOrgErrors).toHaveLength(0);

            // Property: Validation passes (assuming other criteria met)
            expect(result.valid).toBe(true);
            expect(result.errors).toHaveLength(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Test: Mixed organization ownership should reject only wrong-org discounts
     * 
     * Property: When some discounts belong to the correct organization and others don't,
     * validation should produce 'wrong_organisation' errors only for the discounts
     * belonging to different organizations.
     */
    it('should produce errors only for discounts from different organizations', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(fc.uuid(), { minLength: 2, maxLength: 10 }),
          fc.uuid(),
          fc.uuid(),
          fc.integer({ min: 1, max: 9 }),
          async (allDiscountIds, correctOrgId, wrongOrgId, correctOrgCount) => {
            // Ensure organizations are different
            fc.pre(correctOrgId !== wrongOrgId);

            // Ensure we have at least one of each
            const actualCorrectCount = Math.min(correctOrgCount, allDiscountIds.length - 1);
            fc.pre(actualCorrectCount > 0 && actualCorrectCount < allDiscountIds.length);

            const correctOrgIds = allDiscountIds.slice(0, actualCorrectCount);
            const wrongOrgIds = allDiscountIds.slice(actualCorrectCount);

            // Arrange: Mock database to return mixed organization discounts
            const discounts = [
              ...correctOrgIds.map(id => ({
                id,
                organisation_id: correctOrgId,
                module_type: 'memberships',
                status: 'active',
              })),
              ...wrongOrgIds.map(id => ({
                id,
                organisation_id: wrongOrgId,
                module_type: 'memberships',
                status: 'active',
              })),
            ];

            mockDb.query.mockResolvedValueOnce({
              rows: discounts,
              command: 'SELECT',
              rowCount: discounts.length,
              oid: 0,
              fields: [],
            });

            // Act
            const result = await service.validateDiscountIds(allDiscountIds, correctOrgId);

            // Assert: Property - Validation fails
            expect(result.valid).toBe(false);

            // Property: Errors count matches wrong-org IDs count
            const wrongOrgErrors = result.errors.filter(e => e.reason === 'wrong_organisation');
            expect(wrongOrgErrors.length).toBe(wrongOrgIds.length);

            // Property: Each wrong-org ID has an error
            wrongOrgIds.forEach(discountId => {
              expect(result.errors).toContainEqual(
                expect.objectContaining({
                  discountId,
                  reason: 'wrong_organisation',
                })
              );
            });

            // Property: No wrong_organisation errors for correct-org IDs
            correctOrgIds.forEach(discountId => {
              const wrongOrgErrorsForThisId = result.errors.filter(
                e => e.discountId === discountId && e.reason === 'wrong_organisation'
              );
              expect(wrongOrgErrorsForThisId).toHaveLength(0);
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Test: Single discount from different organization should be rejected
     * 
     * Property: When validating a single discount ID that belongs to a different
     * organization, validation should fail with exactly one 'wrong_organisation' error.
     */
    it('should reject single discount from different organization', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          fc.uuid(),
          fc.uuid(),
          async (discountId, membershipOrgId, discountOrgId) => {
            // Ensure organizations are different
            fc.pre(membershipOrgId !== discountOrgId);

            // Arrange: Mock database to return discount from different organization
            mockDb.query.mockResolvedValueOnce({
              rows: [{
                id: discountId,
                organisation_id: discountOrgId,
                module_type: 'memberships',
                status: 'active',
              }],
              command: 'SELECT',
              rowCount: 1,
              oid: 0,
              fields: [],
            });

            // Act
            const result = await service.validateDiscountIds([discountId], membershipOrgId);

            // Assert: Property - Validation fails with exactly one 'wrong_organisation' error
            expect(result.valid).toBe(false);
            expect(result.errors).toHaveLength(1);
            expect(result.errors[0]).toEqual(
              expect.objectContaining({
                discountId,
                reason: 'wrong_organisation',
                message: expect.stringContaining(discountId),
              })
            );
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Test: Error message should contain the discount ID
     * 
     * Property: For any discount ID that belongs to a different organization,
     * the error message should contain that discount ID for debugging purposes.
     */
    it('should include discount ID in wrong_organisation error message', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(fc.uuid(), { minLength: 1, maxLength: 5 }),
          fc.uuid(),
          fc.uuid(),
          async (discountIds, membershipOrgId, discountOrgId) => {
            // Ensure organizations are different
            fc.pre(membershipOrgId !== discountOrgId);

            // Arrange: Mock database to return discounts from different organization
            const discounts = discountIds.map(id => ({
              id,
              organisation_id: discountOrgId,
              module_type: 'memberships',
              status: 'active',
            }));

            mockDb.query.mockResolvedValueOnce({
              rows: discounts,
              command: 'SELECT',
              rowCount: discounts.length,
              oid: 0,
              fields: [],
            });

            // Act
            const result = await service.validateDiscountIds(discountIds, membershipOrgId);

            // Assert: Property - Each error message contains the discount ID
            result.errors.forEach(error => {
              if (error.reason === 'wrong_organisation') {
                expect(error.message).toContain(error.discountId);
              }
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Test: Organization ID comparison should be exact
     * 
     * Property: Organization ownership validation should use exact string comparison.
     * Even similar-looking organization IDs should be treated as different if they
     * don't match exactly.
     */
    it('should use exact string comparison for organization IDs', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          fc.uuid(),
          async (discountId, baseOrgId) => {
            // Create a slightly different organization ID
            const membershipOrgId = baseOrgId;
            const discountOrgId = baseOrgId.toUpperCase(); // Different case

            // Skip if they're the same (shouldn't happen with UUID, but be safe)
            fc.pre(membershipOrgId !== discountOrgId);

            // Arrange: Mock database to return discount with different-case org ID
            mockDb.query.mockResolvedValueOnce({
              rows: [{
                id: discountId,
                organisation_id: discountOrgId,
                module_type: 'memberships',
                status: 'active',
              }],
              command: 'SELECT',
              rowCount: 1,
              oid: 0,
              fields: [],
            });

            // Act
            const result = await service.validateDiscountIds([discountId], membershipOrgId);

            // Assert: Property - Validation fails due to exact string comparison
            expect(result.valid).toBe(false);
            expect(result.errors).toContainEqual(
              expect.objectContaining({
                discountId,
                reason: 'wrong_organisation',
              })
            );
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Test: All discounts must belong to the same organization
     * 
     * Property: For validation to pass, ALL discount IDs must belong to the
     * membership type's organization. If even one discount belongs to a different
     * organization, validation should fail.
     */
    it('should require all discounts to belong to the same organization', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(fc.uuid(), { minLength: 2, maxLength: 10 }),
          fc.uuid(),
          fc.uuid(),
          async (discountIds, correctOrgId, wrongOrgId) => {
            // Ensure organizations are different
            fc.pre(correctOrgId !== wrongOrgId);

            // Arrange: All discounts except the last one belong to correct org
            const discounts = discountIds.map((id, index) => ({
              id,
              organisation_id: index === discountIds.length - 1 ? wrongOrgId : correctOrgId,
              module_type: 'memberships',
              status: 'active',
            }));

            mockDb.query.mockResolvedValueOnce({
              rows: discounts,
              command: 'SELECT',
              rowCount: discounts.length,
              oid: 0,
              fields: [],
            });

            // Act
            const result = await service.validateDiscountIds(discountIds, correctOrgId);

            // Assert: Property - Validation fails because one discount is from wrong org
            expect(result.valid).toBe(false);

            // Property: Exactly one 'wrong_organisation' error
            const wrongOrgErrors = result.errors.filter(e => e.reason === 'wrong_organisation');
            expect(wrongOrgErrors.length).toBe(1);
            expect(wrongOrgErrors[0].discountId).toBe(discountIds[discountIds.length - 1]);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Test: Duplicate discount IDs from wrong organization
     * 
     * Property: When the same discount ID appears multiple times and belongs to
     * a different organization, there should be a 'wrong_organisation' error for
     * each occurrence.
     */
    it('should handle duplicate discount IDs from wrong organization', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          fc.integer({ min: 2, max: 5 }),
          fc.uuid(),
          fc.uuid(),
          async (discountId, duplicateCount, membershipOrgId, discountOrgId) => {
            // Ensure organizations are different
            fc.pre(membershipOrgId !== discountOrgId);

            // Arrange: Create array with duplicate IDs
            const discountIds = Array(duplicateCount).fill(discountId);

            // Mock database to return discount from different organization
            mockDb.query.mockResolvedValueOnce({
              rows: [{
                id: discountId,
                organisation_id: discountOrgId,
                module_type: 'memberships',
                status: 'active',
              }],
              command: 'SELECT',
              rowCount: 1,
              oid: 0,
              fields: [],
            });

            // Act
            const result = await service.validateDiscountIds(discountIds, membershipOrgId);

            // Assert: Property - Validation fails
            expect(result.valid).toBe(false);

            // Property: Each duplicate should have a 'wrong_organisation' error
            expect(result.errors.length).toBe(duplicateCount);
            result.errors.forEach(error => {
              expect(error.discountId).toBe(discountId);
              expect(error.reason).toBe('wrong_organisation');
            });
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 6: Discount Module Type Validation
   * 
   * For any membership type being saved with discountIds, if any discount ID has a
   * moduleType other than 'memberships', the API should reject the request with a
   * validation error.
   * 
   * **Validates: Requirements 9.3**
   */
  describe('Property 6: Discount Module Type Validation', () => {
    /**
     * Test: Discounts with wrong moduleType should be rejected
     * 
     * Property: When validating discount IDs, if any discount has a moduleType other
     * than 'memberships', the validation should fail with a 'wrong_module_type' error
     * for that discount ID.
     */
    it('should reject discount IDs with moduleType other than memberships', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(fc.uuid(), { minLength: 1, maxLength: 10 }),
          fc.uuid(),
          fc.constantFrom('events', 'calendar', 'merchandise', 'registrations'),
          async (discountIds, organisationId, wrongModuleType) => {
            // Arrange: Mock database to return discounts with wrong moduleType
            const discounts = discountIds.map(id => ({
              id,
              organisation_id: organisationId,
              module_type: wrongModuleType, // Wrong module type
              status: 'active',
            }));

            mockDb.query.mockResolvedValueOnce({
              rows: discounts,
              command: 'SELECT',
              rowCount: discounts.length,
              oid: 0,
              fields: [],
            });

            // Act
            const result = await service.validateDiscountIds(discountIds, organisationId);

            // Assert: Property - Validation fails
            expect(result.valid).toBe(false);
            expect(result.errors.length).toBe(discountIds.length);

            // Property: Each discount has a 'wrong_module_type' error
            discountIds.forEach(discountId => {
              expect(result.errors).toContainEqual(
                expect.objectContaining({
                  discountId,
                  reason: 'wrong_module_type',
                  message: expect.stringContaining(discountId),
                })
              );
            });

            // Property: Error message should mention the actual moduleType
            result.errors.forEach(error => {
              expect(error.message).toContain(wrongModuleType);
              expect(error.message).toContain('memberships');
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Test: Discounts with 'memberships' moduleType should pass validation
     * 
     * Property: When all discount IDs have moduleType 'memberships', the module type
     * check should not produce any 'wrong_module_type' errors.
     */
    it('should pass module type validation when all discounts have memberships moduleType', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(fc.uuid(), { minLength: 1, maxLength: 10 }),
          fc.uuid(),
          async (discountIds, organisationId) => {
            // Arrange: Mock database to return discounts with correct moduleType
            const discounts = discountIds.map(id => ({
              id,
              organisation_id: organisationId,
              module_type: 'memberships', // Correct module type
              status: 'active',
            }));

            mockDb.query.mockResolvedValueOnce({
              rows: discounts,
              command: 'SELECT',
              rowCount: discounts.length,
              oid: 0,
              fields: [],
            });

            // Act
            const result = await service.validateDiscountIds(discountIds, organisationId);

            // Assert: Property - No 'wrong_module_type' errors
            const wrongModuleTypeErrors = result.errors.filter(e => e.reason === 'wrong_module_type');
            expect(wrongModuleTypeErrors).toHaveLength(0);

            // Property: Validation passes (assuming other criteria met)
            expect(result.valid).toBe(true);
            expect(result.errors).toHaveLength(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Test: Mixed moduleTypes should reject only wrong-type discounts
     * 
     * Property: When some discounts have moduleType 'memberships' and others have
     * different moduleTypes, validation should produce 'wrong_module_type' errors
     * only for the discounts with incorrect moduleTypes.
     */
    it('should produce errors only for discounts with wrong moduleType', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(fc.uuid(), { minLength: 2, maxLength: 10 }),
          fc.uuid(),
          fc.constantFrom('events', 'calendar', 'merchandise', 'registrations'),
          fc.integer({ min: 1, max: 9 }),
          async (allDiscountIds, organisationId, wrongModuleType, correctTypeCount) => {
            // Ensure we have at least one of each
            const actualCorrectCount = Math.min(correctTypeCount, allDiscountIds.length - 1);
            fc.pre(actualCorrectCount > 0 && actualCorrectCount < allDiscountIds.length);

            const correctTypeIds = allDiscountIds.slice(0, actualCorrectCount);
            const wrongTypeIds = allDiscountIds.slice(actualCorrectCount);

            // Arrange: Mock database to return mixed moduleType discounts
            const discounts = [
              ...correctTypeIds.map(id => ({
                id,
                organisation_id: organisationId,
                module_type: 'memberships',
                status: 'active',
              })),
              ...wrongTypeIds.map(id => ({
                id,
                organisation_id: organisationId,
                module_type: wrongModuleType,
                status: 'active',
              })),
            ];

            mockDb.query.mockResolvedValueOnce({
              rows: discounts,
              command: 'SELECT',
              rowCount: discounts.length,
              oid: 0,
              fields: [],
            });

            // Act
            const result = await service.validateDiscountIds(allDiscountIds, organisationId);

            // Assert: Property - Validation fails
            expect(result.valid).toBe(false);

            // Property: Errors count matches wrong-type IDs count
            const wrongModuleTypeErrors = result.errors.filter(e => e.reason === 'wrong_module_type');
            expect(wrongModuleTypeErrors.length).toBe(wrongTypeIds.length);

            // Property: Each wrong-type ID has an error
            wrongTypeIds.forEach(discountId => {
              expect(result.errors).toContainEqual(
                expect.objectContaining({
                  discountId,
                  reason: 'wrong_module_type',
                })
              );
            });

            // Property: No wrong_module_type errors for correct-type IDs
            correctTypeIds.forEach(discountId => {
              const wrongTypeErrorsForThisId = result.errors.filter(
                e => e.discountId === discountId && e.reason === 'wrong_module_type'
              );
              expect(wrongTypeErrorsForThisId).toHaveLength(0);
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Test: Single discount with wrong moduleType should be rejected
     * 
     * Property: When validating a single discount ID that has a moduleType other
     * than 'memberships', validation should fail with exactly one 'wrong_module_type' error.
     */
    it('should reject single discount with wrong moduleType', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          fc.uuid(),
          fc.constantFrom('events', 'calendar', 'merchandise', 'registrations'),
          async (discountId, organisationId, wrongModuleType) => {
            // Arrange: Mock database to return discount with wrong moduleType
            mockDb.query.mockResolvedValueOnce({
              rows: [{
                id: discountId,
                organisation_id: organisationId,
                module_type: wrongModuleType,
                status: 'active',
              }],
              command: 'SELECT',
              rowCount: 1,
              oid: 0,
              fields: [],
            });

            // Act
            const result = await service.validateDiscountIds([discountId], organisationId);

            // Assert: Property - Validation fails with exactly one 'wrong_module_type' error
            expect(result.valid).toBe(false);
            expect(result.errors).toHaveLength(1);
            expect(result.errors[0]).toEqual(
              expect.objectContaining({
                discountId,
                reason: 'wrong_module_type',
                message: expect.stringContaining(discountId),
              })
            );

            // Property: Error message should mention both actual and expected moduleType
            expect(result.errors[0].message).toContain(wrongModuleType);
            expect(result.errors[0].message).toContain('memberships');
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Test: Error message should contain the discount ID and moduleType details
     * 
     * Property: For any discount ID that has the wrong moduleType, the error message
     * should contain the discount ID, the actual moduleType, and the expected moduleType.
     */
    it('should include discount ID and moduleType details in error message', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(fc.uuid(), { minLength: 1, maxLength: 5 }),
          fc.uuid(),
          fc.constantFrom('events', 'calendar', 'merchandise', 'registrations'),
          async (discountIds, organisationId, wrongModuleType) => {
            // Arrange: Mock database to return discounts with wrong moduleType
            const discounts = discountIds.map(id => ({
              id,
              organisation_id: organisationId,
              module_type: wrongModuleType,
              status: 'active',
            }));

            mockDb.query.mockResolvedValueOnce({
              rows: discounts,
              command: 'SELECT',
              rowCount: discounts.length,
              oid: 0,
              fields: [],
            });

            // Act
            const result = await service.validateDiscountIds(discountIds, organisationId);

            // Assert: Property - Each error message contains required details
            result.errors.forEach(error => {
              if (error.reason === 'wrong_module_type') {
                expect(error.message).toContain(error.discountId);
                expect(error.message).toContain(wrongModuleType);
                expect(error.message).toContain('memberships');
              }
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Test: Module type comparison should be exact
     * 
     * Property: Module type validation should use exact string comparison.
     * Even similar-looking module types should be treated as different if they
     * don't match exactly 'memberships'.
     */
    it('should use exact string comparison for moduleType', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          fc.uuid(),
          fc.constantFrom('Memberships', 'MEMBERSHIPS', 'membership', 'Membership'),
          async (discountId, organisationId, wrongCaseModuleType) => {
            // Arrange: Mock database to return discount with different-case moduleType
            mockDb.query.mockResolvedValueOnce({
              rows: [{
                id: discountId,
                organisation_id: organisationId,
                module_type: wrongCaseModuleType,
                status: 'active',
              }],
              command: 'SELECT',
              rowCount: 1,
              oid: 0,
              fields: [],
            });

            // Act
            const result = await service.validateDiscountIds([discountId], organisationId);

            // Assert: Property - Validation fails due to exact string comparison
            expect(result.valid).toBe(false);
            expect(result.errors).toContainEqual(
              expect.objectContaining({
                discountId,
                reason: 'wrong_module_type',
              })
            );
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Test: All discounts must have 'memberships' moduleType
     * 
     * Property: For validation to pass, ALL discount IDs must have moduleType
     * 'memberships'. If even one discount has a different moduleType, validation
     * should fail.
     */
    it('should require all discounts to have memberships moduleType', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(fc.uuid(), { minLength: 2, maxLength: 10 }),
          fc.uuid(),
          fc.constantFrom('events', 'calendar', 'merchandise', 'registrations'),
          async (discountIds, organisationId, wrongModuleType) => {
            // Arrange: All discounts except the last one have correct moduleType
            const discounts = discountIds.map((id, index) => ({
              id,
              organisation_id: organisationId,
              module_type: index === discountIds.length - 1 ? wrongModuleType : 'memberships',
              status: 'active',
            }));

            mockDb.query.mockResolvedValueOnce({
              rows: discounts,
              command: 'SELECT',
              rowCount: discounts.length,
              oid: 0,
              fields: [],
            });

            // Act
            const result = await service.validateDiscountIds(discountIds, organisationId);

            // Assert: Property - Validation fails because one discount has wrong moduleType
            expect(result.valid).toBe(false);

            // Property: Exactly one 'wrong_module_type' error
            const wrongModuleTypeErrors = result.errors.filter(e => e.reason === 'wrong_module_type');
            expect(wrongModuleTypeErrors.length).toBe(1);
            expect(wrongModuleTypeErrors[0].discountId).toBe(discountIds[discountIds.length - 1]);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Test: Duplicate discount IDs with wrong moduleType
     * 
     * Property: When the same discount ID appears multiple times and has a moduleType
     * other than 'memberships', there should be a 'wrong_module_type' error for each
     * occurrence.
     */
    it('should handle duplicate discount IDs with wrong moduleType', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          fc.integer({ min: 2, max: 5 }),
          fc.uuid(),
          fc.constantFrom('events', 'calendar', 'merchandise', 'registrations'),
          async (discountId, duplicateCount, organisationId, wrongModuleType) => {
            // Arrange: Create array with duplicate IDs
            const discountIds = Array(duplicateCount).fill(discountId);

            // Mock database to return discount with wrong moduleType
            mockDb.query.mockResolvedValueOnce({
              rows: [{
                id: discountId,
                organisation_id: organisationId,
                module_type: wrongModuleType,
                status: 'active',
              }],
              command: 'SELECT',
              rowCount: 1,
              oid: 0,
              fields: [],
            });

            // Act
            const result = await service.validateDiscountIds(discountIds, organisationId);

            // Assert: Property - Validation fails
            expect(result.valid).toBe(false);

            // Property: Each duplicate should have a 'wrong_module_type' error
            expect(result.errors.length).toBe(duplicateCount);
            result.errors.forEach(error => {
              expect(error.discountId).toBe(discountId);
              expect(error.reason).toBe('wrong_module_type');
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Test: Multiple validation errors can occur for the same discount
     * 
     * Property: A discount can fail multiple validation checks (e.g., wrong organization
     * AND wrong moduleType), but in practice the validation logic checks in order and
     * returns the first error found. This test verifies that wrong_module_type is checked
     * after organization ownership.
     */
    it('should check moduleType after organization ownership', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          fc.uuid(),
          fc.uuid(),
          fc.constantFrom('events', 'calendar', 'merchandise', 'registrations'),
          async (discountId, membershipOrgId, discountOrgId, wrongModuleType) => {
            // Ensure organizations are different
            fc.pre(membershipOrgId !== discountOrgId);

            // Arrange: Discount has both wrong organization AND wrong moduleType
            mockDb.query.mockResolvedValueOnce({
              rows: [{
                id: discountId,
                organisation_id: discountOrgId, // Wrong organization
                module_type: wrongModuleType, // Wrong moduleType
                status: 'active',
              }],
              command: 'SELECT',
              rowCount: 1,
              oid: 0,
              fields: [],
            });

            // Act
            const result = await service.validateDiscountIds([discountId], membershipOrgId);

            // Assert: Property - Validation fails
            expect(result.valid).toBe(false);
            expect(result.errors).toHaveLength(1);

            // Property: Organization check happens first, so we get 'wrong_organisation' error
            // (This validates the order of validation checks in the implementation)
            expect(result.errors[0].reason).toBe('wrong_organisation');
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Test: All possible wrong moduleTypes should be rejected
     * 
     * Property: Any moduleType value other than 'memberships' should be rejected,
     * regardless of what that value is.
     */
    it('should reject all non-memberships moduleTypes', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          fc.uuid(),
          fc.string({ minLength: 1, maxLength: 50 }).filter(s => s !== 'memberships'),
          async (discountId, organisationId, arbitraryModuleType) => {
            // Arrange: Mock database to return discount with arbitrary moduleType
            mockDb.query.mockResolvedValueOnce({
              rows: [{
                id: discountId,
                organisation_id: organisationId,
                module_type: arbitraryModuleType,
                status: 'active',
              }],
              command: 'SELECT',
              rowCount: 1,
              oid: 0,
              fields: [],
            });

            // Act
            const result = await service.validateDiscountIds([discountId], organisationId);

            // Assert: Property - Validation fails for any non-'memberships' moduleType
            expect(result.valid).toBe(false);
            expect(result.errors).toContainEqual(
              expect.objectContaining({
                discountId,
                reason: 'wrong_module_type',
              })
            );
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 7: Validation Error Message Completeness
   * 
   * For any discount validation failure, the error message should contain the failing
   * discount ID and the specific reason for failure.
   * 
   * **Validates: Requirements 9.5**
   */
  describe('Property 7: Validation Error Message Completeness', () => {
    /**
     * Test: Error messages should always contain discount ID
     * 
     * Property: For any validation error, the error message should contain the
     * discount ID that failed validation.
     */
    it('should include discount ID in all error messages', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(fc.uuid(), { minLength: 1, maxLength: 10 }),
          fc.uuid(),
          fc.constantFrom(
            'not_found',
            'wrong_organisation',
            'wrong_module_type',
            'inactive'
          ),
          async (discountIds, organisationId, errorType) => {
            // Arrange: Mock database based on error type
            let discounts: any[];
            switch (errorType) {
              case 'not_found':
                // Return empty array to trigger not_found errors
                discounts = [];
                break;
              case 'wrong_organisation':
                // Return discounts with different organization
                discounts = discountIds.map(id => ({
                  id,
                  organisation_id: fc.sample(fc.uuid().filter(uuid => uuid !== organisationId), 1)[0],
                  module_type: 'memberships',
                  status: 'active',
                }));
                break;
              case 'wrong_module_type':
                // Return discounts with wrong moduleType
                discounts = discountIds.map(id => ({
                  id,
                  organisation_id: organisationId,
                  module_type: 'events',
                  status: 'active',
                }));
                break;
              case 'inactive':
                // Return inactive discounts
                discounts = discountIds.map(id => ({
                  id,
                  organisation_id: organisationId,
                  module_type: 'memberships',
                  status: 'inactive',
                }));
                break;
              default:
                discounts = [];
            }

            mockDb.query.mockResolvedValueOnce({
              rows: discounts,
              command: 'SELECT',
              rowCount: discounts.length,
              oid: 0,
              fields: [],
            });

            // Act
            const result = await service.validateDiscountIds(discountIds, organisationId);

            // Assert: Property - All error messages contain the discount ID
            expect(result.valid).toBe(false);
            expect(result.errors.length).toBeGreaterThan(0);

            result.errors.forEach(error => {
              expect(error.message).toContain(error.discountId);
              expect(discountIds).toContain(error.discountId);
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Test: Error messages should contain specific reason for failure
     * 
     * Property: For any validation error, the error message should provide a clear
     * explanation of why the validation failed (not just the error code).
     */
    it('should include specific failure reason in error messages', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          fc.uuid(),
          async (discountId, organisationId) => {
            // Test all error types
            const errorScenarios = [
              {
                type: 'not_found',
                mockData: [],
                expectedInMessage: ['does not exist', 'not exist'],
              },
              {
                type: 'wrong_organisation',
                mockData: [{
                  id: discountId,
                  organisation_id: fc.sample(fc.uuid().filter(uuid => uuid !== organisationId), 1)[0],
                  module_type: 'memberships',
                  status: 'active',
                }],
                expectedInMessage: ['different organisation', 'different organization'],
              },
              {
                type: 'wrong_module_type',
                mockData: [{
                  id: discountId,
                  organisation_id: organisationId,
                  module_type: 'events',
                  status: 'active',
                }],
                expectedInMessage: ['moduleType', 'events', 'memberships'],
              },
              {
                type: 'inactive',
                mockData: [{
                  id: discountId,
                  organisation_id: organisationId,
                  module_type: 'memberships',
                  status: 'inactive',
                }],
                expectedInMessage: ['inactive'],
              },
            ];

            for (const scenario of errorScenarios) {
              jest.clearAllMocks();

              mockDb.query.mockResolvedValueOnce({
                rows: scenario.mockData,
                command: 'SELECT',
                rowCount: scenario.mockData.length,
                oid: 0,
                fields: [],
              });

              // Act
              const result = await service.validateDiscountIds([discountId], organisationId);

              // Assert: Property - Error message contains specific reason
              expect(result.valid).toBe(false);
              expect(result.errors).toHaveLength(1);
              expect(result.errors[0].reason).toBe(scenario.type);

              // Property: Message contains at least one of the expected phrases
              const message = result.errors[0].message.toLowerCase();
              const hasExpectedPhrase = scenario.expectedInMessage.some(phrase =>
                message.includes(phrase.toLowerCase())
              );
              expect(hasExpectedPhrase).toBe(true);
            }
          }
        ),
        { numRuns: 25 } // Reduced runs since we test 4 scenarios per run
      );
    });

    /**
     * Test: Error messages should be descriptive and actionable
     * 
     * Property: For any validation error, the error message should be descriptive
     * enough to help developers understand what went wrong and how to fix it.
     */
    it('should provide descriptive and actionable error messages', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(fc.uuid(), { minLength: 1, maxLength: 5 }),
          fc.uuid(),
          async (discountIds, organisationId) => {
            // Arrange: Create a mix of validation errors
            const mixedDiscounts = discountIds.map((id, index) => {
              const errorType = index % 4;
              switch (errorType) {
                case 0:
                  // This will cause not_found (we'll only return some discounts)
                  return null;
                case 1:
                  return {
                    id,
                    organisation_id: fc.sample(fc.uuid().filter(uuid => uuid !== organisationId), 1)[0],
                    module_type: 'memberships',
                    status: 'active',
                  };
                case 2:
                  return {
                    id,
                    organisation_id: organisationId,
                    module_type: 'events',
                    status: 'active',
                  };
                case 3:
                  return {
                    id,
                    organisation_id: organisationId,
                    module_type: 'memberships',
                    status: 'inactive',
                  };
                default:
                  return null;
              }
            }).filter(d => d !== null);

            mockDb.query.mockResolvedValueOnce({
              rows: mixedDiscounts,
              command: 'SELECT',
              rowCount: mixedDiscounts.length,
              oid: 0,
              fields: [],
            });

            // Act
            const result = await service.validateDiscountIds(discountIds, organisationId);

            // Assert: Property - All error messages are descriptive
            result.errors.forEach(error => {
              // Property: Message is not empty
              expect(error.message).toBeTruthy();
              expect(error.message.length).toBeGreaterThan(10);

              // Property: Message contains the discount ID
              expect(error.message).toContain(error.discountId);

              // Property: Message is a complete sentence (starts with capital, has content)
              expect(error.message[0]).toMatch(/[A-Z]/);

              // Property: Message provides context about what failed
              expect(error.message.length).toBeGreaterThan(20);
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Test: Each error should have both discountId and reason fields
     * 
     * Property: For any validation error, the error object should contain both
     * the discountId field and the reason field, in addition to the message.
     */
    it('should include discountId and reason fields in all errors', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(fc.uuid(), { minLength: 1, maxLength: 10 }),
          fc.uuid(),
          async (discountIds, organisationId) => {
            // Arrange: Mock database to return no discounts (trigger not_found errors)
            mockDb.query.mockResolvedValueOnce({
              rows: [],
              command: 'SELECT',
              rowCount: 0,
              oid: 0,
              fields: [],
            });

            // Act
            const result = await service.validateDiscountIds(discountIds, organisationId);

            // Assert: Property - All errors have required fields
            expect(result.valid).toBe(false);
            expect(result.errors.length).toBe(discountIds.length);

            result.errors.forEach(error => {
              // Property: Error has discountId field
              expect(error).toHaveProperty('discountId');
              expect(typeof error.discountId).toBe('string');
              expect(error.discountId).toBeTruthy();

              // Property: Error has reason field
              expect(error).toHaveProperty('reason');
              expect(typeof error.reason).toBe('string');
              expect(error.reason).toBeTruthy();

              // Property: Error has message field
              expect(error).toHaveProperty('message');
              expect(typeof error.message).toBe('string');
              expect(error.message).toBeTruthy();

              // Property: Reason is one of the valid error types
              expect(['not_found', 'wrong_organisation', 'wrong_module_type', 'inactive'])
                .toContain(error.reason);
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Test: Error messages for wrong_module_type should include actual and expected types
     * 
     * Property: When a discount has the wrong moduleType, the error message should
     * include both the actual moduleType and the expected moduleType ('memberships').
     */
    it('should include actual and expected moduleType in wrong_module_type errors', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(fc.uuid(), { minLength: 1, maxLength: 5 }),
          fc.uuid(),
          fc.constantFrom('events', 'calendar', 'merchandise', 'registrations'),
          async (discountIds, organisationId, actualModuleType) => {
            // Arrange: Mock database to return discounts with wrong moduleType
            const discounts = discountIds.map(id => ({
              id,
              organisation_id: organisationId,
              module_type: actualModuleType,
              status: 'active',
            }));

            mockDb.query.mockResolvedValueOnce({
              rows: discounts,
              command: 'SELECT',
              rowCount: discounts.length,
              oid: 0,
              fields: [],
            });

            // Act
            const result = await service.validateDiscountIds(discountIds, organisationId);

            // Assert: Property - Error messages contain both actual and expected moduleType
            const wrongModuleTypeErrors = result.errors.filter(e => e.reason === 'wrong_module_type');
            expect(wrongModuleTypeErrors.length).toBe(discountIds.length);

            wrongModuleTypeErrors.forEach(error => {
              // Property: Message contains actual moduleType
              expect(error.message).toContain(actualModuleType);

              // Property: Message contains expected moduleType
              expect(error.message).toContain('memberships');

              // Property: Message contains discount ID
              expect(error.message).toContain(error.discountId);
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Test: Multiple errors should each have complete information
     * 
     * Property: When multiple discounts fail validation, each error should contain
     * complete information (discountId, reason, and descriptive message) independent
     * of other errors.
     */
    it('should provide complete information for each error independently', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(fc.uuid(), { minLength: 2, maxLength: 10 }),
          fc.uuid(),
          async (discountIds, organisationId) => {
            // Arrange: Mock database to return no discounts (all will fail)
            mockDb.query.mockResolvedValueOnce({
              rows: [],
              command: 'SELECT',
              rowCount: 0,
              oid: 0,
              fields: [],
            });

            // Act
            const result = await service.validateDiscountIds(discountIds, organisationId);

            // Assert: Property - Each error is complete and independent
            expect(result.errors.length).toBe(discountIds.length);

            // Property: Each error has unique discountId
            const errorDiscountIds = result.errors.map(e => e.discountId);
            expect(new Set(errorDiscountIds).size).toBe(discountIds.length);

            // Property: Each error is self-contained
            result.errors.forEach((error, index) => {
              // Can understand the error without looking at other errors
              expect(error.discountId).toBe(discountIds[index]);
              expect(error.reason).toBe('not_found');
              expect(error.message).toContain(error.discountId);
              expect(error.message).toContain('does not exist');
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Test: Error message consistency across different validation failures
     * 
     * Property: Error messages should follow a consistent format regardless of
     * the type of validation failure.
     */
    it('should maintain consistent error message format across failure types', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          fc.uuid(),
          async (discountId, organisationId) => {
            const scenarios = [
              {
                type: 'not_found',
                mockData: [],
              },
              {
                type: 'wrong_organisation',
                mockData: [{
                  id: discountId,
                  organisation_id: fc.sample(fc.uuid().filter(uuid => uuid !== organisationId), 1)[0],
                  module_type: 'memberships',
                  status: 'active',
                }],
              },
              {
                type: 'wrong_module_type',
                mockData: [{
                  id: discountId,
                  organisation_id: organisationId,
                  module_type: 'events',
                  status: 'active',
                }],
              },
              {
                type: 'inactive',
                mockData: [{
                  id: discountId,
                  organisation_id: organisationId,
                  module_type: 'memberships',
                  status: 'inactive',
                }],
              },
            ];

            const messages: string[] = [];

            for (const scenario of scenarios) {
              jest.clearAllMocks();

              mockDb.query.mockResolvedValueOnce({
                rows: scenario.mockData,
                command: 'SELECT',
                rowCount: scenario.mockData.length,
                oid: 0,
                fields: [],
              });

              const result = await service.validateDiscountIds([discountId], organisationId);
              expect(result.errors).toHaveLength(1);
              messages.push(result.errors[0].message);
            }

            // Property: All messages contain the discount ID
            messages.forEach(message => {
              expect(message).toContain(discountId);
            });

            // Property: All messages start with a capital letter
            messages.forEach(message => {
              expect(message[0]).toMatch(/[A-Z]/);
            });

            // Property: All messages are descriptive (not just error codes)
            messages.forEach(message => {
              expect(message.length).toBeGreaterThan(20);
            });
          }
        ),
        { numRuns: 25 } // Reduced runs since we test 4 scenarios per run
      );
    });

    /**
     * Test: Error messages should be unique for different failure reasons
     * 
     * Property: Different types of validation failures should produce different
     * error messages (not generic messages).
     */
    it('should produce unique messages for different failure reasons', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          fc.uuid(),
          async (discountId, organisationId) => {
            const scenarios = [
              {
                type: 'not_found',
                mockData: [],
              },
              {
                type: 'wrong_organisation',
                mockData: [{
                  id: discountId,
                  organisation_id: fc.sample(fc.uuid().filter(uuid => uuid !== organisationId), 1)[0],
                  module_type: 'memberships',
                  status: 'active',
                }],
              },
              {
                type: 'wrong_module_type',
                mockData: [{
                  id: discountId,
                  organisation_id: organisationId,
                  module_type: 'events',
                  status: 'active',
                }],
              },
              {
                type: 'inactive',
                mockData: [{
                  id: discountId,
                  organisation_id: organisationId,
                  module_type: 'memberships',
                  status: 'inactive',
                }],
              },
            ];

            const messages: string[] = [];

            for (const scenario of scenarios) {
              jest.clearAllMocks();

              mockDb.query.mockResolvedValueOnce({
                rows: scenario.mockData,
                command: 'SELECT',
                rowCount: scenario.mockData.length,
                oid: 0,
                fields: [],
              });

              const result = await service.validateDiscountIds([discountId], organisationId);
              expect(result.errors).toHaveLength(1);
              messages.push(result.errors[0].message);
            }

            // Property: All messages are different from each other
            const uniqueMessages = new Set(messages);
            expect(uniqueMessages.size).toBe(4);

            // Property: Each message is specific to its error type
            expect(messages[0]).toMatch(/does not exist|not exist/i);
            expect(messages[1]).toMatch(/different organisation|different organization/i);
            expect(messages[2]).toMatch(/moduleType|module type/i);
            expect(messages[3]).toMatch(/inactive/i);
          }
        ),
        { numRuns: 25 } // Reduced runs since we test 4 scenarios per run
      );
    });
  });

  /**
   * Property 3: Discount IDs Serialization Round Trip
   * 
   * For any membership type with a discountIds array, storing it to the database
   * and then retrieving it should produce an equivalent discountIds array.
   * 
   * **Validates: Requirements 3.5**
   */
  describe('Property 3: Discount IDs Serialization Round Trip', () => {
    /**
     * Test: DiscountIds array should survive serialization round trip
     * 
     * Property: When a membership type is created with a discountIds array,
     * retrieving it should return the exact same array.
     */
    it('should preserve discountIds array through create and retrieve cycle', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(fc.uuid(), { minLength: 0, maxLength: 10 }),
          fc.uuid(),
          fc.uuid(),
          async (discountIds, organisationId, membershipTypeId) => {
            // Arrange: Mock successful discount validation
            if (discountIds.length > 0) {
              const validDiscounts = discountIds.map(id => ({
                id,
                organisation_id: organisationId,
                module_type: 'memberships',
                status: 'active',
              }));

              mockDb.query.mockResolvedValueOnce({
                rows: validDiscounts,
                command: 'SELECT',
                rowCount: validDiscounts.length,
                oid: 0,
                fields: [],
              });
            }

            // Mock INSERT query for create
            const createdRow = {
              id: membershipTypeId,
              organisation_id: organisationId,
              name: 'Test Membership',
              description: 'Test Description',
              membership_form_id: fc.sample(fc.uuid(), 1)[0],
              membership_status: 'open',
              is_rolling_membership: true,
              valid_until: null,
              number_of_months: 12,
              automatically_approve: false,
              member_labels: [],
              supported_payment_methods: ['card'],
              use_terms_and_conditions: false,
              terms_and_conditions: null,
              membership_type_category: 'single',
              max_people_in_application: null,
              min_people_in_application: null,
              person_titles: null,
              person_labels: null,
              field_configuration: null,
              discount_ids: JSON.stringify(discountIds),
              created_at: new Date(),
              updated_at: new Date(),
            };

            mockDb.query.mockResolvedValueOnce({
              rows: [createdRow],
              command: 'INSERT',
              rowCount: 1,
              oid: 0,
              fields: [],
            });

            // Mock SELECT query for retrieve
            mockDb.query.mockResolvedValueOnce({
              rows: [createdRow],
              command: 'SELECT',
              rowCount: 1,
              oid: 0,
              fields: [],
            });

            // Act: Create membership type
            const created = await service.createMembershipType({
              organisationId,
              name: 'Test Membership',
              description: 'Test Description',
              membershipFormId: createdRow.membership_form_id,
              supportedPaymentMethods: ['card'],
              isRollingMembership: true,
              numberOfMonths: 12,
              discountIds,
            });

            // Retrieve membership type
            const retrieved = await service.getMembershipTypeById(membershipTypeId);

            // Assert: Property - Round trip preserves discountIds array
            expect(retrieved).not.toBeNull();
            expect(retrieved!.discountIds).toEqual(discountIds);
            expect(created.discountIds).toEqual(discountIds);

            // Property: Array length is preserved
            expect(retrieved!.discountIds.length).toBe(discountIds.length);

            // Property: Array order is preserved
            retrieved!.discountIds.forEach((id: string, index: number) => {
              expect(id).toBe(discountIds[index]);
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Test: Empty discountIds array should be preserved
     * 
     * Property: When a membership type is created with an empty discountIds array,
     * retrieving it should return an empty array (not null or undefined).
     */
    it('should preserve empty discountIds array', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          fc.uuid(),
          async (organisationId, membershipTypeId) => {
            // Arrange: Mock INSERT and SELECT with empty array
            const createdRow = {
              id: membershipTypeId,
              organisation_id: organisationId,
              name: 'Test Membership',
              description: 'Test Description',
              membership_form_id: fc.sample(fc.uuid(), 1)[0],
              membership_status: 'open',
              is_rolling_membership: true,
              valid_until: null,
              number_of_months: 12,
              automatically_approve: false,
              member_labels: [],
              supported_payment_methods: ['card'],
              use_terms_and_conditions: false,
              terms_and_conditions: null,
              membership_type_category: 'single',
              max_people_in_application: null,
              min_people_in_application: null,
              person_titles: null,
              person_labels: null,
              field_configuration: null,
              discount_ids: JSON.stringify([]),
              created_at: new Date(),
              updated_at: new Date(),
            };

            mockDb.query.mockResolvedValueOnce({
              rows: [createdRow],
              command: 'INSERT',
              rowCount: 1,
              oid: 0,
              fields: [],
            });

            mockDb.query.mockResolvedValueOnce({
              rows: [createdRow],
              command: 'SELECT',
              rowCount: 1,
              oid: 0,
              fields: [],
            });

            // Act
            const created = await service.createMembershipType({
              organisationId,
              name: 'Test Membership',
              description: 'Test Description',
              membershipFormId: createdRow.membership_form_id,
              supportedPaymentMethods: ['card'],
              isRollingMembership: true,
              numberOfMonths: 12,
              discountIds: [],
            });

            const retrieved = await service.getMembershipTypeById(membershipTypeId);

            // Assert: Property - Empty array is preserved
            expect(retrieved).not.toBeNull();
            expect(retrieved!.discountIds).toEqual([]);
            expect(Array.isArray(retrieved!.discountIds)).toBe(true);
            expect(retrieved!.discountIds.length).toBe(0);
            expect(created.discountIds).toEqual([]);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Test: Update operation should preserve discountIds round trip
     * 
     * Property: When a membership type is updated with a new discountIds array,
     * retrieving it should return the updated array.
     */
    it('should preserve discountIds array through update and retrieve cycle', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(fc.uuid(), { minLength: 0, maxLength: 10 }),
          fc.array(fc.uuid(), { minLength: 0, maxLength: 10 }),
          fc.uuid(),
          fc.uuid(),
          async (initialDiscountIds, updatedDiscountIds, organisationId, membershipTypeId) => {
            // Arrange: Mock existing membership type
            const existingRow = {
              id: membershipTypeId,
              organisation_id: organisationId,
              name: 'Test Membership',
              description: 'Test Description',
              membership_form_id: fc.sample(fc.uuid(), 1)[0],
              membership_status: 'open',
              is_rolling_membership: true,
              valid_until: null,
              number_of_months: 12,
              automatically_approve: false,
              member_labels: [],
              supported_payment_methods: ['card'],
              use_terms_and_conditions: false,
              terms_and_conditions: null,
              membership_type_category: 'single',
              max_people_in_application: null,
              min_people_in_application: null,
              person_titles: null,
              person_labels: null,
              field_configuration: null,
              discount_ids: JSON.stringify(initialDiscountIds),
              created_at: new Date(),
              updated_at: new Date(),
            };

            // Mock SELECT for existing membership type
            mockDb.query.mockResolvedValueOnce({
              rows: [existingRow],
              command: 'SELECT',
              rowCount: 1,
              oid: 0,
              fields: [],
            });

            // Mock discount validation if updating with discounts
            if (updatedDiscountIds.length > 0) {
              const validDiscounts = updatedDiscountIds.map(id => ({
                id,
                organisation_id: organisationId,
                module_type: 'memberships',
                status: 'active',
              }));

              mockDb.query.mockResolvedValueOnce({
                rows: validDiscounts,
                command: 'SELECT',
                rowCount: validDiscounts.length,
                oid: 0,
                fields: [],
              });
            }

            // Mock UPDATE query
            const updatedRow = {
              ...existingRow,
              discount_ids: JSON.stringify(updatedDiscountIds),
              updated_at: new Date(),
            };

            mockDb.query.mockResolvedValueOnce({
              rows: [updatedRow],
              command: 'UPDATE',
              rowCount: 1,
              oid: 0,
              fields: [],
            });

            // Mock SELECT for retrieve
            mockDb.query.mockResolvedValueOnce({
              rows: [updatedRow],
              command: 'SELECT',
              rowCount: 1,
              oid: 0,
              fields: [],
            });

            // Act: Update membership type
            const updated = await service.updateMembershipType(membershipTypeId, {
              discountIds: updatedDiscountIds,
            });

            // Retrieve membership type
            const retrieved = await service.getMembershipTypeById(membershipTypeId);

            // Assert: Property - Round trip preserves updated discountIds array
            expect(retrieved).not.toBeNull();
            expect(retrieved!.discountIds).toEqual(updatedDiscountIds);
            expect(updated.discountIds).toEqual(updatedDiscountIds);

            // Property: Array length is preserved
            expect(retrieved!.discountIds.length).toBe(updatedDiscountIds.length);

            // Property: Array order is preserved
            retrieved!.discountIds.forEach((id: string, index: number) => {
              expect(id).toBe(updatedDiscountIds[index]);
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Test: Null discount_ids in database should be deserialized as empty array
     * 
     * Property: When the discount_ids column is NULL in the database, the
     * deserialized discountIds field should be an empty array.
     */
    it('should deserialize null discount_ids as empty array', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          fc.uuid(),
          async (organisationId, membershipTypeId) => {
            // Arrange: Mock row with null discount_ids
            const rowWithNull = {
              id: membershipTypeId,
              organisation_id: organisationId,
              name: 'Test Membership',
              description: 'Test Description',
              membership_form_id: fc.sample(fc.uuid(), 1)[0],
              membership_status: 'open',
              is_rolling_membership: true,
              valid_until: null,
              number_of_months: 12,
              automatically_approve: false,
              member_labels: [],
              supported_payment_methods: ['card'],
              use_terms_and_conditions: false,
              terms_and_conditions: null,
              membership_type_category: 'single',
              max_people_in_application: null,
              min_people_in_application: null,
              person_titles: null,
              person_labels: null,
              field_configuration: null,
              discount_ids: null, // NULL in database
              created_at: new Date(),
              updated_at: new Date(),
            };

            mockDb.query.mockResolvedValueOnce({
              rows: [rowWithNull],
              command: 'SELECT',
              rowCount: 1,
              oid: 0,
              fields: [],
            });

            // Act
            const retrieved = await service.getMembershipTypeById(membershipTypeId);

            // Assert: Property - NULL is deserialized as empty array
            expect(retrieved).not.toBeNull();
            expect(retrieved!.discountIds).toEqual([]);
            expect(Array.isArray(retrieved!.discountIds)).toBe(true);
            expect(retrieved!.discountIds.length).toBe(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Test: Already-parsed array should be returned as-is
     * 
     * Property: When the discount_ids column is already an array (not a JSON string),
     * it should be returned as-is without attempting to parse it.
     */
    it('should handle already-parsed discount_ids array', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(fc.uuid(), { minLength: 0, maxLength: 10 }),
          fc.uuid(),
          fc.uuid(),
          async (discountIds, organisationId, membershipTypeId) => {
            // Arrange: Mock row with already-parsed array
            const rowWithArray = {
              id: membershipTypeId,
              organisation_id: organisationId,
              name: 'Test Membership',
              description: 'Test Description',
              membership_form_id: fc.sample(fc.uuid(), 1)[0],
              membership_status: 'open',
              is_rolling_membership: true,
              valid_until: null,
              number_of_months: 12,
              automatically_approve: false,
              member_labels: [],
              supported_payment_methods: ['card'],
              use_terms_and_conditions: false,
              terms_and_conditions: null,
              membership_type_category: 'single',
              max_people_in_application: null,
              min_people_in_application: null,
              person_titles: null,
              person_labels: null,
              field_configuration: null,
              discount_ids: discountIds, // Already an array
              created_at: new Date(),
              updated_at: new Date(),
            };

            mockDb.query.mockResolvedValueOnce({
              rows: [rowWithArray],
              command: 'SELECT',
              rowCount: 1,
              oid: 0,
              fields: [],
            });

            // Act
            const retrieved = await service.getMembershipTypeById(membershipTypeId);

            // Assert: Property - Array is returned as-is
            expect(retrieved).not.toBeNull();
            expect(retrieved!.discountIds).toEqual(discountIds);
            expect(Array.isArray(retrieved!.discountIds)).toBe(true);
            expect(retrieved!.discountIds.length).toBe(discountIds.length);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 22: API Parameter Acceptance for Create
   * 
   * For any valid CreateMembershipTypeDto with a discountIds array, the API should
   * accept the request without parameter-related errors.
   * 
   * **Validates: Requirements 3.3**
   */
  describe('Property 22: API Parameter Acceptance for Create', () => {
    /**
     * Test: CreateMembershipType should accept discountIds parameter
     * 
     * Property: When creating a membership type with valid discountIds, the API
     * should accept the parameter and not throw parameter-related errors.
     */
    it('should accept discountIds parameter in createMembershipType', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(fc.uuid(), { minLength: 0, maxLength: 10 }),
          fc.uuid(),
          fc.uuid(),
          async (discountIds, organisationId, membershipTypeId) => {
            // Arrange: Mock discount validation
            if (discountIds.length > 0) {
              const validDiscounts = discountIds.map(id => ({
                id,
                organisation_id: organisationId,
                module_type: 'memberships',
                status: 'active',
              }));

              mockDb.query.mockResolvedValueOnce({
                rows: validDiscounts,
                command: 'SELECT',
                rowCount: validDiscounts.length,
                oid: 0,
                fields: [],
              });
            }

            const createdRow = {
              id: membershipTypeId,
              organisation_id: organisationId,
              name: 'Test Membership',
              description: 'Test Description',
              membership_form_id: fc.sample(fc.uuid(), 1)[0],
              membership_status: 'open',
              is_rolling_membership: true,
              valid_until: null,
              number_of_months: 12,
              automatically_approve: false,
              member_labels: [],
              supported_payment_methods: ['card'],
              use_terms_and_conditions: false,
              terms_and_conditions: null,
              membership_type_category: 'single',
              max_people_in_application: null,
              min_people_in_application: null,
              person_titles: null,
              person_labels: null,
              field_configuration: null,
              discount_ids: JSON.stringify(discountIds),
              created_at: new Date(),
              updated_at: new Date(),
            };

            mockDb.query.mockResolvedValueOnce({
              rows: [createdRow],
              command: 'INSERT',
              rowCount: 1,
              oid: 0,
              fields: [],
            });

            // Act & Assert: Should not throw parameter-related errors
            await expect(service.createMembershipType({
              organisationId,
              name: 'Test Membership',
              description: 'Test Description',
              membershipFormId: createdRow.membership_form_id,
              supportedPaymentMethods: ['card'],
              isRollingMembership: true,
              numberOfMonths: 12,
              discountIds, // Parameter should be accepted
            })).resolves.toBeDefined();
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Test: CreateMembershipType should accept empty discountIds array
     * 
     * Property: When creating a membership type with an empty discountIds array,
     * the API should accept it without errors.
     */
    it('should accept empty discountIds array in createMembershipType', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          fc.uuid(),
          async (organisationId, membershipTypeId) => {
            const createdRow = {
              id: membershipTypeId,
              organisation_id: organisationId,
              name: 'Test Membership',
              description: 'Test Description',
              membership_form_id: fc.sample(fc.uuid(), 1)[0],
              membership_status: 'open',
              is_rolling_membership: true,
              valid_until: null,
              number_of_months: 12,
              automatically_approve: false,
              member_labels: [],
              supported_payment_methods: ['card'],
              use_terms_and_conditions: false,
              terms_and_conditions: null,
              membership_type_category: 'single',
              max_people_in_application: null,
              min_people_in_application: null,
              person_titles: null,
              person_labels: null,
              field_configuration: null,
              discount_ids: JSON.stringify([]),
              created_at: new Date(),
              updated_at: new Date(),
            };

            mockDb.query.mockResolvedValueOnce({
              rows: [createdRow],
              command: 'INSERT',
              rowCount: 1,
              oid: 0,
              fields: [],
            });

            // Act & Assert
            await expect(service.createMembershipType({
              organisationId,
              name: 'Test Membership',
              description: 'Test Description',
              membershipFormId: createdRow.membership_form_id,
              supportedPaymentMethods: ['card'],
              isRollingMembership: true,
              numberOfMonths: 12,
              discountIds: [], // Empty array should be accepted
            })).resolves.toBeDefined();
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Test: CreateMembershipType should work without discountIds parameter
     * 
     * Property: When creating a membership type without providing discountIds,
     * the API should accept it and default to an empty array.
     */
    it('should work without discountIds parameter in createMembershipType', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          fc.uuid(),
          async (organisationId, membershipTypeId) => {
            const createdRow = {
              id: membershipTypeId,
              organisation_id: organisationId,
              name: 'Test Membership',
              description: 'Test Description',
              membership_form_id: fc.sample(fc.uuid(), 1)[0],
              membership_status: 'open',
              is_rolling_membership: true,
              valid_until: null,
              number_of_months: 12,
              automatically_approve: false,
              member_labels: [],
              supported_payment_methods: ['card'],
              use_terms_and_conditions: false,
              terms_and_conditions: null,
              membership_type_category: 'single',
              max_people_in_application: null,
              min_people_in_application: null,
              person_titles: null,
              person_labels: null,
              field_configuration: null,
              discount_ids: JSON.stringify([]),
              created_at: new Date(),
              updated_at: new Date(),
            };

            mockDb.query.mockResolvedValueOnce({
              rows: [createdRow],
              command: 'INSERT',
              rowCount: 1,
              oid: 0,
              fields: [],
            });

            // Act & Assert: Should work without discountIds parameter
            await expect(service.createMembershipType({
              organisationId,
              name: 'Test Membership',
              description: 'Test Description',
              membershipFormId: createdRow.membership_form_id,
              supportedPaymentMethods: ['card'],
              isRollingMembership: true,
              numberOfMonths: 12,
              // discountIds not provided
            })).resolves.toBeDefined();
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 23: API Parameter Acceptance for Update
   * 
   * For any valid UpdateMembershipTypeDto with a discountIds array, the API should
   * accept the request without parameter-related errors.
   * 
   * **Validates: Requirements 3.4**
   */
  describe('Property 23: API Parameter Acceptance for Update', () => {
    /**
     * Test: UpdateMembershipType should accept discountIds parameter
     * 
     * Property: When updating a membership type with valid discountIds, the API
     * should accept the parameter and not throw parameter-related errors.
     */
    it('should accept discountIds parameter in updateMembershipType', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(fc.uuid(), { minLength: 0, maxLength: 10 }),
          fc.uuid(),
          fc.uuid(),
          async (discountIds, organisationId, membershipTypeId) => {
            // Arrange: Mock existing membership type
            const existingRow = {
              id: membershipTypeId,
              organisation_id: organisationId,
              name: 'Test Membership',
              description: 'Test Description',
              membership_form_id: fc.sample(fc.uuid(), 1)[0],
              membership_status: 'open',
              is_rolling_membership: true,
              valid_until: null,
              number_of_months: 12,
              automatically_approve: false,
              member_labels: [],
              supported_payment_methods: ['card'],
              use_terms_and_conditions: false,
              terms_and_conditions: null,
              membership_type_category: 'single',
              max_people_in_application: null,
              min_people_in_application: null,
              person_titles: null,
              person_labels: null,
              field_configuration: null,
              discount_ids: JSON.stringify([]),
              created_at: new Date(),
              updated_at: new Date(),
            };

            mockDb.query.mockResolvedValueOnce({
              rows: [existingRow],
              command: 'SELECT',
              rowCount: 1,
              oid: 0,
              fields: [],
            });

            // Mock discount validation
            if (discountIds.length > 0) {
              const validDiscounts = discountIds.map(id => ({
                id,
                organisation_id: organisationId,
                module_type: 'memberships',
                status: 'active',
              }));

              mockDb.query.mockResolvedValueOnce({
                rows: validDiscounts,
                command: 'SELECT',
                rowCount: validDiscounts.length,
                oid: 0,
                fields: [],
              });
            }

            const updatedRow = {
              ...existingRow,
              discount_ids: JSON.stringify(discountIds),
              updated_at: new Date(),
            };

            mockDb.query.mockResolvedValueOnce({
              rows: [updatedRow],
              command: 'UPDATE',
              rowCount: 1,
              oid: 0,
              fields: [],
            });

            // Act & Assert: Should not throw parameter-related errors
            await expect(service.updateMembershipType(membershipTypeId, {
              discountIds, // Parameter should be accepted
            })).resolves.toBeDefined();
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Test: UpdateMembershipType should accept empty discountIds array
     * 
     * Property: When updating a membership type with an empty discountIds array,
     * the API should accept it without errors.
     */
    it('should accept empty discountIds array in updateMembershipType', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          fc.uuid(),
          async (organisationId, membershipTypeId) => {
            const existingRow = {
              id: membershipTypeId,
              organisation_id: organisationId,
              name: 'Test Membership',
              description: 'Test Description',
              membership_form_id: fc.sample(fc.uuid(), 1)[0],
              membership_status: 'open',
              is_rolling_membership: true,
              valid_until: null,
              number_of_months: 12,
              automatically_approve: false,
              member_labels: [],
              supported_payment_methods: ['card'],
              use_terms_and_conditions: false,
              terms_and_conditions: null,
              membership_type_category: 'single',
              max_people_in_application: null,
              min_people_in_application: null,
              person_titles: null,
              person_labels: null,
              field_configuration: null,
              discount_ids: JSON.stringify([fc.sample(fc.uuid(), 1)[0]]),
              created_at: new Date(),
              updated_at: new Date(),
            };

            mockDb.query.mockResolvedValueOnce({
              rows: [existingRow],
              command: 'SELECT',
              rowCount: 1,
              oid: 0,
              fields: [],
            });

            const updatedRow = {
              ...existingRow,
              discount_ids: JSON.stringify([]),
              updated_at: new Date(),
            };

            mockDb.query.mockResolvedValueOnce({
              rows: [updatedRow],
              command: 'UPDATE',
              rowCount: 1,
              oid: 0,
              fields: [],
            });

            // Act & Assert
            await expect(service.updateMembershipType(membershipTypeId, {
              discountIds: [], // Empty array should be accepted
            })).resolves.toBeDefined();
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Test: UpdateMembershipType should work without discountIds parameter
     * 
     * Property: When updating a membership type without providing discountIds,
     * the API should accept it and leave existing discountIds unchanged.
     */
    it('should work without discountIds parameter in updateMembershipType', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          fc.uuid(),
          async (organisationId, membershipTypeId) => {
            const existingRow = {
              id: membershipTypeId,
              organisation_id: organisationId,
              name: 'Test Membership',
              description: 'Test Description',
              membership_form_id: fc.sample(fc.uuid(), 1)[0],
              membership_status: 'open',
              is_rolling_membership: true,
              valid_until: null,
              number_of_months: 12,
              automatically_approve: false,
              member_labels: [],
              supported_payment_methods: ['card'],
              use_terms_and_conditions: false,
              terms_and_conditions: null,
              membership_type_category: 'single',
              max_people_in_application: null,
              min_people_in_application: null,
              person_titles: null,
              person_labels: null,
              field_configuration: null,
              discount_ids: JSON.stringify([fc.sample(fc.uuid(), 1)[0]]),
              created_at: new Date(),
              updated_at: new Date(),
            };

            mockDb.query.mockResolvedValueOnce({
              rows: [existingRow],
              command: 'SELECT',
              rowCount: 1,
              oid: 0,
              fields: [],
            });

            const updatedRow = {
              ...existingRow,
              name: 'Updated Membership',
              updated_at: new Date(),
            };

            mockDb.query.mockResolvedValueOnce({
              rows: [updatedRow],
              command: 'UPDATE',
              rowCount: 1,
              oid: 0,
              fields: [],
            });

            // Act & Assert: Should work without discountIds parameter
            await expect(service.updateMembershipType(membershipTypeId, {
              name: 'Updated Membership',
              // discountIds not provided
            })).resolves.toBeDefined();
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 19: Default Empty Array for New Membership Types
   * 
   * For any newly created membership type that does not specify discountIds,
   * the discount_ids column should contain an empty JSON array.
   * 
   * **Validates: Requirements 7.3**
   */
  describe('Property 19: Default Empty Array for New Membership Types', () => {
    /**
     * Test: New membership types should default to empty discountIds array
     * 
     * Property: When creating a membership type without specifying discountIds,
     * the created membership type should have an empty discountIds array.
     */
    it('should default to empty discountIds array when not specified', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          fc.uuid(),
          async (organisationId, membershipTypeId) => {
            const createdRow = {
              id: membershipTypeId,
              organisation_id: organisationId,
              name: 'Test Membership',
              description: 'Test Description',
              membership_form_id: fc.sample(fc.uuid(), 1)[0],
              membership_status: 'open',
              is_rolling_membership: true,
              valid_until: null,
              number_of_months: 12,
              automatically_approve: false,
              member_labels: [],
              supported_payment_methods: ['card'],
              use_terms_and_conditions: false,
              terms_and_conditions: null,
              membership_type_category: 'single',
              max_people_in_application: null,
              min_people_in_application: null,
              person_titles: null,
              person_labels: null,
              field_configuration: null,
              discount_ids: JSON.stringify([]), // Database defaults to empty array
              created_at: new Date(),
              updated_at: new Date(),
            };

            mockDb.query.mockResolvedValueOnce({
              rows: [createdRow],
              command: 'INSERT',
              rowCount: 1,
              oid: 0,
              fields: [],
            });

            // Act
            const created = await service.createMembershipType({
              organisationId,
              name: 'Test Membership',
              description: 'Test Description',
              membershipFormId: createdRow.membership_form_id,
              supportedPaymentMethods: ['card'],
              isRollingMembership: true,
              numberOfMonths: 12,
              // discountIds not specified
            });

            // Assert: Property - Defaults to empty array
            expect(created.discountIds).toEqual([]);
            expect(Array.isArray(created.discountIds)).toBe(true);
            expect(created.discountIds.length).toBe(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Test: Explicitly setting discountIds to undefined should result in empty array
     * 
     * Property: When creating a membership type with discountIds explicitly set to
     * undefined, the created membership type should have an empty discountIds array.
     */
    it('should default to empty array when discountIds is undefined', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          fc.uuid(),
          async (organisationId, membershipTypeId) => {
            const createdRow = {
              id: membershipTypeId,
              organisation_id: organisationId,
              name: 'Test Membership',
              description: 'Test Description',
              membership_form_id: fc.sample(fc.uuid(), 1)[0],
              membership_status: 'open',
              is_rolling_membership: true,
              valid_until: null,
              number_of_months: 12,
              automatically_approve: false,
              member_labels: [],
              supported_payment_methods: ['card'],
              use_terms_and_conditions: false,
              terms_and_conditions: null,
              membership_type_category: 'single',
              max_people_in_application: null,
              min_people_in_application: null,
              person_titles: null,
              person_labels: null,
              field_configuration: null,
              discount_ids: JSON.stringify([]),
              created_at: new Date(),
              updated_at: new Date(),
            };

            mockDb.query.mockResolvedValueOnce({
              rows: [createdRow],
              command: 'INSERT',
              rowCount: 1,
              oid: 0,
              fields: [],
            });

            // Act
            const created = await service.createMembershipType({
              organisationId,
              name: 'Test Membership',
              description: 'Test Description',
              membershipFormId: createdRow.membership_form_id,
              supportedPaymentMethods: ['card'],
              isRollingMembership: true,
              numberOfMonths: 12,
              discountIds: undefined, // Explicitly undefined
            });

            // Assert: Property - Defaults to empty array
            expect(created.discountIds).toEqual([]);
            expect(Array.isArray(created.discountIds)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});

