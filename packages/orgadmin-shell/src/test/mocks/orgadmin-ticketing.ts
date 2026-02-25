// Mock module for @aws-web-framework/orgadmin-ticketing
// Used in tests when the actual package is not built

export const ticketingModule = {
  id: 'ticketing',
  name: 'modules.ticketing.name',
  title: 'modules.ticketing.title',
  description: 'modules.ticketing.description',
  capability: 'event-ticketing',
  order: 15,
  card: { 
    title: 'modules.ticketing.title', 
    description: 'modules.ticketing.description', 
    icon: () => null, 
    path: '/tickets' 
  },
  routes: [{ path: '/tickets', component: () => null }],
};
