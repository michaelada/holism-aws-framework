# Payments — `packages/orgadmin-core/src/payments`

The organisation's money view: every payment taken across events, memberships, merchandise,
registrations and bookings, with detail, refunds and lodgement history.

Part of `orgadmin-core`, always available.

## Routes (`payments/index.ts` → `paymentsModule`)

| Path | Page |
|---|---|
| `payments` | `PaymentsListPage` |
| `payments/:id` | `PaymentDetailsPage` |
| `payments/lodgements` | `LodgementsPage` |
| `payments/lodgements/:id` | `LodgementDetailPage` |
| `payments/offline` | `OfflinePaymentsPage` |
| `payments/refunds` | `RefundsListPage` |

Three of these are in the navigation rail, as sub-items under **Payments**: *All payments*
(`payments.allMenu`), *Offline payments* (`payments.offline.menu`) and *Lodgements*
(`payments.lodgements.menu`) — the money's journey in order: taken, settled, lodged. They come from
`subMenuItems` at the **root** of the module registration — not nested inside `menuItem`, where it
is silently not part of the type and the rail renders nothing.

`payments/lodgements/:id` is the first route nested under a rail sub-item. Rail selection and the
breadcrumb use a **longest-prefix** match on the sub-item paths (`Layout.tsx`, `isUnderPath`);
exact equality left both blank on a child route, and a plain `startsWith` would highlight *All
payments* everywhere in the module.

## Pages

- **`PaymentsListPage`** — filterable list of payments across all modules, with export
  (`GET /api/orgadmin/payments/export`). The **Type** column names what the basket held, from the
  payment's own lines (`itemTypes`) — everything taken through checkout carries
  `payment_type = 'cart'`, so it read "Basket" on every row. `payments.itemTypes.*` is its own set
  of keys: a line says `event_entry` where a payment says `event`.
- **`RefundsListPage`** — every refund the club has made: what went back, to whom, who authorised
  it and why, each opening the payment behind it. **Its own screen, not a status filter** — a
  payments list filtered to `refunded` shows the payments at their original amounts, says nothing
  about how much of each went back, and misses a part-refunded payment entirely, because that one is
  still `paid`. Each row says **in full** or **in part** for the same reason.
- **`PaymentDetailsPage`** — one payment: payer, source, method, amounts, status, the refund action
  (`POST /api/orgadmin/payments/:id/refund`), and **"What this paid for"** — a row per basket line
  with its own payment method, fee and share of the handling fee, subtotalled and totalled, each
  linking through to the record it produced (`lineDestination`). A line that has produced nothing
  yet says so rather than offering a dead link. This replaced a *Related Transaction* card that
  named a `contextId` and nothing else. Below it, two histories: **Refunds** (one row per refund,
  with the total refunded, since a part refund leaves the payment `paid`) and **Offline settlement**
  — who marked the money received or undid it, read from the **audit trail**, because the payment
  row nulls both settlement columns on an undo. An entry line opens the entry itself, at
  `/events/:eventId/entries/:entryId`, and each line carries its **own status** — `refunded`,
  `partially_refunded` (with how much went back) or the line's own `paid`/`pending` — derived from
  what has gone back against it rather than stored, plus whether the entry it produced was
  withdrawn. See
  [ORGADMIN_PAYMENT_ITEMS.md](../../docs/ORGADMIN_PAYMENT_ITEMS.md) and
  [REFUNDS_SETTLEMENT_AND_ENTRY_DETAIL.md](../../docs/REFUNDS_SETTLEMENT_AND_ENTRY_DETAIL.md).
- **`LodgementsPage`** — money Stripe has actually paid into the club's bank: payouts on its
  connected account, with pending and in-transit ones included, failures shown with their reason,
  and the balance not yet scheduled reported as a card rather than a row (it has no date, so it is
  not a lodgement). **Read live from Stripe, never from `payments`** — an earlier screen of this
  name summed our own table by day and called that a lodgement, which it is not.
- **Seeing any of this in a sandbox** — a fresh test environment has no payouts and no way to make
  one by waiting: connected accounts start empty, test charges land in `pending`, and the seeded
  accounts pay out daily with a **seven-day** delay.
  `npm run test:lodgements -w @aws-web-framework/backend -- --club=khpc` funds the platform balance
  with `pm_card_bypassPending`, makes destination charges to the club and pays them out. **A payout
  made by hand cannot be itemised** — Stripe only breaks down payouts it made on the schedule — so
  the detail screen answers `LODGEMENT_NOT_ITEMISED` (422) and says so; `--fund-only` leaves the
  money for Stripe's own payout run, which *is* itemisable. See
  [LODGEMENTS.md](../../docs/LODGEMENTS.md).
