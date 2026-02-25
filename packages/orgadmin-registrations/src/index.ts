/**
 * Registrations Module (Entity Registration Management)
 * 
 * Capability module that provides entity registration management functionality.
 * Only visible if organisation has 'registrations' capability enabled.
 * 
 * Features:
 * - Registration type management for entities (horses, boats, equipment, etc.)
 * - Registrations database with advanced filtering
 * - Batch operations (mark processed, add/remove labels)
 * - Custom filter sets for registration searches
 * - Excel export for registration data
 * - Rolling and fixed-period registrations
 * - Application form integration
 * - Payment method configuration
 * - Terms and conditions support
 * - Automatic status updates for expired registrations
 * 
 * Key Differences from Memberships:
 * - Registrations are for entities (things), not people
 * - Entity Name field identifies what is being registered
 * - No group registrations (each entity is registered individually)
 * - Simpler data model focused on entity tracking
 */

import { lazy } from 'react';
import { AppRegistration as RegistrationIcon } from '@mui/icons-material';
import type { ModuleRegistration } from './types/module.types';

export const registrationsModule: ModuleRegistration = {
  id: 'registrations',
  name: 'modules.registrations.name',
  title: 'modules.registrations.title',
  description: 'modules.registrations.description',
  capability: 'registrations', // Requires registrations capability
  order: 12, // After memberships module
  card: {
    title: 'modules.registrations.title',
    description: 'modules.registrations.description',
    icon: RegistrationIcon,
    color: '#1565c0',
    path: '/registrations',
  },
  routes: [
    {
      path: '/registrations',
      component: lazy(() => import('./pages/RegistrationsDatabasePage')),
    },
    {
      path: '/registrations/types',
      component: lazy(() => import('./pages/RegistrationTypesListPage')),
    },
    {
      path: '/registrations/types/new',
      component: lazy(() => import('./pages/CreateRegistrationTypePage')),
    },
    {
      path: '/registrations/types/:id',
      component: lazy(() => import('./pages/RegistrationTypeDetailsPage')),
    },
    {
      path: '/registrations/types/:id/edit',
      component: lazy(() => import('./pages/CreateRegistrationTypePage')),
    },
    {
      path: '/registrations/:id',
      component: lazy(() => import('./pages/RegistrationDetailsPage')),
    },
  ],
  menuItem: {
    label: 'modules.registrations.name',
    path: '/registrations',
    icon: RegistrationIcon,
  },
};

// Export pages for direct use if needed
export { default as RegistrationTypesListPage } from './pages/RegistrationTypesListPage';
export { default as CreateRegistrationTypePage } from './pages/CreateRegistrationTypePage';
export { default as RegistrationTypeDetailsPage } from './pages/RegistrationTypeDetailsPage';
export { default as RegistrationsDatabasePage } from './pages/RegistrationsDatabasePage';
export { default as RegistrationDetailsPage } from './pages/RegistrationDetailsPage';

// Export components
export { default as RegistrationTypeForm } from './components/RegistrationTypeForm';
export { default as CreateCustomFilterDialog } from './components/CreateCustomFilterDialog';
export { default as BatchOperationsDialog } from './components/BatchOperationsDialog';

// Export types
export * from './types/registration.types';
export * from './types/module.types';

export const ORGADMIN_REGISTRATIONS_VERSION = '1.0.0';
