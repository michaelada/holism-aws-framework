import React, { Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import { Box, CircularProgress, Typography } from '@mui/material';
import { DashboardPage } from '../pages/DashboardPage';
import { ModuleRegistration } from '../types/module.types';

interface ModuleLoaderProps {
  modules: ModuleRegistration[];
}

/**
 * LoadingScreen Component
 * Displays a loading indicator while modules are being lazy loaded
 */
const LoadingScreen: React.FC = () => (
  <Box
    sx={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '60vh',
      gap: 2,
    }}
  >
    <CircularProgress size={48} />
    <Typography variant="body1" color="text.secondary">
      Loading...
    </Typography>
  </Box>
);

/**
 * NotFoundPage Component
 * Displays a 404 error for unknown routes
 */
const NotFoundPage: React.FC = () => (
  <Box
    sx={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '60vh',
      textAlign: 'center',
      px: 2,
    }}
  >
    <Typography variant="h1" sx={{ fontSize: '6rem', fontWeight: 700, color: 'text.secondary' }}>
      404
    </Typography>
    <Typography variant="h5" gutterBottom sx={{ fontWeight: 600 }}>
      Page Not Found
    </Typography>
    <Typography variant="body1" color="text.secondary">
      The page you're looking for doesn't exist or you don't have access to it.
    </Typography>
  </Box>
);

/**
 * ModuleLoader Component
 * 
 * Handles:
 * - Dynamic route generation from module registrations
 * - Lazy loading of module components
 * - Suspense boundaries with loading indicators
 * - 404 handling for unknown routes
 * 
 * Requirements: 3.1.3
 */
export const ModuleLoader: React.FC<ModuleLoaderProps> = ({ modules }) => {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <Routes>
        {/* Dashboard Route */}
        <Route path="/" element={<DashboardPage modules={modules} />} />

        {/* Dynamic Module Routes */}
        {modules.flatMap((module) =>
          module.routes.map((route) => {
            // Remove /orgadmin prefix from route path since BrowserRouter has basename="/orgadmin"
            const routePath = route.path.replace('/orgadmin', '') || '/';
            const RouteComponent = route.component;

            return (
              <Route
                key={route.path}
                path={routePath}
                element={
                  <Suspense fallback={<LoadingScreen />}>
                    <RouteComponent />
                  </Suspense>
                }
              />
            );
          })
        )}

        {/* 404 Not Found Route */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  );
};
