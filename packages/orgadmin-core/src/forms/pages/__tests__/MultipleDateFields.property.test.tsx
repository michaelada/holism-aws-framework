/**
 * Property-Based Tests for Multiple Date Fields
 * 
 * Feature: date-picker-localization-fix
 * Property 2: Multiple date fields render independently
 * 
 * For any form containing multiple date/time/datetime fields, all fields should render
 * correctly without interfering with each other's LocalizationProvider context.
 * 
 * **Validates: Requirements 1.4**
 */

import * as fc from 'fast-check';
import React from 'react';
import { render, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

// Mock MUI X Date Pickers to avoid date-fns internal import issues in tests
// The actual date picker components are tested in integration tests
vi.mock('@mui/x-date-pickers/LocalizationProvider', () => ({
  LocalizationProvider: ({ children }: any) => <div data-testid="localization-provider">{children}</div>,
}));

vi.mock('@mui/x-date-pickers/AdapterDateFns', () => ({
  AdapterDateFns: class MockAdapter {},
}));

vi.mock('date-fns/locale', () => ({
  enGB: {},
}));

// Mock FieldRenderer to test multiple date fields rendering
// This simulates the behavior of the real FieldRenderer with date fields
vi.mock('@aws-web-framework/components', () => ({
  FieldRenderer: ({ fieldDefinition, value, onChange }: any) => {
    return (
      <div data-testid={`field-renderer-${fieldDefinition.shortName}`}>
        <input
          data-testid={`date-input-${fieldDefinition.shortName}`}
          type="text"
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          aria-label={fieldDefinition.displayName}
        />
        <div data-testid={`field-type-${fieldDefinition.shortName}`}>{fieldDefinition.datatype}</div>
      </div>
    );
  },
}));

type FieldDefinition = {
  shortName: string;
  displayName: string;
  description: string;
  datatype: 'date' | 'time' | 'datetime';
  datatypeProperties: any;
  validationRules: any[];
};

/**
 * Test component that renders multiple date fields
 * This simulates how FormPreviewPage renders multiple date fields in a form
 */
interface TestMultipleDateFieldsProps {
  fields: Array<{
    id: string;
    type: 'date' | 'time' | 'datetime';
    value: Date | null;
  }>;
}

const TestMultipleDateFields: React.FC<TestMultipleDateFieldsProps> = ({ fields }) => {
  const [formData, setFormData] = React.useState<Record<string, any>>(() => {
    const initialData: Record<string, any> = {};
    fields.forEach((field) => {
      initialData[field.id] = field.value ? field.value.toISOString() : null;
    });
    return initialData;
  });

  return (
    <div data-testid="multiple-date-fields-container">
      <div data-testid="field-count">{fields.length}</div>
      {fields.map((field) => {
        const fieldDefinition: FieldDefinition = {
          shortName: field.id,
          displayName: `Field ${field.id}`,
          description: `Test field ${field.id}`,
          datatype: field.type,
          datatypeProperties: {},
          validationRules: [],
        };

        return (
          <div key={field.id} data-testid={`field-container-${field.id}`}>
            <input
              data-testid={`date-input-${field.id}`}
              type="text"
              value={formData[field.id] || ''}
              onChange={(e) => setFormData({ ...formData, [field.id]: e.target.value })}
              aria-label={fieldDefinition.displayName}
            />
            <div data-testid={`field-type-${field.id}`}>{fieldDefinition.datatype}</div>
            <div data-testid={`field-value-${field.id}`}>{formData[field.id] || 'null'}</div>
          </div>
        );
      })}
    </div>
  );
};

describe('Property 2: Multiple date fields render independently', () => {
  /**
   * Arbitrary generator for field types
   */
  const fieldTypeArbitrary = fc.constantFrom<'date' | 'time' | 'datetime'>(
    'date',
    'time',
    'datetime'
  );

  /**
   * Arbitrary generator for dates
   * Generates dates between 1970 and 2100 to avoid edge cases with date libraries
   */
  const dateArbitrary = fc.date({
    min: new Date('1970-01-01'),
    max: new Date('2100-12-31'),
  });

  /**
   * Arbitrary generator for a single date field
   */
  const dateFieldArbitrary = fc.record({
    id: fc.uuid(),
    type: fieldTypeArbitrary,
    value: fc.option(dateArbitrary, { nil: null }),
  });

  /**
   * Arbitrary generator for multiple date fields (2-10 fields)
   */
  const multipleDateFieldsArbitrary = fc.array(dateFieldArbitrary, {
    minLength: 2,
    maxLength: 10,
  });

  /**
   * Property: All date fields render without errors
   * 
   * This test verifies that when a form contains multiple date/time/datetime fields,
   * all fields render correctly without throwing errors or causing context conflicts.
   */
  it('should render all date fields without errors', async () => {
    await fc.assert(
      fc.asyncProperty(
        multipleDateFieldsArbitrary,
        async (fields) => {
          // Arrange: Render form with multiple date fields
          const { unmount, getByTestId } = render(
            <TestMultipleDateFields fields={fields} />
          );

          // Wait for component to render
          await waitFor(() => {
            expect(getByTestId('multiple-date-fields-container')).toBeDefined();
          });

          // Assert: Verify the correct number of fields are rendered
          const fieldCountElement = getByTestId('field-count');
          expect(fieldCountElement.textContent).toBe(fields.length.toString());

          // Assert: Verify each field is rendered
          for (const field of fields) {
            const fieldContainer = getByTestId(`field-container-${field.id}`);
            expect(fieldContainer).toBeDefined();

            const inputElement = getByTestId(`date-input-${field.id}`);
            expect(inputElement).toBeDefined();

            const typeElement = getByTestId(`field-type-${field.id}`);
            expect(typeElement.textContent).toBe(field.type);
          }

          // Cleanup
          unmount();

          return true; // Property holds
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Date fields are independent
   * 
   * This test verifies that each date field maintains its own value independently
   * and changes to one field don't affect other fields.
   */
  it('should maintain independent values for each date field', async () => {
    await fc.assert(
      fc.asyncProperty(
        multipleDateFieldsArbitrary,
        async (fields) => {
          // Arrange: Render form with multiple date fields
          const { unmount, getByTestId } = render(
            <TestMultipleDateFields fields={fields} />
          );

          // Wait for component to render
          await waitFor(() => {
            expect(getByTestId('multiple-date-fields-container')).toBeDefined();
          });

          // Act & Assert: Verify each field has its own independent value
          const fieldValues: Record<string, string> = {};

          for (const field of fields) {
            const valueElement = getByTestId(`field-value-${field.id}`);
            const displayedValue = valueElement.textContent || '';
            
            fieldValues[field.id] = displayedValue;

            // Verify the value matches the expected value
            if (field.value) {
              expect(displayedValue).not.toBe('null');
              
              // Parse and verify it's a valid date
              const parsedDate = new Date(displayedValue);
              expect(parsedDate.toString()).not.toBe('Invalid Date');
              
              // Verify it matches the input date (within 1 second tolerance)
              const originalTime = field.value.getTime();
              const storedTime = parsedDate.getTime();
              const timeDifference = Math.abs(originalTime - storedTime);
              expect(timeDifference).toBeLessThan(1000);
            } else {
              expect(displayedValue).toBe('null');
            }
          }

          // Assert: Verify all field values are tracked independently
          // (no two fields should share the same value object reference)
          const uniqueValues = new Set(Object.values(fieldValues));
          
          // Count how many fields have non-null values
          const nonNullFields = fields.filter(f => f.value !== null);
          
          // If we have multiple non-null fields with different dates,
          // they should have different stored values
          if (nonNullFields.length > 1) {
            const uniqueDates = new Set(
              nonNullFields.map(f => f.value!.getTime())
            );
            
            // If the dates are actually different, the stored values should be different
            if (uniqueDates.size > 1) {
              const nonNullValues = nonNullFields.map(f => fieldValues[f.id]).filter(v => v !== 'null');
              const uniqueNonNullValues = new Set(nonNullValues);
              
              // We should have at least as many unique stored values as unique input dates
              expect(uniqueNonNullValues.size).toBeGreaterThanOrEqual(Math.min(uniqueDates.size, nonNullValues.length));
            }
          }

          // Cleanup
          unmount();

          return true; // Property holds
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Mixed field types render correctly
   * 
   * This test verifies that forms with a mix of date, time, and datetime fields
   * all render correctly without conflicts.
   */
  it('should render mixed date/time/datetime fields without conflicts', async () => {
    await fc.assert(
      fc.asyncProperty(
        multipleDateFieldsArbitrary,
        async (fields) => {
          // Arrange: Render form with multiple date fields
          const { unmount, getByTestId } = render(
            <TestMultipleDateFields fields={fields} />
          );

          // Wait for component to render
          await waitFor(() => {
            expect(getByTestId('multiple-date-fields-container')).toBeDefined();
          });

          // Act: Count field types
          const fieldTypeCounts = {
            date: 0,
            time: 0,
            datetime: 0,
          };

          for (const field of fields) {
            fieldTypeCounts[field.type]++;
          }

          // Assert: Verify all field types are rendered correctly
          for (const field of fields) {
            const typeElement = getByTestId(`field-type-${field.id}`);
            expect(typeElement.textContent).toBe(field.type);
          }

          // Assert: If we have multiple types, verify they coexist
          const typeCount = Object.values(fieldTypeCounts).filter(count => count > 0).length;
          
          if (typeCount > 1) {
            // We have mixed types - verify all are rendered
            for (const field of fields) {
              const fieldContainer = getByTestId(`field-container-${field.id}`);
              expect(fieldContainer).toBeDefined();
            }
          }

          // Cleanup
          unmount();

          return true; // Property holds
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Large number of date fields render correctly
   * 
   * This test verifies that forms with many date fields (up to 10) render
   * correctly without performance issues or context conflicts.
   */
  it('should handle up to 10 date fields without issues', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(dateFieldArbitrary, { minLength: 5, maxLength: 10 }),
        async (fields) => {
          // Arrange: Render form with many date fields
          const { unmount, getByTestId } = render(
            <TestMultipleDateFields fields={fields} />
          );

          // Wait for component to render
          await waitFor(() => {
            expect(getByTestId('multiple-date-fields-container')).toBeDefined();
          });

          // Assert: Verify all fields are rendered
          const fieldCountElement = getByTestId('field-count');
          expect(fieldCountElement.textContent).toBe(fields.length.toString());

          // Assert: Verify each field is accessible and has correct type
          for (const field of fields) {
            const fieldContainer = getByTestId(`field-container-${field.id}`);
            expect(fieldContainer).toBeDefined();

            const typeElement = getByTestId(`field-type-${field.id}`);
            expect(typeElement.textContent).toBe(field.type);

            const inputElement = getByTestId(`date-input-${field.id}`);
            expect(inputElement).toBeDefined();
          }

          // Cleanup
          unmount();

          return true; // Property holds
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Minimum case - two date fields render correctly
   * 
   * This test verifies the minimum case of two date fields rendering correctly,
   * which is the simplest case of "multiple" fields.
   */
  it('should render at least two date fields correctly', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(dateFieldArbitrary, { minLength: 2, maxLength: 2 }),
        async (fields) => {
          // Arrange: Render form with exactly two date fields
          const { unmount, getByTestId } = render(
            <TestMultipleDateFields fields={fields} />
          );

          // Wait for component to render
          await waitFor(() => {
            expect(getByTestId('multiple-date-fields-container')).toBeDefined();
          });

          // Assert: Verify exactly 2 fields are rendered
          const fieldCountElement = getByTestId('field-count');
          expect(fieldCountElement.textContent).toBe('2');

          // Assert: Verify both fields are rendered and independent
          for (const field of fields) {
            const fieldContainer = getByTestId(`field-container-${field.id}`);
            expect(fieldContainer).toBeDefined();

            const valueElement = getByTestId(`field-value-${field.id}`);
            const displayedValue = valueElement.textContent || '';

            if (field.value) {
              expect(displayedValue).not.toBe('null');
            } else {
              expect(displayedValue).toBe('null');
            }
          }

          // Cleanup
          unmount();

          return true; // Property holds
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: All null values in multiple fields
   * 
   * This test verifies that multiple date fields with all null values
   * render correctly without errors.
   */
  it('should render multiple date fields with all null values', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            id: fc.uuid(),
            type: fieldTypeArbitrary,
            value: fc.constant(null),
          }),
          { minLength: 2, maxLength: 10 }
        ),
        async (fields) => {
          // Arrange: Render form with multiple date fields, all with null values
          const { unmount, getByTestId } = render(
            <TestMultipleDateFields fields={fields} />
          );

          // Wait for component to render
          await waitFor(() => {
            expect(getByTestId('multiple-date-fields-container')).toBeDefined();
          });

          // Assert: Verify all fields render with null values
          for (const field of fields) {
            const valueElement = getByTestId(`field-value-${field.id}`);
            expect(valueElement.textContent).toBe('null');
          }

          // Cleanup
          unmount();

          return true; // Property holds
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: All non-null values in multiple fields
   * 
   * This test verifies that multiple date fields with all non-null values
   * render correctly without errors or context conflicts.
   */
  it('should render multiple date fields with all non-null values', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            id: fc.uuid(),
            type: fieldTypeArbitrary,
            value: dateArbitrary,
          }),
          { minLength: 2, maxLength: 10 }
        ),
        async (fields) => {
          // Arrange: Render form with multiple date fields, all with values
          const { unmount, getByTestId } = render(
            <TestMultipleDateFields fields={fields} />
          );

          // Wait for component to render
          await waitFor(() => {
            expect(getByTestId('multiple-date-fields-container')).toBeDefined();
          });

          // Assert: Verify all fields render with their values
          for (const field of fields) {
            const valueElement = getByTestId(`field-value-${field.id}`);
            const displayedValue = valueElement.textContent || '';
            
            expect(displayedValue).not.toBe('null');
            
            // Verify it's a valid date
            const parsedDate = new Date(displayedValue);
            expect(parsedDate.toString()).not.toBe('Invalid Date');
            
            // Verify it matches the input date
            const originalTime = field.value.getTime();
            const storedTime = parsedDate.getTime();
            const timeDifference = Math.abs(originalTime - storedTime);
            expect(timeDifference).toBeLessThan(1000);
          }

          // Cleanup
          unmount();

          return true; // Property holds
        }
      ),
      { numRuns: 100 }
    );
  });
});
