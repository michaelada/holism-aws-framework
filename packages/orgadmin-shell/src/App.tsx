import React, { Suspense, useMemo, useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { CircularProgress, Box, Typography } from '@mui/material';
import { useAuth } from './hooks/useAuth';
import { CapabilityProvider } from './context/CapabilityContext';
import { 
  AuthTokenContext,
  OrganisationProvider,
} from '@aws-web-framework/orgadmin-core';
import { Layout } from './components/Layout';
import { DashboardPage } from './pages/DashboardPage';
import { ModuleRegistration } from './types/module.types';
import { initializeI18n } from './i18n/config';
import { LocaleProvider } from './context/LocaleContext';

// Import all core module registrations
import {
  dashboardModule,
  formsModule,
  settingsModule,
  paymentsModule,
  reportingModule,
  usersModule,
} from '@aws-web-framework/orgadmin-core';

// Import all capability module registrations
import { eventsModule } from '@aws-web-framework/orgadmin-events';
import { membershipsModule } from '@aws-web-framework/orgadmin-memberships';
import { merchandiseModule } from '@aws-web-framework/orgadmin-merchandise';
import { calendarModule } from '@aws-web-framework/orgadmin-calendar';
import { registrationsModule } from '@aws-web-framework/orgadmin-registrations';
import { ticketingModule } from '@aws-web-framework/orgadmin-ticketing';

// Import all module registrations here
const ALL_MODULES: ModuleRegistration[] = [
  // Core modules (always available)
  dashboardModule,
  formsModule,
  settingsModule,
  paymentsModule,
  reportingModule,
  usersModule,
  // Capability modules (filtered by organisation capabilities)
  eventsModule,
  membershipsModule,
  merchandiseModule,
  calendarModule,
  registrationsModule,
  ticketingModule,
];

/**
 * Loading screen component
 */
const LoadingScreen: React.FC = () => (
  <Box
    sx={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      height: '100vh',
      flexDirection: 'column',
      gap: 2,
    }}
  >
    <CircularProgress size={60} />
    <Typography variant="h6">Loading ItsPlainSailing...</Typography>
  </Box>
);

/**
 * Error screen component
 */
const ErrorScreen: React.FC<{ error: string; onLogout: () => void }> = ({ error, onLogout }) => (
  <Box
    sx={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      height: '100vh',
      flexDirection: 'column',
      gap: 2,
      padding: 4,
    }}
  >
    <Typography variant="h5" color="error" fontWeight="bold">
      Authentication Error
    </Typography>
    <Typography variant="body1" textAlign="center" maxWidth="600px">
      {error}
    </Typography>
    <button
      onClick={onLogout}
      style={{
        marginTop: '1rem',
        padding: '0.75rem 1.5rem',
        fontSize: '1rem',
        cursor: 'pointer',
        backgroundColor: '#009087',
        color: '#fff',
        border: 'none',
        borderRadius: '0.5rem',
      }}
    >
      Return to Login
    </button>
  </Box>
);

/**
 * Access denied screen component
 */
