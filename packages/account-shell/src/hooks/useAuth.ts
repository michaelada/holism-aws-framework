import { useState, useEffect, useCallback, useRef } from 'react';
import Keycloak from 'keycloak-js';
import { reportSignOut } from '@aws-web-framework/components';
import { forgetResponses } from '../offline/responseCache';

export interface AccountUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
}

export interface UseAuthReturn {
  keycloak: Keycloak | null;
  authenticated: boolean;
  /** True until the initial SSO check settles. Nothing should route on auth before this clears. */
  loading: boolean;
  error: string | null;
  token: string | null;
  user: AccountUser | null;
  /** Send the user to Keycloak. `orgCode` brands the login page and is returned to afterwards. */
  login: (orgCode?: string) => void;
  /**
   * Sign in as somebody else, discarding the current session first.
   *
   * Distinct from `login` because an ordinary `login()` is a no-op for a member
   * who is already signed in: Keycloak holds a realm session cookie and
   * answers immediately as whoever that is, without ever drawing a form.
   */
  signInAsSomeoneElse: (orgCode?: string) => void;
  register: (orgCode?: string) => void;
  logout: () => void;
  getToken: () => string | null;
}

export interface KeycloakConfig {
  url: string;
  realm: string;
  clientId: string;
}

/**
 * Where the app lives, with its trailing slash.
 *
 * Taken from the build's own `base` rather than written out, so a deployment
 * that moves the app cannot leave a hard-coded `/account` behind. `BASE_URL` is
 * `/account/` here and `/` in a root-mounted build; both already end in a slash,
 * and the guard covers a build that does not.
 */
const ACCOUNT_ROOT = import.meta.env.BASE_URL.endsWith('/')
  ? import.meta.env.BASE_URL
  : `${import.meta.env.BASE_URL}/`;

/**
 * Keycloak for the account-user application.
 *
 * **This differs from the org-admin shell's hook in one decisive way**, and the
 * difference is the reason it is a separate hook rather than a shared one: the
 * org-admin shell initialises with `onLoad: 'login-required'`, because every one
 * of its screens is behind a login. Here the directory (A1) and the organisation
 * gateway (A2) are public and must render for a signed-out visitor. Forcing
 * login on load would bounce every anonymous visitor to Keycloak and make the
 * public directory unreachable.
 *
 * So this initialises with `check-sso`: it establishes a session if one already
 * exists and otherwise returns quietly, leaving the visitor anonymous. Sign-in
 * becomes an explicit act — `login()` — triggered by A2's button. That is also
 * what satisfies the brief's "if the person was previously logged in, they will
 * be brought to the specific page": the silent check resolves the session before
 * the router decides what to draw.
 *
 * The token is realm-wide, which is what makes switching organisations (A7) a
 * context change rather than a re-authentication.
 */
