/**
 * Property-Based Tests for FieldRenderer Component
 * Feature: aws-web-app-framework, Property 18: Field Rendering by Datatype
 * Validates: Requirements 14.4, 14.10, 14.11
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { render, screen } from '@testing-library/react';
import { FieldRenderer } from '../FieldRenderer';
import { FieldDatatype, type FieldDefinition } from '../../../types';

// Arbitraries for generating test data
const fieldDatatypeArbitrary = fc.constantFrom(
  FieldDatatype.TEXT,
  FieldDatatype.TEXT_AREA,
  FieldDatatype.EMAIL,
  FieldDatatype.URL,
  FieldDatatype.NUMBER,
  FieldDatatype.BOOLEAN,
  FieldDatatype.DATE,
  FieldDatatype.TIME,
  FieldDatatype.DATETIME,
  FieldDatatype.SINGLE_SELECT,
  FieldDatatype.MULTI_SELECT
);

const fieldDefinitionArbitrary = fc
  .record({
    shortName: fc.stringOf(fc.char(), { minLength: 3, maxLength: 50 })
      .filter(s => s.trim().length >= 3 && /[a-zA-Z0-9]/.test(s)),
    displayName: fc.string({ minLength: 3, maxLength: 100 })
      .filter(s => s.trim().length >= 3 && /[a-zA-Z0-9]/.test(s)),
    description: fc.string({ maxLength: 200 }),
    datatype: fieldDatatypeArbitrary,
    mandatory: fc.boolean(),
  })
  .map((base) => {
    const field: FieldDefinition = {
      ...base,
      datatypeProperties: {},
      validationRules: [],
    };

    // Add datatype-specific properties
    if (base.datatype === FieldDatatype.SINGLE_SELECT) {
      field.datatypeProperties = {
        displayMode: fc.sample(fc.constantFrom('radio', 'dropdown'), 1)[0],
        options: [
          { value: 'option1', label: 'Option 1' },
          { value: 'option2', label: 'Option 2' },
        ],
      };
    } else if (base.datatype === FieldDatatype.MULTI_SELECT) {
      field.datatypeProperties = {
        options: [
          { value: 'option1', label: 'Option 1' },
          { value: 'option2', label: 'Option 2' },
        ],
      };
    }

    return field;
  });

describe('FieldRenderer Property Tests', () => {
  describe('Property 18: Field Rendering by Datatype', () => {
    it('should render appropriate MUI component based on datatype', () => {
      fc.assert(
        fc.property(fieldDefinitionArbitrary, (fieldDef) => {
          const { container, unmount } = render(
            <FieldRenderer
              fieldDefinition={fieldDef}
              value={null}
              onChange={() => {}}
            />
          );

          // Verify the field label is rendered (check in container, not screen)
          const hasLabel = container.textContent?.includes(fieldDef.displayName);
          expect(hasLabel).toBeTruthy();

          // Verify appropriate input type based on datatype
          switch (fieldDef.datatype) {
            case FieldDatatype.TEXT:
            case FieldDatatype.EMAIL:
            case FieldDatatype.URL:
              // Should render TextField
              expect(container.querySelector('input[type="text"], input[type="email"], input[type="url"]')).toBeTruthy();
              break;

            case FieldDatatype.TEXT_AREA:
              // Should render multiline TextField
              expect(container.querySelector('textarea')).toBeTruthy();
              break;

            case FieldDatatype.NUMBER:
              // Should render number input
              expect(container.querySelector('input[type="number"]')).toBeTruthy();
              break;

            case FieldDatatype.BOOLEAN:
              // Should render checkbox
              expect(container.querySelector('input[type="checkbox"]')).toBeTruthy();
              break;

            case FieldDatatype.DATE:
            case FieldDatatype.TIME:
            case FieldDatatype.DATETIME:
              // Should render date/time picker (MUI DatePicker renders as text input)
              expect(container.querySelector('input')).toBeTruthy();
              break;

            case FieldDatatype.SINGLE_SELECT:
              // Should render either radio buttons or select dropdown
              const hasRadio = container.querySelector('input[type="radio"]');
              const hasSelect = container.querySelector('[role="combobox"]');
              expect(hasRadio || hasSelect).toBeTruthy();
              break;

            case FieldDatatype.MULTI_SELECT:
              // Should render multi-select dropdown
              expect(container.querySelector('[role="combobox"]')).toBeTruthy();
              break;
          }
          
          // Clean up after each test
          unmount();
        }),
        { numRuns: 50 }
      );
    });

    it('should display field label from displayName for all datatypes', () => {
      fc.assert(
        fc.property(fieldDefinitionArbitrary, (fieldDef) => {
          const { container, unmount } = render(
            <FieldRenderer
              fieldDefinition={fieldDef}
              value={null}
              onChange={() => {}}
            />
          );

          // Field display name should be visible in the container
          const hasLabel = container.textContent?.includes(fieldDef.displayName);
          expect(hasLabel).toBeTruthy();
          
          // Clean up
          unmount();
        }),
        { numRuns: 50 }
      );
    });

    it('should mark mandatory fields with required attribute', () => {
      fc.assert(
        fc.property(
          fieldDefinitionArbitrary.filter((f) => f.mandatory && f.datatype !== FieldDatatype.BOOLEAN),
          (fieldDef) => {
            const { container } = render(
              <FieldRenderer
                fieldDefinition={fieldDef}
                value={null}
                onChange={() => {}}
              />
            );

            // For most input types, check for required attribute or asterisk
            const hasRequiredAttr = container.querySelector('[required]');
            const hasAsterisk = container.textContent?.includes('*');
            
            // At least one indicator of required field should be present
            expect(hasRequiredAttr || hasAsterisk).toBeTruthy();
          }
        ),
        { numRuns: 30 }
      );
    });

    it('should render DatePicker for date datatype', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 1000 }).map(id => ({
            shortName: `test_date_${id}`,
            displayName: `Test Date ${id}`,
            description: 'A test date field',
            datatype: FieldDatatype.DATE,
            mandatory: fc.sample(fc.boolean(), 1)[0],
            datatypeProperties: {},
            validationRules: [],
          })),
          (fieldDef) => {
            const { container, unmount } = render(
              <FieldRenderer
                fieldDefinition={fieldDef}
                value={null}
                onChange={() => {}}
              />
            );

            // DatePicker should render an input field
            expect(container.querySelector('input')).toBeTruthy();
            
            // Clean up to avoid multiple instances
            unmount();
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should render Radio or Select for single_select based on displayMode', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('radio', 'dropdown'),
          (displayMode) => {
            const fieldDef: FieldDefinition = {
              shortName: 'test_select',
              displayName: 'Test Select',
              description: 'A test select field',
              datatype: FieldDatatype.SINGLE_SELECT,
              mandatory: false,
              datatypeProperties: {
                displayMode,
                options: [
                  { value: 'opt1', label: 'Option 1' },
                  { value: 'opt2', label: 'Option 2' },
                ],
              },
              validationRules: [],
            };

            const { container } = render(
              <FieldRenderer
                fieldDefinition={fieldDef}
                value={null}
                onChange={() => {}}
              />
            );

            if (displayMode === 'radio') {
              // Should render radio buttons
              expect(container.querySelector('input[type="radio"]')).toBeTruthy();
            } else {
              // Should render select dropdown
              expect(container.querySelector('[role="combobox"]')).toBeTruthy();
            }
          }
        ),
        { numRuns: 20 }
      );
    });
  });
});
