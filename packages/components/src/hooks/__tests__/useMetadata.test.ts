import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useMetadata, useObjectDefinitions, useFieldDefinitions } from '../useMetadata';
import { ApiClient } from '../../api';
import type { ObjectDefinition, FieldDefinition } from '../../types';

describe('useMetadata', () => {
  let mockApiClient: ApiClient;

  beforeEach(() => {
    mockApiClient = {
      get: vi.fn(),
    } as any;
  });

  it('should fetch object definition and fields', async () => {
    const mockObjectDef: ObjectDefinition = {
      shortName: 'customer',
      displayName: 'Customer',
      description: 'Customer object',
      fields: [
        { fieldShortName: 'name', mandatory: true, order: 1 },
        { fieldShortName: 'email', mandatory: true, order: 2 },
      ],
      displayProperties: {},
    };

    const mockFields: FieldDefinition[] = [
      {
        shortName: 'name',
        displayName: 'Name',
        description: 'Customer name',
        datatype: 'text',
        datatypeProperties: {},
        mandatory: true,
      },
      {
        shortName: 'email',
        displayName: 'Email',
        description: 'Customer email',
        datatype: 'email',
        datatypeProperties: {},
        mandatory: true,
      },
    ];

    vi.mocked(mockApiClient.get)
      .mockResolvedValueOnce(mockObjectDef)
      .mockResolvedValueOnce(mockFields[0])
      .mockResolvedValueOnce(mockFields[1]);

    const { result } = renderHook(() =>
      useMetadata('customer', { apiClient: mockApiClient })
    );

    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.objectDef).toEqual(mockObjectDef);
    expect(result.current.fields).toHaveLength(2);
    expect(result.current.error).toBeNull();
  });

  it('should handle errors when fetching metadata', async () => {
    const error = new Error('Failed to fetch');
    vi.mocked(mockApiClient.get).mockRejectedValue(error);

    const { result } = renderHook(() =>
      useMetadata('customer', { apiClient: mockApiClient })
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBeTruthy();
    expect(result.current.objectDef).toBeNull();
  });

  it('should sort fields by order', async () => {
    const mockObjectDef: ObjectDefinition = {
      shortName: 'customer',
      displayName: 'Customer',
      description: 'Customer object',
      fields: [
        { fieldShortName: 'email', mandatory: true, order: 2 },
        { fieldShortName: 'name', mandatory: true, order: 1 },
      ],
      displayProperties: {},
    };

    const mockFields: FieldDefinition[] = [
      {
        shortName: 'email',
        displayName: 'Email',
        description: 'Customer email',
        datatype: 'email',
        datatypeProperties: {},
        mandatory: true,
      },
      {
        shortName: 'name',
        displayName: 'Name',
        description: 'Customer name',
        datatype: 'text',
        datatypeProperties: {},
        mandatory: true,
      },
    ];

    vi.mocked(mockApiClient.get)
      .mockResolvedValueOnce(mockObjectDef)
      .mockResolvedValueOnce(mockFields[0])
      .mockResolvedValueOnce(mockFields[1]);

    const { result } = renderHook(() =>
      useMetadata('customer', { apiClient: mockApiClient })
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Fields should be sorted by order: name (1), email (2)
    expect(result.current.fields[0].shortName).toBe('name');
    expect(result.current.fields[1].shortName).toBe('email');
  });
});

describe('useObjectDefinitions', () => {
  let mockApiClient: ApiClient;

  beforeEach(() => {
    mockApiClient = {
      get: vi.fn(),
    } as any;
  });

  it('should fetch all object definitions', async () => {
    const mockObjectDefs: ObjectDefinition[] = [
      {
        shortName: 'customer',
        displayName: 'Customer',
        description: 'Customer object',
        fields: [],
        displayProperties: {},
      },
      {
        shortName: 'order',
        displayName: 'Order',
        description: 'Order object',
        fields: [],
        displayProperties: {},
      },
    ];

    vi.mocked(mockApiClient.get).mockResolvedValue(mockObjectDefs);

    const { result } = renderHook(() =>
      useObjectDefinitions({ apiClient: mockApiClient })
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.objectDefs).toEqual(mockObjectDefs);
    expect(result.current.error).toBeNull();
  });
});

describe('useFieldDefinitions', () => {
  let mockApiClient: ApiClient;

  beforeEach(() => {
    mockApiClient = {
      get: vi.fn(),
    } as any;
  });

  it('should fetch all field definitions', async () => {
    const mockFieldDefs: FieldDefinition[] = [
      {
        shortName: 'name',
        displayName: 'Name',
        description: 'Name field',
        datatype: 'text',
        datatypeProperties: {},
        mandatory: false,
      },
      {
        shortName: 'email',
        displayName: 'Email',
        description: 'Email field',
        datatype: 'email',
        datatypeProperties: {},
        mandatory: false,
      },
    ];

    vi.mocked(mockApiClient.get).mockResolvedValue(mockFieldDefs);

    const { result } = renderHook(() =>
      useFieldDefinitions({ apiClient: mockApiClient })
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.fieldDefs).toEqual(mockFieldDefs);
    expect(result.current.error).toBeNull();
  });
});
