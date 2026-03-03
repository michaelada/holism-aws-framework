/**
 * Property-Based Tests for Discount Calculator Service
 * 
 * Feature: discount-management-system
 * 
 * These tests validate universal properties that should hold true across
 * all valid inputs for discount calculations.
 */

import * as fc from 'fast-check';
import { DiscountCalculatorService } from '../../services/discount-calculator.service';
import { Discount, DiscountType, ApplicationScope } from '../../types/discount.types';

describe('Discount Calculator - Property-Based Tests', () => {
  const calculator = new DiscountCalculatorService();

  /**
   * Helper function to create a discount object for testing
   */
  const createDiscount = (
    discountType: DiscountType,
    discountValue: number,
    options: {
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
      applicationScope: 'item',
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
   * Property 18: Percentage Discount Calculation
   * 
   * For any percentage discount, the discount amount should equal
   * (item price × quantity × discount value / 100), subject to any maximum discount cap.
   * 
   * **Validates: Requirements 13.1**
   */
  describe('Property 18: Percentage Discount Calculation', () => {
    it('should calculate percentage discounts correctly for any valid inputs', () => {
      fc.assert(
        fc.property(
          fc.float({ min: 0, max: 100, noNaN: true }),
          fc.float({ min: Math.fround(0.01), max: Math.fround(10000), noNaN: true }),
          fc.integer({ min: 1, max: 100 }),
          (discountValue, itemPrice, quantity) => {
            // Arrange
            const discount = createDiscount('percentage', discountValue);

            // Act
            const result = calculator.calculateItemDiscount(discount, itemPrice, quantity);

            // Assert: Calculate expected discount amount
            const originalAmount = Math.round(itemPrice * quantity * 100) / 100;
            const expectedDiscount = Math.round((originalAmount * discountValue) / 100 * 100) / 100;
            const expectedFinal = Math.max(0, Math.round((originalAmount - expectedDiscount) * 100) / 100);

            // Property: Discount amount matches formula
            expect(result.discountAmount).toBeCloseTo(expectedDiscount, 2);
            
            // Property: Original amount is correct
            expect(result.originalAmount).toBeCloseTo(originalAmount, 2);
            
            // Property: Final amount is correct
            expect(result.finalAmount).toBeCloseTo(expectedFinal, 2);
            
            // Property: Final amount is never negative
            expect(result.finalAmount).toBeGreaterThanOrEqual(0);
            
            // Property: Discount amount is never negative
            expect(result.discountAmount).toBeGreaterThanOrEqual(0);
            
            // Property: Discount amount never exceeds original amount
            expect(result.discountAmount).toBeLessThanOrEqual(result.originalAmount);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should respect maximum discount cap when specified', () => {
      fc.assert(
        fc.property(
          fc.float({ min: 0, max: 100, noNaN: true }),
          fc.float({ min: Math.fround(10), max: Math.fround(1000), noNaN: true }),
          fc.integer({ min: 1, max: 50 }),
          fc.float({ min: Math.fround(1), max: Math.fround(500), noNaN: true }),
          (discountValue, itemPrice, quantity, maxDiscountAmount) => {
            // Arrange
            const discount = createDiscount('percentage', discountValue, {
              maximumDiscountAmount: Math.round(maxDiscountAmount * 100) / 100, // Round to 2 decimals
            });

            // Act
            const result = calculator.calculateItemDiscount(discount, itemPrice, quantity);

            // Assert: Property - Discount amount never exceeds maximum cap (with rounding tolerance)
            expect(result.discountAmount).toBeLessThanOrEqual(
              Math.round(maxDiscountAmount * 100) / 100 + 0.01
            );
            
            // Property: If calculated discount would exceed cap, it equals cap
            const originalAmount = Math.round(itemPrice * quantity * 100) / 100;
            const uncappedDiscount = Math.round((originalAmount * discountValue) / 100 * 100) / 100;
            const roundedMaxCap = Math.round(maxDiscountAmount * 100) / 100;
            
            if (uncappedDiscount > roundedMaxCap) {
              expect(result.discountAmount).toBeCloseTo(roundedMaxCap, 2);
            } else {
              expect(result.discountAmount).toBeCloseTo(uncappedDiscount, 2);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle edge cases: 0% discount', () => {
      fc.assert(
        fc.property(
          fc.float({ min: Math.fround(0.01), max: Math.fround(10000), noNaN: true }),
          fc.integer({ min: 1, max: 100 }),
          (itemPrice, quantity) => {
            // Arrange: 0% discount
            const discount = createDiscount('percentage', 0);

            // Act
            const result = calculator.calculateItemDiscount(discount, itemPrice, quantity);

            // Assert: Property - 0% discount means no discount applied
            expect(result.discountAmount).toBe(0);
            expect(result.finalAmount).toBeCloseTo(result.originalAmount, 2);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle edge cases: 100% discount', () => {
      fc.assert(
        fc.property(
          fc.float({ min: Math.fround(0.01), max: Math.fround(10000), noNaN: true }),
          fc.integer({ min: 1, max: 100 }),
          (itemPrice, quantity) => {
            // Arrange: 100% discount
            const discount = createDiscount('percentage', 100);

            // Act
            const result = calculator.calculateItemDiscount(discount, itemPrice, quantity);

            // Assert: Property - 100% discount means final amount is 0
            expect(result.finalAmount).toBe(0);
            expect(result.discountAmount).toBeCloseTo(result.originalAmount, 2);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should maintain arithmetic consistency: original = discount + final', () => {
      fc.assert(
        fc.property(
          fc.float({ min: 0, max: 100, noNaN: true }),
          fc.float({ min: Math.fround(0.01), max: Math.fround(10000), noNaN: true }),
          fc.integer({ min: 1, max: 100 }),
          (discountValue, itemPrice, quantity) => {
            // Arrange
            const discount = createDiscount('percentage', discountValue);

            // Act
            const result = calculator.calculateItemDiscount(discount, itemPrice, quantity);

            // Assert: Property - Original amount equals discount + final (within rounding tolerance)
            const sum = result.discountAmount + result.finalAmount;
            expect(sum).toBeCloseTo(result.originalAmount, 2);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should round all monetary values to exactly 2 decimal places', () => {
      fc.assert(
        fc.property(
          fc.float({ min: 0, max: 100, noNaN: true }),
          fc.float({ min: Math.fround(0.01), max: Math.fround(10000), noNaN: true }),
          fc.integer({ min: 1, max: 100 }),
          (discountValue, itemPrice, quantity) => {
            // Arrange
            const discount = createDiscount('percentage', discountValue);

            // Act
            const result = calculator.calculateItemDiscount(discount, itemPrice, quantity);

            // Assert: Property - All amounts have at most 2 decimal places
            const hasMaxTwoDecimals = (value: number): boolean => {
              const str = value.toFixed(2);
              return Math.abs(value - parseFloat(str)) < 0.001;
            };

            expect(hasMaxTwoDecimals(result.originalAmount)).toBe(true);
            expect(hasMaxTwoDecimals(result.discountAmount)).toBe(true);
            expect(hasMaxTwoDecimals(result.finalAmount)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 17: Non-Negative Final Price Invariant
   * 
   * For any discount calculation, the final price must be greater than or equal to zero,
   * regardless of the discount amounts. This property ensures that even with extreme
   * discount values, multiple combined discounts, or any other scenario, the system
   * never produces a negative final price.
   * 
   * **Validates: Requirements 8.6, 13.6**
   */
  describe('Property 17: Non-Negative Final Price Invariant', () => {
    it('should never produce negative final prices with single discounts', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('percentage' as DiscountType, 'fixed' as DiscountType),
          fc.float({ min: 0, max: 100000, noNaN: true }), // Extreme discount values
          fc.float({ min: Math.fround(0.01), max: Math.fround(10000), noNaN: true }),
          fc.integer({ min: 1, max: 100 }),
          (discountType, discountValue, itemPrice, quantity) => {
            // Arrange: Create discount with potentially extreme values
            const discount = createDiscount(discountType, discountValue);

            // Act
            const result = calculator.calculateItemDiscount(discount, itemPrice, quantity);

            // Assert: Property - Final price is NEVER negative
            expect(result.finalAmount).toBeGreaterThanOrEqual(0);
            
            // Additional invariants
            expect(result.originalAmount).toBeGreaterThanOrEqual(0);
            expect(result.discountAmount).toBeGreaterThanOrEqual(0);
            expect(result.discountAmount).toBeLessThanOrEqual(result.originalAmount);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should never produce negative final prices with multiple combined discounts', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              discountType: fc.constantFrom('percentage' as DiscountType, 'fixed' as DiscountType),
              discountValue: fc.float({ min: 0, max: 10000, noNaN: true }),
              priority: fc.integer({ min: 0, max: 100 }),
              combinable: fc.boolean(),
            }),
            { minLength: 1, maxLength: 5 }
          ),
          fc.float({ min: Math.fround(0.01), max: Math.fround(10000), noNaN: true }),
          fc.integer({ min: 1, max: 100 }),
          (discountConfigs, itemPrice, quantity) => {
            // Arrange: Create multiple discounts with various configurations
            const discounts = discountConfigs.map((config, index) =>
              createDiscount(config.discountType, config.discountValue, {
                id: `discount-${index}`,
                name: `Discount ${index}`,
              })
            );

            // Set priority and combinable properties
            discounts.forEach((discount, index) => {
              discount.priority = discountConfigs[index].priority;
              discount.combinable = discountConfigs[index].combinable;
            });

            // Act
            const result = calculator.applyMultipleDiscounts(discounts, itemPrice, quantity);

            // Assert: Property - Final price is NEVER negative, even with multiple discounts
            expect(result.finalAmount).toBeGreaterThanOrEqual(0);
            
            // Additional invariants
            expect(result.originalAmount).toBeGreaterThanOrEqual(0);
            expect(result.discountAmount).toBeGreaterThanOrEqual(0);
            expect(result.discountAmount).toBeLessThanOrEqual(result.originalAmount);
            expect(result.finalAmount).toBeLessThanOrEqual(result.originalAmount);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should never produce negative final prices with quantity-based discounts', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('percentage' as DiscountType, 'fixed' as DiscountType),
          fc.float({ min: 0, max: 10000, noNaN: true }),
          fc.float({ min: Math.fround(0.01), max: Math.fround(1000), noNaN: true }),
          fc.integer({ min: 1, max: 100 }),
          fc.integer({ min: 1, max: 50 }),
          fc.integer({ min: 1, max: 50 }),
          (discountType, discountValue, itemPrice, quantity, minimumQuantity, applyToQuantity) => {
            // Arrange: Create quantity-based discount
            const discount = createDiscount(discountType, discountValue);
            discount.applicationScope = 'quantity-based';
            discount.quantityRules = {
              minimumQuantity,
              applyToQuantity,
            };

            // Act
            const result = calculator.calculateQuantityDiscount(discount, itemPrice, quantity);

            // Assert: Property - Final price is NEVER negative with quantity discounts
            expect(result.finalAmount).toBeGreaterThanOrEqual(0);
            
            // Additional invariants
            expect(result.originalAmount).toBeGreaterThanOrEqual(0);
            expect(result.discountAmount).toBeGreaterThanOrEqual(0);
            expect(result.discountAmount).toBeLessThanOrEqual(result.originalAmount);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should never produce negative final prices with extreme discount values exceeding item price', () => {
      fc.assert(
        fc.property(
          fc.float({ min: Math.fround(0.01), max: Math.fround(100), noNaN: true }),
          fc.integer({ min: 1, max: 10 }),
          (itemPrice, quantity) => {
            // Arrange: Create fixed discount that far exceeds the item price
            const totalPrice = itemPrice * quantity;
            const extremeDiscountValue = totalPrice * 10; // 10x the item price
            const discount = createDiscount('fixed', extremeDiscountValue);

            // Act
            const result = calculator.calculateItemDiscount(discount, itemPrice, quantity);

            // Assert: Property - Even with extreme discount, final price is 0 (not negative)
            expect(result.finalAmount).toBe(0);
            expect(result.finalAmount).toBeGreaterThanOrEqual(0);
            
            // Property: Discount amount should equal original amount (capped)
            expect(result.discountAmount).toBeCloseTo(result.originalAmount, 2);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should never produce negative final prices with 100%+ percentage discounts', () => {
      fc.assert(
        fc.property(
          fc.float({ min: Math.fround(0.01), max: Math.fround(1000), noNaN: true }),
          fc.integer({ min: 1, max: 50 }),
          (itemPrice, quantity) => {
            // Arrange: Create 100% discount (maximum allowed percentage)
            const discount = createDiscount('percentage', 100);

            // Act
            const result = calculator.calculateItemDiscount(discount, itemPrice, quantity);

            // Assert: Property - 100% discount results in 0 final price (not negative)
            expect(result.finalAmount).toBe(0);
            expect(result.finalAmount).toBeGreaterThanOrEqual(0);
            
            // Property: Discount amount equals original amount
            expect(result.discountAmount).toBeCloseTo(result.originalAmount, 2);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should never produce negative final prices in cart-level calculations', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              id: fc.uuid(),
              name: fc.string({ minLength: 1, maxLength: 50 }),
              price: fc.float({ min: Math.fround(0.01), max: Math.fround(1000), noNaN: true }),
              quantity: fc.integer({ min: 1, max: 50 }),
            }),
            { minLength: 1, maxLength: 10 }
          ),
          fc.array(
            fc.record({
              discountType: fc.constantFrom('percentage' as DiscountType, 'fixed' as DiscountType),
              discountValue: fc.float({ min: 0, max: 10000, noNaN: true }),
              applicationScope: fc.constantFrom('item' as ApplicationScope, 'cart' as ApplicationScope),
              priority: fc.integer({ min: 0, max: 100 }),
            }),
            { minLength: 0, maxLength: 5 }
          ),
          (cartItems, discountConfigs) => {
            // Arrange: Create cart items and discounts
            const discounts = discountConfigs.map((config, index) => {
              const discount = createDiscount(config.discountType, config.discountValue, {
                id: `discount-${index}`,
                name: `Discount ${index}`,
              });
              discount.applicationScope = config.applicationScope;
              discount.priority = config.priority;
              discount.combinable = true;
              return discount;
            });

            // Act
            const result = calculator.calculateCartDiscounts(cartItems, discounts);

            // Assert: Property - Final total is NEVER negative
            expect(result.finalTotal).toBeGreaterThanOrEqual(0);
            
            // Property: Each item's final amount is never negative
            result.itemResults.forEach((itemResult) => {
              expect(itemResult.finalAmount).toBeGreaterThanOrEqual(0);
              expect(itemResult.discountAmount).toBeGreaterThanOrEqual(0);
              expect(itemResult.discountAmount).toBeLessThanOrEqual(itemResult.originalAmount);
            });
            
            // Additional invariants
            expect(result.originalTotal).toBeGreaterThanOrEqual(0);
            expect(result.discountTotal).toBeGreaterThanOrEqual(0);
            expect(result.discountTotal).toBeLessThanOrEqual(result.originalTotal);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should maintain non-negative invariant with sequential discount application', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              discountType: fc.constantFrom('percentage' as DiscountType, 'fixed' as DiscountType),
              discountValue: fc.float({ min: 0, max: 100, noNaN: true }),
            }),
            { minLength: 2, maxLength: 5 }
          ),
          fc.float({ min: Math.fround(0.01), max: Math.fround(1000), noNaN: true }),
          fc.integer({ min: 1, max: 50 }),
          (discountConfigs, itemPrice, quantity) => {
            // Arrange: Create multiple combinable discounts
            const discounts = discountConfigs.map((config, index) => {
              const discount = createDiscount(config.discountType, config.discountValue, {
                id: `discount-${index}`,
                name: `Discount ${index}`,
              });
              discount.priority = 100 - index; // Descending priority
              discount.combinable = true; // All combinable for sequential application
              return discount;
            });

            // Act
            const result = calculator.applyMultipleDiscounts(discounts, itemPrice, quantity);

            // Assert: Property - Sequential application never produces negative final price
            expect(result.finalAmount).toBeGreaterThanOrEqual(0);
            
            // Property: Each applied discount maintains non-negative intermediate amounts
            let currentAmount = result.originalAmount;
            result.appliedDiscounts.forEach((appliedDiscount) => {
              expect(appliedDiscount.discountAmount).toBeGreaterThanOrEqual(0);
              currentAmount -= appliedDiscount.discountAmount;
              expect(currentAmount).toBeGreaterThanOrEqual(-0.01); // Allow tiny rounding error
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle edge case: zero item price with any discount', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('percentage' as DiscountType, 'fixed' as DiscountType),
          fc.float({ min: 0, max: 1000, noNaN: true }),
          fc.integer({ min: 1, max: 100 }),
          (discountType, discountValue, quantity) => {
            // Arrange: Zero item price (edge case)
            const discount = createDiscount(discountType, discountValue);

            // Act
            const result = calculator.calculateItemDiscount(discount, 0, quantity);

            // Assert: Property - Zero price with any discount results in zero (not negative)
            expect(result.finalAmount).toBe(0);
            expect(result.originalAmount).toBe(0);
            expect(result.discountAmount).toBe(0);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 21: Maximum Discount Cap
   * 
   * For any discount with a maximum discount amount specified, the calculated
   * discount amount should never exceed that maximum, regardless of discount type,
   * discount value, item price, or quantity.
   * 
   * **Validates: Requirements 13.5**
   */
  describe('Property 21: Maximum Discount Cap', () => {
    it('should enforce maximum discount cap for percentage discounts', () => {
      fc.assert(
        fc.property(
          fc.float({ min: 0, max: 100, noNaN: true }),
          fc.float({ min: Math.fround(10), max: Math.fround(1000), noNaN: true }),
          fc.integer({ min: 1, max: 50 }),
          fc.float({ min: Math.fround(1), max: Math.fround(500), noNaN: true }),
          (discountValue, itemPrice, quantity, maxDiscountAmount) => {
            // Arrange: Create percentage discount with maximum cap
            const roundedMaxCap = Math.round(maxDiscountAmount * 100) / 100;
            const discount = createDiscount('percentage', discountValue, {
              maximumDiscountAmount: roundedMaxCap,
            });

            // Act
            const result = calculator.calculateItemDiscount(discount, itemPrice, quantity);

            // Assert: Property - Discount amount NEVER exceeds maximum cap
            expect(result.discountAmount).toBeLessThanOrEqual(roundedMaxCap + 0.01);
            
            // Property: If uncapped discount would exceed cap, discount equals cap
            const originalAmount = Math.round(itemPrice * quantity * 100) / 100;
            const uncappedDiscount = Math.round((originalAmount * discountValue) / 100 * 100) / 100;
            
            if (uncappedDiscount > roundedMaxCap) {
              expect(result.discountAmount).toBeCloseTo(roundedMaxCap, 2);
            } else {
              expect(result.discountAmount).toBeCloseTo(uncappedDiscount, 2);
            }
            
            // Property: Final amount is never negative
            expect(result.finalAmount).toBeGreaterThanOrEqual(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should enforce maximum discount cap for fixed amount discounts', () => {
      fc.assert(
        fc.property(
          fc.float({ min: Math.fround(10), max: Math.fround(1000), noNaN: true }),
          fc.float({ min: Math.fround(10), max: Math.fround(1000), noNaN: true }),
          fc.integer({ min: 1, max: 50 }),
          fc.float({ min: Math.fround(1), max: Math.fround(500), noNaN: true }),
          (discountValue, itemPrice, quantity, maxDiscountAmount) => {
            // Arrange: Create fixed discount with maximum cap
            const roundedMaxCap = Math.round(maxDiscountAmount * 100) / 100;
            const discount = createDiscount('fixed', discountValue, {
              maximumDiscountAmount: roundedMaxCap,
            });

            // Act
            const result = calculator.calculateItemDiscount(discount, itemPrice, quantity);

            // Assert: Property - Discount amount NEVER exceeds maximum cap
            expect(result.discountAmount).toBeLessThanOrEqual(roundedMaxCap + 0.01);
            
            // Property: If uncapped discount would exceed cap, discount equals cap
            const originalAmount = Math.round(itemPrice * quantity * 100) / 100;
            const uncappedDiscount = Math.min(
              Math.round(discountValue * 100) / 100,
              originalAmount
            );
            
            if (uncappedDiscount > roundedMaxCap) {
              expect(result.discountAmount).toBeCloseTo(roundedMaxCap, 2);
            } else {
              expect(result.discountAmount).toBeCloseTo(uncappedDiscount, 2);
            }
            
            // Property: Final amount is never negative
            expect(result.finalAmount).toBeGreaterThanOrEqual(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should enforce maximum discount cap for quantity-based discounts', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('percentage' as DiscountType, 'fixed' as DiscountType),
          fc.float({ min: 0, max: 100, noNaN: true }),
          fc.float({ min: Math.fround(10), max: Math.fround(100), noNaN: true }),
          fc.integer({ min: 5, max: 50 }),
          fc.integer({ min: 1, max: 10 }),
          fc.integer({ min: 1, max: 10 }),
          fc.float({ min: Math.fround(5), max: Math.fround(200), noNaN: true }),
          (discountType, discountValue, itemPrice, quantity, minimumQuantity, applyToQuantity, maxDiscountAmount) => {
            // Arrange: Create quantity-based discount with maximum cap
            const roundedMaxCap = Math.round(maxDiscountAmount * 100) / 100;
            const discount = createDiscount(discountType, discountValue, {
              maximumDiscountAmount: roundedMaxCap,
            });
            discount.applicationScope = 'quantity-based';
            discount.quantityRules = {
              minimumQuantity,
              applyToQuantity,
            };

            // Act
            const result = calculator.calculateQuantityDiscount(discount, itemPrice, quantity);

            // Assert: Property - Discount amount NEVER exceeds maximum cap
            expect(result.discountAmount).toBeLessThanOrEqual(roundedMaxCap + 0.01);
            
            // Property: Final amount is never negative
            expect(result.finalAmount).toBeGreaterThanOrEqual(0);
            
            // Property: Discount never exceeds original amount
            expect(result.discountAmount).toBeLessThanOrEqual(result.originalAmount);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should enforce maximum discount cap with multiple combined discounts', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              discountType: fc.constantFrom('percentage' as DiscountType, 'fixed' as DiscountType),
              discountValue: fc.float({ min: 0, max: 100, noNaN: true }),
              maxDiscountAmount: fc.float({ min: Math.fround(5), max: Math.fround(200), noNaN: true }),
              priority: fc.integer({ min: 0, max: 100 }),
            }),
            { minLength: 1, maxLength: 5 }
          ),
          fc.float({ min: Math.fround(50), max: Math.fround(500), noNaN: true }),
          fc.integer({ min: 1, max: 20 }),
          (discountConfigs, itemPrice, quantity) => {
            // Arrange: Create multiple discounts, each with their own maximum cap
            const discounts = discountConfigs.map((config, index) => {
              const roundedMaxCap = Math.round(config.maxDiscountAmount * 100) / 100;
              const discount = createDiscount(config.discountType, config.discountValue, {
                id: `discount-${index}`,
                name: `Discount ${index}`,
                maximumDiscountAmount: roundedMaxCap,
              });
              discount.priority = config.priority;
              discount.combinable = true;
              return discount;
            });

            // Act
            const result = calculator.applyMultipleDiscounts(discounts, itemPrice, quantity);

            // Assert: Property - Each applied discount respects its individual maximum cap
            result.appliedDiscounts.forEach((appliedDiscount) => {
              const originalDiscount = discounts.find(d => d.id === appliedDiscount.discountId);
              if (originalDiscount?.eligibilityCriteria?.maximumDiscountAmount) {
                const maxCap = originalDiscount.eligibilityCriteria.maximumDiscountAmount;
                expect(appliedDiscount.discountAmount).toBeLessThanOrEqual(maxCap + 0.01);
              }
            });
            
            // Property: Final amount is never negative
            expect(result.finalAmount).toBeGreaterThanOrEqual(0);
            
            // Property: Total discount never exceeds original amount
            expect(result.discountAmount).toBeLessThanOrEqual(result.originalAmount);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle edge case: maximum cap is zero', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('percentage' as DiscountType, 'fixed' as DiscountType),
          fc.float({ min: 10, max: 100, noNaN: true }),
          fc.float({ min: Math.fround(10), max: Math.fround(500), noNaN: true }),
          fc.integer({ min: 1, max: 20 }),
          (discountType, discountValue, itemPrice, quantity) => {
            // Arrange: Maximum cap is zero (edge case)
            const discount = createDiscount(discountType, discountValue, {
              maximumDiscountAmount: 0,
            });

            // Act
            const result = calculator.calculateItemDiscount(discount, itemPrice, quantity);

            // Assert: Property - When max cap is 0, no discount is applied
            expect(result.discountAmount).toBe(0);
            expect(result.finalAmount).toBeCloseTo(result.originalAmount, 2);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle edge case: maximum cap is very small', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('percentage' as DiscountType, 'fixed' as DiscountType),
          fc.float({ min: 50, max: 100, noNaN: true }),
          fc.float({ min: Math.fround(100), max: Math.fround(1000), noNaN: true }),
          fc.integer({ min: 1, max: 10 }),
          fc.float({ min: Math.fround(0.01), max: Math.fround(0.99), noNaN: true }),
          (discountType, discountValue, itemPrice, quantity, maxDiscountAmount) => {
            // Arrange: Very small maximum cap (less than $1)
            const roundedMaxCap = Math.round(maxDiscountAmount * 100) / 100;
            const discount = createDiscount(discountType, discountValue, {
              maximumDiscountAmount: roundedMaxCap,
            });

            // Act
            const result = calculator.calculateItemDiscount(discount, itemPrice, quantity);

            // Assert: Property - Discount is capped at the small maximum
            expect(result.discountAmount).toBeLessThanOrEqual(roundedMaxCap + 0.01);
            expect(result.discountAmount).toBeGreaterThanOrEqual(0);
            
            // Property: Final amount is close to original (small discount)
            const originalAmount = Math.round(itemPrice * quantity * 100) / 100;
            expect(result.finalAmount).toBeCloseTo(originalAmount - result.discountAmount, 2);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle edge case: maximum cap exceeds possible discount', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('percentage' as DiscountType, 'fixed' as DiscountType),
          fc.float({ min: 1, max: 50, noNaN: true }),
          fc.float({ min: Math.fround(10), max: Math.fround(100), noNaN: true }),
          fc.integer({ min: 1, max: 10 }),
          (discountType, discountValue, itemPrice, quantity) => {
            // Arrange: Maximum cap is much larger than possible discount
            const originalAmount = Math.round(itemPrice * quantity * 100) / 100;
            const veryLargeMaxCap = originalAmount * 10; // 10x the item price
            const discount = createDiscount(discountType, discountValue, {
              maximumDiscountAmount: veryLargeMaxCap,
            });

            // Act
            const result = calculator.calculateItemDiscount(discount, itemPrice, quantity);

            // Assert: Property - When cap exceeds possible discount, cap has no effect
            // The discount is limited by the original amount, not the cap
            expect(result.discountAmount).toBeLessThanOrEqual(originalAmount);
            expect(result.discountAmount).toBeLessThanOrEqual(veryLargeMaxCap);
            
            // Property: Final amount is never negative
            expect(result.finalAmount).toBeGreaterThanOrEqual(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should maintain arithmetic consistency with maximum cap: original = discount + final', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('percentage' as DiscountType, 'fixed' as DiscountType),
          fc.float({ min: 0, max: 100, noNaN: true }),
          fc.float({ min: Math.fround(10), max: Math.fround(500), noNaN: true }),
          fc.integer({ min: 1, max: 50 }),
          fc.float({ min: Math.fround(1), max: Math.fround(200), noNaN: true }),
          (discountType, discountValue, itemPrice, quantity, maxDiscountAmount) => {
            // Arrange
            const roundedMaxCap = Math.round(maxDiscountAmount * 100) / 100;
            const discount = createDiscount(discountType, discountValue, {
              maximumDiscountAmount: roundedMaxCap,
            });

            // Act
            const result = calculator.calculateItemDiscount(discount, itemPrice, quantity);

            // Assert: Property - Arithmetic consistency holds even with cap
            const sum = result.discountAmount + result.finalAmount;
            expect(sum).toBeCloseTo(result.originalAmount, 2);
            
            // Property: Discount respects cap
            expect(result.discountAmount).toBeLessThanOrEqual(roundedMaxCap + 0.01);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should enforce maximum cap in cart-level calculations', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              id: fc.uuid(),
              name: fc.string({ minLength: 1, maxLength: 50 }),
              price: fc.float({ min: Math.fround(10), max: Math.fround(200), noNaN: true }),
              quantity: fc.integer({ min: 1, max: 20 }),
            }),
            { minLength: 1, maxLength: 5 }
          ),
          fc.array(
            fc.record({
              discountType: fc.constantFrom('percentage' as DiscountType, 'fixed' as DiscountType),
              discountValue: fc.float({ min: 0, max: 100, noNaN: true }),
              maxDiscountAmount: fc.float({ min: Math.fround(10), max: Math.fround(300), noNaN: true }),
              applicationScope: fc.constantFrom('item' as ApplicationScope, 'cart' as ApplicationScope),
            }),
            { minLength: 1, maxLength: 3 }
          ),
          (cartItems, discountConfigs) => {
            // Arrange: Create discounts with maximum caps
            const discounts = discountConfigs.map((config, index) => {
              const roundedMaxCap = Math.round(config.maxDiscountAmount * 100) / 100;
              const discount = createDiscount(config.discountType, config.discountValue, {
                id: `discount-${index}`,
                name: `Discount ${index}`,
                maximumDiscountAmount: roundedMaxCap,
              });
              discount.applicationScope = config.applicationScope;
              discount.combinable = true;
              discount.priority = 100 - index;
              return discount;
            });

            // Act
            const result = calculator.calculateCartDiscounts(cartItems, discounts);

            // Assert: Property - Each item's discount respects maximum caps
            result.itemResults.forEach((itemResult) => {
              itemResult.appliedDiscounts.forEach((appliedDiscount) => {
                const originalDiscount = discounts.find(d => d.id === appliedDiscount.discountId);
                if (originalDiscount?.eligibilityCriteria?.maximumDiscountAmount) {
                  const maxCap = originalDiscount.eligibilityCriteria.maximumDiscountAmount;
                  expect(appliedDiscount.discountAmount).toBeLessThanOrEqual(maxCap + 0.01);
                }
              });
            });
            
            // Property: Cart-level discounts respect maximum caps
            result.cartLevelDiscounts.forEach((appliedDiscount) => {
              const originalDiscount = discounts.find(d => d.id === appliedDiscount.discountId);
              if (originalDiscount?.eligibilityCriteria?.maximumDiscountAmount) {
                const maxCap = originalDiscount.eligibilityCriteria.maximumDiscountAmount;
                expect(appliedDiscount.discountAmount).toBeLessThanOrEqual(maxCap + 0.01);
              }
            });
            
            // Property: Final total is never negative
            expect(result.finalTotal).toBeGreaterThanOrEqual(0);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 19: Fixed Amount Discount Calculation
   * 
   * For any fixed amount discount, the discount amount should equal
   * the minimum of (discount value, item price × quantity).
   * 
   * **Validates: Requirements 13.2**
   */
  describe('Property 19: Fixed Amount Discount Calculation', () => {
    it('should calculate fixed amount discounts correctly for any valid inputs', () => {
      fc.assert(
        fc.property(
          fc.float({ min: Math.fround(0.01), max: Math.fround(1000), noNaN: true }),
          fc.float({ min: Math.fround(0.01), max: Math.fround(10000), noNaN: true }),
          fc.integer({ min: 1, max: 100 }),
          (discountValue, itemPrice, quantity) => {
            // Arrange
            const discount = createDiscount('fixed', discountValue);

            // Act
            const result = calculator.calculateItemDiscount(discount, itemPrice, quantity);

            // Assert: Calculate expected values
            const originalAmount = Math.round(itemPrice * quantity * 100) / 100;
            const expectedDiscount = Math.min(
              Math.round(discountValue * 100) / 100,
              originalAmount
            );
            const expectedFinal = Math.max(0, Math.round((originalAmount - expectedDiscount) * 100) / 100);

            // Property: Discount amount equals min(discount value, item price × quantity)
            expect(result.discountAmount).toBeCloseTo(expectedDiscount, 2);
            
            // Property: Original amount is correct
            expect(result.originalAmount).toBeCloseTo(originalAmount, 2);
            
            // Property: Final amount is correct
            expect(result.finalAmount).toBeCloseTo(expectedFinal, 2);
            
            // Property: Final amount is never negative
            expect(result.finalAmount).toBeGreaterThanOrEqual(0);
            
            // Property: Discount amount is never negative
            expect(result.discountAmount).toBeGreaterThanOrEqual(0);
            
            // Property: Discount amount never exceeds original amount
            expect(result.discountAmount).toBeLessThanOrEqual(result.originalAmount);
            
            // Property: Discount amount never exceeds discount value
            expect(result.discountAmount).toBeLessThanOrEqual(Math.round(discountValue * 100) / 100 + 0.01);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle cases where discount exceeds item price', () => {
      fc.assert(
        fc.property(
          fc.float({ min: Math.fround(100), max: Math.fround(10000), noNaN: true }),
          fc.float({ min: Math.fround(0.01), max: Math.fround(50), noNaN: true }),
          fc.integer({ min: 1, max: 10 }),
          (discountValue, itemPrice, quantity) => {
            // Arrange: Discount value is intentionally larger than likely total price
            const discount = createDiscount('fixed', discountValue);

            // Act
            const result = calculator.calculateItemDiscount(discount, itemPrice, quantity);

            // Assert: Property - When discount exceeds price, discount equals original amount
            const originalAmount = Math.round(itemPrice * quantity * 100) / 100;
            
            if (discountValue > originalAmount) {
              expect(result.discountAmount).toBeCloseTo(originalAmount, 2);
              expect(result.finalAmount).toBe(0);
            }
            
            // Property: Final price never goes negative
            expect(result.finalAmount).toBeGreaterThanOrEqual(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should respect maximum discount cap when specified', () => {
      fc.assert(
        fc.property(
          fc.float({ min: Math.fround(10), max: Math.fround(1000), noNaN: true }),
          fc.float({ min: Math.fround(10), max: Math.fround(1000), noNaN: true }),
          fc.integer({ min: 1, max: 50 }),
          fc.float({ min: Math.fround(1), max: Math.fround(500), noNaN: true }),
          (discountValue, itemPrice, quantity, maxDiscountAmount) => {
            // Arrange
            const discount = createDiscount('fixed', discountValue, {
              maximumDiscountAmount: Math.round(maxDiscountAmount * 100) / 100,
            });

            // Act
            const result = calculator.calculateItemDiscount(discount, itemPrice, quantity);

            // Assert: Property - Discount amount never exceeds maximum cap
            const roundedMaxCap = Math.round(maxDiscountAmount * 100) / 100;
            expect(result.discountAmount).toBeLessThanOrEqual(roundedMaxCap + 0.01);
            
            // Property: If calculated discount would exceed cap, it equals cap
            const originalAmount = Math.round(itemPrice * quantity * 100) / 100;
            const uncappedDiscount = Math.min(
              Math.round(discountValue * 100) / 100,
              originalAmount
            );
            
            if (uncappedDiscount > roundedMaxCap) {
              expect(result.discountAmount).toBeCloseTo(roundedMaxCap, 2);
            } else {
              expect(result.discountAmount).toBeCloseTo(uncappedDiscount, 2);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should maintain arithmetic consistency: original = discount + final', () => {
      fc.assert(
        fc.property(
          fc.float({ min: Math.fround(0.01), max: Math.fround(1000), noNaN: true }),
          fc.float({ min: Math.fround(0.01), max: Math.fround(10000), noNaN: true }),
          fc.integer({ min: 1, max: 100 }),
          (discountValue, itemPrice, quantity) => {
            // Arrange
            const discount = createDiscount('fixed', discountValue);

            // Act
            const result = calculator.calculateItemDiscount(discount, itemPrice, quantity);

            // Assert: Property - Original amount equals discount + final (within rounding tolerance)
            const sum = result.discountAmount + result.finalAmount;
            expect(sum).toBeCloseTo(result.originalAmount, 2);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should round all monetary values to exactly 2 decimal places', () => {
      fc.assert(
        fc.property(
          fc.float({ min: Math.fround(0.01), max: Math.fround(1000), noNaN: true }),
          fc.float({ min: Math.fround(0.01), max: Math.fround(10000), noNaN: true }),
          fc.integer({ min: 1, max: 100 }),
          (discountValue, itemPrice, quantity) => {
            // Arrange
            const discount = createDiscount('fixed', discountValue);

            // Act
            const result = calculator.calculateItemDiscount(discount, itemPrice, quantity);

            // Assert: Property - All amounts have at most 2 decimal places
            const hasMaxTwoDecimals = (value: number): boolean => {
              const str = value.toFixed(2);
              return Math.abs(value - parseFloat(str)) < 0.001;
            };

            expect(hasMaxTwoDecimals(result.originalAmount)).toBe(true);
            expect(hasMaxTwoDecimals(result.discountAmount)).toBe(true);
            expect(hasMaxTwoDecimals(result.finalAmount)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle edge case: discount value equals item price', () => {
      fc.assert(
        fc.property(
          fc.float({ min: Math.fround(0.01), max: Math.fround(1000), noNaN: true }),
          fc.integer({ min: 1, max: 10 }),
          (itemPrice, quantity) => {
            // Arrange: Discount value equals total price
            const totalPrice = Math.round(itemPrice * quantity * 100) / 100;
            const discount = createDiscount('fixed', totalPrice);

            // Act
            const result = calculator.calculateItemDiscount(discount, itemPrice, quantity);

            // Assert: Property - When discount equals price, final amount is 0
            expect(result.finalAmount).toBe(0);
            expect(result.discountAmount).toBeCloseTo(totalPrice, 2);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle edge case: very small discount values', () => {
      fc.assert(
        fc.property(
          fc.float({ min: Math.fround(0.01), max: Math.fround(0.99), noNaN: true }),
          fc.float({ min: Math.fround(10), max: Math.fround(1000), noNaN: true }),
          fc.integer({ min: 1, max: 100 }),
          (discountValue, itemPrice, quantity) => {
            // Arrange: Very small discount value
            const discount = createDiscount('fixed', discountValue);

            // Act
            const result = calculator.calculateItemDiscount(discount, itemPrice, quantity);

            // Assert: Property - Small discount is applied correctly
            const expectedDiscount = Math.round(discountValue * 100) / 100;
            expect(result.discountAmount).toBeCloseTo(expectedDiscount, 2);
            
            // Property: Final amount is close to original (small discount)
            const originalAmount = Math.round(itemPrice * quantity * 100) / 100;
            expect(result.finalAmount).toBeCloseTo(originalAmount - expectedDiscount, 2);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 22: Monetary Value Rounding
   * 
   * For any discount calculation, all monetary values (original amount, discount amount,
   * final amount) should be rounded to exactly two decimal places. This ensures consistent
   * monetary representation across all calculations and prevents floating-point precision
   * issues from affecting financial transactions.
   * 
   * **Validates: Requirements 13.10**
   */
  describe('Property 22: Monetary Value Rounding', () => {
    /**
     * Helper function to check if a number has exactly 2 decimal places
     * A value has exactly 2 decimal places if rounding it to 2 decimals doesn't change it
     */
    const hasExactlyTwoDecimals = (value: number): boolean => {
      const rounded = Math.round(value * 100) / 100;
      return Math.abs(value - rounded) < 0.001; // Small tolerance for floating point
    };

    /**
     * Helper to count actual decimal places in a number
     */
    const countDecimalPlaces = (value: number): number => {
      const str = value.toString();
      if (!str.includes('.')) return 0;
      return str.split('.')[1].length;
    };

    it('should round all monetary values to exactly 2 decimal places for percentage discounts', () => {
      fc.assert(
        fc.property(
          fc.float({ min: 0, max: 100, noNaN: true }),
          fc.float({ min: Math.fround(0.01), max: Math.fround(10000), noNaN: true }),
          fc.integer({ min: 1, max: 100 }),
          (discountValue, itemPrice, quantity) => {
            // Arrange: Create percentage discount
            const discount = createDiscount('percentage', discountValue);

            // Act
            const result = calculator.calculateItemDiscount(discount, itemPrice, quantity);

            // Assert: Property - All monetary values have exactly 2 decimal places
            expect(hasExactlyTwoDecimals(result.originalAmount)).toBe(true);
            expect(hasExactlyTwoDecimals(result.discountAmount)).toBe(true);
            expect(hasExactlyTwoDecimals(result.finalAmount)).toBe(true);

            // Additional check: Verify no more than 2 decimal places
            expect(countDecimalPlaces(result.originalAmount)).toBeLessThanOrEqual(2);
            expect(countDecimalPlaces(result.discountAmount)).toBeLessThanOrEqual(2);
            expect(countDecimalPlaces(result.finalAmount)).toBeLessThanOrEqual(2);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should round all monetary values to exactly 2 decimal places for fixed amount discounts', () => {
      fc.assert(
        fc.property(
          fc.float({ min: Math.fround(0.01), max: Math.fround(1000), noNaN: true }),
          fc.float({ min: Math.fround(0.01), max: Math.fround(10000), noNaN: true }),
          fc.integer({ min: 1, max: 100 }),
          (discountValue, itemPrice, quantity) => {
            // Arrange: Create fixed amount discount
            const discount = createDiscount('fixed', discountValue);

            // Act
            const result = calculator.calculateItemDiscount(discount, itemPrice, quantity);

            // Assert: Property - All monetary values have exactly 2 decimal places
            expect(hasExactlyTwoDecimals(result.originalAmount)).toBe(true);
            expect(hasExactlyTwoDecimals(result.discountAmount)).toBe(true);
            expect(hasExactlyTwoDecimals(result.finalAmount)).toBe(true);

            // Additional check: Verify no more than 2 decimal places
            expect(countDecimalPlaces(result.originalAmount)).toBeLessThanOrEqual(2);
            expect(countDecimalPlaces(result.discountAmount)).toBeLessThanOrEqual(2);
            expect(countDecimalPlaces(result.finalAmount)).toBeLessThanOrEqual(2);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should round all monetary values to exactly 2 decimal places for quantity-based discounts', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('percentage' as DiscountType, 'fixed' as DiscountType),
          fc.float({ min: 0, max: 100, noNaN: true }),
          fc.float({ min: Math.fround(0.01), max: Math.fround(1000), noNaN: true }),
          fc.integer({ min: 5, max: 100 }),
          fc.integer({ min: 1, max: 10 }),
          fc.integer({ min: 1, max: 10 }),
          (discountType, discountValue, itemPrice, quantity, minimumQuantity, applyToQuantity) => {
            // Arrange: Create quantity-based discount
            const discount = createDiscount(discountType, discountValue);
            discount.applicationScope = 'quantity-based';
            discount.quantityRules = {
              minimumQuantity,
              applyToQuantity,
            };

            // Act
            const result = calculator.calculateQuantityDiscount(discount, itemPrice, quantity);

            // Assert: Property - All monetary values have exactly 2 decimal places
            expect(hasExactlyTwoDecimals(result.originalAmount)).toBe(true);
            expect(hasExactlyTwoDecimals(result.discountAmount)).toBe(true);
            expect(hasExactlyTwoDecimals(result.finalAmount)).toBe(true);

            // Additional check: Verify no more than 2 decimal places
            expect(countDecimalPlaces(result.originalAmount)).toBeLessThanOrEqual(2);
            expect(countDecimalPlaces(result.discountAmount)).toBeLessThanOrEqual(2);
            expect(countDecimalPlaces(result.finalAmount)).toBeLessThanOrEqual(2);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should round all monetary values to exactly 2 decimal places with multiple combined discounts', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              discountType: fc.constantFrom('percentage' as DiscountType, 'fixed' as DiscountType),
              discountValue: fc.float({ min: 0, max: 100, noNaN: true }),
              priority: fc.integer({ min: 0, max: 100 }),
            }),
            { minLength: 1, maxLength: 5 }
          ),
          fc.float({ min: Math.fround(0.01), max: Math.fround(10000), noNaN: true }),
          fc.integer({ min: 1, max: 100 }),
          (discountConfigs, itemPrice, quantity) => {
            // Arrange: Create multiple combinable discounts
            const discounts = discountConfigs.map((config, index) => {
              const discount = createDiscount(config.discountType, config.discountValue, {
                id: `discount-${index}`,
                name: `Discount ${index}`,
              });
              discount.priority = config.priority;
              discount.combinable = true;
              return discount;
            });

            // Act
            const result = calculator.applyMultipleDiscounts(discounts, itemPrice, quantity);

            // Assert: Property - All monetary values have exactly 2 decimal places
            expect(hasExactlyTwoDecimals(result.originalAmount)).toBe(true);
            expect(hasExactlyTwoDecimals(result.discountAmount)).toBe(true);
            expect(hasExactlyTwoDecimals(result.finalAmount)).toBe(true);

            // Property: Each applied discount amount has exactly 2 decimal places
            result.appliedDiscounts.forEach((appliedDiscount) => {
              expect(hasExactlyTwoDecimals(appliedDiscount.discountAmount)).toBe(true);
              expect(countDecimalPlaces(appliedDiscount.discountAmount)).toBeLessThanOrEqual(2);
            });

            // Additional check: Verify no more than 2 decimal places
            expect(countDecimalPlaces(result.originalAmount)).toBeLessThanOrEqual(2);
            expect(countDecimalPlaces(result.discountAmount)).toBeLessThanOrEqual(2);
            expect(countDecimalPlaces(result.finalAmount)).toBeLessThanOrEqual(2);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should round all monetary values to exactly 2 decimal places in cart-level calculations', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              id: fc.uuid(),
              name: fc.string({ minLength: 1, maxLength: 50 }),
              price: fc.float({ min: Math.fround(0.01), max: Math.fround(1000), noNaN: true }),
              quantity: fc.integer({ min: 1, max: 50 }),
            }),
            { minLength: 1, maxLength: 10 }
          ),
          fc.array(
            fc.record({
              discountType: fc.constantFrom('percentage' as DiscountType, 'fixed' as DiscountType),
              discountValue: fc.float({ min: 0, max: 100, noNaN: true }),
              applicationScope: fc.constantFrom('item' as ApplicationScope, 'cart' as ApplicationScope),
              priority: fc.integer({ min: 0, max: 100 }),
            }),
            { minLength: 0, maxLength: 5 }
          ),
          (cartItems, discountConfigs) => {
            // Arrange: Create cart items and discounts
            const discounts = discountConfigs.map((config, index) => {
              const discount = createDiscount(config.discountType, config.discountValue, {
                id: `discount-${index}`,
                name: `Discount ${index}`,
              });
              discount.applicationScope = config.applicationScope;
              discount.priority = config.priority;
              discount.combinable = true;
              return discount;
            });

            // Act
            const result = calculator.calculateCartDiscounts(cartItems, discounts);

            // Assert: Property - All cart-level monetary values have exactly 2 decimal places
            expect(hasExactlyTwoDecimals(result.originalTotal)).toBe(true);
            expect(hasExactlyTwoDecimals(result.discountTotal)).toBe(true);
            expect(hasExactlyTwoDecimals(result.finalTotal)).toBe(true);

            // Property: Each item result has exactly 2 decimal places
            result.itemResults.forEach((itemResult) => {
              expect(hasExactlyTwoDecimals(itemResult.originalAmount)).toBe(true);
              expect(hasExactlyTwoDecimals(itemResult.discountAmount)).toBe(true);
              expect(hasExactlyTwoDecimals(itemResult.finalAmount)).toBe(true);

              // Each applied discount amount has exactly 2 decimal places
              itemResult.appliedDiscounts.forEach((appliedDiscount) => {
                expect(hasExactlyTwoDecimals(appliedDiscount.discountAmount)).toBe(true);
                expect(countDecimalPlaces(appliedDiscount.discountAmount)).toBeLessThanOrEqual(2);
              });
            });

            // Property: Cart-level discounts have exactly 2 decimal places
            result.cartLevelDiscounts.forEach((appliedDiscount) => {
              expect(hasExactlyTwoDecimals(appliedDiscount.discountAmount)).toBe(true);
              expect(countDecimalPlaces(appliedDiscount.discountAmount)).toBeLessThanOrEqual(2);
            });

            // Additional check: Verify no more than 2 decimal places
            expect(countDecimalPlaces(result.originalTotal)).toBeLessThanOrEqual(2);
            expect(countDecimalPlaces(result.discountTotal)).toBeLessThanOrEqual(2);
            expect(countDecimalPlaces(result.finalTotal)).toBeLessThanOrEqual(2);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should round monetary values consistently with prices that produce many decimal places', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('percentage' as DiscountType, 'fixed' as DiscountType),
          fc.float({ min: 1, max: 99, noNaN: true }), // Discount values that create many decimals
          fc.float({ min: Math.fround(0.333), max: Math.fround(999.999), noNaN: true }), // Prices with many decimals
          fc.integer({ min: 1, max: 7 }), // Quantities that multiply to create more decimals
          (discountType, discountValue, itemPrice, quantity) => {
            // Arrange: Create discount with values likely to produce many decimal places
            const discount = createDiscount(discountType, discountValue);

            // Act
            const result = calculator.calculateItemDiscount(discount, itemPrice, quantity);

            // Assert: Property - Even with inputs that produce many decimals, output is rounded to 2
            expect(hasExactlyTwoDecimals(result.originalAmount)).toBe(true);
            expect(hasExactlyTwoDecimals(result.discountAmount)).toBe(true);
            expect(hasExactlyTwoDecimals(result.finalAmount)).toBe(true);

            // Verify the arithmetic still holds with rounding
            const sum = result.discountAmount + result.finalAmount;
            expect(sum).toBeCloseTo(result.originalAmount, 2);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should round monetary values with maximum discount caps', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('percentage' as DiscountType, 'fixed' as DiscountType),
          fc.float({ min: 0, max: 100, noNaN: true }),
          fc.float({ min: Math.fround(10), max: Math.fround(1000), noNaN: true }),
          fc.integer({ min: 1, max: 50 }),
          fc.float({ min: Math.fround(1), max: Math.fround(500), noNaN: true }),
          (discountType, discountValue, itemPrice, quantity, maxDiscountAmount) => {
            // Arrange: Create discount with maximum cap
            const discount = createDiscount(discountType, discountValue, {
              maximumDiscountAmount: maxDiscountAmount, // Not pre-rounded to test rounding
            });

            // Act
            const result = calculator.calculateItemDiscount(discount, itemPrice, quantity);

            // Assert: Property - All monetary values have exactly 2 decimal places
            expect(hasExactlyTwoDecimals(result.originalAmount)).toBe(true);
            expect(hasExactlyTwoDecimals(result.discountAmount)).toBe(true);
            expect(hasExactlyTwoDecimals(result.finalAmount)).toBe(true);

            // Property: Discount respects the rounded maximum cap
            const roundedMaxCap = Math.round(maxDiscountAmount * 100) / 100;
            expect(result.discountAmount).toBeLessThanOrEqual(roundedMaxCap + 0.01);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should maintain rounding consistency across sequential discount applications', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              discountType: fc.constantFrom('percentage' as DiscountType, 'fixed' as DiscountType),
              discountValue: fc.float({ min: 0, max: 50, noNaN: true }),
            }),
            { minLength: 2, maxLength: 5 }
          ),
          fc.float({ min: Math.fround(0.01), max: Math.fround(1000), noNaN: true }),
          fc.integer({ min: 1, max: 50 }),
          (discountConfigs, itemPrice, quantity) => {
            // Arrange: Create multiple combinable discounts
            const discounts = discountConfigs.map((config, index) => {
              const discount = createDiscount(config.discountType, config.discountValue, {
                id: `discount-${index}`,
                name: `Discount ${index}`,
              });
              discount.priority = 100 - index; // Descending priority
              discount.combinable = true;
              return discount;
            });

            // Act
            const result = calculator.applyMultipleDiscounts(discounts, itemPrice, quantity);

            // Assert: Property - All monetary values maintain 2 decimal places through sequential application
            expect(hasExactlyTwoDecimals(result.originalAmount)).toBe(true);
            expect(hasExactlyTwoDecimals(result.discountAmount)).toBe(true);
            expect(hasExactlyTwoDecimals(result.finalAmount)).toBe(true);

            // Property: Each intermediate discount maintains 2 decimal places
            result.appliedDiscounts.forEach((appliedDiscount) => {
              expect(hasExactlyTwoDecimals(appliedDiscount.discountAmount)).toBe(true);
            });

            // Property: Sum of all applied discounts has 2 decimal places
            const totalAppliedDiscount = result.appliedDiscounts.reduce(
              (sum, d) => sum + d.discountAmount,
              0
            );
            expect(hasExactlyTwoDecimals(totalAppliedDiscount)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle edge case: very small amounts still rounded to 2 decimals', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('percentage' as DiscountType, 'fixed' as DiscountType),
          fc.float({ min: 1, max: 10, noNaN: true }),
          fc.float({ min: Math.fround(0.001), max: Math.fround(0.999), noNaN: true }),
          fc.integer({ min: 1, max: 5 }),
          (discountType, discountValue, itemPrice, quantity) => {
            // Arrange: Very small item prices
            const discount = createDiscount(discountType, discountValue);

            // Act
            const result = calculator.calculateItemDiscount(discount, itemPrice, quantity);

            // Assert: Property - Even very small amounts are rounded to 2 decimal places
            expect(hasExactlyTwoDecimals(result.originalAmount)).toBe(true);
            expect(hasExactlyTwoDecimals(result.discountAmount)).toBe(true);
            expect(hasExactlyTwoDecimals(result.finalAmount)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 16: Sequential Discount Application
   * 
   * For any set of combinable discounts, each discount should be applied sequentially
   * to the result of the previous discount calculation. This means that the second
   * discount is applied to the amount after the first discount, the third to the
   * amount after the second, and so on. This is different from parallel application
   * where all discounts would be calculated on the original amount.
   * 
   * **Validates: Requirements 8.5**
   */
  describe('Property 16: Sequential Discount Application', () => {
    it('should apply each discount to the result of the previous discount', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              discountType: fc.constantFrom('percentage' as DiscountType, 'fixed' as DiscountType),
              discountValue: fc.float({ min: 5, max: 30, noNaN: true }),
              priority: fc.integer({ min: 0, max: 100 }),
            }),
            { minLength: 2, maxLength: 5 }
          ),
          fc.float({ min: Math.fround(100), max: Math.fround(1000), noNaN: true }),
          fc.integer({ min: 1, max: 20 }),
          (discountConfigs, itemPrice, quantity) => {
            // Arrange: Create multiple combinable discounts
            const discounts = discountConfigs.map((config, index) => {
              const discount = createDiscount(config.discountType, config.discountValue, {
                id: `discount-${index}`,
                name: `Discount ${index}`,
              });
              discount.priority = config.priority;
              discount.combinable = true; // All combinable for sequential application
              return discount;
            });

            // Act
            const result = calculator.applyMultipleDiscounts(discounts, itemPrice, quantity);

            // Assert: Property - Manually calculate sequential application and verify
            const originalAmount = Math.round(itemPrice * quantity * 100) / 100;
            let expectedCurrentAmount = originalAmount;
            
            // Sort discounts by priority (descending) to match implementation
            const sortedDiscounts = [...discounts].sort((a, b) => b.priority - a.priority);
            
            // Apply each discount sequentially
            for (let i = 0; i < sortedDiscounts.length; i++) {
              const discount = sortedDiscounts[i];
              let discountAmount = 0;

              if (discount.discountType === 'percentage') {
                discountAmount = Math.round((expectedCurrentAmount * discount.discountValue) / 100 * 100) / 100;
              } else {
                discountAmount = Math.min(
                  Math.round(discount.discountValue * 100) / 100,
                  expectedCurrentAmount
                );
              }

              // Ensure discount doesn't exceed current amount
              discountAmount = Math.min(discountAmount, expectedCurrentAmount);
              
              // Update current amount for next iteration
              expectedCurrentAmount = Math.max(0, Math.round((expectedCurrentAmount - discountAmount) * 100) / 100);
            }

            // Property: Final amount should match sequential calculation
            expect(result.finalAmount).toBeCloseTo(expectedCurrentAmount, 2);
            
            // Property: Each applied discount should be applied to remaining amount
            let verifyCurrentAmount = originalAmount;
            result.appliedDiscounts.forEach((appliedDiscount) => {
              // Discount amount should not exceed the current remaining amount
              expect(appliedDiscount.discountAmount).toBeLessThanOrEqual(verifyCurrentAmount + 0.01);
              verifyCurrentAmount = Math.max(0, verifyCurrentAmount - appliedDiscount.discountAmount);
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should produce different results than parallel application for percentage discounts', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.float({ min: 10, max: 40, noNaN: true }),
            { minLength: 2, maxLength: 3 }
          ),
          fc.float({ min: Math.fround(100), max: Math.fround(500), noNaN: true }),
          fc.integer({ min: 1, max: 10 }),
          (discountValues, itemPrice, quantity) => {
            // Arrange: Create multiple percentage discounts with same priority
            const discounts = discountValues.map((value, index) => {
              const discount = createDiscount('percentage', value, {
                id: `discount-${index}`,
                name: `Discount ${index}`,
              });
              discount.priority = 100; // Same priority for all
              discount.combinable = true;
              return discount;
            });

            // Act: Sequential application (actual implementation)
            const sequentialResult = calculator.applyMultipleDiscounts(discounts, itemPrice, quantity);

            // Calculate what parallel application would give
            const originalAmount = Math.round(itemPrice * quantity * 100) / 100;
            const parallelTotalDiscount = discountValues.reduce((sum, value) => {
              return sum + Math.round((originalAmount * value) / 100 * 100) / 100;
            }, 0);
            const parallelFinalAmount = Math.max(0, Math.round((originalAmount - parallelTotalDiscount) * 100) / 100);

            // Property: Sequential application should give a higher final amount than parallel
            // (because each discount is applied to a smaller base)
            // Only check if there are multiple discounts with non-zero values
            const totalDiscountPercentage = discountValues.reduce((sum, v) => sum + v, 0);
            if (totalDiscountPercentage > 10 && discountValues.length >= 2) {
              // Sequential should result in less total discount (higher final amount)
              expect(sequentialResult.finalAmount).toBeGreaterThanOrEqual(parallelFinalAmount - 0.01);
            }

            // Property: Final amount is non-negative
            expect(sequentialResult.finalAmount).toBeGreaterThanOrEqual(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should apply second discount to the amount after first discount', () => {
      fc.assert(
        fc.property(
          fc.float({ min: 10, max: 50, noNaN: true }),
          fc.float({ min: 10, max: 50, noNaN: true }),
          fc.float({ min: Math.fround(100), max: Math.fround(500), noNaN: true }),
          fc.integer({ min: 1, max: 10 }),
          (discount1Value, discount2Value, itemPrice, quantity) => {
            // Arrange: Create two percentage discounts
            const discount1 = createDiscount('percentage', discount1Value, {
              id: 'discount-1',
              name: 'First Discount',
            });
            discount1.priority = 100;
            discount1.combinable = true;

            const discount2 = createDiscount('percentage', discount2Value, {
              id: 'discount-2',
              name: 'Second Discount',
            });
            discount2.priority = 50;
            discount2.combinable = true;

            // Act
            const result = calculator.applyMultipleDiscounts([discount1, discount2], itemPrice, quantity);

            // Assert: Manually calculate sequential application
            const originalAmount = Math.round(itemPrice * quantity * 100) / 100;
            
            // First discount applied to original amount
            const firstDiscountAmount = Math.round((originalAmount * discount1Value) / 100 * 100) / 100;
            const amountAfterFirst = Math.round((originalAmount - firstDiscountAmount) * 100) / 100;
            
            // Second discount applied to amount after first
            const secondDiscountAmount = Math.round((amountAfterFirst * discount2Value) / 100 * 100) / 100;
            const expectedFinalAmount = Math.max(0, Math.round((amountAfterFirst - secondDiscountAmount) * 100) / 100);

            // Property: Final amount matches sequential calculation
            expect(result.finalAmount).toBeCloseTo(expectedFinalAmount, 2);
            
            // Property: If both discounts were applied, verify their amounts
            if (result.appliedDiscounts.length === 2) {
              const appliedFirst = result.appliedDiscounts.find(d => d.discountId === 'discount-1');
              const appliedSecond = result.appliedDiscounts.find(d => d.discountId === 'discount-2');
              
              if (appliedFirst && appliedSecond) {
                // First discount should be larger (applied to original amount)
                // Second discount should be smaller (applied to reduced amount)
                expect(appliedFirst.discountAmount).toBeCloseTo(firstDiscountAmount, 2);
                expect(appliedSecond.discountAmount).toBeCloseTo(secondDiscountAmount, 2);
                
                // Second discount should be less than or equal to what it would be on original
                const secondOnOriginal = Math.round((originalAmount * discount2Value) / 100 * 100) / 100;
                expect(appliedSecond.discountAmount).toBeLessThanOrEqual(secondOnOriginal + 0.01);
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should maintain sequential application with mixed discount types', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              discountType: fc.constantFrom('percentage' as DiscountType, 'fixed' as DiscountType),
              discountValue: fc.float({ min: 5, max: 50, noNaN: true }),
              priority: fc.integer({ min: 0, max: 100 }),
            }),
            { minLength: 2, maxLength: 4 }
          ),
          fc.float({ min: Math.fround(100), max: Math.fround(500), noNaN: true }),
          fc.integer({ min: 1, max: 10 }),
          (discountConfigs, itemPrice, quantity) => {
            // Arrange: Create discounts with mixed types
            const discounts = discountConfigs.map((config, index) => {
              const discount = createDiscount(config.discountType, config.discountValue, {
                id: `discount-${index}`,
                name: `Discount ${index}`,
              });
              discount.priority = config.priority;
              discount.combinable = true;
              return discount;
            });

            // Act
            const result = calculator.applyMultipleDiscounts(discounts, itemPrice, quantity);

            // Assert: Property - Each discount reduces the remaining amount
            let currentAmount = result.originalAmount;
            result.appliedDiscounts.forEach((appliedDiscount) => {
              // Each discount should not exceed the current remaining amount
              expect(appliedDiscount.discountAmount).toBeLessThanOrEqual(currentAmount + 0.01);
              
              // Update current amount
              const newAmount = currentAmount - appliedDiscount.discountAmount;
              
              // Property: Amount should decrease or stay the same (never increase)
              expect(newAmount).toBeLessThanOrEqual(currentAmount + 0.01);
              
              currentAmount = Math.max(0, newAmount);
            });

            // Property: Final amount should equal original minus all applied discounts
            const totalAppliedDiscount = result.appliedDiscounts.reduce(
              (sum, d) => sum + d.discountAmount,
              0
            );
            expect(result.finalAmount).toBeCloseTo(
              Math.max(0, result.originalAmount - totalAppliedDiscount),
              2
            );
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should stop sequential application when amount reaches zero', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              discountType: fc.constantFrom('percentage' as DiscountType, 'fixed' as DiscountType),
              discountValue: fc.float({ min: 50, max: 100, noNaN: true }), // Large discounts
              priority: fc.integer({ min: 0, max: 100 }),
            }),
            { minLength: 3, maxLength: 5 }
          ),
          fc.float({ min: Math.fround(50), max: Math.fround(200), noNaN: true }),
          fc.integer({ min: 1, max: 5 }),
          (discountConfigs, itemPrice, quantity) => {
            // Arrange: Create large discounts that might reduce amount to zero
            const discounts = discountConfigs.map((config, index) => {
              const discount = createDiscount(config.discountType, config.discountValue, {
                id: `discount-${index}`,
                name: `Discount ${index}`,
              });
              discount.priority = config.priority;
              discount.combinable = true;
              return discount;
            });

            // Act
            const result = calculator.applyMultipleDiscounts(discounts, itemPrice, quantity);

            // Assert: Property - If final amount is zero, no further discounts should be applied
            if (result.finalAmount === 0) {
              // Find the index where amount reached zero
              let currentAmount = result.originalAmount;
              let zeroReachedAt = -1;
              
              for (let i = 0; i < result.appliedDiscounts.length; i++) {
                currentAmount -= result.appliedDiscounts[i].discountAmount;
                if (currentAmount <= 0.01) {
                  zeroReachedAt = i;
                  break;
                }
              }
              
              // If zero was reached, all subsequent discounts should have zero amount
              if (zeroReachedAt >= 0) {
                for (let i = zeroReachedAt + 1; i < result.appliedDiscounts.length; i++) {
                  expect(result.appliedDiscounts[i].discountAmount).toBe(0);
                }
              }
            }

            // Property: Final amount is never negative
            expect(result.finalAmount).toBeGreaterThanOrEqual(0);
            
            // Property: Total discount never exceeds original amount
            expect(result.discountAmount).toBeLessThanOrEqual(result.originalAmount + 0.01);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should apply sequential discounts with maximum caps correctly', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              discountType: fc.constantFrom('percentage' as DiscountType, 'fixed' as DiscountType),
              discountValue: fc.float({ min: 10, max: 50, noNaN: true }),
              maxDiscountAmount: fc.float({ min: Math.fround(10), max: Math.fround(100), noNaN: true }),
              priority: fc.integer({ min: 0, max: 100 }),
            }),
            { minLength: 2, maxLength: 4 }
          ),
          fc.float({ min: Math.fround(200), max: Math.fround(500), noNaN: true }),
          fc.integer({ min: 1, max: 10 }),
          (discountConfigs, itemPrice, quantity) => {
            // Arrange: Create discounts with maximum caps
            const discounts = discountConfigs.map((config, index) => {
              const roundedMaxCap = Math.round(config.maxDiscountAmount * 100) / 100;
              const discount = createDiscount(config.discountType, config.discountValue, {
                id: `discount-${index}`,
                name: `Discount ${index}`,
                maximumDiscountAmount: roundedMaxCap,
              });
              discount.priority = config.priority;
              discount.combinable = true;
              return discount;
            });

            // Act
            const result = calculator.applyMultipleDiscounts(discounts, itemPrice, quantity);

            // Assert: Property - Each applied discount respects its maximum cap
            result.appliedDiscounts.forEach((appliedDiscount) => {
              const originalDiscount = discounts.find(d => d.id === appliedDiscount.discountId);
              if (originalDiscount?.eligibilityCriteria?.maximumDiscountAmount) {
                const maxCap = originalDiscount.eligibilityCriteria.maximumDiscountAmount;
                expect(appliedDiscount.discountAmount).toBeLessThanOrEqual(maxCap + 0.01);
              }
            });

            // Property: Sequential application still maintains non-negative final amount
            expect(result.finalAmount).toBeGreaterThanOrEqual(0);
            
            // Property: Each discount is applied to remaining amount (not original)
            let currentAmount = result.originalAmount;
            result.appliedDiscounts.forEach((appliedDiscount) => {
              expect(appliedDiscount.discountAmount).toBeLessThanOrEqual(currentAmount + 0.01);
              currentAmount = Math.max(0, currentAmount - appliedDiscount.discountAmount);
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should maintain arithmetic consistency in sequential application', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              discountType: fc.constantFrom('percentage' as DiscountType, 'fixed' as DiscountType),
              discountValue: fc.float({ min: 5, max: 40, noNaN: true }),
              priority: fc.integer({ min: 0, max: 100 }),
            }),
            { minLength: 2, maxLength: 5 }
          ),
          fc.float({ min: Math.fround(100), max: Math.fround(1000), noNaN: true }),
          fc.integer({ min: 1, max: 20 }),
          (discountConfigs, itemPrice, quantity) => {
            // Arrange: Create combinable discounts
            const discounts = discountConfigs.map((config, index) => {
              const discount = createDiscount(config.discountType, config.discountValue, {
                id: `discount-${index}`,
                name: `Discount ${index}`,
              });
              discount.priority = config.priority;
              discount.combinable = true;
              return discount;
            });

            // Act
            const result = calculator.applyMultipleDiscounts(discounts, itemPrice, quantity);

            // Assert: Property - Original = Final + Total Discount (within rounding tolerance)
            const sum = result.finalAmount + result.discountAmount;
            expect(sum).toBeCloseTo(result.originalAmount, 2);

            // Property: Sum of individual applied discounts equals total discount
            const sumOfApplied = result.appliedDiscounts.reduce(
              (sum, d) => sum + d.discountAmount,
              0
            );
            expect(sumOfApplied).toBeCloseTo(result.discountAmount, 2);

            // Property: All monetary values have 2 decimal places
            const hasMaxTwoDecimals = (value: number): boolean => {
              const rounded = Math.round(value * 100) / 100;
              return Math.abs(value - rounded) < 0.001;
            };
            
            expect(hasMaxTwoDecimals(result.originalAmount)).toBe(true);
            expect(hasMaxTwoDecimals(result.discountAmount)).toBe(true);
            expect(hasMaxTwoDecimals(result.finalAmount)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should apply sequential discounts in cart-level calculations', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              id: fc.uuid(),
              name: fc.string({ minLength: 1, maxLength: 50 }),
              price: fc.float({ min: Math.fround(50), max: Math.fround(200), noNaN: true }),
              quantity: fc.integer({ min: 1, max: 10 }),
            }),
            { minLength: 1, maxLength: 3 }
          ),
          fc.array(
            fc.record({
              discountType: fc.constantFrom('percentage' as DiscountType, 'fixed' as DiscountType),
              discountValue: fc.float({ min: 5, max: 30, noNaN: true }),
              priority: fc.integer({ min: 0, max: 100 }),
            }),
            { minLength: 2, maxLength: 4 }
          ),
          (cartItems, discountConfigs) => {
            // Arrange: Create item-level combinable discounts
            const discounts = discountConfigs.map((config, index) => {
              const discount = createDiscount(config.discountType, config.discountValue, {
                id: `discount-${index}`,
                name: `Discount ${index}`,
              });
              discount.priority = config.priority;
              discount.combinable = true;
              discount.applicationScope = 'item'; // Item-level for sequential application
              return discount;
            });

            // Act
            const result = calculator.calculateCartDiscounts(cartItems, discounts);

            // Assert: Property - Each item has sequential discount application
            result.itemResults.forEach((itemResult) => {
              if (itemResult.appliedDiscounts.length > 1) {
                // Verify sequential application for this item
                let currentAmount = itemResult.originalAmount;
                
                itemResult.appliedDiscounts.forEach((appliedDiscount) => {
                  // Each discount should not exceed current remaining amount
                  expect(appliedDiscount.discountAmount).toBeLessThanOrEqual(currentAmount + 0.01);
                  currentAmount = Math.max(0, currentAmount - appliedDiscount.discountAmount);
                });
                
                // Final amount should match
                expect(itemResult.finalAmount).toBeCloseTo(currentAmount, 2);
              }
            });

            // Property: Final total is non-negative
            expect(result.finalTotal).toBeGreaterThanOrEqual(0);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 14: Priority-Based Ordering
   * 
   * For any set of discounts being applied together, they should be sorted by priority
   * in descending order before application. This ensures that higher priority discounts
   * are always applied first, regardless of the order in which they are provided.
   * 
   * **Validates: Requirements 8.3**
   */
  describe('Property 14: Priority-Based Ordering', () => {
    it('should sort discounts by priority in descending order before application', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              discountType: fc.constantFrom('percentage' as DiscountType, 'fixed' as DiscountType),
              discountValue: fc.float({ min: 1, max: 50, noNaN: true }),
              priority: fc.integer({ min: 0, max: 1000 }),
            }),
            { minLength: 2, maxLength: 10 }
          ),
          fc.float({ min: Math.fround(10), max: Math.fround(1000), noNaN: true }),
          fc.integer({ min: 1, max: 50 }),
          (discountConfigs, itemPrice, quantity) => {
            // Arrange: Create multiple combinable discounts with random priorities
            const discounts = discountConfigs.map((config, index) => {
              const discount = createDiscount(config.discountType, config.discountValue, {
                id: `discount-${index}`,
                name: `Discount ${index}`,
              });
              discount.priority = config.priority;
              discount.combinable = true;
              return discount;
            });

            // Act
            const result = calculator.applyMultipleDiscounts(discounts, itemPrice, quantity);

            // Assert: Property - Applied discounts are in descending priority order
            if (result.appliedDiscounts.length > 1) {
              for (let i = 0; i < result.appliedDiscounts.length - 1; i++) {
                const currentDiscount = discounts.find(
                  d => d.id === result.appliedDiscounts[i].discountId
                );
                const nextDiscount = discounts.find(
                  d => d.id === result.appliedDiscounts[i + 1].discountId
                );

                // Current discount priority should be >= next discount priority
                expect(currentDiscount!.priority).toBeGreaterThanOrEqual(nextDiscount!.priority);
              }
            }

            // Property: All applied discounts should be present in the result
            result.appliedDiscounts.forEach((appliedDiscount) => {
              const originalDiscount = discounts.find(d => d.id === appliedDiscount.discountId);
              expect(originalDiscount).toBeDefined();
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should apply highest priority discount first regardless of input order', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              discountType: fc.constantFrom('percentage' as DiscountType, 'fixed' as DiscountType),
              discountValue: fc.float({ min: 5, max: 30, noNaN: true }),
              priority: fc.integer({ min: 0, max: 100 }),
            }),
            { minLength: 3, maxLength: 5 }
          ),
          fc.float({ min: Math.fround(100), max: Math.fround(500), noNaN: true }),
          fc.integer({ min: 1, max: 10 }),
          (discountConfigs, itemPrice, quantity) => {
            // Arrange: Create discounts with distinct priorities
            const discounts = discountConfigs.map((config, index) => {
              const discount = createDiscount(config.discountType, config.discountValue, {
                id: `discount-${index}`,
                name: `Discount ${index}`,
              });
              discount.priority = config.priority;
              discount.combinable = true;
              return discount;
            });

            // Find the highest priority discount
            const highestPriorityDiscount = discounts.reduce((max, d) =>
              d.priority > max.priority ? d : max
            );

            // Act
            const result = calculator.applyMultipleDiscounts(discounts, itemPrice, quantity);

            // Assert: Property - First applied discount has the highest priority
            if (result.appliedDiscounts.length > 0) {
              const firstAppliedDiscount = discounts.find(
                d => d.id === result.appliedDiscounts[0].discountId
              );
              expect(firstAppliedDiscount!.priority).toBe(highestPriorityDiscount.priority);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should maintain priority order with shuffled input arrays', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              discountType: fc.constantFrom('percentage' as DiscountType, 'fixed' as DiscountType),
              discountValue: fc.float({ min: 5, max: 40, noNaN: true }),
              priority: fc.integer({ min: 0, max: 100 }),
            }),
            { minLength: 3, maxLength: 8 }
          ),
          fc.float({ min: Math.fround(50), max: Math.fround(500), noNaN: true }),
          fc.integer({ min: 1, max: 20 }),
          (discountConfigs, itemPrice, quantity) => {
            // Arrange: Create discounts with unique priorities to ensure deterministic ordering
            const discounts = discountConfigs.map((config, index) => {
              const discount = createDiscount(config.discountType, config.discountValue, {
                id: `discount-${index}`,
                name: `Discount ${index}`,
              });
              // Ensure unique priorities by adding index to avoid ties
              discount.priority = config.priority * 1000 + index;
              discount.combinable = true;
              return discount;
            });

            // Create a shuffled copy
            const shuffledDiscounts = [...discounts].sort(() => Math.random() - 0.5);

            // Act: Apply both original and shuffled
            const result1 = calculator.applyMultipleDiscounts(discounts, itemPrice, quantity);
            const result2 = calculator.applyMultipleDiscounts(shuffledDiscounts, itemPrice, quantity);

            // Assert: Property - Results should be identical regardless of input order
            expect(result1.originalAmount).toBeCloseTo(result2.originalAmount, 2);
            expect(result1.discountAmount).toBeCloseTo(result2.discountAmount, 2);
            expect(result1.finalAmount).toBeCloseTo(result2.finalAmount, 2);

            // Property: Applied discounts should be in the same order (by priority)
            expect(result1.appliedDiscounts.length).toBe(result2.appliedDiscounts.length);
            
            for (let i = 0; i < result1.appliedDiscounts.length; i++) {
              const discount1 = discounts.find(d => d.id === result1.appliedDiscounts[i].discountId);
              const discount2 = discounts.find(d => d.id === result2.appliedDiscounts[i].discountId);
              
              // Same priority at each position
              expect(discount1!.priority).toBe(discount2!.priority);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle discounts with equal priorities consistently', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 100 }),
          fc.array(
            fc.record({
              discountType: fc.constantFrom('percentage' as DiscountType, 'fixed' as DiscountType),
              discountValue: fc.float({ min: 5, max: 30, noNaN: true }),
            }),
            { minLength: 2, maxLength: 5 }
          ),
          fc.float({ min: Math.fround(100), max: Math.fround(500), noNaN: true }),
          fc.integer({ min: 1, max: 10 }),
          (samePriority, discountConfigs, itemPrice, quantity) => {
            // Arrange: Create multiple discounts with the same priority
            const discounts = discountConfigs.map((config, index) => {
              const discount = createDiscount(config.discountType, config.discountValue, {
                id: `discount-${index}`,
                name: `Discount ${index}`,
              });
              discount.priority = samePriority; // All have same priority
              discount.combinable = true;
              return discount;
            });

            // Act
            const result = calculator.applyMultipleDiscounts(discounts, itemPrice, quantity);

            // Assert: Property - All applied discounts have the same priority
            result.appliedDiscounts.forEach((appliedDiscount) => {
              const originalDiscount = discounts.find(d => d.id === appliedDiscount.discountId);
              expect(originalDiscount!.priority).toBe(samePriority);
            });

            // Property: Result is still valid (non-negative, etc.)
            expect(result.finalAmount).toBeGreaterThanOrEqual(0);
            expect(result.discountAmount).toBeLessThanOrEqual(result.originalAmount);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should sort by priority even with extreme priority values', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              discountType: fc.constantFrom('percentage' as DiscountType, 'fixed' as DiscountType),
              discountValue: fc.float({ min: 5, max: 50, noNaN: true }),
              priority: fc.integer({ min: -1000, max: 10000 }), // Extreme range
            }),
            { minLength: 2, maxLength: 7 }
          ),
          fc.float({ min: Math.fround(50), max: Math.fround(1000), noNaN: true }),
          fc.integer({ min: 1, max: 20 }),
          (discountConfigs, itemPrice, quantity) => {
            // Arrange: Create discounts with extreme priority values
            const discounts = discountConfigs.map((config, index) => {
              const discount = createDiscount(config.discountType, config.discountValue, {
                id: `discount-${index}`,
                name: `Discount ${index}`,
              });
              discount.priority = config.priority;
              discount.combinable = true;
              return discount;
            });

            // Act
            const result = calculator.applyMultipleDiscounts(discounts, itemPrice, quantity);

            // Assert: Property - Applied discounts are still in descending priority order
            if (result.appliedDiscounts.length > 1) {
              for (let i = 0; i < result.appliedDiscounts.length - 1; i++) {
                const currentDiscount = discounts.find(
                  d => d.id === result.appliedDiscounts[i].discountId
                );
                const nextDiscount = discounts.find(
                  d => d.id === result.appliedDiscounts[i + 1].discountId
                );

                expect(currentDiscount!.priority).toBeGreaterThanOrEqual(nextDiscount!.priority);
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should apply priority ordering with mixed discount types', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              discountType: fc.constantFrom('percentage' as DiscountType, 'fixed' as DiscountType),
              discountValue: fc.float({ min: 5, max: 100, noNaN: true }),
              priority: fc.integer({ min: 0, max: 100 }),
            }),
            { minLength: 3, maxLength: 6 }
          ),
          fc.float({ min: Math.fround(100), max: Math.fround(500), noNaN: true }),
          fc.integer({ min: 1, max: 20 }),
          (discountConfigs, itemPrice, quantity) => {
            // Arrange: Create discounts with mixed types (percentage and fixed)
            const discounts = discountConfigs.map((config, index) => {
              const discount = createDiscount(config.discountType, config.discountValue, {
                id: `discount-${index}`,
                name: `Discount ${index}`,
              });
              discount.priority = config.priority;
              discount.combinable = true;
              return discount;
            });

            // Act
            const result = calculator.applyMultipleDiscounts(discounts, itemPrice, quantity);

            // Assert: Property - Priority ordering is maintained regardless of discount type
            if (result.appliedDiscounts.length > 1) {
              for (let i = 0; i < result.appliedDiscounts.length - 1; i++) {
                const currentDiscount = discounts.find(
                  d => d.id === result.appliedDiscounts[i].discountId
                );
                const nextDiscount = discounts.find(
                  d => d.id === result.appliedDiscounts[i + 1].discountId
                );

                // Priority order is maintained regardless of type
                expect(currentDiscount!.priority).toBeGreaterThanOrEqual(nextDiscount!.priority);
              }
            }

            // Property: Result is valid
            expect(result.finalAmount).toBeGreaterThanOrEqual(0);
            expect(result.discountAmount).toBeLessThanOrEqual(result.originalAmount);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should maintain priority order when some discounts result in zero discount amount', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              discountType: fc.constantFrom('percentage' as DiscountType, 'fixed' as DiscountType),
              discountValue: fc.float({ min: 0, max: 100, noNaN: true }), // Include 0 values
              priority: fc.integer({ min: 0, max: 100 }),
            }),
            { minLength: 3, maxLength: 6 }
          ),
          fc.float({ min: Math.fround(50), max: Math.fround(500), noNaN: true }),
          fc.integer({ min: 1, max: 20 }),
          (discountConfigs, itemPrice, quantity) => {
            // Arrange: Create discounts, some may result in zero discount
            const discounts = discountConfigs.map((config, index) => {
              const discount = createDiscount(config.discountType, config.discountValue, {
                id: `discount-${index}`,
                name: `Discount ${index}`,
              });
              discount.priority = config.priority;
              discount.combinable = true;
              return discount;
            });

            // Act
            const result = calculator.applyMultipleDiscounts(discounts, itemPrice, quantity);

            // Assert: Property - Applied discounts (those with amount > 0) are in priority order
            if (result.appliedDiscounts.length > 1) {
              for (let i = 0; i < result.appliedDiscounts.length - 1; i++) {
                const currentDiscount = discounts.find(
                  d => d.id === result.appliedDiscounts[i].discountId
                );
                const nextDiscount = discounts.find(
                  d => d.id === result.appliedDiscounts[i + 1].discountId
                );

                expect(currentDiscount!.priority).toBeGreaterThanOrEqual(nextDiscount!.priority);
              }
            }

            // Property: Only discounts with amount > 0 are in appliedDiscounts
            result.appliedDiscounts.forEach((appliedDiscount) => {
              expect(appliedDiscount.discountAmount).toBeGreaterThan(0);
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should apply priority ordering in cart-level calculations', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              id: fc.uuid(),
              name: fc.string({ minLength: 1, maxLength: 50 }),
              price: fc.float({ min: Math.fround(10), max: Math.fround(200), noNaN: true }),
              quantity: fc.integer({ min: 1, max: 20 }),
            }),
            { minLength: 1, maxLength: 5 }
          ),
          fc.array(
            fc.record({
              discountType: fc.constantFrom('percentage' as DiscountType, 'fixed' as DiscountType),
              discountValue: fc.float({ min: 5, max: 50, noNaN: true }),
              priority: fc.integer({ min: 0, max: 100 }),
              applicationScope: fc.constantFrom('item' as ApplicationScope, 'cart' as ApplicationScope),
            }),
            { minLength: 2, maxLength: 5 }
          ),
          (cartItems, discountConfigs) => {
            // Arrange: Create discounts with various priorities and scopes
            const discounts = discountConfigs.map((config, index) => {
              const discount = createDiscount(config.discountType, config.discountValue, {
                id: `discount-${index}`,
                name: `Discount ${index}`,
              });
              discount.priority = config.priority;
              discount.applicationScope = config.applicationScope;
              discount.combinable = true;
              return discount;
            });

            // Act
            const result = calculator.calculateCartDiscounts(cartItems, discounts);

            // Assert: Property - Item-level discounts are applied in priority order
            result.itemResults.forEach((itemResult) => {
              if (itemResult.appliedDiscounts.length > 1) {
                for (let i = 0; i < itemResult.appliedDiscounts.length - 1; i++) {
                  const currentDiscount = discounts.find(
                    d => d.id === itemResult.appliedDiscounts[i].discountId
                  );
                  const nextDiscount = discounts.find(
                    d => d.id === itemResult.appliedDiscounts[i + 1].discountId
                  );

                  expect(currentDiscount!.priority).toBeGreaterThanOrEqual(nextDiscount!.priority);
                }
              }
            });

            // Property: Cart-level discounts are applied in priority order
            if (result.cartLevelDiscounts.length > 1) {
              for (let i = 0; i < result.cartLevelDiscounts.length - 1; i++) {
                const currentDiscount = discounts.find(
                  d => d.id === result.cartLevelDiscounts[i].discountId
                );
                const nextDiscount = discounts.find(
                  d => d.id === result.cartLevelDiscounts[i + 1].discountId
                );

                expect(currentDiscount!.priority).toBeGreaterThanOrEqual(nextDiscount!.priority);
              }
            }

            // Property: Final total is non-negative
            expect(result.finalTotal).toBeGreaterThanOrEqual(0);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});


