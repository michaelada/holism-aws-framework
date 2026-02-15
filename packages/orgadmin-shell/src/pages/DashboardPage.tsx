import React from 'react';
import { Box, Typography, Grid } from '@mui/material';
import { useOrganisation } from '@aws-web-framework/orgadmin-core';
import { useCapabilities } from '../context/CapabilityContext';
import { DashboardCard } from '../components/DashboardCard';
import { useTranslation } from '../hooks/useTranslation';
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
  const { t } = useTranslation();

  // Filter modules based on enabled capabilities
  // Core modules (no capability requirement) are always shown
  // Exclude dashboard module from landing page cards
  const availableModules = modules.filter((module) => {
    // Exclude dashboard module from landing page
    if (module.id === 'dashboard') {
      return false;
    }
    
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
          {t('dashboard.welcomeTo', { organisationName: organisation?.displayName || 'ItsPlainSailing' })}
        </Typography>
        <Typography
          variant="body1"
          color="text.secondary"
          paragraph
          sx={{ fontSize: '1.1rem' }}
        >
          {t('dashboard.selectArea')}
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
            {t('dashboard.noModulesAvailable')}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t('dashboard.contactAdministrator')}
          </Typography>
        </Box>
      )}

      {/* Debug Info (only in development) */}
      {import.meta.env.DEV && (
        <Box sx={{ mt: 4, p: 2, bgcolor: 'background.paper', borderRadius: 1 }}>
          <Typography variant="caption" color="text.secondary">
            {t('dashboard.debugInfo', { capabilitiesCount: capabilities.length, modulesCount: sortedModules.length })}
          </Typography>
        </Box>
      )}
    </Box>
  );
};
