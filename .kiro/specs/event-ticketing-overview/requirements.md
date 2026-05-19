# Requirements Document

## Introduction

The Event Ticketing module currently displays a single dashboard page showing all tickets across all events. This feature restructures the ticketing area into a two-level navigation: a landing page with a tabular overview of all ticketed events, and an event-specific detail page that shows the existing dashboard (stats cards, ticket list, batch operations) scoped to a single selected event. The event filter dropdown is removed from the detail page since the event context is already established by navigation.

## Glossary

- **Ticketing_Overview_Page**: The new default landing page for the ticketing module that displays a table of all events with ticketing activated
- **Event_Ticketing_Detail_Page**: The event-specific page showing ticket statistics, filters, and ticket list for a single selected event
- **Ticketed_Event**: An event that has `generateElectronicTickets` set to `true` in its ticketing configuration
- **Stats_Cards**: The summary statistics display showing Total Tickets Issued, Tickets Scanned, Tickets Not Scanned, and Last Scan Time
- **Ticket_List**: The table of individual electronic tickets with columns for reference, activity, customer, dates, scan status, and actions
- **Ticketing_Module**: The `orgadmin-ticketing` package that provides electronic ticketing functionality
- **Edit_Ticketing_Settings_Page**: The dedicated page for editing ticketing-specific configuration for a single event, accessible from the Ticketing_Overview_Page

## Requirements

### Requirement 1: Ticketed Events Overview Table

**User Story:** As an organisation administrator, I want to see a tabular overview of all events that have ticketing activated, so that I can quickly assess ticketing status across events and navigate to a specific event's tickets.

#### Acceptance Criteria

1. WHEN the user navigates to the ticketing module, THE Ticketing_Overview_Page SHALL display as the default landing page
2. THE Ticketing_Overview_Page SHALL display a table listing all Ticketed_Events for the current organisation
3. WHEN Ticketed_Events are loaded, THE Ticketing_Overview_Page SHALL display the following columns for each event: event name, event date, total tickets issued, tickets scanned, tickets not scanned, and scan percentage
4. THE Ticketing_Overview_Page SHALL sort Ticketed_Events by event date in descending order (most recent first)
5. WHEN no Ticketed_Events exist, THE Ticketing_Overview_Page SHALL display an empty state message indicating no events have ticketing activated
6. THE Ticketing_Overview_Page SHALL fetch Ticketed_Events from the existing `GET /api/orgadmin/organisations/{organisationId}/ticketed-events` endpoint with associated ticket summary data

### Requirement 2: Navigation from Overview to Event Detail

**User Story:** As an organisation administrator, I want to click on an event in the overview table to see its detailed ticketing information, so that I can manage tickets for a specific event.

#### Acceptance Criteria

1. WHEN the user clicks on an event row in the Ticketed_Events table, THE Ticketing_Module SHALL navigate to the Event_Ticketing_Detail_Page for the selected event
2. THE Ticketing_Module SHALL register a route at `tickets/:eventId` for the Event_Ticketing_Detail_Page
3. WHEN the user is on the Event_Ticketing_Detail_Page, THE Event_Ticketing_Detail_Page SHALL display a back navigation element that returns the user to the Ticketing_Overview_Page
4. WHEN the user navigates directly to `tickets/:eventId` via URL, THE Event_Ticketing_Detail_Page SHALL load the correct event data using the eventId route parameter

### Requirement 3: Event-Scoped Statistics Display

**User Story:** As an organisation administrator, I want to see ticket statistics scoped to the selected event, so that I can understand the ticketing status for that specific event.

#### Acceptance Criteria

1. THE Event_Ticketing_Detail_Page SHALL display the event name as a page heading
2. THE Event_Ticketing_Detail_Page SHALL display Stats_Cards showing Total Tickets Issued, Tickets Scanned, Tickets Not Scanned, and Last Scan Time calculated from tickets belonging to the selected event only
3. THE Stats_Cards SHALL use the same visual layout and styling as the current TicketingStatsCards component

### Requirement 4: Event-Scoped Ticket List and Filters

**User Story:** As an organisation administrator, I want to see and filter the ticket list for the selected event without needing to select the event from a dropdown, so that I can efficiently manage tickets for that event.

#### Acceptance Criteria

1. THE Event_Ticketing_Detail_Page SHALL display the Ticket_List containing only tickets belonging to the selected event
2. THE Event_Ticketing_Detail_Page SHALL NOT display the event filter dropdown since the event context is established by navigation
3. THE Event_Ticketing_Detail_Page SHALL display filter controls for: event activity, scan status, date range, and search term
4. WHEN the activity filter is applied, THE Event_Ticketing_Detail_Page SHALL filter the Ticket_List to show only tickets matching the selected activity within the current event
5. THE Ticket_List SHALL display the same columns as the current implementation: checkbox, ticket reference, event activity, customer name, customer email, issue date, scan status, scan date, and actions
6. THE Ticket_List SHALL NOT display the event name column since all tickets belong to the same event

