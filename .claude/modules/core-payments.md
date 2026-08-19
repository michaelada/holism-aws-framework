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
  (`GET /api/orgadmin/payments/export`).
- **`PaymentDetailsPage`** — one payment: payer, source, method, amounts, status, and the refund
  action (`POST /api/orgadmin/payments/:id/refund`).
- **`LodgementsPage`** — money Stripe has actually paid into the club's bank: payouts on its
  connected account, with pending and in-transit ones included, failures shown with their reason,
  and the balance not yet scheduled reported as a card rather than a row (it has no date, so it is
  not a lodgement). **Read live from Stripe, never from `payments`** — an earlier screen of this
  name summed our own table by day and called that a lodgement, which it is not.
- **`LodgementDetailPage`** — what made up one lodgement: every balance transaction Stripe assigned
  to the payout, joined to the payment and basket behind it, each expandable to its items and fee
  build-up. Refunds and adjustments are listed too, or the lines would not sum to the payout total.
  Under destination charges **Stripe's processing fee is paid by the platform**, so it is not shown
  as a deduction from the club's money — the screen says so explicitly, because its absence from
  the arithmetic is otherwise indistinguishable from an omission. See
  [LODGEMENTS.md](../../docs/LODGEMENTS.md).
- **`OfflinePaymentsPage`** — cheques and transfers a member has committed to but the club has not
  yet recorded as arrived. **This screen is what stands between a member and the thing they paid
  for**: fulfilment defers everything except an event entry until the money is marked received, so
  until an administrator acts here no membership, order, booking or registration exists. Marking one
  runs that deferred fulfilment immediately and reports what it produced; undoing is refused once
  anything has been created. A partial fulfilment is reported as a **warning**, not a success — the
  member has paid and has nothing, which must not carry a tick. Each recorded payment shows who
  marked it and when (`payments.offline.receivedByOn`), falling back to a date alone when the
  administrator's record has since been removed. See
  [OFFLINE_PAYMENT_SETTLEMENT.md](../../docs/OFFLINE_PAYMENT_SETTLEMENT.md).

## API endpoints

| Endpoint | Use |
|---|---|
| `GET /api/orgadmin/payments` | List, with filters |
| `GET /api/orgadmin/payments/:id` | Detail |
| `GET /api/orgadmin/payments/export` | Export |
| `GET /api/orgadmin/organisation/payments/lodgements` | Payouts on the club's Stripe account, plus the unpaid balance |
| `GET /api/orgadmin/organisation/payments/lodgements/:id` | What made up one payout |
| `POST /api/orgadmin/payments/:id/refund` | Refund |
| `GET /api/orgadmin/organisation/payments/offline?settled=` | Offline payments, outstanding or recorded |
| `POST /api/orgadmin/organisation/payments/:id/received` | Record an offline payment as arrived, running its deferred fulfilment |
| `DELETE /api/orgadmin/organisation/payments/:id/received` | Undo that, unless it has already produced records |

The three offline endpoints live in `orgadmin-organisation.routes`, not `payment.routes`: they
resolve the organisation from the caller's token rather than taking an id from the URL.

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
| "How is a refund issued?" | `pages/PaymentDetailsPage.tsx` → `POST /payments/:id/refund` → backend `payment.service` |
| "What's the difference between a payment and a lodgement?" | `pages/LodgementsPage.tsx` |
| "Where are payment credentials configured?" | [core-settings.md](core-settings.md) |
| "Why is a method treated as a card?" | Name-based classification — see above |
| "Where does the payment row come from?" | The originating module (events/memberships/…), which writes into `payments` |
| "A member paid by cheque — how do they get their membership?" | `pages/OfflinePaymentsPage.tsx` → `POST /organisation/payments/:id/received` → `paymentService.markOfflinePaymentReceived`, which runs the deferred fulfilment |
