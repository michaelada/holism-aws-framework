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
  name: 'Reporting',
  title: 'Reports & Analytics',
  description: 'View reports and analytics for events, members, and revenue',
  capability: undefined, // Core module - always available
  order: 5, // Fifth in menu after Dashboard, Forms, Settings, and Payments
  card: {
    title: 'Reports & Analytics',
    description: 'View reports and analytics for events, members, and revenue',
    icon: ReportingIcon,
    color: '#0288d1',
    path: '/reporting',
  },
  routes: [
    {
      path: '/reporting',
      component: lazy(() => import('./pages/ReportingDashboardPage')),
    },
    {
      path: '/reporting/events',
      component: lazy(() => import('./pages/EventsReportPage')),
    },
    {
      path: '/reporting/members',
      component: lazy(() => import('./pages/MembersReportPage')),
    },
    {
      path: '/reporting/revenue',
      component: lazy(() => import('./pages/RevenueReportPage')),
    },
  ],
  menuItem: {
    label: 'Reporting',
    path: '/reporting',
    icon: ReportingIcon,
  },
};

// Export pages for direct use if needed
export { default as ReportingDashboardPage } from './pages/ReportingDashboardPage';
export { default as EventsReportPage } from './pages/EventsReportPage';
export { default as MembersReportPage } from './pages/MembersReportPage';
export { default as RevenueReportPage } from './pages/RevenueReportPage';
