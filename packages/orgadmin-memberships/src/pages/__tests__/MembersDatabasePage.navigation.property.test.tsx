/**
 * Property-Based Tests for Navigation Based on Membership Type Count
 * 
 * Feature: manual-member-addition
 * Property 4: Navigation Based on Membership Type Count
 * 
 * **Validates: Requirements 2.1, 6.1**
 * 
 * For any organization, clicking the Add Member button should navigate to the
 * type selector if multiple types exist, or directly to the creation form if
 * exactly one type exists.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, useNavigate } from 'react-router-dom';
import fc from 'fast-check';
import MembersDatabasePage from '../MembersDatabasePage';
import * as useApiModule from '@aws-web-framework/orgadmin-core';
import { I18nextProvider } from 'react-i18next';
import { createTestI18n } from '../../test/i18n-test-utils';

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

vi.mock('@aws-web-framework/orgadmin-shell', () => ({
  useOnboarding: () => ({
    checkModuleVisit: vi.fn(),
  }),
}));

describe('Feature: manual-member-addition, Property 4: Navigation Based on Membership Type Count', () => {
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
    const mockExecute = vi.fn().mockImplementation(({ url }) => {
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

  it('should navigate to create page with typeId when exactly one membership type exists', async () => {
    await fc.assert(
      fc.asyncProperty(
        membershipTypeArbitrary,
        async (membershipType) => {
          // Reset mocks for each iteration
          mockNavigate.mockClear();

          const { container } = renderMembersDatabasePage([membershipType]);

          // Wait for the component to finish loading
          await waitFor(() => {
            const mockExecute = vi.mocked(useApiModule.useApi).mock.results[0]?.value.execute;
            expect(mockExecute).toHaveBeenCalled();
          }, { timeout: 3000 });

          // Click the Add Member button
          const buttonClicked = await clickAddMemberButton(container);
          expect(buttonClicked).toBe(true);

          // Property: Should navigate to create page with typeId parameter
          await waitFor(() => {
            expect(mockNavigate).toHaveBeenCalledWith(
              `/orgadmin/memberships/members/create?typeId=${membershipType.id}`
            );
          });
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should navigate to type selector (plain create URL) when multiple membership types exist', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(membershipTypeArbitrary, { minLength: 2, maxLength: 10 }),
        async (membershipTypes) => {
          // Reset mocks for each iteration
          mockNavigate.mockClear();

          const { container } = renderMembersDatabasePage(membershipTypes);

          // Wait for the component to finish loading
          await waitFor(() => {
            const mockExecute = vi.mocked(useApiModule.useApi).mock.results[0]?.value.execute;
            expect(mockExecute).toHaveBeenCalled();
          }, { timeout: 3000 });

          // Click the Add Member button
          const buttonClicked = await clickAddMemberButton(container);
          expect(buttonClicked).toBe(true);

          // Property: Should navigate to plain create URL (type selector)
          await waitFor(() => {
            expect(mockNavigate).toHaveBeenCalledWith('/orgadmin/memberships/members/create');
          });
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should navigate correctly based on membership type count (universal property)', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(membershipTypeArbitrary, { minLength: 1, maxLength: 10 }),
        async (membershipTypes) => {
          // Reset mocks for each iteration
          mockNavigate.mockClear();

          const { container } = renderMembersDatabasePage(membershipTypes);

          // Wait for the component to finish loading
          await waitFor(() => {
            const mockExecute = vi.mocked(useApiModule.useApi).mock.results[0]?.value.execute;
            expect(mockExecute).toHaveBeenCalled();
          }, { timeout: 3000 });

          // Click the Add Member button
          const buttonClicked = await clickAddMemberButton(container);
          expect(buttonClicked).toBe(true);

          // Property: Navigation URL should depend on membership type count
          await waitFor(() => {
            expect(mockNavigate).toHaveBeenCalled();
            const navigationUrl = mockNavigate.mock.calls[0][0];

            if (membershipTypes.length === 1) {
              // Single type: should navigate with typeId
              expect(navigationUrl).toContain('typeId=');
              expect(navigationUrl).toContain(membershipTypes[0].id);
            } else {
              // Multiple types: should navigate to plain create URL
              expect(navigationUrl).toBe('/orgadmin/memberships/members/create');
            }
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should maintain navigation behavior consistency across different type counts', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 10 }),
        async (typeCount) => {
          // Generate membership types with the specified count
          const membershipTypes = Array.from({ length: typeCount }, (_, i) => ({
            id: `type-${i}`,
            name: `Membership Type ${i}`,
            organisationId: mockOrganisation.id,
          }));

          // Reset mocks for each iteration
          mockNavigate.mockClear();

          const { container } = renderMembersDatabasePage(membershipTypes);

          // Wait for the component to finish loading
          await waitFor(() => {
            const mockExecute = vi.mocked(useApiModule.useApi).mock.results[0]?.value.execute;
            expect(mockExecute).toHaveBeenCalled();
          }, { timeout: 3000 });

          // Click the Add Member button
          const buttonClicked = await clickAddMemberButton(container);
          expect(buttonClicked).toBe(true);

          // Property: Navigation should be consistent with type count
          await waitFor(() => {
            expect(mockNavigate).toHaveBeenCalledTimes(1);
            const navigationUrl = mockNavigate.mock.calls[0][0];

            if (typeCount === 1) {
              // Single type: navigate with typeId
              expect(navigationUrl).toMatch(/\/orgadmin\/memberships\/members\/create\?typeId=.+/);
            } else {
              // Multiple types: navigate to type selector
              expect(navigationUrl).toBe('/orgadmin/memberships/members/create');
            }
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle boundary case: exactly two membership types (minimum for selector)', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.tuple(membershipTypeArbitrary, membershipTypeArbitrary),
        async ([type1, type2]) => {
          // Ensure unique IDs
          const membershipTypes = [
            type1,
            { ...type2, id: `${type2.id}-unique` },
          ];

          // Reset mocks for each iteration
          mockNavigate.mockClear();

          const { container } = renderMembersDatabasePage(membershipTypes);

          // Wait for the component to finish loading
          await waitFor(() => {
            const mockExecute = vi.mocked(useApiModule.useApi).mock.results[0]?.value.execute;
            expect(mockExecute).toHaveBeenCalled();
          }, { timeout: 3000 });

          // Click the Add Member button
          const buttonClicked = await clickAddMemberButton(container);
          expect(buttonClicked).toBe(true);

          // Property: Should navigate to type selector with exactly 2 types
          await waitFor(() => {
            expect(mockNavigate).toHaveBeenCalledWith('/orgadmin/memberships/members/create');
          });
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should not include typeId parameter when multiple types exist', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(membershipTypeArbitrary, { minLength: 2, maxLength: 5 }),
        async (membershipTypes) => {
          // Reset mocks for each iteration
          mockNavigate.mockClear();

          const { container } = renderMembersDatabasePage(membershipTypes);

          // Wait for the component to finish loading
          await waitFor(() => {
            const mockExecute = vi.mocked(useApiModule.useApi).mock.results[0]?.value.execute;
            expect(mockExecute).toHaveBeenCalled();
          }, { timeout: 3000 });

          // Click the Add Member button
          await clickAddMemberButton(container);

          // Property: URL should NOT contain typeId when multiple types exist
          await waitFor(() => {
            const navigationUrl = mockNavigate.mock.calls[0][0];
            expect(navigationUrl).not.toContain('typeId');
            expect(navigationUrl).toBe('/orgadmin/memberships/members/create');
          });
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should always include typeId parameter when exactly one type exists', async () => {
    await fc.assert(
      fc.asyncProperty(
        membershipTypeArbitrary,
        async (membershipType) => {
          // Reset mocks for each iteration
          mockNavigate.mockClear();

          const { container } = renderMembersDatabasePage([membershipType]);

          // Wait for the component to finish loading
          await waitFor(() => {
            const mockExecute = vi.mocked(useApiModule.useApi).mock.results[0]?.value.execute;
            expect(mockExecute).toHaveBeenCalled();
          }, { timeout: 3000 });

          // Click the Add Member button
          await clickAddMemberButton(container);

          // Property: URL should ALWAYS contain typeId when single type exists
          await waitFor(() => {
            const navigationUrl = mockNavigate.mock.calls[0][0];
            expect(navigationUrl).toContain('typeId=');
            expect(navigationUrl).toContain(membershipType.id);
          });
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should navigate to correct base path regardless of type count', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(membershipTypeArbitrary, { minLength: 1, maxLength: 10 }),
        async (membershipTypes) => {
          // Reset mocks for each iteration
          mockNavigate.mockClear();

          const { container } = renderMembersDatabasePage(membershipTypes);

          // Wait for the component to finish loading
          await waitFor(() => {
            const mockExecute = vi.mocked(useApiModule.useApi).mock.results[0]?.value.execute;
            expect(mockExecute).toHaveBeenCalled();
          }, { timeout: 3000 });

          // Click the Add Member button
          await clickAddMemberButton(container);

          // Property: All navigation URLs should start with the correct base path
          await waitFor(() => {
            const navigationUrl = mockNavigate.mock.calls[0][0];
            expect(navigationUrl).toMatch(/^\/orgadmin\/memberships\/members\/create/);
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle navigation with various membership type configurations', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
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
          }),
          { minLength: 1, maxLength: 8 }
        ),
        async (membershipTypes) => {
          // Reset mocks for each iteration
          mockNavigate.mockClear();

          const { container } = renderMembersDatabasePage(membershipTypes);

          // Wait for the component to finish loading
          await waitFor(() => {
            const mockExecute = vi.mocked(useApiModule.useApi).mock.results[0]?.value.execute;
            expect(mockExecute).toHaveBeenCalled();
          }, { timeout: 3000 });

          // Click the Add Member button
          await clickAddMemberButton(container);

          // Property: Navigation should work correctly regardless of type configuration
          await waitFor(() => {
            expect(mockNavigate).toHaveBeenCalled();
            const navigationUrl = mockNavigate.mock.calls[0][0];

            if (membershipTypes.length === 1) {
              expect(navigationUrl).toContain(`typeId=${membershipTypes[0].id}`);
            } else {
              expect(navigationUrl).toBe('/orgadmin/memberships/members/create');
            }
          });
        }
      ),
      { numRuns: 100 }
    );
  });
});
