/**
 * Reporting Module
 * 
 * Core module that provides reporting and analytics functionality.
 * Always available to all organisation administrators
 */

import { lazy } from 'react';
import { Assessment as ReportingIcon } from '@mui/icons-material';
import type { ModuleRegistration } from '../types/module.types';

export const reportingModule: ModuleRegistration = {
  id: 'reporting',
  name: 'modules.reporting.name',
  title: 'modules.reporting.title',
  description: 'modules.reporting.description',
  capability: undefined, // Core module - always available
  order: 5, // Fifth in menu after Dashboard, Forms, Settings, and Payments
  card: {
    title: 'modules.reporting.title',
    description: 'modules.reporting.description',
    icon: ReportingIcon,
    color: '#0288d1',
    path: '/reporting',
  },
  routes: [
    {
      path: 'reporting',
      component: lazy(() => import('./pages/ReportingDashboardPage')),
    },
    {
      path: 'reporting/events',
      component: lazy(() => import('./pages/EventsReportPage')),
    },
    {
      path: 'reporting/members',
      component: lazy(() => import('./pages/MembersReportPage')),
    },
    {
      path: 'reporting/revenue',
      component: lazy(() => import('./pages/RevenueReportPage')),
    },
  ],
  menuItem: {
    label: 'modules.reporting.name',
    path: '/reporting',
    icon: ReportingIcon,
  },
};

// Export pages for direct use if needed
export { default as ReportingDashboardPage } from './pages/ReportingDashboardPage';
export { default as EventsReportPage } from './pages/EventsReportPage';
export { default as MembersReportPage } from './pages/MembersReportPage';
export { default as RevenueReportPage } from './pages/RevenueReportPage';
