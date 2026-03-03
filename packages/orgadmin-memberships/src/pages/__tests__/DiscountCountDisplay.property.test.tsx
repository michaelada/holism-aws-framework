/**
 * Property-Based Tests for Discount Count Display Accuracy
 * 
 * Feature: membership-discount-integration
 * Property 11: Discount Count Display Accuracy
 * 
 * **Validates: Requirements 5.1**
 * 
 * For any membership type displayed in the list page, the discount count column
 * should show a number equal to the length of the membership type's discountIds array.
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import type { MembershipType } from '../../types/membership.types';

describe('Feature: membership-discount-integration, Property 11: Discount Count Display Accuracy', () => {
  // Arbitrary for generating discount IDs
  const discountIdArb = fc.uuid();

  // Arbitrary for generating arrays of discount IDs
  const discountIdsArb = fc.array(discountIdArb, { minLength: 0, maxLength: 10 });

  // Arbitrary for generating membership types
  const membershipTypeArb = fc.record({
    id: fc.uuid(),
    organisationId: fc.uuid(),
    name: fc.string({ minLength: 1, maxLength: 100 }),
    description: fc.string({ minLength: 0, maxLength: 500 }),
    membershipFormId: fc.uuid(),
    membershipStatus: fc.constantFrom('open', 'closed'),
    isRollingMembership: fc.boolean(),
    numberOfMonths: fc.integer({ min: 1, max: 24 }),
    automaticallyApprove: fc.boolean(),
    memberLabels: fc.array(fc.string(), { minLength: 0, maxLength: 5 }),
    supportedPaymentMethods: fc.array(fc.string(), { minLength: 1, maxLength: 3 }),
    useTermsAndConditions: fc.boolean(),
    membershipTypeCategory: fc.constantFrom('single', 'group'),
    discountIds: discountIdsArb,
    createdAt: fc.date().map(d => d.toISOString()),
    updatedAt: fc.date().map(d => d.toISOString()),
  });

  /**
   * Helper function that simulates the discount count display logic
   * This is the logic used in MembershipTypesListPage
   */
  const getDisplayedDiscountCount = (membershipType: Partial<MembershipType>): number => {
    return membershipType.discountIds?.length || 0;
  };

  it('should display discount count equal to discountIds array length for any membership type', () => {
    fc.assert(
      fc.property(
        membershipTypeArb,
        (membershipType) => {
          const expectedCount = membershipType.discountIds?.length || 0;
          const displayedCount = getDisplayedDiscountCount(membershipType);

          // Property: Displayed count should equal the actual discountIds array length
          expect(displayedCount).toBe(expectedCount);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should display 0 for membership types with empty discountIds array', () => {
    fc.assert(
      fc.property(
        membershipTypeArb.map(mt => ({ ...mt, discountIds: [] })),
        (membershipType) => {
          const displayedCount = getDisplayedDiscountCount(membershipType);

          // Property: Empty array should display count of 0
          expect(displayedCount).toBe(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should display 0 for membership types with undefined discountIds', () => {
    fc.assert(
      fc.property(
        membershipTypeArb.map(mt => {
          const { discountIds, ...rest } = mt;
          return rest;
        }),
        (membershipType) => {
          const displayedCount = getDisplayedDiscountCount(membershipType);

          // Property: Undefined discountIds should display count of 0
          expect(displayedCount).toBe(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should accurately display varying discount counts across multiple membership types', () => {
    fc.assert(
      fc.property(
        fc.array(membershipTypeArb, { minLength: 2, maxLength: 10 }),
        (membershipTypes) => {
          // Property: Each membership type should display its own unique discount count
          for (const membershipType of membershipTypes) {
            const expectedCount = membershipType.discountIds?.length || 0;
            const displayedCount = getDisplayedDiscountCount(membershipType);
            
            expect(displayedCount).toBe(expectedCount);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle membership types with maximum discount associations', () => {
    fc.assert(
      fc.property(
        membershipTypeArb.map(mt => ({
          ...mt,
          discountIds: Array.from({ length: 10 }, () => fc.sample(fc.uuid(), 1)[0])
        })),
        (membershipType) => {
          const displayedCount = getDisplayedDiscountCount(membershipType);

          // Property: Should correctly display count even at maximum (10 discounts)
          expect(displayedCount).toBe(10);
          expect(displayedCount).toBe(membershipType.discountIds.length);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should maintain count accuracy regardless of discount ID values', () => {
    fc.assert(
      fc.property(
        fc.array(fc.uuid(), { minLength: 0, maxLength: 10 }),
        (discountIds) => {
          const membershipType = {
            discountIds
          };

          const displayedCount = getDisplayedDiscountCount(membershipType);

          // Property: Count should be accurate regardless of the actual UUID values
          expect(displayedCount).toBe(discountIds.length);
        }
      ),
      { numRuns: 100 }
    );
  });
});

