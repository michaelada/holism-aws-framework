import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useApi, useApiGet, useApiPost } from '../useApi';
import axios from 'axios';

// Mock axios
vi.mock('axios');
const mockedAxios = vi.mocked(axios);

describe('useApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should initialize with default state', () => {
    const { result } = renderHook(() => useApi());

    expect(result.current.data).toBeNull();
    expect(result.current.error).toBeNull();
    expect(result.current.loading).toBe(false);
  });

  it('should handle successful API call', async () => {
    const mockData = { id: 1, name: 'Test' };
    mockedAxios.mockResolvedValueOnce({ data: mockData });

    const { result } = renderHook(() => useApi());

    await result.current.execute({
      method: 'GET',
      url: '/api/test',
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toEqual(mockData);
    expect(result.current.error).toBeNull();
  });

  it('should handle API error', async () => {
    const errorMessage = 'Network error';
    mockedAxios.mockRejectedValueOnce({
      response: { data: { error: errorMessage } },
      message: 'Request failed',
    });

    const { result } = renderHook(() => useApi());

    await result.current.execute({
      method: 'GET',
      url: '/api/test',
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toBeNull();
    expect(result.current.error).toBe(errorMessage);
  });

  it('should reset state', async () => {
    const mockData = { id: 1, name: 'Test' };
    mockedAxios.mockResolvedValueOnce({ data: mockData });

    const { result } = renderHook(() => useApi());

    await result.current.execute({
      method: 'GET',
      url: '/api/test',
    });

    await waitFor(() => {
      expect(result.current.data).toEqual(mockData);
    });

    await waitFor(() => {
      result.current.reset();
    });

    expect(result.current.data).toBeNull();
    expect(result.current.error).toBeNull();
    expect(result.current.loading).toBe(false);
  });
});

describe('useApiGet', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should make GET request', async () => {
    const mockData = { id: 1, name: 'Test' };
    mockedAxios.mockResolvedValueOnce({ data: mockData });

    const { result } = renderHook(() => useApiGet('/api/test'));

    await result.current.execute();

    await waitFor(() => {
      expect(result.current.data).toEqual(mockData);
    });

    expect(mockedAxios).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'GET',
        url: '/api/test',
      })
    );
  });
});

describe('useApiPost', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should make POST request with data', async () => {
    const mockData = { id: 1, name: 'Test' };
    const postData = { name: 'New Item' };
    mockedAxios.mockResolvedValueOnce({ data: mockData });

    const { result } = renderHook(() => useApiPost('/api/test'));

    await result.current.execute(postData);

    await waitFor(() => {
      expect(result.current.data).toEqual(mockData);
    });

    expect(mockedAxios).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'POST',
        url: '/api/test',
        data: postData,
      })
    );
  });
});
