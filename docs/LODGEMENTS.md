# Lodgements — what actually reached the club's bank

**Request:** a third menu option under Payments called *Lodgements*, listing every Stripe (later
Helix Pay) lodgement that has happened or is pending, with a drill-down into the exact payments that
made up each one — and for each payment, the basket items and how the charges add up to the final
lodgement.

---

## 1. Why this is not the page that already exists

`payments/lodgements` is already occupied by a `LodgementsPage`. It is being **replaced**, for three
reasons, all verified rather than assumed:

- It is not reachable. Nothing links to it; only the route registration mentions it.
- It does not work. It calls `/api/orgadmin/payments/lodgements`, which `organisationScopedUrl`
  rewrites to `/api/orgadmin/organisations/<id>/payments/lodgements`. The only route registered is
  `/organisations/:organisationId/lodgements`. It 404s.
- It is not a lodgement. It is `SELECT DATE(payment_date), payment_method, SUM(amount) … GROUP BY`
  over our own `payments` table — what we *charged*, grouped by day. A lodgement is money arriving
  in the club's bank account, which is a different number on a different date, and the two disagree
  by fees, refunds, timing and payout schedule.

The old service method `getLodgementsByOrganisation` and its route go with it.

## 2. What a lodgement is here

The platform takes card payments with **Stripe Connect destination charges**
([CONNECT_APPLICATION_FEE.md](CONNECT_APPLICATION_FEE.md)):

- The charge is created on the **platform** account.
- `transfer_data.destination` sends the club's share to its connected account.
- `application_fee_amount` is the platform's cut and stays behind.

So the money reaching a club's bank is a **payout on its connected account**, and its composition is
the balance transactions assigned to that payout.

### The fee arithmetic, stated exactly

This is the part most easily got wrong, and getting it wrong misstates a club's money:

| | Goes to |
|---|---|
| Item price | the club |
| Handling fee (a surcharge the **member** pays) | split by the application fee |
| Application fee | the **platform** |
| **Stripe's processing fee** | the **platform** |

Under destination charges the processing fee is charged to the account that created the charge — the
platform — because we do not set `on_behalf_of`. **Stripe's fee therefore does not reduce the club's
lodgement**, and the screen must not show it as a deduction from the club's money. What the club
receives is:

```
gross charged to the member  −  application fee  =  transferred to the club
Σ transfers  −  refunds and adjustments          =  the lodgement
```

The screen renders Stripe's own `amount` / `fee` / `net` from each balance transaction rather than
recomputing them, so if the commercial arrangement ever changes (say `on_behalf_of` is set, moving
the processing fee to the club) the display follows without an edit.

## 3. The hard part: linking a payout back to our payments

A destination charge produces **two different charge objects**. The platform sees `ch_…` under
`pi_…`; the club's account sees its own `py_…`. Only the latter appears in the club's payout, and
nothing in it names our payment — Stripe does not copy PaymentIntent metadata to the destination
payment.

The chain is:

```
payout po_…                      (connected account)
  └─ balance transaction          source → py_…            (connected account)
       └─ charge py_…             source_transfer → tr_…   (platform)
            └─ transfer tr_…      source_transaction → ch_… (platform)
                 └─ charge ch_…   payment_intent → pi_…
                      └─ payments.provider_transaction_id
```

Walking that per payment is three API calls each — 150 calls for a 50-payment payout. Instead the
link is **learned once and stored forever**, in `payments.provider_destination_payment_id`.

The resolver does not walk the chain per payment. The balance transactions come back with
`expand: ['data.source']`, which already carries each club-side charge's `source_transfer`; the
platform's transfers to that club are then listed in bulk — one call per hundred, bounded to a
window around the payout, because the transfers that fed it are contemporaneous with it by
construction. A payout resolves in one or two calls rather than one per payment, and every id it
learns is written back, so it never resolves the same payment twice.

An indexed column rather than a `metadata` key, because a payout is resolved by matching a few
hundred destination-payment ids against our table in one query.

