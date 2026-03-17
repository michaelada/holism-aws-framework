/**
 * Registrations Module Configuration
 *
 * Separated from index.ts to allow importing the module config object
 * without triggering eager re-exports of page/component modules
 * (which pull in date-fns and other heavy transitive dependencies).
 */

import { lazy } from 'react';
import { AppRegistration as RegistrationIcon, LocalOffer as DiscountIcon } from '@mui/icons-material';
import type { ModuleRegistration } from './types/module.types';

export const registrationsModule: ModuleRegistration = {
  id: 'registrations',
  name: 'modules.registrations.name',
  title: 'modules.registrations.title',
  description: 'modules.registrations.description',
  capability: 'registrations',
  order: 12,
  card: {
    title: 'modules.registrations.title',
    description: 'modules.registrations.description',
    icon: RegistrationIcon,
    color: '#1565c0',
    path: '/registrations',
  },
  routes: [
    {
      path: 'registrations',
      component: lazy(() => import('./pages/RegistrationsDatabasePage')),
    },
    {
      path: 'registrations/types',
      component: lazy(() => import('./pages/RegistrationTypesListPage')),
    },
    {
      path: 'registrations/types/new',
      component: lazy(() => import('./pages/CreateRegistrationTypePage')),
    },
    {
      path: 'registrations/types/:id',
      component: lazy(() => import('./pages/RegistrationTypeDetailsPage')),
    },
    {
      path: 'registrations/types/:id/edit',
      component: lazy(() => import('./pages/CreateRegistrationTypePage')),
    },
    {
      path: 'registrations/discounts',
      component: lazy(() => import('./pages/DiscountsListPage')),
      capability: 'registration-discounts',
    },
    {
      path: 'registrations/discounts/new',
      component: lazy(() => import('./pages/CreateDiscountPage')),
      capability: 'registration-discounts',
    },
    {
      path: 'registrations/discounts/:id/edit',
      component: lazy(() => import('./pages/EditDiscountPage')),
      capability: 'registration-discounts',
    },
    {
      path: 'registrations/create',
      component: lazy(() => import('./pages/CreateRegistrationPage')),
    },
    {
      path: 'registrations/:id',
      component: lazy(() => import('./pages/RegistrationDetailsPage')),
    },
  ],
  subMenuItems: [
    {
      label: 'modules.registrations.menu.registrationsDatabase',
      path: '/registrations',
      icon: RegistrationIcon,
    },
    {
      label: 'modules.registrations.menu.registrationTypes',
      path: '/registrations/types',
      icon: RegistrationIcon,
    },
    {
      label: 'modules.registrations.menu.discounts',
      path: '/registrations/discounts',
      icon: DiscountIcon,
      capability: 'registration-discounts',
    },
  ],
};
