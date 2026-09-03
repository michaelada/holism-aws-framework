# Refunds, settlement history, and one entry at a time

## The ask

> - When a person drills into a payment they should see a historical record of any refunds made
>   against it: who, when, how much, the reason.
> - If the payment was online, or included offline elements, show a record of who marked what as
>   received (or undone), and when.
> - Add a **Refunds** option to the Payments menu listing all refunds — the amount, who made it and
>   when — drilling through to the payment, which reflects its refunded status.
> - Clicking through to an entry linked to a payment brings me to the Event Entries table. I want an
>   entry **details** page showing everything about the entry, including all form values.
> - The Event Entries page should group entries by activity, and show the name of the person
>   entered, their contact email, and the date entered.

Five things, and one of them turned out to be why none of the others had any data behind them.

---

## 0. Refunds did not work at all

`refunds` held **no rows**, in any club, ever. Two independent faults:

- **The endpoint required `requestedBy` in the body, and the screen never sent one.** Every refund
  from the interface was refused with `400 refundAmount and requestedBy are required`. The dialog
  posted `{ reason }` — not one of the three field names the endpoint reads. The button appeared to
  work and did nothing, and the page's own test asserted the same wrong payload, so the suite agreed
  with it.
- **The seed set a membership payment's status to `refunded` and wrote no refund record**, so every
  refund screen would have been empty against data claiming a refund had happened.

Both fixed here, because a Refunds screen with nothing that can create a refund is a screen nobody
can check.

**Who asks now comes from the token.** `refunds.requested_by` is the accountability record for money
going back, and a client-supplied one is a client-supplied answer to "who authorised this". It is
also an `organization_users` id while the caller holds a **Keycloak** id — the same mismatch that
made recording an offline receipt fail against a foreign key. `payment.service` now resolves it once,
in `organisationUserFor`, shared by both.

**A fully refunded payment says so.** When the recorded refunds reach the payment total the payment
becomes `refunded`. A partial refund leaves it `paid` — there is no `partially_refunded` status in
this application — and is reported as an amount instead, which is the more useful thing to show.

> **Since superseded in part.** Refunds now come in four scopes, can be repeated, and can withdraw
> the entries they paid for — see [PARTIAL_REFUNDS.md](PARTIAL_REFUNDS.md). What follows describes
> the state this change left things in.

> **Scope, stated plainly.** A refund here is a *record* of money going back, as it always has been:
> nothing in this codebase calls a provider to reverse a charge, and this change does not add that.
> `refund_status` distinguishes one that has been sent from one still to be transferred.

---

## 1. What went back, on the payment

The detail page had a "Refund Information" card built from fields the payment row does not have; it
rendered a box of "N/A" and was removed in an earlier fix. It comes back reading the right table:

```
Refunds
€20.00 of €50.00 has been refunded.
┌──────────────────┬────────────────┬─────────────────────────────┬───────────┬─────────┐
│ Requested        │ Requested by   │ Reason                      │ Status    │  Amount │
├──────────────────┼────────────────┼─────────────────────────────┼───────────┼─────────┤
│ 30 Aug 2026 09:00│ Aoife Byrne    │ Withdrew before the closing…│ [Sent]    │  €20.00 │
└──────────────────┴────────────────┴─────────────────────────────┴───────────┴─────────┘
```

One row per refund — a payment can be refunded twice — with the total above, which is the only thing
on the screen that says a part-refunded payment is part-refunded. The card is hidden entirely on a
payment with no refunds; an empty card on every payment ever taken is noise.

The Request Refund button now sends **what is left**, not the whole payment, so a second refund is
not refused for exceeding the refundable amount.

## 2. How an offline settlement got where it is

The payment row holds only the *current* state: an undo nulls `offline_received_at` and
`offline_received_by`, so a receipt that was marked in error and put back looks exactly like one
nobody ever touched. The history is in the **audit trail** —
`offline-payment.recorded` and `offline-payment.receipt-undone`, which
[OFFLINE_PAYMENTS_MENU_AND_AUDIT.md](OFFLINE_PAYMENTS_MENU_AND_AUDIT.md) gave content to.

```
Offline settlement
┌──────────────────┬──────────────────┬─────────────────────┬──────────────────┐
│ When             │ What happened    │ Recorded by         │         Released │
├──────────────────┼──────────────────┼─────────────────────┼──────────────────┤
│ 01 Sep 2026 11:53│ [Marked received]│ Deirdre Ó Ceallaigh │  2 items created │
│ 01 Sep 2026 12:10│ [Receipt undone] │ Deirdre Ó Ceallaigh │                — │
└──────────────────┴──────────────────┴─────────────────────┴──────────────────┘
```

`itemsFailed` is why the counts are there: a settlement that half-worked is announced once, in an
alert the administrator may close, and afterwards this is the only thing that remembers. A dash,
never a zero, where an older event never captured the counts — zero would claim the receipt released
nothing.

