# An entry "Awaiting payment", and nothing on the Payments page

## The report

> When I log into Ward Union Pony Club as Niamh Walsh I see an entry marked "Awaiting Payment" on
> "My entries & bookings", but when I go to Payments there is nothing listed.

Two separate things, and only one of them was wrong.

## The part that is correct

`accountActivityService.listPayments` deliberately excludes unpaid payments:

```sql
WHERE p.user_id = $1 AND p.organisation_id = $2
  AND p.payment_status NOT IN ('pending', 'abandoned')
```

A member's payment history is money that **moved**. An entry awaiting payment has not been paid for,
so it does not belong on a list of payments — it belongs where it was, on the entry, saying it is
awaiting payment. That entry is offline: the money reaches the club in person, and the club records
it, at which point the payment becomes paid and appears.

## The part that was wrong

The seed created **no payments at all**. Zero rows, for every account, in every club — so the page
was empty everywhere, for everything, paid or not. The awaiting-payment entry was simply the one
that made it noticeable.

That was a hole in the fixture I put there. In this system an entry cannot exist without a payment:
`checkout.service` writes a `payments` row and a `payment_transactions` line per basket item, and
`fulfilment.service` only then writes the `event_entries` row. Seeding entries directly, with no
payment behind them, produced a state the application cannot reach — two screens disagreeing about
the same purchase, with nothing wrong in the code to find.

The same was true of memberships, which are also bought through a basket.

## The fix

Every seeded entry and every seeded membership now writes the payment behind it, shaped the way
`checkout.service` shapes one:

| | |
|---|---|
| `payments` | `payment_type` `cart`, the fee in major units, the entry's own method and status, `payment_date` only where money moved, and the minor-unit `offline_amount` / `card_amount` split |
| `payment_transactions` | one line, `item_type` `event_entry` or `membership`, the context and `context_ref` fulfilment reads, the fee in minor units, and `fulfilled_at` where it was paid |

A refunded membership gets a refunded payment rather than none — the money did move, and a history
that omits it is the one shape a member would query.

72 payments and 72 transactions across the fixture, against 38 entries and 34 memberships.

## And one more entry

Niamh at Ward Union was the only login-and-club pair whose single purchase was the unpaid one, so
even after the fix her Payments page there was empty — correctly, and still indistinguishable from a
broken page. She now has a second Ward entry that is paid.

That pair is worth keeping: one entry shows on Payments, one does not, and the difference between
them is the answer to this report.

A test holds it: **every login has at least one paid purchase in every club it belongs to**, counting
entries and memberships together.

## Verified

Seeded into a throwaway database, which was then dropped:

```
Ward, Niamh: Ward Union Cross Country League — Senior track  ->  pending   (entry says awaiting payment; not on Payments)
Ward, Niamh: Ward Union Open Day — Family ticket             ->  paid      (listed on Payments)

login-and-club pairs with an empty Payments page: none
```