export const useAuth = (keycloakConfig: KeycloakConfig): UseAuthReturn => {
  const [keycloak, setKeycloak] = useState<Keycloak | null>(null);
  const [authenticated, setAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<AccountUser | null>(null);

  const isInitialising = useRef(false);
  const isInitialised = useRef(false);

  const authDisabled = import.meta.env.VITE_DISABLE_AUTH === 'true';

  useEffect(() => {
    if (authDisabled) {
      console.warn('Authentication is disabled for development');
      setAuthenticated(true);
      setUser({
        id: 'dev-account-user',
        email: 'member@example.com',
        firstName: 'Dev',
        lastName: 'Member',
      });
      setLoading(false);
      return;
    }

    // React 18 StrictMode mounts effects twice in development; Keycloak's init
    // is not idempotent and a second call rejects.
    if (isInitialising.current || isInitialised.current) return;
    isInitialising.current = true;

    const kc = new Keycloak(keycloakConfig);

    kc.init({
      // See the note above — not 'login-required'.
      onLoad: 'check-sso',
      pkceMethod: 'S256',
      checkLoginIframe: false,
    })
      .then((auth) => {
        isInitialised.current = true;
        isInitialising.current = false;

        setKeycloak(kc);
        setAuthenticated(auth);
        setToken(kc.token || null);

        if (auth) {
          const claims = (kc.tokenParsed || {}) as Record<string, string>;
          setUser({
            id: claims.sub || '',
            email: claims.email || '',
            firstName: claims.given_name || '',
            lastName: claims.family_name || '',
          });
        }

        setLoading(false);
      })
      .catch((err) => {
        isInitialising.current = false;
        // A failed SSO check must not block the public screens — the visitor is
        // simply anonymous. Only the error text is recorded.
        console.error('Keycloak initialisation failed', err);
        setError(err?.message || 'Failed to initialise authentication');
        setAuthenticated(false);
        setLoading(false);
      });
  }, [authDisabled, keycloakConfig.url, keycloakConfig.realm, keycloakConfig.clientId]);

  /** Keeps the token fresh once a session exists. */
  useEffect(() => {
    if (!keycloak || !authenticated) return;

    const interval = setInterval(() => {
      keycloak
        .updateToken(70)
        .then((refreshed) => {
          if (refreshed) setToken(keycloak.token || null);
        })
        .catch(() => {
          // The refresh token has expired. Drop to anonymous rather than
          // leaving a dead token in place that every request would 401 on.
          setAuthenticated(false);
          setToken(null);
        });
    }, 60000);

    return () => clearInterval(interval);
  }, [keycloak, authenticated]);

  /**
   * `kc_locale` and the org code brand Keycloak's own login page (A3) — one
   * realm, one credential set, branding as a theme parameter rather than a
   * separate realm per club.
   */
  const redirectFor = (orgCode?: string) => {
    if (!orgCode) return window.location.href;

    const clubRoot = `${ACCOUNT_ROOT}${orgCode}`;

    /*
     * Come back to where they were, not to the club's front door.
     *
     * This used to return the club root unconditionally, which quietly
     * discarded every deep link. A visitor arriving from a public event page —
     * or from any shared link — signed in successfully and landed on the home
     * page, with no sign of the thing they had clicked. On a page whose whole
     * purpose is "click this event to enter it", that is the feature failing at
     * its last step.
     *
     * Only when the current path is already inside this club's routes: signing
     * in *to* Kildare from Laois's page must not return to Laois.
     */
    const here = window.location.pathname;
    const inThisClub = here === clubRoot || here.startsWith(`${clubRoot}/`);

    return inThisClub
      ? `${window.location.origin}${here}${window.location.search}`
      : `${window.location.origin}${clubRoot}`;
  };

  const login = useCallback(
    (orgCode?: string) => {
      keycloak?.login({ redirectUri: redirectFor(orgCode) });
    },
    [keycloak]
  );

  /**
   * Hand the session to a different member.
   *
   * `prompt: 'login'` is the entire point. Keycloak's session lives in a cookie
   * for the whole realm, so a member who signs out of one club and opens
   * another is still authenticated as themselves — an ordinary `login()` there
   * round-trips to Keycloak and back with no form shown, and the application
   * reports that they are not a member of the club they just tried to join.
   * The effect is a portal that appears to refuse a valid sign-in while
   * offering to enrol the wrong person.
   *
   * Asking Keycloak to re-authenticate makes "sign in as someone else" mean
   * what it says, whatever session already exists.
   *
   * The cached responses go first, for the same reason they do on sign-out: a
   * shared club device must not carry one member's entries into the next
   * member's session.
   */
  const signInAsSomeoneElse = useCallback(
    (orgCode?: string) => {
      forgetResponses();
      keycloak?.login({ redirectUri: redirectFor(orgCode), prompt: 'login' });
    },
    [keycloak]
  );

  const register = useCallback(
    (orgCode?: string) => {
      keycloak?.register({ redirectUri: redirectFor(orgCode) });
    },
    [keycloak]
  );

  const logout = useCallback(() => {
    /*
     * Everything cached for reading offline goes with the session, and for
     * everyone rather than only this identity: a club device passed to the next
     * member must not show the last one's payments or entries. This is a
     * privacy rule, not a caching one, so it runs before the redirect and does
     * not depend on knowing who was signed in.
     */
    forgetResponses();

    /*
     * The trailing slash is not cosmetic.
     *
     * The app is served under a base of `/account/`, and `/account` without it
     * is a different path. Vite's dev server answers it with "The server is
     * configured with a public base URL of /account/ — did you mean to visit
     * /account/ instead?", so signing out landed on a developer error message
     * rather than on the sign-in page.
     *
     * `redirectFor` above has always included it, which is why signing *in*
     * worked and only signing out did not.
     */
    if (authDisabled) {
      window.location.href = ACCOUNT_ROOT;
      return;
    }

    // Reported before the redirect — the server never sees the request that
    // ends the session. See reportSignOut.
    reportSignOut({ token: keycloak?.token, application: 'account-app' });

    keycloak?.logout({ redirectUri: `${window.location.origin}${ACCOUNT_ROOT}` });
  }, [keycloak, authDisabled]);

  const getToken = useCallback(() => keycloak?.token || null, [keycloak]);

  return {
    keycloak,
    authenticated,
    loading,
    error,
    token,
    user,
    login,
    register,
    signInAsSomeoneElse,
    logout,
    getToken,
  };
};
