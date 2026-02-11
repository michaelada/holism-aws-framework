import { ThemeProvider, CssBaseline, createTheme } from '@mui/material';
import { BrowserRouter } from 'react-router-dom';
import { useMemo } from 'react';
import { ApiProvider, AuthProvider, NotificationProvider, useAuth } from './context';
import { AppRoutes } from './routes';
import { Layout, ErrorBoundary } from './components';
import { neumorphicTheme } from './theme/neumorphicTheme';

const customTheme = createTheme({
  ...neumorphicTheme,
  // palette: {
  //   ...neumorphicTheme.palette,
  //   primary: {
  //     main: '#ff5722', // Override primary color
  //   },
  // },
  // components: {
  //   MuiInputLabel: {
  //     styleOverrides: {
  //       root: {
  //         formControl: {
  //       "label + &": {
  //         marginTop: "15px"
  //       }
  //     }
  //     }
  //   }
  // }
  // }
});

function AppContent() {
  const { getToken, logout, userName } = useAuth();

  // Memoize apiBaseURL to prevent unnecessary re-renders
  const apiBaseURL = useMemo(() => 
    import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000',
    []
  );

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
  // Memoize config objects to prevent unnecessary re-renders
  const keycloakConfig = useMemo(() => ({
    url: import.meta.env.VITE_KEYCLOAK_URL || 'http://localhost:8080',
    realm: import.meta.env.VITE_KEYCLOAK_REALM || 'aws-framework',
    clientId: import.meta.env.VITE_KEYCLOAK_CLIENT_ID || 'aws-framework-frontend',
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
