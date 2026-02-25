/**
 * Forms Module (Form Builder)
 * 
 * Core module that provides form builder functionality for creating
 * application forms and field definitions used across events, memberships, registrations, etc.
 * Always available to all organisation administrators
 */

import { lazy } from 'react';
import { Description as FormIcon, ViewList as FieldIcon } from '@mui/icons-material';
import type { ModuleRegistration } from '../types/module.types';

export const formsModule: ModuleRegistration = {
  id: 'forms',
  name: 'modules.forms.name',
  title: 'modules.forms.title',
  description: 'modules.forms.description',
  capability: undefined, // Core module - always available
  order: 2, // Second in menu after Dashboard
  card: {
    title: 'modules.forms.title',
    description: 'modules.forms.description',
    icon: FormIcon,
    color: '#2e7d32',
    path: '/forms',
  },
  routes: [
    {
      path: 'forms',
      component: lazy(() => import('./pages/FormsListPage')),
    },
    {
      path: 'forms/new',
      component: lazy(() => import('./pages/FormBuilderPage')),
    },
    {
      path: 'forms/:id/edit',
      component: lazy(() => import('./pages/FormBuilderPage')),
    },
    {
      path: 'forms/:id/preview',
      component: lazy(() => import('./pages/FormPreviewPage')),
    },
    {
      path: 'forms/fields',
      component: lazy(() => import('./pages/FieldsListPage')),
    },
    {
      path: 'forms/fields/new',
      component: lazy(() => import('./pages/CreateFieldPage')),
    },
    {
      path: 'forms/fields/:id/edit',
      component: lazy(() => import('./pages/EditFieldPage')),
    },
  ],
  subMenuItems: [
    {
      label: 'modules.forms.menu.forms',
      path: '/forms',
      icon: FormIcon,
    },
    {
      label: 'modules.forms.menu.fields',
      path: '/forms/fields',
      icon: FieldIcon,
    },
  ],
};

// Export pages for direct use if needed
export { default as FormsListPage } from './pages/FormsListPage';
export { default as FormBuilderPage } from './pages/FormBuilderPage';
export { default as FormPreviewPage } from './pages/FormPreviewPage';
export { default as FieldsListPage } from './pages/FieldsListPage';
export { default as CreateFieldPage } from './pages/CreateFieldPage';
export { default as EditFieldPage } from './pages/EditFieldPage';
