# Phase 11 — completing the member-facing catalogue

The account-user app can enter events and apply for memberships. It cannot buy merchandise, book a
calendar slot, or register an interest — the menu offers all three, and every one of them leads
nowhere. This phase closes that gap.

The design is not new work: screens **D7–D13**, **C6–C8** and **F1–F3** are already specified in
[ACCOUNT_USER_APP_WIREFRAMES.md](ACCOUNT_USER_APP_WIREFRAMES.md). What follows is what each area
needs in order to exist, and the order they are being built in.

## What is already there

Everything below the waterline. The club-facing side of all four areas shipped long ago, so the
tables, the business rules and the org-admin screens exist and are in use:

| Area | Tables | Service with the rules |
|---|---|---|
| Merchandise | `merchandise_types`, `merchandise_option_types`, `merchandise_option_values`, `merchandise_orders` | `merchandise.service` — `calculatePrice`, `validateQuantity`, `createOrder` (stock included) |
| Calendar | `calendars`, `time_slot_configurations`, `bookings`, `slot_reservations` | `calendar.service` |
| Registrations | `registration_types`, `registrations`, `registration_filters` | `registration.service` |
| Memberships | `membership_types`, `members` | `membership.service` |

The basket is already general: `cart_items.item_type` allows `event_entry`, `membership`,
`registration`, `booking` and `merchandise`, and carries `quantity`, `context_ref`,
`form_submission_id` and a per-item payment method. Checkout, handling fees, discounts and the
payment webhook do not care what the line is for.

## What is missing, and it is the same three things each time

1. **A catalogue endpoint.** `account-catalogue.service` knows about events and membership types
   only. A member cannot see what is for sale.
2. **A fulfilment case.** `fulfilment.service.fulfilLine` handles `event-entry` and `membership`;
   everything else throws "Fulfilment is not implemented". A paid merchandise line would take the
   money and produce no order.
3. **The screens.** `/shop`, `/book` and `/register-interest` are in the nav model with no route
   behind them, and there is no My Orders or My Registrations page.

Two smaller gaps sit alongside: **C4's "Renew" points at `/:orgCode/join`, which does not exist**,
and the **`/payments`** menu item (F1–F3) has no route either.

## Order of work, and why

Each area is a vertical slice — catalogue, fulfilment, screens, tests — delivered end to end before
the next starts. A half-built area is worse than an absent one: the menu item appears, the member
clicks it, and the failure is theirs to discover.

| # | Area | Why here |
|---|---|---|
| 1 | **Merchandise** (D9, D10, C8) | The simplest complete purchase — pick options, pick a quantity, pay. It is the first line type with a real quantity and the first that consumes stock, so it proves the basket and fulfilment path for everything after it. |
| 2 | **Calendar bookings** (D11, D12, D13, C3) | The hardest: availability is computed from a slot configuration, and two members can want the same slot. Needs the soft-hold (`expiresAt`, `slot_reservations`) the cart already supports but nothing yet uses. |
| 3 | **Registrations** (D7, D8, C6, C7) | Closest to the membership flow already built — apply, possibly pay, possibly wait for approval. |
| 4 | **Membership renewal** (`/join`, C5) | Small, and finishes an area that is otherwise complete. |
| 5 | **My Payments** (F1–F3) | Not in the brief for this phase, but it is the last dead menu item. |

## Rules that hold for every area

- **Availability is decided on the server** (G8). The catalogue returns `available` plus an explicit
  `unavailableReason`; the cart re-checks at the moment of adding, because the listing a member is
  looking at may be minutes old. Filtering rows out of the list is not the same thing — a member
  looking for something they know exists is better served by "out of stock" than by an empty page.
- **Every money figure comes from the server.** Prices, delivery fees and handling fees are computed
  by the service that will take the money.
- **Nothing is fulfilled by the browser.** The order, booking or registration is created by
  `fulfilment.service` when the payment is confirmed, exactly as entries and memberships are.
