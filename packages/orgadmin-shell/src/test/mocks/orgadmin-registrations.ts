// Mock module for @aws-web-framework/orgadmin-registrations
// Used in tests when the actual package is not built

export const registrationsModule = {
  id: 'registrations',
  name: 'Registrations',
  title: 'Registrations',
  description: 'Manage registrations',
  capability: 'registrations',
  order: 14,
  card: { 
    title: 'Registrations', 
    description: 'Manage registrations', 
    icon: () => null, 
    path: '/registrations' 
  },
  routes: [{ path: '/registrations', component: () => null }],
};
