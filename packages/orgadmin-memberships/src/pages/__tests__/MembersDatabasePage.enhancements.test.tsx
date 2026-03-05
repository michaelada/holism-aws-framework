/**
 * Unit Tests for MembersDatabasePage Enhancements
 * 
 * Feature: manual-member-addition
 * Task 3.7: Write unit tests for MembersDatabasePage enhancements
 * 
 * **Validates: Requirements 1.1, 1.2, 2.1, 2.2**
 * 
 * These unit tests cover specific scenarios for the MembersDatabasePage enhancements:
 * - Button visibility when membership types exist (count > 0)
 * - Button hidden when no membership types exist (count = 0)
 * - Navigation with single membership type (direct to create page with typeId)
 * - Navigation with multiple membership types (to type selector)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, useNavigate } from 'react-router-dom';
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

describe('MembersDatabasePage Enhancements - Unit Tests', () => {
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
   * Helper function to render MembersDatabasePage with mocked API responses
   */
  const renderMembersDatabasePage = (membershipTypes: any[]) => {
    const mockExecute = vi.fn().mockImplementation(({ url }) => {
      if (url.includes('/membership-types')) {
        return Promise.resolve(membershipTypes);
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
      organisation: mockOrganisation as any,
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
    const buttons = Array.from(container.querySelectorAll('button'));
    return buttons.some(button => {
      const buttonText = button.textContent || '';
      return buttonText.includes('Add Member');
    });
  };

  /**
   * Helper function to find and click the Add Member button
   */
  const clickAddMemberButton = (container: HTMLElement): boolean => {
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
  };

  describe('Button Visibility - Requirement 1.1, 1.2', () => {
    it('should display Add Member button when membership types exist (count = 1)', async () => {
      const membershipTypes = [
        {
          id: 'type-1',
          name: 'Standard Membership',
          organisationId: mockOrganisation.id,
        },
      ];

      const { container } = renderMembersDatabasePage(membershipTypes);

      // Wait for the component to finish loading
      await waitFor(() => {
        const mockExecute = vi.mocked(useApiModule.useApi).mock.results[0]?.value.execute;
        expect(mockExecute).toHaveBeenCalled();
      }, { timeout: 3000 });

      // Button should be visible when types exist
      const buttonVisible = isAddMemberButtonVisible(container);
      expect(buttonVisible).toBe(true);
    });

    it('should display Add Member button when membership types exist (count = 3)', async () => {
      const membershipTypes = [
        { id: 'type-1', name: 'Standard Membership', organisationId: mockOrganisation.id },
        { id: 'type-2', name: 'Premium Membership', organisationId: mockOrganisation.id },
        { id: 'type-3', name: 'VIP Membership', organisationId: mockOrganisation.id },
      ];

      const { container } = renderMembersDatabasePage(membershipTypes);

      await waitFor(() => {
        const mockExecute = vi.mocked(useApiModule.useApi).mock.results[0]?.value.execute;
        expect(mockExecute).toHaveBeenCalled();
      }, { timeout: 3000 });

      // Button should be visible when multiple types exist
      const buttonVisible = isAddMemberButtonVisible(container);
      expect(buttonVisible).toBe(true);
    });

    it('should hide Add Member button when no membership types exist (count = 0)', async () => {
      const membershipTypes: any[] = [];

      const { container } = renderMembersDatabasePage(membershipTypes);

      await waitFor(() => {
        const mockExecute = vi.mocked(useApiModule.useApi).mock.results[0]?.value.execute;
        expect(mockExecute).toHaveBeenCalled();
      }, { timeout: 3000 });

      // Button should NOT be visible when no types exist
      const buttonVisible = isAddMemberButtonVisible(container);
      expect(buttonVisible).toBe(false);
    });

    it('should hide Add Member button during loading state', async () => {
      const membershipTypes = [
        { id: 'type-1', name: 'Standard Membership', organisationId: mockOrganisation.id },
      ];

      const { container } = renderMembersDatabasePage(membershipTypes);

      // Immediately check - button should not be visible during loading
      const buttonVisibleDuringLoad = isAddMemberButtonVisible(container);
      expect(buttonVisibleDuringLoad).toBe(false);

      // Wait for loading to complete
      await waitFor(() => {
        const mockExecute = vi.mocked(useApiModule.useApi).mock.results[0]?.value.execute;
        expect(mockExecute).toHaveBeenCalled();
      }, { timeout: 3000 });

      // Button should be visible after loading
      const buttonVisibleAfterLoad = isAddMemberButtonVisible(container);
      expect(buttonVisibleAfterLoad).toBe(true);
    });
  });

  describe('Navigation with Single Type - Requirement 2.2', () => {
    it('should navigate directly to create page with typeId when single type exists', async () => {
      const membershipTypes = [
        {
          id: 'single-type-id',
          name: 'Standard Membership',
          organisationId: mockOrganisation.id,
        },
      ];

      mockNavigate.mockClear();

      const { container } = renderMembersDatabasePage(membershipTypes);

      await waitFor(() => {
        const mockExecute = vi.mocked(useApiModule.useApi).mock.results[0]?.value.execute;
        expect(mockExecute).toHaveBeenCalled();
      }, { timeout: 3000 });

      // Click the Add Member button
      const buttonClicked = clickAddMemberButton(container);
      expect(buttonClicked).toBe(true);

      // Should navigate with typeId parameter
      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith(
          '/orgadmin/memberships/members/create?typeId=single-type-id'
        );
      });
    });

    it('should automatically select the single membership type without showing selector', async () => {
      const membershipTypes = [
        {
          id: 'auto-select-type',
          name: 'Premium Membership',
          description: 'Premium membership with benefits',
          organisationId: mockOrganisation.id,
        },
      ];

      mockNavigate.mockClear();

      const { container } = renderMembersDatabasePage(membershipTypes);

      await waitFor(() => {
        const mockExecute = vi.mocked(useApiModule.useApi).mock.results[0]?.value.execute;
        expect(mockExecute).toHaveBeenCalled();
      }, { timeout: 3000 });

      // Click the Add Member button
      clickAddMemberButton(container);

      // Should navigate directly (not to type selector)
      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledTimes(1);
        const navigationUrl = mockNavigate.mock.calls[0][0];
        
        // Should include typeId parameter (indicating auto-selection)
        expect(navigationUrl).toContain('typeId=');
        expect(navigationUrl).toContain('auto-select-type');
      });
    });

    it('should not navigate to plain create URL when single type exists', async () => {
      const membershipTypes = [
        {
          id: 'type-123',
          name: 'Basic Membership',
          organisationId: mockOrganisation.id,
        },
      ];

      mockNavigate.mockClear();

      const { container } = renderMembersDatabasePage(membershipTypes);

      await waitFor(() => {
        const mockExecute = vi.mocked(useApiModule.useApi).mock.results[0]?.value.execute;
        expect(mockExecute).toHaveBeenCalled();
      }, { timeout: 3000 });

      // Click the Add Member button
      clickAddMemberButton(container);

      // Should NOT navigate to the plain create URL (without typeId)
      await waitFor(() => {
        expect(mockNavigate).not.toHaveBeenCalledWith('/orgadmin/memberships/members/create');
        
        // Should have been called with typeId parameter
        const navigationUrl = mockNavigate.mock.calls[0][0];
        expect(navigationUrl).toMatch(/typeId=/);
      });
    });
  });

  describe('Navigation with Multiple Types - Requirement 2.1', () => {
    it('should navigate to type selector when multiple types exist (count = 2)', async () => {
      const membershipTypes = [
        { id: 'type-1', name: 'Standard Membership', organisationId: mockOrganisation.id },
        { id: 'type-2', name: 'Premium Membership', organisationId: mockOrganisation.id },
      ];

      mockNavigate.mockClear();

      const { container } = renderMembersDatabasePage(membershipTypes);

      await waitFor(() => {
        const mockExecute = vi.mocked(useApiModule.useApi).mock.results[0]?.value.execute;
        expect(mockExecute).toHaveBeenCalled();
      }, { timeout: 3000 });

      // Click the Add Member button
      const buttonClicked = clickAddMemberButton(container);
      expect(buttonClicked).toBe(true);

      // Should navigate to plain create URL (type selector)
      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/orgadmin/memberships/members/create');
      });
    });

    it('should navigate to type selector when multiple types exist (count = 5)', async () => {
      const membershipTypes = [
        { id: 'type-1', name: 'Standard', organisationId: mockOrganisation.id },
        { id: 'type-2', name: 'Premium', organisationId: mockOrganisation.id },
        { id: 'type-3', name: 'VIP', organisationId: mockOrganisation.id },
        { id: 'type-4', name: 'Corporate', organisationId: mockOrganisation.id },
        { id: 'type-5', name: 'Student', organisationId: mockOrganisation.id },
      ];

      mockNavigate.mockClear();

      const { container } = renderMembersDatabasePage(membershipTypes);

      await waitFor(() => {
        const mockExecute = vi.mocked(useApiModule.useApi).mock.results[0]?.value.execute;
        expect(mockExecute).toHaveBeenCalled();
      }, { timeout: 3000 });

      // Click the Add Member button
      clickAddMemberButton(container);

      // Should navigate to type selector
      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/orgadmin/memberships/members/create');
      });
    });

    it('should not include typeId parameter when multiple types exist', async () => {
      const membershipTypes = [
        { id: 'type-a', name: 'Type A', organisationId: mockOrganisation.id },
        { id: 'type-b', name: 'Type B', organisationId: mockOrganisation.id },
        { id: 'type-c', name: 'Type C', organisationId: mockOrganisation.id },
      ];

      mockNavigate.mockClear();

      const { container } = renderMembersDatabasePage(membershipTypes);

      await waitFor(() => {
        const mockExecute = vi.mocked(useApiModule.useApi).mock.results[0]?.value.execute;
        expect(mockExecute).toHaveBeenCalled();
      }, { timeout: 3000 });

      // Click the Add Member button
      clickAddMemberButton(container);

      // URL should NOT contain typeId when multiple types exist
      await waitFor(() => {
        const navigationUrl = mockNavigate.mock.calls[0][0];
        expect(navigationUrl).not.toContain('typeId');
        expect(navigationUrl).toBe('/orgadmin/memberships/members/create');
      });
    });
  });

  describe('Edge Cases and Boundary Conditions', () => {
    it('should handle exactly one membership type (boundary case)', async () => {
      const membershipTypes = [
        { id: 'boundary-type', name: 'Boundary Type', organisationId: mockOrganisation.id },
      ];

      mockNavigate.mockClear();

      const { container } = renderMembersDatabasePage(membershipTypes);

      await waitFor(() => {
        const mockExecute = vi.mocked(useApiModule.useApi).mock.results[0]?.value.execute;
        expect(mockExecute).toHaveBeenCalled();
      }, { timeout: 3000 });

      // Button should be visible
      const buttonVisible = isAddMemberButtonVisible(container);
      expect(buttonVisible).toBe(true);

      // Click and verify navigation
      clickAddMemberButton(container);

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith(
          '/orgadmin/memberships/members/create?typeId=boundary-type'
        );
      });
    });

    it('should handle exactly two membership types (boundary case)', async () => {
      const membershipTypes = [
        { id: 'type-first', name: 'First Type', organisationId: mockOrganisation.id },
        { id: 'type-second', name: 'Second Type', organisationId: mockOrganisation.id },
      ];

      mockNavigate.mockClear();

      const { container } = renderMembersDatabasePage(membershipTypes);

      await waitFor(() => {
        const mockExecute = vi.mocked(useApiModule.useApi).mock.results[0]?.value.execute;
        expect(mockExecute).toHaveBeenCalled();
      }, { timeout: 3000 });

      // Button should be visible
      const buttonVisible = isAddMemberButtonVisible(container);
      expect(buttonVisible).toBe(true);

      // Click and verify navigation to selector
      clickAddMemberButton(container);

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/orgadmin/memberships/members/create');
      });
    });

    it('should handle membership type with minimal data', async () => {
      const membershipTypes = [
        {
          id: 'minimal-type',
          name: 'M',
          organisationId: mockOrganisation.id,
        },
      ];

      mockNavigate.mockClear();

      const { container } = renderMembersDatabasePage(membershipTypes);

      await waitFor(() => {
        const mockExecute = vi.mocked(useApiModule.useApi).mock.results[0]?.value.execute;
        expect(mockExecute).toHaveBeenCalled();
      }, { timeout: 3000 });

      // Click the Add Member button
      clickAddMemberButton(container);

      // Should navigate with typeId even with minimal data
      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith(
          '/orgadmin/memberships/members/create?typeId=minimal-type'
        );
      });
    });

    it('should handle membership type with additional properties', async () => {
      const membershipTypes = [
        {
          id: 'full-type',
          name: 'Full Membership',
          description: 'A complete membership with all features',
          organisationId: mockOrganisation.id,
          membershipFormId: 'form-123',
          automaticallyApprove: true,
          isRollingMembership: false,
          numberOfMonths: 12,
        },
      ];

      mockNavigate.mockClear();

      const { container } = renderMembersDatabasePage(membershipTypes);

      await waitFor(() => {
        const mockExecute = vi.mocked(useApiModule.useApi).mock.results[0]?.value.execute;
        expect(mockExecute).toHaveBeenCalled();
      }, { timeout: 3000 });

      // Click the Add Member button
      clickAddMemberButton(container);

      // Should navigate correctly regardless of additional properties
      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith(
          '/orgadmin/memberships/members/create?typeId=full-type'
        );
      });
    });
  });

  describe('Integration with Existing Features', () => {
    it('should display Add Member button alongside existing page elements', async () => {
      const membershipTypes = [
        { id: 'type-1', name: 'Standard', organisationId: mockOrganisation.id },
      ];

      const { container } = renderMembersDatabasePage(membershipTypes);

      await waitFor(() => {
        const mockExecute = vi.mocked(useApiModule.useApi).mock.results[0]?.value.execute;
        expect(mockExecute).toHaveBeenCalled();
      }, { timeout: 3000 });

      // Verify Add Member button exists
      const addMemberButton = isAddMemberButtonVisible(container);
      expect(addMemberButton).toBe(true);

      // Verify existing elements still exist
      const buttons = Array.from(container.querySelectorAll('button'));
      const exportButton = buttons.some(btn => btn.textContent?.includes('Export to Excel'));
      expect(exportButton).toBe(true);
    });

    it('should not interfere with existing filter functionality', async () => {
      const membershipTypes = [
        { id: 'type-1', name: 'Standard', organisationId: mockOrganisation.id },
      ];

      const { container } = renderMembersDatabasePage(membershipTypes);

      await waitFor(() => {
        const mockExecute = vi.mocked(useApiModule.useApi).mock.results[0]?.value.execute;
        expect(mockExecute).toHaveBeenCalled();
      }, { timeout: 3000 });

      // Verify filter buttons still exist
      const buttons = Array.from(container.querySelectorAll('button'));
      const currentButton = buttons.some(btn => btn.textContent?.includes('Current'));
      const elapsedButton = buttons.some(btn => btn.textContent?.includes('Elapsed'));
      const allButton = buttons.some(btn => btn.textContent?.includes('All'));

      expect(currentButton).toBe(true);
      expect(elapsedButton).toBe(true);
      expect(allButton).toBe(true);
    });
  });
});
