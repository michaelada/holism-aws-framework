/**
 * Property-Based Tests for MetadataWizard Configuration Support
 * Feature: aws-web-app-framework, Property 29: Wizard Configuration Support
 * Validates: Requirements 24.10
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import * as fc from 'fast-check';
import { MetadataWizard } from '../MetadataWizard';
import type { ObjectDefinition, FieldDefinition, WizardConfiguration } from '../../../types';
import { FieldDatatype } from '../../../types';
import * as metadataHook from '../../../hooks/useMetadata';

describe('Property 29: Wizard Configuration Support', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('should render MetadataWizard when object has wizard configuration', () => {
    fc.assert(
      fc.property(
        fc.record({
          shortName: fc.stringOf(fc.char(), { minLength: 1, maxLength: 20 }),
          displayName: fc.string({ minLength: 1, maxLength: 50 }),
          description: fc.string({ maxLength: 200 }),
          stepCount: fc.integer({ min: 1, max: 5 }),
        }),
        ({ shortName, displayName, description, stepCount }) => {
          // Clean up before each property test run
          cleanup();
          vi.clearAllMocks();

          // Generate wizard configuration
          const wizardConfig: WizardConfiguration = {
            steps: Array.from({ length: stepCount }, (_, i) => ({
              name: `Step ${i + 1}`,
              description: `Description for step ${i + 1}`,
              fields: [`field_${i}`],
              order: i,
            })),
          };

          // Generate fields for each step
          const fields: FieldDefinition[] = Array.from({ length: stepCount }, (_, i) => ({
            shortName: `field_${i}`,
            displayName: `Field ${i + 1}`,
            description: `Field description ${i + 1}`,
            datatype: FieldDatatype.TEXT,
            datatypeProperties: {},
          }));

          const objectDef: ObjectDefinition = {
            shortName,
            displayName,
            description,
            fields: fields.map((f, i) => ({
              fieldShortName: f.shortName,
              order: i,
            })),
            displayProperties: {},
            wizardConfig,
          };

          // Mock useMetadata hook
          vi.spyOn(metadataHook, 'useMetadata').mockReturnValue({
            objectDef,
            fields,
            loading: false,
            error: null,
            refetch: vi.fn(),
          });

          const onComplete = vi.fn();
          const onCancel = vi.fn();

          const { container } = render(
            <MetadataWizard
              objectType={shortName}
              onComplete={onComplete}
              onCancel={onCancel}
            />
          );

          // Verify wizard is rendered (should have stepper)
          const stepper = container.querySelector('.MuiStepper-root');
          expect(stepper).toBeTruthy();

          // Verify first step label is in the stepper
          const stepLabels = container.querySelectorAll('.MuiStepLabel-label');
          expect(stepLabels.length).toBeGreaterThan(0);
          expect(stepLabels[0].textContent).toBe('Step 1');
        }
      ),
      { numRuns: 20 }
    );
  });

  it('should show error when object does not have wizard configuration', () => {
    fc.assert(
      fc.property(
        fc.record({
          shortName: fc.stringOf(fc.char(), { minLength: 1, maxLength: 20 }),
          displayName: fc.string({ minLength: 1, maxLength: 50 }),
        }),
        ({ shortName, displayName }) => {
          // Clean up before each property test run
          cleanup();
          vi.clearAllMocks();

          const objectDef: ObjectDefinition = {
            shortName,
            displayName,
            description: 'Test object',
            fields: [],
            displayProperties: {},
            // No wizardConfig
          };

          vi.spyOn(metadataHook, 'useMetadata').mockReturnValue({
            objectDef,
            fields: [],
            loading: false,
            error: null,
            refetch: vi.fn(),
          });

          const onComplete = vi.fn();
          const onCancel = vi.fn();

          const { container } = render(
            <MetadataWizard
              objectType={shortName}
              onComplete={onComplete}
              onCancel={onCancel}
            />
          );

          // Should show error message
          const errorMessage = container.querySelector('.MuiAlert-message');
          expect(errorMessage).toBeTruthy();
          expect(errorMessage?.textContent).toMatch(/does not have wizard configuration/i);
        }
      ),
      { numRuns: 20 }
    );
  });
});
