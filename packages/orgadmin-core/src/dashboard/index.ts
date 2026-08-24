/**
 * Dashboard Module
 * 
 * Core module that provides high-level metrics and overview
 * Always available to all organisation administrators
 */

import { lazy } from 'react';
import { Dashboard as DashboardIcon } from '@mui/icons-material';
import type { ModuleRegistration } from '../types/module.types';

export const dashboardModule: ModuleRegistration = {
  id: 'dashboard',
  name: 'modules.dashboard.name',
  title: 'modules.dashboard.title',
  description: 'modules.dashboard.description',
  capability: undefined, // Core module - always available
  order: 1, // First in menu
  card: {
    title: 'modules.dashboard.title',
    description: 'modules.dashboard.description',
    icon: DashboardIcon,
    color: '#D24400', // the one accent; modules are told apart by their illustration
    path: '/dashboard',
  },
  routes: [
    {
      path: 'dashboard',
      component: lazy(() => import('./pages/DashboardPage')),
    },
  ],
  menuItem: {
    label: 'modules.dashboard.name',
    path: '/dashboard',
    icon: DashboardIcon,
  },
};

// Export pages for direct use if needed
export { default as DashboardPage } from './pages/DashboardPage';
