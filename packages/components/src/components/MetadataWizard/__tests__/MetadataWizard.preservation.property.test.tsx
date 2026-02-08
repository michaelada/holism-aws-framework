/**
 * Property-Based Tests for Wizard Data Preservation
 * Feature: aws-web-app-framework, Property 32: Wizard Data Preservation
 * Validates: Requirements 24.7
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup, fireEvent, waitFor } from '@testing-library/react';
import * as fc from 'fast-check';
import { MetadataWizard } from '../MetadataWizard';
import type { ObjectDefinition, FieldDefinition, WizardConfiguration } from '../../../types';
import { FieldDatatype } from '../../../types';
import * as metadataHook from '../../../hooks/useMetadata';

describe('Property 32: Wizard Data Preservation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('should preserve data when navigating backward to previous step', async () => {
    fc.assert(
      fc.asyncProperty(
        fc.record({
          step1Value: fc.string({ minLength: 1, maxLength: 20 }),
          step2Value: fc.string({ minLength: 1, maxLength: 20 }),
        }),
        async ({ step1Value, step2Value }) => {
          cleanup();
          vi.clearAllMocks();

          const fields: FieldDefinition[] = [
            {
              shortName: 'field_step1',
              displayName: 'Step 1 Field',
              description: 'Field for step 1',
              datatype: FieldDatatype.TEXT,
              datatypeProperties: {},
            },
            {
              shortName: 'field_step2',
              displayName: 'Step 2 Field',
              description: 'Field for step 2',
              datatype: FieldDatatype.TEXT,
              datatypeProperties: {},
            },
          ];

          const wizardConfig: WizardConfiguration = {
            steps: [
              {
                name: 'Step 1',
                description: 'First step',
                fields: ['field_step1'],
                order: 0,
              },
              {
                name: 'Step 2',
                description: 'Second step',
                fields: ['field_step2'],
                order: 1,
              },
            ],
          };

          const objectDef: ObjectDefinition = {
            shortName: 'test_object',
            displayName: 'Test Object',
            description: 'Test',
            fields: fields.map((f, i) => ({
              fieldShortName: f.shortName,
              order: i,
            })),
            displayProperties: {},
            wizardConfig,
          };

          vi.spyOn(metadataHook, 'useMetadata').mockReturnValue({
            objectDef,
            fields,
            loading: false,
            error: null,
            refetch: vi.fn(),
          });

          const { container } = render(
            <MetadataWizard
              objectType="test_object"
              onComplete={vi.fn()}
              onCancel={vi.fn()}
            />
          );

          // Fill step 1 field
          const step1Input = container.querySelector('input[type="text"]');
          expect(step1Input).toBeTruthy();

          if (step1Input) {
            fireEvent.change(step1Input, { target: { value: step1Value } });

            // Click Next to go to step 2
            const nextButton = Array.from(container.querySelectorAll('button')).find(
              (btn) => btn.textContent === 'Next'
            );
            expect(nextButton).toBeTruthy();

            if (nextButton) {
              fireEvent.click(nextButton);

              // Wait for step 2 to be active
              await waitFor(() => {
                const activeSteps = container.querySelectorAll('.MuiStepLabel-label.Mui-active');
                expect(activeSteps[0].textContent).toBe('Step 2');
              });

              // Fill step 2 field
              const step2Input = container.querySelector('input[type="text"]');
              expect(step2Input).toBeTruthy();

              if (step2Input) {
                fireEvent.change(step2Input, { target: { value: step2Value } });

                // Click Back to return to step 1
                const backButton = Array.from(container.querySelectorAll('button')).find(
                  (btn) => btn.textContent === 'Back'
                );
                expect(backButton).toBeTruthy();

                if (backButton) {
                  fireEvent.click(backButton);

                  // Wait for step 1 to be active again
                  await waitFor(() => {
                    const activeSteps = container.querySelectorAll('.MuiStepLabel-label.Mui-active');
                    expect(activeSteps[0].textContent).toBe('Step 1');
                  });

                  // Verify step 1 data is preserved
                  const step1InputAgain = container.querySelector('input[type="text"]');
                  expect(step1InputAgain).toBeTruthy();
                  if (step1InputAgain) {
                    expect((step1InputAgain as HTMLInputElement).value).toBe(step1Value);
                  }
                }
              }
            }
          }
        }
      ),
      { numRuns: 10 }
    );
  });

  it('should preserve data from all previous steps when completing wizard', async () => {
    fc.assert(
      fc.asyncProperty(
        fc.record({
          values: fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 2, maxLength: 3 }),
        }),
        async ({ values }) => {
          cleanup();
          vi.clearAllMocks();

          const stepCount = values.length;

          // Generate fields for each step
          const fields: FieldDefinition[] = values.map((_, i) => ({
            shortName: `field_${i}`,
            displayName: `Field ${i + 1}`,
            description: `Field for step ${i + 1}`,
            datatype: FieldDatatype.TEXT,
            datatypeProperties: {},
          }));

          const wizardConfig: WizardConfiguration = {
            steps: values.map((_, i) => ({
              name: `Step ${i + 1}`,
              description: `Step ${i + 1} description`,
              fields: [`field_${i}`],
              order: i,
            })),
          };

          const objectDef: ObjectDefinition = {
            shortName: 'test_object',
            displayName: 'Test Object',
            description: 'Test',
            fields: fields.map((f, i) => ({
              fieldShortName: f.shortName,
              order: i,
            })),
            displayProperties: {},
            wizardConfig,
          };

          const onComplete = vi.fn();

          vi.spyOn(metadataHook, 'useMetadata').mockReturnValue({
            objectDef,
            fields,
            loading: false,
            error: null,
            refetch: vi.fn(),
          });

          const { container } = render(
            <MetadataWizard
              objectType="test_object"
              onComplete={onComplete}
              onCancel={vi.fn()}
            />
          );

          // Fill each step and navigate forward
          for (let i = 0; i < stepCount; i++) {
            const input = container.querySelector('input[type="text"]');
            expect(input).toBeTruthy();

            if (input) {
              fireEvent.change(input, { target: { value: values[i] } });

              const isLastStep = i === stepCount - 1;
              const buttonText = isLastStep ? 'Complete' : 'Next';
              const button = Array.from(container.querySelectorAll('button')).find(
                (btn) => btn.textContent === buttonText
              );
              expect(button).toBeTruthy();

              if (button) {
                fireEvent.click(button);

                if (isLastStep) {
                  // Wait for completion
                  await waitFor(() => {
                    expect(onComplete).toHaveBeenCalled();
                  });

                  // Verify all data was submitted
                  const submittedData = onComplete.mock.calls[0][0];
                  values.forEach((value, idx) => {
                    expect(submittedData[`field_${idx}`]).toBe(value);
                  });
                } else {
                  // Wait for next step
                  await waitFor(() => {
                    const activeSteps = container.querySelectorAll('.MuiStepLabel-label.Mui-active');
                    expect(activeSteps[0].textContent).toBe(`Step ${i + 2}`);
                  });
                }
              }
            }
          }
        }
      ),
      { numRuns: 10 }
    );
  });
});
