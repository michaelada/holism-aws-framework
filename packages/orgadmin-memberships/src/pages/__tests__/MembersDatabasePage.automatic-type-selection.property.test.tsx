/**
 * Property-Based Tests for Automatic Membership Type Selection
 * 
 * Feature: manual-member-addition
 * Property 2: Automatic Membership Type Selection
 * 
 * **Validates: Requirements 2.2**
 * 
 * For any organization with exactly one membership type, clicking the Add Member
 * button should automatically select that membership type and navigate directly
 * to the member creation form, bypassing the type selector.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, waitFor, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter, useNavigate } from 'react-router-dom';
import fc from 'fast-check';
import MembersDatabasePage from '../MembersDatabasePage';
import * as useApiModule from '@aws-web-framework/orgadmin-core';
import { I18nextProvider } from 'react-i18next';
import { createTestI18n } from '../../test/i18n-test-utils';
import { navigatedTo, navigationPaths, navigatedToMatching } from '../../test/navigation';
import { authMeResponse } from '../../test/auth-me';

// Mock react-router-dom
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: vi.fn(),
  };
});

// Mock the hooks
vi.mock('@aws-web-framework/orgadmin-core', async () => {
  const actual = await vi.importActual('@aws-web-framework/orgadmin-core');
  return {
    ...actual,
    useApi: vi.fn(),
    useOrganisation: vi.fn(),
  };
});

vi.mock('@aws-web-framework/orgadmin-shell', async () => {
  // Shared, so a new shell hook does not break this suite — see test/shell-mock.ts
  const { shellMock } = await import('../../test/shell-mock');
  return shellMock();
});

/*
 * `numRuns` is small here on purpose.
 *
 * Each case mounts a whole page, waits for two network round trips and asserts
 * against the DOM — roughly 300ms. At 50 or 100 cases these properties spent
 * their entire timeout budget and were killed, which is worth nothing at all;
 * a property that never finishes proves less than one that runs ten cases.
 *
 * The seed is fixed globally (see test/setup.ts), so these ten are the *same*
 * ten every run and a counterexample can be reproduced. Raise this deliberately
 * when hunting a specific bug.
 */
