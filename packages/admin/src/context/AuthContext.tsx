import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import Keycloak from 'keycloak-js';

interface AuthContextValue {
  keycloak: Keycloak | null;
  authenticated: boolean;
  loading: boolean;
  token: string | null;
  userName: string | null;
  isAdmin: boolean;
  login: () => void;
  logout: () => void;
  getToken: () => string | null;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

interface AuthProviderProps {
  children: React.ReactNode;
  keycloakConfig: {
    url: string;
    realm: string;
    clientId: string;
  };
}

export function AuthProvider({ children, keycloakConfig }: AuthProviderProps) {
  const [keycloak, setKeycloak] = useState<Keycloak | null>(null);
  const [authenticated, setAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Use ref to track if initialization has started to prevent double initialization
  const isInitializing = useRef(false);
  const isInitialized = useRef(false);

  // Check if auth is disabled for development
  const authDisabled = import.meta.env.VITE_DISABLE_AUTH === 'true';

  useEffect(() => {
    // Skip Keycloak initialization if auth is disabled
    if (authDisabled) {
      console.warn('Authentication is disabled for development');
      setAuthenticated(true);
      setLoading(false);
      setUserName('dev-admin');
      setIsAdmin(true);
      return;
    }

    // Prevent multiple initializations
    if (isInitializing.current || isInitialized.current) {
      console.log('Keycloak initialization already in progress or completed, skipping...');
      return;
    }

    isInitializing.current = true;
    console.log('Initializing Keycloak for Admin Portal...');
    
    const kc = new Keycloak({
      url: keycloakConfig.url,
      realm: keycloakConfig.realm,
      clientId: keycloakConfig.clientId,
    });

    kc.init({
      onLoad: 'login-required',
      pkceMethod: 'S256',
      checkLoginIframe: false, // Disable iframe to avoid 3rd party cookie issues
      enableLogging: true
    })
      .then((auth) => {
        console.log('Keycloak initialized. Authenticated:', auth);
        isInitialized.current = true;
        isInitializing.current = false;
        
        setKeycloak(kc);
        setAuthenticated(auth);
        setToken(kc.token || null);
        setUserName(kc.tokenParsed?.preferred_username || null);
        
        // Check if user has admin role
        const hasAdminRole = kc.hasRealmRole('admin');
        setIsAdmin(hasAdminRole);
        
        if (!hasAdminRole) {
          console.warn('User does not have admin role');
        }
        
        setLoading(false);
        setError(null);

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
        }, 60000); // Check every minute

        // Cleanup interval on unmount
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
    keycloak?.logout();
  }, [keycloak]);

  const getToken = useCallback(() => {
    return keycloak?.token || null;
  }, [keycloak]);

  const value: AuthContextValue = {
    keycloak,
    authenticated,
    loading,
    token,
    userName,
    isAdmin,
    login,
    logout,
    getToken,
  };

  // Show loading state
  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        flexDirection: 'column',
        gap: '1rem'
      }}>
        <div>Loading authentication...</div>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        flexDirection: 'column',
        gap: '1rem',
        padding: '2rem'
      }}>
        <div style={{ color: '#d32f2f', fontWeight: 'bold' }}>Authentication Error</div>
        <div style={{ textAlign: 'center', maxWidth: '600px' }}>
          {error}
        </div>
        <div style={{ marginTop: '1rem', textAlign: 'center', fontSize: '0.9rem', color: '#666' }}>
          This usually means Keycloak is not configured or not running.
          <br />
          Check the console for more details.
        </div>
      </div>
    );
  }

  // Show access denied if user is authenticated but not an admin
  if (authenticated && !isAdmin) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        flexDirection: 'column',
        gap: '1rem',
        padding: '2rem'
      }}>
        <div style={{ color: '#d32f2f', fontWeight: 'bold', fontSize: '1.5rem' }}>
          Access Denied
        </div>
        <div style={{ textAlign: 'center', maxWidth: '600px' }}>
          You do not have permission to access the Admin Portal.
          <br />
          Please contact your system administrator if you believe this is an error.
        </div>
        <button
          onClick={logout}
          style={{
            marginTop: '1rem',
            padding: '0.5rem 1rem',
            fontSize: '1rem',
            cursor: 'pointer',
            backgroundColor: '#009087',
            color: '#fff',
            border: 'none',
            borderRadius: '0.5rem',
          }}
        >
          Logout
        </button>
      </div>
    );
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
