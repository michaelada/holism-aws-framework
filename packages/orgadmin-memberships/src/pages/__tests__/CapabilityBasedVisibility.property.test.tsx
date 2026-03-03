/**
 * Property-Based Tests for Capability-Based Component Visibility
 * 
 * Feature: membership-discount-integration
 * Property 8: Capability-Based Component Visibility
 * 
 * **Validates: Requirements 1.4, 4.7**
 * 
 * For any organization and any component requiring the 'entry-discounts' capability,
 * the component should be visible if and only if the organization has that capability enabled.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import fc from 'fast-check';
import CreateSingleMembershipTypePage from '../CreateSingleMembershipTypePage';
import CreateGroupMembershipTypePage from '../CreateGroupMembershipTypePage';

// Mock the dependencies
vi.mock('@aws-web-framework/orgadmin-shell', () => ({
  useCapabilities: vi.fn(),
}));

vi.mock('@aws-web-framework/orgadmin-core', () => ({
  useOrganisation: vi.fn(),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => vi.fn(),
    useParams: () => ({}),
  };
});

import { useCapabilities } from '@aws-web-framework/orgadmin-shell';
import { useOrganisation } from '@aws-web-framework/orgadmin-core';

describe('Feature: membership-discount-integration, Property 8: Capability-Based Component Visibility', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  // Arbitrary for generating organization data
  const organisationArb = fc.record({
    id: fc.uuid(),
    name: fc.string({ minLength: 1, maxLength: 100 }),
    enabledCapabilities: fc.array(fc.string(), { minLength: 0, maxLength: 10 }),
  });

  // Arbitrary for generating capability arrays that may or may not include 'entry-discounts'
  const capabilitiesArb = fc.oneof(
    fc.constant(['entry-discounts']), // Has the capability
    fc.constant([]), // No capabilities
    fc.array(fc.string().filter(s => s !== 'entry-discounts'), { minLength: 0, maxLength: 5 }) // Other capabilities
  );

  it('should show discount selector in single membership form if and only if entry-discounts capability is enabled', async () => {
    await fc.assert(
      fc.asyncProperty(
        organisationArb,
        capabilitiesArb,
        async (organisation, capabilities) => {
          const hasEntryDiscounts = capabilities.includes('entry-discounts');

          // Mock the hooks
          vi.mocked(useCapabilities).mockReturnValue({
            capabilities,
            loading: false,
            error: null,
            hasCapability: (cap: string) => capabilities.includes(cap),
            refetch: vi.fn(),
          });

          vi.mocked(useOrganisation).mockReturnValue({
            organisation,
            loading: false,
            error: null,
            refetch: vi.fn(),
          });

          const { container } = render(
            <MemoryRouter>
              <CreateSingleMembershipTypePage />
            </MemoryRouter>
          );

          // Look for the specific discount selector helper text (unique to the discount section)
          const discountHelperText = screen.queryByText(/Select discounts that will be available for this membership type/i);

          // Property: Discount section should be visible if and only if capability is enabled
          if (hasEntryDiscounts) {
            expect(discountHelperText).not.toBeNull();
          } else {
            // When capability is not enabled, discount section should not be visible
            expect(discountHelperText).toBeNull();
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should show discount selector in group membership form if and only if entry-discounts capability is enabled', async () => {
    await fc.assert(
      fc.asyncProperty(
        organisationArb,
        capabilitiesArb,
        async (organisation, capabilities) => {
          const hasEntryDiscounts = capabilities.includes('entry-discounts');

          // Mock the hooks
          vi.mocked(useCapabilities).mockReturnValue({
            capabilities,
            loading: false,
            error: null,
            hasCapability: (cap: string) => capabilities.includes(cap),
            refetch: vi.fn(),
          });

          vi.mocked(useOrganisation).mockReturnValue({
            organisation,
            loading: false,
            error: null,
            refetch: vi.fn(),
          });

          const { container } = render(
            <MemoryRouter>
              <CreateGroupMembershipTypePage />
            </MemoryRouter>
          );

          // Look for the specific discount selector helper text (unique to the discount section)
          const discountHelperText = screen.queryByText(/Select discounts that will be available for this membership type/i);

          // Property: Discount section should be visible if and only if capability is enabled
          if (hasEntryDiscounts) {
            expect(discountHelperText).not.toBeNull();
          } else {
            // When capability is not enabled, discount section should not be visible
            expect(discountHelperText).toBeNull();
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should consistently apply capability check across both form types', async () => {
    await fc.assert(
      fc.asyncProperty(
        organisationArb,
        capabilitiesArb,
        async (organisation, capabilities) => {
          const hasEntryDiscounts = capabilities.includes('entry-discounts');

          // Mock the hooks
          const mockCapabilities = {
            capabilities,
            loading: false,
            error: null,
            hasCapability: (cap: string) => capabilities.includes(cap),
            refetch: vi.fn(),
          };

          const mockOrganisation = {
            organisation,
            loading: false,
            error: null,
            refetch: vi.fn(),
          };

          vi.mocked(useCapabilities).mockReturnValue(mockCapabilities);
          vi.mocked(useOrganisation).mockReturnValue(mockOrganisation);

          // Render single membership form
          const { container: singleContainer } = render(
            <MemoryRouter>
              <CreateSingleMembershipTypePage />
            </MemoryRouter>
          );

          const singleDiscountHelperText = screen.queryByText(/Select discounts that will be available for this membership type/i);
          const singleHasDiscounts = singleDiscountHelperText !== null;

          cleanup();

          // Render group membership form with same mocks
          vi.mocked(useCapabilities).mockReturnValue(mockCapabilities);
          vi.mocked(useOrganisation).mockReturnValue(mockOrganisation);

          const { container: groupContainer } = render(
            <MemoryRouter>
              <CreateGroupMembershipTypePage />
            </MemoryRouter>
          );

          const groupDiscountHelperText = screen.queryByText(/Select discounts that will be available for this membership type/i);
          const groupHasDiscounts = groupDiscountHelperText !== null;

          // Property: Both forms should show/hide discounts consistently based on capability
          expect(singleHasDiscounts).toBe(hasEntryDiscounts);
          expect(groupHasDiscounts).toBe(hasEntryDiscounts);
          expect(singleHasDiscounts).toBe(groupHasDiscounts);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should not render discount UI elements when capability is missing', async () => {
    await fc.assert(
      fc.asyncProperty(
        organisationArb,
        fc.array(fc.string().filter(s => s !== 'entry-discounts'), { minLength: 0, maxLength: 10 }),
        async (organisation, otherCapabilities) => {
          // Ensure 'entry-discounts' is NOT in the capabilities
          const capabilities = otherCapabilities;

          vi.mocked(useCapabilities).mockReturnValue({
            capabilities,
            loading: false,
            error: null,
            hasCapability: (cap: string) => capabilities.includes(cap),
            refetch: vi.fn(),
          });

          vi.mocked(useOrganisation).mockReturnValue({
            organisation,
            loading: false,
            error: null,
            refetch: vi.fn(),
          });

          const { container } = render(
            <MemoryRouter>
              <CreateSingleMembershipTypePage />
            </MemoryRouter>
          );

          // Property: No discount-related UI should be present
          expect(screen.queryByText(/Select discounts that will be available for this membership type/i)).toBeNull();
          expect(screen.queryByText(/Choose which discounts can be applied/i)).toBeNull();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should render discount UI elements when capability is present', async () => {
    await fc.assert(
      fc.asyncProperty(
        organisationArb,
        fc.array(fc.string(), { minLength: 0, maxLength: 10 }),
        async (organisation, otherCapabilities) => {
          // Ensure 'entry-discounts' IS in the capabilities
          const capabilities = ['entry-discounts', ...otherCapabilities];

          vi.mocked(useCapabilities).mockReturnValue({
            capabilities,
            loading: false,
            error: null,
            hasCapability: (cap: string) => capabilities.includes(cap),
            refetch: vi.fn(),
          });

          vi.mocked(useOrganisation).mockReturnValue({
            organisation,
            loading: false,
            error: null,
            refetch: vi.fn(),
          });

          render(
            <MemoryRouter>
              <CreateSingleMembershipTypePage />
            </MemoryRouter>
          );

          // Property: Discount-related UI should be present
          const discountHelperText = screen.queryByText(/Select discounts that will be available for this membership type/i);
          expect(discountHelperText).not.toBeNull();
        }
      ),
      { numRuns: 100 }
    );
  });
});
