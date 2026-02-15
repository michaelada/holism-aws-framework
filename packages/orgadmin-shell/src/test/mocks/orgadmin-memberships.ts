// Mock module for @aws-web-framework/orgadmin-memberships
// Used in development when the actual package is not built

import { lazy } from 'react';
import { People } from '@mui/icons-material';

export const membershipsModule = {
  id: 'memberships',
  name: 'Memberships',
  title: 'Membership Management',
  description: 'Manage membership types and members for your organisation',
  capability: 'memberships',
  order: 11,
  card: { 
    title: 'Membership Management', 
    description: 'Manage membership types and members for your organisation', 
    icon: People, 
    color: '#ff9966',
    path: '/members' 
  },
  routes: [{ 
    path: 'members', 
    component: lazy(() => import('./MembershipsPlaceholder'))
  }],
  menuItem: {
    label: 'Memberships',
    path: '/members',
    icon: People,
  },
};
