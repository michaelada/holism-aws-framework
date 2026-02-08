import { ThemeProvider, createTheme, CssBaseline } from '@mui/material';
import { BrowserRouter } from 'react-router-dom';
import { ApiProvider, AuthProvider, NotificationProvider, useAuth } from './context';
import { AppRoutes } from './routes';
import { Layout, ErrorBoundary } from './components';

const theme = createTheme();

// Get environment variables
const apiBaseURL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

const keycloakConfig = {
  url: import.meta.env.VITE_KEYCLOAK_URL || 'http://localhost:8080',
  realm: import.meta.env.VITE_KEYCLOAK_REALM || 'aws-framework',
  clientId: import.meta.env.VITE_KEYCLOAK_CLIENT_ID || 'aws-framework-frontend',
};

function AppContent() {
  const { getToken, logout, userName } = useAuth();

  return (
    <ApiProvider
      baseURL={apiBaseURL}
      getToken={getToken}
      onUnauthorized={() => {
        console.error('Unauthorized - token may be invalid');
        logout();
      }}
    >
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
  return (
    <ThemeProvider theme={theme}>
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
