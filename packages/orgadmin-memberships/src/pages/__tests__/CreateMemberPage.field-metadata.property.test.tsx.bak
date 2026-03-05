/**
 * Property-Based Tests for Field Metadata Display
 * 
 * Feature: manual-member-addition
 * Property 7: Field Metadata Display
 * 
 * **Validates: Requirements 3.6**
 * 
 * For any form field in the form definition, the rendered field should display
 * the field's label, description (help text), and any validation messages from
 * the form definition.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
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

// Mock FieldRenderer component to capture metadata
vi.mock('@aws-web-framework/components', () => ({
  FieldRenderer: ({ fieldDefinition, value, onChange, disabled, required }: any) => (
    <div
      data-testid={`field-${fieldDefinition.shortName}`}
      data-field-name={fieldDefinition.shortName}
      data-field-label={fieldDefinition.displayName}
      data-field-description={fieldDefinition.description}
      data-field-required={required}
      data-field-disabled={disabled}
    >
      <label data-testid={`label-${fieldDefinition.shortName}`}>
        {fieldDefinition.displayName}
        {required && ' *'}
      </label>
      {fieldDefinition.description && (
        <span data-testid={`description-${fieldDefinition.shortName}`}>
          {fieldDefinition.description}
        </span>
      )}
      <input
        type="text"
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        required={required}
        data-testid={`field-input-${fieldDefinition.shortName}`}
      />
    </div>
  ),
}));

describe('Feature: manual-member-addition, Property 7: Field Metadata Display', () => {
  const testI18n = createTestI18n('en-GB');
  
  // Add translations
  testI18n.addResourceBundle('en-GB', 'translation', {
    memberships: {
      ...testI18n.getResourceBundle('en-GB', 'translation').memberships,
      addMember: 'Add New Member',
      name: 'Name',
      createMember: 'Create Member',
      creating: 'Creating...',
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

  /**
   * Fast-check generators for form fields with metadata
   */
  
  // Generator for field datatypes
  const fieldDatatypeArb = fc.constantFrom(
    'text',
    'textarea',
    'number',
    'email',
    'phone',
    'date',
    'time',
    'datetime',
    'boolean',
    'select',
    'multiselect',
    'radio',
    'checkbox',
    'file',
    'image'
  );

  // Generator for field labels (non-empty strings)
  const fieldLabelArb = fc.string({ minLength: 2, maxLength: 50 })
    .filter(s => s.trim().length > 0);

  // Generator for field descriptions (optional strings)
  const fieldDescriptionArb = fc.option(
    fc.string({ minLength: 5, maxLength: 200 }).filter(s => s.trim().length > 0),
    { nil: undefined }
  );

  // Generator for field names (valid identifiers)
  const fieldNameArb = fc.string({ minLength: 3, maxLength: 30 })
    .filter(s => s.trim().length > 0)
    .map(s => s.replace(/[^a-zA-Z0-9_]/g, '_').replace(/^_+|_+$/g, '') || 'field');

  // Generator for a single form field with metadata
  const formFieldWithMetadataArb = fc.record({
    id: fc.uuid(),
    name: fieldNameArb,
    label: fieldLabelArb,
    datatype: fieldDatatypeArb,
    order: fc.integer({ min: 1, max: 100 }),
    description: fieldDescriptionArb,
    validation: fc.record({
      required: fc.boolean(),
      rules: fc.constant([]),
    }),
    options: fc.option(
      fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 2, maxLength: 5 }),
      { nil: undefined }
    ),
  });

  // Generator for form definition with fields that have metadata
  const formDefinitionWithMetadataArb = fc.record({
    id: fc.uuid(),
    name: fc.string({ minLength: 2, maxLength: 50 }).filter(s => s.trim().length > 0),
    description: fc.option(
      fc.string({ minLength: 2, maxLength: 100 }).filter(s => s.trim().length > 0),
      { nil: undefined }
    ),
    fields: fc.array(formFieldWithMetadataArb, { minLength: 1, maxLength: 8 }),
  }).map(def => {
    // Ensure unique field names by appending index
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

  /**
   * Helper function to render CreateMemberPage with mocked API responses
   */
  const renderCreateMemberPage = (formDefinition: any, membershipType: any) => {
    const mockExecute = vi.fn().mockImplementation(({ url }) => {
      if (url.includes('/membership-types/')) {
        return Promise.resolve(membershipType);
      }
      if (url.includes('/application-forms/') && url.includes('/with-fields')) {
        return Promise.resolve(formDefinition);
      }
      return Promise.resolve(null);
    });

    vi.mocked(useApiModule.useApi).mockReturnValue({
      execute: mockExecute,
      data: null,
      error: null,
      loading: false,
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

  /**
   * Helper function to get all rendered field elements
   * Excludes the name field and only returns dynamic form fields
   */
  const getRenderedFields = (container: HTMLElement): HTMLElement[] => {
    return Array.from(container.querySelectorAll('[data-testid^="field-"]')).filter(
      el => {
        const testId = el.getAttribute('data-testid');
        // Exclude field-input elements, field-description elements, and the name field
        return testId && 
               !testId.includes('field-input') && 
               !testId.includes('field-description') &&
               !testId.includes('label-') &&
               testId !== 'field-name';
      }
    ) as HTMLElement[];
  };

  it('should display field labels matching the form definition displayName for all fields', async () => {
    await fc.assert(
      fc.asyncProperty(
        formDefinitionWithMetadataArb,
        async (formDefinition) => {
          const membershipType = {
            id: fc.sample(fc.uuid(), 1)[0],
            name: 'Test Membership Type',
            organisationId: mockOrganisation.id,
            membershipFormId: formDefinition.id,
          };

          const { container } = renderCreateMemberPage(formDefinition, membershipType);

          // Wait for the component to finish loading
          await waitFor(() => {
            const loadingSpinner = container.querySelector('[data-testid="loading-spinner"]');
            expect(loadingSpinner).toBeNull();
          }, { timeout: 3000 });

          // Property: Each field should display its label from fieldDefinition.displayName
          const renderedFields = getRenderedFields(container);

          for (const field of formDefinition.fields) {
            const renderedField = renderedFields.find(
              el => el.getAttribute('data-field-name') === field.name
            );

            expect(renderedField).toBeDefined();
            
            // Verify the label is displayed correctly
            const displayedLabel = renderedField?.getAttribute('data-field-label');
            expect(displayedLabel).toBe(field.label);

            // Verify the label element contains the correct text
            const labelElement = container.querySelector(`[data-testid="label-${field.name}"]`);
            expect(labelElement).not.toBeNull();
            
            // Label should contain the field label text
            const labelText = labelElement?.textContent || '';
            expect(labelText).toContain(field.label);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should display field descriptions when provided in the form definition', async () => {
    await fc.assert(
      fc.asyncProperty(
        formDefinitionWithMetadataArb,
        async (formDefinition) => {
          const membershipType = {
            id: fc.sample(fc.uuid(), 1)[0],
            name: 'Test Membership Type',
            organisationId: mockOrganisation.id,
            membershipFormId: formDefinition.id,
          };

          const { container } = renderCreateMemberPage(formDefinition, membershipType);

          // Wait for the component to finish loading
          await waitFor(() => {
            const loadingSpinner = container.querySelector('[data-testid="loading-spinner"]');
            expect(loadingSpinner).toBeNull();
          }, { timeout: 3000 });

          // Property: Fields with descriptions should display the description text
          const renderedFields = getRenderedFields(container);

          for (const field of formDefinition.fields) {
            const renderedField = renderedFields.find(
              el => el.getAttribute('data-field-name') === field.name
            );

            expect(renderedField).toBeDefined();
            
            // Verify the description is stored in the data attribute
            const displayedDescription = renderedField?.getAttribute('data-field-description');
            expect(displayedDescription).toBe(field.description || '');

            if (field.description) {
              // If description is provided, verify it's displayed
              const descriptionElement = container.querySelector(
                `[data-testid="description-${field.name}"]`
              );
              expect(descriptionElement).not.toBeNull();
              expect(descriptionElement?.textContent).toBe(field.description);
            } else {
              // If no description, verify description element doesn't exist
              const descriptionElement = container.querySelector(
                `[data-testid="description-${field.name}"]`
              );
              expect(descriptionElement).toBeNull();
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should display empty description when field has no description in form definition', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            id: fc.uuid(),
            name: fieldNameArb,
            label: fieldLabelArb,
            datatype: fieldDatatypeArb,
            order: fc.integer({ min: 1, max: 100 }),
            description: fc.constant(undefined), // Always undefined
            validation: fc.record({
              required: fc.boolean(),
              rules: fc.constant([]),
            }),
          }),
          { minLength: 1, maxLength: 5 }
        ),
        async (fields) => {
          // Ensure unique field names
          const uniqueFields = fields.map((field, index) => ({
            ...field,
            name: `${field.name}_${index}`,
            id: fc.sample(fc.uuid(), 1)[0],
          }));

          const formDefinition = {
            id: fc.sample(fc.uuid(), 1)[0],
            name: 'Test Form',
            description: 'Form without field descriptions',
            fields: uniqueFields.map((field, index) => ({
              ...field,
              order: index + 1,
            })),
          };

          const membershipType = {
            id: fc.sample(fc.uuid(), 1)[0],
            name: 'Test Membership Type',
            organisationId: mockOrganisation.id,
            membershipFormId: formDefinition.id,
          };

          const { container } = renderCreateMemberPage(formDefinition, membershipType);

          // Wait for the component to finish loading
          await waitFor(() => {
            const loadingSpinner = container.querySelector('[data-testid="loading-spinner"]');
            expect(loadingSpinner).toBeNull();
          }, { timeout: 3000 });

          // Property: Fields without descriptions should have empty description
          const renderedFields = getRenderedFields(container);

          for (const field of formDefinition.fields) {
            const renderedField = renderedFields.find(
              el => el.getAttribute('data-field-name') === field.name
            );

            expect(renderedField).toBeDefined();
            
            // Verify description is empty string
            const displayedDescription = renderedField?.getAttribute('data-field-description');
            expect(displayedDescription).toBe('');

            // Verify no description element is rendered
            const descriptionElement = container.querySelector(
              `[data-testid="description-${field.name}"]`
            );
            expect(descriptionElement).toBeNull();
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should display required indicator for mandatory fields', async () => {
    await fc.assert(
      fc.asyncProperty(
        formDefinitionWithMetadataArb,
        async (formDefinition) => {
          const membershipType = {
            id: fc.sample(fc.uuid(), 1)[0],
            name: 'Test Membership Type',
            organisationId: mockOrganisation.id,
            membershipFormId: formDefinition.id,
          };

          const { container } = renderCreateMemberPage(formDefinition, membershipType);

          // Wait for the component to finish loading
          await waitFor(() => {
            const loadingSpinner = container.querySelector('[data-testid="loading-spinner"]');
            expect(loadingSpinner).toBeNull();
          }, { timeout: 3000 });

          // Property: Required fields should display required indicator
          const renderedFields = getRenderedFields(container);

          for (const field of formDefinition.fields) {
            const renderedField = renderedFields.find(
              el => el.getAttribute('data-field-name') === field.name
            );

            expect(renderedField).toBeDefined();
            
            // Verify required attribute matches field definition
            const isRequired = renderedField?.getAttribute('data-field-required') === 'true';
            const expectedRequired = field.validation?.required || false;
            expect(isRequired).toBe(expectedRequired);

            // Verify label shows required indicator for required fields
            const labelElement = container.querySelector(`[data-testid="label-${field.name}"]`);
            expect(labelElement).not.toBeNull();
            
            const labelText = labelElement?.textContent || '';
            if (expectedRequired) {
              // Required fields should have asterisk in label
              expect(labelText).toContain('*');
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should display all metadata consistently across different field types', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(formFieldWithMetadataArb, { minLength: 3, maxLength: 10 }),
        async (fields) => {
          // Ensure unique field names and mix of required/optional fields
          const uniqueFields = fields.map((field, index) => ({
            ...field,
            name: `${field.name}_${index}`,
            id: fc.sample(fc.uuid(), 1)[0],
            // Ensure we have a mix of fields with and without descriptions
            description: index % 2 === 0 ? field.description : undefined,
          }));

          const formDefinition = {
            id: fc.sample(fc.uuid(), 1)[0],
            name: 'Test Form',
            description: 'Form with mixed metadata',
            fields: uniqueFields.map((field, index) => ({
              ...field,
              order: index + 1,
            })),
          };

          const membershipType = {
            id: fc.sample(fc.uuid(), 1)[0],
            name: 'Test Membership Type',
            organisationId: mockOrganisation.id,
            membershipFormId: formDefinition.id,
          };

          const { container } = renderCreateMemberPage(formDefinition, membershipType);

          // Wait for the component to finish loading
          await waitFor(() => {
            const loadingSpinner = container.querySelector('[data-testid="loading-spinner"]');
            expect(loadingSpinner).toBeNull();
          }, { timeout: 3000 });

          // Property: All fields should display their metadata consistently
          const renderedFields = getRenderedFields(container);
          expect(renderedFields.length).toBe(formDefinition.fields.length);

          for (const field of formDefinition.fields) {
            const renderedField = renderedFields.find(
              el => el.getAttribute('data-field-name') === field.name
            );

            expect(renderedField).toBeDefined();
            
            // Verify label
            expect(renderedField?.getAttribute('data-field-label')).toBe(field.label);
            
            // Verify description
            expect(renderedField?.getAttribute('data-field-description')).toBe(field.description || '');
            
            // Verify required flag
            const isRequired = renderedField?.getAttribute('data-field-required') === 'true';
            expect(isRequired).toBe(field.validation?.required || false);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle fields with special characters in labels and descriptions', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            id: fc.uuid(),
            name: fieldNameArb,
            label: fc.string({ minLength: 2, maxLength: 50 })
              .filter(s => s.trim().length > 0)
              .map(s => s + ' (Special: <>&"\')'), // Add special characters
            datatype: fieldDatatypeArb,
            order: fc.integer({ min: 1, max: 100 }),
            description: fc.option(
              fc.string({ minLength: 5, maxLength: 100 })
                .filter(s => s.trim().length > 0)
                .map(s => s + ' <>&"\''), // Add special characters
              { nil: undefined }
            ),
            validation: fc.record({
              required: fc.boolean(),
              rules: fc.constant([]),
            }),
          }),
          { minLength: 1, maxLength: 5 }
        ),
        async (fields) => {
          // Ensure unique field names
          const uniqueFields = fields.map((field, index) => ({
            ...field,
            name: `${field.name}_${index}`,
            id: fc.sample(fc.uuid(), 1)[0],
          }));

          const formDefinition = {
            id: fc.sample(fc.uuid(), 1)[0],
            name: 'Test Form',
            description: 'Form with special characters',
            fields: uniqueFields.map((field, index) => ({
              ...field,
              order: index + 1,
            })),
          };

          const membershipType = {
            id: fc.sample(fc.uuid(), 1)[0],
            name: 'Test Membership Type',
            organisationId: mockOrganisation.id,
            membershipFormId: formDefinition.id,
          };

          const { container } = renderCreateMemberPage(formDefinition, membershipType);

          // Wait for the component to finish loading
          await waitFor(() => {
            const loadingSpinner = container.querySelector('[data-testid="loading-spinner"]');
            expect(loadingSpinner).toBeNull();
          }, { timeout: 3000 });

          // Property: Fields with special characters should display correctly
          const renderedFields = getRenderedFields(container);

          for (const field of formDefinition.fields) {
            const renderedField = renderedFields.find(
              el => el.getAttribute('data-field-name') === field.name
            );

            expect(renderedField).toBeDefined();
            
            // Verify label with special characters
            const displayedLabel = renderedField?.getAttribute('data-field-label');
            expect(displayedLabel).toBe(field.label);

            // Verify description with special characters
            const displayedDescription = renderedField?.getAttribute('data-field-description');
            expect(displayedDescription).toBe(field.description || '');
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should maintain metadata display consistency across multiple renders', async () => {
    await fc.assert(
      fc.asyncProperty(
        formDefinitionWithMetadataArb,
        async (formDefinition) => {
          const membershipType = {
            id: fc.sample(fc.uuid(), 1)[0],
            name: 'Test Membership Type',
            organisationId: mockOrganisation.id,
            membershipFormId: formDefinition.id,
          };

          // First render
          const { container: container1, unmount: unmount1 } = renderCreateMemberPage(
            formDefinition,
            membershipType
          );

          await waitFor(() => {
            const loadingSpinner = container1.querySelector('[data-testid="loading-spinner"]');
            expect(loadingSpinner).toBeNull();
          }, { timeout: 3000 });

          const fields1 = getRenderedFields(container1);
          const metadata1 = fields1.map(f => ({
            name: f.getAttribute('data-field-name'),
            label: f.getAttribute('data-field-label'),
            description: f.getAttribute('data-field-description'),
            required: f.getAttribute('data-field-required'),
          }));

          unmount1();

          // Second render with same data
          const { container: container2 } = renderCreateMemberPage(formDefinition, membershipType);

          await waitFor(() => {
            const loadingSpinner = container2.querySelector('[data-testid="loading-spinner"]');
            expect(loadingSpinner).toBeNull();
          }, { timeout: 3000 });

          const fields2 = getRenderedFields(container2);
          const metadata2 = fields2.map(f => ({
            name: f.getAttribute('data-field-name'),
            label: f.getAttribute('data-field-label'),
            description: f.getAttribute('data-field-description'),
            required: f.getAttribute('data-field-required'),
          }));

          // Property: Metadata should be consistent across renders
          expect(metadata1).toEqual(metadata2);
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should handle empty form definitions without errors', async () => {
    const formDefinition = {
      id: fc.sample(fc.uuid(), 1)[0],
      name: 'Empty Form',
      description: 'Form with no fields',
      fields: [],
    };

    const membershipType = {
      id: fc.sample(fc.uuid(), 1)[0],
      name: 'Test Membership Type',
      organisationId: mockOrganisation.id,
      membershipFormId: formDefinition.id,
    };

    const { container } = renderCreateMemberPage(formDefinition, membershipType);

    // Wait for the component to finish loading
    await waitFor(() => {
      const loadingSpinner = container.querySelector('[data-testid="loading-spinner"]');
      expect(loadingSpinner).toBeNull();
    }, { timeout: 3000 });

    // Property: No dynamic fields should be rendered (only the name field)
    const renderedFields = getRenderedFields(container);
    expect(renderedFields.length).toBe(0);

    // The name field should still be present
    const nameField = container.querySelector('[data-testid="name-field"]');
    expect(nameField).not.toBeNull();
  });
});
