import { describe, it, expect, vi } from 'vitest';
import { reportSignOut } from '../signOutReport';

/**
 * The two properties that matter here are both about *not* getting in the way:
 * the request must survive the navigation that follows it, and nothing it does
 * may be able to stop somebody signing out.
 */

const okFetch = () => vi.fn().mockResolvedValue({ ok: true } as any);

describe('reportSignOut', () => {
  it('posts the sign-out with the caller’s token', () => {
    const fetchImpl = okFetch();

    reportSignOut({ token: 'tok-123', application: 'orgadmin-client', fetchImpl });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe('/api/audit/session/logout');
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toBe('Bearer tok-123');
    expect(JSON.parse(init.body)).toEqual({ application: 'orgadmin-client' });
  });

  it('sets keepalive, so the redirect does not cancel the report', () => {
    const fetchImpl = okFetch();

    reportSignOut({ token: 'tok-123', application: 'account-app', fetchImpl });

    // Without this the browser cancels the request as it navigates to Keycloak
    // and the sign-out is never recorded.
    expect(fetchImpl.mock.calls[0][1].keepalive).toBe(true);
  });

  it('does nothing without a token', () => {
    const fetchImpl = okFetch();

    reportSignOut({ token: null, application: 'orgadmin-client', fetchImpl });
    reportSignOut({ token: undefined, application: 'orgadmin-client', fetchImpl });
    reportSignOut({ token: '', application: 'orgadmin-client', fetchImpl });

    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('swallows a rejected request', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error('offline'));

    expect(() =>
      reportSignOut({ token: 'tok-123', application: 'orgadmin-client', fetchImpl }),
    ).not.toThrow();

    // An unhandled rejection here would surface as a console error on the way
    // out; the .catch inside is what stops that.
    await Promise.resolve();
  });

  it('swallows a fetch that throws synchronously', () => {
    const fetchImpl = vi.fn(() => {
      throw new Error('blocked by extension');
    }) as unknown as typeof fetch;

    expect(() =>
      reportSignOut({ token: 'tok-123', application: 'orgadmin-client', fetchImpl }),
    ).not.toThrow();
  });

  it('returns without throwing when no fetch is available at all', () => {
    expect(() =>
      reportSignOut({
        token: 'tok-123',
        application: 'orgadmin-client',
        fetchImpl: undefined as unknown as typeof fetch,
        endpoint: '/api/audit/session/logout',
      }),
    ).not.toThrow();
  });
});
