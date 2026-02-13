import { useState, useCallback, useContext, createContext } from 'react';
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
  retryCount?: number; // Number of retries on failure (default: 2)
  retryDelay?: number; // Delay between retries in ms (default: 1000)
}

/**
 * Auth token context for API calls
 * This allows the shell to provide the auth token to all API calls
 */
export const AuthTokenContext = createContext<(() => string | null) | undefined>(undefined);

/**
 * Sleep utility for retry delays
 */
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Custom hook for making API calls with loading and error states
 * 
 * Features:
 * - Automatic authentication token injection
 * - Retry logic with exponential backoff
 * - Loading and error state management
 * - Success/error callbacks
 * 
 * @example
 * const { data, error, loading, execute } = useApi<Event[]>();
 * 
 * // Make API call
 * await execute({
 *   method: 'GET',
 *   url: '/api/orgadmin/events',
 *   showSuccessMessage: false,
 *   retryCount: 3,
 * });
 */
export function useApi<T = any>() {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  // Get authentication token provider from context if available
  const getToken = useContext(AuthTokenContext);

  /**
   * Execute an API call with retry logic
   */
  const execute = useCallback(async (options: ApiCallOptions): Promise<T | null> => {
    setLoading(true);
    setError(null);

    const {
      retryCount = 2,
      retryDelay = 1000,
      onSuccess,
      onError,
      ...axiosOptions
    } = options;

    let lastError: string = '';
    let attempt = 0;

    while (attempt <= retryCount) {
      try {
        // Get authentication token if available
        const token = getToken?.();
        const headers: Record<string, string> = {
          ...(axiosOptions.headers as Record<string, string>),
        };

        // Set Content-Type if not already set
        if (!headers['Content-Type']) {
          headers['Content-Type'] = 'application/json';
        }

        // Add authorization header if token is available
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }

        const response = await axios({
          ...axiosOptions,
          headers,
        });

        setData(response.data);
        setLoading(false);

        // Call success callback if provided
        if (onSuccess) {
          onSuccess(response.data);
        }

        return response.data;
      } catch (err) {
        const axiosError = err as AxiosError<{ error?: string; message?: string }>;
        lastError =
          axiosError.response?.data?.error ||
          axiosError.response?.data?.message ||
          axiosError.message ||
          'An unexpected error occurred';

        // Don't retry on 4xx errors (client errors)
        if (axiosError.response?.status && axiosError.response.status >= 400 && axiosError.response.status < 500) {
          break;
        }

        // Retry on 5xx errors or network errors
        attempt++;
        if (attempt <= retryCount) {
          // Exponential backoff: delay * 2^attempt
          await sleep(retryDelay * Math.pow(2, attempt - 1));
        }
      }
    }

    // All retries failed
    setError(lastError);
    setData(null);
    setLoading(false);

    // Call error callback if provided
    if (onError) {
      onError(lastError);
    }

    return null;
  }, [getToken]);

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
