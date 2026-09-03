# The new product — the platform in this repository

What the new system does, and the handful of structural facts that make its story different from
version 4's. Read from `.claude/modules/*.md`, `docs/`, `PRODUCT.md` and the code.

> The authoritative technical description is [`.claude/modules/`](../modules/). This file is the
> **commercial** reading of it: what a club gets, in the words a club would use.

---

## 1. The one-line version

A multi-tenant platform where one organisation record carries **events and entries, memberships, a
shop, facility bookings, registrations, ticketing and the payments running through all of them** —
plus a **branded app for the member**, in **six languages**, that works with no signal.

## 2. The five things that are structurally new

Not new features — new *shapes*. Each one is something version 4 cannot be extended into.

### 2.1 The member has an account

Version 4's member fills in a form on a public page and receives an email. Here they have an
identity: a home screen, their entries, memberships, tickets, orders, bookings, registrations and
**payment history**, a profile they maintain, and a basket that survives being closed.

This is the largest single difference and it cuts both ways — see
[what-changed.md](what-changed.md) §2.1, because it also changes who can enter an event.

### 2.2 The member's app is the club's app, and it works offline

`account-shell` is a **PWA**: installable, precached, and readable with no connection. Per-club
primary colour and logo, addressed at `/account/<club>`, so it reads as the club's own rather than
a vendor portal. A cached screen says *when* it was last true rather than pretending; actions that
need the server are disabled with a reason instead of failing.

The concrete payoff a club will recognise: **a ticket renders its QR code at the gate on a phone
with no signal.**

### 2.3 Six languages, and money that follows the organisation type

`en-GB`, `de-DE`, `es-ES`, `fr-FR`, `it-IT`, `pt-PT`. Every user-facing string is a translation key
present in all six — there is a test that fails the build on a missing one.

Currency is fixed by **organisation type**, and card handling fees are configured per organisation
type and per payment method (a fixed amount, a percentage and a tax percentage) in that type's
currency. A federation of clubs in one country is one type with one set of rates.

### 2.4 Capability-shaped installs

Every feature area is a **capability** switched on per organisation. It gates the backend route, the
module, the individual page and the menu item simultaneously — so a club that has not bought
ticketing sees no trace of it, not a greyed-out menu. Thirty-odd capabilities are seeded; a club
with only memberships and a club with everything are both normal installs.

### 2.5 Everything is audited, and the money reconciles

A structured audit trail with a per-organisation viewer: who did what, to which record, when, and
what changed. Payments carry their basket lines, their refunds and their offline-settlement history;
lodgements are read **live from Stripe** and broken down into the payments that made them up.

## 3. What a club gets, area by area

### Always on, for every organisation

| Area | What it does |
|---|---|
| **Form Builder** | Reusable **fields** (15 datatypes, validated on both sides) assembled into **forms**, with field groups and optional **multi-step wizards**. One form is referenced by events, membership types and registration types alike |
| **Settings** | Organisation details, payment settings incl. **Stripe Connect onboarding**, editable **email templates**, branding (colours + logo, with a live preview of the member app), registration-approval settings |
| **Payments** | Every payment across every module in one list, with detail, **four refund scopes**, offline settlement, refunds list, and lodgements |
| **Reports & Analytics** | Dashboard plus events, members and revenue reports, each exporting a **server-built Excel workbook** |
| **Users** | Org-admin users and account users, roles with per-capability permissions, Keycloak invitations, and the **registration approval queue** |
| **Audit log** | The organisation's own trail, scoped by the server |

### Capability modules

