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
  name: 'Ticketing',
  title: 'Event Ticketing',
  description: 'Manage electronic tickets with QR codes for your events',
  capability: 'event-ticketing', // Requires event-ticketing capability
  order: 13, // After registrations module
  card: {
    title: 'Event Ticketing',
    description: 'Manage electronic tickets with QR codes for your events',
    icon: TicketIcon,
    color: '#7b1fa2',
    path: '/tickets',
  },
  routes: [
    {
      path: '/tickets',
      component: lazy(() => import('./pages/TicketingDashboardPage')),
    },
  ],
  menuItem: {
    label: 'Ticketing',
    path: '/tickets',
    icon: TicketIcon,
  },
};

// Export pages for direct use if needed
export { default as TicketingDashboardPage } from './pages/TicketingDashboardPage';

// Export components
export { default as TicketDetailsDialog } from './components/TicketDetailsDialog';
export { default as BatchTicketOperationsDialog } from './components/BatchTicketOperationsDialog';
export { default as TicketingStatsCards } from './components/TicketingStatsCards';

// Export services
export * from './services/ticketGeneration';

// Export types
export * from './types/ticketing.types';
export * from './types/module.types';

export const ORGADMIN_TICKETING_VERSION = '1.0.0';
