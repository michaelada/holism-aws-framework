/**
 * Settings Module
 * 
 * Core module that provides organisation settings management functionality.
 * Always available to all organisation administrators
 */

import { lazy } from 'react';
import { Settings as SettingsIcon } from '@mui/icons-material';
import type { ModuleRegistration } from '../types/module.types';

export const settingsModule: ModuleRegistration = {
  id: 'settings',
  name: 'Settings',
  title: 'Organisation Settings',
  description: 'Manage organisation details, payment settings, branding, and email templates',
  capability: undefined, // Core module - always available
  order: 3, // Third in menu after Dashboard and Forms
  card: {
    title: 'Organisation Settings',
    description: 'Manage organisation details, payment settings, branding, and email templates',
    icon: SettingsIcon,
    color: '#757575',
    path: '/settings',
  },
  routes: [
    {
      path: '/settings',
      component: lazy(() => import('./pages/SettingsPage')),
    },
  ],
  menuItem: {
    label: 'Settings',
    path: '/settings',
    icon: SettingsIcon,
  },
};

// Export pages for direct use if needed
export { default as SettingsPage } from './pages/SettingsPage';
