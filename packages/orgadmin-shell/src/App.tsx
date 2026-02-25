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
import { OnboardingProvider } from './context';

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
  const [i18nInitialized, setI18nInitialized] = useState(false);
  
  const keycloakConfig = {
    url: import.meta.env.VITE_KEYCLOAK_URL || 'http://localhost:8080',
    realm: import.meta.env.VITE_KEYCLOAK_REALM || 'aws-web-framework',
    clientId: import.meta.env.VITE_KEYCLOAK_CLIENT_ID || 'orgadmin-client',
  };

  const { loading, error, authenticated, user, organisation, capabilities, isOrgAdmin, logout, getToken } = useAuth(keycloakConfig);

  // Extract organization locale from organization data
  const organizationLocale = useMemo(() => {
    // Don't return a locale until we have organization data
    if (!organisation) {
      return null;
    }
    
    // Use the organization's language setting directly
    if ((organisation as any).language) {
      console.log('Organization language found:', (organisation as any).language);
      return (organisation as any).language;
    }
    // Check if organization has organizationType with defaultLocale as fallback
    if ((organisation as any).organizationType?.defaultLocale) {
      console.log('Using organizationType defaultLocale:', (organisation as any).organizationType.defaultLocale);
      return (organisation as any).organizationType.defaultLocale;
    }
    // Fallback to 'en-GB' if neither is available
    console.log('Falling back to en-GB, organization data:', organisation);
    return 'en-GB';
  }, [organisation]);

  // Initialize i18n with the organization's locale - MUST complete before rendering LocaleProvider
  useEffect(() => {
    const initI18n = async () => {
      try {
        // Initialize i18n with the organization's locale
        console.log('Initializing i18n with locale:', organizationLocale);
        await initializeI18n(organizationLocale);
        setI18nReady(true);
        setI18nInitialized(true);
      } catch (error) {
        console.error('Failed to initialize i18n:', error);
        // App will continue with fallback behavior
        setI18nReady(true); // Set to true anyway to allow app to render
        setI18nInitialized(true);
      }
    };
    
    // Only initialize once when we have the organization locale
    if (organizationLocale && !i18nInitialized) {
      initI18n();
    }
  }, [organizationLocale, i18nInitialized]);

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
  // Also wait for organization data before initializing i18n
  if (loading || !i18nReady || (authenticated && !organisation)) {
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
      <LocaleProvider organizationLocale={organizationLocale || 'en-GB'}>
        <AuthTokenContext.Provider value={getToken}>
          <OrganisationProvider organisation={organisation}>
            <OnboardingProvider>
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
            </OnboardingProvider>
          </OrganisationProvider>
        </AuthTokenContext.Provider>
      </LocaleProvider>
    </BrowserRouter>
  );
};

export default App;
