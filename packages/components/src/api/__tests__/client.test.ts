import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ApiClient, ApiError, NetworkError, defaultApiClient } from '../client';

/**
 * The shared library's own fetch wrapper.
 *
 * Its two jobs are building the URL and classifying the failure, and both have
 * cost real outages. The base URL must stay *relative* by default — an absolute
 * `http://localhost:3000` fallback told every deployed browser to call a port on
 * the user's own machine, so every request failed while the page around it
 * worked. And a refusal the server explained has to stay distinguishable from a
 * connection that never landed: only one of the two is worth retrying.
 */

const okResponse = (data: unknown) => ({
  ok: true,
  status: 200,
  json: async () => data,
});

const errorResponse = (status: number, error: unknown) => ({
  ok: false,
  status,
  json: async () => ({ error }),
});

let fetchMock: ReturnType<typeof vi.fn>;

const client = (baseUrl?: string, getToken?: () => string | null) =>
  new ApiClient(baseUrl, getToken);

/** The URL of the most recent request. */
const requestedUrl = () => new URL(fetchMock.mock.calls.at(-1)![0] as string);

const requestInit = () => fetchMock.mock.calls.at(-1)![1] as RequestInit;

beforeEach(() => {
  fetchMock = vi.fn().mockResolvedValue(okResponse({ ok: true }));
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('ApiClient — building the URL', () => {
  it('sends a relative base to the origin that served the page', async () => {
    await client('/api').get('/members');

    // An absolute default would point a deployed browser at localhost.
    expect(requestedUrl().origin).toBe(window.location.origin);
    expect(requestedUrl().pathname).toBe('/api/members');
  });

  it('honours an absolute base when one is configured', async () => {
    await client('https://api.example.com').get('/members');

    expect(requestedUrl().origin).toBe('https://api.example.com');
    expect(requestedUrl().pathname).toBe('/members');
  });

  it('tolerates a path given without its leading slash', async () => {
    await client('/api').get('members');

    expect(requestedUrl().pathname).toBe('/api/members');
  });

  it('appends query parameters', async () => {
    await client('/api').get('/members', { page: 2, search: 'byrne' });

    expect(requestedUrl().searchParams.get('page')).toBe('2');
    expect(requestedUrl().searchParams.get('search')).toBe('byrne');
  });

  it('leaves out parameters that were never set', async () => {
    await client('/api').get('/members', { page: 1, search: undefined, status: null });

    // An empty `status=` is a filter the server honours, matching nothing.
    expect(requestedUrl().searchParams.has('search')).toBe(false);
    expect(requestedUrl().searchParams.has('status')).toBe(false);
    expect(requestedUrl().searchParams.get('page')).toBe('1');
  });

  it('keeps a parameter whose value is zero or false', async () => {
    await client('/api').get('/members', { page: 0, includeArchived: false });

    expect(requestedUrl().searchParams.get('page')).toBe('0');
    expect(requestedUrl().searchParams.get('includeArchived')).toBe('false');
  });

  it('escapes a value that would otherwise break the query string', async () => {
    await client('/api').get('/members', { search: 'a&b=c d' });

    expect(requestedUrl().searchParams.get('search')).toBe('a&b=c d');
  });
});

describe('ApiClient — what it sends', () => {
  it('sends JSON', async () => {
    await client('/api').get('/members');

    expect((requestInit().headers as Record<string, string>)['Content-Type']).toBe(
      'application/json'
    );
  });

  it('attaches the token that is current at the moment of the request', async () => {
    let token = 'first';
    const api = client('/api', () => token);

    await api.get('/members');
    const before = (requestInit().headers as Record<string, string>).Authorization;
    token = 'refreshed';
    await api.get('/members');

    expect(before).toBe('Bearer first');
    expect((requestInit().headers as Record<string, string>).Authorization).toBe(
      'Bearer refreshed'
    );
  });

  it('sends no Authorization header when nobody is signed in', async () => {
    await client('/api', () => null).get('/members');

    // An empty `Bearer ` reads as a malformed credential, not as absent.
    expect((requestInit().headers as Record<string, string>).Authorization).toBeUndefined();
  });

  it('works with no token source at all', async () => {
    await expect(client('/api').get('/members')).resolves.toBeDefined();
  });

  it('sends a body on a create', async () => {
    await client('/api').post('/members', { surname: 'Byrne' });

    expect(requestInit().method).toBe('POST');
    expect(requestInit().body).toBe(JSON.stringify({ surname: 'Byrne' }));
  });

  it('sends a body on an update', async () => {
    await client('/api').put('/members/1', { surname: 'Byrne' });

    expect(requestInit().method).toBe('PUT');
    expect(requestInit().body).toBe(JSON.stringify({ surname: 'Byrne' }));
  });

  it('sends a delete with no body', async () => {
    await client('/api').delete('/members/1');

    expect(requestInit().method).toBe('DELETE');
    expect(requestInit().body).toBeUndefined();
  });

  it('lets a caller add a header without losing the defaults', async () => {
    await client('/api').request('/members', { headers: { 'X-Trace': 'abc' } });

    const headers = requestInit().headers as Record<string, string>;
    expect(headers['X-Trace']).toBe('abc');
    expect(headers['Content-Type']).toBe('application/json');
  });
});

describe('ApiClient — what it makes of a failure', () => {
  it('returns the parsed body on success', async () => {
    fetchMock.mockResolvedValue(okResponse([{ id: 'm-1' }]));

    await expect(client('/api').get('/members')).resolves.toEqual([{ id: 'm-1' }]);
  });

  it('keeps the status and the server’s own explanation', async () => {
    fetchMock.mockResolvedValue(
      errorResponse(409, { code: 'IN_USE', message: 'Member has an open booking' })
    );

    try {
      await client('/api').delete('/members/1');
      expect.unreachable('the client must reject');
    } catch (err) {
      const apiError = err as ApiError;
      expect(apiError).toBeInstanceOf(ApiError);
      expect(apiError.status).toBe(409);
      expect(apiError.message).toBe('Member has an open booking');
    }
  });

  it('separates a request that never landed from one the server refused', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

    // Only one of the two is worth retrying, and the UI decides on the type.
    await expect(client('/api').get('/members')).rejects.toBeInstanceOf(NetworkError);
  });

  it('does not disguise a refusal as a connection problem', async () => {
    fetchMock.mockResolvedValue(errorResponse(403, { code: 'FORBIDDEN', message: 'Not yours' }));

    await expect(client('/api').get('/members')).rejects.toBeInstanceOf(ApiError);
  });

  it('treats an unreadable error body as a connection problem rather than crashing', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 502,
      json: async () => {
        throw new SyntaxError('Unexpected token < in JSON');
      },
    });

    // A proxy returning an HTML error page lands here.
    await expect(client('/api').get('/members')).rejects.toBeInstanceOf(NetworkError);
  });
});

describe('the default client', () => {
  it('exists and is relative, so it works wherever the app is served', async () => {
    await defaultApiClient.get('/members');

    expect(requestedUrl().origin).toBe(window.location.origin);
  });
});
