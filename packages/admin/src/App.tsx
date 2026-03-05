import { ThemeProvider, CssBaseline } from '@mui/material';
import { BrowserRouter } from 'react-router-dom';
import { useMemo, useEffect } from 'react';
import { AuthProvider, useAuth, ApiProvider, NotificationProvider } from './context';
import { AppRoutes } from './routes';
import { Layout, ErrorBoundary } from './components';
import { defaultTheme } from './theme';

function AppContent() {
  const { logout, userName } = useAuth();

  // Clean up any stuck MUI backdrops on mount
  useEffect(() => {
    const cleanupBackdrops = () => {
      const backdrops = document.querySelectorAll('.MuiBackdrop-root');
      backdrops.forEach(backdrop => {
        // Only remove backdrops that are not currently associated with an open dialog
        const parentDialog = backdrop.closest('[role="dialog"]');
        if (!parentDialog) {
          console.log('Removing orphaned backdrop');
          backdrop.remove();
        }
      });
    };

    // Clean up immediately on mount
    cleanupBackdrops();

    // Also clean up after a short delay to catch any late-rendering backdrops
    const timeoutId = setTimeout(cleanupBackdrops, 100);

    return () => clearTimeout(timeoutId);
  }, []);

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
      <BrowserRouter>
        <AuthProvider keycloakConfig={keycloakConfig}>
          <AppContent />
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;
