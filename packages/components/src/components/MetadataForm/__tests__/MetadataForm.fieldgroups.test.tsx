/**
 * Unit Tests for MetadataForm Component - Field Grouping
 * Validates: Requirements 22.2
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { MetadataForm } from '../MetadataForm';
import { FieldDatatype, type ObjectDefinition, type FieldDefinition } from '../../../types';
import * as metadataHooks from '../../../hooks/useMetadata';
import * as instanceHooks from '../../../hooks/useObjectInstances';

// Mock the hooks
vi.mock('../../../hooks/useMetadata');
vi.mock('../../../hooks/useObjectInstances');

describe('MetadataForm - Field Grouping', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render with field groups', async () => {
    const fields: FieldDefinition[] = [
      {
        shortName: 'first_name',
        displayName: 'First Name',
        description: 'First name',
        datatype: FieldDatatype.TEXT,
        datatypeProperties: {},
        validationRules: [],
      },
      {
        shortName: 'last_name',
        displayName: 'Last Name',
        description: 'Last name',
        datatype: FieldDatatype.TEXT,
        datatypeProperties: {},
        validationRules: [],
      },
    ];

    const objectDef: ObjectDefinition = {
      shortName: 'user',
      displayName: 'User',
      description: 'User object',
      fields: [
        { fieldShortName: 'first_name', mandatory: false, order: 0 },
        { fieldShortName: 'last_name', mandatory: false, order: 1 },
      ],
      displayProperties: {},
      fieldGroups: [
        {
          name: 'Personal Info',
          description: 'Personal information',
          fields: ['first_name', 'last_name'],
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
        objectType="user"
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(container.querySelector('form')).toBeTruthy();
    });

    // Check that group is rendered
    expect(container.textContent).toContain('Personal Info');
    expect(container.textContent).toContain('Personal information');
    expect(container.textContent).toContain('First Name');
    expect(container.textContent).toContain('Last Name');
  });

  it('should render without field groups', async () => {
    const fields: FieldDefinition[] = [
      {
        shortName: 'name',
        displayName: 'Name',
        description: 'User name',
        datatype: FieldDatatype.TEXT,
        datatypeProperties: {},
        validationRules: [],
      },
    ];

    const objectDef: ObjectDefinition = {
      shortName: 'user',
      displayName: 'User',
      description: 'User object',
      fields: [{ fieldShortName: 'name', mandatory: false, order: 0 }],
      displayProperties: {},
      fieldGroups: [], // No groups
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

    // Field should be rendered without groups
    expect(container.textContent).toContain('Name');
  });

  it('should render mixed grouped and ungrouped fields', async () => {
    const fields: FieldDefinition[] = [
      {
        shortName: 'name',
        displayName: 'Name',
        description: 'User name',
        datatype: FieldDatatype.TEXT,
        datatypeProperties: {},
        validationRules: [],
      },
      {
        shortName: 'email',
        displayName: 'Email',
        description: 'User email',
        datatype: FieldDatatype.EMAIL,
        datatypeProperties: {},
        validationRules: [],
      },
      {
        shortName: 'notes',
        displayName: 'Notes',
        description: 'Additional notes',
        datatype: FieldDatatype.TEXT_AREA,
        datatypeProperties: {},
        validationRules: [],
      },
    ];

    const objectDef: ObjectDefinition = {
      shortName: 'user',
      displayName: 'User',
      description: 'User object',
      fields: [
        { fieldShortName: 'name', mandatory: false, order: 0 },
        { fieldShortName: 'email', mandatory: false, order: 1 },
        { fieldShortName: 'notes', mandatory: false, order: 2 },
      ],
      displayProperties: {},
      fieldGroups: [
        {
          name: 'Basic Info',
          description: 'Basic information',
          fields: ['name', 'email'], // Only name and email are grouped
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
        objectType="user"
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(container.querySelector('form')).toBeTruthy();
    });

    // Grouped fields should be in the group
    expect(container.textContent).toContain('Basic Info');
    expect(container.textContent).toContain('Name');
    expect(container.textContent).toContain('Email');

    // Ungrouped field should be in additional section
    expect(container.textContent).toContain('Notes');
    expect(container.textContent).toContain('Additional Information');
  });
});
