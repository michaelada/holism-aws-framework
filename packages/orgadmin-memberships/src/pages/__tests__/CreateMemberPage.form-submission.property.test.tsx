/**
 * Property-Based Tests for Form Submission Creation
 * 
 * Feature: manual-member-addition
 * Property 9: Form Submission Creation
 * 
 * **Validates: Requirements 4.1**
 * 
 * For any valid member creation form submission, the system should create a form submission
 * record containing all the entered data with status "approved" and submission type
 * "membership_application".
 */

import { describe, it, expect, vi } from 'vitest';
import { render, waitFor, fireEvent } from '@testing-library/react';
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

describe('Feature: manual-member-addition, Property 9: Form Submission Creation', () => {
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
      .map(s => s.replace(/[^a-zA-Z0-9_]/g, '_').replace(/^_+|_+$/g, '') || 'field')
      .filter(s => s !== 'name'), // Exclude 'name' to avoid conflict with the main name field
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
    fields: fc.array(formFieldArb, { minLength: 0, maxLength: 5 }),
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

  // Generator for form data values
  const formDataValueArb = fc.oneof(
    fc.string({ minLength: 1, maxLength: 50 }),
    fc.integer({ min: 1, max: 1000 }).map(String),
    fc.emailAddress()
  );

  // Generator for member name
  const memberNameArb = fc.string({ minLength: 2, maxLength: 100 })
    .filter(s => s.trim().length > 0);

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

  it('should create form submission with correct status and submission type', async () => {
    await fc.assert(
      fc.asyncProperty(
        formDefinitionArb,
        memberNameArb,
        fc.boolean(), // automaticallyApprove flag
        async (formDefinition, memberName, automaticallyApprove) => {
          const membershipType = {
            id: fc.sample(fc.uuid(), 1)[0],
            name: 'Test Membership Type',
            organisationId: mockOrganisation.id,
            membershipFormId: formDefinition.id,
            automaticallyApprove,
          };

          let capturedFormSubmissionData: any = null;

          const mockExecute = vi.fn().mockImplementation(({ url, method, data }) => {
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
              // Capture the form submission data
              capturedFormSubmissionData = data;
              return Promise.resolve({
                id: fc.sample(fc.uuid(), 1)[0],
                ...data,
              });
            }
            if (url.includes('/members') && method === 'POST') {
              return Promise.resolve({
                id: fc.sample(fc.uuid(), 1)[0],
                membershipNumber: 'TEST-2024-00001',
                ...data,
              });
            }
            return Promise.resolve(null);
          });

          const { container, getByTestId } = renderCreateMemberPage(
            formDefinition,
            membershipType,
            mockExecute
          );

          // Wait for the component to finish loading
          await waitFor(() => {
            const loadingSpinner = container.querySelector('[data-testid="loading-spinner"]');
            expect(loadingSpinner).toBeNull();
          }, { timeout: 3000 });

          // Fill in the name field
          const nameInput = container.querySelector('[data-testid="name-input"]') as HTMLInputElement;
          expect(nameInput).not.toBeNull();
          fireEvent.change(nameInput, { target: { value: memberName } });

          // Fill in dynamic fields with valid data
          for (const field of formDefinition.fields) {
            const fieldInput = container.querySelector(
              `[data-testid="field-input-${field.name}"]`
            ) as HTMLInputElement;
            
            if (fieldInput) {
              let value: string;
              if (field.datatype === 'email') {
                value = 'test@example.com';
              } else if (field.datatype === 'number') {
                value = '42';
              } else {
                value = 'test value';
              }
              fireEvent.change(fieldInput, { target: { value } });
            }
          }

          // Submit the form
          const submitButton = container.querySelector('[data-testid="submit-button"]') as HTMLButtonElement;
          expect(submitButton).not.toBeNull();
          fireEvent.click(submitButton);

          // Wait for submission to complete
          await waitFor(() => {
            expect(capturedFormSubmissionData).not.toBeNull();
          }, { timeout: 3000 });

          // Property: Form submission should have status "approved"
          expect(capturedFormSubmissionData.status).toBe('approved');

          // Property: Form submission should have submissionType "membership_application"
          expect(capturedFormSubmissionData.submissionType).toBe('membership_application');

          // Property: Form submission should contain the form ID
          expect(capturedFormSubmissionData.formId).toBe(formDefinition.id);

          // Property: Form submission should contain the organisation ID
          expect(capturedFormSubmissionData.organisationId).toBe(mockOrganisation.id);

          // Property: Form submission should contain the user ID
          expect(capturedFormSubmissionData.userId).toBe(mockCurrentUser.id);

          // Property: Form submission should have contextId "manual-creation"
          expect(capturedFormSubmissionData.contextId).toBe('manual-creation');

          // Property: Form submission should contain all entered data
          expect(capturedFormSubmissionData.submissionData).toBeDefined();
          expect(capturedFormSubmissionData.submissionData.name).toBe(memberName);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should include all form field data in submission', async () => {
    await fc.assert(
      fc.asyncProperty(
        formDefinitionArb.filter(def => def.fields.length > 0),
        memberNameArb,
        async (formDefinition, memberName) => {
          const membershipType = {
            id: fc.sample(fc.uuid(), 1)[0],
            name: 'Test Membership Type',
            organisationId: mockOrganisation.id,
            membershipFormId: formDefinition.id,
            automaticallyApprove: true,
          };

          let capturedFormSubmissionData: any = null;
          const fieldValues: Record<string, string> = {};

          const mockExecute = vi.fn().mockImplementation(({ url, method, data }) => {
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
              capturedFormSubmissionData = data;
              return Promise.resolve({
                id: fc.sample(fc.uuid(), 1)[0],
                ...data,
              });
            }
            if (url.includes('/members') && method === 'POST') {
              return Promise.resolve({
                id: fc.sample(fc.uuid(), 1)[0],
                membershipNumber: 'TEST-2024-00001',
                ...data,
              });
            }
            return Promise.resolve(null);
          });

          const { container, getByTestId } = renderCreateMemberPage(
            formDefinition,
            membershipType,
            mockExecute
          );

          // Wait for the component to finish loading
          await waitFor(() => {
            const loadingSpinner = container.querySelector('[data-testid="loading-spinner"]');
            expect(loadingSpinner).toBeNull();
          }, { timeout: 3000 });

          // Fill in the name field
          const nameInput = container.querySelector('[data-testid="name-input"]') as HTMLInputElement;
          expect(nameInput).not.toBeNull();
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
          const submitButton = container.querySelector('[data-testid="submit-button"]') as HTMLButtonElement;
          expect(submitButton).not.toBeNull();
          fireEvent.click(submitButton);

          // Wait for submission to complete
          await waitFor(() => {
            expect(capturedFormSubmissionData).not.toBeNull();
          }, { timeout: 3000 });

          // Property: All field values should be included in submission data
          for (const field of formDefinition.fields) {
            expect(capturedFormSubmissionData.submissionData[field.name]).toBe(
              fieldValues[field.name]
            );
          }

          // Property: Name field should be included
          expect(capturedFormSubmissionData.submissionData.name).toBe(memberName);
        }
      ),
      { numRuns: 100 }
    );
  });



  it('should handle empty form definitions correctly', async () => {
    const formDefinition = {
      id: fc.sample(fc.uuid(), 1)[0],
      name: 'Empty Form',
      fields: [],
    };

    const memberName = 'John Doe';

    const membershipType = {
      id: fc.sample(fc.uuid(), 1)[0],
      name: 'Test Membership Type',
      organisationId: mockOrganisation.id,
      membershipFormId: formDefinition.id,
      automaticallyApprove: true,
    };

    let capturedFormSubmissionData: any = null;

    const mockExecute = vi.fn().mockImplementation(({ url, method, data }) => {
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
        capturedFormSubmissionData = data;
        return Promise.resolve({
          id: fc.sample(fc.uuid(), 1)[0],
          ...data,
        });
      }
      if (url.includes('/members') && method === 'POST') {
        return Promise.resolve({
          id: fc.sample(fc.uuid(), 1)[0],
          membershipNumber: 'TEST-2024-00001',
          ...data,
        });
      }
      return Promise.resolve(null);
    });

    const { container, getByTestId } = renderCreateMemberPage(
      formDefinition,
      membershipType,
      mockExecute
    );

    // Wait for the component to finish loading
    await waitFor(() => {
      const loadingSpinner = container.querySelector('[data-testid="loading-spinner"]');
      expect(loadingSpinner).toBeNull();
    }, { timeout: 3000 });

    // Fill in the name field
    const nameInput = container.querySelector('[data-testid="name-input"]') as HTMLInputElement;
          expect(nameInput).not.toBeNull();
    fireEvent.change(nameInput, { target: { value: memberName } });

    // Submit the form
    const submitButton = container.querySelector('[data-testid="submit-button"]') as HTMLButtonElement;
          expect(submitButton).not.toBeNull();
    fireEvent.click(submitButton);

    // Wait for submission to complete
    await waitFor(() => {
      expect(capturedFormSubmissionData).not.toBeNull();
    }, { timeout: 3000 });

    // Property: Form submission should still be created with correct properties
    expect(capturedFormSubmissionData.status).toBe('approved');
    expect(capturedFormSubmissionData.submissionType).toBe('membership_application');
    expect(capturedFormSubmissionData.submissionData.name).toBe(memberName);
  });
});
