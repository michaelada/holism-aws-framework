import { useCallback, useState } from 'react';
import axios, { AxiosRequestConfig } from 'axios';
import { useAuthContext } from '../context/AuthContext';
import { rememberResponse, recallResponse } from '../offline/responseCache';
import { useStaleData } from '../offline/StaleDataContext';

export interface ApiRequest {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  url: string;
  data?: unknown;
  params?: Record<string, unknown>;
  /** Set for the `/api/public/*` endpoints, which must work with no session. */
  anonymous?: boolean;
}

/**
 * An API error the UI can act on.
 *
 * The account API refuses in several distinguishable ways — `NOT_CONNECTED`,
 * `PENDING_APPROVAL`, `REGISTRATION_REJECTED`, `ACCOUNT_INACTIVE`,
 * `ORGANISATION_UNAVAILABLE` — and each needs a different screen. Collapsing
 * them into a message string would throw away exactly the information the
 * router needs, so the code is carried through.
 */
export class AccountApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string
  ) {
    super(message);
    this.name = 'AccountApiError';
  }
}

export interface UseAccountApiReturn<T> {
  execute: (request: ApiRequest) => Promise<T>;
  loading: boolean;
  error: AccountApiError | null;
  /** When the data last returned actually came from the server, if it is cached. */
  servedFrom: { fetchedAt: string } | null;
  reset: () => void;
}

/**
 * Something the member tried to do that needs the network.
 *
 * Distinguished from an ordinary failure so a screen can say "you are offline"
 * rather than "something went wrong" (H2). Nothing is queued for later: an
 * entry made offline and replayed an hour afterwards could take a place that
 * had already gone, and the member would have been told it succeeded.
 */
export class OfflineError extends AccountApiError {
  constructor() {
    super('You are offline. This needs a connection.', 0, 'OFFLINE');
    this.name = 'OfflineError';
  }
}

/** `navigator.onLine` is a hint, but a false here is reliable. */
const isOffline = (): boolean =>
  typeof navigator !== 'undefined' && navigator.onLine === false;

/**
 * The single way this application talks to the backend.
 *
 * `execute` is wrapped in `useCallback` with only `getToken` as a dependency,
 * and `getToken` is itself stable. Pages reload data in a `useEffect` keyed on
 * `execute`, so an unstable identity here would loop forever rather than fail
 * visibly (CLAUDE.md §3.4).
 */
export function useAccountApi<T = unknown>(): UseAccountApiReturn<T> {
  const { getToken, user } = useAuthContext();
  /*
   * The cache is keyed by identity, so two members sharing a device cannot see
   * each other's screens even for the instant before a clear runs.
   */
  const userId = user?.id ?? null;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<AccountApiError | null>(null);
  const [servedFrom, setServedFrom] = useState<{ fetchedAt: string } | null>(null);
  /*
   * Publishing the fact that an answer came from cache is what lets the shell
   * say so once, rather than every screen remembering to. A no-op when there is
   * no provider — the public screens render outside the shell.
   */
  const { noteCached } = useStaleData();

  const execute = useCallback(
    async (request: ApiRequest): Promise<T> => {
      setLoading(true);
      setError(null);
      setServedFrom(null);

      const method = request.method ?? 'GET';
      const cacheable = method === 'GET' && !request.anonymous && Boolean(userId);

      /*
       * A mutation offline is refused here rather than attempted: axios would
       * fail with a network message that says nothing a member can act on, and
       * every screen would have to recognise it separately.
       */
      if (isOffline() && method !== 'GET') {
        const offline = new OfflineError();
        setError(offline);
        setLoading(false);
        throw offline;
      }

      try {
        const config: AxiosRequestConfig = {
          method: request.method || 'GET',
          url: request.url,
          data: request.data,
          params: request.params,
          baseURL: import.meta.env.VITE_API_BASE_URL,
          headers: {},
        };

        if (!request.anonymous) {
          const token = getToken();
          if (token) {
            config.headers = { Authorization: `Bearer ${token}` };
          }
        }

        const response = await axios(config);

        if (cacheable) rememberResponse(userId!, request.url, response.data);

        return response.data as T;
      } catch (err: unknown) {
        const apiError = toAccountApiError(err);

        /*
         * The last answer, when there is no new one.
         *
         * Only for reads, and only when the request failed for want of a
         * network — a 403 is the server's considered answer and must not be
         * papered over with yesterday's data. `servedFrom` carries when it was
         * fetched, because a screen that cannot say how old its data is has to
         * present it as current.
         */
        if (cacheable && isNetworkFailure(apiError)) {
          const cached = recallResponse<T>(userId!, request.url);
          if (cached) {
            setServedFrom({ fetchedAt: cached.fetchedAt });
            noteCached(cached.fetchedAt);
            setError(null);
            return cached.data;
          }
        }

        setError(apiError);
        throw apiError;
      } finally {
        setLoading(false);
      }
    },
    [getToken, userId, noteCached]
  );

  const reset = useCallback(() => setError(null), []);

  return { execute, loading, error, servedFrom, reset };
}

/**
 * Whether this failure means "no network" rather than "the server said no".
 *
 * Status 0 is what axios reports when the request never reached anybody. A
 * refusal with a status is the server's answer and is never replaced by cache.
 */
const isNetworkFailure = (error: AccountApiError): boolean => error.status === 0;

/**
 * Normalise whatever axios threw into an `AccountApiError`.
 *
 * The account routes report refusals as `{ error: { code, message } }` and the
 * older routes as `{ error: 'message' }`; both shapes are read so a caller never
 * has to care which endpoint it hit.
 */
export function toAccountApiError(err: unknown): AccountApiError {
  if (axios.isAxiosError(err)) {
    const status = err.response?.status ?? 0;
    const body = err.response?.data as
      | { error?: { code?: string; message?: string } | string; message?: string }
      | undefined;

    if (body && typeof body.error === 'object' && body.error) {
      return new AccountApiError(
        body.error.message || err.message,
        status,
        body.error.code
      );
    }

    const message =
      (typeof body?.error === 'string' ? body.error : undefined) ||
      body?.message ||
      err.message;
    return new AccountApiError(message, status);
  }

  return new AccountApiError(
    err instanceof Error ? err.message : 'Something went wrong',
    0
  );
}
