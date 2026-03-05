/**
 * Property-Based Tests for Add Member Button Visibility
 * 
 * Feature: manual-member-addition
 * Property 1: Add Member Button Visibility Based on Membership Type Count
 * 
 * **Validates: Requirements 1.1, 1.2**
 * 
 * For any organization, the Add Member button should be visible if and only if
 * the organization has at least one membership type configured.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import fc from 'fast-check';
import MembersDatabasePage from '../MembersDatabasePage';
import * as useApiModule from '@aws-web-framework/orgadmin-core';
import { I18nextProvider } from 'react-i18next';
import { createTestI18n } from '../../test/i18n-test-utils';

// Mock the hooks
vi.mock('@aws-web-framework/orgadmin-core', async () => {
  const actual = await vi.importActual('@aws-web-framework/orgadmin-core');
  return {
    ...actual,
    useApi: vi.fn(),
    useOrganisation: vi.fn(),
  };
});

vi.mock('@aws-web-framework/orgadmin-shell', () => ({
  useOnboarding: () => ({
    checkModuleVisit: vi.fn(),
  }),
}));

describe('Feature: manual-member-addition, Property 1: Add Member Button Visibility Based on Membership Type Count', () => {
  const testI18n = createTestI18n('en-GB');
  
  // Add translation for the Add Member button
  testI18n.addResourceBundle('en-GB', 'translation', {
    memberships: {
      ...testI18n.getResourceBundle('en-GB', 'translation').memberships,
      actions: {
        ...testI18n.getResourceBundle('en-GB', 'translation').memberships?.actions,
        addMember: 'Add Member',
      },
    },
  }, true, true);

  const mockOrganisation = {
    id: 'test-org-id',
    name: 'Test Organization',
    shortName: 'TEST',
  };

  /**
   * Helper function to render MembersDatabasePage with mocked API responses
   */
  const renderMembersDatabasePage = (membershipTypeCount: number) => {
    const mockExecute = vi.fn().mockImplementation(({ url }) => {
      if (url.includes('/membership-types')) {
        // Return array of membership types with the specified count
        return Promise.resolve(
          Array.from({ length: membershipTypeCount }, (_, i) => ({
            id: `type-${i}`,
            name: `Membership Type ${i}`,
            organisationId: mockOrganisation.id,
          }))
        );
      }
      if (url.includes('/auth/me')) {
        return Promise.resolve({
          user: { id: 'user-1', email: 'test@example.com' },
          roles: [{ id: 'role-1', name: 'admin', displayName: 'Administrator' }],
        });
      }
      if (url.includes('/members')) {
        return Promise.resolve([]);
      }
      if (url.includes('/member-filters')) {
        return Promise.resolve([]);
      }
      return Promise.resolve([]);
    });

    vi.mocked(useApiModule.useApi).mockReturnValue({
      execute: mockExecute,
      data: null,
      error: null,
      loading: false,
      reset: vi.fn(),
    });

    vi.mocked(useApiModule.useOrganisation).mockReturnValue({
      organisation: mockOrganisation,
      setOrganisation: vi.fn(),
      loading: false,
    });

    return render(
      <I18nextProvider i18n={testI18n}>
        <MemoryRouter>
          <MembersDatabasePage />
        </MemoryRouter>
      </I18nextProvider>
    );
  };

  /**
   * Helper function to check if Add Member button is visible
   */
  const isAddMemberButtonVisible = (container: HTMLElement): boolean => {
    // Find all buttons in the container
    const buttons = Array.from(container.querySelectorAll('button'));
    
    // Check if any button contains "Add Member" text
    return buttons.some(button => {
      const buttonText = button.textContent || '';
      return buttonText.includes('Add Member');
    });
  };

  it('should display Add Member button when at least one membership type exists', async () => {
    fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 10 }), // Generate counts from 1 to 10
        async (membershipTypeCount) => {
          const { container } = renderMembersDatabasePage(membershipTypeCount);

          // Wait for the component to finish loading
          await waitFor(() => {
            const loadingText = container.textContent?.includes('Loading');
            expect(loadingText).toBeFalsy();
          }, { timeout: 3000 });

          // Property: Button should be visible when count >= 1
          const buttonVisible = isAddMemberButtonVisible(container);
          expect(buttonVisible).toBe(true);
        }
      ),
      { numRuns: 20 }
    );
  });

  it('should hide Add Member button when no membership types exist', async () => {
    fc.assert(
      fc.asyncProperty(
        fc.constant(0), // Always test with 0 membership types
        async (membershipTypeCount) => {
          const { container } = renderMembersDatabasePage(membershipTypeCount);

          // Wait for the component to finish loading
          await waitFor(() => {
            const mockExecute = vi.mocked(useApiModule.useApi).mock.results[0]?.value.execute;
            // Check that execute was called (component finished loading)
            expect(mockExecute).toHaveBeenCalled();
          }, { timeout: 3000 });

          // Property: Button should NOT be visible when count = 0
          const buttonVisible = isAddMemberButtonVisible(container);
          expect(buttonVisible).toBe(false);
        }
      ),
      { numRuns: 20 }
    );
  });

  it('should correctly toggle button visibility based on membership type count', async () => {
    fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 0, max: 10 }), // Generate counts from 0 to 10
        async (membershipTypeCount) => {
          const { container } = renderMembersDatabasePage(membershipTypeCount);

          // Wait for the component to finish loading
          await waitFor(() => {
            const mockExecute = vi.mocked(useApiModule.useApi).mock.results[0]?.value.execute;
            expect(mockExecute).toHaveBeenCalled();
          }, { timeout: 3000 });

          // Property: Button visibility should match the condition (count > 0)
          const buttonVisible = isAddMemberButtonVisible(container);
          const expectedVisibility = membershipTypeCount > 0;
          
          expect(buttonVisible).toBe(expectedVisibility);
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should handle boundary case: exactly one membership type', async () => {
    const { container } = renderMembersDatabasePage(1);

    await waitFor(() => {
      const mockExecute = vi.mocked(useApiModule.useApi).mock.results[0]?.value.execute;
      expect(mockExecute).toHaveBeenCalled();
    }, { timeout: 3000 });

    // Property: Button should be visible with exactly 1 membership type
    const buttonVisible = isAddMemberButtonVisible(container);
    expect(buttonVisible).toBe(true);
  });

  it('should handle boundary case: zero membership types', async () => {
    const { container } = renderMembersDatabasePage(0);

    await waitFor(() => {
      const mockExecute = vi.mocked(useApiModule.useApi).mock.results[0]?.value.execute;
      expect(mockExecute).toHaveBeenCalled();
    }, { timeout: 3000 });

    // Property: Button should NOT be visible with 0 membership types
    const buttonVisible = isAddMemberButtonVisible(container);
    expect(buttonVisible).toBe(false);
  });

  it('should maintain button visibility invariant across multiple renders', async () => {
    fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 0, max: 5 }),
        async (membershipTypeCount) => {
          // Render the component twice with the same count
          const { container: container1, unmount: unmount1 } = renderMembersDatabasePage(membershipTypeCount);
          
          await waitFor(() => {
            const mockExecute = vi.mocked(useApiModule.useApi).mock.results[0]?.value.execute;
            expect(mockExecute).toHaveBeenCalled();
          }, { timeout: 3000 });
          
          const visibility1 = isAddMemberButtonVisible(container1);

          // Unmount first render
          unmount1();
          
          // Render again with the same count
          const { container: container2 } = renderMembersDatabasePage(membershipTypeCount);
          
          await waitFor(() => {
            // Get the latest mock (after re-render)
            const mockResults = vi.mocked(useApiModule.useApi).mock.results;
            const latestMockExecute = mockResults[mockResults.length - 1]?.value.execute;
            expect(latestMockExecute).toHaveBeenCalled();
          }, { timeout: 3000 });
          
          const visibility2 = isAddMemberButtonVisible(container2);

          // Property: Button visibility should be consistent across renders
          expect(visibility1).toBe(visibility2);
          expect(visibility1).toBe(membershipTypeCount > 0);
        }
      ),
      { numRuns: 20 }
    );
  });
});
