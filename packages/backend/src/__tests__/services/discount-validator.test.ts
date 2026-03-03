/**
 * Unit Tests for Discount Validator Service
 * 
 * Feature: discount-management-system
 * 
 * These tests validate specific error messages and edge cases for discount validation.
 */

import { DiscountValidatorService } from '../../services/discount-validator.service';
import { Discount } from '../../types/discount.types';
import { db } from '../../database/pool';

// Mock the database
jest.mock('../../database/pool', () => ({
  db: {
    query: jest.fn(),
  },
}));

describe('Discount Validator - Unit Tests', () => {
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
      status?: 'active' | 'inactive' | 'expired';
      validFrom?: Date;
      validUntil?: Date;
      usageLimits?: any;
      eligibilityCriteria?: any;
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
      validFrom: options.validFrom,
      validUntil: options.validUntil,
      usageLimits: options.usageLimits || { currentUsageCount: 0 },
      eligibilityCriteria: options.eligibilityCriteria || { requiresCode: false },
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  };

  /**
   * Validation Error Messages Tests
   * 
   * Requirements: 18.2, 18.3, 18.4, 18.5
   */
  describe('Validation Error Messages', () => {
    /**
     * Test: Expired discount error message
     * 
     * Requirement 18.2: WHEN a discount has expired, THE Discount_System SHALL
     * return a 400 error with message "Discount has expired"
     */
    it('should return "Discount has expired" error when discount is past valid_until date', async () => {
      // Arrange: Create discount that expired yesterday
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      
      const discount = createDiscount({
        validUntil: yesterday,
      });

      // Act
      const result = await validator.validateValidity(discount);

      // Assert
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toEqual({
        code: 'DISCOUNT_EXPIRED',
        message: 'Discount has expired',
        field: 'validUntil',
      });
    });

    /**
     * Test: Usage limit reached error message
     * 
     * Requirement 18.3: WHEN usage limit is reached, THE Discount_System SHALL
     * return a 400 error with message "Discount usage limit reached"
     */
    it('should return "Discount usage limit reached" error when total usage limit is reached', async () => {
      // Arrange: Create discount with usage at limit
      const discount = createDiscount({
        usageLimits: {
          totalUsageLimit: 100,
          currentUsageCount: 100,
        },
      });

      // Act
      const result = await validator.validateUsageLimits(discount, 'user-id');

      // Assert
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toEqual({
        code: 'USAGE_LIMIT_REACHED',
        message: 'Discount usage limit has been reached',
      });
    });

    /**
     * Test: Per-user usage limit reached error message
     * 
     * Requirement 18.3: WHEN per-user usage limit is reached, THE Discount_System SHALL
     * return a 400 error with appropriate message
     */
    it('should return "You have reached the usage limit for this discount" error when per-user limit is reached', async () => {
      // Arrange: Create discount with per-user limit
      const discount = createDiscount({
        usageLimits: {
          perUserLimit: 5,
          currentUsageCount: 10,
        },
      });

      // Mock database to return user has reached limit
      mockDb.query.mockResolvedValueOnce({
        rows: [{ count: '5' }],
        command: 'SELECT',
        rowCount: 1,
        oid: 0,
        fields: [],
      });

      // Act
      const result = await validator.validateUsageLimits(discount, 'user-id');

      // Assert
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toEqual({
        code: 'USER_USAGE_LIMIT_REACHED',
        message: 'You have reached the usage limit for this discount',
      });
    });

    /**
     * Test: Eligibility not met error message
     * 
     * Requirement 18.4: WHEN eligibility criteria are not met, THE Discount_System SHALL
     * return a 400 error with specific criteria that failed
     */
    it('should return specific error for membership type not met', async () => {
      // Arrange: Create discount requiring membership
      const discount = createDiscount({
        eligibilityCriteria: {
          requiresCode: false,
          membershipTypes: ['membership-type-1', 'membership-type-2'],
        },
      });

      // Mock database to return user has no matching membership
      mockDb.query.mockResolvedValueOnce({
        rows: [],
        command: 'SELECT',
        rowCount: 0,
        oid: 0,
        fields: [],
      });

      // Act
      const result = await validator.validateEligibility(discount, 'user-id', 100);

      // Assert
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toEqual({
        code: 'MEMBERSHIP_TYPE_NOT_MET',
        message: 'User does not have required membership type',
        field: 'membershipType',
      });
    });

    it('should return specific error for user group not met', async () => {
      // Arrange: Create discount requiring user group
      const discount = createDiscount({
        eligibilityCriteria: {
          requiresCode: false,
          userGroups: ['group-1', 'group-2'],
        },
      });

      // Mock database to return user is not in group
      mockDb.query.mockResolvedValueOnce({
        rows: [],
        command: 'SELECT',
        rowCount: 0,
        oid: 0,
        fields: [],
      });

      // Act
      const result = await validator.validateEligibility(discount, 'user-id', 100);

      // Assert
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toEqual({
        code: 'USER_GROUP_NOT_MET',
        message: 'User is not in required user group',
        field: 'userGroup',
      });
    });

    /**
     * Test: Minimum purchase not met error message
     * 
     * Requirement 18.5: WHEN minimum purchase amount is not met, THE Discount_System SHALL
     * return a 400 error with message indicating the minimum
     */
    it('should return "Minimum purchase amount not met" error with specific amount', async () => {
      // Arrange: Create discount with minimum purchase requirement
      const minimumAmount = 50.00;
      const discount = createDiscount({
        eligibilityCriteria: {
          requiresCode: false,
          minimumPurchaseAmount: minimumAmount,
        },
      });

      // Act: Try to apply with amount below minimum
      const result = await validator.validateEligibility(discount, 'user-id', 30.00);

      // Assert
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toEqual({
        code: 'MINIMUM_PURCHASE_NOT_MET',
        message: `Minimum purchase amount of ${minimumAmount} not met`,
        field: 'amount',
      });
    });

    /**
     * Test: Multiple eligibility errors
     * 
     * Requirement 18.4: When multiple criteria fail, all should be reported
     */
    it('should return multiple errors when multiple eligibility criteria are not met', async () => {
      // Arrange: Create discount with multiple criteria
      const discount = createDiscount({
        eligibilityCriteria: {
          requiresCode: false,
          minimumPurchaseAmount: 100.00,
          membershipTypes: ['membership-type-1'],
          userGroups: ['group-1'],
        },
      });

      // Mock database responses - both fail
      mockDb.query.mockResolvedValueOnce({
        rows: [],
        command: 'SELECT',
        rowCount: 0,
        oid: 0,
        fields: [],
      });
      mockDb.query.mockResolvedValueOnce({
        rows: [],
        command: 'SELECT',
        rowCount: 0,
        oid: 0,
        fields: [],
      });

      // Act: Try with amount below minimum
      const result = await validator.validateEligibility(discount, 'user-id', 50.00);

      // Assert: All three criteria should fail
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(3);
      
      expect(result.errors).toContainEqual(
        expect.objectContaining({ code: 'MINIMUM_PURCHASE_NOT_MET' })
      );
      expect(result.errors).toContainEqual(
        expect.objectContaining({ code: 'MEMBERSHIP_TYPE_NOT_MET' })
      );
      expect(result.errors).toContainEqual(
        expect.objectContaining({ code: 'USER_GROUP_NOT_MET' })
      );
    });

    /**
     * Test: Inactive discount error message
     */
    it('should return "Discount is not active" error when discount status is inactive', async () => {
      // Arrange: Create inactive discount
      const discount = createDiscount({
        status: 'inactive',
      });

      // Act
      const result = await validator.validateValidity(discount);

      // Assert
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toEqual({
        code: 'DISCOUNT_INACTIVE',
        message: 'Discount is not active',
        field: 'status',
      });
    });

    /**
     * Test: Discount not yet valid error message
     */
    it('should return "Discount is not yet valid" error when before valid_from date', async () => {
      // Arrange: Create discount that starts tomorrow
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      const discount = createDiscount({
        validFrom: tomorrow,
      });

      // Act
      const result = await validator.validateValidity(discount);

      // Assert
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toEqual({
        code: 'DISCOUNT_NOT_YET_VALID',
        message: 'Discount is not yet valid',
        field: 'validFrom',
      });
    });

    /**
     * Test: Multiple validity errors
     */
    it('should return multiple errors when discount is both inactive and expired', async () => {
      // Arrange: Create discount that is inactive and expired
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      
      const discount = createDiscount({
        status: 'inactive',
        validUntil: yesterday,
      });

      // Act
      const result = await validator.validateValidity(discount);

      // Assert
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(2);
      
      expect(result.errors).toContainEqual(
        expect.objectContaining({ code: 'DISCOUNT_INACTIVE' })
      );
      expect(result.errors).toContainEqual(
        expect.objectContaining({ code: 'DISCOUNT_EXPIRED' })
      );
    });
  });

  /**
   * Edge Cases and Boundary Conditions
   */
  describe('Edge Cases', () => {
    it('should pass validation when discount is exactly at valid_from date', async () => {
      // Arrange: Create discount starting now
      const now = new Date();
      const discount = createDiscount({
        validFrom: now,
      });

      // Act
      const result = await validator.validateValidity(discount);

      // Assert: Should be valid (>= comparison)
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should pass validation when amount exactly equals minimum purchase amount', async () => {
      // Arrange: Create discount with minimum purchase
      const minimumAmount = 100.00;
      const discount = createDiscount({
        eligibilityCriteria: {
          requiresCode: false,
          minimumPurchaseAmount: minimumAmount,
        },
      });

      // Act: Use exact minimum amount
      const result = await validator.validateEligibility(discount, 'user-id', minimumAmount);

      // Assert: Should be valid (>= comparison)
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should pass validation when no eligibility criteria are specified', async () => {
      // Arrange: Create discount with no criteria
      const discount = createDiscount({
        eligibilityCriteria: { requiresCode: false },
      });

      // Act
      const result = await validator.validateEligibility(discount, 'user-id', 10.00);

      // Assert
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should pass validation when no usage limits are specified', async () => {
      // Arrange: Create discount with no limits
      const discount = createDiscount({
        usageLimits: { currentUsageCount: 0 },
      });

      // Act
      const result = await validator.validateUsageLimits(discount, 'user-id');

      // Assert
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  /**
   * Comprehensive Validation Tests
   */
  describe('Comprehensive Validation', () => {
    it('should validate all aspects and return all errors', async () => {
      // Arrange: Create discount with multiple issues
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      
      const discount = createDiscount({
        status: 'inactive',
        validUntil: yesterday,
        usageLimits: {
          totalUsageLimit: 10,
          currentUsageCount: 10,
        },
        eligibilityCriteria: {
          requiresCode: false,
          minimumPurchaseAmount: 100.00,
        },
      });

      // Act: Comprehensive validation with low amount
      const result = await validator.validateDiscount(discount, 'user-id', 50.00, 1);

      // Assert: Should have multiple errors
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      
      // Should include validity errors
      expect(result.errors).toContainEqual(
        expect.objectContaining({ code: 'DISCOUNT_INACTIVE' })
      );
      expect(result.errors).toContainEqual(
        expect.objectContaining({ code: 'DISCOUNT_EXPIRED' })
      );
    });

    it('should stop checking after validity fails (short-circuit)', async () => {
      // Arrange: Create expired discount
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      
      const discount = createDiscount({
        validUntil: yesterday,
        eligibilityCriteria: {
          requiresCode: false,
          minimumPurchaseAmount: 100.00,
        },
      });

      // Act
      const result = await validator.validateDiscount(discount, 'user-id', 50.00, 1);

      // Assert: Should have validity error, but still check other criteria
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({ code: 'DISCOUNT_EXPIRED' })
      );
    });

    it('should pass comprehensive validation when all criteria are met', async () => {
      // Arrange: Create valid discount
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      const discount = createDiscount({
        status: 'active',
        validUntil: tomorrow,
        usageLimits: {
          totalUsageLimit: 100,
          currentUsageCount: 50,
        },
        eligibilityCriteria: {
          requiresCode: false,
          minimumPurchaseAmount: 50.00,
        },
      });

      // Mock database for per-user usage check (if needed)
      mockDb.query.mockResolvedValueOnce({
        rows: [{ count: '0' }],
        command: 'SELECT',
        rowCount: 1,
        oid: 0,
        fields: [],
      });

      // Act
      const result = await validator.validateDiscount(discount, 'user-id', 100.00, 1);

      // Assert
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });
});
