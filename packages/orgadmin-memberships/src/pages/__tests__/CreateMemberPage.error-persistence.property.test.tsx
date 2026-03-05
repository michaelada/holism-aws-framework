/**
 * Property-Based Tests for Error Handling and Form Persistence
 * 
 * Feature: manual-member-addition
 * Property 13: Error Handling and Form Persistence
 * 
 * **Validates: Requirements 4.7**
 * 
 * For any member creation attempt that fails due to server error or validation error,
 * the system should display an error message and remain on the member creation form
 * without losing the entered data.
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

describe('Feature: manual-member-addition, Property 13: Error Handling and Form Persistence', () => {
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
  
  // Generator for field datatypes
  const fieldDatatypeArb = fc.constantFrom(
    'text',
    'textarea',
    'number',
    'email'
  );

  // Generator for a single form field
  const formFieldArb = fc.record({
    id: fc.uuid(),
    name: fc.string({ minLength: 3, maxLength: 30 })
      .filter(s => s.trim().length > 0)
      .map(s => s.replace(/[^a-zA-Z0-9_]/g, '_').replace(/^_+|_+$/g, '') || 'field'),
    label: fc.string({ minLength: 2, maxLength: 50 }).filter(s => s.trim().length > 0),
    datatype: fieldDatatypeArb,
    order: fc.integer({ min: 1, max: 100 }),
    validation: fc.record({
      required: fc.boolean(),
      rules: fc.constant([]),
    }),
  });

  // Generator for form definition
  const formDefinitionArb = fc.record({
    id: fc.uuid(),
    name: fc.string({ minLength: 2, maxLength: 50 }).filter(s => s.trim().length > 0),
    fields: fc.array(formFieldArb, { minLength: 1, maxLength: 3 }),
  }).map(def => {
    // Ensure unique field names
    const uniqueFields = def.fields.map((field, index) => ({
      ...field,
      name: `${field.name}_${index}`,
      id: fc.sample(fc.uuid(), 1)[0],
    }));
    return {
      ...def,
      fields: uniqueFields,
    };
  });

  // Generator for member name
  const memberNameArb = fc.string({ minLength: 2, maxLength: 100 })
    .filter(s => s.trim().length > 0);

  // Generator for error messages
  const errorMessageArb = fc.oneof(
    fc.constant('Failed to create member'),
    fc.constant('Network error'),
    fc.constant('Server error')
  );

  /**
   * Helper function to render CreateMemberPage with mocked API responses
   */
  const renderCreateMemberPage = (
    formDefinition: any,
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

  it('should preserve form data when form submission fails', async () => {
    await fc.assert(
      fc.asyncProperty(
        formDefinitionArb,
        memberNameArb,
        errorMessageArb,
        async (formDefinition, memberName, errorMessage) => {
          const membershipType = {
            id: fc.sample(fc.uuid(), 1)[0],
            name: 'Test Membership Type',
            organisationId: mockOrganisation.id,
            membershipFormId: formDefinition.id,
            automaticallyApprove: true,
          };

          const fieldValues: Record<string, string> = {};

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
              // Simulate form submission failure
              return Promise.reject(new Error(errorMessage));
            }
            return Promise.resolve(null);
          });

          const { container, getByTestId, unmount } = renderCreateMemberPage(
            formDefinition,
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

            // Fill in all dynamic fields
            for (const field of formDefinition.fields) {
              const fieldInput = container.querySelector(
                `[data-testid="field-input-${field.name}"]`
              ) as HTMLInputElement;
              
              if (fieldInput) {
                let value: string;
                if (field.datatype === 'email') {
                  value = `test_${field.name}@example.com`;
                } else if (field.datatype === 'number') {
                  value = String(Math.floor(Math.random() * 1000));
                } else {
                  value = `value_for_${field.name}`;
                }
                fieldValues[field.name] = value;
                fireEvent.change(fieldInput, { target: { value } });
              }
            }

            // Submit the form
            const submitButton = getByTestId('submit-button');
            fireEvent.click(submitButton);

            // Wait for error to be displayed
            await waitFor(() => {
              const errorAlert = getByTestId('error-alert');
              expect(errorAlert).toBeDefined();
            }, { timeout: 3000 });

            // Property: Error message should be displayed
            const errorAlert = getByTestId('error-alert');
            expect(errorAlert.textContent).toContain(errorMessage);

            // Property: Form should remain on the same page (not navigate away)
            const pageTitle = container.querySelector('h4');
            expect(pageTitle?.textContent).toBe('Add New Member');

            // Property: Name field value should be preserved
            const nameInputAfterError = getByTestId('name-input') as HTMLInputElement;
            expect(nameInputAfterError.value).toBe(memberName);

            // Property: All dynamic field values should be preserved
            for (const field of formDefinition.fields) {
              const fieldInput = container.querySelector(
                `[data-testid="field-input-${field.name}"]`
              ) as HTMLInputElement;
              
              if (fieldInput && fieldValues[field.name]) {
                expect(fieldInput.value).toBe(fieldValues[field.name]);
              }
            }
          } finally {
            unmount();
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should preserve form data when member creation fails', async () => {
    await fc.assert(
      fc.asyncProperty(
        formDefinitionArb,
        memberNameArb,
        errorMessageArb,
        async (formDefinition, memberName, errorMessage) => {
          const membershipType = {
            id: fc.sample(fc.uuid(), 1)[0],
            name: 'Test Membership Type',
            organisationId: mockOrganisation.id,
            membershipFormId: formDefinition.id,
            automaticallyApprove: true,
          };

          const fieldValues: Record<string, string> = {};

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
              return Promise.resolve({
                id: fc.sample(fc.uuid(), 1)[0],
              });
            }
            if (url.includes('/members') && method === 'POST') {
              // Simulate member creation failure
              return Promise.reject(new Error(errorMessage));
            }
            return Promise.resolve(null);
          });

          const { container, getByTestId, unmount } = renderCreateMemberPage(
            formDefinition,
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

            // Fill in all dynamic fields
            for (const field of formDefinition.fields) {
              const fieldInput = container.querySelector(
                `[data-testid="field-input-${field.name}"]`
              ) as HTMLInputElement;
              
              if (fieldInput) {
                let value: string;
                if (field.datatype === 'email') {
                  value = `test_${field.name}@example.com`;
                } else if (field.datatype === 'number') {
                  value = String(Math.floor(Math.random() * 1000));
                } else {
                  value = `value_for_${field.name}`;
                }
                fieldValues[field.name] = value;
                fireEvent.change(fieldInput, { target: { value } });
              }
            }

            // Submit the form
            const submitButton = getByTestId('submit-button');
            fireEvent.click(submitButton);

            // Wait for error to be displayed
            await waitFor(() => {
              const errorAlert = getByTestId('error-alert');
              expect(errorAlert).toBeDefined();
            }, { timeout: 3000 });

            // Property: Error message should be displayed
            const errorAlert = getByTestId('error-alert');
            expect(errorAlert.textContent).toContain(errorMessage);

            // Property: Form should remain on the same page
            const pageTitle = container.querySelector('h4');
            expect(pageTitle?.textContent).toBe('Add New Member');

            // Property: Name field value should be preserved
            const nameInputAfterError = getByTestId('name-input') as HTMLInputElement;
            expect(nameInputAfterError.value).toBe(memberName);

            // Property: All dynamic field values should be preserved
            for (const field of formDefinition.fields) {
              const fieldInput = container.querySelector(
                `[data-testid="field-input-${field.name}"]`
              ) as HTMLInputElement;
              
              if (fieldInput && fieldValues[field.name]) {
                expect(fieldInput.value).toBe(fieldValues[field.name]);
              }
            }
          } finally {
            unmount();
          }
        }
      ),
      { numRuns: 50 }
    );
  });
});
