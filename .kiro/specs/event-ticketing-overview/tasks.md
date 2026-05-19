# Implementation Plan: Event Ticketing Overview

## Overview

Restructure the `orgadmin-ticketing` module from a single dashboard into a three-page navigation pattern: TicketedEventsOverviewPage (landing), EventTicketingDetailPage (event-scoped dashboard), and EditTicketingSettingsPage (ticketing config editor). Enhance the backend `getTicketedEventsByOrganisation` to return ticket summary counts. Add i18n keys and update module route registration.

## Tasks

- [x] 1. Backend: Enhance ticketed-events endpoint with ticket summary data
  - [x] 1.1 Add `TicketedEventSummary` interface and update `getTicketedEventsByOrganisation`
    - In `packages/orgadmin-ticketing/src/types/ticketing.types.ts`, add the `TicketedEventSummary` interface with fields: `eventId`, `eventName`, `eventDate`, `generateElectronicTickets`, `totalTickets`, `ticketsScanned`, `ticketsNotScanned`, `scanPercentage`
    - In `packages/backend/src/services/ticketing.service.ts`, update the `getTicketedEventsByOrganisation` method:
      - Change the SQL query to JOIN `event_ticketing_config` with `events` and LEFT JOIN with `electronic_tickets`, aggregating `COUNT(*)` for total, `COUNT(CASE WHEN scan_status = 'scanned')` for scanned, and computing not-scanned and scan percentage
      - Update the return type from `EventTicketingConfig[]` to `TicketedEventSummary[]`
      - Map result rows to `TicketedEventSummary` objects including `eventName` from `events.name` and `eventDate` from `events.start_date`
    - _Requirements: 1.3, 1.4, 1.6_

  - [ ]* 1.2 Write property test: ticket summary counts are consistent
    - Test file: `packages/backend/src/services/__tests__/ticketing-summary.property.test.ts`
    - Generate random arrays of ticket records with varying scan statuses per event
    - Verify that for each event: `totalTickets === ticketsScanned + ticketsNotScanned` and `scanPercentage === (ticketsScanned / totalTickets) * 100` (or 0 when totalTickets is 0)
    - **Property 6: Stats cards correctly compute from event-scoped tickets**
    - **Validates: Requirements 1.3, 3.2**

- [x] 2. Frontend: Create TicketedEventsOverviewPage
  - [x] 2.1 Create `TicketedEventsOverviewPage` component
    - Create `packages/orgadmin-ticketing/src/pages/TicketedEventsOverviewPage.tsx`
    - Fetch ticketed events via `GET /api/orgadmin/organisations/{organisationId}/ticketed-events` using `useApi`
    - Render a MUI `Table` with columns: Event Name, Event Date, Total Tickets, Scanned, Not Scanned, Scan %, Actions
    - Sort rows by event date descending (most recent first) — the backend already returns sorted data
    - Make rows clickable with `onClick` navigating to `/tickets/:eventId` using `useNavigate`
    - In the Actions column, render a MUI `Settings` `IconButton` per row that navigates to `/tickets/:eventId/settings` with `event.stopPropagation()` to prevent row click
    - Show empty state message when no ticketed events exist using translation key `ticketing.overview.noTicketedEvents`
    - Show loading state while fetching
    - Handle API errors with an error alert and retry option
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 2.1, 7.1, 7.2, 7.3_

  - [ ]* 2.2 Write property test: overview table renders complete event data
    - Test file: `packages/orgadmin-ticketing/src/pages/__tests__/TicketedEventsOverviewPage.table-data.property.test.tsx`
    - Generate random `TicketedEventSummary[]` arrays using `fast-check`, mock the API to return them
    - Render the overview page and verify each row contains event name, event date, total tickets, scanned, not scanned, scan percentage, and an edit settings icon button
    - **Property 1: Overview table renders complete event data**
    - **Validates: Requirements 1.2, 1.3, 7.1**

  - [ ]* 2.3 Write property test: overview table sort order is descending by event date
    - Test file: `packages/orgadmin-ticketing/src/pages/__tests__/TicketedEventsOverviewPage.sort-order.property.test.tsx`
    - Generate random `TicketedEventSummary[]` arrays with distinct event dates
    - Render the table and verify rows appear in descending date order
    - **Property 2: Overview table sort order is descending by event date**
    - **Validates: Requirements 1.4**

  - [ ]* 2.4 Write property test: clicking edit settings icon navigates to correct settings URL
    - Test file: `packages/orgadmin-ticketing/src/pages/__tests__/TicketedEventsOverviewPage.settings-nav.property.test.tsx`
    - Generate random `TicketedEventSummary[]` arrays, render the overview table
    - Simulate clicking the edit settings icon for each row and verify `navigate` is called with `/tickets/{eventId}/settings`
    - Verify the row click handler is NOT triggered (stopPropagation)
    - **Property 9: Clicking edit settings icon navigates to the correct settings URL**
    - **Validates: Requirements 7.2, 7.3**

