import { useState, useCallback } from 'react';
import axios, { AxiosError, AxiosRequestConfig } from 'axios';

/**
 * API response type
 */
export interface ApiResponse<T = any> {
  data: T | null;
  error: string | null;
  loading: boolean;
}

/**
 * API call options
 */
export interface ApiCallOptions extends AxiosRequestConfig {
  showSuccessMessage?: boolean;
  successMessage?: string;
  showErrorMessage?: boolean;
  onSuccess?: (data: any) => void;
  onError?: (error: string) => void;
}

/**
 * Custom hook for making API calls with loading and error states
 * 
 * @example
 * const { data, error, loading, execute } = useApi<Event[]>();
 * 
 * // Make API call
 * await execute({
 *   method: 'GET',
 *   url: '/api/orgadmin/events',
 *   showSuccessMessage: false,
 * });
 */
export function useApi<T = any>() {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  /**
   * Execute an API call
   */
  const execute = useCallback(async (options: ApiCallOptions): Promise<T | null> => {
    setLoading(true);
    setError(null);

    try {
      const response = await axios({
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });

      setData(response.data);
      setLoading(false);

      // Call success callback if provided
      if (options.onSuccess) {
        options.onSuccess(response.data);
      }

      return response.data;
    } catch (err) {
      const axiosError = err as AxiosError<{ error?: string; message?: string }>;
      const errorMessage =
        axiosError.response?.data?.error ||
        axiosError.response?.data?.message ||
        axiosError.message ||
        'An unexpected error occurred';

      setError(errorMessage);
      setData(null);
      setLoading(false);

      // Call error callback if provided
      if (options.onError) {
        options.onError(errorMessage);
      }

      return null;
    }
  }, []);

  /**
   * Reset the API state
   */
  const reset = useCallback(() => {
    setData(null);
    setError(null);
    setLoading(false);
  }, []);

  return {
    data,
    error,
    loading,
    execute,
    reset,
  };
}

/**
 * Hook for making a GET request
 */
export function useApiGet<T = any>(url: string, options?: Omit<ApiCallOptions, 'method' | 'url'>) {
  const api = useApi<T>();

  const execute = useCallback(
    async (additionalOptions?: Omit<ApiCallOptions, 'method' | 'url'>) => {
      return api.execute({
        method: 'GET',
        url,
        ...options,
        ...additionalOptions,
      });
    },
    [api, url, options]
  );

  return {
    ...api,
    execute,
  };
}

/**
 * Hook for making a POST request
 */
export function useApiPost<T = any>(url: string, options?: Omit<ApiCallOptions, 'method' | 'url'>) {
  const api = useApi<T>();

  const execute = useCallback(
    async (data?: any, additionalOptions?: Omit<ApiCallOptions, 'method' | 'url' | 'data'>) => {
      return api.execute({
        method: 'POST',
        url,
        data,
        ...options,
        ...additionalOptions,
      });
    },
    [api, url, options]
  );

  return {
    ...api,
    execute,
  };
}

/**
 * Hook for making a PUT request
 */
export function useApiPut<T = any>(url: string, options?: Omit<ApiCallOptions, 'method' | 'url'>) {
  const api = useApi<T>();

  const execute = useCallback(
    async (data?: any, additionalOptions?: Omit<ApiCallOptions, 'method' | 'url' | 'data'>) => {
      return api.execute({
        method: 'PUT',
        url,
        data,
        ...options,
        ...additionalOptions,
      });
    },
    [api, url, options]
  );

  return {
    ...api,
    execute,
  };
}

/**
 * Hook for making a DELETE request
 */
export function useApiDelete<T = any>(url: string, options?: Omit<ApiCallOptions, 'method' | 'url'>) {
  const api = useApi<T>();

  const execute = useCallback(
    async (additionalOptions?: Omit<ApiCallOptions, 'method' | 'url'>) => {
      return api.execute({
        method: 'DELETE',
        url,
        ...options,
        ...additionalOptions,
      });
    },
    [api, url, options]
  );

  return {
    ...api,
    execute,
  };
}
