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
| `payments/offline` | `OfflinePaymentsPage` |

## Pages

- **`PaymentsListPage`** — filterable list of payments across all modules, with export
  (`GET /api/orgadmin/payments/export`).
- **`PaymentDetailsPage`** — one payment: payer, source, method, amounts, status, and the refund
  action (`POST /api/orgadmin/payments/:id/refund`).
- **`LodgementsPage`** — lodgement history broken down by payment method: what was actually banked,
  as opposed to what was charged.
- **`OfflinePaymentsPage`** — cheques and transfers a member has committed to but the club has not
  yet recorded as arrived. **This screen is what stands between a member and the thing they paid
  for**: fulfilment defers everything except an event entry until the money is marked received, so
  until an administrator acts here no membership, order, booking or registration exists. Marking one
  runs that deferred fulfilment immediately and reports what it produced; undoing is refused once
  anything has been created. See [OFFLINE_PAYMENT_SETTLEMENT.md](../../docs/OFFLINE_PAYMENT_SETTLEMENT.md).

## API endpoints

| Endpoint | Use |
|---|---|
| `GET /api/orgadmin/payments` | List, with filters |
| `GET /api/orgadmin/payments/:id` | Detail |
| `GET /api/orgadmin/payments/export` | Export |
| `GET /api/orgadmin/payments/lodgements` | Lodgement history |
| `POST /api/orgadmin/payments/:id/refund` | Refund |
| `GET /api/orgadmin/organisation/payments/offline?settled=` | Offline payments, outstanding or recorded |
| `POST /api/orgadmin/organisation/payments/:id/received` | Record an offline payment as arrived, running its deferred fulfilment |
| `DELETE /api/orgadmin/organisation/payments/:id/received` | Undo that, unless it has already produced records |

The three offline endpoints live in `orgadmin-organisation.routes`, not `payment.routes`: they
resolve the organisation from the caller's token rather than taking an id from the URL.

Backend: `payment.routes` → `payment.service`, `payment-method.service`. Tables: `payments`,
`refunds`, `payment_methods`, `org_payment_method_data`.

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
