/**
 * Unit Tests for MetadataReadOnlyView Component
 * Validates: Requirements 22.2, 26.9
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { MetadataReadOnlyView } from '../MetadataReadOnlyView';
import { FieldDatatype, type ObjectDefinition, type FieldDefinition } from '../../../types';
import * as metadataHooks from '../../../hooks/useMetadata';

// Mock the hooks
vi.mock('../../../hooks/useMetadata');

describe('MetadataReadOnlyView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render read-only view with field groups', async () => {
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
      {
        shortName: 'email',
        displayName: 'Email',
        description: 'Email address',
        datatype: FieldDatatype.EMAIL,
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
        { fieldShortName: 'email', mandatory: false, order: 2 },
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

    const data = {
      first_name: 'John',
      last_name: 'Doe',
      email: 'john.doe@example.com',
    };

    const { container } = render(
      <MetadataReadOnlyView
        objectType="user"
        data={data}
      />
    );

    await waitFor(() => {
      expect(container.textContent).toContain('User');
    });

    // Check that groups are rendered
    expect(container.textContent).toContain('Personal Information');
    expect(container.textContent).toContain('Contact Information');

    // Check that field values are displayed
    expect(container.textContent).toContain('John');
    expect(container.textContent).toContain('Doe');
    expect(container.textContent).toContain('john.doe@example.com');
  });

  it('should render read-only view without field groups', async () => {
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
      fieldGroups: [],
    };

    vi.mocked(metadataHooks.useMetadata).mockReturnValue({
      objectDef,
      fields,
      loading: false,
      error: null,
      refetch: vi.fn(),
    });

    const data = {
      name: 'John Doe',
    };

    const { container } = render(
      <MetadataReadOnlyView
        objectType="user"
        data={data}
      />
    );

    await waitFor(() => {
      expect(container.textContent).toContain('User');
    });

    // Check that field value is displayed
    expect(container.textContent).toContain('John Doe');
  });

  it('should render mixed grouped and ungrouped fields in read-only mode', async () => {
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
          fields: ['name', 'email'],
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

    const data = {
      name: 'John Doe',
      email: 'john@example.com',
      notes: 'Some notes',
    };

    const { container } = render(
      <MetadataReadOnlyView
        objectType="user"
        data={data}
      />
    );

    await waitFor(() => {
      expect(container.textContent).toContain('User');
    });

    // Grouped fields should be in the group
    expect(container.textContent).toContain('Basic Info');
    expect(container.textContent).toContain('John Doe');
    expect(container.textContent).toContain('john@example.com');

    // Ungrouped field should be in additional section
    expect(container.textContent).toContain('Some notes');
    expect(container.textContent).toContain('Additional Information');
  });

  it('should handle missing field values', async () => {
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
      fieldGroups: [],
    };

    vi.mocked(metadataHooks.useMetadata).mockReturnValue({
      objectDef,
      fields,
      loading: false,
      error: null,
      refetch: vi.fn(),
    });

    const data = {}; // No data

    const { container } = render(
      <MetadataReadOnlyView
        objectType="user"
        data={data}
      />
    );

    await waitFor(() => {
      expect(container.textContent).toContain('User');
    });

    // Should show placeholder for missing value
    expect(container.textContent).toContain('—');
  });
});
