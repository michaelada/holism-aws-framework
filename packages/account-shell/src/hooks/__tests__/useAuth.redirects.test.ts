/**
 * Every redirect this hook produces keeps the app's base path.
 *
 * Signing out sent the browser to `/account` — no trailing slash — and the app
 * is served under a base of `/account/`. The dev server answered with its own
 * developer message:
 *
 *     The server is configured with a public base URL of /account/
 *     — did you mean to visit /account/ instead?
 *
 * so the last thing a member saw on the way out was a tooling error. Signing
 * *in* was unaffected, because `redirectFor` had always included the slash —
 * which is exactly why it went unnoticed.
 *
 * A unit test rather than a browser one: the failure is a string, and the
 * string is what the assertion should be about.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAuth } from '../useAuth';

const logout = vi.fn();
const login = vi.fn();

vi.mock('keycloak-js', () => ({
  default: class {
    token = 'tok';
    tokenParsed = { sub: 'u1', email: 'm@example.test' };
    init = vi.fn().mockResolvedValue(true);
    login = login;
    logout = logout;
    register = vi.fn();
    updateToken = vi.fn().mockResolvedValue(false);
  },
}));

vi.mock('../../offline/responseCache', () => ({ forgetResponses: vi.fn() }));

const config = { url: 'http://localhost:8080', realm: 'aws-framework', clientId: 'account' };

const setup = async () => {
  const rendered = renderHook(() => useAuth(config));
  // Let Keycloak's init settle so the hook holds an instance.
  await act(async () => {
    await Promise.resolve();
  });
  return rendered;
};

beforeEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(window, 'location', {
    value: { origin: 'https://itsps.org', href: 'https://itsps.org/account/khpc' },
    writable: true,
  });
});

describe('sign-out', () => {
  it('returns to the app root **with** its trailing slash', async () => {
    const { result } = await setup();

    act(() => result.current.logout());

    expect(logout).toHaveBeenCalledWith({ redirectUri: 'https://itsps.org/account/' });
  });

  it('never sends the browser to the base path without it', async () => {
    /*
     * Stated as its own assertion because this is the whole defect: `/account`
     * and `/account/` are different paths, and only one of them is the app.
     */
    const { result } = await setup();

    act(() => result.current.logout());

    const [{ redirectUri }] = logout.mock.calls[0];
    expect(redirectUri).not.toBe('https://itsps.org/account');
    expect(redirectUri.endsWith('/')).toBe(true);
  });
});

describe('sign-in', () => {
  it('keeps the base path in front of the club code', async () => {
    // Unchanged behaviour, pinned so the shared constant cannot regress it.
    const { result } = await setup();

    act(() => result.current.login('khpc'));

    expect(login).toHaveBeenCalledWith({ redirectUri: 'https://itsps.org/account/khpc' });
  });

  it('re-authenticates against the same address when switching member', async () => {
    const { result } = await setup();

    act(() => result.current.signInAsSomeoneElse('lhpc'));

    expect(login).toHaveBeenCalledWith({
      redirectUri: 'https://itsps.org/account/lhpc',
      prompt: 'login',
    });
  });

  it('stays where it is when no club is named', async () => {
    const { result } = await setup();

    act(() => result.current.login());

    expect(login).toHaveBeenCalledWith({ redirectUri: 'https://itsps.org/account/khpc' });
  });
});
