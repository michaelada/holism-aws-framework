# The org-admin payment screen says what the money was for

## The ask

> A payment with the status Pending and the method Offline — does that mean the entries have been
> processed and only the offline payment has not been marked received? If so, that payment is not
> being listed in the Offline Payments section. Also, when I drill into a payment I should see all
> the items / transactions from the cart, with a breakdown of payment methods, handling fees and
> amounts, and be able to click through from each item to its own record.

Two separate things, both about the same screen. The status question first, because it is a bug in
the seed rather than in the app.

---

## 1. `pending` + offline was a seeded state the app cannot produce

**Yes — the entries were real.** An offline order fulfils when it is *placed*, not when the money
arrives: `fulfilment.service` treats `awaiting_offline` as fulfillable and creates the entry, the
booking and the merchandise order in a state that grants nothing (`pending` entry, unpaid order).
Memberships and registrations are the exception and are deferred until the money is recorded —
a membership card is the thing being bought, so it cannot exist unpaid.

**But the status was wrong.** A real offline checkout writes `awaiting_offline`
(`checkout.service`); the seed wrote whatever the fixture said, which for these was `pending`. The
Offline Payments screen selects on exactly one status:

```sql
AND ($2::boolean = TRUE OR p.payment_status = 'awaiting_offline')
```

so a payment that was in every other respect an unsettled offline order was invisible there — while
the entries it had produced were on the events screen. `scripts/seed/database.ts` now derives the
status from the basket rather than trusting the fixture:

```ts
first.status === 'pending' && !cardLines.length ? 'awaiting_offline' : first.status
```

and it fulfils every line of such a basket, because that is what the real path does. After a reseed:

```
awaiting_offline | offline | 10
paid             | card    | 41
paid             | offline | 29
refunded         | card    |  1
```

The ten now appear under Offline Payments, ready to be marked received.

> **Note.** `pending` + offline is not a state to fix in the data — it is one the app never writes.
> Any that remain in an older database predate this change; reseeding clears them.

---

## 2. "What this paid for"

The detail page showed a **Related Transaction** card: a type and a `contextId`. For a basket of
four that is one reference for four things, and it named none of them. It is gone, replaced by a
table of the basket:

```
What this paid for
┌────────────────────────────────────────┬──────────┬─────────┬──────────────┐
│ Item                                   │ Method   │  Amount │ Handling fee │
├────────────────────────────────────────┼──────────┼─────────┼──────────────┤
│ Full Member 2026                       │ Offline  │  €96.00 │      —       │
│ Conor McGrath                          │          │         │              │
│ View member                            │          │         │              │
├────────────────────────────────────────┼──────────┼─────────┼──────────────┤
│ Intermediate — Spring League           │ Card     │  €25.00 │        €0.62 │
│ Áine McGrath                           │          │         │              │
│ View entry                             │          │         │              │
├────────────────────────────────────────┼──────────┼─────────┼──────────────┤
│ Club hoodie (Navy, M)                  │ Card     │  €38.00 │      —       │
│ View order                             │          │         │              │
├────────────────────────────────────────┼──────────┼─────────┼──────────────┤
│ Subtotal                               │          │ €159.00 │        €0.62 │
│ Total                                  │          │         │      €159.62 │
└────────────────────────────────────────┴──────────┴─────────┴──────────────┘
```

Three columns beyond the description, each answering one of the things asked for:

- **Method per line.** A basket may be part card and part offline, and the payment's own method
  cannot say which line was which. `payment_transactions.payment_method_id` can.
- **Handling fee per line.** Its share of the fee, or a dash where the item's price already absorbs
  it. That is the difference between "added on" and "included", shown where it applies.
- **Subtotal and total**, summed from the lines, so the single figure at the top of the page is
  accounted for.

**Who it was for, under the description.** The description is composed when the basket is filled, so
two children entered in one class produce two identical lines; the name is what tells them apart.

### Where each line leads

`lineDestination` maps a line to the closest thing the **org-admin** app has — which is not the same
set of screens the account app has, so the mapping differs from the one in
[PAYMENT_DETAIL_ITEMISED.md](PAYMENT_DETAIL_ITEMISED.md):

| Item type | Goes to |
|---|---|
| `event_entry` | `/events/:eventId/entries` — entries have no page of their own; the event comes from the line's `contextRef`, which is where the basket recorded it |
| `membership` | `/members/:fulfilmentRef` |
| `merchandise` | `/merchandise/orders/:fulfilmentRef` |
| `registration` | `/registrations` |
| `booking` | `/calendar/bookings` |

**No link where there is nothing to open.** A line that has not been fulfilled — the deferred
membership on an unpaid offline order — has produced no record, so the row says *Not created yet*
rather than offering a link to nothing.

### Where the data comes from

`GET /api/orgadmin/payments/:id` now returns `{ ...payment, lines }`. The lines come from
`paymentService.getPaymentLines(id, payment.organisationId)`, which joins each line to the record it
produced through `payment_transactions.fulfilment_ref`:

```sql
LEFT JOIN event_entries ee  ON pt.item_type = 'event_entry'  AND ee.id  = pt.fulfilment_ref
LEFT JOIN members mem       ON pt.item_type = 'membership'   AND mem.id = pt.fulfilment_ref
LEFT JOIN registrations reg ON pt.item_type = 'registration' AND reg.id = pt.fulfilment_ref
LEFT JOIN bookings bk       ON pt.item_type = 'booking'      AND bk.id  = pt.fulfilment_ref
```

Scoped by the **payment's own** organisation, which `byResource('payment', 'id')` has already
established the caller administers — not by the caller's currently selected club, which would return
an empty basket for a payment the caller can legitimately see.

The same `CONCAT_WS` trap as the account-side query applies and is handled the same way: it returns
an empty string rather than null when every argument is null, so each branch is wrapped in
`NULLIF(TRIM(...), '')` before the `COALESCE` rather than the `COALESCE` being wrapped once.

### Translations

`payments.details.{items,item,method,handlingFee,subtotal,total,noItems,notYetCreated}` and
`payments.details.view.*` in all six locales. `payments.details.amount` was already there and means
the same thing, so it is reused rather than duplicated.

`payments.paymentMethodOptions` gained **`stripe`** and **`pay-offline`**: the payment row records
`card` / `offline`, but a *line* records the payment method's own name from `payment_methods`, and
without those two keys the raw table names reached the screen.

## Tests

| Suite | Covers |
|---|---|
| `packages/backend/src/services/__tests__/payment.service.test.ts` | `getPaymentLines` — shape, organisation scoping, unfulfilled lines, null names, missing fees, failure |
| `packages/backend/src/__tests__/routes/payment-detail.routes.test.ts` | the endpoint returns the basket, scopes it by the payment's organisation, 404s without reading lines, 500s rather than reporting an empty basket |
| `packages/orgadmin-core/src/payments/pages/__tests__/PaymentDetailsPage.test.tsx` | the table, the per-line method and fee, the totals, both links, *Not created yet*, an empty basket, and a response saved before `lines` existed |
