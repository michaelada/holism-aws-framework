import { ThemeProvider, CssBaseline, createTheme } from '@mui/material';
import { BrowserRouter } from 'react-router-dom';
import { useMemo } from 'react';
import { AuthProvider, useAuth, ApiProvider, NotificationProvider } from './context';
import { AppRoutes } from './routes';
import { Layout, ErrorBoundary } from './components';
import { neumorphicTheme } from './theme';

const customTheme = createTheme({
  ...neumorphicTheme,
});

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
    <ThemeProvider theme={customTheme}>
      <CssBaseline />
      <BrowserRouter>
        <AuthProvider keycloakConfig={keycloakConfig}>
          <AppContent />
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;
