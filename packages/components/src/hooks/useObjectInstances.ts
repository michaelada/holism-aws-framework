import { useState, useCallback } from 'react';
import type { ListQueryParams, ListResponse } from '../types';
import { defaultApiClient, ApiClient } from '../api';

export interface UseObjectInstancesOptions {
  apiClient?: ApiClient;
}

export interface UseObjectInstancesResult<T = any> {
  instances: T[];
  pagination: ListResponse<T>['pagination'] | null;
  loading: boolean;
  error: Error | null;
  fetchInstances: (params?: ListQueryParams) => Promise<void>;
  createInstance: (data: Partial<T>) => Promise<T>;
  updateInstance: (id: string, data: Partial<T>) => Promise<T>;
  deleteInstance: (id: string) => Promise<void>;
  getInstance: (id: string) => Promise<T>;
}

/**
 * Hook for CRUD operations on object instances
 * 
 * @param objectType - Short name of the object type
 * @param options - Configuration options
 * @returns CRUD operations and state for object instances
 * 
 * @example
 * ```tsx
 * const {
 *   instances,
 *   loading,
 *   fetchInstances,
 *   createInstance,
 *   updateInstance,
 *   deleteInstance
 * } = useObjectInstances('customer');
 * 
 * // Fetch instances with pagination
 * useEffect(() => {
 *   fetchInstances({ page: 1, pageSize: 20 });
 * }, []);
 * 
 * // Create a new instance
 * const handleCreate = async (data) => {
 *   await createInstance(data);
 *   await fetchInstances();
 * };
 * ```
 */
export function useObjectInstances<T = any>(
  objectType: string,
  options: UseObjectInstancesOptions = {}
): UseObjectInstancesResult<T> {
  const { apiClient = defaultApiClient } = options;
  
  const [instances, setInstances] = useState<T[]>([]);
  const [pagination, setPagination] = useState<ListResponse<T>['pagination'] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchInstances = useCallback(async (params?: ListQueryParams) => {
    setLoading(true);
    setError(null);

    try {
      const response = await apiClient.get<ListResponse<T>>(
        `/api/objects/${objectType}/instances`,
        params
      );
      setInstances(response.data);
      setPagination(response.pagination);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch instances'));
      setInstances([]);
      setPagination(null);
    } finally {
      setLoading(false);
    }
  }, [objectType, apiClient]);

  const getInstance = useCallback(async (id: string): Promise<T> => {
    setLoading(true);
    setError(null);

    try {
      const instance = await apiClient.get<T>(
        `/api/objects/${objectType}/instances/${id}`
      );
      return instance;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to fetch instance');
      setError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [objectType, apiClient]);

  const createInstance = useCallback(async (data: Partial<T>): Promise<T> => {
    setLoading(true);
    setError(null);

    try {
      const instance = await apiClient.post<T>(
        `/api/objects/${objectType}/instances`,
        data
      );
      return instance;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to create instance');
      setError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [objectType, apiClient]);

  const updateInstance = useCallback(async (id: string, data: Partial<T>): Promise<T> => {
    setLoading(true);
    setError(null);

    try {
      const instance = await apiClient.put<T>(
        `/api/objects/${objectType}/instances/${id}`,
        data
      );
      return instance;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to update instance');
      setError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [objectType, apiClient]);

  const deleteInstance = useCallback(async (id: string): Promise<void> => {
    setLoading(true);
    setError(null);

    try {
      await apiClient.delete(`/api/objects/${objectType}/instances/${id}`);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to delete instance');
      setError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [objectType, apiClient]);

  return {
    instances,
    pagination,
    loading,
    error,
    fetchInstances,
    createInstance,
    updateInstance,
    deleteInstance,
    getInstance,
  };
}
