/**
 * Property-Based Tests for Wizard Step Validation
 * Feature: aws-web-app-framework, Property 31: Wizard Step Validation
 * Validates: Requirements 24.6
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup, fireEvent, waitFor } from '@testing-library/react';
import * as fc from 'fast-check';
import { MetadataWizard } from '../MetadataWizard';
import type { ObjectDefinition, FieldDefinition, WizardConfiguration } from '../../../types';
import { FieldDatatype } from '../../../types';
import * as metadataHook from '../../../hooks/useMetadata';

describe('Property 31: Wizard Step Validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('should prevent navigation to next step when mandatory fields are not filled', async () => {
    fc.assert(
      fc.asyncProperty(
        fc.record({
          mandatoryFieldCount: fc.integer({ min: 1, max: 3 }),
        }),
        async ({ mandatoryFieldCount }) => {
          cleanup();
          vi.clearAllMocks();

          // Generate mandatory fields for first step
          const fields: FieldDefinition[] = Array.from(
            { length: mandatoryFieldCount },
            (_, i) => ({
              shortName: `mandatory_field_${i}`,
              displayName: `Mandatory Field ${i + 1}`,
              description: `Mandatory field ${i + 1}`,
              datatype: FieldDatatype.TEXT,
              datatypeProperties: {},
              mandatory: true,
            })
          );

          const wizardConfig: WizardConfiguration = {
            steps: [
              {
                name: 'Step 1',
                description: 'First step with mandatory fields',
                fields: fields.map((f) => f.shortName),
                order: 0,
              },
              {
                name: 'Step 2',
                description: 'Second step',
                fields: [],
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
              mandatory: true,
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

          const onComplete = vi.fn();
          const { container } = render(
            <MetadataWizard
              objectType="test_object"
              onComplete={onComplete}
              onCancel={vi.fn()}
            />
          );

          // Try to click Next button without filling fields
          const nextButton = Array.from(container.querySelectorAll('button')).find(
            (btn) => btn.textContent === 'Next'
          );
          expect(nextButton).toBeTruthy();

          if (nextButton) {
            fireEvent.click(nextButton);

            // Wait for validation to complete
            await waitFor(() => {
              // Should still be on step 1 (first step should be active)
              const activeSteps = container.querySelectorAll('.MuiStepLabel-label.Mui-active');
              expect(activeSteps.length).toBe(1);
              expect(activeSteps[0].textContent).toBe('Step 1');
            });

            // Validation should have prevented navigation
            // (we're still on step 1, not step 2)
            const step2Active = Array.from(
              container.querySelectorAll('.MuiStepLabel-label.Mui-active')
            ).some((el) => el.textContent === 'Step 2');
            expect(step2Active).toBe(false);
          }
        }
      ),
      { numRuns: 10 }
    );
  });

  it('should allow navigation to next step when all mandatory fields are filled', async () => {
    fc.assert(
      fc.asyncProperty(
        fc.record({
          fieldValue: fc.string({ minLength: 1, maxLength: 20 }),
        }),
        async ({ fieldValue }) => {
          cleanup();
          vi.clearAllMocks();

          const field: FieldDefinition = {
            shortName: 'mandatory_field',
            displayName: 'Mandatory Field',
            description: 'A mandatory field',
            datatype: FieldDatatype.TEXT,
            datatypeProperties: {},
            mandatory: true,
          };

          const wizardConfig: WizardConfiguration = {
            steps: [
              {
                name: 'Step 1',
                description: 'First step',
                fields: ['mandatory_field'],
                order: 0,
              },
              {
                name: 'Step 2',
                description: 'Second step',
                fields: [],
                order: 1,
              },
            ],
          };

          const objectDef: ObjectDefinition = {
            shortName: 'test_object',
            displayName: 'Test Object',
            description: 'Test',
            fields: [
              {
                fieldShortName: 'mandatory_field',
                mandatory: true,
                order: 0,
              },
            ],
            displayProperties: {},
            wizardConfig,
          };

          vi.spyOn(metadataHook, 'useMetadata').mockReturnValue({
            objectDef,
            fields: [field],
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

          // Fill the mandatory field
          const input = container.querySelector('input[type="text"]');
          expect(input).toBeTruthy();

          if (input) {
            fireEvent.change(input, { target: { value: fieldValue } });

            // Click Next button
            const nextButton = Array.from(container.querySelectorAll('button')).find(
              (btn) => btn.textContent === 'Next'
            );
            expect(nextButton).toBeTruthy();

            if (nextButton) {
              fireEvent.click(nextButton);

              // Wait for navigation to complete
              await waitFor(
                () => {
                  // Should now be on step 2
                  const activeSteps = container.querySelectorAll('.MuiStepLabel-label.Mui-active');
                  expect(activeSteps.length).toBe(1);
                  expect(activeSteps[0].textContent).toBe('Step 2');
                },
                { timeout: 2000 }
              );
            }
          }
        }
      ),
      { numRuns: 10 }
    );
  });
});
