import { useState, useEffect, useCallback, useRef } from 'react';
import Keycloak from 'keycloak-js';
import axios from 'axios';
import { Organisation } from '@itsplainsailing/orgadmin-core';
import { reportSignOut } from '@itsplainsailing/components';

interface UseAuthReturn {
  keycloak: Keycloak | null;
  authenticated: boolean;
  loading: boolean;
  error: string | null;
  token: string | null;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    userName: string;
  } | null;
  organisation: Organisation | null;
  /**
   * Every organisation this administrator belongs to, name-ordered.
   *
   * One entry is the ordinary case and the shell renders no switcher for it —
   * which falls out of the data rather than out of a flag, so there is nothing
   * to configure and nothing to get wrong.
   */
  organisations: OrganisationSummary[];
  capabilities: string[];
  roles: Array<{ id: string; name: string; displayName: string }>;
  isOrgAdmin: boolean;
  login: () => void;
  logout: () => void;
  getToken: () => string | null;
  getOrganisationId: () => string | null;
  /** Work in a different organisation. Re-resolves everything that follows from it. */
  switchOrganisation: (organisationId: string) => Promise<void>;
}

export interface OrganisationSummary {
  id: string;
  displayName: string;
  urlCode: string;
  isCurrent: boolean;
}

/**
 * Where the administrator was last working, within this browser.
 *
 * The server remembers too, and its answer is the one that matters for a fresh
 * session on a new machine. This exists so a reload does not flicker through
 * the wrong club's branding and navigation while `/auth/me` is in flight.
 */
const CURRENT_ORG_KEY = 'orgadmin.currentOrganisationId';

interface KeycloakConfig {
  url: string;
  realm: string;
  clientId: string;
}

/**
 * useAuth hook
 * Handles Keycloak authentication and fetches user's organisation
 * 
 * Requirements:
 * - 2.1.1: User authenticates via Keycloak
 * - 2.1.2: System identifies user as organisation administrator
 * - 2.1.3: System loads user's organisation details
 * - 2.1.4: System fetches organisation's enabled capabilities
 * - 2.1.5: System fetches user's assigned roles and permissions
 * - 2.1.6: Non-admin users are denied access to orgadmin interface
 */
