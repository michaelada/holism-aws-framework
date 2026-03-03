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
import { 
  Festival as EventIcon,
  Category as CategoryIcon,
  LocationOn as LocationIcon,
  LocalOffer as DiscountIcon,
} from '@mui/icons-material';
import type { ModuleRegistration } from './types/module.types';

export const eventsModule: ModuleRegistration = {
  id: 'events',
  name: 'modules.events.name',
  title: 'modules.events.title',
  description: 'modules.events.description',
  capability: 'event-management', // Requires event-management capability
  order: 10, // After core modules
  card: {
    title: 'modules.events.title',
    description: 'modules.events.description',
    icon: EventIcon,
    color: '#d84315',
    path: '/events',
  },
  routes: [
    {
      path: 'events',
      component: lazy(() => import('./pages/EventsListPage')),
    },
    {
      path: 'events/new',
      component: lazy(() => import('./pages/CreateEventPage')),
    },
    {
      path: 'events/:id',
      component: lazy(() => import('./pages/EventDetailsPage')),
    },
    {
      path: 'events/:id/edit',
      component: lazy(() => import('./pages/CreateEventPage')),
    },
    {
      path: 'events/:id/entries',
      component: lazy(() => import('./pages/EventEntriesPage')),
    },
    {
      path: 'events/types',
      component: lazy(() => import('./pages/EventTypesListPage')),
    },
    {
      path: 'events/venues',
      component: lazy(() => import('./pages/VenuesListPage')),
    },
    {
      path: 'events/discounts',
      component: lazy(() => import('./pages/DiscountsListPage')),
      capability: 'entry-discounts', // Only show if entry-discounts capability enabled
    },
    {
      path: 'events/discounts/new',
      component: lazy(() => import('./pages/CreateDiscountPage')),
      capability: 'entry-discounts', // Only show if entry-discounts capability enabled
    },
    {
      path: 'events/discounts/:id/edit',
      component: lazy(() => import('./pages/CreateDiscountPage')),
      capability: 'entry-discounts', // Only show if entry-discounts capability enabled
    },
  ],
  subMenuItems: [
    {
      label: 'modules.events.menu.events',
      path: '/events',
      icon: EventIcon,
    },
    {
      label: 'modules.events.menu.eventTypes',
      path: '/events/types',
      icon: CategoryIcon,
    },
    {
      label: 'modules.events.menu.venues',
      path: '/events/venues',
      icon: LocationIcon,
    },
    {
      label: 'modules.events.menu.discounts',
      path: '/events/discounts',
      icon: DiscountIcon,
      capability: 'entry-discounts', // Only show if entry-discounts capability enabled
    },
  ],
};

// Export pages for direct use if needed
export { default as EventsListPage } from './pages/EventsListPage';
export { default as CreateEventPage } from './pages/CreateEventPage';
export { default as EventDetailsPage } from './pages/EventDetailsPage';
export { default as EventEntriesPage } from './pages/EventEntriesPage';
export { default as EventTypesListPage } from './pages/EventTypesListPage';
export { default as VenuesListPage } from './pages/VenuesListPage';
export { default as DiscountsListPage } from './pages/DiscountsListPage';
export { default as CreateDiscountPage } from './pages/CreateDiscountPage';

// Export components
export { default as EventActivityForm } from './components/EventActivityForm';
export { default as EventEntryDetailsDialog } from './components/EventEntryDetailsDialog';

// Export hooks
export { useDiscountService } from './hooks/useDiscountService';

// Export types
export * from './types/event.types';

export const ORGADMIN_EVENTS_VERSION = '1.0.0';
