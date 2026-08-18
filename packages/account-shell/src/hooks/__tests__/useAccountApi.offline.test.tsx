import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import axios from 'axios';
import { useAccountApi, OfflineError } from '../useAccountApi';
import { rememberResponse } from '../../offline/responseCache';

vi.mock('axios');

const USER = { id: 'user-1', email: 'm@example.com', firstName: 'Sam', lastName: 'Rivers' };

// Partial: `AuthContext` itself must survive, or the shared test
// harness has no provider to render and every page using the session
// throws.
vi.mock('../../context/AuthContext', async () => ({
  ...(await vi.importActual<typeof import('../../context/AuthContext')>('../../context/AuthContext')),
  useAuthContext: () => ({ getToken: () => 'token', user: USER }),
}));

const mockedAxios = axios as unknown as ReturnType<typeof vi.fn> & {
  isAxiosError: (value: unknown) => boolean;
};

/** What axios throws when the request never reached anybody. */
const networkFailure = () =>
  Object.assign(new Error('Network Error'), { isAxiosError: true, response: undefined });

/** What it throws when the server answered — and refused. */
const refusal = (status: number, message: string) =>
  Object.assign(new Error(message), {
    isAxiosError: true,
    response: { status, data: { error: { message } } },
  });

const setOnline = (online: boolean) => {
  Object.defineProperty(window.navigator, 'onLine', { value: online, configurable: true });
};

/**
 * Offline behaviour, at the one place every request passes through.
 *
 * Putting it here rather than in each page is the whole point: a member with no
 * signal gets the same explanation whichever screen they are on, and a page
 * added later inherits it without knowing anything about caching.
 */
describe('useAccountApi — offline', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    setOnline(true);
    mockedAxios.isAxiosError = (value: unknown) =>
      Boolean((value as { isAxiosError?: boolean })?.isAxiosError);
  });

  afterEach(() => setOnline(true));

  describe('reads', () => {
    it('keeps the answer so the next visit has something to show', async () => {
      (mockedAxios as any).mockResolvedValue({ data: [{ id: 'ticket-1' }] });
      const { result } = renderHook(() => useAccountApi<unknown[]>());

      await act(async () => {
        await result.current.execute({ url: '/api/account/khpc/tickets' });
      });

      // The proof is the next render serving it with no network at all.
      (mockedAxios as any).mockRejectedValue(networkFailure());
      const { result: offlineResult } = renderHook(() => useAccountApi<unknown[]>());

      let served: unknown;
      await act(async () => {
        served = await offlineResult.current.execute({ url: '/api/account/khpc/tickets' });
      });

      expect(served).toEqual([{ id: 'ticket-1' }]);
    });

    it('says when what it served was fetched', async () => {
      rememberResponse('user-1', '/api/account/khpc/entries', [{ id: 'entry-1' }]);
      (mockedAxios as any).mockRejectedValue(networkFailure());
      const { result } = renderHook(() => useAccountApi<unknown[]>());

      await act(async () => {
        await result.current.execute({ url: '/api/account/khpc/entries' });
      });

      // A screen that cannot say how old its data is has to present it as current.
      expect(result.current.servedFrom?.fetchedAt).toBeTruthy();
      expect(result.current.error).toBeNull();
    });

    /**
     * The distinction the whole fallback turns on: a refusal is the server's
     * considered answer and must never be papered over with yesterday's data.
     */
    it('does not serve cache when the server refused', async () => {
      rememberResponse('user-1', '/api/account/khpc/me', { stale: true });
      (mockedAxios as any).mockRejectedValue(refusal(403, 'PENDING_APPROVAL'));
      const { result } = renderHook(() => useAccountApi());

      await expect(
        act(async () => {
          await result.current.execute({ url: '/api/account/khpc/me' });
        })
      ).rejects.toBeTruthy();
    });

    it('fails as normal when there is nothing cached', async () => {
      (mockedAxios as any).mockRejectedValue(networkFailure());
      const { result } = renderHook(() => useAccountApi());

      await expect(
        act(async () => {
          await result.current.execute({ url: '/api/account/khpc/nothing-here' });
        })
      ).rejects.toBeTruthy();
    });

    /** Public endpoints are shared by every visitor, so nothing is kept per member. */
    it('caches nothing for an anonymous request', async () => {
      (mockedAxios as any).mockResolvedValue({ data: [{ id: 'org-1' }] });
      const { result } = renderHook(() => useAccountApi<unknown[]>());

      await act(async () => {
        await result.current.execute({ url: '/api/public/organisations', anonymous: true });
      });

      expect(window.localStorage.length).toBe(0);
    });
  });

  describe('anything that changes something', () => {
    it('is refused outright while offline, with a reason a screen can show', async () => {
      setOnline(false);
      const { result } = renderHook(() => useAccountApi());

      let thrown: unknown;
      await act(async () => {
        thrown = await result.current
          .execute({ method: 'POST', url: '/api/account/khpc/cart/items', data: {} })
          .catch((error) => error);
      });

      expect(thrown).toBeInstanceOf(OfflineError);
      expect((thrown as OfflineError).code).toBe('OFFLINE');
      // Not attempted: axios would fail with a message saying nothing useful.
      expect(mockedAxios).not.toHaveBeenCalled();
    });

    /**
     * Nothing is queued for later. An entry made offline and replayed an hour
     * afterwards could take a place that had already gone, having told the
     * member it succeeded.
     */
    it('queues nothing for when the connection comes back', async () => {
      setOnline(false);
      const { result } = renderHook(() => useAccountApi());

      await act(async () => {
        await result.current
          .execute({ method: 'POST', url: '/api/account/khpc/cart/items', data: {} })
          .catch(() => undefined);
      });

      setOnline(true);
      expect(mockedAxios).not.toHaveBeenCalled();
    });

    it('is attempted as normal when online', async () => {
      (mockedAxios as any).mockResolvedValue({ data: { id: 'line-1' } });
      const { result } = renderHook(() => useAccountApi());

      await act(async () => {
        await result.current.execute({ method: 'POST', url: '/api/account/khpc/cart/items' });
      });

      expect(mockedAxios).toHaveBeenCalled();
    });
  });

  /**
   * `navigator.onLine` reporting true proves nothing — a captive portal says
   * exactly that — so reads still try, and still fall back.
   */
  it('still serves cache when the browser wrongly believes it is online', async () => {
    rememberResponse('user-1', '/api/account/khpc/tickets', [{ id: 'ticket-1' }]);
    setOnline(true);
    (mockedAxios as any).mockRejectedValue(networkFailure());
    const { result } = renderHook(() => useAccountApi<unknown[]>());

    let served: unknown;
    await act(async () => {
      served = await result.current.execute({ url: '/api/account/khpc/tickets' });
    });

    expect(served).toEqual([{ id: 'ticket-1' }]);
  });
});
