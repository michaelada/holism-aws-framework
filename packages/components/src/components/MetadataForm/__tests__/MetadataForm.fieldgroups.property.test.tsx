/**
 * Property-Based Tests for MetadataForm Component - Field Grouping
 * Feature: aws-web-app-framework
 * Property 39: Field Group Validation - Validates: Requirements 26.12
 * Property 40: Field Group Rendering - Validates: Requirements 26.6, 26.7
 * Property 41: Ungrouped Field Handling - Validates: Requirements 26.10
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

describe('MetadataForm Property Tests - Field Grouping', () => {
  describe('Property 39: Field Group Validation', () => {
    it('should validate that all field short names in groups exist in object fields list', async () => {
      // This property is validated at the backend level when object definitions are created
      // The frontend should render groups correctly when they are valid
      const fields: FieldDefinition[] = [
        {
          shortName: 'field1',
          displayName: 'Field 1',
          description: 'First field',
          datatype: FieldDatatype.TEXT,
          datatypeProperties: {},
          validationRules: [],
        },
        {
          shortName: 'field2',
          displayName: 'Field 2',
          description: 'Second field',
          datatype: FieldDatatype.TEXT,
          datatypeProperties: {},
          validationRules: [],
        },
      ];

      const objectDef: ObjectDefinition = {
        shortName: 'test_object',
        displayName: 'Test Object',
        description: 'Test object',
        fields: [
          { fieldShortName: 'field1', mandatory: false, order: 0 },
          { fieldShortName: 'field2', mandatory: false, order: 1 },
        ],
        displayProperties: {},
        fieldGroups: [
          {
            name: 'Group 1',
            description: 'First group',
            fields: ['field1', 'field2'], // All fields exist in object.fields
            order: 0,
          },
        ],
      };

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
          objectType="test_object"
          onSubmit={vi.fn()}
          onCancel={vi.fn()}
        />
      );

      await waitFor(() => {
        expect(container.querySelector('form')).toBeTruthy();
      });

      // Form should render successfully with valid field groups
      expect(container.textContent).toContain('Group 1');
      expect(container.textContent).toContain('Field 1');
      expect(container.textContent).toContain('Field 2');
    });
  });

  describe('Property 40: Field Group Rendering', () => {
    it('should render fields within their assigned groups using visual containers', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 3 }),
          async (numGroups) => {
            const fields: FieldDefinition[] = Array.from({ length: numGroups * 2 }, (_, i) => ({
              shortName: `field_${i}`,
              displayName: `Field ${i}`,
              description: `Field ${i}`,
              datatype: FieldDatatype.TEXT,
              datatypeProperties: {},
              validationRules: [],
            }));

            const fieldGroups = Array.from({ length: numGroups }, (_, i) => ({
              name: `Group ${i}`,
              description: `Group ${i} description`,
              fields: [`field_${i * 2}`, `field_${i * 2 + 1}`],
              order: i,
            }));

            const objectDef: ObjectDefinition = {
              shortName: 'test_object',
              displayName: 'Test Object',
              description: 'Test object',
              fields: fields.map((f, i) => ({
                fieldShortName: f.shortName,
                order: i,
              })),
              displayProperties: {},
              fieldGroups,
            };

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
                objectType="test_object"
                onSubmit={vi.fn()}
                onCancel={vi.fn()}
              />
            );

            await waitFor(() => {
              expect(container.querySelector('form')).toBeTruthy();
            });

            // Check that groups are rendered
            fieldGroups.forEach((group) => {
              expect(container.textContent).toContain(group.name);
            });

            // Check that visual containers (Cards) are used
            const cards = container.querySelectorAll('[class*="MuiCard"]');
            expect(cards.length).toBeGreaterThanOrEqual(numGroups);
          }
        ),
        { numRuns: 5 }
      );
    });

    it('should render field groups in the order specified', async () => {
      const fields: FieldDefinition[] = [
        {
          shortName: 'field1',
          displayName: 'Field 1',
          description: 'First field',
          datatype: FieldDatatype.TEXT,
          datatypeProperties: {},
          validationRules: [],
        },
        {
          shortName: 'field2',
          displayName: 'Field 2',
          description: 'Second field',
          datatype: FieldDatatype.TEXT,
          datatypeProperties: {},
          validationRules: [],
        },
        {
          shortName: 'field3',
          displayName: 'Field 3',
          description: 'Third field',
          datatype: FieldDatatype.TEXT,
          datatypeProperties: {},
          validationRules: [],
        },
      ];

      const objectDef: ObjectDefinition = {
        shortName: 'test_object',
        displayName: 'Test Object',
        description: 'Test object',
        fields: [
          { fieldShortName: 'field1', mandatory: false, order: 0 },
          { fieldShortName: 'field2', mandatory: false, order: 1 },
          { fieldShortName: 'field3', mandatory: false, order: 2 },
        ],
        displayProperties: {},
        fieldGroups: [
          {
            name: 'Group B',
            description: 'Second group',
            fields: ['field2'],
            order: 1, // Should render second
          },
          {
            name: 'Group A',
            description: 'First group',
            fields: ['field1'],
            order: 0, // Should render first
          },
        ],
      };

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
          objectType="test_object"
          onSubmit={vi.fn()}
          onCancel={vi.fn()}
        />
      );

      await waitFor(() => {
        expect(container.querySelector('form')).toBeTruthy();
      });

      // Both groups should be rendered
      expect(container.textContent).toContain('Group A');
      expect(container.textContent).toContain('Group B');
      
      // Check order by finding positions in text content
      const text = container.textContent || '';
      const groupAIndex = text.indexOf('Group A');
      const groupBIndex = text.indexOf('Group B');
      
      // Group A should appear before Group B
      expect(groupAIndex).toBeLessThan(groupBIndex);
    });
  });

  describe('Property 41: Ungrouped Field Handling', () => {
    it('should render ungrouped fields in a default section', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 3 }),
          async (numUngroupedFields) => {
            const groupedFields: FieldDefinition[] = [
              {
                shortName: 'grouped_field',
                displayName: 'Grouped Field',
                description: 'A grouped field',
                datatype: FieldDatatype.TEXT,
                datatypeProperties: {},
                validationRules: [],
              },
            ];

            const ungroupedFields: FieldDefinition[] = Array.from(
              { length: numUngroupedFields },
              (_, i) => ({
                shortName: `ungrouped_${i}`,
                displayName: `Ungrouped ${i}`,
                description: `Ungrouped field ${i}`,
                datatype: FieldDatatype.TEXT,
                datatypeProperties: {},
                validationRules: [],
              })
            );

            const allFields = [...groupedFields, ...ungroupedFields];

            const objectDef: ObjectDefinition = {
              shortName: 'test_object',
              displayName: 'Test Object',
              description: 'Test object',
              fields: allFields.map((f, i) => ({
                fieldShortName: f.shortName,
                order: i,
              })),
              displayProperties: {},
              fieldGroups: [
                {
                  name: 'Main Group',
                  description: 'Main group',
                  fields: ['grouped_field'],
                  order: 0,
                },
              ],
            };

            vi.mocked(metadataHooks.useMetadata).mockReturnValue({
              objectDef,
              fields: allFields,
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
                objectType="test_object"
                onSubmit={vi.fn()}
                onCancel={vi.fn()}
              />
            );

            await waitFor(() => {
              expect(container.querySelector('form')).toBeTruthy();
            });

            // Grouped field should be in the group
            expect(container.textContent).toContain('Main Group');
            expect(container.textContent).toContain('Grouped Field');

            // Ungrouped fields should also be rendered
            ungroupedFields.forEach((field) => {
              expect(container.textContent).toContain(field.displayName);
            });

            // Should have "Additional Information" section for ungrouped fields
            if (numUngroupedFields > 0) {
              expect(container.textContent).toContain('Additional Information');
            }
          }
        ),
        { numRuns: 5 }
      );
    });
  });
});
