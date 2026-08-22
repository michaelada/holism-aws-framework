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
import { createTestI18n } from '../../test/i18n-test-utils';
import { authMeResponse } from '../../test/auth-me';

/*
 * `vi.mock` is hoisted to the top of the file no matter where it is written.
 * This one lived inside the cancel-flow test and closed over a `mockNavigate`
 * declared two lines above it, so at hoist time that variable did not exist and
 * every render in the file threw "mockNavigate is not defined".
 */
const { mockNavigate } = vi.hoisted(() => ({ mockNavigate: vi.fn() }));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

const mockUseApi = vi.fn();
const mockUseOrganisation = vi.fn();

vi.mock('@aws-web-framework/orgadmin-core', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return { ...actual, useApi: () => mockUseApi(), useOrganisation: () => mockUseOrganisation() };
});

vi.mock('@aws-web-framework/orgadmin-shell', async () => {
  const { shellMock } = await import('../../test/shell-mock');
  return shellMock();
});


// Mock modules
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


/**
 * Answer by URL, not by call order.
 *
 * Every test here originally queued responses with `mockResolvedValueOnce`, in
 * the order its author expected the page to ask. The page asks a different
 * number of times depending on whether the address names a type, whether it
 * needs the organisation type, and whether it checks roles — so one extra call
 * shifted every later answer onto the wrong question. That is how the by-id
 * fetch came to receive an *array*.
 */
const respondByUrl = (over: Record<string, unknown> = {}) =>
  ({ url, method }: { url: string; method?: string }) => {
    for (const [fragment, value] of Object.entries(over)) {
      if (url.includes(fragment)) return Promise.resolve(value);
    }
    if (url.includes('/auth/me')) {
      return Promise.resolve(authMeResponse());
    }
    if (url.includes('/application-forms')) return Promise.resolve(mockFormDefinition);
    if (url.includes('/form-submissions')) return Promise.resolve({ id: 'submission-1' });
    if (url.includes('/members') && method === 'POST') {
      return Promise.resolve({ id: 'member-1', membershipNumber: 'TEST-1', status: 'active' });
    }
    return Promise.resolve([]);
  };

  beforeEach(() => {
    mockExecute = vi.fn();
    mockShowNotification = vi.fn();

    // The page reads `useApi().execute` and `useOrganisation()`; there is no
    // `useExecute`, no `useAuth`, and `useOrganisation` lives in context, not
    // hooks. This suite was written against all three and so had never run.
    mockUseApi.mockReturnValue({ execute: mockExecute, data: null, error: null, loading: false, reset: vi.fn() });
    mockUseOrganisation.mockReturnValue({ organisation: mockOrganisation });
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
    /*
     * Keyed on the URL rather than an ordered queue. With `?typeId=` in the
     * address the page goes straight to that type and never lists them, so a
     * queue that began with "get membership types" handed the *array* to the
     * by-id call — `membershipFormId` came out undefined and the form never
     * showed its name. A URL-keyed mock cannot be knocked out of step by the
     * page making one more call, or one fewer.
     */
    mockExecute.mockImplementation(({ url, method }: { url: string; method?: string }) => {
      if (url.includes('/auth/me')) {
        return Promise.resolve(authMeResponse());
      }
      if (url.includes(`/membership-types/${mockMembershipType.id}`)) {
        return Promise.resolve(mockMembershipType);
      }
      if (url.includes('/membership-types')) return Promise.resolve([mockMembershipType]);
      if (url.includes('/application-forms')) return Promise.resolve(mockFormDefinition);
      if (url.includes('/form-submissions')) return Promise.resolve({ id: 'submission-123' });
      if (url.includes('/members') && method === 'POST') {
        return Promise.resolve({
          id: 'member-123',
          membershipNumber: 'TEST-2024-00001',
          firstName: 'John',
          lastName: 'Doe',
          status: 'active',
        });
      }
      return Promise.resolve([]);
    });

    // Act: Render the complete flow
    const { container } = render(
      <MemoryRouter initialEntries={[`/members/create?typeId=${mockMembershipType.id}`]}>
        <I18nextProvider i18n={testI18n}>
          <Routes>
            <Route path="/members/create" element={<CreateMemberPage />} />
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
    mockExecute.mockImplementation(
      respondByUrl({
        [`/membership-types/${mockMembershipType.id}`]: mockMembershipType,
        '/membership-types': [mockMembershipType, mockMembershipType2],
      })
    );

    // Act: Render create member page with selected type
    render(
      <MemoryRouter initialEntries={[`/members/create?typeId=${mockMembershipType.id}`]}>
        <I18nextProvider i18n={testI18n}>
          <Routes>
            <Route path="/members/create" element={<CreateMemberPage />} />
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
    mockExecute.mockImplementation(respondByUrl({
        [`/membership-types/${mockMembershipType.id}`]: mockMembershipType,
        '/membership-types': [mockMembershipType],
      }));

    // Act: Render create member page
    render(
      <MemoryRouter initialEntries={[`/members/create?typeId=${mockMembershipType.id}`]}>
        <I18nextProvider i18n={testI18n}>
          <Routes>
            <Route path="/members/create" element={<CreateMemberPage />} />
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

    // Assert: Validation errors should be displayed.
    // `getAllBy`, because more than one field can legitimately say "required"
    // and the exact count is the form's business, not this test's.
    await waitFor(() => {
      expect(screen.getAllByText(/name is required/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/email.*required/i).length).toBeGreaterThan(0);
    });

    /*
     * Nothing was submitted. Counting *all* calls would tie this test to how
     * many the page makes to load itself — which has already changed once and
     * is not what "no API calls were made yet" meant.
     */
    expect(
      mockExecute.mock.calls.some(([{ method }]: [{ method?: string }]) => method === 'POST')
    ).toBe(false);

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


    // Act: Render create member page
    render(
      <MemoryRouter initialEntries={[`/members/create?typeId=${mockMembershipType.id}`]}>
        <I18nextProvider i18n={testI18n}>
          <Routes>
            <Route path="/members/create" element={<CreateMemberPage />} />
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
    /*
     * Whether the Add Member button appears is decided by the roles the page
     * reads from `/api/orgadmin/auth/me`, not by a `useAuth` hook — there is no
     * such hook, which is one of three imaginary imports that stopped this file
     * running at all.
     */
    mockExecute.mockImplementation(({ url }: { url: string }) => {
      if (url.includes('/auth/me')) {
        // A member, not an administrator.
        return Promise.resolve(authMeResponse({ roles: [{ id: 'r2', name: 'member', displayName: 'Member' }] }));
      }
      if (url.includes('/membership-types')) return Promise.resolve([mockMembershipType]);
      return Promise.resolve([]);
    });

    render(
      <MemoryRouter initialEntries={['/members']}>
        <I18nextProvider i18n={testI18n}>
          <Routes>
            <Route path="/members" element={<MembersDatabasePage />} />
          </Routes>
        </I18nextProvider>
      </MemoryRouter>
    );

    // The roles call has been made, so the gate has had its say.
    await waitFor(() => {
      expect(
        mockExecute.mock.calls.some(([{ url }]: [{ url: string }]) => url.includes('/auth/me'))
      ).toBe(true);
    });

    expect(screen.queryByRole('button', { name: /add member/i })).not.toBeInTheDocument();
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
      <MemoryRouter initialEntries={[`/members/create?typeId=${mockMembershipType.id}`]}>
        <I18nextProvider i18n={testI18n}>
          <Routes>
            <Route path="/members/create" element={<CreateMemberPage />} />
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
