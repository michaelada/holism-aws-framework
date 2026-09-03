# Account User Application — member-side ticketing (G11, C9, C10)

`orgadmin-ticketing` has had `electronic_tickets`, `event_ticketing_config` and
`ticket_scan_history` since migration 1707000000010. What did not exist was any way for a **member**
to get at their ticket. This phase closes that: a ticket is issued automatically when an entry is
confirmed, and the member can see it and present it at a gate.

Specified by [G11](ACCOUNT_USER_APP_WIREFRAMES.md), screens
[C9](ACCOUNT_USER_APP_WIREFRAMES.md) (My Tickets) and C10 (a ticket).

## 1. Nothing had ever issued a ticket

Worth stating plainly, because the wireframes say tickets are "issued from the org-admin side":
they were not. `grep "INSERT INTO electronic_tickets"` across the backend returned nothing. The
table, its indexes and its service existed; the write did not. `ticketGeneration.ts` built ticket
data **client-side for preview** only.

So this is not a matter of surfacing existing rows. The issuance path is new.

## 2. Issuance happens where the entry is created — which is not always where the money lands

`ticketingService.issueTicketForEntry(entryId)`, called from `fulfilment.service.ts` immediately
after the entry row is created. What changed is *when fulfilment runs*, which differs by how the
order is being paid for:

| Order | Fulfilled — and ticketed — when | Why |
|---|---|---|
| **Card** | Stripe confirms the payment (`payment_intent.succeeded`) | The money lands seconds after checkout, so waiting costs the member nothing |
| **Offline** (nothing charged to card) | **Checkout completes** | A cheque may take weeks to arrive and be recorded; leaving the member with no entry and no ticket to bring on the day is the wrong trade |

An offline order therefore gets its entry and its ticket at the moment it is placed. Nothing claims
it has been paid for: the entry is written `pending` / `offline`, and the ticket reads **awaiting
payment** until the club records the money.

**Only entries are created ahead of the money.** A membership is an entitlement that runs for a year
and has no gate to check on the day, so granting one before payment gives it away. Those lines are
**deferred, not failed** — left unfulfilled, with no error recorded, and picked up when the payment
is recorded. `FulfilmentOutcome.complete` stays false so a later run knows to come back.

Payments that are neither `paid` nor `awaiting_offline` — pending card, failed, refunded — are still
refused outright.

**Issuance cannot break fulfilment.** The call is wrapped, and a failure is logged rather than
thrown. The entry exists and is already committed; letting a ticketing problem mark the line failed
would show the member a failed order for one that went through — far worse than an entry whose
ticket has to be issued by hand. The same reasoning applies one level up: a fulfilment failure does
not fail the offline checkout itself.

**Unticketed events return null, not an error.** Most events do not issue tickets. That is the
normal case, and fulfilment must not fail because of it.

### Recording an offline payment later

When the club records the money (screen I2), two things need to happen: the remaining deferred lines
fulfil, and the **entry's own `payment_status` moves to `paid`** so its ticket stops reading
"awaiting payment". Ticket state is derived from that column, so nothing needs to touch the ticket
itself.

**That screen and its endpoint do not exist yet** — the only other caller of `fulfilPayment` is the
Stripe webhook. Re-running `fulfilPayment` after marking the payment paid covers the first half; the
entry status update is the part still to build.

## 3. Migration 1709000000015

Two things the table lacked once a server had to write to it:

- **A sequence for `ticket_reference`.** The format is `TKT-YYYY-NNNNNN` and the column is UNIQUE.
  Deriving the number from a count of existing rows races: two payments confirmed in the same
  instant read the same count and one insert dies. A sequence cannot hand out the same value twice.
- **`UNIQUE (event_entry_id)`.** Stripe resends webhooks. Without it, a replayed
  `payment_intent.succeeded` issues a second ticket for the same entry, and the member holds two QR
  codes that both scan valid with no way for the gate to tell which one it already admitted. The
  insert is `ON CONFLICT DO NOTHING`, so a replay returns the existing ticket.

That constraint encodes "an entry has at most one ticket", true today because fulfilment creates
entries with `quantity` 1. If entries for a party of four ever issue four tickets, this is the thing
to revisit — it is the only place the assumption is written down.

## 4. Four states, computed in SQL

| State | Meaning | What the member can do |
|---|---|---|
| `valid` | Will scan | Nothing |
| `awaiting-payment` | Entry not yet paid | Pay, or wait for the club to record it |
| `used` | A scan exists | Nothing — it worked |
| `expired` | Past `valid_until` | Contact the club |

Computed in one SQL expression shared by the list and the detail endpoints, so the two screens
cannot disagree about whether a ticket is usable — they are looked at seconds apart at a gate.
`used` wins over `expired`: a member wants to know the ticket worked, not that it has since lapsed.