const AccessDeniedScreen: React.FC<{ onLogout: () => void }> = ({ onLogout }) => (
  <Box
    sx={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      height: '100vh',
      flexDirection: 'column',
      gap: 2,
      padding: 4,
    }}
  >
    <Typography variant="h4" color="error" fontWeight="bold">
      Access Denied
    </Typography>
    <Typography variant="body1" textAlign="center" maxWidth="600px">
      You do not have permission to access the Organisation Admin Portal.
      <br />
      Please contact your system administrator if you believe this is an error.
    </Typography>
    <button
      onClick={onLogout}
      style={{
        marginTop: '1rem',
        padding: '0.75rem 1.5rem',
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
  </Box>
);

/**
 * Not found page component
 */
const NotFoundPage: React.FC = () => (
  <Box sx={{ p: 4, textAlign: 'center' }}>
    <Typography variant="h4" gutterBottom>
      404 - Page Not Found
    </Typography>
    <Typography variant="body1">
      The page you are looking for does not exist.
    </Typography>
  </Box>
);

/**
 * Main App component for ItsPlainSailing Organisation Admin
 * 
 * Implements:
 * - Module registration and filtering based on capabilities
 * - BrowserRouter with /orgadmin basename
 * - OrganisationProvider and CapabilityProvider context
 * - Loading screen during authentication
 * - Dynamic route generation from module registrations
 */
const App: React.FC = () => {
  const [i18nReady, setI18nReady] = useState(false);
  
  const keycloakConfig = {
    url: import.meta.env.VITE_KEYCLOAK_URL || 'http://localhost:8080',
    realm: import.meta.env.VITE_KEYCLOAK_REALM || 'aws-web-framework',
    clientId: import.meta.env.VITE_KEYCLOAK_CLIENT_ID || 'orgadmin-client',
  };

  const { loading, error, authenticated, user, organisation, capabilities, isOrgAdmin, logout, getToken } = useAuth(keycloakConfig);

  // Initialize i18n on mount - MUST complete before rendering LocaleProvider
  useEffect(() => {
    const initI18n = async () => {
      try {
        await initializeI18n();
        setI18nReady(true);
      } catch (error) {
        console.error('Failed to initialize i18n:', error);
        // App will continue with fallback behavior
        setI18nReady(true); // Set to true anyway to allow app to render
      }
    };
    initI18n();
  }, []);

  // Extract organization locale from organization data
  const organizationLocale = useMemo(() => {
    // Check if organization has organizationType with defaultLocale
    if (organisation && (organisation as any).organizationType?.defaultLocale) {
      return (organisation as any).organizationType.defaultLocale;
    }
    // Fallback to 'en-GB' if not available
    return 'en-GB';
  }, [organisation]);

  // Filter modules based on user's capabilities
  const availableModules = useMemo(() => {
    return ALL_MODULES.filter(module => {
      // Core modules (no capability requirement) are always available
      if (!module.capability) {
        return true;
      }
      // Capability modules are only available if the organisation has the capability
      return capabilities.includes(module.capability);
    });
  }, [capabilities]);

  // Loading state - show loading screen while auth or i18n is loading
  if (loading || !i18nReady) {
    return <LoadingScreen />;
  }

  // Error state
  if (error) {
    return <ErrorScreen error={error} onLogout={logout} />;
  }

  // Access denied if not org admin
  if (authenticated && !isOrgAdmin) {
    return <AccessDeniedScreen onLogout={logout} />;
  }

  // Not authenticated
  if (!authenticated || !user || !organisation) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
        }}
      >
        <Typography variant="h6">Redirecting to login...</Typography>
      </Box>
    );
  }

  // Authenticated and authorized - render main application
  return (
    <BrowserRouter basename="/orgadmin">
      <LocaleProvider organizationLocale={organizationLocale}>
        <AuthTokenContext.Provider value={getToken}>
          <OrganisationProvider organisation={organisation}>
            <CapabilityProvider capabilities={capabilities}>
              <Layout modules={availableModules} onLogout={logout}>
                <Suspense fallback={<LoadingScreen />}>
                  <Routes>
                    {/* Dashboard (landing page) */}
                    <Route path="/" element={<DashboardPage modules={availableModules} />} />

                    {/* Dynamic routes from module registrations */}
                    {availableModules.flatMap(module =>
                      module.routes.map(route => (
                        <Route
                          key={route.path}
                          path={route.path}
                          element={<route.component />}
                        />
                      ))
                    )}

                    {/* 404 Not Found */}
                    <Route path="*" element={<NotFoundPage />} />
                  </Routes>
                </Suspense>
              </Layout>
            </CapabilityProvider>
          </OrganisationProvider>
        </AuthTokenContext.Provider>
      </LocaleProvider>
    </BrowserRouter>
  );
};

export default App;
