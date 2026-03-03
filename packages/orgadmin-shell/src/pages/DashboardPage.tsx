import React, { useEffect } from 'react';
import { Box, Typography, Grid } from '@mui/material';
import { useOrganisation } from '@aws-web-framework/orgadmin-core';
import { useCapabilities } from '../context/CapabilityContext';
import { DashboardCard } from '../components/DashboardCard';
import { useTranslation } from '../hooks/useTranslation';
import { ModuleRegistration } from '../types/module.types';
import { useOnboarding } from '../context/OnboardingContext';
import { usePageHelp } from '../hooks/usePageHelp';

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
  const { checkModuleVisit } = useOnboarding();

  // Register page for contextual help
  usePageHelp('overview');

  // Check module visit for onboarding
  useEffect(() => {
    checkModuleVisit('dashboard');
  }, [checkModuleVisit]);

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

  // Define custom ordering for modules
  const moduleOrder: Record<string, number> = {
    'events': 1,
    'memberships': 2,
    'registrations': 3,
    'merchandise': 4,
    'calendar': 5,
    'ticketing': 6,
    'forms': 7, // Form Builder after Event Ticketing
    'payments': 8,
    'users': 9,
    'settings': 10,
    'reports': 11,
  };

  // Sort modules by custom order, then by module.order for any not in the custom list
  const sortedModules = [...availableModules].sort((a, b) => {
    const orderA = moduleOrder[a.id] ?? (a.order || 999);
    const orderB = moduleOrder[b.id] ?? (b.order || 999);
    return orderA - orderB;
  });

  return (
    <Box sx={{ 
      p: 0,
      minHeight: '100vh',
      background: '#FAF8F5', // Warm background matching features page
    }}>
      {/* Welcome Message */}
      <Box sx={{ mb: 4, px: { xs: 2, sm: 3 }, pt: { xs: 2, sm: 3 } }}>
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
        <Box sx={{ px: { xs: 2, sm: 3 }, pb: { xs: 2, sm: 3 } }}>
          <Grid container spacing={3}>
            {sortedModules.map((module) => (
              <Grid item xs={12} sm={6} md={3} key={module.id}>
                <DashboardCard module={module} />
              </Grid>
            ))}
          </Grid>
        </Box>
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
