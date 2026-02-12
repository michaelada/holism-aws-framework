# ItsPlainSailing Organisation Admin - Calendar Module

Calendar Bookings Management module for the ItsPlainSailing Organisation Admin system.

## Overview

This module provides calendar booking functionality for organisations with the `calendar-bookings` capability enabled. It allows administrators to:

- Create and manage bookable calendars (facilities, courts, arenas, etc.)
- Configure flexible time slot schedules with multiple duration options
- Set up automated opening/closing schedules
- Manage blocked periods for maintenance or holidays
- Configure booking windows (min/max days in advance)
- Set up cancellation policies with automatic refunds
- View bookings in both tabular and calendar views
- Process booking cancellations and modifications

## Features

- **Calendar Management**: Create multiple calendars for different resources
- **Time Slot Configuration**: Flexible scheduling with varying durations and prices
- **Automated Scheduling**: Rules-based opening/closing of calendars
- **Blocked Periods**: Date ranges and time segments for unavailability
- **Booking Management**: Comprehensive booking tracking and management
- **Calendar Views**: Both tabular list and visual calendar displays
- **Cancellation Policies**: Configurable self-service cancellations with refunds
- **Payment Integration**: Support for multiple payment methods
- **Email Notifications**: Automated confirmations and reminders

## Installation

This package is part of the ItsPlainSailing monorepo workspace.

```bash
npm install
```

## Development

```bash
# Run in development mode
npm run dev

# Build for production
npm run build

# Run tests
npm test

# Run tests in watch mode
npm test:watch

# Generate coverage report
npm test:coverage
```

## Module Registration

This module registers with the orgadmin-shell and is only visible to organisations with the `calendar-bookings` capability enabled.

## Dependencies

- React 18+
- Material-UI 5+
- React Router 6+
- date-fns for date manipulation
- react-big-calendar for calendar views
- react-quill for rich text editing

## License

Proprietary - ItsPlainSailing
