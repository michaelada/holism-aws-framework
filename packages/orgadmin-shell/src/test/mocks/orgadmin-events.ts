// Mock module for @aws-web-framework/orgadmin-events
// Used in development when the actual package is not built

import { lazy } from 'react';
import { Festival } from '@mui/icons-material';

export const eventsModule = {
  id: 'events',
  name: 'Events',
  title: 'Event Management',
  description: 'Manage events, activities, and entries for your organisation',
  capability: 'event-management',
  order: 10,
  card: { 
    title: 'Event Management', 
    description: 'Manage events, activities, and entries for your organisation', 
    icon: Festival,
    color: '#d84315',
    path: '/events' 
  },
  routes: [{ 
    path: 'events', 
    component: lazy(() => import('./EventsPlaceholder'))
  }],
  menuItem: {
    label: 'Events',
    path: '/events',
    icon: Festival,
  },
};
