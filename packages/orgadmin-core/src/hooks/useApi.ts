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
 * Which organisation the administrator is currently working in.
 *
 * Sent as `X-Organisation-Id` on every call, for the org-admin routes that do
 * not carry the organisation in their path — Settings, Users, Forms, uploads
 * and most of Payments. The routes that *do* carry it are unaffected: the URL
 * wins, because an address naming an organisation is unambiguous and a header
 * quietly overriding it would make the same URL mean different things in
 * different tabs.
 *
 * A header rather than a value each caller passes, for the same reason the
 * token is a header: a caller that has to remember is a caller that will
 * forget, and forgetting here means acting on the wrong club's data.
 *
 * Nothing is trusted client-side. The server verifies membership of whatever
 * this names before it will act on it.
 */
export const OrganisationIdContext = createContext<(() => string | null) | undefined>(undefined);

/**
 * Paths that must never be organisation-scoped.
 *
 * `/auth/me` is how an administrator finds out which organisations they have,
 * so requiring one would be circular; `/auth/capabilities` is asked in the same
 * breath. Everything else under `/api/orgadmin` is about a particular club.
 *
 * `/api/orgadmin/organisation/` — singular — is the current organisation's own
 * router: payment settings, branding, email templates, registration settings,
 * Stripe Connect, registrations and offline payments. It is mounted **once**,
 * bare, and is not one of the dual-mounted data routers, so rewriting it to
 * `/api/orgadmin/organisations/<id>/organisation/…` produced a 404 on every one
 * of those screens. Payment Settings and Stripe Connect answered 404 twice each
 * on a single tab click.
 *
 * Excluding it here rather than adding a scoped mount is deliberate. That
 * router resolves the organisation from the *signed-in user*, not from the
 * path, and unlike the dual-mounted routers it has no check that the two agree
 * — so a scoped mount would accept a URL naming one club while the handler
 * worked on another. A URL that misreports its subject is worse than no URL
 * scoping at all. The organisation still travels on `X-Organisation-Id`.
 *
 * The trailing slash is what keeps this from swallowing the plural
 * `/api/orgadmin/organisations/…`, which is already handled above.
 */
const UNSCOPED_ORGADMIN_PATHS = ['/api/orgadmin/auth/', '/api/orgadmin/organisation/'];

/**
 * Put the organisation in the URL, not only in a header.
 *
 * The org-admin data routers are mounted at
 * `/api/orgadmin/organisations/:organisationId/...` as well as bare, and this is
 * what makes the app use the scoped form. A request that says which club it is
 * about is legible in a log without cross-referencing a header against a
 * session, and cannot be read as being about the wrong one.
 *
 * Done here rather than at the ~240 call sites deliberately. Half of those live
 * in components with no organisation in scope, so spelling it out everywhere
 * would mean threading state through forty files to change what appears on the
 * wire — forty chances to break a working screen, for a URL that this function
 * can produce correctly every time.
 *
 * A URL that already names an organisation is left exactly as it is: the caller
 * has been specific, and the server refuses any disagreement between the two
 * anyway.
 */
export function organisationScopedUrl(url: string, organisationId: string | null): string {
  if (!organisationId) return url;
  if (!url.startsWith('/api/orgadmin/')) return url;
  if (url.startsWith('/api/orgadmin/organisations/')) return url;
  if (UNSCOPED_ORGADMIN_PATHS.some((prefix) => url.startsWith(prefix))) return url;

  return url.replace('/api/orgadmin/', `/api/orgadmin/organisations/${organisationId}/`);
}

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
  const getOrganisationId = useContext(OrganisationIdContext);

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

        /*
         * Never overwrite one a caller set deliberately — a screen that needs to
         * ask about a specific organisation has said so, and second-guessing it
         * here would be the bug this header exists to prevent.
         */
        const organisationId = getOrganisationId?.();
        if (organisationId && !headers['X-Organisation-Id']) {
          headers['X-Organisation-Id'] = organisationId;
        }

        const response = await axios({
          ...axiosOptions,
          url: organisationScopedUrl(axiosOptions.url ?? '', organisationId ?? null),
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
        const axiosError = err as AxiosError<{
          error?: string | { code?: string; message?: string };
          message?: string;
        }>;
        const responseError = axiosError.response?.data?.error;
        lastError =
          (typeof responseError === 'string' ? responseError : responseError?.message) ||
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
  const { execute: runRequest } = api;

  const execute = useCallback(
    async (additionalOptions?: Omit<ApiCallOptions, 'method' | 'url'>) => {
      return runRequest({
        method: 'GET',
        url,
        ...options,
        ...additionalOptions,
      });
    },
    [runRequest, url, options]
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
  const { execute: runRequest } = api;

  const execute = useCallback(
    async (data?: any, additionalOptions?: Omit<ApiCallOptions, 'method' | 'url' | 'data'>) => {
      return runRequest({
        method: 'POST',
        url,
        data,
        ...options,
        ...additionalOptions,
      });
    },
    [runRequest, url, options]
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
  const { execute: runRequest } = api;

  const execute = useCallback(
    async (data?: any, additionalOptions?: Omit<ApiCallOptions, 'method' | 'url' | 'data'>) => {
      return runRequest({
        method: 'PUT',
        url,
        data,
        ...options,
        ...additionalOptions,
      });
    },
    [runRequest, url, options]
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
  const { execute: runRequest } = api;

  const execute = useCallback(
    async (additionalOptions?: Omit<ApiCallOptions, 'method' | 'url'>) => {
      return runRequest({
        method: 'DELETE',
        url,
        ...options,
        ...additionalOptions,
      });
    },
    [runRequest, url, options]
  );

  return {
    ...api,
    execute,
  };
}
