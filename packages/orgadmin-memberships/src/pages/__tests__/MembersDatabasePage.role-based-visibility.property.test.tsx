/**
 * Property-Based Tests for Role-Based Button Visibility
 * 
 * Feature: manual-member-addition
 * Property 15: Role-Based Button Visibility
 * 
 * **Validates: Requirements 7.1**
 * 
 * For any user viewing the members database, the Add Member button should be visible
 * if and only if the user has the Organization Administrator role (admin role).
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

describe('Feature: manual-member-addition, Property 15: Role-Based Button Visibility', () => {
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

  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * Helper function to render MembersDatabasePage with mocked API responses
   */
  const renderMembersDatabasePage = (userRoles: Array<{ id: string; name: string; displayName: string }>) => {
    const mockExecute = vi.fn().mockImplementation(({ url }) => {
      if (url.includes('/membership-types')) {
        // Always return at least one membership type so we can test role-based visibility
        return Promise.resolve([
          {
            id: 'type-1',
            name: 'Standard Membership',
            organisationId: mockOrganisation.id,
          },
        ]);
      }
      if (url.includes('/auth/me')) {
        // Return user data with specified roles
        return Promise.resolve({
          user: {
            id: 'user-1',
            email: 'test@example.com',
            firstName: 'Test',
            lastName: 'User',
          },
          organisation: mockOrganisation,
          capabilities: ['memberships'],
          roles: userRoles,
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

  /**
   * Arbitrary generator for user roles
   */
  const roleArbitrary = fc.record({
    id: fc.uuid(),
    name: fc.constantFrom('admin', 'viewer', 'editor', 'manager', 'custom-role'),
    displayName: fc.string({ minLength: 3, maxLength: 20 }),
  });

  it('should display Add Member button when user has admin role', async () => {
    fc.assert(
      fc.asyncProperty(
        fc.array(roleArbitrary, { minLength: 1, maxLength: 5 }),
        async (roles) => {
          // Ensure at least one role is 'admin'
          const rolesWithAdmin = [
            { id: 'admin-role-id', name: 'admin', displayName: 'Administrator' },
            ...roles.filter(r => r.name !== 'admin'),
          ];

          const { container } = renderMembersDatabasePage(rolesWithAdmin);

          // Wait for the component to finish loading
          await waitFor(() => {
            const mockExecute = vi.mocked(useApiModule.useApi).mock.results[0]?.value.execute;
            expect(mockExecute).toHaveBeenCalled();
          }, { timeout: 3000 });

          // Property: Button should be visible when user has admin role
          const buttonVisible = isAddMemberButtonVisible(container);
          expect(buttonVisible).toBe(true);
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should hide Add Member button when user does not have admin role', async () => {
    fc.assert(
      fc.asyncProperty(
        fc.array(roleArbitrary, { minLength: 0, maxLength: 5 }),
        async (roles) => {
          // Ensure no role is 'admin'
          const rolesWithoutAdmin = roles.filter(r => r.name !== 'admin');

          const { container } = renderMembersDatabasePage(rolesWithoutAdmin);

          // Wait for the component to finish loading
          await waitFor(() => {
            const mockExecute = vi.mocked(useApiModule.useApi).mock.results[0]?.value.execute;
            expect(mockExecute).toHaveBeenCalled();
          }, { timeout: 3000 });

          // Property: Button should NOT be visible when user doesn't have admin role
          const buttonVisible = isAddMemberButtonVisible(container);
          expect(buttonVisible).toBe(false);
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should correctly toggle button visibility based on admin role presence', async () => {
    fc.assert(
      fc.asyncProperty(
        fc.boolean(), // Whether to include admin role
        fc.array(roleArbitrary, { minLength: 0, maxLength: 3 }),
        async (hasAdminRole, otherRoles) => {
          const roles = hasAdminRole
            ? [{ id: 'admin-role-id', name: 'admin', displayName: 'Administrator' }, ...otherRoles.filter(r => r.name !== 'admin')]
            : otherRoles.filter(r => r.name !== 'admin');

          const { container, unmount } = renderMembersDatabasePage(roles);

          try {
            // Wait for the component to finish loading - wait for all API calls
            await waitFor(() => {
              const mockExecute = vi.mocked(useApiModule.useApi).mock.results[0]?.value.execute;
              const callCount = mockExecute?.mock.calls.length || 0;
              // Should have called: membership-types, auth/me, members, member-filters
              expect(callCount).toBeGreaterThanOrEqual(3);
            }, { timeout: 5000 });

            // Add a small delay to ensure state updates have propagated
            await new Promise(resolve => setTimeout(resolve, 50));

            // Property: Button visibility should match admin role presence
            const buttonVisible = isAddMemberButtonVisible(container);
            expect(buttonVisible).toBe(hasAdminRole);
          } finally {
            unmount();
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle boundary case: user with only admin role', async () => {
    const roles = [{ id: 'admin-role-id', name: 'admin', displayName: 'Administrator' }];
    const { container } = renderMembersDatabasePage(roles);

    await waitFor(() => {
      const mockExecute = vi.mocked(useApiModule.useApi).mock.results[0]?.value.execute;
      expect(mockExecute).toHaveBeenCalled();
    }, { timeout: 3000 });

    // Property: Button should be visible with only admin role
    const buttonVisible = isAddMemberButtonVisible(container);
    expect(buttonVisible).toBe(true);
  });

  it('should handle boundary case: user with no roles', async () => {
    const roles: Array<{ id: string; name: string; displayName: string }> = [];
    const { container } = renderMembersDatabasePage(roles);

    await waitFor(() => {
      const mockExecute = vi.mocked(useApiModule.useApi).mock.results[0]?.value.execute;
      expect(mockExecute).toHaveBeenCalled();
    }, { timeout: 3000 });

    // Property: Button should NOT be visible with no roles
    const buttonVisible = isAddMemberButtonVisible(container);
    expect(buttonVisible).toBe(false);
  });

  it('should handle boundary case: user with viewer role only', async () => {
    const roles = [{ id: 'viewer-role-id', name: 'viewer', displayName: 'Viewer' }];
    const { container } = renderMembersDatabasePage(roles);

    await waitFor(() => {
      const mockExecute = vi.mocked(useApiModule.useApi).mock.results[0]?.value.execute;
      expect(mockExecute).toHaveBeenCalled();
    }, { timeout: 3000 });

    // Property: Button should NOT be visible with only viewer role
    const buttonVisible = isAddMemberButtonVisible(container);
    expect(buttonVisible).toBe(false);
  });

  it('should maintain button visibility invariant across multiple renders with same roles', async () => {
    fc.assert(
      fc.asyncProperty(
        fc.boolean(),
        async (hasAdminRole) => {
          const roles = hasAdminRole
            ? [{ id: 'admin-role-id', name: 'admin', displayName: 'Administrator' }]
            : [{ id: 'viewer-role-id', name: 'viewer', displayName: 'Viewer' }];

          // Render the component twice with the same roles
          const { container: container1, unmount: unmount1 } = renderMembersDatabasePage(roles);
          
          await waitFor(() => {
            const mockExecute = vi.mocked(useApiModule.useApi).mock.results[0]?.value.execute;
            expect(mockExecute).toHaveBeenCalled();
          }, { timeout: 3000 });
          
          const visibility1 = isAddMemberButtonVisible(container1);

          // Unmount first render
          unmount1();
          
          // Render again with the same roles
          const { container: container2 } = renderMembersDatabasePage(roles);
          
          await waitFor(() => {
            const mockResults = vi.mocked(useApiModule.useApi).mock.results;
            const latestMockExecute = mockResults[mockResults.length - 1]?.value.execute;
            expect(latestMockExecute).toHaveBeenCalled();
          }, { timeout: 3000 });
          
          const visibility2 = isAddMemberButtonVisible(container2);

          // Property: Button visibility should be consistent across renders
          expect(visibility1).toBe(visibility2);
          expect(visibility1).toBe(hasAdminRole);
        }
      ),
      { numRuns: 20 }
    );
  });

  it('should verify admin role name is case-sensitive', async () => {
    fc.assert(
      fc.asyncProperty(
        fc.constantFrom('Admin', 'ADMIN', 'AdMiN', 'aDmIn'),
        async (roleName) => {
          const roles = [{ id: 'role-id', name: roleName, displayName: 'Administrator' }];
          const { container } = renderMembersDatabasePage(roles);

          await waitFor(() => {
            const mockExecute = vi.mocked(useApiModule.useApi).mock.results[0]?.value.execute;
            expect(mockExecute).toHaveBeenCalled();
          }, { timeout: 3000 });

          // Property: Only lowercase 'admin' should grant access
          const buttonVisible = isAddMemberButtonVisible(container);
          expect(buttonVisible).toBe(false);
        }
      ),
      { numRuns: 20 }
    );
  });
});
