/**
 * Memberships Module (Membership Management)
 * 
 * Capability module that provides membership management functionality.
 * Only visible if organisation has 'memberships' capability enabled.
 * 
 * Features:
 * - Single and group membership type management
 * - Members database with advanced filtering
 * - Batch operations (mark processed, add/remove labels)
 * - Custom filter sets for member searches
 * - Excel export for member data
 * - Rolling and fixed-period memberships
 * - Application form integration
 * - Payment method configuration
 * - Terms and conditions support
 * - Automatic status updates for expired memberships
 */

import { lazy } from 'react';
import { People as MembershipIcon } from '@mui/icons-material';
import type { ModuleRegistration } from './types/module.types';

export const membershipsModule: ModuleRegistration = {
  id: 'memberships',
  name: 'modules.memberships.name',
  title: 'modules.memberships.title',
  description: 'modules.memberships.description',
  capability: 'memberships', // Requires memberships capability
  order: 11, // After events module
  card: {
    title: 'modules.memberships.title',
    description: 'modules.memberships.description',
    icon: MembershipIcon,
    color: '#ff9966',
    path: '/members',
  },
  routes: [
    {
      path: '/members',
      component: lazy(() => import('./pages/MembersDatabasePage')),
    },
    {
      path: '/members/types',
      component: lazy(() => import('./pages/MembershipTypesListPage')),
    },
    {
      path: '/members/types/new/single',
      component: lazy(() => import('./pages/CreateSingleMembershipTypePage')),
    },
    {
      path: '/members/types/new/group',
      component: lazy(() => import('./pages/CreateGroupMembershipTypePage')),
    },
    {
      path: '/members/types/:id',
      component: lazy(() => import('./pages/MembershipTypeDetailsPage')),
    },
    {
      path: '/members/types/:id/edit',
      component: lazy(() => import('./pages/CreateSingleMembershipTypePage')),
    },
    {
      path: '/members/:id',
      component: lazy(() => import('./pages/MemberDetailsPage')),
    },
  ],
  menuItem: {
    label: 'modules.memberships.name',
    path: '/members',
    icon: MembershipIcon,
  },
};

// Export pages for direct use if needed
export { default as MembershipTypesListPage } from './pages/MembershipTypesListPage';
export { default as CreateSingleMembershipTypePage } from './pages/CreateSingleMembershipTypePage';
export { default as CreateGroupMembershipTypePage } from './pages/CreateGroupMembershipTypePage';
export { default as MembershipTypeDetailsPage } from './pages/MembershipTypeDetailsPage';
export { default as MembersDatabasePage } from './pages/MembersDatabasePage';
export { default as MemberDetailsPage } from './pages/MemberDetailsPage';

// Export components
export { default as MembershipTypeForm } from './components/MembershipTypeForm';
export { default as FieldConfigurationTable } from './components/FieldConfigurationTable';
export { default as PersonConfigurationSection } from './components/PersonConfigurationSection';
export { default as CreateCustomFilterDialog } from './components/CreateCustomFilterDialog';
export { default as BatchOperationsDialog } from './components/BatchOperationsDialog';

// Export types
export * from './types/membership.types';
export * from './types/module.types';

export const ORGADMIN_MEMBERSHIPS_VERSION = '1.0.0';
