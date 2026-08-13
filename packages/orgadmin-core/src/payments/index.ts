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
  name: 'modules.payments.name',
  title: 'modules.payments.title',
  description: 'modules.payments.description',
  capability: undefined, // Core module - always available
  order: 4, // Fourth in menu after Dashboard, Forms, and Settings
  card: {
    title: 'modules.payments.title',
    description: 'modules.payments.description',
    icon: PaymentIcon,
    color: '#f9a825',
    path: '/payments',
  },
  routes: [
    {
      path: 'payments',
      component: lazy(() => import('./pages/PaymentsListPage')),
    },
    {
      path: 'payments/:id',
      component: lazy(() => import('./pages/PaymentDetailsPage')),
    },
    {
      path: 'payments/lodgements',
      component: lazy(() => import('./pages/LodgementsPage')),
    },
    {
      path: 'payments/offline',
      component: lazy(() => import('./pages/OfflinePaymentsPage')),
    },
  ],
  menuItem: {
    label: 'modules.payments.name',
    path: '/payments',
    icon: PaymentIcon,
    /*
     * Offline settlements get their own entry rather than a filter on the list.
     * They are a **task** — money to chase and record — not a view of history,
     * and until one is recorded the member has nothing they paid for. A filter
     * two clicks into a table is not where that belongs.
     */
    subMenuItems: [
      {
        label: 'payments.offline.menu',
        path: '/payments/offline',
        icon: PaymentIcon,
      },
    ],
  },
};

// Export pages for direct use if needed
export { default as PaymentsListPage } from './pages/PaymentsListPage';
export { default as PaymentDetailsPage } from './pages/PaymentDetailsPage';
export { default as LodgementsPage } from './pages/LodgementsPage';
export { default as OfflinePaymentsPage } from './pages/OfflinePaymentsPage';
