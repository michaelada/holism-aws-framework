/**
 * Payments Module
 * 
 * Core module that provides payment management functionality.
 * Always available to all organisation administrators
 */

import { lazy } from 'react';
import { Payment as PaymentIcon } from '@mui/icons-material';
import type { ModuleRegistration } from '../types/module.types';

export const paymentsModule: ModuleRegistration = {
  id: 'payments',
  name: 'Payments',
  title: 'Payment Management',
  description: 'View and manage payments, refunds, and lodgements',
  capability: undefined, // Core module - always available
  order: 4, // Fourth in menu after Dashboard, Forms, and Settings
  card: {
    title: 'Payment Management',
    description: 'View and manage payments, refunds, and lodgements',
    icon: PaymentIcon,
    color: '#388e3c',
    path: '/payments',
  },
  routes: [
    {
      path: '/payments',
      component: lazy(() => import('./pages/PaymentsListPage')),
    },
    {
      path: '/payments/:id',
      component: lazy(() => import('./pages/PaymentDetailsPage')),
    },
    {
      path: '/payments/lodgements',
      component: lazy(() => import('./pages/LodgementsPage')),
    },
  ],
  menuItem: {
    label: 'Payments',
    path: '/payments',
    icon: PaymentIcon,
  },
};

// Export pages for direct use if needed
export { default as PaymentsListPage } from './pages/PaymentsListPage';
export { default as PaymentDetailsPage } from './pages/PaymentDetailsPage';
export { default as LodgementsPage } from './pages/LodgementsPage';
