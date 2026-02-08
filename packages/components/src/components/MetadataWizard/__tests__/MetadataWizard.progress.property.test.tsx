/**
 * Property-Based Tests for Wizard Progress Indication
 * Feature: aws-web-app-framework, Property 33: Wizard Progress Indication
 * Validates: Requirements 24.9
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup, fireEvent, waitFor } from '@testing-library/react';
import * as fc from 'fast-check';
import { MetadataWizard } from '../MetadataWizard';
import type { ObjectDefinition, FieldDefinition, WizardConfiguration } from '../../../types';
import { FieldDatatype } from '../../../types';
import * as metadataHook from '../../../hooks/useMetadata';

describe('Property 33: Wizard Progress Indication', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('should display all steps in the stepper throughout wizard flow', () => {
    fc.assert(
      fc.property(
        fc.record({
          stepCount: fc.integer({ min: 2, max: 5 }),
        }),
        ({ stepCount }) => {
          cleanup();
          vi.clearAllMocks();

          // Generate fields and steps
          const fields: FieldDefinition[] = Array.from({ length: stepCount }, (_, i) => ({
            shortName: `field_${i}`,
            displayName: `Field ${i + 1}`,
            description: `Field for step ${i + 1}`,
            datatype: FieldDatatype.TEXT,
            datatypeProperties: {},
            mandatory: false,
          }));

          const wizardConfig: WizardConfiguration = {
            steps: Array.from({ length: stepCount }, (_, i) => ({
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
              mandatory: false,
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

          // Verify stepper shows all steps
          const stepLabels = container.querySelectorAll('.MuiStepLabel-label');
          expect(stepLabels.length).toBe(stepCount);

          // Verify each step label is correct
          stepLabels.forEach((label, index) => {
            expect(label.textContent).toBe(`Step ${index + 1}`);
          });

          // Verify step icons show numbers
          const stepIcons = container.querySelectorAll('.MuiStepIcon-text');
          expect(stepIcons.length).toBe(stepCount);
          stepIcons.forEach((icon, index) => {
            expect(icon.textContent).toBe(`${index + 1}`);
          });
        }
      ),
      { numRuns: 20 }
    );
  });

  it('should indicate current step and completed steps as user progresses', async () => {
    fc.assert(
      fc.asyncProperty(
        fc.record({
          stepCount: fc.integer({ min: 3, max: 4 }),
          targetStep: fc.integer({ min: 1, max: 2 }), // Navigate to step 2 or 3
        }),
        async ({ stepCount, targetStep }) => {
          cleanup();
          vi.clearAllMocks();

          // Generate fields and steps
          const fields: FieldDefinition[] = Array.from({ length: stepCount }, (_, i) => ({
            shortName: `field_${i}`,
            displayName: `Field ${i + 1}`,
            description: `Field for step ${i + 1}`,
            datatype: FieldDatatype.TEXT,
            datatypeProperties: {},
            mandatory: false,
          }));

          const wizardConfig: WizardConfiguration = {
            steps: Array.from({ length: stepCount }, (_, i) => ({
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
              mandatory: false,
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

          // Navigate through steps
          for (let i = 0; i < targetStep; i++) {
            const input = container.querySelector('input[type="text"]');
            if (input) {
              fireEvent.change(input, { target: { value: `value_${i}` } });
            }

            const nextButton = Array.from(container.querySelectorAll('button')).find(
              (btn) => btn.textContent === 'Next'
            );

            if (nextButton) {
              fireEvent.click(nextButton);

              await waitFor(() => {
                const activeSteps = container.querySelectorAll('.MuiStepLabel-label.Mui-active');
                expect(activeSteps.length).toBe(1);
                expect(activeSteps[0].textContent).toBe(`Step ${i + 2}`);
              });
            }
          }

          // Verify current step is indicated as active
          const activeSteps = container.querySelectorAll('.MuiStepLabel-label.Mui-active');
          expect(activeSteps.length).toBe(1);
          expect(activeSteps[0].textContent).toBe(`Step ${targetStep + 1}`);

          // Verify completed steps are marked
          const completedSteps = container.querySelectorAll('.MuiStep-root.MuiStep-completed');
          expect(completedSteps.length).toBe(targetStep);
        }
      ),
      { numRuns: 10 }
    );
  });

  it('should show progress throughout entire wizard flow', async () => {
    fc.assert(
      fc.asyncProperty(
        fc.record({
          stepCount: fc.integer({ min: 2, max: 3 }),
        }),
        async ({ stepCount }) => {
          cleanup();
          vi.clearAllMocks();

          // Generate fields and steps
          const fields: FieldDefinition[] = Array.from({ length: stepCount }, (_, i) => ({
            shortName: `field_${i}`,
            displayName: `Field ${i + 1}`,
            description: `Field for step ${i + 1}`,
            datatype: FieldDatatype.TEXT,
            datatypeProperties: {},
            mandatory: false,
          }));

          const wizardConfig: WizardConfiguration = {
            steps: Array.from({ length: stepCount }, (_, i) => ({
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
              mandatory: false,
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

          // Verify stepper is always visible
          const stepper = container.querySelector('.MuiStepper-root');
          expect(stepper).toBeTruthy();

          // Navigate through all steps and verify stepper remains visible
          for (let i = 0; i < stepCount; i++) {
            // Stepper should still be visible
            const stepperCheck = container.querySelector('.MuiStepper-root');
            expect(stepperCheck).toBeTruthy();

            // Verify all step labels are still present
            const stepLabels = container.querySelectorAll('.MuiStepLabel-label');
            expect(stepLabels.length).toBe(stepCount);

            if (i < stepCount - 1) {
              // Fill field and navigate
              const input = container.querySelector('input[type="text"]');
              if (input) {
                fireEvent.change(input, { target: { value: `value_${i}` } });
              }

              const nextButton = Array.from(container.querySelectorAll('button')).find(
                (btn) => btn.textContent === 'Next'
              );

              if (nextButton) {
                fireEvent.click(nextButton);

                await waitFor(() => {
                  const activeSteps = container.querySelectorAll('.MuiStepLabel-label.Mui-active');
                  expect(activeSteps[0].textContent).toBe(`Step ${i + 2}`);
                });
              }
            }
          }
        }
      ),
      { numRuns: 10 }
    );
  });
});
