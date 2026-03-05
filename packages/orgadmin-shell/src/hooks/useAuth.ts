import { useState, useEffect, useCallback, useRef } from 'react';
import Keycloak from 'keycloak-js';
import axios from 'axios';
import { Organisation } from '@aws-web-framework/orgadmin-core';

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
  capabilities: string[];
  roles: Array<{ id: string; name: string; displayName: string }>;
  isOrgAdmin: boolean;
  login: () => void;
  logout: () => void;
  getToken: () => string | null;
}

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
  const [isOrgAdmin, setIsOrgAdmin] = useState(false);

  const isInitializing = useRef(false);
  const isInitialized = useRef(false);

  // Check if auth is disabled for development
  const authDisabled = import.meta.env.VITE_DISABLE_AUTH === 'true';

  /**
   * Fetch user's organisation from backend
   */
  const fetchOrganisation = async (kc: Keycloak): Promise<void> => {
    try {
      const response = await axios.get('/api/orgadmin/auth/me', {
        baseURL: import.meta.env.VITE_API_BASE_URL,
        headers: {
          Authorization: `Bearer ${kc.token}`,
        },
        withCredentials: true,
      });

      const { user: userData, organisation: orgData, capabilities: caps, roles: userRoles } = response.data;

      setUser({
        id: userData.id,
        email: userData.email,
        firstName: userData.firstName,
        lastName: userData.lastName,
        userName: userData.userName || userData.email,
      });

      setOrganisation(orgData);
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
      keycloak?.logout();
    }
  }, [keycloak, authDisabled]);

  const getToken = useCallback(() => {
    return keycloak?.token || null;
  }, [keycloak]);

  return {
    keycloak,
    authenticated,
    loading,
    error,
    token,
    user,
    organisation,
    capabilities,
    roles,
    isOrgAdmin,
    login,
    logout,
    getToken,
  };
};
