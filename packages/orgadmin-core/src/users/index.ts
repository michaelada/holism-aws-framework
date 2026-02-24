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
  name: 'Users',
  title: 'User Management',
  description: 'Manage admin users and account users for your organisation',
  capability: undefined, // Core module - always available
  order: 7, // After Dashboard, Forms, Settings, Payments, Reporting
  card: {
    title: 'User Management',
    description: 'Manage admin users and account users for your organisation',
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
    label: 'Users',
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
