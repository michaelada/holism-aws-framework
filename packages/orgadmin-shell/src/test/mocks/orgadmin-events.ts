// Mock module for @aws-web-framework/orgadmin-events
// Used in tests when the actual package is not built

export const eventsModule = {
  id: 'events',
  name: 'Events',
  title: 'Events',
  description: 'Manage events',
  capability: 'event-management',
  order: 10,
  card: { 
    title: 'Events', 
    description: 'Manage events', 
    icon: () => null, 
    path: '/events' 
  },
  routes: [{ path: '/events', component: () => null }],
};
