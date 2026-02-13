// Mock module for @aws-web-framework/orgadmin-ticketing
// Used in tests when the actual package is not built

export const ticketingModule = {
  id: 'ticketing',
  name: 'Ticketing',
  title: 'Ticketing',
  description: 'Manage ticketing',
  capability: 'event-ticketing',
  order: 15,
  card: { 
    title: 'Ticketing', 
    description: 'Manage ticketing', 
    icon: () => null, 
    path: '/tickets' 
  },
  routes: [{ path: '/tickets', component: () => null }],
};
