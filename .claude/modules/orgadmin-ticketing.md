# `packages/orgadmin-ticketing` — Event ticketing capability module

Electronic tickets for events: per-event ticketing settings, ticket issue and lookup, scanning
history and ticketing statistics.

- **Capability:** `event-ticketing`.
- **Depends on** `orgadmin-events` conceptually — tickets belong to events, and the event form's
  ticketing section (`EventTicketingSection`) writes the configuration this module reads.
- **Tests:** Vitest — `npm run test:orgadmin-ticketing` (~2 test files; the least-covered package —
  add tests with any new work).

## Routes (`src/index.ts`)

| Path | Page |
|---|---|
| `tickets` | `TicketedEventsOverviewPage` |
| `tickets/:eventId` | `EventTicketingDetailPage` |
| `tickets/:eventId/settings` | `EditTicketingSettingsPage` |

`TicketingDashboardPage` exists and is exported from `src/index.ts`, but is **not currently bound to
a route** — worth knowing before assuming it is reachable.

## Layout

```
src/
  index.ts        ticketingModule registration
  pages/          TicketingDashboardPage, TicketedEventsOverviewPage,
                  EventTicketingDetailPage, EditTicketingSettingsPage
  components/
    TicketingStatsCards           Issued / scanned / remaining counters
    TicketDetailsDialog           A single ticket
    BatchTicketOperationsDialog   Bulk ticket actions
  (ticketGeneration.ts moved to packages/components — see below)
  types/          ticketing.types, module.types
```

## Concepts

- **Ticketing configuration per event** — header text, instructions, footer, validity period,
  logo inclusion, background colour. Stored in `event_ticketing_config`; the same fields appear on
  the event form's ticketing step, so the two must stay consistent.
- **Electronic tickets** — rows in `electronic_tickets`, issued against event entries.
- **Scanning** — each scan is appended to `ticket_scan_history`, which drives the validity and
  duplicate-use reporting.

## Data it touches

`/api/orgadmin` ticketing endpoints plus event data. Backend: `ticketing.service`, with
`event.service` / `event-entry.service` supplying the underlying entries. Tables:
`event_ticketing_config`, `electronic_tickets`, `ticket_scan_history`.

## Where to look for what

| Question | Start at |
|---|---|
| "Where are per-event ticket settings edited?" | `pages/EditTicketingSettingsPage.tsx`, and `EventTicketingSection` in `orgadmin-events` |
| "How is a ticket rendered?" | `utils/ticketGeneration.ts` in **`packages/components`** |
| "Where do scan counts come from?" | `components/TicketingStatsCards.tsx` → `ticket_scan_history` |

## Ticket generation is shared, and issuance is the backend's

Two things changed when the account-user app gained member-side tickets
([docs/ACCOUNT_USER_APP_PHASE9_TICKETS.md](../../docs/ACCOUNT_USER_APP_PHASE9_TICKETS.md)):

- **`ticketGeneration.ts` lives in `packages/components`** (CLAUDE.md §1.5). Both front ends render
  the same ticket, and two implementations of one ticket is the drift that ends with a QR code that
  scans in one app and not the other. This package re-exports the same names, so existing imports
  are unaffected.
- **Tickets are issued by `fulfilment.service.ts`**, automatically, when an event entry is
  confirmed — not from this module. Before that, nothing in the system had ever written to
  `electronic_tickets`: the table and service existed, the insert did not. This module reads and
  scans tickets; it does not create them.

`electronic_tickets` now has `UNIQUE (event_entry_id)` and its references come from
`electronic_ticket_reference_seq` (migration 1709000000015). One entry means one ticket — worth
knowing before adding bulk issuance here.