- **`LodgementDetailPage`** — what made up one lodgement: every balance transaction Stripe assigned
  to the payout, joined to the payment and basket behind it, each expandable to its items and fee
  build-up. Refunds and adjustments are listed too, or the lines would not sum to the payout total.
  Under destination charges **Stripe's processing fee is paid by the platform**, so it is not shown
  as a deduction from the club's money — the screen says so explicitly, because its absence from
  the arithmetic is otherwise indistinguishable from an omission. See
  [LODGEMENTS.md](../../docs/LODGEMENTS.md).
- **`OfflinePaymentsPage`** — cheques and transfers a member has committed to but the club has not
  yet recorded as arrived. Each card opens the payment itself (**View payment**) as well as offering
  the settlement actions. **This screen is what stands between a member and their membership**:
  fulfilment creates an entry, a booking and a merchandise order when the order is *placed* — each
  in a state that grants nothing — but defers a membership and a registration until the money is
  marked received, so until an administrator acts here neither exists. It selects on
  `payment_status = 'awaiting_offline'` alone, which is what `checkout.service` writes; a `pending`
  offline payment is a state the app never produces. Marking one
  runs that deferred fulfilment immediately and reports what it produced; undoing is refused once
  **the receipt itself** has created something — not once anything has, which refused nearly every
  offline order, because an entry, a booking and an order are created when the order is *placed*.
  Both actions are also on the payment detail, so an administrator who has opened a payment need not
  come back here to act on it. A partial fulfilment is reported as a **warning**, not a success — the
  member has paid and has nothing, which must not carry a tick. Each recorded payment shows who
  marked it and when (`payments.offline.receivedByOn`), falling back to a date alone when the
  administrator's record has since been removed. Both the receipt
  (`offline-payment.recorded`) and its reversal (`offline-payment.receipt-undone`) are in the audit
  trail, labelled with the payer and the amount and carrying what the money released
  (`itemsCreated` / `itemsFailed`). See
  [OFFLINE_PAYMENT_SETTLEMENT.md](../../docs/OFFLINE_PAYMENT_SETTLEMENT.md) and
  [OFFLINE_PAYMENTS_MENU_AND_AUDIT.md](../../docs/OFFLINE_PAYMENTS_MENU_AND_AUDIT.md).

## API endpoints

| Endpoint | Use |
|---|---|
| `GET /api/orgadmin/payments` | List, with filters |
| `GET /api/orgadmin/payments/:id` | Detail, **with `lines`, `refunds` and `settlement`** — the basket joined to what each line produced, the refunds recorded against it, and the offline receipt history from the audit trail |
| `GET /api/orgadmin/organisations/:organisationId/refunds` | Every refund the club has made, with the payment behind each |
| `GET /api/orgadmin/payments/export` | Export |
| `GET /api/orgadmin/organisation/payments/lodgements` | Payouts on the club's Stripe account, plus the unpaid balance |
| `GET /api/orgadmin/organisation/payments/lodgements/:id` | What made up one payout |
| `POST /api/orgadmin/payments/:id/refund` | Record a refund of one of four **scopes** — `full`, `lessHandlingFee`, `items` (with `lineIds`), `amount` — optionally withdrawing the entries it covered (`removeEntries`). Answers `{ refund, paymentStatus, entriesRemoved }`. **`requestedBy` comes from the token**, never the body — it is the accountability record for money going back. The screen must send `refundAmount` and `refundReason`; sending `{ reason }` was refused with a 400 and the button did nothing |
| `GET /api/orgadmin/organisation/payments/offline?settled=` | Offline payments, outstanding or recorded |
| `POST /api/orgadmin/organisation/payments/:id/received` | Record an offline payment as arrived, running its deferred fulfilment |
| `DELETE /api/orgadmin/organisation/payments/:id/received` | Undo that, unless it has already produced records |

The three offline endpoints live in `orgadmin-organisation.routes`, not `payment.routes`: they
resolve the organisation from the caller's token rather than taking an id from the URL.

