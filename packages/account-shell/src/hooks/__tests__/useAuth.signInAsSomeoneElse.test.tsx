/**
 * Signing in as a different member.
 *
 * There is one Keycloak realm and one identity behind every club, and its
 * session lives in a realm-wide cookie. A member who signs out of one club and
 * opens another is therefore still authenticated as themselves: an ordinary
 * `login()` round-trips to Keycloak and straight back, no form is ever drawn,
 * and the portal announces that they are not a member of the club they were
 * trying to reach — offering to enrol them under the identity they had just
 * left.
 *
 * `prompt: 'login'` is what makes the offer honest. It tells Keycloak to
 * re-authenticate regardless of the session it already holds, so the member
 * actually gets asked who they are.
 *
 * Asserted at this level because it is a single option on a redirect: nothing
 * downstream can observe it, and it is invisible in any test that stops at the
 * button.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

const login = vi.fn();
const logout = vi.fn();

const keycloakInstance = {
  init: vi.fn().mockResolvedValue(false),
  login,
  logout,
  register: vi.fn(),
  updateToken: vi.fn().mockResolvedValue(false),
  token: undefined,
  tokenParsed: undefined,
  authenticated: false,
};

vi.mock('keycloak-js', () => ({
  default: vi.fn(() => keycloakInstance),
}));

import { useAuth } from '../useAuth';

const CONFIG = {
  url: 'https://itsps.org/auth',
  realm: 'aws-framework',
  clientId: 'account-app',
};

/** The hook redirects the browser; jsdom must not be asked to follow it. */
const renderAuth = async () => {
  const rendered = renderHook(() => useAuth(CONFIG));
  await waitFor(() => expect(rendered.result.current.loading).toBe(false));
  return rendered;
};

describe('signInAsSomeoneElse', () => {
  beforeEach(() => {
    login.mockClear();
    logout.mockClear();
    window.localStorage.clear();
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  it('asks Keycloak to re-authenticate rather than reuse the session', async () => {
    const { result } = await renderAuth();

    act(() => result.current.signInAsSomeoneElse('lhpc'));

    expect(login).toHaveBeenCalledWith(
      expect.objectContaining({ prompt: 'login' })
    );
  });

  it('returns to the club the member was trying to open', async () => {
    const { result } = await renderAuth();

    act(() => result.current.signInAsSomeoneElse('lhpc'));

    expect(login).toHaveBeenCalledWith(
      expect.objectContaining({
        redirectUri: `${window.location.origin}/account/lhpc`,
      })
    );
  });

  it('leaves an ordinary sign-in alone, which must reuse an existing session', async () => {
    const { result } = await renderAuth();

    act(() => result.current.login('lhpc'));

    // A member arriving at their own club should not be asked to type a
    // password they have already typed.
    expect(login).toHaveBeenCalledWith(
      expect.not.objectContaining({ prompt: 'login' })
    );
  });

  it('discards cached responses before handing over, as sign-out does', async () => {
    // A club device passed between members must not carry one member's entries
    // into the next member's session. Switching identity is the same hazard as
    // signing out, and previously only sign-out cleared them.
    window.localStorage.setItem('account-cache:user-1:/api/account/entries', '{}');

    const { result } = await renderAuth();
    act(() => result.current.signInAsSomeoneElse('lhpc'));

    const leftBehind = Object.keys(window.localStorage).filter((key) =>
      key.startsWith('account-cache:')
    );
    expect(leftBehind).toEqual([]);
  });
});
