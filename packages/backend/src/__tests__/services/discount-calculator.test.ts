/**
 * Unit Tests for Discount Calculator Service
 * 
 * Feature: discount-management-system
 * 
 * These tests validate specific scenarios and edge cases for discount calculations,
 * particularly focusing on quantity-based discounts.
 */

import { DiscountCalculatorService } from '../../services/discount-calculator.service';
import { Discount, DiscountType } from '../../types/discount.types';

describe('Discount Calculator - Unit Tests', () => {
  const calculator = new DiscountCalculatorService();

  /**
   * Helper function to create a discount object for testing
   */
  const createDiscount = (
    discountType: DiscountType,
    discountValue: number,
    options: {
      quantityRules?: {
        minimumQuantity: number;
        applyToQuantity?: number;
        applyEveryN?: number;
      };
      maximumDiscountAmount?: number;
      id?: string;
      name?: string;
    } = {}
  ): Discount => {
    return {
      id: options.id || 'test-discount-id',
      organisationId: 'test-org-id',
      moduleType: 'events',
      name: options.name || 'Test Discount',
      discountType,
      discountValue,
      applicationScope: options.quantityRules ? 'quantity-based' : 'item',
      quantityRules: options.quantityRules,
      combinable: true,
      priority: 0,
      status: 'active',
      eligibilityCriteria: options.maximumDiscountAmount !== undefined
        ? { requiresCode: false, maximumDiscountAmount: options.maximumDiscountAmount }
        : { requiresCode: false },
      createdAt: new Date(),
      updatedAt: new Date(),
      usageLimits: { currentUsageCount: 0 },
    };
  };

  /**
   * Quantity-Based Discount Tests
   * 
   * Requirements: 13.3 - WHEN calculating quantity-based discounts, 
   * THE Discount_Calculator SHALL apply the discount to the specified quantity of items
   */
  describe('Quantity-Based Discounts', () => {
    describe('Buy 2 Get 1 Free Scenario', () => {
      it('should apply 100% discount to 1 item when buying 3 items (buy 2 get 1 free)', () => {
        // Arrange: Buy 2 get 1 free = minimumQuantity: 3, applyToQuantity: 1, 100% discount
        const discount = createDiscount('percentage', 100, {
          quantityRules: {
            minimumQuantity: 3,
            applyToQuantity: 1,
          },
        });
        const itemPrice = 10.00;
        const quantity = 3;

        // Act
        const result = calculator.calculateQuantityDiscount(discount, itemPrice, quantity);

        // Assert
        expect(result.originalAmount).toBe(30.00); // 3 items × $10
        expect(result.discountAmount).toBe(10.00); // 1 item free
        expect(result.finalAmount).toBe(20.00); // Pay for 2 items
        expect(result.appliedDiscounts).toHaveLength(1);
        expect(result.appliedDiscounts[0].discountAmount).toBe(10.00);
      });

      it('should apply 100% discount to 1 item when buying 4 items (still only 1 free)', () => {
        // Arrange: Buy 2 get 1 free with 4 items purchased
        const discount = createDiscount('percentage', 100, {
          quantityRules: {
            minimumQuantity: 3,
            applyToQuantity: 1,
          },
        });
        const itemPrice = 15.50;
        const quantity = 4;

        // Act
        const result = calculator.calculateQuantityDiscount(discount, itemPrice, quantity);

        // Assert
        expect(result.originalAmount).toBe(62.00); // 4 items × $15.50
        expect(result.discountAmount).toBe(15.50); // Only 1 item free
        expect(result.finalAmount).toBe(46.50); // Pay for 3 items
      });

      it('should apply 50% discount to 1 item when buying 3 items (buy 2 get 1 half off)', () => {
        // Arrange: Buy 2 get 1 half off = minimumQuantity: 3, applyToQuantity: 1, 50% discount
        const discount = createDiscount('percentage', 50, {
          quantityRules: {
            minimumQuantity: 3,
            applyToQuantity: 1,
          },
        });
        const itemPrice = 20.00;
        const quantity = 3;

        // Act
        const result = calculator.calculateQuantityDiscount(discount, itemPrice, quantity);

        // Assert
        expect(result.originalAmount).toBe(60.00); // 3 items × $20
        expect(result.discountAmount).toBe(10.00); // 50% off 1 item
        expect(result.finalAmount).toBe(50.00); // Pay full for 2, half for 1
      });

      it('should apply fixed amount discount to specified quantity', () => {
        // Arrange: Buy 2 get $5 off the 3rd item
        const discount = createDiscount('fixed', 5.00, {
          quantityRules: {
            minimumQuantity: 3,
            applyToQuantity: 1,
          },
        });
        const itemPrice = 12.00;
        const quantity = 3;

        // Act
        const result = calculator.calculateQuantityDiscount(discount, itemPrice, quantity);

        // Assert
        expect(result.originalAmount).toBe(36.00); // 3 items × $12
        expect(result.discountAmount).toBe(5.00); // $5 off 1 item
        expect(result.finalAmount).toBe(31.00); // $36 - $5
      });
    });

    describe('Every Nth Item Free Scenario', () => {
      it('should apply 100% discount to every 3rd item when buying 3 items', () => {
        // Arrange: Every 3rd item free = minimumQuantity: 3, applyEveryN: 3, 100% discount
        const discount = createDiscount('percentage', 100, {
          quantityRules: {
            minimumQuantity: 3,
            applyEveryN: 3,
          },
        });
        const itemPrice = 10.00;
        const quantity = 3;

        // Act
        const result = calculator.calculateQuantityDiscount(discount, itemPrice, quantity);

        // Assert
        expect(result.originalAmount).toBe(30.00); // 3 items × $10
        expect(result.discountAmount).toBe(10.00); // 1 item free (every 3rd)
        expect(result.finalAmount).toBe(20.00); // Pay for 2 items
      });

      it('should apply 100% discount to every 3rd item when buying 6 items (2 free)', () => {
        // Arrange: Every 3rd item free with 6 items
        const discount = createDiscount('percentage', 100, {
          quantityRules: {
            minimumQuantity: 3,
            applyEveryN: 3,
          },
        });
        const itemPrice = 8.00;
        const quantity = 6;

        // Act
        const result = calculator.calculateQuantityDiscount(discount, itemPrice, quantity);

        // Assert
        expect(result.originalAmount).toBe(48.00); // 6 items × $8
        expect(result.discountAmount).toBe(16.00); // 2 items free (6 / 3 = 2)
        expect(result.finalAmount).toBe(32.00); // Pay for 4 items
      });

      it('should apply 100% discount to every 3rd item when buying 9 items (3 free)', () => {
        // Arrange: Every 3rd item free with 9 items
        const discount = createDiscount('percentage', 100, {
          quantityRules: {
            minimumQuantity: 3,
            applyEveryN: 3,
          },
        });
        const itemPrice = 12.50;
        const quantity = 9;

        // Act
        const result = calculator.calculateQuantityDiscount(discount, itemPrice, quantity);

        // Assert
        expect(result.originalAmount).toBe(112.50); // 9 items × $12.50
        expect(result.discountAmount).toBe(37.50); // 3 items free (9 / 3 = 3)
        expect(result.finalAmount).toBe(75.00); // Pay for 6 items
      });

      it('should apply 100% discount to every 3rd item when buying 5 items (only 1 free)', () => {
        // Arrange: Every 3rd item free with 5 items (not enough for 2nd free item)
        const discount = createDiscount('percentage', 100, {
          quantityRules: {
            minimumQuantity: 3,
            applyEveryN: 3,
          },
        });
        const itemPrice = 7.00;
        const quantity = 5;

        // Act
        const result = calculator.calculateQuantityDiscount(discount, itemPrice, quantity);

        // Assert
        expect(result.originalAmount).toBe(35.00); // 5 items × $7
        expect(result.discountAmount).toBe(7.00); // Only 1 item free (5 / 3 = 1)
        expect(result.finalAmount).toBe(28.00); // Pay for 4 items
      });

      it('should apply 50% discount to every 4th item when buying 8 items', () => {
        // Arrange: Every 4th item 50% off
        const discount = createDiscount('percentage', 50, {
          quantityRules: {
            minimumQuantity: 4,
            applyEveryN: 4,
          },
        });
        const itemPrice = 20.00;
        const quantity = 8;

        // Act
        const result = calculator.calculateQuantityDiscount(discount, itemPrice, quantity);

        // Assert
        expect(result.originalAmount).toBe(160.00); // 8 items × $20
        expect(result.discountAmount).toBe(20.00); // 2 items at 50% off (8 / 4 = 2)
        expect(result.finalAmount).toBe(140.00); // $160 - $20
      });

      it('should apply fixed amount discount to every Nth item', () => {
        // Arrange: Every 2nd item gets $3 off
        const discount = createDiscount('fixed', 3.00, {
          quantityRules: {
            minimumQuantity: 2,
            applyEveryN: 2,
          },
        });
        const itemPrice = 10.00;
        const quantity = 4;

        // Act
        const result = calculator.calculateQuantityDiscount(discount, itemPrice, quantity);

        // Assert
        expect(result.originalAmount).toBe(40.00); // 4 items × $10
        expect(result.discountAmount).toBe(6.00); // 2 items with $3 off each (4 / 2 = 2)
        expect(result.finalAmount).toBe(34.00); // $40 - $6
      });
    });

    describe('Minimum Quantity Not Met', () => {
      it('should not apply discount when quantity is less than minimum (buy 2 get 1 free)', () => {
        // Arrange: Buy 2 get 1 free, but only buying 2 items
        const discount = createDiscount('percentage', 100, {
          quantityRules: {
            minimumQuantity: 3,
            applyToQuantity: 1,
          },
        });
        const itemPrice = 10.00;
        const quantity = 2;

        // Act
        const result = calculator.calculateQuantityDiscount(discount, itemPrice, quantity);

        // Assert
        expect(result.originalAmount).toBe(20.00); // 2 items × $10
        expect(result.discountAmount).toBe(0); // No discount applied
        expect(result.finalAmount).toBe(20.00); // Pay full price
        expect(result.appliedDiscounts).toHaveLength(0);
      });

      it('should not apply discount when quantity is less than minimum (every 3rd free)', () => {
        // Arrange: Every 3rd item free, but only buying 2 items
        const discount = createDiscount('percentage', 100, {
          quantityRules: {
            minimumQuantity: 3,
            applyEveryN: 3,
          },
        });
        const itemPrice = 15.00;
        const quantity = 2;

        // Act
        const result = calculator.calculateQuantityDiscount(discount, itemPrice, quantity);

        // Assert
        expect(result.originalAmount).toBe(30.00); // 2 items × $15
        expect(result.discountAmount).toBe(0); // No discount applied
        expect(result.finalAmount).toBe(30.00); // Pay full price
        expect(result.appliedDiscounts).toHaveLength(0);
      });

      it('should not apply discount when quantity is exactly 1 less than minimum', () => {
        // Arrange: Minimum 5 items required, buying 4
        const discount = createDiscount('percentage', 100, {
          quantityRules: {
            minimumQuantity: 5,
            applyToQuantity: 1,
          },
        });
        const itemPrice = 8.50;
        const quantity = 4;

        // Act
        const result = calculator.calculateQuantityDiscount(discount, itemPrice, quantity);

        // Assert
        expect(result.originalAmount).toBe(34.00); // 4 items × $8.50
        expect(result.discountAmount).toBe(0); // No discount applied
        expect(result.finalAmount).toBe(34.00); // Pay full price
        expect(result.appliedDiscounts).toHaveLength(0);
      });

      it('should not apply discount when buying only 1 item', () => {
        // Arrange: Buy 2 get 1 free, but only buying 1 item
        const discount = createDiscount('percentage', 100, {
          quantityRules: {
            minimumQuantity: 3,
            applyToQuantity: 1,
          },
        });
        const itemPrice = 25.00;
        const quantity = 1;

        // Act
        const result = calculator.calculateQuantityDiscount(discount, itemPrice, quantity);

        // Assert
        expect(result.originalAmount).toBe(25.00); // 1 item × $25
        expect(result.discountAmount).toBe(0); // No discount applied
        expect(result.finalAmount).toBe(25.00); // Pay full price
        expect(result.appliedDiscounts).toHaveLength(0);
      });

      it('should apply discount when quantity exactly meets minimum', () => {
        // Arrange: Minimum 5 items required, buying exactly 5
        const discount = createDiscount('percentage', 100, {
          quantityRules: {
            minimumQuantity: 5,
            applyToQuantity: 1,
          },
        });
        const itemPrice = 6.00;
        const quantity = 5;

        // Act
        const result = calculator.calculateQuantityDiscount(discount, itemPrice, quantity);

        // Assert
        expect(result.originalAmount).toBe(30.00); // 5 items × $6
        expect(result.discountAmount).toBe(6.00); // 1 item free
        expect(result.finalAmount).toBe(24.00); // Pay for 4 items
        expect(result.appliedDiscounts).toHaveLength(1);
      });
    });

    describe('Edge Cases and Validation', () => {
      it('should return zero discount when quantity rules are missing', () => {
        // Arrange: Discount marked as quantity-based but no rules provided
        const discount = createDiscount('percentage', 100);
        discount.applicationScope = 'quantity-based';
        discount.quantityRules = undefined;

        const itemPrice = 10.00;
        const quantity = 5;

        // Act
        const result = calculator.calculateQuantityDiscount(discount, itemPrice, quantity);

        // Assert
        expect(result.originalAmount).toBe(50.00);
        expect(result.discountAmount).toBe(0);
        expect(result.finalAmount).toBe(50.00);
        expect(result.appliedDiscounts).toHaveLength(0);
      });

      it('should handle decimal item prices correctly', () => {
        // Arrange: Buy 2 get 1 free with decimal price
        const discount = createDiscount('percentage', 100, {
          quantityRules: {
            minimumQuantity: 3,
            applyToQuantity: 1,
          },
        });
        const itemPrice = 9.99;
        const quantity = 3;

        // Act
        const result = calculator.calculateQuantityDiscount(discount, itemPrice, quantity);

        // Assert
        expect(result.originalAmount).toBe(29.97); // 3 items × $9.99
        expect(result.discountAmount).toBe(9.99); // 1 item free
        expect(result.finalAmount).toBe(19.98); // Pay for 2 items
      });

      it('should round monetary values to 2 decimal places', () => {
        // Arrange: Discount that results in fractional cents
        const discount = createDiscount('percentage', 33.33, {
          quantityRules: {
            minimumQuantity: 3,
            applyToQuantity: 1,
          },
        });
        const itemPrice = 10.00;
        const quantity = 3;

        // Act
        const result = calculator.calculateQuantityDiscount(discount, itemPrice, quantity);

        // Assert: All values should be rounded to 2 decimal places
        expect(result.originalAmount).toBe(30.00);
        expect(result.discountAmount).toBe(3.33); // 33.33% of $10 = $3.33
        expect(result.finalAmount).toBe(26.67); // $30 - $3.33
        
        // Verify arithmetic consistency
        expect(result.discountAmount + result.finalAmount).toBeCloseTo(result.originalAmount, 2);
      });

      it('should not exceed original amount even with large fixed discount', () => {
        // Arrange: Fixed discount larger than item price
        const discount = createDiscount('fixed', 50.00, {
          quantityRules: {
            minimumQuantity: 2,
            applyToQuantity: 1,
          },
        });
        const itemPrice = 10.00;
        const quantity = 3;

        // Act
        const result = calculator.calculateQuantityDiscount(discount, itemPrice, quantity);

        // Assert: Discount should be capped at original amount
        expect(result.originalAmount).toBe(30.00);
        expect(result.discountAmount).toBe(30.00); // Capped at original amount
        expect(result.finalAmount).toBe(0); // Cannot go negative
      });

      it('should respect maximum discount cap with quantity-based discount', () => {
        // Arrange: Buy 3 get 1 free, but with $5 maximum discount cap
        const discount = createDiscount('percentage', 100, {
          quantityRules: {
            minimumQuantity: 3,
            applyToQuantity: 1,
          },
          maximumDiscountAmount: 5.00,
        });
        const itemPrice = 20.00;
        const quantity = 3;

        // Act
        const result = calculator.calculateQuantityDiscount(discount, itemPrice, quantity);

        // Assert: Discount should be capped at $5 instead of $20
        expect(result.originalAmount).toBe(60.00);
        expect(result.discountAmount).toBe(5.00); // Capped at $5
        expect(result.finalAmount).toBe(55.00); // $60 - $5
      });
    });
  });
});
