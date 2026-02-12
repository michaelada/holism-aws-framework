/**
 * Events Module (Event Management)
 * 
 * Capability module that provides event management functionality.
 * Only visible if organisation has 'event-management' capability enabled.
 * 
 * Features:
 * - Event creation and management with comprehensive attributes
 * - Event activities with detailed configuration
 * - Entry management with tabular view and filtering
 * - Excel export for event entries
 * - Payment integration (card, cheque/offline)
 * - Application form integration
 * - Terms and conditions support
 * - Email notifications
 */

import { lazy } from 'react';
import { Event as EventIcon } from '@mui/icons-material';
import type { ModuleRegistration } from './types/module.types';

export const eventsModule: ModuleRegistration = {
  id: 'events',
  name: 'Events',
  title: 'Event Management',
  description: 'Manage events, activities, and entries for your organisation',
  capability: 'event-management', // Requires event-management capability
  order: 10, // After core modules
  card: {
    title: 'Event Management',
    description: 'Manage events, activities, and entries for your organisation',
    icon: EventIcon,
    color: '#1976d2',
    path: '/events',
  },
  routes: [
    {
      path: '/events',
      component: lazy(() => import('./pages/EventsListPage')),
    },
    {
      path: '/events/new',
      component: lazy(() => import('./pages/CreateEventPage')),
    },
    {
      path: '/events/:id',
      component: lazy(() => import('./pages/EventDetailsPage')),
    },
    {
      path: '/events/:id/edit',
      component: lazy(() => import('./pages/CreateEventPage')),
    },
    {
      path: '/events/:id/entries',
      component: lazy(() => import('./pages/EventEntriesPage')),
    },
  ],
  menuItem: {
    label: 'Events',
    path: '/events',
    icon: EventIcon,
  },
};

// Export pages for direct use if needed
export { default as EventsListPage } from './pages/EventsListPage';
export { default as CreateEventPage } from './pages/CreateEventPage';
export { default as EventDetailsPage } from './pages/EventDetailsPage';
export { default as EventEntriesPage } from './pages/EventEntriesPage';

// Export components
export { default as EventActivityForm } from './components/EventActivityForm';
export { default as EventEntryDetailsDialog } from './components/EventEntryDetailsDialog';

// Export types
export * from './types/event.types';

export const ORGADMIN_EVENTS_VERSION = '1.0.0';
