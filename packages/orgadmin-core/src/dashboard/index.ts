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
  name: 'Dashboard',
  title: 'Dashboard',
  description: 'View high-level metrics and overview of your organisation',
  capability: undefined, // Core module - always available
  order: 1, // First in menu
  card: {
    title: 'Dashboard',
    description: 'View high-level metrics and overview of your organisation',
    icon: DashboardIcon,
    color: '#1976d2',
    path: '/dashboard',
  },
  routes: [
    {
      path: 'dashboard',
      component: lazy(() => import('./pages/DashboardPage')),
    },
  ],
  menuItem: {
    label: 'Dashboard',
    path: '/dashboard',
    icon: DashboardIcon,
  },
};

// Export pages for direct use if needed
export { default as DashboardPage } from './pages/DashboardPage';
