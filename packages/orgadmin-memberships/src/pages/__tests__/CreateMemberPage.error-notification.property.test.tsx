/**
 * Property-Based Tests for Error Notification Display
 * 
 * Feature: manual-member-addition
 * Property 19: Error Notification Display
 * 
 * **Validates: Requirements 9.2, 9.3**
 * 
 * For any failed member creation (server error or validation error), the system should
 * display an appropriate error notification with a descriptive message.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, waitFor, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import fc from 'fast-check';
import CreateMemberPage from '../CreateMemberPage';
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

// Mock FieldRenderer component
vi.mock('@aws-web-framework/components', () => ({
  FieldRenderer: ({ fieldDefinition, value, onChange, onBlur, disabled, required, error }: any) => (
    <div
      data-testid={`field-${fieldDefinition.shortName}`}
      data-field-name={fieldDefinition.shortName}
    >
      <label>{fieldDefinition.displayName}</label>
      <input
        type="text"
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        disabled={disabled}
        required={required}
        data-testid={`field-input-${fieldDefinition.shortName}`}
      />
      {error && (
        <span data-testid={`field-error-${fieldDefinition.shortName}`}>{error}</span>
      )}
    </div>
  ),
}));

describe('Feature: manual-member-addition, Property 19: Error Notification Display', () => {
  const testI18n = createTestI18n('en-GB');
  
  // Add translations
  testI18n.addResourceBundle('en-GB', 'translation', {
    memberships: {
      ...testI18n.getResourceBundle('en-GB', 'translation').memberships,
      addMember: 'Add New Member',
      name: 'Name',
      createMember: 'Create Member',
      creating: 'Creating...',
      memberCreatedSuccessfully: 'Member created successfully',
    },
    common: {
      ...testI18n.getResourceBundle('en-GB', 'translation').common,
      cancel: 'Cancel',
    },
  }, true, true);

  const mockOrganisation = {
    id: 'test-org-id',
    name: 'Test Organization',
    shortName: 'TEST',
  };

  const mockCurrentUser = {
    id: 'test-user-id',
    email: 'test@example.com',
  };

  // Cleanup after each test
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  /**
   * Fast-check generators
   */
  
  // Generator for member name
  const memberNameArb = fc.string({ minLength: 2, maxLength: 100 })
    .filter(s => s.trim().length > 0);

  // Generator for error messages
  const errorMessageArb = fc.oneof(
    fc.constant('Failed to create member'),
    fc.constant('Network error'),
    fc.constant('Server error'),
    fc.constant('Database connection failed'),
    fc.constant('Invalid data'),
    fc.constant('Membership type not found'),
    fc.constant('Form submission failed'),
    fc.constant('Validation error'),
    fc.constant('Unauthorized'),
    fc.constant('Forbidden')
  );

  // Generator for error types
  const errorTypeArb = fc.constantFrom(
    'form_submission_error',
    'member_creation_error',
    'network_error',
    'server_error',
    'validation_error'
  );

  /**
   * Helper function to render CreateMemberPage with mocked API responses
   */
  const renderCreateMemberPage = (
    membershipType: any,
    mockExecute: any
  ) => {
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
        <MemoryRouter initialEntries={[`/orgadmin/memberships/members/create?typeId=${membershipType.id}`]}>
          <CreateMemberPage />
        </MemoryRouter>
      </I18nextProvider>
    );
  };

  it('should display error notification for any server error', async () => {
    await fc.assert(
      fc.asyncProperty(
        memberNameArb,
        errorMessageArb,
        async (memberName, errorMessage) => {
          const membershipType = {
            id: fc.sample(fc.uuid(), 1)[0],
            name: 'Test Membership Type',
            organisationId: mockOrganisation.id,
            membershipFormId: fc.sample(fc.uuid(), 1)[0],
            automaticallyApprove: true,
          };

          const formDefinition = {
            id: membershipType.membershipFormId,
            name: 'Test Form',
            fields: [],
          };

          const mockExecute = vi.fn().mockImplementation(({ url, method }) => {
            if (url.includes('/membership-types/')) {
              return Promise.resolve(membershipType);
            }
            if (url.includes('/application-forms/') && url.includes('/with-fields')) {
              return Promise.resolve(formDefinition);
            }
            if (url.includes('/auth/me')) {
              return Promise.resolve({ user: mockCurrentUser });
            }
            if (url.includes('/form-submissions') && method === 'POST') {
              // Always fail form submission for this test
              return Promise.reject(new Error(errorMessage));
            }
            if (url.includes('/members') && method === 'POST') {
              return Promise.resolve({
                id: fc.sample(fc.uuid(), 1)[0],
                membershipNumber: 'TEST-2024-00001',
              });
            }
            return Promise.resolve(null);
          });

          const { container, getByTestId, unmount } = renderCreateMemberPage(
            membershipType,
            mockExecute
          );

          try {
            // Wait for the component to finish loading
            await waitFor(() => {
              const loadingSpinner = container.querySelector('[data-testid="loading-spinner"]');
              expect(loadingSpinner).toBeNull();
            }, { timeout: 3000 });

            // Fill in the name field
            const nameInput = getByTestId('name-input') as HTMLInputElement;
            fireEvent.change(nameInput, { target: { value: memberName } });

            // Submit the form
            const submitButton = getByTestId('submit-button');
            fireEvent.click(submitButton);

            // Wait for error to be displayed
            await waitFor(() => {
              const errorAlert = getByTestId('error-alert');
              expect(errorAlert).toBeDefined();
            }, { timeout: 3000 });

            // Property: Error notification should be displayed
            const errorAlert = getByTestId('error-alert');
            expect(errorAlert).toBeDefined();
            expect(errorAlert).toBeInTheDocument();

            // Property: Error notification should contain the error message
            expect(errorAlert.textContent).toContain(errorMessage);

            // Property: Error notification should be visible (not hidden)
            expect(errorAlert).toBeVisible();

            // Property: Error notification should have error severity (role="alert")
            expect(errorAlert).toHaveAttribute('role', 'alert');
          } finally {
            unmount();
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should display descriptive error messages for different error scenarios', async () => {
    await fc.assert(
      fc.asyncProperty(
        memberNameArb,
        fc.oneof(
          fc.constant('Form submission failed'),
          fc.constant('Failed to create member'),
          fc.constant('Network error'),
          fc.constant('Server error'),
          fc.constant('Database connection failed')
        ),
        async (memberName, errorMessage) => {
          const membershipType = {
            id: fc.sample(fc.uuid(), 1)[0],
            name: 'Test Membership Type',
            organisationId: mockOrganisation.id,
            membershipFormId: fc.sample(fc.uuid(), 1)[0],
            automaticallyApprove: true,
          };

          const formDefinition = {
            id: membershipType.membershipFormId,
            name: 'Test Form',
            fields: [],
          };

          const mockExecute = vi.fn().mockImplementation(({ url, method }) => {
            if (url.includes('/membership-types/')) {
              return Promise.resolve(membershipType);
            }
            if (url.includes('/application-forms/') && url.includes('/with-fields')) {
              return Promise.resolve(formDefinition);
            }
            if (url.includes('/auth/me')) {
              return Promise.resolve({ user: mockCurrentUser });
            }
            if (url.includes('/form-submissions') && method === 'POST') {
              // Always fail form submission for this test
              return Promise.reject(new Error(errorMessage));
            }
            if (url.includes('/members') && method === 'POST') {
              return Promise.resolve({
                id: fc.sample(fc.uuid(), 1)[0],
                membershipNumber: 'TEST-2024-00001',
              });
            }
            return Promise.resolve(null);
          });

          const { container, getByTestId, unmount } = renderCreateMemberPage(
            membershipType,
            mockExecute
          );

          try {
            // Wait for the component to finish loading
            await waitFor(() => {
              const loadingSpinner = container.querySelector('[data-testid="loading-spinner"]');
              expect(loadingSpinner).toBeNull();
            }, { timeout: 3000 });

            // Fill in the name field
            const nameInput = getByTestId('name-input') as HTMLInputElement;
            fireEvent.change(nameInput, { target: { value: memberName } });

            // Submit the form
            const submitButton = getByTestId('submit-button');
            fireEvent.click(submitButton);

            // Wait for error to be displayed
            await waitFor(() => {
              const errorAlert = getByTestId('error-alert');
              expect(errorAlert).toBeDefined();
            }, { timeout: 3000 });

            // Property: Error message should be descriptive and contain expected text
            const errorAlert = getByTestId('error-alert');
            expect(errorAlert.textContent).toContain(errorMessage);
          } finally {
            unmount();
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should display error notification with close button', async () => {
    await fc.assert(
      fc.asyncProperty(
        memberNameArb,
        errorMessageArb,
        async (memberName, errorMessage) => {
          const membershipType = {
            id: fc.sample(fc.uuid(), 1)[0],
            name: 'Test Membership Type',
            organisationId: mockOrganisation.id,
            membershipFormId: fc.sample(fc.uuid(), 1)[0],
            automaticallyApprove: true,
          };

          const formDefinition = {
            id: membershipType.membershipFormId,
            name: 'Test Form',
            fields: [],
          };

          const mockExecute = vi.fn().mockImplementation(({ url, method }) => {
            if (url.includes('/membership-types/')) {
              return Promise.resolve(membershipType);
            }
            if (url.includes('/application-forms/') && url.includes('/with-fields')) {
              return Promise.resolve(formDefinition);
            }
            if (url.includes('/auth/me')) {
              return Promise.resolve({ user: mockCurrentUser });
            }
            if (url.includes('/form-submissions') && method === 'POST') {
              return Promise.reject(new Error(errorMessage));
            }
            return Promise.resolve(null);
          });

          const { container, getByTestId, unmount } = renderCreateMemberPage(
            membershipType,
            mockExecute
          );

          try {
            // Wait for the component to finish loading
            await waitFor(() => {
              const loadingSpinner = container.querySelector('[data-testid="loading-spinner"]');
              expect(loadingSpinner).toBeNull();
            }, { timeout: 3000 });

            // Fill in the name field
            const nameInput = getByTestId('name-input') as HTMLInputElement;
            fireEvent.change(nameInput, { target: { value: memberName } });

            // Submit the form
            const submitButton = getByTestId('submit-button');
            fireEvent.click(submitButton);

            // Wait for error to be displayed
            await waitFor(() => {
              const errorAlert = getByTestId('error-alert');
              expect(errorAlert).toBeDefined();
            }, { timeout: 3000 });

            // Property: Error notification should have a close button
            const errorAlert = getByTestId('error-alert');
            const closeButton = errorAlert.querySelector('[aria-label="Close"]');
            expect(closeButton).toBeDefined();
            expect(closeButton).toBeInTheDocument();

            // Property: Close button should be clickable
            expect(closeButton).not.toBeDisabled();
          } finally {
            unmount();
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should display error notification immediately after submission failure', async () => {
    await fc.assert(
      fc.asyncProperty(
        memberNameArb,
        errorMessageArb,
        async (memberName, errorMessage) => {
          const membershipType = {
            id: fc.sample(fc.uuid(), 1)[0],
            name: 'Test Membership Type',
            organisationId: mockOrganisation.id,
            membershipFormId: fc.sample(fc.uuid(), 1)[0],
            automaticallyApprove: true,
          };

          const formDefinition = {
            id: membershipType.membershipFormId,
            name: 'Test Form',
            fields: [],
          };

          const mockExecute = vi.fn().mockImplementation(({ url, method }) => {
            if (url.includes('/membership-types/')) {
              return Promise.resolve(membershipType);
            }
            if (url.includes('/application-forms/') && url.includes('/with-fields')) {
              return Promise.resolve(formDefinition);
            }
            if (url.includes('/auth/me')) {
              return Promise.resolve({ user: mockCurrentUser });
            }
            if (url.includes('/form-submissions') && method === 'POST') {
              return Promise.reject(new Error(errorMessage));
            }
            return Promise.resolve(null);
          });

          const { container, getByTestId, queryByTestId, unmount } = renderCreateMemberPage(
            membershipType,
            mockExecute
          );

          try {
            // Wait for the component to finish loading
            await waitFor(() => {
              const loadingSpinner = container.querySelector('[data-testid="loading-spinner"]');
              expect(loadingSpinner).toBeNull();
            }, { timeout: 3000 });

            // Property: Error should not be displayed before submission
            let errorAlert = queryByTestId('error-alert');
            expect(errorAlert).toBeNull();

            // Fill in the name field
            const nameInput = getByTestId('name-input') as HTMLInputElement;
            fireEvent.change(nameInput, { target: { value: memberName } });

            // Submit the form
            const submitButton = getByTestId('submit-button');
            fireEvent.click(submitButton);

            // Property: Error should be displayed immediately after submission failure
            await waitFor(() => {
              errorAlert = getByTestId('error-alert');
              expect(errorAlert).toBeDefined();
              expect(errorAlert).toBeVisible();
            }, { timeout: 3000 });
          } finally {
            unmount();
          }
        }
      ),
      { numRuns: 50 }
    );
  });
});