Both histories arrive with the payment: `GET /payments/:id` now returns
`{ ...payment, lines, refunds, settlement }`, read in parallel and scoped by the payment's own
organisation. The screen has no use for one without the others.

## 3. Payments › Refunds

A new menu entry between *Offline payments* and *Lodgements*, at `/payments/refunds`, served by
`GET /api/orgadmin/organisations/:organisationId/refunds`.

```
Refunds
Money this club has sent back, and who authorised it.
┌────────────┬───────────────┬──────────┬───────────┬──────────────┬────────────┬───────────┬───┐
│ Requested  │ Paid by       │ Refunded │ Payment   │ Requested by │ Reason     │ Status    │   │
├────────────┼───────────────┼──────────┼───────────┼──────────────┼────────────┼───────────┼───┤
│ 30 Aug 09:0│ Áine McGrath  │   €25.00 │  €185.23  │ Aoife Byrne  │ Rónán with…│ [Sent]    │ 👁 │
│            │ aine@…test    │          │  in part  │              │            │           │   │
└────────────┴───────────────┴──────────┴───────────┴──────────────┴────────────┴───────────┴───┘
```

**Its own screen rather than a status filter on the payments list.** A list filtered to `refunded`
shows the payments at their original amounts, says nothing about how much of each went back, and
misses a part-refunded payment entirely — that one is still `paid`. **In full / in part** is on
every row for the same reason: €25 out of a €185 basket is not a reversed payment.

The eye opens the payment, where the refund history and the payment's status are.

## 4. An entry link now opens the entry

`lineDestination('event_entry')` went to `/events/:eventId/entries` — the entrant list for the whole
event. A club that clicked one line of a payment arrived at two hundred names.

It now goes to `/events/:eventId/entries/:entryId`, a **new page** showing what a secretary is
actually asked on the phone: who entered, how to reach them, which class and what it cost, the
answers they gave, and the payment it came in on — see
[EVENTS_MODULE_WIREFRAMES.md §6](EVENTS_MODULE_WIREFRAMES.md).

`getEntryById` was widened to carry all of it: the activity's description and fee, the event's
dates, the member behind the entrant, the payment found through
`payment_transactions.fulfilment_ref`, and the form answers from `formSummariesFor` — the same
helper the member's own screens use, rather than a second implementation free to disagree with them
about how an unanswered optional field looks.

**Two routing faults surfaced while doing it**, neither visible from the interface:

- `GET /events/:eventId/entries/:entryId` looked the entry up **by id alone**. The guard authorises
  the *event*, so an entry id belonging to another club could be read by naming one of your own
  events. The two must now agree, and a mismatch is a 404 rather than a 403 — confirming that an id
  exists elsewhere is itself the leak.
- `/events/:eventId/entries/export` was declared **after** `/entries/:entryId`, so Express matched
  "export" as an entry id: the export never ran and the entry lookup was handed the word. Moved
  above it, with a comment saying why the order matters.

## 5. The entries page reads as class lists

What was there showed **First Name / Last Name / Status / Submitted** in hard-coded English, reading
`entry.status` and `entry.createdAt` — neither of which the endpoint returns. Two of its four
columns were empty on every row, and the whole event was one flat table.

Now grouped by activity, with Name / Email / Entered / Status, a count beside each class, a search
across every class at once, and a row that opens the entry. Grouped by activity **id**, not name: a
two-day event runs "80cm" on both days, and merging them produces a class list no class ever had.

## The seed

`REFUNDS` in `scripts/seed/dataset.ts` — four, chosen for the states the screens have to tell apart
rather than for volume:

| | Basket / payer | |
|---|---|---|
| A whole payment returned | `clodagh.moran@example.test`, Laois | member moved away |
| Part of a four-line basket | `mcgrath-season`, Kildare, €25 | one child withdrew |
| Asked for, not yet sent | `mcnamara-day`, Meath, €18 | wrong size cap |
| A part refund on a fee-bearing basket | `fees-1-card-added`, Kildare, €20 | class cancelled |

Matched by basket where the fixture names one, and by payer where the payment has no basket name of
its own — a single-line payment only has the synthetic key the writer gives it.

## Tests

| Suite | Covers |
|---|---|
| `payment.service.test.ts` | refunds by payment and by club, the requester's name, the org-user resolution, the status flip on a full refund and its absence on a partial one, and the settlement history |
| `event-entry.service.test.ts` (new) | the widened entry: activity, fee, answers, payment, member, and each of them absent |
| `payment-detail.routes.test.ts` | `refunds`/`settlement` on the detail, the refunds list, and the refund POST taking its requester from the token |
| `event-entry-detail.routes.test.ts` (new) | the entry endpoint, the cross-event 404, and the export path no longer being read as an id |
| `RefundsListPage.test.tsx` (new) | the list, in full vs in part, pending, the drill-through, and a failure told from an empty club |
| `PaymentDetailsPage.test.tsx` | both new cards, the refunded total across several refunds, and the corrected refund payload |
| `EventEntriesPage.test.tsx` | grouping, the columns, search, counts, and the row opening the entry |
| `EventEntryDetailsPage.test.tsx` (new) | the answers, the payment link, the member link, and each empty case |
| `shellMock.test.ts` | the test translator now selects `_one`/`_other`, so a counted string renders as a sentence rather than as a key path |

