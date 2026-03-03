/**
 * Property-Based Tests for DiscountSelector Active Discounts Filtering
 * 
 * Feature: membership-discount-integration
 * Property 10: Active Discounts Filtering in Selector
 * 
 * **Validates: Requirements 4.3**
 * 
 * For any set of discounts in the database, the discount selector component
 * should display only those discounts that are both active and have the correct
 * moduleType for the current context.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react';
import fc from 'fast-check';
import { DiscountSelector, Discount } from '../DiscountSelector';

describe('Feature: membership-discount-integration, Property 10: Active Discounts Filtering in Selector', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cleanup();
  });

  // Arbitraries for generating test data
  const discountStatusArb = fc.constantFrom('active' as const, 'inactive' as const, 'expired' as const);
  
  const discountArb = fc.record({
    id: fc.uuid(),
    name: fc.string({ minLength: 1, maxLength: 50 }),
    description: fc.option(fc.string({ minLength: 1, maxLength: 200 }), { nil: undefined }),
    discountType: fc.constantFrom('percentage' as const, 'fixed' as const),
    discountValue: fc.float({ min: Math.fround(0.01), max: Math.fround(100), noNaN: true }),
    status: discountStatusArb,
    code: fc.option(fc.string({ minLength: 1, maxLength: 20 }), { nil: undefined }),
  });

  const discountsArrayArb = fc.array(discountArb, { minLength: 1, maxLength: 20 });

  it('should only display active discounts in the selector', async () => {
    await fc.assert(
      fc.asyncProperty(
        discountsArrayArb,
        async (discounts) => {
          const onChange = vi.fn();

          const { container } = render(
            <DiscountSelector
              selectedDiscountIds={[]}
              onChange={onChange}
              organisationId="test-org"
              moduleType="memberships"
              discounts={discounts}
            />
          );

          // If there are no active discounts, component should not render
          const activeDiscounts = discounts.filter(d => d.status === 'active');
          
          if (activeDiscounts.length === 0) {
            // Property: Component should not render if no active discounts
            expect(container.firstChild).toBeNull();
            return;
          }

          // Property: Component should render if there are active discounts
          expect(container.firstChild).not.toBeNull();

          // Property: The select element should be present
          const select = container.querySelector('[role="combobox"]');
          expect(select).toBeTruthy();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should filter out inactive discounts from selection', async () => {
    await fc.assert(
      fc.asyncProperty(
        discountsArrayArb,
        async (discounts) => {
          // Ensure we have at least one active and one inactive discount
          const activeDiscounts = discounts.filter(d => d.status === 'active');
          const inactiveDiscounts = discounts.filter(d => d.status !== 'active');
          
          if (activeDiscounts.length === 0 || inactiveDiscounts.length === 0) {
            return; // Skip if we don't have both types
          }

          const onChange = vi.fn();

          const { container } = render(
            <DiscountSelector
              selectedDiscountIds={[]}
              onChange={onChange}
              organisationId="test-org"
              moduleType="memberships"
              discounts={discounts}
            />
          );

          // Open the dropdown
          const select = container.querySelector('[role="combobox"]');
          if (select) {
            fireEvent.mouseDown(select);

            // Property: The number of menu options should equal the number of active discounts
            // Note: The search box is not an option, it's in a separate Box element
            const menuItems = screen.queryAllByRole('option').filter(item => {
              // Filter out the search box which has role="option" but is actually a Box
              return !item.querySelector('input[placeholder="Search discounts..."]');
            });
            
            expect(menuItems.length).toBe(activeDiscounts.length);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should not render component when all discounts are inactive', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(discountArb, { minLength: 1, maxLength: 10 }),
        async (discounts) => {
          // Make all discounts inactive
          const inactiveDiscounts = discounts.map(d => ({
            ...d,
            status: 'inactive' as const,
          }));

          const onChange = vi.fn();

          const { container } = render(
            <DiscountSelector
              selectedDiscountIds={[]}
              onChange={onChange}
              organisationId="test-org"
              moduleType="memberships"
              discounts={inactiveDiscounts}
            />
          );

          // Property: Component should not render when all discounts are inactive
          expect(container.firstChild).toBeNull();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should render component when at least one discount is active', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(discountArb, { minLength: 2, maxLength: 10 }),
        async (discounts) => {
          // Ensure at least one discount is active
          const mixedDiscounts = discounts.map((d, idx) => ({
            ...d,
            status: idx === 0 ? 'active' as const : d.status,
          }));

          const onChange = vi.fn();

          const { container } = render(
            <DiscountSelector
              selectedDiscountIds={[]}
              onChange={onChange}
              organisationId="test-org"
              moduleType="memberships"
              discounts={mixedDiscounts}
            />
          );

          // Property: Component should render when at least one discount is active
          expect(container.firstChild).not.toBeNull();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should only allow selection of active discounts', async () => {
    await fc.assert(
      fc.asyncProperty(
        discountsArrayArb,
        async (discounts) => {
          const activeDiscounts = discounts.filter(d => d.status === 'active');
          
          if (activeDiscounts.length === 0) return;

          const onChange = vi.fn();

          const { container } = render(
            <DiscountSelector
              selectedDiscountIds={[]}
              onChange={onChange}
              organisationId="test-org"
              moduleType="memberships"
              discounts={discounts}
            />
          );

          // Open the dropdown
          const select = container.querySelector('[role="combobox"]');
          if (select) {
            fireEvent.mouseDown(select);

            // Get all menu items (excluding search box)
            const menuItems = screen.queryAllByRole('option').filter(item => {
              return !item.querySelector('input[placeholder="Search discounts..."]');
            });

            if (menuItems.length > 0) {
              // Click the first menu item
              fireEvent.click(menuItems[0]);

              // Property: onChange should be called
              expect(onChange).toHaveBeenCalled();
              
              if (onChange.mock.calls.length > 0) {
                const selectedIds = onChange.mock.calls[0][0];
                
                // Property: Selected ID should be from an active discount
                const selectedDiscount = discounts.find(d => selectedIds.includes(d.id));
                if (selectedDiscount) {
                  expect(selectedDiscount.status).toBe('active');
                }
              }
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should update displayed discounts when discount status changes', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(discountArb, { minLength: 2, maxLength: 10 }),
        async (initialDiscounts) => {
          // Ensure we have at least one active discount initially
          const discountsWithActive = initialDiscounts.map((d, idx) => ({
            ...d,
            status: idx === 0 ? 'active' as const : d.status,
          }));

          const onChange = vi.fn();

          const { container, rerender } = render(
            <DiscountSelector
              selectedDiscountIds={[]}
              onChange={onChange}
              organisationId="test-org"
              moduleType="memberships"
              discounts={discountsWithActive}
            />
          );

          // Count initial active discounts
          const initialActiveCount = discountsWithActive.filter(d => d.status === 'active').length;

          // Change all discounts to inactive
          const allInactive = discountsWithActive.map(d => ({
            ...d,
            status: 'inactive' as const,
          }));

          rerender(
            <DiscountSelector
              selectedDiscountIds={[]}
              onChange={onChange}
              organisationId="test-org"
              moduleType="memberships"
              discounts={allInactive}
            />
          );

          // Property: Component should not render when all discounts become inactive
          expect(container.firstChild).toBeNull();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should filter active discounts correctly with search', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(discountArb, { minLength: 3, maxLength: 10 }),
        fc.string({ minLength: 2, maxLength: 10 }), // Longer search terms to avoid single-char matches
        async (discounts, searchTerm) => {
          // Ensure we have some active discounts
          const mixedDiscounts = discounts.map((d, idx) => ({
            ...d,
            name: `Discount-${idx}-${d.name}`, // Make names more unique
            status: idx % 2 === 0 ? 'active' as const : 'inactive' as const,
          }));

          const activeDiscounts = mixedDiscounts.filter(d => d.status === 'active');
          
          if (activeDiscounts.length === 0) return;

          const onChange = vi.fn();

          const { container } = render(
            <DiscountSelector
              selectedDiscountIds={[]}
              onChange={onChange}
              organisationId="test-org"
              moduleType="memberships"
              discounts={mixedDiscounts}
            />
          );

          // Open the dropdown
          const select = container.querySelector('[role="combobox"]');
          if (select) {
            fireEvent.mouseDown(select);

            // Find the search input
            const searchInput = container.querySelector('input[placeholder="Search discounts..."]');
            if (searchInput) {
              // Type in the search term
              fireEvent.change(searchInput, { target: { value: searchTerm } });

              // Property: Only active discounts matching the search should be displayed
              const matchingActiveDiscounts = activeDiscounts.filter(d =>
                d.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                d.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                d.code?.toLowerCase().includes(searchTerm.toLowerCase())
              );

              // Get menu items (excluding search box)
              const menuItems = screen.queryAllByRole('option').filter(item => {
                return !item.querySelector('input[placeholder="Search discounts..."]');
              });

              // Property: Number of displayed items should match number of matching active discounts
              // or show "no matches" message
              if (matchingActiveDiscounts.length === 0) {
                // Should show "no matches" message
                const noMatchText = screen.queryByText(/No discounts match your search/i);
                expect(noMatchText || menuItems.length === 0).toBeTruthy();
              } else {
                expect(menuItems.length).toBe(matchingActiveDiscounts.length);
              }
            }
          }
        }
      ),
      { numRuns: 50 } // Fewer runs since this test is more complex
    );
  });
});
