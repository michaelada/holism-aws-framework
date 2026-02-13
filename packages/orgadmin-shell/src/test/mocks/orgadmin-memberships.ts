// Mock module for @aws-web-framework/orgadmin-memberships
// Used in tests when the actual package is not built

export const membershipsModule = {
  id: 'memberships',
  name: 'Memberships',
  title: 'Memberships',
  description: 'Manage memberships',
  capability: 'memberships',
  order: 11,
  card: { 
    title: 'Memberships', 
    description: 'Manage memberships', 
    icon: () => null, 
    path: '/members' 
  },
  routes: [{ path: '/members', component: () => null }],
};