describe('Feature: manual-member-addition, Property 2: Automatic Membership Type Selection', () => {

/*
 * Torn down after every property iteration.
 *
 * `fc.assert` runs its body many times inside a single test, and React Testing
 * Library only cleans up between *tests*. Each iteration therefore left its
 * render in the document — counts grew case by case, and the accumulated DOM
 * eventually made the run time out rather than fail with anything readable.
 */
afterEach(() => cleanup());
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

  let mockNavigate: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockNavigate = vi.fn();
    vi.mocked(useNavigate).mockReturnValue(mockNavigate);
  });

  /**
   * Arbitrary generator for membership type data
   */
  const membershipTypeArbitrary = fc.record({
    id: fc.uuid(),
    name: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
    description: fc.option(fc.string({ maxLength: 200 }), { nil: undefined }),
    organisationId: fc.constant(mockOrganisation.id),
  });

  /**
   * Helper function to render MembersDatabasePage with mocked API responses
   */
  const renderMembersDatabasePage = (membershipTypes: any[]) => {
    cleanup(); // previous property iteration's render
    const mockExecute = vi.fn().mockImplementation(({ url }) => {
      /*
       * The Add Member button is gated on an admin role as well as on there
       * being membership types, and the page reads that from `/auth/me`.
       * Unmocked it resolves to `[]`, `response.roles` is undefined, and the
       * button never renders — so every test here failed for a reason that had
       * nothing to do with what it was checking.
       *
       * The role gate itself is covered by
       * MembersDatabasePage.role-based-visibility.property.test.tsx, which
       * varies the roles deliberately. This suite grants one and varies the
       * membership types.
       */
      if (url.includes('/auth/me')) {
        return Promise.resolve(authMeResponse());
      }
      if (url.includes('/membership-types')) {
        return Promise.resolve(membershipTypes);
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
   * Helper function to find and click the Add Member button
   * Waits for the button to appear before clicking
   */
  const clickAddMemberButton = async (container: HTMLElement): Promise<boolean> => {
    try {
      await waitFor(() => {
        const buttons = Array.from(container.querySelectorAll('button'));
        const addMemberButton = buttons.find(button => {
          const buttonText = button.textContent || '';
          return buttonText.includes('Add Member');
        });
        expect(addMemberButton).toBeDefined();
      }, { timeout: 5000 });

      const buttons = Array.from(container.querySelectorAll('button'));
      const addMemberButton = buttons.find(button => {
        const buttonText = button.textContent || '';
        return buttonText.includes('Add Member');
      });

      if (addMemberButton) {
        fireEvent.click(addMemberButton);
        return true;
      }
      return false;
    } catch (error) {
      return false;
    }
  };

  it('should navigate with typeId query parameter when exactly one membership type exists', async () => {
    await fc.assert(
      fc.asyncProperty(
        membershipTypeArbitrary,
        async (membershipType) => {
          // Reset mocks for each iteration
          mockNavigate.mockClear();

          const { container } = renderMembersDatabasePage([membershipType]);

          // Click the Add Member button
          const buttonClicked = await clickAddMemberButton(container);
          expect(buttonClicked).toBe(true);

          // Property: Navigation should include the typeId query parameter
          await waitFor(() => {
            expect(navigatedToMatching(mockNavigate, `/members/create?typeId=${membershipType.id}`), `navigated to ${JSON.stringify(navigationPaths(mockNavigate))}`).toBe(true);
          }, { timeout: 3000 });
        }
      ),
      { numRuns: 10 }
    );
  }, 10000);

  it('should automatically select the single membership type without showing selector', async () => {
    await fc.assert(
      fc.asyncProperty(
        membershipTypeArbitrary,
        async (membershipType) => {
          // Reset mocks for each iteration
          mockNavigate.mockClear();

          const { container } = renderMembersDatabasePage([membershipType]);

          // Click the Add Member button
          const buttonClicked = await clickAddMemberButton(container);
          expect(buttonClicked).toBe(true);

          // Property: Should navigate directly to create form (not to type selector)
          await waitFor(() => {
            expect(mockNavigate).toHaveBeenCalledTimes(1);
            const navigationUrl = mockNavigate.mock.calls[0][0];
            
            // Should include typeId parameter (indicating auto-selection)
            expect(navigationUrl).toContain('typeId=');
            expect(navigationUrl).toContain(membershipType.id);
          });
        }
      ),
      { numRuns: 10 }
    );
  });

  it('should navigate to correct URL format with single membership type', async () => {
    await fc.assert(
      fc.asyncProperty(
        membershipTypeArbitrary,
        async (membershipType) => {
          // Reset mocks for each iteration
          mockNavigate.mockClear();

          const { container } = renderMembersDatabasePage([membershipType]);

          // Click the Add Member button
          const buttonClicked = await clickAddMemberButton(container);
          expect(buttonClicked).toBe(true);

          // Property: URL should match the expected format
          await waitFor(() => {
            const expectedUrl = `/members/create?typeId=${membershipType.id}`;
            expect(navigatedTo(mockNavigate, expectedUrl), `navigated to ${JSON.stringify(navigationPaths(mockNavigate))}`).toBe(true);
          });
        }
      ),
      { numRuns: 10 }
    );
  });

  it('should bypass type selector for any single membership type configuration', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          id: fc.uuid(),
          name: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
          description: fc.oneof(
            fc.constant(null),
            fc.constant(undefined),
            fc.string({ maxLength: 500 })
          ),
          organisationId: fc.constant(mockOrganisation.id),
          // Additional properties that might exist
          membershipFormId: fc.option(fc.uuid(), { nil: undefined }),
          automaticallyApprove: fc.option(fc.boolean(), { nil: undefined }),
          isRollingMembership: fc.option(fc.boolean(), { nil: undefined }),
        }),
        async (membershipType) => {
          // Reset mocks for each iteration
          mockNavigate.mockClear();

          const { container } = renderMembersDatabasePage([membershipType]);

          // Click the Add Member button
          const buttonClicked = await clickAddMemberButton(container);
          expect(buttonClicked).toBe(true);

          // Property: Should always navigate with typeId for single type
          await waitFor(() => {
            expect(mockNavigate).toHaveBeenCalled();
            const navigationUrl = mockNavigate.mock.calls[0][0];
            
            // Verify the URL contains the base path and typeId parameter
            expect(navigationUrl).toContain('/members/create');
            expect(navigationUrl).toContain('typeId=');
            expect(navigationUrl).toContain(membershipType.id);
          });
        }
      ),
      { numRuns: 10 }
    );
  });

  it('should maintain automatic selection behavior across different membership type IDs', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.uuid(), { minLength: 1, maxLength: 1 }),
        async (typeIds) => {
          const membershipType = {
            id: typeIds[0],
            name: 'Test Membership Type',
            organisationId: mockOrganisation.id,
          };

          // Reset mocks for each iteration
          mockNavigate.mockClear();

          const { container } = renderMembersDatabasePage([membershipType]);

          // Click the Add Member button
          const buttonClicked = await clickAddMemberButton(container);
          expect(buttonClicked).toBe(true);

          // Property: Should navigate with the correct typeId regardless of ID format
          await waitFor(() => {
            expect(navigatedTo(mockNavigate, `/members/create?typeId=${typeIds[0]}`), `navigated to ${JSON.stringify(navigationPaths(mockNavigate))}`).toBe(true);
          });
        }
      ),
      { numRuns: 10 }
    );
  });

  it('should not navigate to type selector when exactly one type exists', async () => {
    await fc.assert(
      fc.asyncProperty(
        membershipTypeArbitrary,
        async (membershipType) => {
          // Reset mocks for each iteration
          mockNavigate.mockClear();

          const { container } = renderMembersDatabasePage([membershipType]);

          // Click the Add Member button
          const buttonClicked = await clickAddMemberButton(container);
          expect(buttonClicked).toBe(true);

          // Property: Should NOT navigate to the plain create URL (without typeId)
          await waitFor(() => {
            expect(navigatedTo(mockNavigate, '/members/create'), `navigated to ${JSON.stringify(navigationPaths(mockNavigate))}`).toBe(false);
            
            // Should have been called with typeId parameter
            const navigationUrl = mockNavigate.mock.calls[0][0];
            expect(navigationUrl).toMatch(/typeId=/);
          });
        }
      ),
      { numRuns: 10 }
    );
  });

  it('should handle boundary case: exactly one membership type with minimal data', async () => {
    const minimalMembershipType = {
      id: 'test-type-id',
      name: 'T',
      organisationId: mockOrganisation.id,
    };

    mockNavigate.mockClear();

    const { container } = renderMembersDatabasePage([minimalMembershipType]);

    // Click the Add Member button
    const buttonClicked = await clickAddMemberButton(container);
    expect(buttonClicked).toBe(true);

    // Property: Should navigate with typeId even with minimal data
    await waitFor(() => {
      expect(navigatedTo(mockNavigate, `/members/create?typeId=${minimalMembershipType.id}`), `navigated to ${JSON.stringify(navigationPaths(mockNavigate))}`).toBe(true);
    }, { timeout: 3000 });
  }, 10000);
});
