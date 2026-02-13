// Mock module for @aws-web-framework/orgadmin-merchandise
// Used in tests when the actual package is not built

export const merchandiseModule = {
  id: 'merchandise',
  name: 'Merchandise',
  title: 'Merchandise',
  description: 'Manage merchandise',
  capability: 'merchandise',
  order: 12,
  card: { 
    title: 'Merchandise', 
    description: 'Manage merchandise', 
    icon: () => null, 
    path: '/merchandise' 
  },
  routes: [{ path: '/merchandise', component: () => null }],
};
