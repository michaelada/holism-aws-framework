import React from 'react';
import { Box, Typography, Grid } from '@mui/material';
import { useOrganisation } from '@aws-web-framework/orgadmin-core';
import { useCapabilities } from '../context/CapabilityContext';
import { DashboardCard } from '../components/DashboardCard';
import { ModuleRegistration } from '../types/module.types';

interface DashboardPageProps {
  modules: ModuleRegistration[];
}

/**
 * DashboardPage Component
 * 
 * Landing page that displays:
 * - Welcome message with organisation name
 * - Grid of DashboardCards for available modules
 * - Modules filtered based on enabled capabilities
 * - Cards sorted by module order
 * - Uses module.title and module.description from registrations
 * 
 * Requirements: 2.2.1, 2.2.4, 2.2.5, 2.2.6, 3.1.2
 */
export const DashboardPage: React.FC<DashboardPageProps> = ({ modules }) => {
  const { organisation } = useOrganisation();
  const { capabilities, hasCapability } = useCapabilities();

  // Filter modules based on enabled capabilities
  // Core modules (no capability requirement) are always shown
  const availableModules = modules.filter((module) => {
    if (!module.capability) {
      // Core module - always available
      return true;
    }
    // Capability module - check if organisation has the capability
    return hasCapability(module.capability);
  });

  // Sort modules by order (lower order = displayed first)
  const sortedModules = [...availableModules].sort(
    (a, b) => (a.order || 999) - (b.order || 999)
  );

  return (
    <Box sx={{ p: { xs: 2, sm: 3 } }}>
      {/* Welcome Message */}
      <Box sx={{ mb: 4 }}>
        <Typography
          variant="h4"
          gutterBottom
          sx={{
            fontWeight: 600,
            color: 'text.primary',
          }}
        >
          Welcome to {organisation?.displayName || 'ItsPlainSailing'}
        </Typography>
        <Typography
          variant="body1"
          color="text.secondary"
          paragraph
          sx={{ fontSize: '1.1rem' }}
        >
          Select an area below to get started
        </Typography>
      </Box>

      {/* Module Cards Grid */}
      {sortedModules.length > 0 ? (
        <Grid container spacing={3}>
          {sortedModules.map((module) => (
            <Grid item xs={12} sm={6} md={4} key={module.id}>
              <DashboardCard module={module} />
            </Grid>
          ))}
        </Grid>
      ) : (
        <Box
          sx={{
            textAlign: 'center',
            py: 8,
            px: 2,
          }}
        >
          <Typography variant="h6" color="text.secondary" gutterBottom>
            No modules available
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Contact your administrator to enable capabilities for your organisation.
          </Typography>
        </Box>
      )}

      {/* Debug Info (only in development) */}
      {import.meta.env.DEV && (
        <Box sx={{ mt: 4, p: 2, bgcolor: 'background.paper', borderRadius: 1 }}>
          <Typography variant="caption" color="text.secondary">
            Debug: {capabilities.length} capabilities enabled, {sortedModules.length} modules available
          </Typography>
        </Box>
      )}
    </Box>
  );
};
