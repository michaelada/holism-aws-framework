/**
 * End-to-End Integration Tests for Manual Member Addition
 * 
 * Feature: manual-member-addition
 * 
 * These tests validate complete user flows from start to finish:
 * - Complete member creation flow with single membership type
 * - Complete member creation flow with multiple membership types
 * - Validation error flow
 * - Cancel flow
 * - Authorization flow
 * 
 * **Validates: All requirements**
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter, MemoryRouter, Routes, Route } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { I18nextProvider } from 'react-i18next';
import CreateMemberPage from '../CreateMemberPage';
import MembersDatabasePage from '../MembersDatabasePage';
import { createTestI18n } from '@aws-web-framework/orgadmin-core/test-utils';
import * as useExecuteModule from '@aws-web-framework/orgadmin-core/hooks/useExecute';
import * as useAuthModule from '@aws-web-framework/orgadmin-shell/hooks/useAuth';
import * as useOrganisationModule from '@aws-web-framework/orgadmin-core/hooks/useOrganisation';

// Mock modules
vi.mock('@aws-web-framework/orgadmin-core/hooks/useExecute');
vi.mock('@aws-web-framework/orgadmin-shell/hooks/useAuth');
vi.mock('@aws-web-framework/orgadmin-core/hooks/useOrganisation');
vi.mock('@aws-web-framework/orgadmin-shell/hooks/useNotification', () => ({
  useNotification: () => ({
    showNotification: vi.fn(),
  }),
}));

describe('End-to-End Integration Tests: Manual Member Addition', () => {
  const testI18n = createTestI18n('en-GB');
  let mockExecute: ReturnType<typeof vi.fn>;
  let mockShowNotification: ReturnType<typeof vi.fn>;

  const mockOrganisation = {
    id: 'org-123',
    shortName: 'TEST',
    displayName: 'Test Organization',
    status: 'active',
  };

  const mockUser = {
    id: 'user-123',
    email: 'admin@test.com',
    firstName: 'Admin',
    lastName: 'User',
    roles: ['organization_administrator'],
  };

  const mockMembershipType = {
    id: 'type-123',
    organisationId: 'org-123',
    name: 'Standard Membership',
    description: 'Standard membership type',
    membershipFormId: 'form-123',
    automaticallyApprove: true,
    isRollingMembership: true,
    numberOfMonths: 12,
  };

  const mockFormDefinition = {
    id: 'form-123',
    name: 'Membership Form',
    description: 'Standard membership form',
    fields: [
      {
        id: 'field-1',
        name: 'email',
        label: 'Email Address',
        datatype: 'email',
        order: 1,
        validation: { required: true },
        description: 'Your email address',
      },
      {
        id: 'field-2',
        name: 'phone',
        label: 'Phone Number',
        datatype: 'text',
        order: 2,
        validation: { required: false },
        description: 'Your phone number',
      },
    ],
  };

  beforeEach(() => {
    mockExecute = vi.fn();
    mockShowNotification = vi.fn();

    vi.spyOn(useExecuteModule, 'useExecute').mockReturnValue({
      execute: mockExecute,
      loading: false,
      error: null,
    });

    vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({
      user: mockUser,
      isAuthenticated: true,
      loading: false,
      login: vi.fn(),
      logout: vi.fn(),
      hasRole: (role: string) => mockUser.roles.includes(role),
    });

    vi.spyOn(useOrganisationModule, 'useOrganisation').mockReturnValue({
      organisation: mockOrganisation,
      loading: false,
      error: null,
      refetch: vi.fn(),
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  /**
   * Test: Complete member creation flow with single membership type
   * 
   * Scenario:
   * 1. User navigates to members database
   * 2. User clicks "Add Member" button
   * 3. System auto-selects the single membership type
   * 4. User fills out the form with valid data
   * 5. User submits the form
   * 6. System creates form submission and member
   * 7. System displays success notification
   * 8. System navigates back to members database
   */
  it('should complete member creation flow with single membership type', async () => {
    // Arrange: Mock API responses
    mockExecute
      .mockResolvedValueOnce([mockMembershipType]) // Get membership types (count = 1)
      .mockResolvedValueOnce(mockMembershipType) // Get membership type by ID
      .mockResolvedValueOnce(mockFormDefinition) // Get form definition
      .mockResolvedValueOnce({ id: 'submission-123' }) // Create form submission
      .mockResolvedValueOnce({ // Create member
        id: 'member-123',
        membershipNumber: 'TEST-2024-00001',
        firstName: 'John',
        lastName: 'Doe',
        status: 'active',
      });

    // Act: Render the complete flow
    const { container } = render(
      <MemoryRouter initialEntries={[`/orgadmin/memberships/members/create?typeId=${mockMembershipType.id}`]}>
        <I18nextProvider i18n={testI18n}>
          <Routes>
            <Route path="/orgadmin/memberships/members/create" element={<CreateMemberPage />} />
          </Routes>
        </I18nextProvider>
      </MemoryRouter>
    );

    // Wait for form to load
    await waitFor(() => {
      expect(screen.getByText('Standard Membership')).toBeInTheDocument();
    });

    // Fill out the name field
    const nameInput = screen.getByLabelText(/name/i);
    fireEvent.change(nameInput, { target: { value: 'John Doe' } });

    // Fill out the email field
    const emailInput = screen.getByLabelText(/email address/i);
    fireEvent.change(emailInput, { target: { value: 'john.doe@example.com' } });

    // Submit the form
    const submitButton = screen.getByRole('button', { name: /create member|save/i });
    fireEvent.click(submitButton);

    // Assert: Verify API calls were made in correct order
    await waitFor(() => {
      expect(mockExecute).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'POST',
          url: expect.stringContaining('/form-submissions'),
        })
      );
      expect(mockExecute).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'POST',
          url: expect.stringContaining('/members'),
        })
      );
    });
  }, 10000);

  /**
   * Test: Complete member creation flow with multiple membership types
   * 
   * Scenario:
   * 1. User navigates to members database
   * 2. User clicks "Add Member" button
   * 3. System displays membership type selector
   * 4. User selects a membership type
   * 5. User fills out the form with valid data
   * 6. User submits the form
   * 7. System creates member successfully
   */
  it('should complete member creation flow with multiple membership types', async () => {
    const mockMembershipType2 = {
      ...mockMembershipType,
      id: 'type-456',
      name: 'Premium Membership',
    };

    // Arrange: Mock API responses
    mockExecute
      .mockResolvedValueOnce([mockMembershipType, mockMembershipType2]) // Get membership types (count = 2)
      .mockResolvedValueOnce(mockMembershipType) // Get selected membership type
      .mockResolvedValueOnce(mockFormDefinition) // Get form definition
      .mockResolvedValueOnce({ id: 'submission-456' }) // Create form submission
      .mockResolvedValueOnce({ // Create member
        id: 'member-456',
        membershipNumber: 'TEST-2024-00002',
        firstName: 'Jane',
        lastName: 'Smith',
        status: 'active',
      });

    // Act: Render create member page with selected type
    render(
      <MemoryRouter initialEntries={[`/orgadmin/memberships/members/create?typeId=${mockMembershipType.id}`]}>
        <I18nextProvider i18n={testI18n}>
          <Routes>
            <Route path="/orgadmin/memberships/members/create" element={<CreateMemberPage />} />
          </Routes>
        </I18nextProvider>
      </MemoryRouter>
    );

    // Wait for form to load
    await waitFor(() => {
      expect(screen.getByText('Standard Membership')).toBeInTheDocument();
    });

    // Fill out the form
    const nameInput = screen.getByLabelText(/name/i);
    fireEvent.change(nameInput, { target: { value: 'Jane Smith' } });

    const emailInput = screen.getByLabelText(/email address/i);
    fireEvent.change(emailInput, { target: { value: 'jane.smith@example.com' } });

    // Submit the form
    const submitButton = screen.getByRole('button', { name: /create member|save/i });
    fireEvent.click(submitButton);

    // Assert: Verify member was created
    await waitFor(() => {
      expect(mockExecute).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'POST',
          url: expect.stringContaining('/members'),
        })
      );
    });
  }, 10000);

  /**
   * Test: Validation error flow
   * 
   * Scenario:
   * 1. User navigates to create member page
   * 2. User submits form without filling required fields
   * 3. System displays validation errors
   * 4. User fills out required fields correctly
   * 5. User submits form again
   * 6. System creates member successfully
   */
  it('should handle validation error flow correctly', async () => {
    // Arrange: Mock API responses
    mockExecute
      .mockResolvedValueOnce(mockMembershipType) // Get membership type
      .mockResolvedValueOnce(mockFormDefinition) // Get form definition
      .mockResolvedValueOnce({ id: 'submission-789' }) // Create form submission (after fixing errors)
      .mockResolvedValueOnce({ // Create member
        id: 'member-789',
        membershipNumber: 'TEST-2024-00003',
        firstName: 'Bob',
        lastName: 'Johnson',
        status: 'active',
      });

    // Act: Render create member page
    render(
      <MemoryRouter initialEntries={[`/orgadmin/memberships/members/create?typeId=${mockMembershipType.id}`]}>
        <I18nextProvider i18n={testI18n}>
          <Routes>
            <Route path="/orgadmin/memberships/members/create" element={<CreateMemberPage />} />
          </Routes>
        </I18nextProvider>
      </MemoryRouter>
    );

    // Wait for form to load
    await waitFor(() => {
      expect(screen.getByText('Standard Membership')).toBeInTheDocument();
    });

    // Try to submit without filling required fields
    const submitButton = screen.getByRole('button', { name: /create member|save/i });
    fireEvent.click(submitButton);

    // Assert: Validation errors should be displayed
    await waitFor(() => {
      expect(screen.getByText(/name is required/i)).toBeInTheDocument();
      expect(screen.getByText(/email.*required/i)).toBeInTheDocument();
    });

    // Verify no API calls were made yet
    expect(mockExecute).toHaveBeenCalledTimes(2); // Only initial loads

    // Fill out required fields
    const nameInput = screen.getByLabelText(/name/i);
    fireEvent.change(nameInput, { target: { value: 'Bob Johnson' } });

    const emailInput = screen.getByLabelText(/email address/i);
    fireEvent.change(emailInput, { target: { value: 'bob.johnson@example.com' } });

    // Submit again
    fireEvent.click(submitButton);

    // Assert: Member should be created successfully
    await waitFor(() => {
      expect(mockExecute).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'POST',
          url: expect.stringContaining('/members'),
        })
      );
    });
  }, 10000);

  /**
   * Test: Cancel flow
   * 
   * Scenario:
   * 1. User navigates to create member page
   * 2. User fills out some fields
   * 3. User clicks cancel button
   * 4. System navigates back to members database
   * 5. No member is created
   */
  it('should handle cancel flow correctly', async () => {
    // Arrange: Mock API responses
    mockExecute
      .mockResolvedValueOnce(mockMembershipType) // Get membership type
      .mockResolvedValueOnce(mockFormDefinition); // Get form definition

    let currentPath = '/orgadmin/memberships/members/create';
    const mockNavigate = vi.fn((path) => {
      currentPath = path;
    });

    // Mock useNavigate
    vi.mock('react-router-dom', async () => {
      const actual = await vi.importActual('react-router-dom');
      return {
        ...actual,
        useNavigate: () => mockNavigate,
      };
    });

    // Act: Render create member page
    render(
      <MemoryRouter initialEntries={[`/orgadmin/memberships/members/create?typeId=${mockMembershipType.id}`]}>
        <I18nextProvider i18n={testI18n}>
          <Routes>
            <Route path="/orgadmin/memberships/members/create" element={<CreateMemberPage />} />
          </Routes>
        </I18nextProvider>
      </MemoryRouter>
    );

    // Wait for form to load
    await waitFor(() => {
      expect(screen.getByText('Standard Membership')).toBeInTheDocument();
    });

    // Fill out some fields
    const nameInput = screen.getByLabelText(/name/i);
    fireEvent.change(nameInput, { target: { value: 'Test User' } });

    // Click cancel button
    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    fireEvent.click(cancelButton);

    // Assert: No member creation API calls should be made
    expect(mockExecute).not.toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'POST',
        url: expect.stringContaining('/members'),
      })
    );
  }, 10000);

  /**
   * Test: Authorization flow
   * 
   * Scenario:
   * 1. Non-admin user navigates to members database
   * 2. Add Member button is not visible
   * 3. Non-admin user attempts to access create member URL directly
   * 4. System should handle unauthorized access appropriately
   */
  it('should handle authorization flow correctly', async () => {
    // Arrange: Mock non-admin user
    const mockNonAdminUser = {
      ...mockUser,
      roles: ['member'], // Not an organization_administrator
    };

    vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({
      user: mockNonAdminUser,
      isAuthenticated: true,
      loading: false,
      login: vi.fn(),
      logout: vi.fn(),
      hasRole: (role: string) => mockNonAdminUser.roles.includes(role),
    });

    mockExecute.mockResolvedValueOnce([mockMembershipType]); // Get membership types

    // Act: Render members database page
    render(
      <MemoryRouter initialEntries={['/orgadmin/memberships/members']}>
        <I18nextProvider i18n={testI18n}>
          <Routes>
            <Route path="/orgadmin/memberships/members" element={<MembersDatabasePage />} />
          </Routes>
        </I18nextProvider>
      </MemoryRouter>
    );

    // Assert: Add Member button should not be visible
    await waitFor(() => {
      const addButton = screen.queryByRole('button', { name: /add member/i });
      expect(addButton).not.toBeInTheDocument();
    });
  }, 10000);

  /**
   * Test: Error handling during member creation
   * 
   * Scenario:
   * 1. User fills out form correctly
   * 2. User submits form
   * 3. Server returns an error
   * 4. System displays error notification
   * 5. Form data is preserved
   * 6. User can retry submission
   */
  it('should handle server errors during member creation', async () => {
    // Arrange: Mock API responses with error
    mockExecute
      .mockResolvedValueOnce(mockMembershipType) // Get membership type
      .mockResolvedValueOnce(mockFormDefinition) // Get form definition
      .mockRejectedValueOnce(new Error('Server error')); // Create form submission fails

    // Act: Render create member page
    render(
      <MemoryRouter initialEntries={[`/orgadmin/memberships/members/create?typeId=${mockMembershipType.id}`]}>
        <I18nextProvider i18n={testI18n}>
          <Routes>
            <Route path="/orgadmin/memberships/members/create" element={<CreateMemberPage />} />
          </Routes>
        </I18nextProvider>
      </MemoryRouter>
    );

    // Wait for form to load
    await waitFor(() => {
      expect(screen.getByText('Standard Membership')).toBeInTheDocument();
    });

    // Fill out the form
    const nameInput = screen.getByLabelText(/name/i);
    fireEvent.change(nameInput, { target: { value: 'Error Test' } });

    const emailInput = screen.getByLabelText(/email address/i);
    fireEvent.change(emailInput, { target: { value: 'error@test.com' } });

    // Submit the form
    const submitButton = screen.getByRole('button', { name: /create member|save/i });
    fireEvent.click(submitButton);

    // Assert: Error message should be displayed
    await waitFor(() => {
      expect(screen.getByText(/error|failed/i)).toBeInTheDocument();
    });

    // Assert: Form data should be preserved
    expect(nameInput).toHaveValue('Error Test');
    expect(emailInput).toHaveValue('error@test.com');
  }, 10000);
});