---

# Follow-up: four things found using it

## A registration line led to the whole database

`lineDestination('registration')` returned `/registrations` — the list of every registration the club
holds. `registrations/:id` has existed all along, and so has `calendar/bookings/:id`, which the
booking line was missing in the same way. Both now open the record.

The audit log had a third instance of it: `auditEntityDestination('registration')` pointed at
**`/users/registrations`**, which is a different thing entirely — the account-user approval queue,
not the registrations module that emits `registration.submitted` and `registration.approved`.

## `common.actions.print` was never translated

The Merchandise Order Details page rendered the key path as a button label. Added to all six
locales.

Sweeping the org-admin packages for the same class of fault found **51 keys** used with no
translation and no `defaultValue`. Two were on screens in this work's path and are fixed here:
`common.loading` and `common.retry` — neither exists; the catalogue has `common.messages.loading`
and `common.actions.retry`. Of the rest, **about forty are on `CreateMemberPage` and
`EditMemberPage`** in the memberships module — a whole screen's worth of labels, validation messages
and error text rendering as key paths. That is a separate piece of work and is left reported rather
than half-done here. (Six of the fifty-one are false positives: plural keys, which exist only as
`_one`/`_other`.)

## "Type" said Basket on every row

Every payment taken through checkout carries `payment_type = 'cart'` — true, and useless. The
payments list now names what the basket held, from the lines:

```
Type
Entry, Membership, Shop
```

`getPaymentsByOrganisation` carries the distinct `payment_transactions.item_type` values per
payment, ordered so a basket does not shuffle its labels between requests. Empty for a payment with
no lines, where `paymentType` remains the fallback — "Basket" is still better than blank.

The vocabularies differ, deliberately: `payments.payment_type` says `event`, a line says
`event_entry`, so the new `payments.itemTypes.*` keys are their own set rather than a reuse of
`payments.paymentTypes.*`.

## Nothing in the seed ever booked anything

The calendars, their slots, their durations and their blocked periods were all seeded and **no
booking ever was** — so no payment anywhere carried a `booking` line, and the click-through to a
booking could not be exercised.

`BOOKINGS` in `scripts/seed/dataset.ts` — seven, for the cases the screens branch on:

| | |
|---|---|
| A booking on its own, card | the simplest payment with a booking |
| **Two bookings in one basket** | arena + lesson, paid together, which is what the itemised detail is for |
| One owed offline | so a booking appears under Offline Payments |
| One already past | and one **cancelled but paid for** |
| One at Meath | on a calendar whose price **includes** its handling fee |

Two things the writer does rather than the fixture:

- **`daysFromNow` is a target, not a date.** The writer moves it to the nearest day the slot
  actually runs. A fixed offset lands on a different weekday every time the seed runs, so a booking
  pinned to one would sit outside its own slot most days of the week.
- **The price comes from the duration option**, and a fixture naming a slot or duration the calendar
  does not offer is refused with a message saying so — a seeded booking outside its own slot is a
  state the application cannot produce.

Read back from a scratch database:

```
BK-2026-000005 Cross-country schooling  16 Aug 10:00–13:00  €35.00 confirmed paid
BK-2026-000006 Outdoor arena            07 Sep 17:00–17:30  €10.00 cancelled paid
BK-2026-000004 Group lessons            09 Sep 18:30–19:30  €22.00 confirmed pending
BK-2026-000001 Outdoor arena            10 Sep 17:00–18:00  €18.00 confirmed paid
BK-2026-000002 Outdoor arena            13 Sep 09:00–11:00  €26.00 confirmed paid
BK-2026-000003 Group lessons            16 Sep 18:30–19:30  €22.00 confirmed paid
BK-2026-000007 Indoor arena             16 Sep 17:00–18:00  €20.00 confirmed paid

payment €48.79 paid card             — booking + booking
payment €22.00 awaiting_offline      — booking
payment €20.00 paid card             — booking   (fee included in the price)
```

## The seed's `--reset` reached into the shared environment again

Verifying the bookings meant seeding a scratch database, and `--reset` deleted the **four Stripe
connected accounts** — which are on the shared test platform, not in the database being seeded. The
development database's clubs point at them by id in `settings.stripeConnect`, so those four clubs
were left unable to take a card payment.

Repaired (the four clubs now point at accounts that exist), and `scripts/seed/index.ts` now leaves
Stripe alone for a scratch database exactly as it already leaves Keycloak alone — one
`scratchDatabase` constant, used by both. This is the second time a scratch run has damaged the
development environment through a shared service; the guard is now on both of them.
