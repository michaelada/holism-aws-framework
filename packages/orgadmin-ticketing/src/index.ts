/**
 * Ticketing Module (Event Ticketing with QR Codes)
 * 
 * Capability module that provides electronic ticketing functionality for events.
 * Only visible if organisation has 'event-ticketing' capability enabled.
 * 
 * Features:
 * - Automatic ticket generation with unique QR codes
 * - Real-time ticketing dashboard with scan statistics
 * - Ticket management (view details, resend emails, manual scan status)
 * - Batch operations (mark scanned/unscanned)
 * - Excel export for ticket data
 * - Event integration for ticket configuration
 * - Email delivery of tickets
 * - Scan history and audit trail
 * 
 * Integration:
 * - Tickets automatically generated when bookings are made for events with ticketing enabled
 * - Tickets attached to booking confirmation emails
 * - Real-time updates when tickets are scanned via mobile app
 * - Seamless integration with Events module
 */

import { lazy } from 'react';
import { ConfirmationNumber as TicketIcon } from '@mui/icons-material';
import type { ModuleRegistration } from './types/module.types';

export const ticketingModule: ModuleRegistration = {
  id: 'ticketing',
  name: 'modules.ticketing.name',
  title: 'modules.ticketing.title',
  description: 'modules.ticketing.description',
  capability: 'event-ticketing', // Requires event-ticketing capability
  order: 13, // After registrations module
  card: {
    title: 'modules.ticketing.title',
    description: 'modules.ticketing.description',
    icon: TicketIcon,
    color: '#7b1fa2',
    path: '/tickets',
  },
  routes: [
    {
      path: 'tickets',
      component: lazy(() => import('./pages/TicketedEventsOverviewPage')),
    },
    {
      path: 'tickets/:eventId',
      component: lazy(() => import('./pages/EventTicketingDetailPage')),
    },
    {
      path: 'tickets/:eventId/settings',
      component: lazy(() => import('./pages/EditTicketingSettingsPage')),
    },
  ],
  menuItem: {
    label: 'modules.ticketing.name',
    path: '/tickets',
    icon: TicketIcon,
  },
};

// Export pages for direct use if needed
export { default as TicketedEventsOverviewPage } from './pages/TicketedEventsOverviewPage';
export { default as EventTicketingDetailPage } from './pages/EventTicketingDetailPage';
export { default as EditTicketingSettingsPage } from './pages/EditTicketingSettingsPage';

/** @deprecated Use TicketedEventsOverviewPage and EventTicketingDetailPage instead */
export { default as TicketingDashboardPage } from './pages/TicketingDashboardPage';

// Export components
export { default as TicketDetailsDialog } from './components/TicketDetailsDialog';
export { default as BatchTicketOperationsDialog } from './components/BatchTicketOperationsDialog';
export { default as TicketingStatsCards } from './components/TicketingStatsCards';

/*
 * Ticket generation moved to `packages/components` (CLAUDE.md §1.5): the
 * account-user app renders the same ticket a member is handed at a gate, and
 * two implementations of one ticket is exactly the kind of drift that ends with
 * a QR code that scans in one app and not the other.
 *
 * Re-exported here so existing `@holism/orgadmin-ticketing` imports keep
 * working — the module boundary changed, not the API.
 */
export {
  generateTicketReference,
  generateQRCodeUUID,
  generateQRCodeDataURL,
  generateQRCodeBuffer,
  generateTicketPDFHTML,
  generateMultipleTickets,
  validateTicketReference,
  parseTicketReference,
} from '@aws-web-framework/components';
export type { TicketPDFData } from '@aws-web-framework/components';

// Export types
export * from './types/ticketing.types';
export * from './types/module.types';

export const ORGADMIN_TICKETING_VERSION = '1.0.0';
