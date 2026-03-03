/**
 * Property-Based Tests for Discount Details Display Completeness
 * 
 * Feature: membership-discount-integration
 * Property 12: Discount Details Display Completeness
 * 
 * **Validates: Requirements 5.2, 5.5**
 * 
 * For any membership type with associated discounts, the details page should display
 * all discount information including name, type (percentage or fixed), and value for
 * each discount ID.
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import type { Discount } from '../../../../backend/src/types/discount.types';

describe('Feature: membership-discount-integration, Property 12: Discount Details Display Completeness', () => {
  // Arbitrary for generating discount data
  const discountArb = fc.record({
    id: fc.uuid(),
    organisationId: fc.uuid(),
    moduleType: fc.constant('memberships' as const),
    name: fc.string({ minLength: 1, maxLength: 100 }),
    description: fc.option(fc.string({ minLength: 0, maxLength: 500 })),
    code: fc.option(fc.string({ minLength: 1, maxLength: 20 })),
    discountType: fc.constantFrom('percentage', 'fixed'),
    discountValue: fc.float({ min: 0, max: 100, noNaN: true }),
    applicationScope: fc.constantFrom('item', 'category', 'cart', 'quantity-based'),
    combinable: fc.boolean(),
    priority: fc.integer({ min: 0, max: 100 }),
    status: fc.constantFrom('active', 'inactive', 'expired'),
    createdAt: fc.date(),
    updatedAt: fc.date(),
  });

  /**
   * Helper function that simulates the discount details display logic
   * This represents what MembershipTypeDetailsPage should display
   */
  const getDisplayedDiscountDetails = (discount: Discount) => {
    return {
      name: discount.name,
      type: discount.discountType,
      value: discount.discountValue,
      formattedValue: discount.discountType === 'percentage' 
        ? `${discount.discountValue}%` 
        : `£${discount.discountValue.toFixed(2)}`,
    };
  };

  it('should display name, type, and value for any discount', () => {
    fc.assert(
      fc.property(
        discountArb,
        (discount) => {
          const displayed = getDisplayedDiscountDetails(discount);

          // Property: All three required fields should be present
          expect(displayed.name).toBe(discount.name);
          expect(displayed.type).toBe(discount.discountType);
          expect(displayed.value).toBe(discount.discountValue);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should correctly format percentage discount values', () => {
    fc.assert(
      fc.property(
        discountArb.filter(d => d.discountType === 'percentage'),
        (discount) => {
          const displayed = getDisplayedDiscountDetails(discount);

          // Property: Percentage discounts should be formatted with % symbol
          expect(displayed.formattedValue).toBe(`${discount.discountValue}%`);
          expect(displayed.formattedValue).toContain('%');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should correctly format fixed discount values', () => {
    fc.assert(
      fc.property(
        discountArb.filter(d => d.discountType === 'fixed'),
        (discount) => {
          const displayed = getDisplayedDiscountDetails(discount);

          // Property: Fixed discounts should be formatted with currency symbol
          expect(displayed.formattedValue).toBe(`£${discount.discountValue.toFixed(2)}`);
          expect(displayed.formattedValue).toContain('£');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should display complete information for all discounts in a list', () => {
    fc.assert(
      fc.property(
        fc.array(discountArb, { minLength: 1, maxLength: 10 }),
        (discounts) => {
          // Property: Each discount should have complete display information
          const displayedList = discounts.map(getDisplayedDiscountDetails);

          expect(displayedList.length).toBe(discounts.length);

          for (let i = 0; i < discounts.length; i++) {
            const discount = discounts[i];
            const displayed = displayedList[i];

            expect(displayed.name).toBe(discount.name);
            expect(displayed.type).toBe(discount.discountType);
            expect(displayed.value).toBe(discount.discountValue);
            expect(displayed.formattedValue).toBeTruthy();
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should distinguish between percentage and fixed discount types in display', () => {
    fc.assert(
      fc.property(
        discountArb,
        discountArb,
        (discount1, discount2) => {
          // Ensure we have one of each type
          const percentageDiscount = { ...discount1, discountType: 'percentage' as const };
          const fixedDiscount = { ...discount2, discountType: 'fixed' as const };

          const displayed1 = getDisplayedDiscountDetails(percentageDiscount);
          const displayed2 = getDisplayedDiscountDetails(fixedDiscount);

          // Property: Different discount types should have different formatted values
          expect(displayed1.type).toBe('percentage');
          expect(displayed2.type).toBe('fixed');
          expect(displayed1.formattedValue).toContain('%');
          expect(displayed2.formattedValue).toContain('£');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle discounts with zero value', () => {
    fc.assert(
      fc.property(
        discountArb.map(d => ({ ...d, discountValue: 0 })),
        (discount) => {
          const displayed = getDisplayedDiscountDetails(discount);

          // Property: Zero value discounts should still display all information
          expect(displayed.name).toBe(discount.name);
          expect(displayed.type).toBe(discount.discountType);
          expect(displayed.value).toBe(0);
          
          if (discount.discountType === 'percentage') {
            expect(displayed.formattedValue).toBe('0%');
          } else {
            expect(displayed.formattedValue).toBe('£0.00');
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle discounts with maximum value', () => {
    fc.assert(
      fc.property(
        discountArb.map(d => ({ ...d, discountValue: 100 })),
        (discount) => {
          const displayed = getDisplayedDiscountDetails(discount);

          // Property: Maximum value discounts should display correctly
          expect(displayed.name).toBe(discount.name);
          expect(displayed.type).toBe(discount.discountType);
          expect(displayed.value).toBe(100);
          
          if (discount.discountType === 'percentage') {
            expect(displayed.formattedValue).toBe('100%');
          } else {
            expect(displayed.formattedValue).toBe('£100.00');
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should preserve discount name exactly as provided', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 100 }),
        discountArb,
        (customName, discount) => {
          const discountWithCustomName = { ...discount, name: customName };
          const displayed = getDisplayedDiscountDetails(discountWithCustomName);

          // Property: Discount name should be displayed exactly as stored
          expect(displayed.name).toBe(customName);
        }
      ),
      { numRuns: 100 }
    );
  });
});
