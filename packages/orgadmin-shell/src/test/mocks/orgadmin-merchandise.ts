// Mock module for @aws-web-framework/orgadmin-merchandise
// Used in tests when the actual package is not built

export const merchandiseModule = {
  id: 'merchandise',
  name: 'modules.merchandise.name',
  title: 'modules.merchandise.title',
  description: 'modules.merchandise.description',
  capability: 'merchandise',
  order: 12,
  card: { 
    title: 'modules.merchandise.title', 
    description: 'modules.merchandise.description', 
    icon: () => null, 
    path: '/merchandise' 
  },
  routes: [{ path: '/merchandise', component: () => null }],
};