### Requirement 5: Event-Scoped Ticket Operations

**User Story:** As an organisation administrator, I want to perform ticket operations (view details, batch operations, export) scoped to the selected event, so that I can manage tickets without affecting other events.

#### Acceptance Criteria

1. WHEN the user selects tickets and performs a batch operation on the Event_Ticketing_Detail_Page, THE Ticketing_Module SHALL apply the operation only to the selected tickets within the current event
2. WHEN the user clicks the export button on the Event_Ticketing_Detail_Page, THE Ticketing_Module SHALL export only tickets belonging to the selected event
3. WHEN the user clicks the view action on a ticket row, THE Ticketing_Module SHALL open the TicketDetailsDialog displaying the full ticket information
4. THE Event_Ticketing_Detail_Page SHALL support the same auto-refresh polling interval (30 seconds) as the current implementation, fetching only tickets for the selected event

### Requirement 6: Event-Specific Ticket Data Fetching

**User Story:** As an organisation administrator, I want the detail page to load only the tickets for the selected event, so that the page loads efficiently.

#### Acceptance Criteria

1. WHEN the Event_Ticketing_Detail_Page loads, THE Ticketing_Module SHALL fetch tickets using the existing `GET /api/orgadmin/events/{eventId}/ticket-sales` endpoint
2. IF the eventId in the route parameter does not correspond to a valid Ticketed_Event, THEN THE Event_Ticketing_Detail_Page SHALL display an error message and provide navigation back to the Ticketing_Overview_Page
3. WHEN the auto-refresh interval triggers, THE Ticketing_Module SHALL re-fetch tickets for the selected event only

### Requirement 7: Edit Ticketing Settings Navigation

**User Story:** As an organisation administrator, I want to access a dedicated ticketing settings edit page directly from the ticketed events overview table, so that I can quickly adjust ticketing configuration for a specific event without navigating to the general event edit page.

#### Acceptance Criteria

1. THE Ticketing_Overview_Page SHALL display an edit settings icon button in each Ticketed_Event row in the overview table
2. WHEN the user clicks the edit settings icon button for a Ticketed_Event, THE Ticketing_Module SHALL navigate to the Edit_Ticketing_Settings_Page for the selected event at route `tickets/:eventId/settings`
3. THE edit settings icon button SHALL be visually distinct from the row click navigation so the user can differentiate between viewing ticket details and editing ticketing settings
4. THE Ticketing_Module SHALL register the route `tickets/:eventId/settings` for the Edit_Ticketing_Settings_Page

### Requirement 8: Edit Ticketing Settings Page

**User Story:** As an organisation administrator, I want a dedicated page for editing ticketing-specific settings for an event, so that I can manage ticketing configuration separately from general event settings and extend it with future ticketing-specific fields.

#### Acceptance Criteria

1. WHEN the Edit_Ticketing_Settings_Page loads, THE Edit_Ticketing_Settings_Page SHALL display the event name as a page heading
2. THE Edit_Ticketing_Settings_Page SHALL display editable fields for the following ticketing settings: generate electronic tickets, ticket header text, ticket instructions, ticket footer text, ticket validity period, ticket background color, and include event logo
3. WHEN the Edit_Ticketing_Settings_Page loads, THE Edit_Ticketing_Settings_Page SHALL populate all ticketing settings fields with the current saved values for the selected event
4. WHEN the user modifies a ticketing setting and clicks the save button, THE Edit_Ticketing_Settings_Page SHALL persist only the ticketing configuration fields for the selected event without modifying other event settings
5. IF the save operation fails, THEN THE Edit_Ticketing_Settings_Page SHALL display an error message and retain the user's unsaved changes in the form
6. WHEN the save operation succeeds, THE Edit_Ticketing_Settings_Page SHALL display a success confirmation message
7. THE Edit_Ticketing_Settings_Page SHALL display a back navigation element that returns the user to the Ticketing_Overview_Page
8. IF the eventId in the route parameter does not correspond to a valid Ticketed_Event, THEN THE Edit_Ticketing_Settings_Page SHALL display an error message and provide navigation back to the Ticketing_Overview_Page
9. THE Edit_Ticketing_Settings_Page SHALL use an extensible layout that accommodates additional ticketing-specific settings fields in the future without requiring structural changes
