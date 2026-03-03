/**
 * Property-Based Tests for DiscountSelector Component
 * 
 * Feature: membership-discount-integration
 * Property 9: Discount Selector Multi-Selection Behavior
 * 
 * **Validates: Requirements 4.4, 4.5, 4.6**
 * 
 * For any set of selected discounts in the discount selector component,
 * the form data should reflect all selections, each selection should appear
 * as a removable chip, and removing a chip should update the form data accordingly.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react';
import fc from 'fast-check';
import { DiscountSelector, Discount } from '../DiscountSelector';

describe('Feature: membership-discount-integration, Property 9: Discount Selector Multi-Selection Behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cleanup();
  });

  // Arbitraries for generating test data
  const discountIdArb = fc.uuid();
  
  const discountArb = fc.record({
    id: fc.uuid(),
    name: fc.string({ minLength: 1, maxLength: 50 }),
    description: fc.option(fc.string({ minLength: 1, maxLength: 200 }), { nil: undefined }),
    discountType: fc.constantFrom('percentage' as const, 'fixed' as const),
    discountValue: fc.float({ min: Math.fround(0.01), max: Math.fround(100), noNaN: true }),
    status: fc.constant('active' as const), // Only active discounts for selector
    code: fc.option(fc.string({ minLength: 1, maxLength: 20 }), { nil: undefined }),
  });

  const discountsArrayArb = fc.array(discountArb, { minLength: 1, maxLength: 10 });

  it('should reflect all selections in form data', async () => {
    await fc.assert(
      fc.asyncProperty(
        discountsArrayArb,
        fc.array(fc.nat(), { minLength: 0, maxLength: 5 }),
        async (discounts, selectedIndices) => {
          // Map indices to actual discount IDs (with bounds checking)
          const validIndices = selectedIndices.filter(idx => idx < discounts.length);
          const selectedIds = validIndices.map(idx => discounts[idx].id);
          
          const onChange = vi.fn();

          const { container } = render(
            <DiscountSelector
              selectedDiscountIds={selectedIds}
              onChange={onChange}
              organisationId="test-org"
              moduleType="memberships"
              discounts={discounts}
            />
          );

          // Verify the component reflects the selected IDs
          // Count the chips displayed
          const chips = container.querySelectorAll('.MuiChip-root');
          
          // Property: Number of chips should equal number of selected IDs
          expect(chips.length).toBe(selectedIds.length);

          // Property: Each selected discount should have a corresponding chip
          selectedIds.forEach(id => {
            const discount = discounts.find(d => d.id === id);
            if (discount) {
              // Check that the discount name appears in a chip
              const chipWithName = Array.from(chips).find(chip => 
                chip.textContent?.includes(discount.name)
              );
              expect(chipWithName).toBeTruthy();
            }
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should display each selection as a removable chip', async () => {
    await fc.assert(
      fc.asyncProperty(
        discountsArrayArb,
        fc.array(fc.nat(), { minLength: 1, maxLength: 5 }),
        async (discounts, selectedIndices) => {
          // Map indices to actual discount IDs (with bounds checking)
          const validIndices = selectedIndices.filter(idx => idx < discounts.length);
          if (validIndices.length === 0) return; // Skip if no valid selections
          
          const selectedIds = validIndices.map(idx => discounts[idx].id);
          
          const onChange = vi.fn();

          const { container } = render(
            <DiscountSelector
              selectedDiscountIds={selectedIds}
              onChange={onChange}
              organisationId="test-org"
              moduleType="memberships"
              discounts={discounts}
            />
          );

          // Property: Each chip should have a delete button
          const chips = container.querySelectorAll('.MuiChip-root');
          expect(chips.length).toBe(selectedIds.length);

          chips.forEach(chip => {
            // Each chip should have a delete icon/button
            const deleteButton = chip.querySelector('[data-testid="CancelIcon"]') || 
                                 chip.querySelector('.MuiChip-deleteIcon');
            expect(deleteButton).toBeTruthy();
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should update form data when a chip is removed', async () => {
    await fc.assert(
      fc.asyncProperty(
        discountsArrayArb,
        fc.array(fc.nat(), { minLength: 2, maxLength: 5 }),
        async (discounts, selectedIndices) => {
          // Map indices to actual discount IDs (with bounds checking)
          const validIndices = selectedIndices.filter(idx => idx < discounts.length);
          if (validIndices.length < 2) return; // Need at least 2 selections to test removal
          
          const selectedIds = validIndices.map(idx => discounts[idx].id);
          
          const onChange = vi.fn();

          const { container } = render(
            <DiscountSelector
              selectedDiscountIds={selectedIds}
              onChange={onChange}
              organisationId="test-org"
              moduleType="memberships"
              discounts={discounts}
            />
          );

          // Get the first chip's delete button
          const chips = container.querySelectorAll('.MuiChip-root');
          const firstChip = chips[0];
          const deleteButton = firstChip.querySelector('[data-testid="CancelIcon"]') || 
                               firstChip.querySelector('.MuiChip-deleteIcon');

          if (deleteButton) {
            // Click the delete button
            fireEvent.click(deleteButton);

            // Property: onChange should be called with the remaining IDs
            expect(onChange).toHaveBeenCalled();
            
            const calledWith = onChange.mock.calls[0][0];
            
            // Property: The removed ID should not be in the new array
            expect(calledWith.length).toBe(selectedIds.length - 1);
            
            // Property: All remaining IDs should still be present
            const removedId = selectedIds.find(id => !calledWith.includes(id));
            expect(removedId).toBeTruthy();
            
            // Property: No new IDs should be added
            calledWith.forEach((id: string) => {
              expect(selectedIds).toContain(id);
            });
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should maintain selection order when removing chips', async () => {
    await fc.assert(
      fc.asyncProperty(
        discountsArrayArb,
        fc.array(fc.nat(), { minLength: 3, maxLength: 5 }),
        fc.nat(),
        async (discounts, selectedIndices, removeIndexRaw) => {
          // Map indices to actual discount IDs (with bounds checking)
          const validIndices = selectedIndices.filter(idx => idx < discounts.length);
          if (validIndices.length < 3) return; // Need at least 3 selections
          
          const selectedIds = validIndices.map(idx => discounts[idx].id);
          const removeIndex = removeIndexRaw % selectedIds.length;
          
          const onChange = vi.fn();

          const { container } = render(
            <DiscountSelector
              selectedDiscountIds={selectedIds}
              onChange={onChange}
              organisationId="test-org"
              moduleType="memberships"
              discounts={discounts}
            />
          );

          // Get the chip at removeIndex
          const chips = container.querySelectorAll('.MuiChip-root');
          const chipToRemove = chips[removeIndex];
          const deleteButton = chipToRemove.querySelector('[data-testid="CancelIcon"]') || 
                               chipToRemove.querySelector('.MuiChip-deleteIcon');

          if (deleteButton) {
            fireEvent.click(deleteButton);

            expect(onChange).toHaveBeenCalled();
            const calledWith = onChange.mock.calls[0][0];

            // Property: The order of remaining elements should be preserved
            const expectedIds = selectedIds.filter((_, idx) => idx !== removeIndex);
            expect(calledWith).toEqual(expectedIds);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle removing all chips one by one', async () => {
    await fc.assert(
      fc.asyncProperty(
        discountsArrayArb,
        fc.array(fc.nat(), { minLength: 1, maxLength: 5 }),
        async (discounts, selectedIndices) => {
          // Map indices to actual discount IDs (with bounds checking)
          const validIndices = selectedIndices.filter(idx => idx < discounts.length);
          if (validIndices.length === 0) return;
          
          let currentSelectedIds = validIndices.map(idx => discounts[idx].id);
          
          // Remove chips one by one
          while (currentSelectedIds.length > 0) {
            const onChange = vi.fn();

            const { container } = render(
              <DiscountSelector
                selectedDiscountIds={currentSelectedIds}
                onChange={onChange}
                organisationId="test-org"
                moduleType="memberships"
                discounts={discounts}
              />
            );

            const chips = container.querySelectorAll('.MuiChip-root');
            
            // Property: Number of chips should match current selection
            expect(chips.length).toBe(currentSelectedIds.length);

            // Remove the first chip
            const firstChip = chips[0];
            const deleteButton = firstChip.querySelector('[data-testid="CancelIcon"]') || 
                                 firstChip.querySelector('.MuiChip-deleteIcon');

            if (deleteButton) {
              fireEvent.click(deleteButton);
              
              expect(onChange).toHaveBeenCalled();
              const newIds = onChange.mock.calls[0][0];
              
              // Property: Should have one less ID
              expect(newIds.length).toBe(currentSelectedIds.length - 1);
              
              // Update for next iteration
              currentSelectedIds = newIds;
            } else {
              break;
            }

            cleanup();
          }

          // Property: Eventually all chips should be removed
          expect(currentSelectedIds.length).toBe(0);
        }
      ),
      { numRuns: 50 } // Fewer runs since this test does multiple iterations
    );
  });

  it('should not allow chip removal when disabled', async () => {
    await fc.assert(
      fc.asyncProperty(
        discountsArrayArb,
        fc.array(fc.nat(), { minLength: 1, maxLength: 5 }),
        async (discounts, selectedIndices) => {
          // Map indices to actual discount IDs (with bounds checking)
          const validIndices = selectedIndices.filter(idx => idx < discounts.length);
          if (validIndices.length === 0) return;
          
          const selectedIds = validIndices.map(idx => discounts[idx].id);
          
          const onChange = vi.fn();

          const { container } = render(
            <DiscountSelector
              selectedDiscountIds={selectedIds}
              onChange={onChange}
              organisationId="test-org"
              moduleType="memberships"
              discounts={discounts}
              disabled={true}
            />
          );

          // Property: Chips should not have delete buttons when disabled
          const chips = container.querySelectorAll('.MuiChip-root');
          
          chips.forEach(chip => {
            const deleteButton = chip.querySelector('[data-testid="CancelIcon"]') || 
                                 chip.querySelector('.MuiChip-deleteIcon');
            // When disabled, chips should not have delete buttons
            expect(deleteButton).toBeNull();
          });

          // Property: onChange should not be called
          expect(onChange).not.toHaveBeenCalled();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should display correct discount information in chips', async () => {
    await fc.assert(
      fc.asyncProperty(
        discountsArrayArb,
        fc.array(fc.nat(), { minLength: 1, maxLength: 5 }),
        async (discounts, selectedIndices) => {
          // Map indices to actual discount IDs (with bounds checking)
          const validIndices = selectedIndices.filter(idx => idx < discounts.length);
          if (validIndices.length === 0) return;
          
          const selectedIds = validIndices.map(idx => discounts[idx].id);
          
          const onChange = vi.fn();

          const { container } = render(
            <DiscountSelector
              selectedDiscountIds={selectedIds}
              onChange={onChange}
              organisationId="test-org"
              moduleType="memberships"
              discounts={discounts}
            />
          );

          // Property: Each chip should display the discount name and value
          selectedIds.forEach(id => {
            const discount = discounts.find(d => d.id === id);
            if (discount) {
              const chips = container.querySelectorAll('.MuiChip-root');
              const chipWithDiscount = Array.from(chips).find(chip => 
                chip.textContent?.includes(discount.name)
              );
              
              expect(chipWithDiscount).toBeTruthy();
              
              // Check that the value is displayed correctly
              const expectedValue = discount.discountType === 'percentage'
                ? `${discount.discountValue}%`
                : `$${discount.discountValue.toFixed(2)}`;
              
              expect(chipWithDiscount?.textContent).toContain(expectedValue);
            }
          });
        }
      ),
      { numRuns: 100 }
    );
  });
});
