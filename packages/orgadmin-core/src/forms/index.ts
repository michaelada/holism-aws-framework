/**
 * Forms Module (Form Builder)
 * 
 * Core module that provides form builder functionality for creating
 * application forms used across events, memberships, registrations, etc.
 * Always available to all organisation administrators
 */

import { lazy } from 'react';
import { Description as FormIcon } from '@mui/icons-material';
import type { ModuleRegistration } from '../types/module.types';

export const formsModule: ModuleRegistration = {
  id: 'forms',
  name: 'Forms',
  title: 'Form Builder',
  description: 'Create and manage application forms for events, memberships, and more',
  capability: undefined, // Core module - always available
  order: 2, // Second in menu after Dashboard
  card: {
    title: 'Form Builder',
    description: 'Create and manage application forms for events, memberships, and more',
    icon: FormIcon,
    color: '#2e7d32',
    path: '/forms',
  },
  routes: [
    {
      path: '/forms',
      component: lazy(() => import('./pages/FormsListPage')),
    },
    {
      path: '/forms/new',
      component: lazy(() => import('./pages/FormBuilderPage')),
    },
    {
      path: '/forms/:id/edit',
      component: lazy(() => import('./pages/FormBuilderPage')),
    },
    {
      path: '/forms/:id/preview',
      component: lazy(() => import('./pages/FormPreviewPage')),
    },
  ],
  menuItem: {
    label: 'Forms',
    path: '/forms',
    icon: FormIcon,
  },
};

// Export pages for direct use if needed
export { default as FormsListPage } from './pages/FormsListPage';
export { default as FormBuilderPage } from './pages/FormBuilderPage';
export { default as FormPreviewPage } from './pages/FormPreviewPage';
