import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useObjectInstances } from '../useObjectInstances';
import { ApiClient } from '../../api';
import type { ListResponse } from '../../types';

describe('useObjectInstances', () => {
  let mockApiClient: ApiClient;

  beforeEach(() => {
    mockApiClient = {
      get: vi.fn(),
      post: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
    } as any;
  });

  it('should fetch instances with pagination', async () => {
    const mockResponse: ListResponse<any> = {
      data: [
        { id: '1', name: 'Customer 1' },
        { id: '2', name: 'Customer 2' },
      ],
      pagination: {
        page: 1,
        pageSize: 20,
        totalItems: 2,
        totalPages: 1,
      },
    };

    vi.mocked(mockApiClient.get).mockResolvedValue(mockResponse);

    const { result } = renderHook(() =>
      useObjectInstances('customer', { apiClient: mockApiClient })
    );

    await act(async () => {
      await result.current.fetchInstances({ page: 1, pageSize: 20 });
    });

    expect(result.current.instances).toEqual(mockResponse.data);
    expect(result.current.pagination).toEqual(mockResponse.pagination);
    expect(result.current.error).toBeNull();
  });

  it('should create a new instance', async () => {
    const newInstance = { id: '3', name: 'Customer 3' };
    vi.mocked(mockApiClient.post).mockResolvedValue(newInstance);

    const { result } = renderHook(() =>
      useObjectInstances('customer', { apiClient: mockApiClient })
    );

    let createdInstance: any;
    await act(async () => {
      createdInstance = await result.current.createInstance({ name: 'Customer 3' });
    });

    expect(createdInstance).toEqual(newInstance);
    expect(mockApiClient.post).toHaveBeenCalledWith(
      '/api/objects/customer/instances',
      { name: 'Customer 3' }
    );
  });

  it('should update an existing instance', async () => {
    const updatedInstance = { id: '1', name: 'Updated Customer' };
    vi.mocked(mockApiClient.put).mockResolvedValue(updatedInstance);

    const { result } = renderHook(() =>
      useObjectInstances('customer', { apiClient: mockApiClient })
    );

    let updated: any;
    await act(async () => {
      updated = await result.current.updateInstance('1', { name: 'Updated Customer' });
    });

    expect(updated).toEqual(updatedInstance);
    expect(mockApiClient.put).toHaveBeenCalledWith(
      '/api/objects/customer/instances/1',
      { name: 'Updated Customer' }
    );
  });

  it('should delete an instance', async () => {
    vi.mocked(mockApiClient.delete).mockResolvedValue(undefined);

    const { result } = renderHook(() =>
      useObjectInstances('customer', { apiClient: mockApiClient })
    );

    await act(async () => {
      await result.current.deleteInstance('1');
    });

    expect(mockApiClient.delete).toHaveBeenCalledWith('/api/objects/customer/instances/1');
  });

  it('should get a single instance', async () => {
    const instance = { id: '1', name: 'Customer 1' };
    vi.mocked(mockApiClient.get).mockResolvedValue(instance);

    const { result } = renderHook(() =>
      useObjectInstances('customer', { apiClient: mockApiClient })
    );

    let fetchedInstance: any;
    await act(async () => {
      fetchedInstance = await result.current.getInstance('1');
    });

    expect(fetchedInstance).toEqual(instance);
    expect(mockApiClient.get).toHaveBeenCalledWith('/api/objects/customer/instances/1');
  });

  it('should handle errors when fetching instances', async () => {
    const error = new Error('Failed to fetch');
    vi.mocked(mockApiClient.get).mockRejectedValue(error);

    const { result } = renderHook(() =>
      useObjectInstances('customer', { apiClient: mockApiClient })
    );

    await act(async () => {
      await result.current.fetchInstances();
    });

    expect(result.current.error).toBeTruthy();
    expect(result.current.instances).toEqual([]);
  });
});
