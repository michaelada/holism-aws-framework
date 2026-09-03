/**
 * Announcements — a club's own notices to its members.
 *
 * Written here, read on the member's home page in the account application. The
 * capability `org-announcements` gates the whole module: without it the menu
 * item, the routes and the API are all absent, and a club sees no trace of a
 * feature it has not bought.
 *
 * Its own package rather than a corner of `orgadmin-core`, because
 * `orgadmin-core` is the always-on package — every module in it is
 * `capability: undefined` — and a capability-gated area belongs to a module the
 * shell can leave unregistered.
 *
 * See docs/ORG_ANNOUNCEMENTS.md.
 */

import { lazy } from 'react';
import { Campaign as AnnouncementIcon } from '@mui/icons-material';
import type { ModuleRegistration } from './types/module.types';

export const announcementsModule: ModuleRegistration = {
  id: 'announcements',
  name: 'modules.announcements.name',
  title: 'modules.announcements.title',
  description: 'modules.announcements.description',
  capability: 'org-announcements',
  order: 14, // After ticketing, the last of the capability modules
  card: {
    title: 'modules.announcements.title',
    description: 'modules.announcements.description',
    icon: AnnouncementIcon,
    color: '#D24400', // the one accent; modules are told apart by their illustration
    path: '/announcements',
  },
  routes: [
    {
      path: 'announcements',
      component: lazy(() => import('./pages/AnnouncementsListPage')),
    },
    {
      path: 'announcements/new',
      component: lazy(() => import('./pages/AnnouncementEditorPage')),
    },
    {
      path: 'announcements/:id/edit',
      component: lazy(() => import('./pages/AnnouncementEditorPage')),
    },
  ],
  menuItem: {
    label: 'modules.announcements.name',
    path: '/announcements',
    icon: AnnouncementIcon,
  },
};

export default announcementsModule;

export { default as AnnouncementsListPage } from './pages/AnnouncementsListPage';
export { default as AnnouncementEditorPage } from './pages/AnnouncementEditorPage';
export * from './types/announcement.types';
export const ORGADMIN_ANNOUNCEMENTS_VERSION = '1.0.0';
