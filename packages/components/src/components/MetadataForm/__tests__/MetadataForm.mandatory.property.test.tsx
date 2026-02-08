/**
 * Property-Based Tests for MetadataForm Component - Mandatory Field Indication
 * Feature: aws-web-app-framework, Property 19: Mandatory Field Indication
 * Validates: Requirements 14.5
 */

import { describe, it, expect, vi } from 'vitest';
import * as fc from 'fast-check';
import { render, waitFor } from '@testing-library/react';
import { MetadataForm } from '../MetadataForm';
import { FieldDatatype, type ObjectDefinition, type FieldDefinition } from '../../../types';
import * as metadataHooks from '../../../hooks/useMetadata';
import * as instanceHooks from '../../../hooks/useObjectInstances';

// Mock the hooks
vi.mock('../../../hooks/useMetadata');
vi.mock('../../../hooks/useObjectInstances');

// Arbitraries for generating test data
const fieldDefinitionArbitrary = fc
  .record({
    shortName: fc.stringOf(fc.char(), { minLength: 3, maxLength: 20 })
      .filter(s => s.trim().length >= 3 && /^[a-zA-Z][a-zA-Z0-9_]*$/.test(s)),
    displayName: fc.string({ minLength: 3, maxLength: 50 })
      .filter(s => s.trim().length >= 3),
    description: fc.string({ maxLength: 100 }),
    datatype: fc.constantFrom(
      FieldDatatype.TEXT,
      FieldDatatype.NUMBER,
      FieldDatatype.EMAIL
    ),
    mandatory: fc.boolean(),
  })
  .map((base): FieldDefinition => ({
    ...base,
    datatypeProperties: {},
    validationRules: [],
  }));

const objectDefinitionArbitrary = fc
  .tuple(
    fc.stringOf(fc.char(), { minLength: 3, maxLength: 20 })
      .filter(s => s.trim().length >= 3 && /^[a-zA-Z][a-zA-Z0-9_]*$/.test(s)),
    fc.string({ minLength: 3, maxLength: 50 }).filter(s => s.trim().length >= 3),
    fc.array(fieldDefinitionArbitrary, { minLength: 1, maxLength: 5 })
  )
  .chain(([shortName, displayName, fields]) => {
    return fc.record({
      shortName: fc.constant(shortName),
      displayName: fc.constant(displayName),
      description: fc.string({ maxLength: 100 }),
      fields: fc.constant(
        fields.map((field, index) => ({
          fieldShortName: field.shortName,
          mandatory: fc.sample(fc.boolean(), 1)[0],
          order: index,
        }))
      ),
      displayProperties: fc.constant({}),
    }).map((objDef): ObjectDefinition => ({
      ...objDef,
      fieldGroups: [],
    }));
  });

