import { ThemeProvider, CssBaseline } from '@mui/material';
import { BrowserRouter } from 'react-router-dom';
import { useMemo } from 'react';
import { AuthProvider, useAuth, ApiProvider, NotificationProvider } from './context';
import { AppRoutes } from './routes';
import { Layout, ErrorBoundary } from './components';
import { defaultTheme } from './theme';

function AppContent() {
  const { logout, userName } = useAuth();

  return (
    <ApiProvider>
      <NotificationProvider>
        <Layout onLogout={logout} userName={userName || undefined}>
          <ErrorBoundary>
            <AppRoutes />
          </ErrorBoundary>
        </Layout>
      </NotificationProvider>
    </ApiProvider>
  );
}

function App() {
  // Memoize config objects to prevent unnecessary re-renders
  const keycloakConfig = useMemo(() => ({
    url: import.meta.env.VITE_KEYCLOAK_URL || 'http://localhost:8080',
    realm: import.meta.env.VITE_KEYCLOAK_REALM || 'aws-framework',
    clientId: import.meta.env.VITE_KEYCLOAK_CLIENT_ID || 'aws-framework-admin',
  }), []);

  return (
    <ThemeProvider theme={defaultTheme}>
      <CssBaseline />
      {/*
        `basename` from Vite's own `base`, so the app works wherever it is
        served from. In development that is `/` and nothing changes; a build
        made with `--base=/admin/` gets a router that agrees with it.

        Without this the app cannot be served under a path prefix at all —
        React Router would try to match `/admin/organizations` against a route
        declared as `/organizations`, and every link would 404.
      */}
      <BrowserRouter basename={import.meta.env.BASE_URL}>
        <AuthProvider keycloakConfig={keycloakConfig}>
          <AppContent />
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;
