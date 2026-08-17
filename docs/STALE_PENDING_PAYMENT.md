# A pending payment that outlived its basket

Reported as: *"The payment section seems confused. I have one item in my basket
at the moment, and it shows a pending payment, with the same item in twice."*

The display was the visible half. The other half was that the member would have
been **charged the wrong amount**.

## What was actually there

| | |
|---|---|
| Basket | 1 item, €35.00 |
| Pending payment | 2 identical lines, `card_amount` **7130** (€71.30) |
| Stripe | a live PaymentIntent for €71.30 |

Both payment lines shared a `created_at` to the microsecond, so they were
written by a single `createPayment` call — the basket really did hold that
booking twice at the moment checkout started. The surviving cart item's
`expires_at` post-dated the payment by three minutes, confirming the basket had
been edited afterwards.

## Three faults, in order of severity

### 1. A pending payment was reused however much the basket had changed

`startCheckout` reuses an in-flight payment so that reloading the checkout page
does not create a second charge. That idempotency was unconditional:

```ts
const existing = await this.findPendingPayment(cart.id);
if (existing) return existing;          // whatever the basket looks like now
```

A payment is a **snapshot** — its `card_amount`, its `payment_transactions`
lines and its Stripe intent are all fixed when checkout starts. The basket is
not frozen alongside it. Add, remove or re-price a line and nothing noticed:
the next checkout handed back the old total and the old client secret.

**Fixed** by fingerprinting the basket onto the payment (`cartFingerprint` —
items, quantities, fees, chosen payment methods, and the totals, since a club
can change its handling fee without any line changing). A payment whose
fingerprint no longer matches is *retired*, not reused:

- marked `abandoned`, with a reason the member can read;
- its lines marked `abandoned`, so they stop reading as outstanding work;
- its provider intent cancelled, so nothing can pay the old amount.

A payment carrying no fingerprint at all predates the check and is treated as
stale — there is no way to tell whether it still matches, and guessing wrong
means charging the wrong amount.

Reuse for an *unchanged* basket is untouched, which is what stops a page reload
creating a second charge.

### 2. Attempts were listed as payments

`listPayments` had no status filter: `WHERE p.user_id = $1 AND p.organisation_id
= $2`. Every abandoned checkout showed on the member's Payments screen as an
order they never placed, itemised with lines they had since removed. That is
what looked "confused".

**Fixed** by excluding `pending` and `abandoned`. Everything representing a real
obligation or outcome stays — `paid`, `awaiting_offline`, `refunded`, and
`failed`, because a decline is something the member has to act on.

### 3. The same slot could be in one basket twice

This is how the duplicate got in. The duplicate-add guard works through
availability, and availability only counts holds that have not lapsed:

```sql
AND ci.expires_at > NOW()
```

Two minutes after adding an exclusive slot, its hold is invisible, the slot
reads as free, and adding it again succeeds — one court, twice, in one basket.

**Fixed** with a direct check against the basket, which does not expire, rather
than through availability, which does. It now refuses before availability is
even consulted.

## Verified

Live, against a running stack:

| Step | Result |
|---|---|
| Checkout with one €42 item | payment A, €42.88 |
| Add a second item, checkout again | **payment B, €77.39** — A retired |
| Checkout again, basket unchanged | payment B reused, no churn |
| A in the database | `abandoned`, "Your basket changed, so this payment was replaced" |
| A's Stripe intent | `canceled` |
| Payments screen | empty — no attempts listed |
| Same slot added twice | refused, *before and after* the hold lapses |

## An unrelated bug found on the way

While reproducing this I noticed the Meath seed data priced a day ticket at
**€6,500**. The seed's fee fields are in **major units** throughout — Kildare's
`fee: 25` is €25, inserted raw — and the Meath events, calendar durations and
registration types added in the previous change were written in minor units, so
every Meath price was 100× too high.

Corrected, and the registration insert now writes the fee raw like every other
fee in the file rather than dividing by 100, which had made registrations the
one exception to the convention.