- [x] 3. Checkpoint — Verify backend enhancement and overview page
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Frontend: Create EventTicketingDetailPage
  - [x] 4.1 Create `EventTicketingDetailPage` component (refactored from `TicketingDashboardPage`)
    - Create `packages/orgadmin-ticketing/src/pages/EventTicketingDetailPage.tsx`
    - Read `eventId` from route params via `useParams`
    - Fetch tickets via `GET /api/orgadmin/events/{eventId}/ticket-sales` using `useApi`
    - Display event name (from the ticket-sales response `eventName` field) as page heading
    - Add back navigation element (MUI `ArrowBack` icon + "Back to Overview" text) linking to `/tickets`
    - Reuse `TicketingStatsCards` component, passing the event-scoped tickets array
    - Render filter controls: activity (Select), scan status (multi-Select), date range (two date TextFields), search (TextField) — remove the event filter dropdown entirely
    - Render ticket table with columns: checkbox, ticket reference, event activity, customer name, customer email, issue date, scan status, scan date, actions — remove the event name column
    - Reuse `TicketDetailsDialog` for viewing individual ticket details
    - Reuse `BatchTicketOperationsDialog` for batch operations on selected tickets
    - Implement 30-second auto-refresh polling via `setInterval`, fetching only tickets for the selected event
    - Handle invalid eventId (404 from API) with error state and back navigation to `/tickets`
    - Support export button that exports only tickets for the selected event
    - _Requirements: 2.2, 2.3, 2.4, 3.1, 3.2, 3.3, 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 5.1, 5.2, 5.3, 5.4, 6.1, 6.2, 6.3_

  - [ ]* 4.2 Write property test: activity filter produces correct subset
    - Test file: `packages/orgadmin-ticketing/src/pages/__tests__/EventTicketingDetailPage.activity-filter.property.test.tsx`
    - Generate random `ElectronicTicket[]` arrays with varying `eventActivityId` values and a random selected activity ID
    - Apply the filter function and verify the result contains exactly those tickets whose `eventActivityId` matches the selected activity
    - **Property 7: Activity filter produces correct subset**
    - **Validates: Requirements 4.4**

  - [ ]* 4.3 Write property test: detail page heading displays the event name
    - Test file: `packages/orgadmin-ticketing/src/pages/__tests__/EventTicketingDetailPage.heading.property.test.tsx`
    - Generate random event names, mock the ticket-sales API to return a response with that event name
    - Render the detail page and verify the heading text matches the event name
    - **Property 5: Detail page heading displays the event name**
    - **Validates: Requirements 3.1**

- [x] 5. Frontend: Create EditTicketingSettingsPage
  - [x] 5.1 Create `EditTicketingSettingsPage` component
    - Create `packages/orgadmin-ticketing/src/pages/EditTicketingSettingsPage.tsx`
    - Read `eventId` from route params via `useParams`
    - On mount, fetch the event's ticketing config via `GET /api/orgadmin/events/{eventId}/ticketing-config`
    - Also fetch the event name from the ticketed events list or the ticket-sales endpoint to display as page heading
    - Add back navigation element (MUI `ArrowBack` icon + "Back to Overview" text) linking to `/tickets`
    - Render a card-based form with editable fields for all `EventTicketingConfig` properties:
      - `generateElectronicTickets` — Checkbox
      - `ticketHeaderText` — Multiline TextField
      - `ticketInstructions` — Multiline TextField
      - `ticketFooterText` — Multiline TextField
      - `ticketValidityPeriod` — Number input (hours)
      - `ticketBackgroundColor` — Color picker input (TextField type="color")
      - `includeEventLogo` — Checkbox
    - Pre-populate all fields with current saved values from the API response
    - Save button calls `PUT /api/orgadmin/events/{eventId}/ticketing-config` with only the `UpdateTicketingConfigDto` fields
    - On save success: display MUI `Snackbar` with success message
    - On save failure: display MUI `Snackbar` with error message, retain all unsaved form values
    - Handle invalid eventId (404 from config endpoint) with error state and back navigation to `/tickets`
    - Use extensible card-based layout that accommodates future settings sections
    - Manage local form state via `useState`, independent of the event edit form
    - _Requirements: 7.4, 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 8.8, 8.9_

  - [ ]* 5.2 Write property test: edit settings form is populated with current config values
    - Test file: `packages/orgadmin-ticketing/src/pages/__tests__/EditTicketingSettingsPage.populate.property.test.tsx`
    - Generate random `EventTicketingConfig` objects using `fast-check`
    - Mock the API to return the generated config, render the edit settings page
    - Verify each form field's value matches the corresponding config property
    - **Property 10: Edit settings form is populated with current config values**
    - **Validates: Requirements 8.1, 8.2, 8.3**

  - [ ]* 5.3 Write property test: save payload contains only ticketing configuration fields
    - Test file: `packages/orgadmin-ticketing/src/pages/__tests__/EditTicketingSettingsPage.save-payload.property.test.tsx`
    - Generate random form states with various field modifications, trigger save
    - Verify the API call payload contains only `UpdateTicketingConfigDto` fields (`generateElectronicTickets`, `ticketHeaderText`, `ticketInstructions`, `ticketFooterText`, `ticketValidityPeriod`, `includeEventLogo`, `ticketBackgroundColor`) and no extraneous event fields
    - **Property 11: Save payload contains only ticketing configuration fields**
    - **Validates: Requirements 8.4**

  - [ ]* 5.4 Write property test: failed save retains form state
    - Test file: `packages/orgadmin-ticketing/src/pages/__tests__/EditTicketingSettingsPage.failed-save.property.test.tsx`
    - Generate random form states, simulate a save failure (mock API to reject)
    - Verify all form field values remain unchanged from their pre-save state and an error message is displayed
    - **Property 12: Failed save retains form state**
    - **Validates: Requirements 8.5**

