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
    GateScanningPanel             The scanning link, its PIN, and who is scanning
  (ticketGeneration.ts moved to packages/components — see below)
  types/          ticketing.types, module.types
```

## Concepts

- **Ticketing configuration per event** — header text, instructions, footer, validity period,
  logo inclusion, background colour. Stored in `event_ticketing_config`; the same fields appear on
  the event form's ticketing step, so the two must stay consistent.
- **Electronic tickets** — rows in `electronic_tickets`, issued against event entries. One per
  entry on a ticketing event, written by `fulfilment.service` calling
  `ticketingService.issueTicketForEntry` after the entry is created.
- **Scanning** — each scan is appended to `ticket_scan_history`, which drives the validity and
  duplicate-use reporting. A gate's scans arrive through `/api/scan/*`; the club's own *Mark as
  scanned* goes through `PUT /tickets/:id/scan-status`. **Both now record who did it and both
  enforce the ticket's `admits` ceiling atomically** — the second did neither until
  [MARKING_A_TICKET_SCANNED.md](../../docs/MARKING_A_TICKET_SCANNED.md). Undoing an admission
  decrements the count rather than only relabelling, so a correction gives the place back.
- **Scanning sessions** — a club creates a short-lived link with a PIN for one event
  (`GateScanningPanel`), sends it to whoever is on the gate, and can see who is scanning and stop the
  link. The scanner itself lives in `account-shell`. See
  [GATE_SCANNING.md](../../docs/GATE_SCANNING.md).

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
| "How do I see any of this working?" | The seed issues tickets on three Meath events: **Dunshaughlin Gate Day (completed)**, twelve days ago, carrying the scans — one presented twice, one never used, one cancelled; **Dunshaughlin Gate Day (today)**, running now, with four tickets **valid and unscanned** and two already admitted; and the upcoming **Tara Hunter Trial**, issued and unscanned. The middle one is the only fixture the scanner can actually be tried against: a past ticket is expired and a future one cannot honestly be scanned. See [SEED_TICKETS.md](../../docs/SEED_TICKETS.md) |
| "Where did Include Event Logo go?" | Removed, along with its column, both checkboxes (settings **and** the event form's ticketing step) and its locale keys. No template ever drew a logo — the one that could have took a `logoURL` nothing passed — so it was a setting a club could turn on and see no difference from. The ticket image with its four placements is what it was reaching for |
| "How does a club design its ticket?" | Ticketing settings: a **picture** with four placements — `header`, `footer`, `topRight`, `background` (darkened by a scrim, as an announcement's is) — and three **layouts**, `stacked`, `sideBySide`, `compact`. The screen shows a **live preview** rendered by `renderTicketHTML`, the same function that prints. See [TICKET_DESIGN.md](../../docs/TICKET_DESIGN.md) |
| "What does a ticket with both a picture and a colour look like?" | The picture. A `background` placement **replaces** the colour and paints on near-black; the colour is kept for `header`, `footer` and `topRight`, where the picture sits *on* the ticket rather than being it. They used to be applied together, which left the colour showing round the picture and the picture lost under a heavy scrim |
| "How does a gate scan tickets?" | A club creates a link and a PIN here (`GateScanningPanel`, above the ticket list); a steward opens it on their own phone at `/account/scan/:token`, gives their name, and scans. The gate's decision is one atomic `UPDATE` in `gate-scan.service` — see [GATE_SCANNING.md](../../docs/GATE_SCANNING.md). The options that were weighed first, including the ones not taken, are in [TICKET_SCANNING_OPTIONS.md](../../docs/TICKET_SCANNING_OPTIONS.md) |
| "How many scans does one ticket allow?" | `electronic_tickets.admits`, copied at issue from `event_activities.tickets_admit` (default 1, set per activity in `orgadmin-events` as **Scans allowed per ticket**). Copied rather than joined: a club that changes the activity in March must not change what a February ticket is worth. **Both the gate and the org-admin's Mark as scanned enforce it** — the second did not until [MARKING_A_TICKET_SCANNED.md](../../docs/MARKING_A_TICKET_SCANNED.md) |
| "Why did the Scanned by column show a dash?" | `updateTicketScanStatus` wrote `scanned_by` — a foreign key — from `req.body.scannedBy`, which the dialog never sent, and never wrote `scanned_by_name`, which is the column the table renders. The administrator now comes from the verified request (`byResource` has already set their `organization_users.id`) and both are written: the id for the key, the name for a trail that has to outlive the row it points at |
| "Why are both Mark as scanned and Mark as not scanned showing?" | The ticket admits more than one and has room. The buttons used to be keyed on `scanStatus`, so admitting the first of four left only *undo* and the other three could not be let in from this screen. Admitting is offered while there is room, undoing while anything has been used; a one-use ticket still shows exactly one |
| "Who scanned a ticket?" | The Scanning tab's history, `scanned_by_name` — the steward's own typed name, written onto the row rather than joined, because the device is deleted with its session and the history has to outlive it |
| "Where do I see the ticket a member actually gets?" | The ticket dialog's first tab, rendered by `renderTicketHTML` from the club's design — the same HTML the printer is handed. Scan status, dates, count and history are on the second tab; the holder's name and reference sit in the header, true on both |
| "Why is a dark ticket readable?" | `isDark()` weighs the background by luminance and the whole ticket takes light text from it — a scrim and a club's own dark colour are the same problem. It used to key off the image placement alone, so a club whose ticket colour was a deep green got near-black text on it |
| "What does the QR actually contain?" | A **signed token** — the ticket's identifier, its event and its expiry, under an HMAC — 72 characters where it used to be a bare 36-character UUID. `qr_code` is unchanged and is still what every lookup and the gate's `UPDATE` match on; the printed string is `qr_token`, and a ticket issued before signing has none and keeps its UUID. So a gate can refuse a forgery and a ticket for another event *before* looking anything up, and `forged` is a refusal reason a club can read afterwards. HMAC rather than a public-key signature because nothing but the server needs the key: the scanner recognises our codes from its manifest. See [SIGNED_TICKET_CODES.md](../../docs/SIGNED_TICKET_CODES.md) |
| "Why is the QR drawn wider than it was?" | The code doubled in length, which takes it from about QR version 3 to version 6 — more modules in the same square. `generateQRCodeDataURL` defaults to 360px (was 300) and the member's own ticket to 320px (was 260), so a module stays roughly the physical size it was. Error correction stays at `M`; raising it would add another version and undo the change |
| "Can the QR code be restyled?" | No, and deliberately. It sits on a white panel with white padding in every layout and under every placement: a scanner reads dark on light, and a ticket that will not scan has failed at a gate with a queue behind it. The settings screen says so rather than letting a club expect otherwise |
| "Where does the ticket get the event's name and dates?" | `ticketingService.getTicketForRendering` — the ticket **joined** to its event, its activity and the club's design, behind `GET /tickets/:id/render`. Not copied into `ticket_data` at issue: that would leave every ticket already issued blank and freeze a description the club later corrects. The date is one date when the event starts and ends the same day, two when it does not |
| "Why did Mark as Scanned / Download PDF do nothing?" | Both called endpoints that do not exist — `POST …/mark-scanned` and `GET …/download-pdf` — and `useApi.execute` answers `null` on an error, so the dialog read each refusal as success and closed. Marking now uses **`PUT /tickets/:id/scan-status`** (the endpoint that exists) with `throwOnError`, and reports a refusal on the dialog. The PDF is built in the browser from the shared `generateTicketPDFHTML` and printed — there is no PDF engine in the backend — so the button says **Print / Save as PDF** |
| "What happened to Resend Email?" | Removed. `POST …/resend-email` has never existed and the button announced *"Ticket email resent successfully"* whatever came back, so a club that thought it had re-sent a ticket had not. Building the resend is separate work |
| "Do the batch actions work?" | They do now. `POST /tickets/batch-operation` was never a route either; the dialog loops `PUT /tickets/:id/scan-status` per ticket and reports which one failed, which is what its result panel was already shaped to say |
| "Why does the Activity column say Not available?" | `electronic_tickets.ticket_data` is written as `{}` and the rows are returned unjoined, so the ticket does not know its own activity — or its event. The event's name is passed into the ticket dialog by the page that knows it; the activity is still unfilled |
| "Why does a club see no Ticketing menu?" | `event-ticketing` is a Meath-only capability in the fixture — Kildare, Laois and Ward Union deliberately leave things switched off so "capability absent" stays represented. Sign in to **Meath Hunt Pony Club** to see any of it |
| "Why is a duplicate not a `scan_result`?" | Through the **gate** it is: `gate-scan.service` writes `'refused'` with a `refusal_reason` of `already_used`, and the dialog shows that. Through the older `updateTicketScanStatus` it still is not — that path writes `'success'` for every scan, so a ticket marked twice by hand is `scan_count = 2` with two indistinguishable rows. The front-end type still declares `'valid' \| 'invalid' \| 'already_scanned' \| 'expired'`, which neither path produces |
| "Why is a ticket valid for weeks after a one-day event?" | `ticket_validity_period` is added to the event's **last day, in days**, while the form calls it *"(hours)"* and describes it as hours *before* the start. The two disagree; see [SEED_TICKETS.md](../../docs/SEED_TICKETS.md) |

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
