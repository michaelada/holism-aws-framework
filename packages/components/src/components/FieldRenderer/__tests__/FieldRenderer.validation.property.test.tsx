/**
 * Property-Based Tests for FieldRenderer Validation
 * Feature: aws-web-app-framework, Property 35: Validation Rule Enforcement (Client)
 * Validates: Requirements 25.5
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FieldRenderer } from '../FieldRenderer';
import { FieldDatatype, ValidationType, type FieldDefinition, type ValidationRule } from '../../../types';

// Arbitraries for generating test data
const validationRuleArbitrary = fc.oneof(
  // Min length rule
  fc.record({
    type: fc.constant(ValidationType.MIN_LENGTH),
    value: fc.integer({ min: 1, max: 10 }),
    message: fc.option(fc.string({ maxLength: 50 })),
  }),
  // Max length rule
  fc.record({
    type: fc.constant(ValidationType.MAX_LENGTH),
    value: fc.integer({ min: 5, max: 100 }),
    message: fc.option(fc.string({ maxLength: 50 })),
  }),
  // Min value rule
  fc.record({
    type: fc.constant(ValidationType.MIN_VALUE),
    value: fc.integer({ min: 0, max: 50 }),
    message: fc.option(fc.string({ maxLength: 50 })),
  }),
  // Max value rule
  fc.record({
    type: fc.constant(ValidationType.MAX_VALUE),
    value: fc.integer({ min: 50, max: 1000 }),
    message: fc.option(fc.string({ maxLength: 50 })),
  }),
  // Email rule
  fc.record({
    type: fc.constant(ValidationType.EMAIL),
    message: fc.option(fc.string({ maxLength: 50 })),
  }),
  // Required rule
  fc.record({
    type: fc.constant(ValidationType.REQUIRED),
    message: fc.option(fc.string({ maxLength: 50 })),
  })
);

/**
 * One rule of each kind.
 *
 * A field carrying two `max_value` rules is not something the form builder can
 * produce, but the generator made them — and the validator chains them into one
 * schema, where the last written wins. The property then chose the first rule,
 * entered a value the second allowed, and failed over a field that was in fact
 * valid.
 */
function withOneRulePerType(rules: ValidationRule[]): ValidationRule[] {
  const seen = new Set<ValidationType>();
  return rules.filter((rule) => (seen.has(rule.type) ? false : (seen.add(rule.type), true)));
}

const textFieldWithValidationArbitrary = fc
  .record({
    shortName: fc.stringOf(fc.char(), { minLength: 3, maxLength: 20 }),
    displayName: fc.string({ minLength: 3, maxLength: 50 }),
    description: fc.string({ maxLength: 100 }),
    mandatory: fc.boolean(),
    validationRules: fc.array(validationRuleArbitrary, { minLength: 1, maxLength: 3 }),
  })
  .map((base) => {
    const field: FieldDefinition = {
      ...base,
      validationRules: withOneRulePerType(base.validationRules as ValidationRule[]),
      datatype: FieldDatatype.TEXT,
      datatypeProperties: {},
    };
    return field;
  });

const numberFieldWithValidationArbitrary = fc
  .record({
    shortName: fc.stringOf(fc.char(), { minLength: 3, maxLength: 20 }),
    displayName: fc.string({ minLength: 3, maxLength: 50 }),
    description: fc.string({ maxLength: 100 }),
    mandatory: fc.boolean(),
    validationRules: fc.array(
      fc.oneof(
        fc.record({
          type: fc.constant(ValidationType.MIN_VALUE),
          value: fc.integer({ min: 0, max: 50 }),
          message: fc.option(fc.string({ maxLength: 50 })),
        }),
        fc.record({
          type: fc.constant(ValidationType.MAX_VALUE),
          value: fc.integer({ min: 50, max: 1000 }),
          message: fc.option(fc.string({ maxLength: 50 })),
        })
      ),
      { minLength: 1, maxLength: 2 }
    ),
  })
  .map((base) => {
    const field: FieldDefinition = {
      ...base,
      validationRules: withOneRulePerType(base.validationRules as ValidationRule[]),
      datatype: FieldDatatype.NUMBER,
      datatypeProperties: {},
    };
    return field;
  });

