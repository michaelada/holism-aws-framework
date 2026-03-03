/**
 * Property-Based Tests for Discount Validator Service
 * 
 * Feature: discount-management-system
 * 
 * These tests validate universal properties that should hold true across
 * all valid inputs for discount eligibility validation.
 */

import * as fc from 'fast-check';
import { DiscountValidatorService } from '../../services/discount-validator.service';
import { Discount, EligibilityCriteria } from '../../types/discount.types';
import { db } from '../../database/pool';

// Mock the database
jest.mock('../../database/pool', () => ({
  db: {
    query: jest.fn(),
  },
}));

describe('Discount Validator - Property-Based Tests', () => {
  const validator = new DiscountValidatorService();
  const mockDb = db as jest.Mocked<typeof db>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  /**
   * Helper function to create a discount object for testing
   */
  const createDiscount = (
    options: {
      eligibilityCriteria?: EligibilityCriteria;
      status?: 'active' | 'inactive' | 'expired';
      validFrom?: Date;
      validUntil?: Date;
    } = {}
  ): Discount => {
    return {
      id: 'test-discount-id',
      organisationId: 'test-org-id',
      moduleType: 'events',
      name: 'Test Discount',
      discountType: 'percentage',
      discountValue: 10,
      applicationScope: 'item',
      combinable: true,
      priority: 0,
      status: options.status || 'active',
      eligibilityCriteria: options.eligibilityCriteria || { requiresCode: false },
      validFrom: options.validFrom,
      validUntil: options.validUntil,
      createdAt: new Date(),
      updatedAt: new Date(),
      usageLimits: { currentUsageCount: 0 },
    };
  };

  /**
   * Property 13: Eligibility Validation
   * 
   * For any discount with eligibility criteria and any user, the discount should only
   * be applicable if the user meets ALL specified criteria (membership types, user groups,
   * minimum purchase amount). This property validates the AND logic of eligibility criteria.
   * 
   * **Validates: Requirements 7.2, 7.3, 7.4, 7.5**
   */
  describe('Property 13: Eligibility Validation', () => {
    /**
     * Test: Minimum purchase amount validation
     * 
     * Property: When minimum purchase amount is specified, validation should pass
     * if and only if the cart total meets or exceeds the minimum.
     * 
     * Validates: Requirement 7.4
     */
    it('should validate minimum purchase amount correctly for any valid inputs', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.float({ min: Math.fround(0.01), max: Math.fround(10000), noNaN: true }),
          fc.float({ min: Math.fround(0.01), max: Math.fround(10000), noNaN: true }),
          fc.uuid(),
          async (minimumPurchaseAmount, actualAmount, userId) => {
            // Arrange: Create discount with minimum purchase requirement
            const discount = createDiscount({
              eligibilityCriteria: {
                requiresCode: false,
                minimumPurchaseAmount: Math.round(minimumPurchaseAmount * 100) / 100,
              },
            });

            // Act
            const result = await validator.validateEligibility(
              discount,
              userId,
              Math.round(actualAmount * 100) / 100
            );

            // Assert: Property - Validation passes if and only if amount >= minimum
            const roundedMin = Math.round(minimumPurchaseAmount * 100) / 100;
            const roundedActual = Math.round(actualAmount * 100) / 100;
            
            if (roundedActual >= roundedMin) {
              expect(result.valid).toBe(true);
              expect(result.errors).toHaveLength(0);
            } else {
              expect(result.valid).toBe(false);
              expect(result.errors).toContainEqual(
                expect.objectContaining({
                  code: 'MINIMUM_PURCHASE_NOT_MET',
                  field: 'amount',
                })
              );
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Test: Maximum discount amount cap
     * 
     * Property: When maximum discount amount is specified in eligibility criteria,
     * it should be available for the calculator to enforce the cap.
     * 
     * Validates: Requirement 7.5
     */
    it('should preserve maximum discount amount in eligibility criteria', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.float({ min: Math.fround(1), max: Math.fround(1000), noNaN: true }),
          fc.float({ min: Math.fround(100), max: Math.fround(10000), noNaN: true }),
          fc.uuid(),
          async (maximumDiscountAmount, actualAmount, userId) => {
            // Arrange: Create discount with maximum discount cap
            const roundedMax = Math.round(maximumDiscountAmount * 100) / 100;
            const discount = createDiscount({
              eligibilityCriteria: {
                requiresCode: false,
                maximumDiscountAmount: roundedMax,
              },
            });

            // Act
            const result = await validator.validateEligibility(
              discount,
              userId,
              actualAmount
            );

            // Assert: Property - Maximum discount amount is preserved in criteria
            expect(discount.eligibilityCriteria?.maximumDiscountAmount).toBe(roundedMax);
            
            // Property: Eligibility validation passes (max discount is enforced by calculator)
            expect(result.valid).toBe(true);
            expect(result.errors).toHaveLength(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Test: Membership type validation
     * 
     * Property: When membership types are specified, validation should pass if and only if
     * the user has one of the specified membership types.
     * 
     * Validates: Requirement 7.2
     */
    it('should validate membership types correctly', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(fc.uuid(), { minLength: 1, maxLength: 5 }),
          fc.uuid(),
          fc.boolean(),
          async (requiredMembershipTypes, userId, userHasMembership) => {
            // Arrange: Create discount with membership type requirement
            const discount = createDiscount({
              eligibilityCriteria: {
                requiresCode: false,
                membershipTypes: requiredMembershipTypes,
              },
            });

            // Mock database response based on whether user has membership
            if (userHasMembership) {
              mockDb.query.mockResolvedValueOnce({
                rows: [{ membership_type_id: requiredMembershipTypes[0] }],
                command: 'SELECT',
                rowCount: 1,
                oid: 0,
                fields: [],
              });
            } else {
              mockDb.query.mockResolvedValueOnce({
                rows: [],
                command: 'SELECT',
                rowCount: 0,
                oid: 0,
                fields: [],
              });
            }

            // Act
            const result = await validator.validateEligibility(discount, userId, 100);

            // Assert: Property - Validation passes if and only if user has required membership
            if (userHasMembership) {
              expect(result.valid).toBe(true);
              expect(result.errors).toHaveLength(0);
            } else {
              expect(result.valid).toBe(false);
              expect(result.errors).toContainEqual(
                expect.objectContaining({
                  code: 'MEMBERSHIP_TYPE_NOT_MET',
                  field: 'membershipType',
                })
              );
            }

            // Property: Database was queried with correct parameters
            expect(mockDb.query).toHaveBeenCalledWith(
              expect.stringContaining('FROM memberships'),
              [userId, requiredMembershipTypes]
            );
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Test: User group validation
     * 
     * Property: When user groups are specified, validation should pass if and only if
     * the user belongs to one of the specified groups.
     * 
     * Validates: Requirement 7.3
     */
    it('should validate user groups correctly', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(fc.uuid(), { minLength: 1, maxLength: 5 }),
          fc.uuid(),
          fc.boolean(),
          async (requiredUserGroups, userId, userInGroup) => {
            // Arrange: Create discount with user group requirement
            const discount = createDiscount({
              eligibilityCriteria: {
                requiresCode: false,
                userGroups: requiredUserGroups,
              },
            });

            // Mock database response based on whether user is in group
            if (userInGroup) {
              mockDb.query.mockResolvedValueOnce({
                rows: [{ user_group_id: requiredUserGroups[0] }],
                command: 'SELECT',
                rowCount: 1,
                oid: 0,
                fields: [],
              });
            } else {
              mockDb.query.mockResolvedValueOnce({
                rows: [],
                command: 'SELECT',
                rowCount: 0,
                oid: 0,
                fields: [],
              });
            }

            // Act
            const result = await validator.validateEligibility(discount, userId, 100);

            // Assert: Property - Validation passes if and only if user is in required group
            if (userInGroup) {
              expect(result.valid).toBe(true);
              expect(result.errors).toHaveLength(0);
            } else {
              expect(result.valid).toBe(false);
              expect(result.errors).toContainEqual(
                expect.objectContaining({
                  code: 'USER_GROUP_NOT_MET',
                  field: 'userGroup',
                })
              );
            }

            // Property: Database was queried with correct parameters
            expect(mockDb.query).toHaveBeenCalledWith(
              expect.stringContaining('FROM user_group_members'),
              [userId, requiredUserGroups]
            );
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Test: Multiple criteria validation (AND logic)
     * 
     * Property: When multiple eligibility criteria are specified, ALL criteria must be met
     * for validation to pass. This tests the AND logic of eligibility validation.
     * 
     * Validates: Requirements 7.2, 7.3, 7.4 (combined)
     */
    it('should require ALL eligibility criteria to be met (AND logic)', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            minimumPurchaseAmount: fc.float({ min: Math.fround(50), max: Math.fround(500), noNaN: true }),
            membershipTypes: fc.array(fc.uuid(), { minLength: 1, maxLength: 3 }),
            userGroups: fc.array(fc.uuid(), { minLength: 1, maxLength: 3 }),
          }),
          fc.uuid(),
          fc.float({ min: Math.fround(0.01), max: Math.fround(1000), noNaN: true }),
          fc.boolean(),
          fc.boolean(),
          async (criteria, userId, actualAmount, hasMembership, inGroup) => {
            // Arrange: Create discount with multiple eligibility criteria
            const roundedMin = Math.round(criteria.minimumPurchaseAmount * 100) / 100;
            const roundedAmount = Math.round(actualAmount * 100) / 100;
            
            const discount = createDiscount({
              eligibilityCriteria: {
                requiresCode: false,
                minimumPurchaseAmount: roundedMin,
                membershipTypes: criteria.membershipTypes,
                userGroups: criteria.userGroups,
              },
            });

            // Mock database responses
            if (hasMembership) {
              mockDb.query.mockResolvedValueOnce({
                rows: [{ membership_type_id: criteria.membershipTypes[0] }],
                command: 'SELECT',
                rowCount: 1,
                oid: 0,
                fields: [],
              });
            } else {
              mockDb.query.mockResolvedValueOnce({
                rows: [],
                command: 'SELECT',
                rowCount: 0,
                oid: 0,
                fields: [],
              });
            }

            if (inGroup) {
              mockDb.query.mockResolvedValueOnce({
                rows: [{ user_group_id: criteria.userGroups[0] }],
                command: 'SELECT',
                rowCount: 1,
                oid: 0,
                fields: [],
              });
            } else {
              mockDb.query.mockResolvedValueOnce({
                rows: [],
                command: 'SELECT',
                rowCount: 0,
                oid: 0,
                fields: [],
              });
            }

            // Act
            const result = await validator.validateEligibility(discount, userId, roundedAmount);

            // Assert: Property - ALL criteria must be met for validation to pass
            const meetsMinimum = roundedAmount >= roundedMin;
            const allCriteriaMet = meetsMinimum && hasMembership && inGroup;

            if (allCriteriaMet) {
              expect(result.valid).toBe(true);
              expect(result.errors).toHaveLength(0);
            } else {
              expect(result.valid).toBe(false);
              expect(result.errors.length).toBeGreaterThan(0);
              
              // Property: Each failed criterion produces an error
              if (!meetsMinimum) {
                expect(result.errors).toContainEqual(
                  expect.objectContaining({ code: 'MINIMUM_PURCHASE_NOT_MET' })
                );
              }
              if (!hasMembership) {
                expect(result.errors).toContainEqual(
                  expect.objectContaining({ code: 'MEMBERSHIP_TYPE_NOT_MET' })
                );
              }
              if (!inGroup) {
                expect(result.errors).toContainEqual(
                  expect.objectContaining({ code: 'USER_GROUP_NOT_MET' })
                );
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Test: No eligibility criteria means all users qualify
     * 
     * Property: When no eligibility criteria are specified, validation should always pass
     * for any user and any amount.
     * 
     * Validates: Requirement 7.7 (implicit - no criteria means all users qualify)
     */
    it('should pass validation when no eligibility criteria are specified', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          fc.float({ min: Math.fround(0.01), max: Math.fround(10000), noNaN: true }),
          async (userId, amount) => {
            // Arrange: Create discount with no eligibility criteria
            const discount = createDiscount({
              eligibilityCriteria: { requiresCode: false },
            });

            // Act
            const result = await validator.validateEligibility(discount, userId, amount);

            // Assert: Property - Validation always passes with no criteria
            expect(result.valid).toBe(true);
            expect(result.errors).toHaveLength(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Test: Empty criteria arrays should be treated as no restriction
     * 
     * Property: When membership types or user groups are specified as empty arrays,
     * they should not restrict eligibility.
     */
    it('should treat empty membership types and user groups arrays as no restriction', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          fc.float({ min: Math.fround(0.01), max: Math.fround(10000), noNaN: true }),
          async (userId, amount) => {
            // Arrange: Create discount with empty arrays
            const discount = createDiscount({
              eligibilityCriteria: {
                requiresCode: false,
                membershipTypes: [],
                userGroups: [],
              },
            });

            // Act
            const result = await validator.validateEligibility(discount, userId, amount);

            // Assert: Property - Empty arrays don't restrict eligibility
            expect(result.valid).toBe(true);
            expect(result.errors).toHaveLength(0);
            
            // Property: Database should not be queried for empty arrays
            expect(mockDb.query).not.toHaveBeenCalled();
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Test: Edge case - minimum purchase amount of zero
     * 
     * Property: When minimum purchase amount is zero, any positive amount should pass.
     */
    it('should handle edge case of zero minimum purchase amount', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          fc.float({ min: Math.fround(0.01), max: Math.fround(10000), noNaN: true }),
          async (userId, amount) => {
            // Arrange: Create discount with zero minimum
            const discount = createDiscount({
              eligibilityCriteria: {
                requiresCode: false,
                minimumPurchaseAmount: 0,
              },
            });

            // Act
            const result = await validator.validateEligibility(discount, userId, amount);

            // Assert: Property - Any positive amount passes with zero minimum
            expect(result.valid).toBe(true);
            expect(result.errors).toHaveLength(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Test: Edge case - exact minimum purchase amount
     * 
     * Property: When amount exactly equals minimum purchase amount, validation should pass.
     */
    it('should pass validation when amount exactly equals minimum purchase amount', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          fc.float({ min: Math.fround(0.01), max: Math.fround(10000), noNaN: true }),
          async (userId, minimumAmount) => {
            // Arrange: Create discount with specific minimum
            const roundedMin = Math.round(minimumAmount * 100) / 100;
            const discount = createDiscount({
              eligibilityCriteria: {
                requiresCode: false,
                minimumPurchaseAmount: roundedMin,
              },
            });

            // Act: Use exact minimum amount
            const result = await validator.validateEligibility(discount, userId, roundedMin);

            // Assert: Property - Exact minimum amount passes validation
            expect(result.valid).toBe(true);
            expect(result.errors).toHaveLength(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Test: Validation result structure consistency
     * 
     * Property: Validation results should always have consistent structure with
     * valid boolean and errors array.
     */
    it('should always return consistent validation result structure', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            minimumPurchaseAmount: fc.option(fc.float({ min: Math.fround(0), max: Math.fround(10000), noNaN: true })),
            membershipTypes: fc.option(fc.array(fc.uuid(), { minLength: 0, maxLength: 5 })),
            userGroups: fc.option(fc.array(fc.uuid(), { minLength: 0, maxLength: 5 })),
          }),
          fc.uuid(),
          fc.float({ min: Math.fround(0.01), max: Math.fround(10000), noNaN: true }),
          async (criteria, userId, amount) => {
            // Arrange: Create discount with various criteria combinations
            const discount = createDiscount({
              eligibilityCriteria: {
                requiresCode: false,
                minimumPurchaseAmount: criteria.minimumPurchaseAmount || undefined,
                membershipTypes: criteria.membershipTypes || undefined,
                userGroups: criteria.userGroups || undefined,
              },
            });

            // Mock database responses if needed
            if (criteria.membershipTypes && criteria.membershipTypes.length > 0) {
              mockDb.query.mockResolvedValueOnce({
                rows: [],
                command: 'SELECT',
                rowCount: 0,
                oid: 0,
                fields: [],
              });
            }
            if (criteria.userGroups && criteria.userGroups.length > 0) {
              mockDb.query.mockResolvedValueOnce({
                rows: [],
                command: 'SELECT',
                rowCount: 0,
                oid: 0,
                fields: [],
              });
            }

            // Act
            const result = await validator.validateEligibility(discount, userId, amount);

            // Assert: Property - Result always has valid boolean and errors array
            expect(result).toHaveProperty('valid');
            expect(typeof result.valid).toBe('boolean');
            expect(result).toHaveProperty('errors');
            expect(Array.isArray(result.errors)).toBe(true);
            
            // Property: valid is true if and only if errors array is empty
            expect(result.valid).toBe(result.errors.length === 0);
            
            // Property: Each error has required fields
            result.errors.forEach((error) => {
              expect(error).toHaveProperty('code');
              expect(error).toHaveProperty('message');
              expect(typeof error.code).toBe('string');
              expect(typeof error.message).toBe('string');
            });
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 11: Usage Limit Enforcement
   * 
   * For any discount with a total usage limit, when the current usage count reaches
   * the limit, any further application attempts should be rejected; similarly, for any
   * user and discount with a per-user limit, when that user's usage count reaches the
   * limit, further attempts by that user should be rejected.
   * 
   * **Validates: Requirements 6.3, 6.5**
   */
  describe('Property 11: Usage Limit Enforcement', () => {
    /**
     * Test: Total usage limit enforcement
     * 
     * Property: When total usage limit is set and reached, validation should fail.
     */
    it('should reject discount when total usage limit is reached', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 100 }),
          fc.integer({ min: 0, max: 100 }),
          fc.uuid(),
          async (totalLimit, currentCount, userId) => {
            // Arrange: Create discount with usage limit
            const discount = createDiscount({
              eligibilityCriteria: { requiresCode: false },
            });
            discount.usageLimits = {
              totalUsageLimit: totalLimit,
              currentUsageCount: currentCount,
            };

            // Act
            const result = await validator.validateUsageLimits(discount, userId);

            // Assert: Property - Validation fails if and only if limit is reached
            if (currentCount >= totalLimit) {
              expect(result.valid).toBe(false);
              expect(result.errors).toContainEqual(
                expect.objectContaining({
                  code: 'USAGE_LIMIT_REACHED',
                })
              );
            } else {
              expect(result.valid).toBe(true);
              expect(result.errors).toHaveLength(0);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Test: Per-user usage limit enforcement
     * 
     * Property: When per-user limit is set and reached for a specific user,
     * validation should fail for that user.
     */
    it('should reject discount when per-user usage limit is reached', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 20 }),
          fc.integer({ min: 0, max: 20 }),
          fc.uuid(),
          async (perUserLimit, userUsageCount, userId) => {
            // Arrange: Create discount with per-user limit
            const discount = createDiscount({
              eligibilityCriteria: { requiresCode: false },
            });
            discount.usageLimits = {
              perUserLimit,
              currentUsageCount: 0,
            };

            // Mock database response for user usage count
            mockDb.query.mockResolvedValueOnce({
              rows: [{ count: userUsageCount.toString() }],
              command: 'SELECT',
              rowCount: 1,
              oid: 0,
              fields: [],
            });

            // Act
            const result = await validator.validateUsageLimits(discount, userId);

            // Assert: Property - Validation fails if and only if user limit is reached
            if (userUsageCount >= perUserLimit) {
              expect(result.valid).toBe(false);
              expect(result.errors).toContainEqual(
                expect.objectContaining({
                  code: 'USER_USAGE_LIMIT_REACHED',
                })
              );
            } else {
              expect(result.valid).toBe(true);
              expect(result.errors).toHaveLength(0);
            }

            // Property: Database was queried with correct parameters
            expect(mockDb.query).toHaveBeenCalledWith(
              expect.stringContaining('FROM discount_usage'),
              [discount.id, userId]
            );
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Test: Both limits enforced independently
     * 
     * Property: When both total and per-user limits are set, both must be checked
     * and either can cause validation to fail.
     */
    it('should enforce both total and per-user limits independently', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            totalLimit: fc.integer({ min: 10, max: 100 }),
            totalCount: fc.integer({ min: 0, max: 100 }),
            perUserLimit: fc.integer({ min: 1, max: 10 }),
            userCount: fc.integer({ min: 0, max: 10 }),
          }),
          fc.uuid(),
          async (limits, userId) => {
            // Arrange: Create discount with both limits
            const discount = createDiscount({
              eligibilityCriteria: { requiresCode: false },
            });
            discount.usageLimits = {
              totalUsageLimit: limits.totalLimit,
              currentUsageCount: limits.totalCount,
              perUserLimit: limits.perUserLimit,
            };

            // Mock database response for user usage count
            mockDb.query.mockResolvedValueOnce({
              rows: [{ count: limits.userCount.toString() }],
              command: 'SELECT',
              rowCount: 1,
              oid: 0,
              fields: [],
            });

            // Act
            const result = await validator.validateUsageLimits(discount, userId);

            // Assert: Property - Validation fails if either limit is reached
            const totalLimitReached = limits.totalCount >= limits.totalLimit;
            const userLimitReached = limits.userCount >= limits.perUserLimit;

            if (totalLimitReached || userLimitReached) {
              expect(result.valid).toBe(false);
              expect(result.errors.length).toBeGreaterThan(0);

              if (totalLimitReached) {
                expect(result.errors).toContainEqual(
                  expect.objectContaining({ code: 'USAGE_LIMIT_REACHED' })
                );
              }
              if (userLimitReached) {
                expect(result.errors).toContainEqual(
                  expect.objectContaining({ code: 'USER_USAGE_LIMIT_REACHED' })
                );
              }
            } else {
              expect(result.valid).toBe(true);
              expect(result.errors).toHaveLength(0);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Test: No limits means unlimited usage
     * 
     * Property: When no usage limits are specified, validation should always pass.
     */
    it('should allow unlimited usage when no limits are specified', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          async (userId) => {
            // Arrange: Create discount with no usage limits
            const discount = createDiscount({
              eligibilityCriteria: { requiresCode: false },
            });
            discount.usageLimits = { currentUsageCount: 0 };

            // Act
            const result = await validator.validateUsageLimits(discount, userId);

            // Assert: Property - Validation always passes with no limits
            expect(result.valid).toBe(true);
            expect(result.errors).toHaveLength(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Test: Edge case - exactly at limit
     * 
     * Property: When usage count exactly equals the limit, validation should fail.
     */
    it('should reject when usage count exactly equals limit', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 100 }),
          fc.uuid(),
          async (limit, userId) => {
            // Arrange: Create discount with usage exactly at limit
            const discount = createDiscount({
              eligibilityCriteria: { requiresCode: false },
            });
            discount.usageLimits = {
              totalUsageLimit: limit,
              currentUsageCount: limit, // Exactly at limit
            };

            // Act
            const result = await validator.validateUsageLimits(discount, userId);

            // Assert: Property - Validation fails when exactly at limit
            expect(result.valid).toBe(false);
            expect(result.errors).toContainEqual(
              expect.objectContaining({ code: 'USAGE_LIMIT_REACHED' })
            );
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Test: Edge case - one below limit
     * 
     * Property: When usage count is one below the limit, validation should pass.
     */
    it('should allow usage when count is one below limit', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 2, max: 100 }),
          fc.uuid(),
          async (limit, userId) => {
            // Arrange: Create discount with usage one below limit
            const discount = createDiscount({
              eligibilityCriteria: { requiresCode: false },
            });
            discount.usageLimits = {
              totalUsageLimit: limit,
              currentUsageCount: limit - 1, // One below limit
            };

            // Act
            const result = await validator.validateUsageLimits(discount, userId);

            // Assert: Property - Validation passes when one below limit
            expect(result.valid).toBe(true);
            expect(result.errors).toHaveLength(0);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
