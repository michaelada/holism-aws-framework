/**
 * Payments Module
 * 
 * Core module that provides payment management functionality.
 * Always available to all organisation administrators
 */

import { lazy } from 'react';
import {
  Payment as PaymentIcon,
  AccountBalance as BankIcon,
  ReceiptLong as OfflineIcon,
  Undo as RefundIcon,
} from '@mui/icons-material';
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
    color: '#D24400', // the one accent; modules are told apart by their illustration
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
      path: 'payments/lodgements/:id',
      component: lazy(() => import('./pages/LodgementDetailPage')),
    },
    {
      path: 'payments/offline',
      component: lazy(() => import('./pages/OfflinePaymentsPage')),
    },
    {
      path: 'payments/refunds',
      component: lazy(() => import('./pages/RefundsListPage')),
    },
  ],
  menuItem: {
    label: 'modules.payments.name',
    path: '/payments',
    icon: PaymentIcon,
  },
  /*
   * Module level, not nested inside `menuItem`.
   *
   * `MenuItem` has no `subMenuItems`; `ModuleRegistration` does. Nested there it
   * was a type error the build reported and nobody acted on, and the practical
   * effect was that this entry never rendered — the page and its route existed,
   * reachable only by typing the URL.
   *
   * Offline settlements get their own entry rather than a filter on the list.
   * They are a **task** — money to chase and record — not a view of history,
   * and until one is recorded the member has nothing they paid for. A filter
   * two clicks into a table is not where that belongs.
   */
  subMenuItems: [
    {
      // Named for what it shows, not for the module — the rail already says
      // "Payments" one row above, and repeating it read as "Payments › Payments".
      label: 'payments.allMenu',
      path: '/payments',
      icon: PaymentIcon,
    },
    {
      label: 'payments.offline.menu',
      path: '/payments/offline',
      icon: OfflineIcon,
    },
    /*
     * Money that went back out. Its own entry rather than a status filter on
     * the list above, because the question is about the refunds — how much has
     * gone back, and who authorised it — and a payments list filtered to
     * `refunded` answers a different one: it shows the payments, at their
     * original amounts, and says nothing about a payment only part of which
     * was returned.
     */
    {
      label: 'payments.refunds.menu',
      path: '/payments/refunds',
      icon: RefundIcon,
    },
    /*
     * Third, and last, because it is the end of the money's journey: taken,
     * then settled, then lodged. It answers a different question from the two
     * above — not "what did we charge?" but "what actually reached the bank?",
     * which is a different number on a different date.
     */
    {
      label: 'payments.lodgements.menu',
      path: '/payments/lodgements',
      icon: BankIcon,
    },
  ],
};

// Export pages for direct use if needed
export { default as PaymentsListPage } from './pages/PaymentsListPage';
export { default as PaymentDetailsPage } from './pages/PaymentDetailsPage';
export { default as LodgementsPage } from './pages/LodgementsPage';
export { default as LodgementDetailPage } from './pages/LodgementDetailPage';
export { default as OfflinePaymentsPage } from './pages/OfflinePaymentsPage';
export { default as RefundsListPage } from './pages/RefundsListPage';
