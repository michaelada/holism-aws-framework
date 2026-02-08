/**
 * Property-Based Tests for Wizard Step Rendering
 * Feature: aws-web-app-framework, Property 30: Wizard Step Rendering
 * Validates: Requirements 24.5
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import * as fc from 'fast-check';
import { MetadataWizard } from '../MetadataWizard';
import type { ObjectDefinition, FieldDefinition, WizardConfiguration } from '../../../types';
import { FieldDatatype } from '../../../types';
import * as metadataHook from '../../../hooks/useMetadata';

describe('Property 30: Wizard Step Rendering', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('should render steps sequentially and display only fields for current step', () => {
    fc.assert(
      fc.property(
        fc.record({
          stepCount: fc.integer({ min: 2, max: 5 }),
          fieldsPerStep: fc.integer({ min: 1, max: 3 }),
        }),
        ({ stepCount, fieldsPerStep }) => {
          cleanup();
          vi.clearAllMocks();

          // Generate fields for all steps
          const allFields: FieldDefinition[] = [];
          const wizardSteps = [];

          for (let stepIdx = 0; stepIdx < stepCount; stepIdx++) {
            const stepFields: string[] = [];
            for (let fieldIdx = 0; fieldIdx < fieldsPerStep; fieldIdx++) {
              const fieldShortName = `step${stepIdx}_field${fieldIdx}`;
              stepFields.push(fieldShortName);
              allFields.push({
                shortName: fieldShortName,
                displayName: `Step ${stepIdx + 1} Field ${fieldIdx + 1}`,
                description: `Field ${fieldIdx + 1} for step ${stepIdx + 1}`,
                datatype: FieldDatatype.TEXT,
                datatypeProperties: {},
              });
            }

            wizardSteps.push({
              name: `Step ${stepIdx + 1}`,
              description: `Description for step ${stepIdx + 1}`,
              fields: stepFields,
              order: stepIdx,
            });
          }

          const wizardConfig: WizardConfiguration = {
            steps: wizardSteps,
          };

          const objectDef: ObjectDefinition = {
            shortName: 'test_object',
            displayName: 'Test Object',
            description: 'Test object with wizard',
            fields: allFields.map((f, i) => ({
              fieldShortName: f.shortName,
              order: i,
            })),
            displayProperties: {},
            wizardConfig,
          };

          vi.spyOn(metadataHook, 'useMetadata').mockReturnValue({
            objectDef,
            fields: allFields,
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

          // Verify all steps are shown in stepper
          const stepLabels = container.querySelectorAll('.MuiStepLabel-label');
          expect(stepLabels.length).toBe(stepCount);

          // Verify first step is active
          const activeSteps = container.querySelectorAll('.MuiStepLabel-label.Mui-active');
          expect(activeSteps.length).toBe(1);
          expect(activeSteps[0].textContent).toBe('Step 1');

          // Verify only first step fields are rendered
          const firstStepFields = wizardSteps[0].fields;
          firstStepFields.forEach((fieldShortName) => {
            const field = allFields.find((f) => f.shortName === fieldShortName);
            if (field) {
              // Check that field label is present
              const labels = container.querySelectorAll('label');
              const fieldLabel = Array.from(labels).find((label) =>
                label.textContent?.includes(field.displayName)
              );
              expect(fieldLabel).toBeTruthy();
            }
          });

          // Verify fields from other steps are NOT rendered
          for (let stepIdx = 1; stepIdx < stepCount; stepIdx++) {
            const otherStepFields = wizardSteps[stepIdx].fields;
            otherStepFields.forEach((fieldShortName) => {
              const field = allFields.find((f) => f.shortName === fieldShortName);
              if (field) {
                const labels = container.querySelectorAll('label');
                const fieldLabel = Array.from(labels).find((label) =>
                  label.textContent?.includes(field.displayName)
                );
                // This field should NOT be present
                expect(fieldLabel).toBeFalsy();
              }
            });
          }
        }
      ),
      { numRuns: 20 }
    );
  });

  it('should display correct step name and description for current step', () => {
    fc.assert(
      fc.property(
        fc.record({
          stepName: fc.string({ minLength: 1, maxLength: 50 }),
          stepDescription: fc.string({ minLength: 1, maxLength: 200 }),
        }),
        ({ stepName, stepDescription }) => {
          cleanup();
          vi.clearAllMocks();

          const field: FieldDefinition = {
            shortName: 'test_field',
            displayName: 'Test Field',
            description: 'Test field description',
            datatype: FieldDatatype.TEXT,
            datatypeProperties: {},
          };

          const wizardConfig: WizardConfiguration = {
            steps: [
              {
                name: stepName,
                description: stepDescription,
                fields: ['test_field'],
                order: 0,
              },
            ],
          };

          const objectDef: ObjectDefinition = {
            shortName: 'test_object',
            displayName: 'Test Object',
            description: 'Test',
            fields: [
              {
                fieldShortName: 'test_field',
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

          // Verify step name is displayed
          const stepNameElement = Array.from(container.querySelectorAll('h6')).find((el) =>
            el.textContent === stepName
          );
          expect(stepNameElement).toBeTruthy();

          // Verify step description is displayed
          const textElements = container.querySelectorAll('.MuiTypography-body2');
          const descriptionElement = Array.from(textElements).find((el) =>
            el.textContent === stepDescription
          );
          expect(descriptionElement).toBeTruthy();
        }
      ),
      { numRuns: 20 }
    );
  });
});