**Not done:** capturing the id at `payment_intent.succeeded` time, which would make even the first
view of a payout free. It was in the original plan and was dropped — the bulk resolver turned out
cheap enough that adding a Stripe call to the payment-confirmation path bought very little and put
new work on the one code path that must never fail. Worth revisiting only if a first view is ever
measurably slow.

## 4. Pending

"Or are pending" covers two distinct things, and both are shown:

- **Payouts not yet settled** — Stripe status `pending` or `in_transit`. These are real payouts with
  a date and an amount; they simply have not landed.
- **Money not yet paid out** — the connected account's balance. This is not a payout object and has
  no date, so it is presented as a separate summary line ("not yet scheduled"), never as a row in
  the table pretending to be a lodgement.

Failed and cancelled payouts are listed too, with the failure reason, because a club chasing missing
money needs to see them more than it needs to see the successful ones.

## 5. Helix Pay

A narrow `LodgementSource` interface with one real implementation and one stub. Deliberately narrow:
`listLodgements` and `getLodgement`, no more. This follows the existing judgement in
`stripe-connect.service.ts` — *"inventing a generic shape for one real implementation would be a
guess dressed as a design"*. The Helix implementation reports that lodgements are not available for
that provider yet, and the screen says so plainly rather than showing an empty table that looks like
"no money".

## 6. Requirements

| # | Requirement |
|---|---|
| R1 | A third rail item under Payments, **Lodgements**, at `payments/lodgements` |
| R2 | Table of lodgements: date, amount, status, payment count, destination bank account |
| R3 | Pending and in-transit payouts included and marked as such |
| R4 | Balance not yet paid out shown separately, not as a lodgement |
| R5 | Failed/cancelled payouts shown with their reason |
| R6 | Drill-down per lodgement listing the exact payments in it |
| R7 | Each payment expands to its basket items and its fee build-up |
| R8 | The lodgement reconciles: the payment lines add up to the payout total |
| R9 | Non-payment entries (refunds, adjustments) are shown, or the total cannot reconcile |
| R10 | A club with no Stripe connection is told to connect, not shown an empty table |
| R11 | Currency comes from `useCurrency()`; no hard-coded symbol |
| R12 | Every string in all six locales |

## 7. Design

### Backend

`packages/backend/src/services/lodgement.service.ts` (new)

```ts
interface LodgementSource {
  listLodgements(organisationId, opts): Promise<LodgementPage>
  getLodgement(organisationId, lodgementId): Promise<LodgementDetail>
}
```

- `StripeLodgementSource` — `payouts.list` and `balanceTransactions.list({payout})` on the connected
  account via `{ stripeAccount }`, plus `balance.retrieve` for R4.
- `HelixPayLodgementSource` — throws `LodgementsUnavailable`.

Routes join the existing organisation router, beside `/payments/offline`:

| Endpoint | Use |
|---|---|
| `GET /api/orgadmin/organisation/payments/lodgements` | R2–R5 |
| `GET /api/orgadmin/organisation/payments/lodgements/:id` | R6–R9 |

That router resolves the organisation from the caller and is excluded from URL scoping — see
[OFFLINE_PAYMENTS_MENU_AND_AUDIT.md](OFFLINE_PAYMENTS_MENU_AND_AUDIT.md).

Migration: `payments.provider_destination_payment_id VARCHAR(255)` + index.

### Front end

- `LodgementsPage` — rewritten as the payout table.
- `LodgementDetailPage` — new; summary, reconciliation, expandable payment rows.
- `payments/index.ts` — third `subMenuItems` entry, and a `payments/lodgements/:id` route.

Wireframes: [LODGEMENTS_WIREFRAMES.md](LODGEMENTS_WIREFRAMES.md).

## 8. What was built

1. ✅ Migration `1709000000030_payment-destination-payment-id` — column plus a partial index
2. ✅ `lodgement.service.ts` — `StripeLodgementSource`, `HelixPayLodgementSource`
3. ⛔️ Webhook capture — dropped, see §3
4. ✅ Bulk resolver with write-back
5. ✅ Two routes on the organisation router
6. ✅ `LodgementsPage` rewritten
7. ✅ `LodgementDetailPage`
8. ✅ Rail entry, child route, 41 keys × 6 locales
9. ✅ `getLodgementsByOrganisation`, its route, its interface and its tests removed
10. ✅ Tests at every layer; docs and module summaries

