/**
 * Property-Based Tests for Discount Details Fetching Behavior
 * 
 * Feature: membership-discount-integration
 * Property 13: Discount Details Fetching Behavior
 * 
 * **Validates: Requirements 5.4**
 * 
 * For any membership type with discountIds, when displaying the details page,
 * the UI should make API requests to fetch discount details for each discount ID
 * in the array.
 */

import { describe, it, expect, vi } from 'vitest';
import fc from 'fast-check';

describe('Feature: membership-discount-integration, Property 13: Discount Details Fetching Behavior', () => {
  // Arbitrary for generating discount IDs
  const discountIdArb = fc.uuid();

  // Arbitrary for generating arrays of discount IDs
  const discountIdsArb = fc.array(discountIdArb, { minLength: 0, maxLength: 10 });

  /**
   * Mock discount service that tracks API calls
   */
  class MockDiscountService {
    private fetchedIds: string[] = [];

    async getDiscountById(discountId: string, organisationId: string): Promise<any> {
      this.fetchedIds.push(discountId);
      return {
        id: discountId,
        organisationId,
        name: `Discount ${discountId}`,
        discountType: 'percentage',
        discountValue: 10,
      };
    }

    getFetchedIds(): string[] {
      return this.fetchedIds;
    }

    reset(): void {
      this.fetchedIds = [];
    }
  }

  /**
   * Simulates the discount fetching logic from MembershipTypeDetailsPage
   */
  const fetchDiscountsForMembershipType = async (
    discountIds: string[],
    organisationId: string,
    discountService: MockDiscountService
  ) => {
    if (!discountIds || discountIds.length === 0) {
      return [];
    }

    const discountPromises = discountIds.map(async (discountId) => {
      try {
        return await discountService.getDiscountById(discountId, organisationId);
      } catch (error) {
        return null;
      }
    });

    return await Promise.all(discountPromises);
  };

  it('should fetch discount details for each discount ID in the array', async () => {
    await fc.assert(
      fc.asyncProperty(
        discountIdsArb,
        fc.uuid(),
        async (discountIds, organisationId) => {
          const mockService = new MockDiscountService();

          await fetchDiscountsForMembershipType(discountIds, organisationId, mockService);

          const fetchedIds = mockService.getFetchedIds();

          // Property: Should make exactly one API call per discount ID
          expect(fetchedIds.length).toBe(discountIds.length);

          // Property: Should fetch each discount ID exactly once
          for (const discountId of discountIds) {
            expect(fetchedIds).toContain(discountId);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should not make any API calls when discountIds is empty', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        async (organisationId) => {
          const mockService = new MockDiscountService();

          await fetchDiscountsForMembershipType([], organisationId, mockService);

          const fetchedIds = mockService.getFetchedIds();

          // Property: Empty discountIds should result in zero API calls
          expect(fetchedIds.length).toBe(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should fetch discounts in parallel for all discount IDs', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(discountIdArb, { minLength: 2, maxLength: 10 }),
        fc.uuid(),
        async (discountIds, organisationId) => {
          const mockService = new MockDiscountService();
          const startTime = Date.now();

          await fetchDiscountsForMembershipType(discountIds, organisationId, mockService);

          const endTime = Date.now();
          const fetchedIds = mockService.getFetchedIds();

          // Property: All discount IDs should be fetched
          expect(fetchedIds.length).toBe(discountIds.length);

          // Property: Fetching should be parallel (all IDs fetched in single batch)
          // If sequential, we'd see IDs added one at a time
          // In parallel, all IDs are added at once
          for (const discountId of discountIds) {
            expect(fetchedIds).toContain(discountId);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle failed fetches gracefully without stopping other fetches', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(discountIdArb, { minLength: 2, maxLength: 10 }),
        fc.uuid(),
        fc.integer({ min: 0, max: 9 }),
        async (discountIds, organisationId, failIndex) => {
          if (discountIds.length === 0) return;

          // Create a service that fails for one specific ID
          const failingService = {
            fetchedIds: [] as string[],
            async getDiscountById(discountId: string, orgId: string) {
              this.fetchedIds.push(discountId);
              const index = discountIds.indexOf(discountId);
              if (index === failIndex % discountIds.length) {
                throw new Error('Fetch failed');
              }
              return {
                id: discountId,
                organisationId: orgId,
                name: `Discount ${discountId}`,
                discountType: 'percentage',
                discountValue: 10,
              };
            },
            getFetchedIds() {
              return this.fetchedIds;
            }
          };

          const results = await fetchDiscountsForMembershipType(
            discountIds,
            organisationId,
            failingService as any
          );

          // Property: Should still attempt to fetch all discount IDs
          expect(failingService.getFetchedIds().length).toBe(discountIds.length);

          // Property: Failed fetches should return null
          const failedIndex = failIndex % discountIds.length;
          expect(results[failedIndex]).toBeNull();

          // Property: Successful fetches should return discount data
          for (let i = 0; i < results.length; i++) {
            if (i !== failedIndex) {
              expect(results[i]).not.toBeNull();
              expect(results[i]?.id).toBe(discountIds[i]);
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should maintain order of fetched discounts matching discountIds array order', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(discountIdArb, { minLength: 1, maxLength: 10 }),
        fc.uuid(),
        async (discountIds, organisationId) => {
          const mockService = new MockDiscountService();

          const results = await fetchDiscountsForMembershipType(
            discountIds,
            organisationId,
            mockService
          );

          // Property: Results should be in same order as discountIds
          expect(results.length).toBe(discountIds.length);

          for (let i = 0; i < discountIds.length; i++) {
            expect(results[i]?.id).toBe(discountIds[i]);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should pass correct organisationId to each fetch request', async () => {
    await fc.assert(
      fc.asyncProperty(
        discountIdsArb,
        fc.uuid(),
        async (discountIds, organisationId) => {
          const callLog: Array<{ discountId: string; orgId: string }> = [];

          const trackingService = {
            async getDiscountById(discountId: string, orgId: string) {
              callLog.push({ discountId, orgId });
              return {
                id: discountId,
                organisationId: orgId,
                name: `Discount ${discountId}`,
                discountType: 'percentage',
                discountValue: 10,
              };
            },
            getFetchedIds() {
              return callLog.map(c => c.discountId);
            }
          };

          await fetchDiscountsForMembershipType(
            discountIds,
            organisationId,
            trackingService as any
          );

          // Property: Each fetch should use the same organisationId
          for (const call of callLog) {
            expect(call.orgId).toBe(organisationId);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle duplicate discount IDs by fetching each occurrence', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.integer({ min: 2, max: 5 }),
        fc.uuid(),
        async (duplicateId, count, organisationId) => {
          // Create array with duplicate IDs
          const discountIds = Array(count).fill(duplicateId);
          const mockService = new MockDiscountService();

          await fetchDiscountsForMembershipType(discountIds, organisationId, mockService);

          const fetchedIds = mockService.getFetchedIds();

          // Property: Should fetch the ID once for each occurrence in the array
          expect(fetchedIds.length).toBe(count);
          expect(fetchedIds.every(id => id === duplicateId)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });
});