describe('MetadataForm Property Tests - Mandatory Field Indication', () => {
  describe('Property 19: Mandatory Field Indication', () => {
    it('should visually mark all mandatory fields in the form', async () => {
      await fc.assert(
        fc.asyncProperty(
          objectDefinitionArbitrary,
          async (objectDef) => {
            // Generate matching field definitions
            const fields: FieldDefinition[] = objectDef.fields.map((fieldRef) => ({
              shortName: fieldRef.fieldShortName,
              displayName: `Field ${fieldRef.fieldShortName}`,
              description: 'Test field',
              datatype: FieldDatatype.TEXT,
              mandatory: false, // Will be overridden by object definition
              datatypeProperties: {},
              validationRules: [],
            }));

            // Mock the hooks
            vi.mocked(metadataHooks.useMetadata).mockReturnValue({
              objectDef,
              fields,
              loading: false,
              error: null,
              refetch: vi.fn(),
            });

            vi.mocked(instanceHooks.useObjectInstances).mockReturnValue({
              instances: [],
              pagination: null,
              loading: false,
              error: null,
              fetchInstances: vi.fn(),
              createInstance: vi.fn(),
              updateInstance: vi.fn(),
              deleteInstance: vi.fn(),
              getInstance: vi.fn(),
            });

            const { container } = render(
              <MetadataForm
                objectType={objectDef.shortName}
                onSubmit={vi.fn()}
                onCancel={vi.fn()}
              />
            );

            // Wait for form to render
            await waitFor(() => {
              expect(container.querySelector('form')).toBeTruthy();
            });

            // Check each field for mandatory indication
            objectDef.fields.forEach((fieldRef) => {
              if (fieldRef.mandatory) {
                const field = fields.find(f => f.shortName === fieldRef.fieldShortName);
                if (field) {
                  // Check if field display name is present
                  const hasFieldLabel = container.textContent?.includes(field.displayName);
                  expect(hasFieldLabel).toBeTruthy();

                  // Check for visual indicators of mandatory fields
                  // MUI typically uses asterisk (*) or required attribute
                  const hasRequiredAttr = container.querySelector(`[name="${field.shortName}"][required]`);
                  const hasAsterisk = container.textContent?.includes('*');
                  
                  // At least one indicator should be present for mandatory fields
                  expect(hasRequiredAttr || hasAsterisk).toBeTruthy();
                }
              }
            });
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should mark fields as mandatory based on object definition override', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.tuple(
            fc.stringOf(fc.char(), { minLength: 3, maxLength: 20 })
              .filter(s => /^[a-zA-Z][a-zA-Z0-9_]*$/.test(s)),
            fc.boolean(),
            fc.boolean()
          ),
          async ([fieldShortName, fieldMandatory, objectMandatory]) => {
            const field: FieldDefinition = {
              shortName: fieldShortName,
              displayName: `Test Field ${fieldShortName}`,
              description: 'Test field',
              datatype: FieldDatatype.TEXT,
              mandatory: fieldMandatory,
              datatypeProperties: {},
              validationRules: [],
            };

            const objectDef: ObjectDefinition = {
              shortName: 'test_object',
              displayName: 'Test Object',
              description: 'Test object',
              fields: [
                {
                  fieldShortName: field.shortName,
                  mandatory: objectMandatory, // Override field's mandatory setting
                  order: 0,
                },
              ],
              displayProperties: {},
              fieldGroups: [],
            };

            vi.mocked(metadataHooks.useMetadata).mockReturnValue({
              objectDef,
              fields: [field],
              loading: false,
              error: null,
              refetch: vi.fn(),
            });

            vi.mocked(instanceHooks.useObjectInstances).mockReturnValue({
              instances: [],
              pagination: null,
              loading: false,
              error: null,
              fetchInstances: vi.fn(),
              createInstance: vi.fn(),
              updateInstance: vi.fn(),
              deleteInstance: vi.fn(),
              getInstance: vi.fn(),
            });

            const { container } = render(
              <MetadataForm
                objectType={objectDef.shortName}
                onSubmit={vi.fn()}
                onCancel={vi.fn()}
              />
            );

            await waitFor(() => {
              expect(container.querySelector('form')).toBeTruthy();
            });

            // The mandatory status should be determined by objectDef.fields[].mandatory
            // not by field.mandatory
            if (objectMandatory) {
              const hasRequiredAttr = container.querySelector('[required]');
              const hasAsterisk = container.textContent?.includes('*');
              expect(hasRequiredAttr || hasAsterisk).toBeTruthy();
            }
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should consistently mark mandatory fields across different datatypes', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(
            FieldDatatype.TEXT,
            FieldDatatype.NUMBER,
            FieldDatatype.EMAIL,
            FieldDatatype.DATE
          ),
          async (datatype) => {
            const field: FieldDefinition = {
              shortName: 'test_field',
              displayName: 'Test Field',
              description: 'Test field',
              datatype,
              mandatory: false,
              datatypeProperties: {},
              validationRules: [],
            };

            const objectDef: ObjectDefinition = {
              shortName: 'test_object',
              displayName: 'Test Object',
              description: 'Test object',
              fields: [
                {
                  fieldShortName: field.shortName,
                  mandatory: true, // Always mandatory for this test
                  order: 0,
                },
              ],
              displayProperties: {},
              fieldGroups: [],
            };

            vi.mocked(metadataHooks.useMetadata).mockReturnValue({
              objectDef,
              fields: [field],
              loading: false,
              error: null,
              refetch: vi.fn(),
            });

            vi.mocked(instanceHooks.useObjectInstances).mockReturnValue({
              instances: [],
              pagination: null,
              loading: false,
              error: null,
              fetchInstances: vi.fn(),
              createInstance: vi.fn(),
              updateInstance: vi.fn(),
              deleteInstance: vi.fn(),
              getInstance: vi.fn(),
            });

            const { container } = render(
              <MetadataForm
                objectType={objectDef.shortName}
                onSubmit={vi.fn()}
                onCancel={vi.fn()}
              />
            );

            await waitFor(() => {
              expect(container.querySelector('form')).toBeTruthy();
            });

            // All mandatory fields should have visual indication regardless of datatype
            const hasRequiredAttr = container.querySelector('[required]');
            const hasAsterisk = container.textContent?.includes('*');
            expect(hasRequiredAttr || hasAsterisk).toBeTruthy();
          }
        ),
        { numRuns: 20 }
      );
    });
  });
});
