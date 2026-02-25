/**
 * Users Module
 * 
 * Core module that provides user management functionality for managing
 * both org admin users and account users.
 * Always available to all organisation administrators
 */

import { lazy } from 'react';
import { People as UsersIcon } from '@mui/icons-material';
import type { ModuleRegistration } from '../types/module.types';

export const usersModule: ModuleRegistration = {
  id: 'users',
  name: 'modules.users.name',
  title: 'modules.users.title',
  description: 'modules.users.description',
  capability: undefined, // Core module - always available
  order: 7, // After Dashboard, Forms, Settings, Payments, Reporting
  card: {
    title: 'modules.users.title',
    description: 'modules.users.description',
    icon: UsersIcon,
    color: '#7b1fa2',
    path: '/users',
  },
  routes: [
    {
      path: 'users',
      component: lazy(() => import('./pages/OrgAdminUsersListPage')),
    },
    {
      path: 'users/admins',
      component: lazy(() => import('./pages/OrgAdminUsersListPage')),
    },
    {
      path: 'users/admins/invite',
      component: lazy(() => import('./pages/InviteAdminUserPage')),
    },
    {
      path: 'users/accounts',
      component: lazy(() => import('./pages/AccountUsersListPage')),
    },
    {
      path: 'users/accounts/create',
      component: lazy(() => import('./pages/CreateAccountUserPage')),
    },
    {
      path: 'users/:type/:id',
      component: lazy(() => import('./pages/UserDetailsPage')),
    },
  ],
  menuItem: {
    label: 'modules.users.name',
    path: '/users',
    icon: UsersIcon,
  },
};

// Export pages for direct use if needed
export { default as OrgAdminUsersListPage } from './pages/OrgAdminUsersListPage';
export { default as AccountUsersListPage } from './pages/AccountUsersListPage';
export { default as UserDetailsPage } from './pages/UserDetailsPage';
export { default as InviteAdminUserPage } from './pages/InviteAdminUserPage';
export { default as CreateAccountUserPage } from './pages/CreateAccountUserPage';