**Used and expired tickets are returned, never hidden.** A member whose ticket will not scan is the
person most in need of the screen, and an empty screen at a gate is indistinguishable from a broken
app.

## 5. Endpoints

| Method | Path | Capability |
|---|---|---|
| GET | `/api/account/:orgCode/tickets` | `event-ticketing` |
| GET | `/api/account/:orgCode/tickets/:ticketId` | `event-ticketing` |

Both scope every query by organisation **and** by the caller's `organization_users.id`. A ticket is
a bearer credential — whoever holds the QR walks in — so a ticket id must never be sufficient on its
own. A ticket belonging to another member returns 404, identical to one that does not exist:
distinguishing them would confirm to someone enumerating ids that a given ticket is real.

The detail endpoint returns the QR payload, the entrant, and the organisation's
`event_ticketing_config` in one response, so the ticket screen renders from a single call and the
whole thing can be cached for a gate with no signal.

## 6. Front end

Two pages in `account-shell`, routed at `/:orgCode/tickets` and `/:orgCode/tickets/:ticketId` behind
`CapabilityGate anyOf={['event-ticketing']}`, plus a "My Tickets" nav item under My Activity.

**Gated on `event-ticketing`, not `event-management`** — a club can run events without issuing
tickets, and a My Tickets page that is always empty is worse than no page.

**Deviation from the design worth recording.** G11 calls for an `account-ticketing` *package* gated
on the capability, mirroring the org-admin module registry. `account-shell` has no module registry —
every account screen built so far is a page in `account-shell/src/pages` gated by `CapabilityGate`.
Introducing a package for this one feature would leave one module in a registry that does not exist
(CLAUDE.md §1.7). If a registry is added later, these two pages move into it unchanged.

**The QR is drawn on the device** from the payload rather than fetched as an image, which is what
lets the screen work offline once the response is cached. An `<img src="/api/…/qr.png">` would need
the network at exactly the wrong moment.

### Screen brightness: not implemented, deliberately

C10 asks for the screen to be brightened while a ticket is open, because gate scanners fail on dim
phones. **No browser exposes brightness control** — it is a native-shell capability. Rather than
fake it, the page takes a `navigator.wakeLock` so the screen does not sleep in a queue, which is the
part the web can actually do and the more common failure anyway. If this app is ever wrapped
natively, brightness is the thing to add here.

## 7. `ticketGeneration.ts` moved to `packages/components`

Per CLAUDE.md §1.5. Both front ends now render the same ticket, and two implementations of one
ticket is exactly the drift that ends with a QR code that scans in one app and not the other.

`orgadmin-ticketing` re-exports the same names from `@itsplainsailing/components`, so existing
imports keep working — the module boundary changed, not the API. Its tests moved with it.

The reference format now lives in two places by necessity: `validateTicketReference` on the client
and the `TKT-YYYY-NNNNNN` construction in SQL. A test in `packages/components` asserts the client
accepts what the sequence produces.

## 8. Not in this phase

- **Offline precaching** (Part 5 of the wireframes). The response is shaped for it — one call, whole
  ticket — but there is no service worker in `account-shell` at all; PWA is its own phase.
- **Apple/Google Wallet passes.** Explicitly not v1: they need pass-type certificates per
  organisation.
- **PDF download.** `generateTicketPDFHTML` is available from `packages/components` now, but no
  member-facing download is wired up.

## 9. Tests

| Suite | Covers |
|---|---|
| `ticketing.issuance.test.ts` (7) | Issues on a ticketed event; returns null for unticketed and unconfigured events; idempotent under replay; reference comes from the sequence; validity period extension |
| `account-ticketing.service.test.ts` (9) | Response shape, organisation + caller scoping, ordering, cancelled exclusion, state computation, another member's ticket returning null |
| `fulfilment.service.test.ts` (+10) | Issues for the entry just created; still fulfils when ticketing throws; does not issue for a membership; offline orders fulfil unpaid and record `pending`/`offline`; card orders still record `paid`/`card`; memberships deferred not failed; failed payments still refused |
| `checkout.service.test.ts` (+3) | Offline checkout fulfils; a fulfilment failure still completes the order; a card order does not fulfil at checkout |
| `MyTicketsPage.test.tsx` (7) | Loading, grouping, navigation, used/expired shown, empty and failure states |
| `TicketPage.test.tsx` (7) | Loads by id, renders org configuration, QR from payload, used/expired/awaiting banners, not-found |
| `components/utils/ticketGeneration.test.ts` (12) | Moved with the code, plus agreement with the backend reference format |

Translations added to all six account-shell locales.
