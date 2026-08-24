import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { AxiosError } from 'axios';

/**
 * The one place every request in this app passes through.
 *
 * Its job is not fetching — axios does that — it is translation: turning
 * whatever the server said into something the UI can act on. A 401 has to reach
 * the sign-out handler, a server error has to keep its code and message so the
 * page can show them, and a connection that never landed has to be
 * distinguishable from a server that answered with a refusal. Collapsing those
 * into one generic Error is what produces "Something went wrong" screens that
 * nobody can act on.
 */

const axiosInstance = {
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
  interceptors: {
    request: { use: vi.fn() },
    response: { use: vi.fn() },
  },
};

vi.mock('axios', () => ({
  default: { create: vi.fn(() => axiosInstance) },
}));

import axios from 'axios';
import { ApiClient, ApiError, NetworkError } from '../client';

/** The success/failure pair the client registered on each interceptor. */
const requestInterceptor = () => axiosInstance.interceptors.request.use.mock.calls.at(-1)!;
const responseInterceptor = () => axiosInstance.interceptors.response.use.mock.calls.at(-1)!;

const build = (over: Record<string, unknown> = {}) =>
  new ApiClient({ baseURL: 'http://api.test', ...over });

beforeEach(() => {
  vi.clearAllMocks();
});

describe('ApiClient — setting up', () => {
  it('sends JSON to the base URL it was given', () => {
    build();

    expect(axios.create).toHaveBeenCalledWith(
      expect.objectContaining({
        baseURL: 'http://api.test',
        headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
      })
    );
  });
});

describe('ApiClient — authenticating', () => {
  it('attaches the current token, read fresh on every request', () => {
    let token = 'first-token';
    build({ getToken: () => token });
    const [onRequest] = requestInterceptor();

    const first = onRequest({ headers: {} });
    token = 'refreshed-token';
    const second = onRequest({ headers: {} });

    // A token captured once goes stale the moment it is refreshed, and every
    // later request 401s with a token the app already replaced.
    expect(first.headers.Authorization).toBe('Bearer first-token');
    expect(second.headers.Authorization).toBe('Bearer refreshed-token');
  });

  it('sends no Authorization header when nobody is signed in', () => {
    build({ getToken: () => null });
    const [onRequest] = requestInterceptor();

    const config = onRequest({ headers: {} });

    // An empty `Bearer ` header reads as a malformed credential, not as absent.
    expect(config.headers.Authorization).toBeUndefined();
  });

  it('works with no token source configured at all', () => {
    build();
    const [onRequest] = requestInterceptor();

    expect(() => onRequest({ headers: {} })).not.toThrow();
  });

  it('passes a request that failed before sending straight through', async () => {
    build();
    const [, onRequestError] = requestInterceptor();

    await expect(onRequestError(new Error('aborted'))).rejects.toThrow('aborted');
  });
});

describe('ApiClient — what it makes of a failure', () => {
  const failWith = (error: Partial<AxiosError>) => {
    const [, onResponseError] = responseInterceptor();
    return () => onResponseError(error as AxiosError);
  };

  it('keeps the server’s own code and message', () => {
    build();
    const attempt = failWith({
      response: {
        status: 422,
        data: { error: { code: 'FIELD_IN_USE', message: 'Field is used by 3 objects', details: [{ objectId: 'o-1' }] } },
      } as never,
    });

    try {
      attempt();
      expect.unreachable('the interceptor must reject');
    } catch (err) {
      const apiError = err as ApiError;
      expect(apiError).toBeInstanceOf(ApiError);
      expect(apiError.status).toBe(422);
      expect(apiError.code).toBe('FIELD_IN_USE');
      expect(apiError.message).toBe('Field is used by 3 objects');
      expect(apiError.details).toEqual([{ objectId: 'o-1' }]);
    }
  });

  it('still produces a usable error when the server explains nothing', () => {
    build();
    const attempt = failWith({ response: { status: 500, data: undefined } as never });

    try {
      attempt();
      expect.unreachable('the interceptor must reject');
    } catch (err) {
      const apiError = err as ApiError;
      expect(apiError.status).toBe(500);
      expect(apiError.code).toBe('UNKNOWN_ERROR');
      expect(apiError.message).toBeTruthy();
    }
  });

  it('tells the app to sign the user out on a 401', () => {
    const onUnauthorized = vi.fn();
    build({ onUnauthorized });
    const attempt = failWith({
      response: { status: 401, data: { error: { code: 'TOKEN_EXPIRED', message: 'Expired' } } } as never,
    });

    expect(attempt).toThrow(ApiError);
    // Without this the user stares at a page that silently fails every action.
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it('leaves other failures alone rather than signing the user out', () => {
    const onUnauthorized = vi.fn();
    build({ onUnauthorized });
    const attempt = failWith({
      response: { status: 403, data: { error: { code: 'FORBIDDEN', message: 'Not allowed' } } } as never,
    });

    expect(attempt).toThrow(ApiError);
    // A 403 means "not yours", not "not signed in".
    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  it('does not fall over when no sign-out handler was supplied', () => {
    build();
    const attempt = failWith({ response: { status: 401, data: {} } as never });

    expect(attempt).toThrow(ApiError);
  });

  it('separates a request that never landed from one the server refused', () => {
    build();
    const attempt = failWith({ request: {}, response: undefined });

    // Only one of these is worth retrying, and the UI decides on the type.
    expect(attempt).toThrow(NetworkError);
  });

  it('reports a request that was never even built as an ordinary error', () => {
    build();
    const attempt = failWith({ message: 'Invalid URL' });

    expect(attempt).toThrow('Invalid URL');
  });

  it('passes a successful response through untouched', () => {
    build();
    const [onResponse] = responseInterceptor();
    const response = { data: { id: 'f-1' }, status: 200 };

    expect(onResponse(response)).toBe(response);
  });
});

describe('ApiClient — the verbs', () => {
  it('unwraps the response body so callers never see axios', async () => {
    const client = build();
    axiosInstance.get.mockResolvedValue({ data: [{ id: 'f-1' }], status: 200, headers: {} });

    await expect(client.get('/api/metadata/fields')).resolves.toEqual([{ id: 'f-1' }]);
  });

  it('sends the body on a create', async () => {
    const client = build();
    axiosInstance.post.mockResolvedValue({ data: { id: 'f-1' } });

    await client.post('/api/metadata/fields', { shortName: 'email' });

    expect(axiosInstance.post).toHaveBeenCalledWith(
      '/api/metadata/fields',
      { shortName: 'email' },
      undefined
    );
  });

  it('sends the body on an update', async () => {
    const client = build();
    axiosInstance.put.mockResolvedValue({ data: { id: 'f-1' } });

    await client.put('/api/metadata/fields/email', { label: 'Email address' });

    expect(axiosInstance.put).toHaveBeenCalledWith(
      '/api/metadata/fields/email',
      { label: 'Email address' },
      undefined
    );
  });

  it('carries query parameters through on a read', async () => {
    const client = build();
    axiosInstance.get.mockResolvedValue({ data: { data: [], pagination: {} } });

    await client.get('/api/objects/member/instances', { params: { page: 2 } });

    expect(axiosInstance.get).toHaveBeenCalledWith('/api/objects/member/instances', {
      params: { page: 2 },
    });
  });

  it('returns whatever a delete answered with', async () => {
    const client = build();
    axiosInstance.delete.mockResolvedValue({ data: undefined });

    await expect(client.delete('/api/metadata/fields/email')).resolves.toBeUndefined();
  });
});
