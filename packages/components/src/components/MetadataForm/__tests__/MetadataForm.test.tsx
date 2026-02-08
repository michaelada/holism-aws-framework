/**
 * Unit Tests for MetadataForm Component
 * Validates: Requirements 22.2
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor, fireEvent, screen } from '@testing-library/react';
import { MetadataForm } from '../MetadataForm';
import { FieldDatatype, type ObjectDefinition, type FieldDefinition } from '../../../types';
import * as metadataHooks from '../../../hooks/useMetadata';
import * as instanceHooks from '../../../hooks/useObjectInstances';

// Mock the hooks
vi.mock('../../../hooks/useMetadata');
vi.mock('../../../hooks/useObjectInstances');

describe('MetadataForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Form rendering', () => {
    it('should render form with all fields from object definition', async () => {
      const fields: FieldDefinition[] = [
        {
          shortName: 'name',
          displayName: 'Name',
          description: 'User name',
          datatype: FieldDatatype.TEXT,
          mandatory: false,
          datatypeProperties: {},
          validationRules: [],
        },
        {
          shortName: 'email',
          displayName: 'Email',
          description: 'User email',
          datatype: FieldDatatype.EMAIL,
          mandatory: false,
          datatypeProperties: {},
          validationRules: [],
        },
      ];

      const objectDef: ObjectDefinition = {
        shortName: 'user',
        displayName: 'User',
        description: 'User object',
        fields: [
          { fieldShortName: 'name', mandatory: true, order: 0 },
          { fieldShortName: 'email', mandatory: true, order: 1 },
        ],
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
          objectType="user"
          onSubmit={vi.fn()}
          onCancel={vi.fn()}
        />
      );

      await waitFor(() => {
        expect(container.querySelector('form')).toBeTruthy();
      });

      // Check that both fields are rendered
      expect(container.textContent).toContain('Name');
      expect(container.textContent).toContain('Email');
    });

    it('should render form with field groups', async () => {
      const fields: FieldDefinition[] = [
        {
          shortName: 'first_name',
          displayName: 'First Name',
          description: 'First name',
          datatype: FieldDatatype.TEXT,
          mandatory: false,
          datatypeProperties: {},
          validationRules: [],
        },
        {
          shortName: 'last_name',
          displayName: 'Last Name',
          description: 'Last name',
          datatype: FieldDatatype.TEXT,
          mandatory: false,
          datatypeProperties: {},
          validationRules: [],
        },
        {
          shortName: 'email',
          displayName: 'Email',
          description: 'Email address',
          datatype: FieldDatatype.EMAIL,
          mandatory: false,
          datatypeProperties: {},
          validationRules: [],
        },
      ];

      const objectDef: ObjectDefinition = {
        shortName: 'user',
        displayName: 'User',
        description: 'User object',
        fields: [
          { fieldShortName: 'first_name', mandatory: true, order: 0 },
          { fieldShortName: 'last_name', mandatory: true, order: 1 },
          { fieldShortName: 'email', mandatory: true, order: 2 },
        ],
        displayProperties: {},
        fieldGroups: [
          {
            name: 'Personal Information',
            description: 'Basic personal details',
            fields: ['first_name', 'last_name'],
            order: 0,
          },
          {
            name: 'Contact Information',
            description: 'Contact details',
            fields: ['email'],
            order: 1,
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
          objectType="user"
          onSubmit={vi.fn()}
          onCancel={vi.fn()}
        />
      );

      await waitFor(() => {
        expect(container.querySelector('form')).toBeTruthy();
      });

      // Check that group names are rendered
      expect(container.textContent).toContain('Personal Information');
      expect(container.textContent).toContain('Contact Information');
    });
  });

  describe('Form submission', () => {
    it('should call onSubmit with form data when valid', async () => {
      const field: FieldDefinition = {
        shortName: 'name',
        displayName: 'Name',
        description: 'User name',
        datatype: FieldDatatype.TEXT,
        mandatory: false,
        datatypeProperties: {},
        validationRules: [],
      };

      const objectDef: ObjectDefinition = {
        shortName: 'user',
        displayName: 'User',
        description: 'User object',
        fields: [{ fieldShortName: 'name', mandatory: true, order: 0 }],
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
          objectType="user"
          onSubmit={mockOnSubmit}
          onCancel={vi.fn()}
          initialValues={{ name: 'John Doe' }}
        />
      );

      await waitFor(() => {
        expect(container.querySelector('form')).toBeTruthy();
      });

      const submitButton = container.querySelector('button[type="submit"]');
      expect(submitButton).toBeTruthy();

      if (submitButton) {
        fireEvent.click(submitButton);

        await waitFor(() => {
          expect(mockOnSubmit).toHaveBeenCalledWith({ name: 'John Doe' });
        });
      }
    });

    it('should not call onSubmit when validation fails', async () => {
      const field: FieldDefinition = {
        shortName: 'name',
        displayName: 'Name',
        description: 'User name',
        datatype: FieldDatatype.TEXT,
        mandatory: false,
        datatypeProperties: {},
        validationRules: [],
      };

      const objectDef: ObjectDefinition = {
        shortName: 'user',
        displayName: 'User',
        description: 'User object',
        fields: [{ fieldShortName: 'name', mandatory: true, order: 0 }],
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
          objectType="user"
          onSubmit={mockOnSubmit}
          onCancel={vi.fn()}
        />
      );

      await waitFor(() => {
        expect(container.querySelector('form')).toBeTruthy();
      });

      const submitButton = container.querySelector('button[type="submit"]');
      if (submitButton) {
        fireEvent.click(submitButton);

        // Wait a bit
        await new Promise(resolve => setTimeout(resolve, 100));

        // onSubmit should not have been called
        expect(mockOnSubmit).not.toHaveBeenCalled();
      }
    });
  });

  describe('Validation error handling', () => {
    it('should display validation errors', async () => {
      const field: FieldDefinition = {
        shortName: 'email',
        displayName: 'Email',
        description: 'Email address',
        datatype: FieldDatatype.EMAIL,
        mandatory: false,
        datatypeProperties: {},
        validationRules: [
          {
            type: 'email' as any,
            message: 'Must be a valid email',
          },
        ],
      };

      const objectDef: ObjectDefinition = {
        shortName: 'user',
        displayName: 'User',
        description: 'User object',
        fields: [{ fieldShortName: 'email', mandatory: true, order: 0 }],
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
          objectType="user"
          onSubmit={vi.fn()}
          onCancel={vi.fn()}
          initialValues={{ email: 'invalid-email' }}
        />
      );

      await waitFor(() => {
        expect(container.querySelector('form')).toBeTruthy();
      });

      const submitButton = container.querySelector('button[type="submit"]');
      if (submitButton) {
        fireEvent.click(submitButton);

        await waitFor(() => {
          // Check for error indication
          const hasError = container.textContent?.includes('email') ||
                          container.querySelector('[aria-invalid="true"]');
          expect(hasError).toBeTruthy();
        }, { timeout: 1000 });
      }
    });
  });

  describe('Cancel button', () => {
    it('should call onCancel when cancel button is clicked', async () => {
      const field: FieldDefinition = {
        shortName: 'name',
        displayName: 'Name',
        description: 'User name',
        datatype: FieldDatatype.TEXT,
        mandatory: false,
        datatypeProperties: {},
        validationRules: [],
      };

      const objectDef: ObjectDefinition = {
        shortName: 'user',
        displayName: 'User',
        description: 'User object',
        fields: [{ fieldShortName: 'name', mandatory: false, order: 0 }],
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

      const mockOnCancel = vi.fn();

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
          objectType="user"
          onSubmit={vi.fn()}
          onCancel={mockOnCancel}
        />
      );

      await waitFor(() => {
        expect(container.querySelector('form')).toBeTruthy();
      });

      // Find cancel button (not submit button)
      const buttons = container.querySelectorAll('button');
      const cancelButton = Array.from(buttons).find(btn => btn.textContent === 'Cancel');
      
      expect(cancelButton).toBeTruthy();
      
      if (cancelButton) {
        fireEvent.click(cancelButton);
        expect(mockOnCancel).toHaveBeenCalled();
      }
    });
  });
});