export const useAuth = (keycloakConfig: KeycloakConfig): UseAuthReturn => {
  const [keycloak, setKeycloak] = useState<Keycloak | null>(null);
  const [authenticated, setAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<UseAuthReturn['user']>(null);
  const [organisation, setOrganisation] = useState<Organisation | null>(null);
  const [capabilities, setCapabilities] = useState<string[]>([]);
  const [roles, setRoles] = useState<Array<{ id: string; name: string; displayName: string }>>([]);
  const [organisations, setOrganisations] = useState<OrganisationSummary[]>([]);
  const [isOrgAdmin, setIsOrgAdmin] = useState(false);

  /*
   * A ref as well as state, because `getOrganisationId` is handed to
   * `OrganisationIdContext` and read during API calls. A closure over state
   * would send whichever organisation was current when the callback was last
   * rebuilt, which is exactly the sort of stale value that acts on the wrong
   * club.
   */
  const currentOrganisationId = useRef<string | null>(
    typeof window !== 'undefined' ? window.localStorage.getItem(CURRENT_ORG_KEY) : null
  );

  const isInitializing = useRef(false);
  const isInitialized = useRef(false);

  // Check if auth is disabled for development
  const authDisabled = import.meta.env.VITE_DISABLE_AUTH === 'true';

  /** Keep the ref, the browser and the next request in step. */
  const rememberOrganisation = (organisationId: string | null) => {
    currentOrganisationId.current = organisationId;
    if (typeof window === 'undefined') return;
    if (organisationId) window.localStorage.setItem(CURRENT_ORG_KEY, organisationId);
    else window.localStorage.removeItem(CURRENT_ORG_KEY);
  };

  /**
   * Fetch user's organisation from backend
   */
  const fetchOrganisation = async (kc: Keycloak): Promise<void> => {
    try {
      const response = await axios.get('/api/orgadmin/auth/me', {
        baseURL: import.meta.env.VITE_API_BASE_URL,
        headers: {
          Authorization: `Bearer ${kc.token}`,
          /*
           * Which organisation to open on, when we already know. The server
           * ignores one naming a club they no longer administer and answers
           * with somewhere they can work — this endpoint says where you *can*
           * work, so a stale choice must not lock anybody out of the app.
           */
          ...(currentOrganisationId.current
            ? { 'X-Organisation-Id': currentOrganisationId.current }
            : {}),
        },
        withCredentials: true,
      });

      const {
        user: userData,
        organisation: orgData,
        organisations: orgList,
        capabilities: caps,
        roles: userRoles,
      } = response.data;

      setUser({
        id: userData.id,
        email: userData.email,
        firstName: userData.firstName,
        lastName: userData.lastName,
        userName: userData.userName || userData.email,
      });

      /*
       * Taken from the answer rather than from what we asked for. The server
       * decides, and a client that assumed its request was honoured would show
       * one club's name over another club's data the moment it was not.
       */
      rememberOrganisation(orgData?.id ?? null);

      setOrganisation(orgData);
      setOrganisations(
        orgList ?? (orgData ? [{ id: orgData.id, displayName: orgData.displayName, urlCode: '', isCurrent: true }] : [])
      );
      setCapabilities(caps || orgData.enabledCapabilities || []);
      setRoles(userRoles || []);
      setIsOrgAdmin(true);
    } catch (err: any) {
      console.error('Error fetching organisation:', err);
      
      // Extract error message from response if available
      let errorMessage = 'Failed to load organisation data';
      
      if (err.response?.status === 403) {
        // User is not an org admin or account is not active
        errorMessage = err.response.data?.message || 'You do not have permission to access the Organisation Admin Portal. Please contact your system administrator if you believe this is an error.';
      } else if (err.response?.data?.message) {
        errorMessage = err.response.data.message;
      } else if (err.message) {
        errorMessage = err.message;
      }
      
      throw new Error(errorMessage);
    }
  };

  useEffect(() => {
    // Skip Keycloak initialization if auth is disabled
    if (authDisabled) {
      console.warn('Authentication is disabled for development');
      setAuthenticated(true);
      setLoading(false);
      setUser({
        id: 'dev-user-1',
        email: 'dev@example.com',
        firstName: 'Dev',
        lastName: 'Admin',
        userName: 'dev-admin',
      });
      setOrganisation({
        id: 'd5a5a5ca-c4b4-436d-8981-627ab3556433',
        organizationTypeId: '00000000-0000-0000-0000-000000000002',
        keycloakGroupId: 'dev-group-1',
        name: 'athlone-swim-club',
        displayName: 'Athlone Swimming Club',
        status: 'active',
        currency: 'EUR',
        language: 'en',
        enabledCapabilities: ['event-management', 'memberships', 'merchandise', 'calendar', 'registrations', 'ticketing'],
        settings: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      setCapabilities(['event-management', 'memberships']);
      setRoles([{ id: 'dev-role-1', name: 'admin', displayName: 'Administrator' }]);
      setIsOrgAdmin(true);
      return;
    }

    // Prevent multiple initializations
    if (isInitializing.current || isInitialized.current) {
      return;
    }

    isInitializing.current = true;
    console.log('Initializing Keycloak for OrgAdmin Portal...');

    const kc = new Keycloak({
      url: keycloakConfig.url,
      realm: keycloakConfig.realm,
      clientId: keycloakConfig.clientId,
    });

    kc.init({
      onLoad: 'login-required',
      pkceMethod: 'S256',
      checkLoginIframe: false,
      enableLogging: true,
    })
      .then(async (auth) => {
        console.log('Keycloak initialized. Authenticated:', auth);
        isInitialized.current = true;
        isInitializing.current = false;

        setKeycloak(kc);
        setAuthenticated(auth);
        setToken(kc.token || null);

        if (auth) {
          try {
            // Fetch organisation and verify user is org-admin
            await fetchOrganisation(kc);
            setError(null);
            setLoading(false);
          } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to load organisation';
            console.error('Authentication error:', errorMessage);
            setError(errorMessage);
            setIsOrgAdmin(false);
            setLoading(false);
            // Don't throw - let the error be displayed by the ErrorScreen component
          }
        } else {
          setLoading(false);
        }

        // Setup token refresh
        const refreshInterval = setInterval(() => {
          kc.updateToken(70)
            .then((refreshed) => {
              if (refreshed) {
                console.log('Token refreshed');
                setToken(kc.token || null);
              }
            })
            .catch(() => {
              console.error('Failed to refresh token');
              clearInterval(refreshInterval);
            });
        }, 60000);

        return () => clearInterval(refreshInterval);
      })
      .catch((error) => {
        console.error('Keycloak initialization failed', error);
        isInitializing.current = false;
        setError(error.message || 'Failed to initialize authentication');
        setLoading(false);
      });
  }, [authDisabled, keycloakConfig.url, keycloakConfig.realm, keycloakConfig.clientId]);

  const login = useCallback(() => {
    keycloak?.login();
  }, [keycloak]);

  const logout = useCallback(() => {
    if (authDisabled) {
      // In dev mode with auth disabled, just reload the page
      window.location.href = '/';
    } else {
      // Reported before the redirect, because once Keycloak has the browser
      // the server never sees the end of this session. Fire-and-forget with
      // `keepalive` — signing out is never held up by the audit trail.
      reportSignOut({ token: keycloak?.token, application: 'orgadmin-client' });
      keycloak?.logout();
    }
  }, [keycloak, authDisabled]);

  const getToken = useCallback(() => {
    return keycloak?.token || null;
  }, [keycloak]);

  /*
   * Read from the ref, not from state, and deliberately stable.
   *
   * This is handed to `OrganisationIdContext` and called during API calls. A
   * callback that closed over state would send whichever organisation was
   * current when it was last rebuilt — and a request carrying a stale id is a
   * request that acts on the wrong club.
   */
  const getOrganisationId = useCallback(() => currentOrganisationId.current, []);

  /**
   * Work in a different organisation.
   *
   * Everything that follows from the organisation has to be re-resolved, not
   * just the name in the bar: capabilities decide which modules exist,
   * so the navigation itself differs between two clubs. `/auth/me` returns all
   * of it, so the switch is one request rather than a fan-out.
   *
   * The id is remembered *before* the fetch so the request carries it, and
   * corrected afterwards from what the server actually returned.
   */
  const switchOrganisation = useCallback(
    async (organisationId: string) => {
      if (!keycloak || organisationId === currentOrganisationId.current) return;

      const previous = currentOrganisationId.current;
      rememberOrganisation(organisationId);
      setLoading(true);

      try {
        await fetchOrganisation(keycloak);
      } catch (err) {
        // Put it back: a failed switch must not leave the shell claiming to be
        // in an organisation it never reached.
        rememberOrganisation(previous);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [keycloak]
  );

  return {
    keycloak,
    authenticated,
    loading,
    error,
    token,
    user,
    organisation,
    organisations,
    capabilities,
    roles,
    isOrgAdmin,
    login,
    logout,
    getToken,
    getOrganisationId,
    switchOrganisation,
  };
};