describe('FieldRenderer Validation Property Tests', () => {
  describe('Property 35: Validation Rule Enforcement (Client)', () => {
    it('should validate field on blur and display error for invalid values', async () => {
      await fc.assert(
        fc.asyncProperty(
          textFieldWithValidationArbitrary,
          async (fieldDef) => {
            let currentValue = '';
            const handleChange = (value: any) => {
              currentValue = value;
            };

            const { container, rerender } = render(
              <FieldRenderer
                fieldDefinition={fieldDef}
                value={currentValue}
                onChange={handleChange}
              />
            );

            const input = container.querySelector('input');
            if (!input) return; // Skip if no input found

            // Find a validation rule to test
            const minLengthRule = fieldDef.validationRules?.find(
              (r) => r.type === ValidationType.MIN_LENGTH
            );
            const maxLengthRule = fieldDef.validationRules?.find(
              (r) => r.type === ValidationType.MAX_LENGTH
            );

            if (minLengthRule && minLengthRule.value) {
              // Enter text shorter than min length
              const invalidValue = 'a'.repeat(Math.max(0, minLengthRule.value - 1));
              fireEvent.change(input, { target: { value: invalidValue } });
              
              // Rerender with new value
              rerender(
                <FieldRenderer
                  fieldDefinition={fieldDef}
                  value={invalidValue}
                  onChange={handleChange}
                />
              );

              /*
               * `fireEvent.blur`, not `input.blur()`. React listens for the
               * event at the root, and a native `blur()` on an element that was
               * never focused dispatches nothing — so the renderer's `onBlur`
               * never ran and no validation error was ever produced.
               */
              fireEvent.blur(input);

              // Wait for validation error to appear
              /*
               * That the field is reported invalid, not the words used to say
               * so. A generated rule may carry its own `message` — the
               * generator produces things like " " — and the validator quite
               * correctly shows that instead of the default wording.
               */
              await waitFor(
                () => {
                  expect(input).toHaveAttribute('aria-invalid', 'true');
                },
                { timeout: 1000 }
              );
            } else if (maxLengthRule && maxLengthRule.value) {
              // Enter text longer than max length
              const invalidValue = 'a'.repeat(maxLengthRule.value + 5);
              fireEvent.change(input, { target: { value: invalidValue } });
              
              // Rerender with new value
              rerender(
                <FieldRenderer
                  fieldDefinition={fieldDef}
                  value={invalidValue}
                  onChange={handleChange}
                />
              );

              /*
               * `fireEvent.blur`, not `input.blur()`. React listens for the
               * event at the root, and a native `blur()` on an element that was
               * never focused dispatches nothing — so the renderer's `onBlur`
               * never ran and no validation error was ever produced.
               */
              fireEvent.blur(input);

              // Wait for validation error to appear
              /*
               * That the field is reported invalid, not the words used to say
               * so. A generated rule may carry its own `message` — the
               * generator produces things like " " — and the validator quite
               * correctly shows that instead of the default wording.
               */
              await waitFor(
                () => {
                  expect(input).toHaveAttribute('aria-invalid', 'true');
                },
                { timeout: 1000 }
              );
            }
          }
        ),
        { numRuns: 20 }
      );
    }, 20000);

    it('should validate number fields against min/max value rules', async () => {
      await fc.assert(
        fc.asyncProperty(
          numberFieldWithValidationArbitrary,
          async (fieldDef) => {
            let currentValue: number | null = null;
            const handleChange = (value: any) => {
              currentValue = value;
            };

            const { container, rerender } = render(
              <FieldRenderer
                fieldDefinition={fieldDef}
                value={currentValue}
                onChange={handleChange}
              />
            );

            const input = container.querySelector('input[type="number"]');
            if (!input) return; // Skip if no input found

            // Find a validation rule to test
            const minValueRule = fieldDef.validationRules?.find(
              (r) => r.type === ValidationType.MIN_VALUE
            );
            const maxValueRule = fieldDef.validationRules?.find(
              (r) => r.type === ValidationType.MAX_VALUE
            );

            if (minValueRule && minValueRule.value !== undefined) {
              // Enter value less than min
              const invalidValue = minValueRule.value - 10;
              fireEvent.change(input, { target: { value: invalidValue.toString() } });
              
              // Rerender with new value
              rerender(
                <FieldRenderer
                  fieldDefinition={fieldDef}
                  value={invalidValue}
                  onChange={handleChange}
                />
              );

              /*
               * `fireEvent.blur`, not `input.blur()`. React listens for the
               * event at the root, and a native `blur()` on an element that was
               * never focused dispatches nothing — so the renderer's `onBlur`
               * never ran and no validation error was ever produced.
               */
              fireEvent.blur(input);

              // Wait for validation error to appear
              /*
               * That the field is reported invalid, not the words used to say
               * so. A generated rule may carry its own `message` — the
               * generator produces things like " " — and the validator quite
               * correctly shows that instead of the default wording.
               */
              await waitFor(
                () => {
                  expect(input).toHaveAttribute('aria-invalid', 'true');
                },
                { timeout: 1000 }
              );
            } else if (maxValueRule && maxValueRule.value !== undefined) {
              // Enter value greater than max
              const invalidValue = maxValueRule.value + 10;
              fireEvent.change(input, { target: { value: invalidValue.toString() } });
              
              // Rerender with new value
              rerender(
                <FieldRenderer
                  fieldDefinition={fieldDef}
                  value={invalidValue}
                  onChange={handleChange}
                />
              );

              /*
               * `fireEvent.blur`, not `input.blur()`. React listens for the
               * event at the root, and a native `blur()` on an element that was
               * never focused dispatches nothing — so the renderer's `onBlur`
               * never ran and no validation error was ever produced.
               */
              fireEvent.blur(input);

              // Wait for validation error to appear
              /*
               * That the field is reported invalid, not the words used to say
               * so. A generated rule may carry its own `message` — the
               * generator produces things like " " — and the validator quite
               * correctly shows that instead of the default wording.
               */
              await waitFor(
                () => {
                  expect(input).toHaveAttribute('aria-invalid', 'true');
                },
                { timeout: 1000 }
              );
            }
          }
        ),
        { numRuns: 20 }
      );
    }, 20000);

    it('should display validation errors inline near the field', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            shortName: fc.constant('test_field'),
            displayName: fc.constant('Test Field'),
            description: fc.constant('Test description'),
            datatype: fc.constant(FieldDatatype.TEXT),
            mandatory: fc.constant(true),
            datatypeProperties: fc.constant({}),
            validationRules: fc.constant([
              {
                type: ValidationType.MIN_LENGTH,
                value: 5,
                message: 'Must be at least 5 characters',
              },
            ]),
          }),
          async (fieldDef) => {
            const user = userEvent.setup();
            let currentValue = '';
            const handleChange = (value: any) => {
              currentValue = value;
            };

            const { container, rerender } = render(
              <FieldRenderer
                fieldDefinition={fieldDef}
                value={currentValue}
                onChange={handleChange}
              />
            );

            const input = container.querySelector('input');
            if (!input) return;

            // Enter invalid value
            await user.type(input, 'abc');
            
            // Rerender with new value
            rerender(
              <FieldRenderer
                fieldDefinition={fieldDef}
                value="abc"
                onChange={handleChange}
              />
            );

            // Trigger blur by focusing out
            input.blur();

            // Wait for error message to appear
            await waitFor(
              () => {
                // Error should be displayed in helper text or error message
                const helperText = container.querySelector('.MuiFormHelperText-root');
                expect(helperText).toBeTruthy();
                expect(helperText?.textContent).toMatch(/5|characters|minimum/i);
              },
              { timeout: 1000 }
            );
          }
        ),
        { numRuns: 10 }
      );
    });

    it('should clear validation error when valid value is entered', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            shortName: fc.constant('test_field'),
            displayName: fc.constant('Test Field'),
            description: fc.constant('Test description'),
            datatype: fc.constant(FieldDatatype.TEXT),
            mandatory: fc.constant(true),
            datatypeProperties: fc.constant({}),
            validationRules: fc.constant([
              {
                type: ValidationType.MIN_LENGTH,
                value: 5,
                message: 'Must be at least 5 characters',
              },
            ]),
          }),
          async (fieldDef) => {
            const user = userEvent.setup();
            let currentValue = '';
            const handleChange = (value: any) => {
              currentValue = value;
            };

            const { container, rerender } = render(
              <FieldRenderer
                fieldDefinition={fieldDef}
                value={currentValue}
                onChange={handleChange}
              />
            );

            const input = container.querySelector('input');
            if (!input) return;

            // Enter invalid value first
            await user.type(input, 'abc');
            rerender(
              <FieldRenderer
                fieldDefinition={fieldDef}
                value="abc"
                onChange={handleChange}
              />
            );
            input.blur();

            // Wait for error to appear
            await waitFor(() => {
              expect(container.textContent).toMatch(/5|characters|minimum/i);
            });

            // Now enter valid value
            await user.clear(input);
            await user.type(input, 'abcdef');
            rerender(
              <FieldRenderer
                fieldDefinition={fieldDef}
                value="abcdef"
                onChange={handleChange}
              />
            );
            input.blur();

            // Error should be cleared
            await waitFor(
              () => {
                const errorElements = container.querySelectorAll('.Mui-error');
                expect(errorElements.length).toBe(0);
              },
              { timeout: 1000 }
            );
          }
        ),
        { numRuns: 10 }
      );
    });
  });
});