- **Capability-gate the routes, not just the menu.** Hiding a menu item is presentation; a member can
  still type the URL.
- **Six locales, every key** (CLAUDE.md §3.2).

---

## 1. Merchandise — delivered

### Requirements

| # | Requirement |
|---|---|
| M1 | A member sees what the club sells, with a price, an image and whether it can be bought right now |
| M2 | Items the club has withdrawn, or that are out of stock, are shown with the reason rather than hidden |
| M3 | Choosing options (size, colour) changes the price, because the price lives on the option value |
| M4 | Quantity respects the club's minimum, maximum and increment rules |
| M5 | An item may require an application form and may require terms to be accepted |
| M6 | Delivery is priced by the club's rule — free, fixed, or by quantity — and shown before the basket |
| M7 | Paying creates a `merchandise_order` and consumes stock; nothing else may create one |
| M8 | A member can see the orders they have placed and what has happened to them |

### Design

**Catalogue** — `GET /api/account/:orgCode/catalogue/merchandise` returns each active item with its
option types and values (name, price, stock), the quantity rules, the delivery rule, the form id,
the terms, and `available` / `unavailableReason`. Prices are converted to minor units here, where
every other price in the basket already lives.

`out_of_stock_behavior` decides what "out of stock" means: `hide` withdraws the item from the
catalogue entirely (the club's choice, so it is honoured), anything else shows it as unavailable.

**Availability** — `assertMerchandiseAvailable` re-runs the same rules when the line is added,
including a stock check against the specific option values chosen.

**Fulfilment** — `case 'merchandise'` calls `merchandiseService.createOrder`, which already
validates the quantity, prices the order from the option values, checks stock and decrements it. The
line's `context_ref` carries `{ merchandiseTypeId, selectedOptions }`, its `quantity` carries the
count, and its `form_submission_id` carries the answers.

**A payment line had to start carrying the whole basket line** (migration `1709000000020`).
`cart_items` has `context_ref` and `quantity`; checkout copied neither, reducing the line to a single
`context_id` uuid. That is enough for an entry or a membership — one id identifies both — and enough
for nothing else. Fulfilment runs *after* payment, from the payment line alone, and by then "one club
polo" had lost the size and "three of them" had lost the three. The basket row is not a fallback: it
is emptied at checkout, and a webhook redelivered days later must still be able to create the order.
Both columns are additive and nullable, and they unblock bookings and registrations too.

**Stock is consumed at fulfilment, not at add-to-cart.** A basket is not a reservation — holding
stock for an abandoned basket takes the last shirt off the shelf for everybody else. The catalogue
re-checks stock when the line is added, which narrows the window without pretending to close it; if
the last one goes in between, the line fails with a reason rather than overselling silently.

**The cart guard was written and never wired.** `assertActivityAvailable` existed, unused, so the
basket accepted whatever it was posted. `POST /cart/items` now dispatches on item type through
`assertAddable` — the merchandise check (item on sale, one value per option list, quantity within
the club's rules, stock present) and, at last, the event-entry one.

**Screens**

| Screen | Route | Notes |
|---|---|---|
| D9 Shop | `/:orgCode/shop` | Image, name, from-price, availability chip |
| D10 Item | `/:orgCode/shop/:itemId` | Options, quantity, live price, form, terms, add to basket |
| C8 My Orders | `/:orgCode/orders` | What was ordered, when, what it cost, where it has got to |

The price on D10 is computed in the browser *for display only* — the same arithmetic runs again in
`createOrder`, and that is the one that decides what is charged.

### Tasks

- [x] `account-catalogue.service`: `listMerchandise`, `assertMerchandiseAvailable`
- [x] `account-activity.service`: `listMerchandiseOrders`
- [x] Routes: `GET /catalogue/merchandise`, `GET /orders`
- [x] `fulfilment.service`: the `merchandise` case
- [x] `ShopPage`, `ShopItemPage`, `MyOrdersPage`, routes, nav entry for My Orders
- [x] Six locales
- [x] Migration `1709000000020` — `payment_transactions.context_ref` and `.quantity`
- [x] `POST /cart/items` guards both merchandise and (finally) event entries
- [x] Tests: catalogue, fulfilment, routes, and the three pages
- [x] Docs and module summaries

### Tests

| Suite | Covers |
|---|---|
| `account-catalogue.merchandise.test.ts` (23) | From-price arithmetic, sold-out vs withdrawn, the `hide` rule, and every refusal `assertMerchandiseAvailable` makes |
| `fulfilment.service.test.ts` (+7) | The order goes through `merchandiseService`, carries the options, quantity and form; out-of-stock and missing-context failures are recorded against the line, not thrown |
| `account-merchandise.routes.test.ts` (9) | Capability gating on both endpoints, and the basket guard for merchandise, entries, and types with no catalogue |
| `ShopPage.test.tsx` (9) | From-price, sold-out labelling, empty and failed states |
| `ShopItemPage.test.tsx` (20) | Price from options, quantity rules, stock, forms, terms, what reaches the basket, server refusals |
| `MyOrdersPage.test.tsx` (7) | The two statuses, options as names, empty and failed states |

**Numbers to know when reading these:** an item has no price of its own — only its option values do,
so the list can quote only a *from* price and the detail screen cannot quote anything until every
option is answered. Money is minor units from the database boundary inwards.

---

## 2. Calendar bookings — delivered

### Requirements

| # | Requirement |
|---|---|
| B1 | A member sees what the club has to book, and the rules that apply before choosing a time |
| B2 | A week of availability at a time, with taken slots shown rather than hidden |
| B3 | Availability respects the schedule, blocked periods, the club's notice period and how far ahead it takes bookings |
| B4 | A slot already booked — or held mid-checkout by somebody else — cannot be booked again |
| B5 | Two members racing for the same slot must not both get it |
| B6 | Paying creates a `booking`; nothing else may create one |

### Design

**Availability is derived, never stored.** There is no table of slots: the schedule, the blocked
periods, the confirmed bookings and the live holds are subtracted to produce them. That is why this
could not be a query.

**The calculator is a deliberate second implementation.** The org-admin app computes availability in
the browser (`orgadmin-calendar/src/utils/slotAvailabilityCalculator.ts`) because it is drawing a
grid for an administrator. A member's booking cannot be decided in the browser, so the rules also
live in `backend/src/utils/slot-availability.ts` as a pure function. The two must agree; both are
tested against the same cases, and the backend's own suite pins the ones a naive implementation gets
wrong — recurrence, effective dates, closures that wrap past midnight, and an overlapping booking of
a *different length* taking a slot out entirely.

Rules, in the order they apply: **generate** → **block** → **window** → **occupy** → **hold**.

**Three chances to lose the race, and all three are checked:**

| When | What |
|---|---|
| Drawing the week | The catalogue marks taken slots `full`, `in-use` or `held` |
| Adding to the basket | `assertSlotAvailable` re-runs for that one day, and refuses with the reason |
| Fulfilment, after payment | It runs **again** — between adding and paying, somebody else may have taken it |

The last one matters most. Losing there leaves a member to refund; *not* checking there leaves the
club with two bookings on one court. A refund is recoverable; a double-booked Saturday morning is a
person turned away at the gate.

**A week, not a month.** A month of a calendar with half-hour slots is several thousand rows and an
unreadable wall; the endpoint refuses a range longer than 62 days, because the work is proportional
to it.

**Nothing is held when a member picks a slot.** `slot_reservations` exists and is *read* — an
administrator's hold blocks a member — but the member's own journey does not write one. Holding on
selection means an abandoned basket takes a court off the market, and the check-on-add plus
check-on-fulfil covers the same ground without that cost.

| Screen | Route | Notes |
|---|---|---|
| D11 Calendars | `/:orgCode/book` | Name, colour, notice period, how far ahead, cancellation policy |
| D12/D13 Availability and booking | `/:orgCode/book/:calendarId` | A week of slots, the chosen one summarised, terms, add to basket |

D12 and D13 are one screen: choosing a time *is* the booking form, and a separate confirm page would
be a click that adds nothing.

### Tasks

- [x] `utils/slot-availability.ts` — the server's calculator
- [x] `account-catalogue.service`: `listCalendars`, `listCalendarAvailability`, `assertSlotAvailable`
- [x] Routes: `GET /catalogue/calendars`, `GET /catalogue/calendars/:id/availability`
- [x] `POST /cart/items` guards bookings
- [x] `fulfilment.service`: the `booking` case, re-checking availability first
- [x] `BookPage`, `BookCalendarPage`, routes
- [x] Six locales
- [x] Tests: 28 calculator, 14 catalogue, 7 fulfilment, 10 route, 19 pages

**A bug the tests caught:** reloading the week after a refused add cleared the very error explaining
why the screen had changed. The refusal is now set *after* the reload.

## 3. Registrations — delivered

### The thing that makes this area different

**A registration is of a *thing*, not of a person.** A horse, a boat, a dog. `registration_types`
carries `entity_name` — the club's own word for that thing — and every screen uses it verbatim:
"Registers a horse", "Horse name", "Give the name of the horse". The same pages read correctly for a
boat club because nothing is hard-coded to one domain.

Two consequences follow, and both are load-bearing:

| | Membership | Registration |
|---|---|---|
| Holding one already | Bars a second (`already-a-member`) | Bars nothing — a member with two horses registers twice |
| The record's identity | The member | `entity_name`, which is NOT NULL |

The name is therefore a **first-class field on D8**, not one of the club's form questions. It is what
the member, the club and every list identify the record by — "Rocket", not "registration #48". A club
that also wants the horse's age asks for that on its own form.

### Requirements

| # | Requirement |
|---|---|
| R1 | A member sees what the club will register, priced, with how long it lasts |
| R2 | A rolling scheme and a fixed-period one say different things about duration |
| R3 | A club that reviews registrations says so **before** payment |
| R4 | Registering names the thing, answers the club's form and accepts its terms |
| R5 | Paying creates a `registration` — `active`, or `pending` when the club reviews |
| R6 | A member sees what they have registered and whether it is yet in force |

### Design

**`automaticallyApprove` decides the status at fulfilment**, not the payment. A scheme that reviews
its registrations creates a `pending` row: the member has paid and is in the queue, not registered.
Creating it `active` would hand out something the club meant to look at first, and there is no later
gate to catch it. D8 says so before the member pays — paying and *then* discovering there is a wait
is the complaint this avoids.

**C6 shows two statuses**, as C8 does: the shared chip answers "have I paid?", the club's own
`registrationStatus` answers "has it been approved?". Neither word can carry the other. The second
chip appears only while `pending` — "Active" beside "Confirmed" is the same news twice.

`status` needed no special case for an elapsed registration: its `valid_until` is in the past, which
the shared vocabulary already reads as `completed`.

| Screen | Route |
|---|---|
| D7 Registration types | `/:orgCode/register-interest` |
| D8 Register one | `/:orgCode/register-interest/:typeId` |
| C6 My registrations | `/:orgCode/registrations` |

C7 (registration detail) is not built: a registration is its number, its thing, its dates and its
state — all of which fit the card, so a detail page would be a click to see the same five facts.

### Tasks

- [x] `account-catalogue.service`: `listRegistrationTypes`, `assertRegistrationTypeAvailable`
- [x] `account-activity.service`: `listRegistrations`
- [x] Routes: `GET /catalogue/registration-types`, `GET /registrations`, and the cart guard
- [x] `fulfilment.service`: the `registration` case, honouring `automaticallyApprove`
- [x] `RegisterInterestPage`, `RegistrationFormPage`, `MyRegistrationsPage`, routes
- [x] Six locales
- [x] Tests: 15 catalogue, 9 fulfilment, 6 route, 28 pages

## Every item type is now fulfillable

`fulfilment.service.fulfilLine` handles all five — `event-entry`, `membership`, `merchandise`,
`booking`, `registration` — and `POST /cart/items` checks four of them against the catalogue (a
booking's slot, a merchandise item's options and stock, an activity's availability, a registration's
scheme and name). The `default` branch is now about a line whose type is not one the basket allows:
a corrupted row, or one written by a later version.

## 4. Membership renewal — delivered

**The Renew button was not the problem; the catalogue was.** C4 correctly worked out that a
membership was renewable and offered the button — which navigated to `/:orgCode/join`, a route that
never existed, so the catch-all redirect swallowed it. Even had the route existed, the catalogue it
led to marked the type **`already-a-member`**: holding a membership bars applying for it again.

That rule is right — it stops a member buying the same year twice — but a member whose year is nearly
up is not applying, they are renewing. `listMembershipTypes` now counts, per type, how many of the
member's active memberships fall inside the renewal window:

| Held | Expiring within 30 days | Result |
|---|---|---|
| 0 | — | Available, fresh application |
| 1 | 0 | `already-a-member` |
| 1 | 1 | **Available, `isRenewal: true`** |
| 2 | 1 | `already-a-member` — the other still covers them, and renewing now buys overlapping cover |

The window is `RENEWAL_WINDOW_DAYS` from `utils/activity-status`, the same constant C4 uses to decide
whether to offer the button, so the screen and the catalogue cannot disagree. Renewal into a closed
type, or into a period that has already ended, is still refused.

The button now points at `/:orgCode/browse/memberships`, where the type reads **Renew** and says
"You hold this already — renewing extends it." `/join` was deleted rather than created: a synonym for
the catalogue adds a route and no capability.

## 5. My Payments — delivered

`GET /api/account/:orgCode/payments` and `/:orgCode/payments` (F1 and F2 on one screen).

**F2 expands in place.** A payment's detail is its lines and their fees — a handful of rows — so a
navigation would be a click to read a receipt the member then leaves. F3 (transaction detail) has
nothing further to show and is not built.

**The total is `card_amount + offline_amount`, never `payments.amount`.** One order can be part card
and part cheque, because the basket lets a member choose per item; `amount` is the decimal legacy
column that predates that split and would understate a mixed order. The two are shown separately
only when the order genuinely was both — otherwise the split repeats the total in smaller type.

**A line that was paid for and produced nothing shows its reason.** `payment_transactions.fulfilment_error`
is surfaced to the member on purpose: it is the club's problem to fix, but a member who reads it here
does not discover it at the gate.

**Not capability-gated.** A payment can cover items from any area, and a member has a right to their
own receipts whatever the club has since switched off.

### Tests

15 across the two: 7 renewal (including the two-held-one-expiring case), 6 payment listing, 2 route,
plus 11 on the screen.

## 6. Cancelling a booking — delivered

The club could already configure a cancellation policy, and D11 showed it — "Cancel up to 2 days
before" — but nothing in the member's app could act on it. Three settings existed and did nothing:
`allow_cancellations`, `cancel_days_in_advance`, `refund_payment_automatically`.

**A third pure rule module on the server**, `utils/booking-cancellation.ts`, mirroring the browser
copy in `orgadmin-calendar/src/utils/cancellationValidator.ts` for the same reason as availability: a
member's own cancellation has to be enforced by the endpoint. It is used twice —

| Where | Why |
|---|---|
| `listBookings` | Returns `canCancel` and, when false, *why* — so C1 explains a missing button rather than merely lacking one |
| `POST /bookings/:id/cancel` | Re-reads the policy from the database and refuses if it has lapsed |

The second is not belt-and-braces. `canCancel` on the list is a snapshot, and a member who leaves the
page open until the notice period closes must not slip through.

**No money moves.** The endpoint records the cancellation and reports whether the club's policy means
a refund is due; the refund itself stays an act of the club through the org-admin payments screens.
`refund_processed` is left false, because it records that money has gone back and it has not. A
member-initiated action that silently returned money on the strength of a policy flag would be a real
transfer nobody reviewed.

Details worth keeping:

- **Zero notice means up to the day itself**, not "never" — a club that sets no notice period expects
  same-day cancellation to work.
- **A past booking is refused as *passed*, not as *too late*.** "Cancellations need two days' notice"
  is an odd thing to read about last Tuesday.
- **Already-cancelled beats every other reason**, including a calendar that forbids cancelling: it is
  the plainest answer to the member.
- **The refusal text lives on the server**, so the list and the endpoint cannot tell a member
  different things.
- **Entries remain non-cancellable** (Q6). A withdrawn entry has consequences for a start list that
  the club, not the member, has to manage.

### Tasks

- [x] `utils/booking-cancellation.ts` and its 15 tests
- [x] `listBookings` returns `canCancel`, `cancellationRefusal`, `cancellationNoticeDays`, `refundExpected`
- [x] `accountActivityService.cancelBooking` + `POST /bookings/:bookingId/cancel`
- [x] C1's bookings tab: a confirm dialog naming the booking, warning of a refund before committing
- [x] Six locales
- [x] Tests: 15 rule, 7 service, 4 route, 8 screen

## 7. B3 — the home screen

The placeholder is gone. Every card the design calls for now has a real endpoint behind it, because
the areas above built them: coming up (entries + bookings), membership, basket, recent payments, and
a "what's on" row across all four catalogues. (The recent-payments card has since been removed, and
the dashboard no longer reads payments at all — see
[HOME_SCREEN_RECENT_PAYMENTS_REMOVED.md](HOME_SCREEN_RECENT_PAYMENTS_REMOVED.md).)

**One request, assembled on the server.** `GET /:orgCode/dashboard`. A dashboard that fanned out over
eight endpoints would make the first screen a member sees the slowest, and every one of those
requests repeats the same authentication and membership resolution — the same reasoning `/me`
already follows. `account-dashboard.service` composes the services that own each domain; it decides
nothing itself. The moment a dashboard starts working out what is renewable, it and C4 begin to
disagree.

**A section the club has not enabled is `null`, not empty**, and the screen renders nothing for it. An
empty "Your basket" card for a club that sells nothing reads as a broken page — and a member cannot
tell it apart from having an empty basket. An area that *is* enabled and has nothing returns `[]`,
which is a different answer.

Decisions worth keeping:

- **Coming up merges entries and bookings.** A member's Saturday morning is one thing whether it is a
  class or a court, and two half-empty cards say less than one full one. Past items are dropped —
  this card is about what to turn up to.
- **The membership card shows the one expiring soonest**, because that is the one with something to
  do about it.
- **"What's on" offers one of each kind before a second of any.** A club with forty shirts and one
  event must not show four shirts and hide the event.
- **Teasers only show what can be acted on.** The catalogues return unavailable rows with reasons —
  right on a listing page, wrong on a teaser.
- **The basket and the teaser row fail soft.** Neither is worth taking the home screen down for; the
  card is dropped and the rest still renders.
- **The renewal banner uses C4's rule**, including the case where renewal is due but the club has
  opened nothing — which gets a note rather than a button that goes nowhere.

### Tests

37: 21 on the assembly (capability absence, merging, truncation, the soft failures) and 16 on the
screen.

## The phase is complete

All five catalogue areas are built, bookings can be cancelled, and B3 is a real dashboard. Every menu
item leads somewhere, every item type the basket allows is fulfillable, and four of the five are
re-checked against the catalogue before they enter the basket.

Still open, and deliberately so: booking detail (C3) and registration detail (C7), each a card's
worth of facts already on its list screen; and the PWA/offline work (H1–H3), which is a phase of its
own. Noted where they belong in `.claude/modules/account-shell.md`.
