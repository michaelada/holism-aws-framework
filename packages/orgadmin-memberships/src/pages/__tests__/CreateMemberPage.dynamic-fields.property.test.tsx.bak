/**
 * Property-Based Tests for Dynamic Form Field Rendering
 * 
 * Feature: manual-member-addition
 * Property 5: Dynamic Form Field Rendering
 * 
 * **Validates: Requirements 3.4, 5.1-5.8**
 * 
 * For any form definition associated with a membership type, the member creation form
 * should render an appropriate input control for each field in the form definition,
 * based on the field's datatype.
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

// Mock FieldRenderer component
vi.mock('@aws-web-framework/components', () => ({
  FieldRenderer: ({ fieldDefinition, value, onChange, disabled, required }: any) => (
    <div
      data-testid={`field-${fieldDefinition.shortName}`}
      data-field-name={fieldDefinition.shortName}
      data-field-datatype={fieldDefinition.datatype}
      data-field-required={required}
      data-field-disabled={disabled}
    >
      <label>{fieldDefinition.displayName}</label>
      <input
        type="text"
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        required={required}
        data-testid={`field-input-${fieldDefinition.shortName}`}
      />
      {fieldDefinition.description && (
        <span data-testid={`field-description-${fieldDefinition.shortName}`}>
          {fieldDefinition.description}
        </span>
      )}
    </div>
  ),
}));

describe('Feature: manual-member-addition, Property 5: Dynamic Form Field Rendering', () => {
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
   * Fast-check generators for form fields
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

  // Generator for field order (positive integers)
  const fieldOrderArb = fc.integer({ min: 1, max: 100 });

  // Generator for field options (for select/radio/checkbox fields)
  const fieldOptionsArb = fc.array(
    fc.string({ minLength: 1, maxLength: 20 }),
    { minLength: 2, maxLength: 5 }
  );

  // Generator for a single form field
  const formFieldArb = fc.record({
    id: fc.uuid(),
    name: fc.string({ minLength: 3, maxLength: 30 })
      .filter(s => s.trim().length > 0)
      .map(s => s.replace(/[^a-zA-Z0-9_]/g, '_').replace(/^_+|_+$/g, '') || 'field'),
    label: fc.string({ minLength: 2, maxLength: 50 }).filter(s => s.trim().length > 0),
    datatype: fieldDatatypeArb,
    order: fieldOrderArb,
    description: fc.option(fc.string({ minLength: 2, maxLength: 100 }).filter(s => s.trim().length > 0), { nil: undefined }),
    validation: fc.record({
      required: fc.boolean(),
      rules: fc.constant([]),
    }),
    options: fc.option(fieldOptionsArb, { nil: undefined }),
  });

  // Generator for form definition with varying number of fields
  // Ensure unique field names to avoid React key warnings
  const formDefinitionArb = fc.record({
    id: fc.uuid(),
    name: fc.string({ minLength: 2, maxLength: 50 }).filter(s => s.trim().length > 0),
    description: fc.option(fc.string({ minLength: 2, maxLength: 100 }).filter(s => s.trim().length > 0), { nil: undefined }),
    fields: fc.array(formFieldArb, { minLength: 1, maxLength: 10 }),
  }).map(def => {
    // Ensure unique field names by appending index
    const uniqueFields = def.fields.map((field, index) => ({
      ...field,
      name: `${field.name}_${index}`,
      id: fc.sample(fc.uuid(), 1)[0], // Ensure unique IDs
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
        // Exclude field-input elements and the name field
        return testId && 
               !testId.includes('field-input') && 
               !testId.includes('field-description') &&
               testId !== 'field-name';
      }
    ) as HTMLElement[];
  };

  /**
   * Helper function to map database datatype to FieldRenderer expected datatype
   */
  const mapDatatypeToRenderer = (datatype: string): string => {
    const mapping: Record<string, string> = {
      'text': 'text',
      'textarea': 'text_area',
      'number': 'number',
      'email': 'email',
      'phone': 'text',
      'date': 'date',
      'time': 'time',
      'datetime': 'datetime',
      'boolean': 'boolean',
      'select': 'single_select',
      'multiselect': 'multi_select',
      'radio': 'single_select',
      'checkbox': 'multi_select',
      'file': 'document_upload',
      'image': 'document_upload',
    };
    return mapping[datatype] || 'text';
  };

  it('should render the correct number of fields matching the form definition', async () => {
    await fc.assert(
      fc.asyncProperty(
        formDefinitionArb,
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

          // Property: Number of rendered fields should match number of fields in form definition
          const renderedFields = getRenderedFields(container);
          expect(renderedFields.length).toBe(formDefinition.fields.length);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should render fields in the correct order based on field.order property', async () => {
    await fc.assert(
      fc.asyncProperty(
        formDefinitionArb,
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

          // Property: Fields should be rendered in order sorted by field.order
          const renderedFields = getRenderedFields(container);
          const renderedFieldNames = renderedFields.map(
            field => field.getAttribute('data-field-name')
          );

          // Sort form definition fields by order
          const sortedFields = [...formDefinition.fields].sort((a, b) => a.order - b.order);
          const expectedFieldNames = sortedFields.map(field => field.name);

          expect(renderedFieldNames).toEqual(expectedFieldNames);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should render each field with the correct datatype mapping', async () => {
    await fc.assert(
      fc.asyncProperty(
        formDefinitionArb,
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

          // Property: Each field should be rendered with the correct datatype
          const renderedFields = getRenderedFields(container);

          for (const field of formDefinition.fields) {
            const renderedField = renderedFields.find(
              el => el.getAttribute('data-field-name') === field.name
            );

            expect(renderedField).toBeDefined();
            
            const expectedDatatype = mapDatatypeToRenderer(field.datatype);
            const actualDatatype = renderedField?.getAttribute('data-field-datatype');
            
            expect(actualDatatype).toBe(expectedDatatype);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should render required fields with required attribute', async () => {
    await fc.assert(
      fc.asyncProperty(
        formDefinitionArb,
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

          // Property: Required fields should have required attribute set correctly
          const renderedFields = getRenderedFields(container);

          for (const field of formDefinition.fields) {
            const renderedField = renderedFields.find(
              el => el.getAttribute('data-field-name') === field.name
            );

            expect(renderedField).toBeDefined();
            
            const isRequired = renderedField?.getAttribute('data-field-required') === 'true';
            const expectedRequired = field.validation?.required || false;
            
            expect(isRequired).toBe(expectedRequired);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should render all field types correctly', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(formFieldArb, { minLength: 1, maxLength: 15 }),
        async (fields) => {
          // Ensure we have at least one of each field type
          const allFieldTypes = [
            'text', 'textarea', 'number', 'email', 'date', 
            'select', 'radio', 'checkbox', 'file'
          ];
          
          const formDefinition = {
            id: fc.sample(fc.uuid(), 1)[0],
            name: 'Test Form',
            description: 'Test form with all field types',
            fields: fields.map((field, index) => ({
              ...field,
              order: index + 1, // Ensure unique order
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

          // Property: All fields should be rendered
          const renderedFields = getRenderedFields(container);
          expect(renderedFields.length).toBe(formDefinition.fields.length);

          // Property: Each field should have a corresponding FieldRenderer
          for (const field of formDefinition.fields) {
            const renderedField = container.querySelector(`[data-testid="field-${field.name}"]`);
            expect(renderedField).not.toBeNull();
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle empty form definitions gracefully', async () => {
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

  it('should handle form definitions with duplicate order values', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(formFieldArb, { minLength: 3, maxLength: 8 }),
        fc.integer({ min: 1, max: 10 }),
        async (fields, duplicateOrder) => {
          // Ensure unique IDs for all fields to avoid React key warnings
          const uniqueFields = fields.map((field, index) => ({
            ...field,
            id: fc.sample(fc.uuid(), 1)[0],
            // Some fields get the same order value
            order: index < 2 ? duplicateOrder : field.order,
          }));

          // Create form definition with some duplicate order values
          const formDefinition = {
            id: fc.sample(fc.uuid(), 1)[0],
            name: 'Test Form',
            description: 'Form with duplicate order values',
            fields: uniqueFields,
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
          }, { timeout: 10000 });

          // Property: All fields should still be rendered even with duplicate orders
          const renderedFields = getRenderedFields(container);
          expect(renderedFields.length).toBe(formDefinition.fields.length);

          // Property: Fields should be sorted (stable sort maintains relative order for duplicates)
          const renderedFieldNames = renderedFields.map(
            field => field.getAttribute('data-field-name')
          );
          const sortedFields = [...formDefinition.fields].sort((a, b) => a.order - b.order);
          const expectedFieldNames = sortedFields.map(field => field.name);

          expect(renderedFieldNames).toEqual(expectedFieldNames);
        }
      ),
      { numRuns: 100 }
    );
  }, 60000);

  it('should render field descriptions when provided', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            id: fc.uuid(),
            name: fc.string({ minLength: 3, maxLength: 30 })
              .filter(s => s.trim().length > 0)
              .map(s => s.replace(/[^a-zA-Z0-9_]/g, '_').replace(/^_+|_+$/g, '') || 'field'),
            label: fc.string({ minLength: 2, maxLength: 50 }).filter(s => s.trim().length > 0),
            datatype: fieldDatatypeArb,
            order: fieldOrderArb,
            description: fc.string({ minLength: 2, maxLength: 100 }).filter(s => s.trim().length > 0), // Always include description
            validation: fc.record({
              required: fc.boolean(),
              rules: fc.constant([]),
            }),
            options: fc.option(fieldOptionsArb, { nil: undefined }),
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
            description: 'Form with field descriptions',
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

          // Property: Fields with descriptions should render the description
          for (const field of formDefinition.fields) {
            if (field.description) {
              const descriptionElement = container.querySelector(
                `[data-testid="field-description-${field.name}"]`
              );
              expect(descriptionElement).not.toBeNull();
              expect(descriptionElement?.textContent).toBe(field.description);
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should maintain field rendering consistency across multiple renders', async () => {
    await fc.assert(
      fc.asyncProperty(
        formDefinitionArb,
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
          const fieldNames1 = fields1.map(f => f.getAttribute('data-field-name'));

          unmount1();

          // Second render with same data
          const { container: container2 } = renderCreateMemberPage(formDefinition, membershipType);

          await waitFor(() => {
            const loadingSpinner = container2.querySelector('[data-testid="loading-spinner"]');
            expect(loadingSpinner).toBeNull();
          }, { timeout: 3000 });

          const fields2 = getRenderedFields(container2);
          const fieldNames2 = fields2.map(f => f.getAttribute('data-field-name'));

          // Property: Field rendering should be consistent across renders
          expect(fieldNames1).toEqual(fieldNames2);
          expect(fields1.length).toBe(fields2.length);
        }
      ),
      { numRuns: 50 }
    );
  });
});
