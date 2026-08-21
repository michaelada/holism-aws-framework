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

/** A location stub carrying everything `redirectFor` reads. */
const setLocation = (pathname: string, search = '') => {
  Object.defineProperty(window, 'location', {
    value: {
      origin: 'https://itsps.org',
      pathname,
      search,
      href: `https://itsps.org${pathname}${search}`,
    },
    writable: true,
  });
};

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
  setLocation('/account/khpc');
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

/**
 * Signing in from a deep link.
 *
 * The redirect used to be the club's front door unconditionally, which silently
 * discarded every deep link: a visitor who clicked an event on a public page
 * signed in and landed on the home page with no trace of what they had clicked.
 * On a feature whose whole promise is "click this event to enter it", that is
 * the last step failing.
 *
 * See docs/PUBLIC_EVENTS.md §5.3.
 */
describe('returning to where the visitor was', () => {
  it('comes back to the page they were on', async () => {
    setLocation('/account/khpc/browse/events', '?event=abc123');
    const { result } = await setup();

    act(() => result.current.login('khpc'));

    expect(login).toHaveBeenCalledWith({
      redirectUri: 'https://itsps.org/account/khpc/browse/events?event=abc123',
    });
  });

  it('keeps the query string, which is what names the event', async () => {
    // Losing `?event=` returns them to an events list of eighteen collapsed
    // rows with no indication which one they came for.
    setLocation('/account/khpc/browse/events', '?event=abc123');
    const { result } = await setup();

    act(() => result.current.login('khpc'));

    const [{ redirectUri }] = login.mock.calls[0];
    expect(redirectUri).toContain('?event=abc123');
  });

  it('does not return to another club’s page', async () => {
    /*
     * Signing in *to* Kildare while standing on Laois's public page. Returning
     * to Laois would sign them in and immediately show them somewhere else.
     */
    setLocation('/account/lhpc/whats-on/some-event-a1b2c3d4');
    const { result } = await setup();

    act(() => result.current.login('khpc'));

    expect(login).toHaveBeenCalledWith({ redirectUri: 'https://itsps.org/account/khpc' });
  });

  it('is not fooled by a club code that merely starts the same', async () => {
    // `/account/khpc-old` is not inside `/account/khpc`.
    setLocation('/account/khpc-old/whats-on');
    const { result } = await setup();

    act(() => result.current.login('khpc'));

    expect(login).toHaveBeenCalledWith({ redirectUri: 'https://itsps.org/account/khpc' });
  });
});
