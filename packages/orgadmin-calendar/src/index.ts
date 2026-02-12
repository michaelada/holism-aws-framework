/**
 * Calendar Module (Calendar Bookings Management)
 * 
 * Capability module that provides calendar booking functionality.
 * Only visible if organisation has 'calendar-bookings' capability enabled.
 * 
 * Features:
 * - Calendar creation and management
 * - Flexible time slot configuration with multiple duration options
 * - Automated opening/closing schedules
 * - Blocked periods for maintenance or holidays
 * - Booking window configuration (min/max days in advance)
 * - Cancellation policies with automatic refunds
 * - Tabular and calendar views for bookings
 * - Payment integration (card, offline)
 * - Terms and conditions support
 * - Email notifications and reminders
 */

import { lazy } from 'react';
import { CalendarMonth as CalendarIcon } from '@mui/icons-material';
import type { ModuleRegistration } from './types/module.types';

export const calendarModule: ModuleRegistration = {
  id: 'calendar',
  name: 'Calendar',
  title: 'Calendar Bookings',
  description: 'Manage bookable calendars, time slots, and bookings for your organisation',
  capability: 'calendar-bookings', // Requires calendar-bookings capability
  order: 13, // After events, memberships, merchandise
  card: {
    title: 'Calendar Bookings',
    description: 'Manage bookable calendars, time slots, and bookings for your organisation',
    icon: CalendarIcon,
    color: '#9c27b0', // Purple color
    path: '/calendar',
  },
  routes: [
    {
      path: '/calendar',
      component: lazy(() => import('./pages/CalendarsListPage')),
    },
    {
      path: '/calendar/new',
      component: lazy(() => import('./pages/CreateCalendarPage')),
    },
    {
      path: '/calendar/:id',
      component: lazy(() => import('./pages/CalendarDetailsPage')),
    },
    {
      path: '/calendar/:id/edit',
      component: lazy(() => import('./pages/CreateCalendarPage')),
    },
    {
      path: '/calendar/bookings',
      component: lazy(() => import('./pages/BookingsListPage')),
    },
    {
      path: '/calendar/bookings/calendar-view',
      component: lazy(() => import('./pages/BookingsCalendarPage')),
    },
    {
      path: '/calendar/bookings/:id',
      component: lazy(() => import('./pages/BookingDetailsPage')),
    },
  ],
  menuItem: {
    label: 'Calendar',
    path: '/calendar',
    icon: CalendarIcon,
  },
};

// Export pages for direct use if needed
export { default as CalendarsListPage } from './pages/CalendarsListPage';
export { default as CreateCalendarPage } from './pages/CreateCalendarPage';
export { default as CalendarDetailsPage } from './pages/CalendarDetailsPage';
export { default as BookingsListPage } from './pages/BookingsListPage';
export { default as BookingsCalendarPage } from './pages/BookingsCalendarPage';
export { default as BookingDetailsPage } from './pages/BookingDetailsPage';

// Export components
export { default as TimeSlotConfigurationSection } from './components/TimeSlotConfigurationSection';
export { default as BlockedPeriodsSection } from './components/BlockedPeriodsSection';
export { default as ScheduleRulesSection } from './components/ScheduleRulesSection';
export { default as CalendarForm } from './components/CalendarForm';
export { default as CancelBookingDialog } from './components/CancelBookingDialog';

// Export utilities
export * from './utils/slotAvailabilityCalculator';
export * from './utils/cancellationValidator';

// Export types
export * from './types/calendar.types';

export const ORGADMIN_CALENDAR_VERSION = '1.0.0';