- [x] 6. Checkpoint — Verify detail page and edit settings page
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. i18n and Routing: Add translation keys and update module registration
  - [x] 7.1 Add translation keys for new pages to all locale files
    - In `packages/orgadmin-shell/src/locales/{locale}/translation.json` for each locale (en-GB, de-DE, fr-FR, es-ES, it-IT, pt-PT):
    - Add `ticketing.overview.title` — "Ticketed Events" (en-GB)
    - Add `ticketing.overview.noTicketedEvents` — "No events have ticketing activated" (en-GB)
    - Add `ticketing.overview.columns.eventName` — "Event Name" (en-GB)
    - Add `ticketing.overview.columns.eventDate` — "Event Date" (en-GB)
    - Add `ticketing.overview.columns.totalTickets` — "Total Tickets" (en-GB)
    - Add `ticketing.overview.columns.scanned` — "Scanned" (en-GB)
    - Add `ticketing.overview.columns.notScanned` — "Not Scanned" (en-GB)
    - Add `ticketing.overview.columns.scanPercentage` — "Scan %" (en-GB)
    - Add `ticketing.overview.columns.actions` — "Actions" (en-GB)
    - Add `ticketing.overview.tooltips.editSettings` — "Edit Ticketing Settings" (en-GB)
    - Add `ticketing.overview.tooltips.viewTickets` — "View Tickets" (en-GB)
    - Add `ticketing.detail.backToOverview` — "Back to Overview" (en-GB)
    - Add `ticketing.settings.title` — "Ticketing Settings" (en-GB)
    - Add `ticketing.settings.backToOverview` — "Back to Overview" (en-GB)
    - Add `ticketing.settings.saveSuccess` — "Ticketing settings saved successfully" (en-GB)
    - Add `ticketing.settings.saveError` — "Failed to save ticketing settings" (en-GB)
    - Add `ticketing.settings.fields.generateElectronicTickets` — "Generate Electronic Tickets" (en-GB)
    - Add `ticketing.settings.fields.ticketHeaderText` — "Ticket Header Text" (en-GB)
    - Add `ticketing.settings.fields.ticketInstructions` — "Ticket Instructions" (en-GB)
    - Add `ticketing.settings.fields.ticketFooterText` — "Ticket Footer Text" (en-GB)
    - Add `ticketing.settings.fields.ticketValidityPeriod` — "Ticket Validity Period (hours)" (en-GB)
    - Add `ticketing.settings.fields.ticketBackgroundColor` — "Ticket Background Color" (en-GB)
    - Add `ticketing.settings.fields.includeEventLogo` — "Include Event Logo" (en-GB)
    - Add `ticketing.errors.invalidEvent` — "Event not found or does not have ticketing activated" (en-GB)
    - Add `ticketing.errors.loadFailed` — "Failed to load ticketing data" (en-GB)
    - en-GB gets English values; other locales get translated placeholder values
    - _Requirements: 1.5, 3.1, 6.2, 8.1, 8.2, 8.5, 8.6, 8.7, 8.8_

  - [x] 7.2 Update module registration with three routes
    - In `packages/orgadmin-ticketing/src/index.ts`:
    - Add lazy imports for `TicketedEventsOverviewPage`, `EventTicketingDetailPage`, and `EditTicketingSettingsPage`
    - Update the `routes` array to register all three pages:
      - `tickets` → `TicketedEventsOverviewPage` (landing page, replaces the current single route)
      - `tickets/:eventId` → `EventTicketingDetailPage` (detail page)
      - `tickets/:eventId/settings` → `EditTicketingSettingsPage` (edit settings page)
    - Update exports to include the new page components
    - Remove or deprecate the old `TicketingDashboardPage` export (keep the file for reference during refactoring)
    - _Requirements: 2.2, 7.4_

- [x] 8. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Property tests use `fast-check` (already available in the project) with `vitest` as test runner
- Existing components `TicketingStatsCards`, `TicketDetailsDialog`, and `BatchTicketOperationsDialog` are reused without changes
- The `EventTicketingDetailPage` is a refactored version of `TicketingDashboardPage` — scoped to a single event via route parameter, with event filter dropdown and event name column removed
- Route paths should NOT include the `/orgadmin` prefix
- Do NOT include `useApi`'s `execute` function in useCallback/useEffect dependency arrays — it returns a new reference on every render
- The existing `PUT /events/:eventId/ticketing-config` endpoint already supports partial ticketing config updates — no backend changes needed for the edit settings page
