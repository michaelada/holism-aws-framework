# ItsPlainSailing Organisation Admin - Ticketing Module

Event ticketing module with QR code generation and validation for the ItsPlainSailing Organisation Admin system.

## Features

- **Electronic Ticket Generation**: Automatically generate tickets with unique QR codes for event bookings
- **Ticketing Dashboard**: Real-time view of all issued tickets with scan status
- **Ticket Management**: View ticket details, resend emails, and manually update scan status
- **Batch Operations**: Mark multiple tickets as scanned/unscanned
- **Excel Export**: Export ticket data for reporting and analysis
- **Event Integration**: Seamlessly integrates with Events module for ticket configuration

## Capability Requirement

This module requires the `event-ticketing` capability to be enabled for the organisation.

## Routes

- `/orgadmin/tickets` - Ticketing dashboard with statistics and ticket list
- `/orgadmin/tickets/:id` - Ticket details view

## Components

### Pages
- **TicketingDashboardPage**: Main dashboard with statistics and ticket list
- **TicketDetailsDialog**: View full ticket details including QR code

### Components
- **TicketingStatsCards**: Summary statistics cards
- **BatchTicketOperationsDialog**: Batch operations for multiple tickets

### Services
- **ticketGeneration**: Utilities for generating ticket references and QR codes

## Usage

This module is automatically loaded by the orgadmin-shell when the `event-ticketing` capability is enabled.

## Development

```bash
# Install dependencies
npm install

# Run tests
npm test

# Build
npm run build
```

## Integration

Tickets are automatically generated when:
1. An event has "Generate Electronic Tickets" enabled
2. A booking is confirmed for that event
3. Payment is completed (if required)

The ticket is then:
- Attached to the booking confirmation email
- Displayed in the ticketing dashboard
- Available for scanning via the mobile scanning app (separate project)
