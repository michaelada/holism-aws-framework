import React, { createContext, useContext, useMemo } from 'react';
import { useAuth, UseAuthReturn, KeycloakConfig } from '../hooks/useAuth';

/**
 * Holds the single `useAuth` instance for the application.
 *
 * `useAuth` initialises Keycloak, which must happen exactly once — calling the
 * hook from several components would start several inits and the later ones
 * reject. Everything therefore reads the session from here.
 */
/*
 * Exported so a test can supply a session directly. `AuthProvider` calls
 * `useAuth`, which initialises Keycloak — not something a page test can or
 * should do, and the alternative is mocking this module in every suite that
 * renders a page reading the session.
 */
export const AuthContext = createContext<UseAuthReturn | null>(null);

export const AuthProvider: React.FC<{
  keycloakConfig: KeycloakConfig;
  children: React.ReactNode;
}> = ({ keycloakConfig, children }) => {
  // Frozen deliberately: `useAuth`'s init effect depends on these fields, so a
  // caller passing a fresh object literal each render would re-init Keycloak on
  // every render (CLAUDE.md §3.4 — stable references).
  const config = useMemo(
    () => keycloakConfig,
    [keycloakConfig.url, keycloakConfig.realm, keycloakConfig.clientId]
  );

  const auth = useAuth(config);

  return <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>;
};

export const useAuthContext = (): UseAuthReturn => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuthContext must be used within an AuthProvider');
  }
  return context;
};
