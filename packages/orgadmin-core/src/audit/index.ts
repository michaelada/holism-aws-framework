/**
 * Audit Log Module
 *
 * A core module: every organisation administrator can see their own club's
 * trail. The scope is fixed by the server, not by this module — see
 * docs/AUDIT_TRAIL_AND_SESSIONS.md.
 */

import { lazy } from 'react';
import { FactCheck as AuditIcon } from '@mui/icons-material';
import type { ModuleRegistration } from '../types/module.types';

export const auditModule: ModuleRegistration = {
  id: 'audit',
  name: 'modules.audit.name',
  title: 'modules.audit.title',
  description: 'modules.audit.description',
  capability: undefined, // Core module — always available
  // Last in the menu: it is the thing you go to when something has already
  // happened, not part of the daily run of the club.
  order: 9,
  card: {
    title: 'modules.audit.title',
    description: 'modules.audit.description',
    icon: AuditIcon,
    color: '#546e7a',
    path: '/audit',
  },
  routes: [
    {
      path: 'audit',
      component: lazy(() => import('./pages/AuditLogPage')),
    },
  ],
  menuItem: {
    label: 'modules.audit.name',
    path: '/audit',
    icon: AuditIcon,
  },
};

export { default as AuditLogPage } from './pages/AuditLogPage';
