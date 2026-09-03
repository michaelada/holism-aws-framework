import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { createElement } from 'react';
import { AuthTokenContext, useApi, useApiGet, useApiPost } from '../useApi';
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
    mockedAxios.mockRejectedValue({
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

/**
 * Failures a screen has to hear about.
 *
 * `execute` answers `null` on an error and records the message in `error`.
 * That suits a screen that loads data — it renders an empty state and moves on
 * — and it is wrong for an *action*: every `try { await execute(...) } catch`
 * around a mutation in this codebase was dead code, and the screen reported
 * success on a refusal. Undoing an offline receipt said "Undone" while the
 * server was answering 400.
 */
describe('useApi — throwOnError', () => {
  const refusal = {
    isAxiosError: true,
    response: { status: 400, data: { error: 'Recording this payment created memberships.' } },
    message: 'Request failed',
  };

  beforeEach(() => vi.clearAllMocks());

  it('throws the server’s own words when asked to', async () => {
    mockedAxios.mockRejectedValueOnce(refusal);
    const { result } = renderHook(() => useApi());

    await expect(
      result.current.execute({ method: 'DELETE', url: '/api/test', throwOnError: true })
    ).rejects.toThrow('Recording this payment created memberships.');
  });

  it('still answers null by default, for the screens that read it', async () => {
    // ~240 call sites do; changing that wholesale is a different piece of work.
    mockedAxios.mockRejectedValueOnce(refusal);
    const { result } = renderHook(() => useApi());

    await expect(
      result.current.execute({ method: 'DELETE', url: '/api/test' })
    ).resolves.toBeNull();
  });

  it('records the error either way', async () => {
    mockedAxios.mockRejectedValueOnce(refusal);
    const { result } = renderHook(() => useApi());

    await result.current.execute({ method: 'DELETE', url: '/api/test' }).catch(() => undefined);

    await waitFor(() =>
      expect(result.current.error).toBe('Recording this payment created memberships.')
    );
  });

  it('does not throw on success', async () => {
    mockedAxios.mockResolvedValueOnce({ data: { ok: true } });
    const { result } = renderHook(() => useApi());

    await expect(
      result.current.execute({ method: 'POST', url: '/api/test', throwOnError: true })
    ).resolves.toEqual({ ok: true });
  });
});

/**
 * Uploading a file.
 *
 * A multipart body has to be announced with the boundary the client generated
 * with it, and only the client can write that header. This hook used to set
 * `application/json` on every request that had not asked for something else —
 * so an upload arrived with a multipart body under a JSON header, the server's
 * parser found no file, and the 400 that came back was turned into `null` and
 * ignored. A club saved an announcement and its picture was quietly missing.
 */
describe('useApi — file uploads', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedAxios.mockResolvedValue({ data: { ok: true } });
  });

  const upload = async () => {
    const body = new FormData();
    body.append('file', new File(['x'], 'clubhouse.jpg', { type: 'image/jpeg' }));

    const { result } = renderHook(() => useApi());
    await result.current.execute({ method: 'POST', url: '/api/upload', data: body });
    return mockedAxios.mock.calls[0][0] as { headers: Record<string, string> };
  };

  it('leaves the content type to the client when the body is a file', async () => {
    // Including it without a boundary is the same bug one step further on.
    const request = await upload();

    expect(request.headers['Content-Type']).toBeUndefined();
  });

  it('still sends the token with an upload', async () => {
    // Dropping the content type must not drop the rest of the header block:
    // an upload needs authorising like any other call.
    const body = new FormData();
    body.append('file', new File(['x'], 'clubhouse.jpg', { type: 'image/jpeg' }));

    const { result } = renderHook(() => useApi(), {
      wrapper: ({ children }) =>
        createElement(AuthTokenContext.Provider, { value: () => 'token-123' }, children),
    });
    await result.current.execute({ method: 'POST', url: '/api/upload', data: body });

    const request = mockedAxios.mock.calls[0][0] as { headers: Record<string, string> };
    expect(request.headers.Authorization).toBe('Bearer token-123');
    expect(request.headers['Content-Type']).toBeUndefined();
  });

  it('keeps JSON for an ordinary request', async () => {
    const { result } = renderHook(() => useApi());
    await result.current.execute({ method: 'POST', url: '/api/thing', data: { a: 1 } });

    const request = mockedAxios.mock.calls[0][0] as { headers: Record<string, string> };
    expect(request.headers['Content-Type']).toBe('application/json');
  });

  it('never overrides a content type the caller chose', async () => {
    const { result } = renderHook(() => useApi());
    await result.current.execute({
      method: 'POST',
      url: '/api/thing',
      data: 'raw',
      headers: { 'Content-Type': 'text/plain' },
    });

    const request = mockedAxios.mock.calls[0][0] as { headers: Record<string, string> };
    expect(request.headers['Content-Type']).toBe('text/plain');
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
