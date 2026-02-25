// Mock module for @aws-web-framework/orgadmin-registrations
// Used in tests when the actual package is not built

export const registrationsModule = {
  id: 'registrations',
  name: 'modules.registrations.name',
  title: 'modules.registrations.title',
  description: 'modules.registrations.description',
  capability: 'registrations',
  order: 14,
  card: { 
    title: 'modules.registrations.title', 
    description: 'modules.registrations.description', 
    icon: () => null, 
    path: '/registrations' 
  },
  routes: [{ path: '/registrations', component: () => null }],
};
