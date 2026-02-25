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
  name: 'modules.settings.name',
  title: 'modules.settings.title',
  description: 'modules.settings.description',
  capability: undefined, // Core module - always available
  order: 3, // Third in menu after Dashboard and Forms
  card: {
    title: 'modules.settings.title',
    description: 'modules.settings.description',
    icon: SettingsIcon,
    color: '#757575',
    path: '/settings',
  },
  routes: [
    {
      path: 'settings',
      component: lazy(() => import('./pages/SettingsPage')),
    },
  ],
  menuItem: {
    label: 'modules.settings.name',
    path: '/settings',
    icon: SettingsIcon,
  },
};

// Export pages for direct use if needed
export { default as SettingsPage } from './pages/SettingsPage';