**Because it resolves the club itself, that router must put the answer on the request**
(`req.organisationId`) — `audited()` reads it there. Without it every event the router wrote was
filed under no organisation, and the audit log, which filters on exactly that, showed none of them.

**That router is mounted once, bare**, unlike the dual-mounted data routers — so it is listed in
`UNSCOPED_ORGADMIN_PATHS` in `orgadmin-core/src/hooks/useApi.ts`. Without that entry `useApi`
rewrites the path to `/api/orgadmin/organisations/<id>/organisation/…`, which matches nothing and
404s every screen the router serves: all six Settings tabs, registrations and offline payments.

It picks the organisation from `X-Organisation-Id`, **verified** against the caller's own org-admin
rows, falling back to their earliest organisation when the header is absent. A header naming a club
the caller does not administer is refused with 403 rather than served from a different one. It is
not mounted under `/organisations/:organisationId` precisely because it resolves scope this way and
has no check that a path id agrees — a scoped URL there could name one club while the handler worked
on another.

Backend: `payment.routes` → `payment.service`, `payment-method.service`. Tables: `payments`,
`refunds`, `payment_methods`, `org_payment_method_data`.

Lodgements are `lodgement.service` — `StripeLodgementSource` against the club's connected account,
plus a `HelixPayLodgementSource` that reports the feature is not available for that provider yet
rather than returning an empty list, since "no money" and "not supported" must not look alike. The
one stored piece is `payments.provider_destination_payment_id`: a destination charge produces a
different charge object on the club's account than on the platform's, and only the club-side one
appears in the payout. Learned in bulk on first view and written back, never resolved twice.

Stripe's own errors are translated rather than surfaced as 500s — a revoked connection names itself
and points at Payment Settings.

## How payments arrive here

1. The super admin enables payment methods for the organisation.
2. The org admin supplies credentials in **Settings → Payment Settings**
   ([core-settings.md](core-settings.md)).
3. A domain object declares which methods it accepts — an event activity's
   `supportedPaymentMethods`, a membership type's, and so on.
4. Payment records land in `payments` regardless of source; this module is the consolidated view.

Payment methods are classified by **name**, not by a type column: front-end code treats a method
whose name contains `card`, `stripe` or `helix` as a card method (see
`isCardPaymentMethod` in `EventActivityForm`). Renaming a payment method can therefore change
behaviour — for example whether the handling-fee option appears.

## Shared components

Payment UI is partly in the shared library, `packages/components/src/components/OrgPaymentWidget`:
`PaymentDetails`, `PaymentList`, `RefundDialog`. Per project rule §1.5, payment UI that another
front end could reuse belongs there rather than here.

## Where to look for what

| Question | Start at |
|---|---|
| "How is a refund issued?" | `components/RefundDialog.tsx` → `POST /payments/:id/refund` → `paymentService.requestRefund`. The dialog sends a **scope**, not a figure — the server computes the amount for every scope but `amount`. **A refund here is a record, not a provider call**: nothing in this codebase reverses a charge with Stripe |
| "Why is this payment `partially_refunded`?" | An `items` or `amount` refund that does not yet cover the payment. It is as refundable as `paid`, and becomes `refunded` when the parts add up. See [PARTIAL_REFUNDS.md](../../docs/PARTIAL_REFUNDS.md) |
| "Where did that entry go?" | Withdrawn with a refund — `event_entries.entry_status = 'removed'`. Off the entrant list and out of the counts, still on record, and its own page says so |
| "What has this club refunded?" | `pages/RefundsListPage.tsx` → `GET /refunds` → `paymentService.listRefunds` |
| "What did this payment actually buy?" | `pages/PaymentDetailsPage.tsx` → `GET /payments/:id` → `paymentService.getPaymentLines`, which follows `payment_transactions.fulfilment_ref` |
| "What's the difference between a payment and a lodgement?" | `pages/LodgementsPage.tsx` |
| "Where are payment credentials configured?" | [core-settings.md](core-settings.md) |
| "Why is a method treated as a card?" | Name-based classification — see above |
| "Where does the payment row come from?" | The originating module (events/memberships/…), which writes into `payments` |
| "A member paid by cheque — how do they get their membership?" | `pages/OfflinePaymentsPage.tsx` → `POST /organisation/payments/:id/received` → `paymentService.markOfflinePaymentReceived`, which runs the deferred fulfilment |
