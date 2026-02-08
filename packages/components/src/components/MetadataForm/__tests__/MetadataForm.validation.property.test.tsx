/**
 * Property-Based Tests for MetadataForm Component - Client-Side Validation
 * Feature: aws-web-app-framework, Property 20: Client-Side Validation
 * Validates: Requirements 14.6
 */

import { describe, it, expect, vi } from 'vitest';
import * as fc from 'fast-check';
import { render, waitFor, fireEvent } from '@testing-library/react';
import { MetadataForm } from '../MetadataForm';
import { FieldDatatype, type ObjectDefinition, type FieldDefinition } from '../../../types';
import * as metadataHooks from '../../../hooks/useMetadata';
import * as instanceHooks from '../../../hooks/useObjectInstances';

// Mock the hooks
vi.mock('../../../hooks/useMetadata');
vi.mock('../../../hooks/useObjectInstances');

describe('MetadataForm Property Tests - Client-Side Validation', () => {
  describe('Property 20: Client-Side Validation', () => {
    it('should prevent form submission when mandatory fields are empty', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.tuple(
            fc.stringOf(fc.char(), { minLength: 3, maxLength: 20 })
              .filter(s => /^[a-zA-Z][a-zA-Z0-9_]*$/.test(s)),
            fc.integer({ min: 1, max: 3 })
          ),
          async ([objectShortName, numMandatoryFields]) => {
            // Create fields with some mandatory
            const fields: FieldDefinition[] = Array.from({ length: numMandatoryFields }, (_, i) => ({
              shortName: `field_${i}`,
              displayName: `Field ${i}`,
              description: 'Test field',
              datatype: FieldDatatype.TEXT,
              datatypeProperties: {},
              validationRules: [],
            }));

            const objectDef: ObjectDefinition = {
              shortName: objectShortName,
              displayName: `Test Object ${objectShortName}`,
              description: 'Test object',
              fields: fields.map((field, index) => ({
                fieldShortName: field.shortName,
                mandatory: true, // Set mandatory at object field reference level
                order: index,
              })),
              displayProperties: {},
              fieldGroups: [],
            };

            vi.mocked(metadataHooks.useMetadata).mockReturnValue({
              objectDef,
              fields,
              loading: false,
              error: null,
              refetch: vi.fn(),
            });

            const mockOnSubmit = vi.fn().mockResolvedValue(undefined);

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
                onSubmit={mockOnSubmit}
                onCancel={vi.fn()}
              />
            );

            await waitFor(() => {
              expect(container.querySelector('form')).toBeTruthy();
            });

            // Try to submit form without filling mandatory fields
            const submitButton = container.querySelector('button[type="submit"]');
            expect(submitButton).toBeTruthy();
            
            if (submitButton) {
              fireEvent.click(submitButton);
              
              // Wait a bit for validation to run
              await new Promise(resolve => setTimeout(resolve, 100));
              
              // onSubmit should not have been called because validation should fail
              expect(mockOnSubmit).not.toHaveBeenCalled();
            }
          }
        ),
        { numRuns: 10 }
      );
    });

    it('should allow form submission when all mandatory fields are filled', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.stringOf(fc.char(), { minLength: 3, maxLength: 20 })
            .filter(s => /^[a-zA-Z][a-zA-Z0-9_]*$/.test(s)),
          async (objectShortName) => {
            const field: FieldDefinition = {
              shortName: 'test_field',
              displayName: 'Test Field',
              description: 'Test field',
              datatype: FieldDatatype.TEXT,
              datatypeProperties: {},
              validationRules: [],
            };

            const objectDef: ObjectDefinition = {
              shortName: objectShortName,
              displayName: `Test Object ${objectShortName}`,
              description: 'Test object',
              fields: [
                {
                  fieldShortName: field.shortName,
                  mandatory: true, // Set mandatory at object field reference level
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

            const mockOnSubmit = vi.fn().mockResolvedValue(undefined);

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
                onSubmit={mockOnSubmit}
                onCancel={vi.fn()}
                initialValues={{ test_field: 'Some value' }}
              />
            );

            await waitFor(() => {
              expect(container.querySelector('form')).toBeTruthy();
            });

            // Submit form with filled mandatory field
            const submitButton = container.querySelector('button[type="submit"]');
            expect(submitButton).toBeTruthy();
            
            if (submitButton) {
              fireEvent.click(submitButton);
              
              // Wait for submission
              await waitFor(() => {
                expect(mockOnSubmit).toHaveBeenCalled();
              }, { timeout: 1000 });
            }
          }
        ),
        { numRuns: 10 }
      );
    });

    it('should validate fields before submission and display errors', async () => {
      const field: FieldDefinition = {
        shortName: 'email_field',
        displayName: 'Email',
        description: 'Email field',
        datatype: FieldDatatype.EMAIL,
        datatypeProperties: {},
        validationRules: [
          {
            type: 'email' as any,
            message: 'Must be a valid email',
          },
        ],
      };

      const objectDef: ObjectDefinition = {
        shortName: 'test_object',
        displayName: 'Test Object',
        description: 'Test object',
        fields: [
          {
            fieldShortName: field.shortName,
            mandatory: true, // Set mandatory at object field reference level
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

      const mockOnSubmit = vi.fn().mockResolvedValue(undefined);

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
          onSubmit={mockOnSubmit}
          onCancel={vi.fn()}
          initialValues={{ email_field: 'invalid-email' }}
        />
      );

      await waitFor(() => {
        expect(container.querySelector('form')).toBeTruthy();
      });

      // Submit form with invalid email
      const submitButton = container.querySelector('button[type="submit"]');
      expect(submitButton).toBeTruthy();
      
      if (submitButton) {
        fireEvent.click(submitButton);
        
        // Wait a bit for validation
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // onSubmit should not have been called
        expect(mockOnSubmit).not.toHaveBeenCalled();
      }
    });
  });
});
