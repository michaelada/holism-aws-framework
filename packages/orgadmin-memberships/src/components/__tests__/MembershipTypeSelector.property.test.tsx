/**
 * Property-Based Tests for Membership Type Selector Display
 * 
 * Feature: manual-member-addition
 * Property 3: Membership Type Selector Displays All Types
 * 
 * **Validates: Requirements 2.3**
 * 
 * For any organization with multiple membership types, the membership type selector
 * should display all available membership types with their names and descriptions.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import fc from 'fast-check';
import MembershipTypeSelector from '../MembershipTypeSelector';
import { I18nextProvider } from 'react-i18next';
import { createTestI18n } from '../../test/i18n-test-utils';
import type { MembershipType } from '../../types/membership.types';

describe('Feature: manual-member-addition, Property 3: Membership Type Selector Displays All Types', () => {
  const testI18n = createTestI18n('en-GB');
  
  // Add translation for the type selector
  testI18n.addResourceBundle('en-GB', 'translation', {
    memberships: {
      ...testI18n.getResourceBundle('en-GB', 'translation').memberships,
      typeSelector: {
        title: 'Select Membership Type',
      },
    },
    common: {
      ...testI18n.getResourceBundle('en-GB', 'translation').common,
      actions: {
        ...testI18n.getResourceBundle('en-GB', 'translation').common?.actions,
        cancel: 'Cancel',
      },
    },
  }, true, true);

  const mockOnClose = vi.fn();
  const mockOnSelect = vi.fn();

  /**
   * Arbitrary generator for membership type data
   * Generates membership types with various names and descriptions
   * Ensures non-whitespace names for better testability
   */
  const membershipTypeArbitrary = fc.record({
    id: fc.uuid(),
    name: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
    description: fc.string({ maxLength: 500 }),
    organisationId: fc.uuid(),
    membershipFormId: fc.uuid(),
    membershipStatus: fc.constantFrom('open', 'closed'),
    isRollingMembership: fc.boolean(),
    automaticallyApprove: fc.boolean(),
    memberLabels: fc.array(fc.string()),
    supportedPaymentMethods: fc.array(fc.string()),
    useTermsAndConditions: fc.boolean(),
    membershipTypeCategory: fc.constantFrom('single', 'group'),
    discountIds: fc.array(fc.uuid()),
    createdAt: fc.date(),
    updatedAt: fc.date(),
  }) as fc.Arbitrary<MembershipType>;

  /**
   * Generator for arrays of membership types with unique IDs
   */
  const uniqueMembershipTypesArbitrary = (minLength: number, maxLength: number) =>
    fc.array(membershipTypeArbitrary, { minLength, maxLength })
      .map(types => {
        // Ensure unique IDs by regenerating them
        return types.map((type, index) => ({
          ...type,
          id: `${type.id.slice(0, -4)}${index.toString().padStart(4, '0')}`,
        }));
      });

  /**
   * Helper function to render MembershipTypeSelector with i18n
   */
  const renderMembershipTypeSelector = (membershipTypes: MembershipType[], open: boolean = true) => {
    return render(
      <I18nextProvider i18n={testI18n}>
        <MembershipTypeSelector
          open={open}
          onClose={mockOnClose}
          onSelect={mockOnSelect}
          membershipTypes={membershipTypes}
        />
      </I18nextProvider>
    );
  };

  it('should display all membership types when multiple types exist', async () => {
    await fc.assert(
      fc.asyncProperty(
        uniqueMembershipTypesArbitrary(2, 10),
        async (membershipTypes) => {
          const { container } = renderMembershipTypeSelector(membershipTypes, true);

          // Property: All membership types should be displayed
          membershipTypes.forEach((type) => {
            // Check that the name is displayed
            const nameElements = Array.from(container.querySelectorAll('*')).filter(
              el => el.textContent?.includes(type.name)
            );
            expect(nameElements.length).toBeGreaterThan(0);
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should display both name and description for each membership type', async () => {
    await fc.assert(
      fc.asyncProperty(
        uniqueMembershipTypesArbitrary(2, 10),
        async (membershipTypes) => {
          const { container } = renderMembershipTypeSelector(membershipTypes, true);

          // Property: Each type should display both name and description
          membershipTypes.forEach((type) => {
            // Check that the name is displayed
            const nameElements = Array.from(container.querySelectorAll('*')).filter(
              el => el.textContent?.includes(type.name)
            );
            expect(nameElements.length).toBeGreaterThan(0);

            // Check that the description is displayed (if not empty)
            if (type.description.trim().length > 0) {
              const descriptionElements = Array.from(container.querySelectorAll('*')).filter(
                el => el.textContent?.includes(type.description)
              );
              expect(descriptionElements.length).toBeGreaterThan(0);
            }
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should display the correct number of membership types', async () => {
    await fc.assert(
      fc.asyncProperty(
        uniqueMembershipTypesArbitrary(2, 10),
        async (membershipTypes) => {
          const { container } = renderMembershipTypeSelector(membershipTypes, true);

          // Property: The number of displayed types should match the input
          const listItems = container.querySelectorAll('[role="button"]');
          expect(listItems.length).toBe(membershipTypes.length);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should display all types regardless of name length', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            id: fc.uuid(),
            name: fc.oneof(
              fc.string({ minLength: 1, maxLength: 5 }).filter(s => s.trim().length > 0),    // Short names
              fc.string({ minLength: 50, maxLength: 100 }).filter(s => s.trim().length > 0)  // Long names
            ),
            description: fc.string({ maxLength: 200 }),
            organisationId: fc.uuid(),
            membershipFormId: fc.uuid(),
            membershipStatus: fc.constantFrom('open', 'closed'),
            isRollingMembership: fc.boolean(),
            automaticallyApprove: fc.boolean(),
            memberLabels: fc.array(fc.string()),
            supportedPaymentMethods: fc.array(fc.string()),
            useTermsAndConditions: fc.boolean(),
            membershipTypeCategory: fc.constantFrom('single', 'group'),
            discountIds: fc.array(fc.uuid()),
            createdAt: fc.date(),
            updatedAt: fc.date(),
          }) as fc.Arbitrary<MembershipType>,
          { minLength: 2, maxLength: 10 }
        ).map(types => types.map((type, index) => ({
          ...type,
          id: `${type.id.slice(0, -4)}${index.toString().padStart(4, '0')}`,
        }))),
        async (membershipTypes) => {
          const { container } = renderMembershipTypeSelector(membershipTypes, true);

          // Property: All types should be displayed regardless of name length
          const listItems = container.querySelectorAll('[role="button"]');
          expect(listItems.length).toBe(membershipTypes.length);

          membershipTypes.forEach((type) => {
            const nameElements = Array.from(container.querySelectorAll('*')).filter(
              el => el.textContent?.includes(type.name)
            );
            expect(nameElements.length).toBeGreaterThan(0);
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should display all types with various description lengths', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            id: fc.uuid(),
            name: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
            description: fc.oneof(
              fc.constant(''),                              // Empty description
              fc.string({ minLength: 1, maxLength: 10 }),   // Short description
              fc.string({ minLength: 100, maxLength: 500 }) // Long description
            ),
            organisationId: fc.uuid(),
            membershipFormId: fc.uuid(),
            membershipStatus: fc.constantFrom('open', 'closed'),
            isRollingMembership: fc.boolean(),
            automaticallyApprove: fc.boolean(),
            memberLabels: fc.array(fc.string()),
            supportedPaymentMethods: fc.array(fc.string()),
            useTermsAndConditions: fc.boolean(),
            membershipTypeCategory: fc.constantFrom('single', 'group'),
            discountIds: fc.array(fc.uuid()),
            createdAt: fc.date(),
            updatedAt: fc.date(),
          }) as fc.Arbitrary<MembershipType>,
          { minLength: 2, maxLength: 10 }
        ).map(types => types.map((type, index) => ({
          ...type,
          id: `${type.id.slice(0, -4)}${index.toString().padStart(4, '0')}`,
        }))),
        async (membershipTypes) => {
          const { container } = renderMembershipTypeSelector(membershipTypes, true);

          // Property: All types should be displayed regardless of description length
          const listItems = container.querySelectorAll('[role="button"]');
          expect(listItems.length).toBe(membershipTypes.length);

          membershipTypes.forEach((type) => {
            const nameElements = Array.from(container.querySelectorAll('*')).filter(
              el => el.textContent?.includes(type.name)
            );
            expect(nameElements.length).toBeGreaterThan(0);
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should maintain display order for all membership types', async () => {
    await fc.assert(
      fc.asyncProperty(
        uniqueMembershipTypesArbitrary(2, 10),
        async (membershipTypes) => {
          const { container } = renderMembershipTypeSelector(membershipTypes, true);

          // Property: Types should be displayed in the same order as provided
          const listItems = Array.from(container.querySelectorAll('[role="button"]'));
          
          expect(listItems.length).toBe(membershipTypes.length);
          
          membershipTypes.forEach((type, index) => {
            const listItem = listItems[index];
            expect(listItem.textContent).toContain(type.name);
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should display all types with special characters in names', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            id: fc.uuid(),
            name: fc.oneof(
              fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
              fc.constant('Type & Name'),
              fc.constant('Type <Special>'),
              fc.constant("Type's Name"),
              fc.constant('Type "Quoted"')
            ),
            description: fc.string({ maxLength: 200 }),
            organisationId: fc.uuid(),
            membershipFormId: fc.uuid(),
            membershipStatus: fc.constantFrom('open', 'closed'),
            isRollingMembership: fc.boolean(),
            automaticallyApprove: fc.boolean(),
            memberLabels: fc.array(fc.string()),
            supportedPaymentMethods: fc.array(fc.string()),
            useTermsAndConditions: fc.boolean(),
            membershipTypeCategory: fc.constantFrom('single', 'group'),
            discountIds: fc.array(fc.uuid()),
            createdAt: fc.date(),
            updatedAt: fc.date(),
          }) as fc.Arbitrary<MembershipType>,
          { minLength: 2, maxLength: 5 }
        ).map(types => types.map((type, index) => ({
          ...type,
          id: `${type.id.slice(0, -4)}${index.toString().padStart(4, '0')}`,
        }))),
        async (membershipTypes) => {
          const { container } = renderMembershipTypeSelector(membershipTypes, true);

          // Property: All types should be displayed even with special characters
          const listItems = container.querySelectorAll('[role="button"]');
          expect(listItems.length).toBe(membershipTypes.length);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should display all types when count varies from 2 to 10', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 2, max: 10 }),
        uniqueMembershipTypesArbitrary(10, 10),
        async (count, allTypes) => {
          // Take only the specified count of types
          const membershipTypes = allTypes.slice(0, count);
          const { container } = renderMembershipTypeSelector(membershipTypes, true);

          // Property: Exactly 'count' types should be displayed
          const listItems = container.querySelectorAll('[role="button"]');
          expect(listItems.length).toBe(count);

          // All selected types should be visible
          membershipTypes.forEach((type) => {
            const nameElements = Array.from(container.querySelectorAll('*')).filter(
              el => el.textContent?.includes(type.name)
            );
            expect(nameElements.length).toBeGreaterThan(0);
          });
        }
      ),
      { numRuns: 100 }
    );
  });
});
