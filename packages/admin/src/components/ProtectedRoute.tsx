import React from 'react';
import { Box, CircularProgress, Typography } from '@mui/material';
import { useAuth } from '../context';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

/**
 * ProtectedRoute component that ensures users are authenticated and authorized
 * before accessing admin routes.
 * 
 * Authentication: Keycloak handles redirect to login via 'login-required' mode
 * Authorization: Checks for admin role, shows access denied if missing
 */
export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { authenticated, loading, isAdmin } = useAuth();

  // Show loading state while authentication is being checked
  if (loading) {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '60vh',
        }}
      >
        <CircularProgress />
        <Typography variant="body1" sx={{ mt: 2 }}>
          Loading...
        </Typography>
      </Box>
    );
  }

  // If not authenticated, show redirecting message
  // (Keycloak should handle the actual redirect via login-required)
  if (!authenticated) {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '60vh',
        }}
      >
        <Typography variant="body1">
          Redirecting to login...
        </Typography>
      </Box>
    );
  }

  // If authenticated but not an admin, this is handled by AuthProvider
  // but we add an extra check here for route-level protection
  if (!isAdmin) {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '60vh',
        }}
      >
        <Typography variant="h5" color="error" sx={{ mb: 2 }}>
          Access Denied
        </Typography>
        <Typography variant="body1">
          You do not have permission to access this page.
        </Typography>
      </Box>
    );
  }

  // User is authenticated and authorized
  return <>{children}</>;
}