| Module | Capability | Highlights |
|---|---|---|
| **Events** | `event-management` | Five-step create wizard; activities with mandatory application forms; **entry eligibility** (anyone / this club's members / any club of the same type); entry windows; per-activity limits, fees, payment methods, T&Cs; clone; grouped entries list; per-entry correction of the answers *and* the entrant's name; Excel export with a column for every form question |
| **Memberships** | `memberships` | Single and **group** membership types; rolling or fixed terms; auto-approve; the member database with **saved filters** shared across the club, bulk operations and labels; server-generated membership numbers |
| **Merchandise** | `merchandise` | Products with **option types** (size, colour) and per-variant stock, quantity rules, delivery rules, image galleries, order lifecycle with history |
| **Calendar bookings** | `calendar-bookings` | Bookable resources with schedule rules, slot configuration, blocked periods; availability **derived, never stored**; reserve/confirm/cancel with history; list and grid views; the club renames the area to what its members call it |
| **Registrations** | `registrations` | Courses, programmes and schemes with their own database, saved filters and batch operations |
| **Ticketing** | `event-ticketing` | Per-event ticket **design** — picture with four placements, three layouts, live preview — QR always readable; **gate scanning** (below) |
| **Announcements** | `org-announcements` | The club's own notices on the member's home screen, scheduled by a window with no separate publish flag |
| **Discounts** | five per-domain capabilities | One discount subsystem shared by events, memberships, merchandise, bookings and registrations, with usage statistics |

### Gate scanning — worth its own paragraph

The club creates a **short-lived link with a six-digit PIN** for one event and sends it to whoever is
on the gate. The steward opens it **on their own phone in a browser** — no app, no install, no
account — gives their **name**, and scans. Every scan carries that name.

Three things version 4's app cannot do:

- **The admission is one atomic statement.** Whether a row comes back from the `UPDATE` *is* the
  decision, so two gates scanning the same code in the same second cannot both admit.
- **It keeps working with no signal.** The manifest downloads at unlock; scans are decided against it
  and queued; the queue drains when signal returns and anything the server then refuses is
  **surfaced**, not dropped.
- **Refusals are recorded and explained** — already used (with when and by whom), wrong event,
  cancelled, withdrawn, expired, not recognised.

**The QR carries a signed token**, not a bare identifier: the ticket, its event and its expiry
under a signature only we can produce. A forged code and a ticket for another event are refused on
sight — offline included — and recorded as what they were, rather than both reading as "not
recognised". Tickets issued before this keep working; nothing is reissued.

`event_activities.tickets_admit` (default 1) sets how many people one ticket admits — a family
ticket for four — and is **copied onto the ticket at issue**, so changing it later does not change
what an already-sold ticket is worth.

### The member's app

Directory of clubs → a club's gateway → account → home screen with announcements, upcoming things
and the basket. Then: browse and enter events, join and renew memberships, shop and orders, book
facilities, register interest, my entries, my tickets (with the QR), my payments and receipts,
profile with password and email change.

**Public pages** need no account at all: the club directory, a club's *What's On*, and each public
event at its own indexable address with `schema.org/Event` structured data and Open Graph tags —
so a club's events are findable in a search engine.

## 4. Facts that hold across the product

- **Multi-tenant with the boundary enforced server-side.** The organisation is resolved from the
  token, never from anything the client sends; every org-admin screen belongs to exactly one
  organisation and the product can always say which.
- **Deleting withdraws rather than destroys.** Membership types, merchandise types, registration
  types and calendars are soft-deleted, because last season's members, orders and bookings still
  have to name what they bought.
- **Offline payments defer what they grant.** An entry, a booking and an order are created when the
  order is placed, in a state that grants nothing; a **membership and a registration are not created
  at all** until an administrator records the money as received, at which point fulfilment runs.
- **The product teaches itself.** Guided first run — a welcome dialog and per-module introductions,
  with "seen" state stored **server-side** so it follows the person to their next device — is
  committed surface, because there is no implementation project and nobody to ask.
- **One theme, warm palette, sentence case, no zebra striping, stacked rows below `md`.** The visual
  world is settled and specified in `DESIGN.md`.
- **The mark is a stylised sail** — approved 13 August 2026 — and it is the *only* place the product
  may lean on sailing. See [messaging.md](messaging.md) §5.

## 5. What is not built yet

Stated here so it is never claimed. Live list; keep it honest.

- Booking detail and registration detail screens in the member app (each a card's worth of facts
  already on its list screen).
- Keycloak's login page is not yet branded per club and does not receive the locale.
- No stored default organisation, so a bare `/account` always shows the directory.
- `TicketingDashboardPage` exists but is not bound to a route.
- Ticket **resend by email** was removed rather than left claiming to work; rebuilding it is
  separate work.
- A refund here is a **record**; nothing in this codebase reverses a charge with Stripe.
- No agreed accessibility standard. WCAG AA is the working floor, unconfirmed by audit.
- Everything in [what-changed.md](what-changed.md) §3 — the version 4 features with no equivalent
  yet.