## 9. Three defects found while building this

**Stripe failures arrived as a bare 500.** The local key had no access to the account stored for the
test club — `StripePermissionError` / `account_invalid`, which is the same shape as a club revoking
access in production. The screen said only "could not load". Stripe's errors are now translated:
a revoked connection names itself and points at Payment Settings, a missing payout is a 404, an
outage is a 502, and anything that is not a Stripe error is left alone so our own bugs are not
disguised as Stripe's.

**`useApi.execute` returns `null` on failure — it does not throw.** Every `try/catch` around it in
this codebase is dead code. On this screen the null flowed into `response?.lodgements ?? []` and
rendered *"No lodgements yet"* — an outage reported to a club as "no money has reached your bank".
The offline payments screen had the same defect, rendering "Nothing is waiting on an offline
payment" when nobody had been able to ask. Both now use the hook's `onError` callback, and both
suppress their empty state when a load has failed — showing an error and a reassuring empty state
together is worse than either alone, because the reassuring one is the one that gets believed.

**Nothing in the test suites could catch that**, because every mock *rejects*, which is something a
browser never does. The new tests reproduce the real contract — resolve `null`, call `onError` —
alongside the rejecting ones.

**A rail sub-item lost its selection on a child route.** `/payments/lodgements/:id` is the first
route nested under a sub-item, and both the rail and the breadcrumb compared paths with `===`. So
opening a lodgement deselected the rail and truncated the breadcrumb to "Payments": the reader lost
their place in the navigation by following a link inside it. Now a longest-match, which also fixes
`/payments/:id` — previously it highlighted nothing either.

---

## Testing this in a Stripe sandbox

The screens read Stripe, so a test environment shows nothing until a test
environment has payouts — and a fresh one never does. A seeded connected account
starts with a **zero balance**, test charges land in `pending`, and the accounts
the seed creates pay out **daily with a seven-day delay**. Nothing is broken; it
is simply a week early.

`npm run test:lodgements -w @itsplainsailing/backend -- --club=khpc` does the
whole thing. What it does, and why in that order:

1. **Funds the platform's available balance** with `pm_card_bypassPending` — the
   `4000 0000 0000 0077` card, which settles straight to *available* instead of
   waiting out the delay. Nothing can move before this: a transfer from an empty
   platform balance is refused, and Stripe's refusal names this card.
2. **Charges the club the way the application does** — a destination charge with
   `transfer_data.destination` and an `application_fee_amount` — so the club's
   share lands in its own balance less the platform's fee, which is the
   arithmetic the detail screen explains.
3. **Creates a payout.**

The same thing by hand works too: the card above through the account app's own
checkout, then *Pay out* on the connected account in the Stripe dashboard.

### The one thing a hand-made payout cannot do

Stripe refuses to itemise it:

> Balance transaction history can only be filtered on automatic transfers, not manual.

`balanceTransactions.list({ payout })` is the only way to ask what went into a
payout, so a payout created by hand — from this script or from the dashboard —
appears on the **list** with its amount, status and destination, and its
**detail cannot be broken down**. Production payouts are automatic, so no club
meets this; anybody testing the screen meets it immediately.

That refusal used to surface as *"Stripe could not be reached just now"*, which
sends a developer to look at their network and a club to ring somebody, over a
permanent and explicable answer. It is now `LODGEMENT_NOT_ITEMISED` (422) and
the detail page shows Stripe's reason as information rather than as an error.

**To exercise the detail page**, pass `--fund-only`: the money stays in the
club's balance and Stripe pays it out on the account's own schedule. That payout
*is* itemisable. It arrives on the schedule, so it is a wait rather than a step.

### Test keys only

The script refuses to run against a key that is not `sk_test`. Every step moves
money, and on a live key it would move real money.
