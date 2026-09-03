# A payment now says what it bought, and for whom

## The ask

> When I click into a payment to expand its details it needs to show the full details of each item:
> for an event entry the name of the person entered and the entry fee, with a link to that entry;
> for a registration or membership the name of the person or registered item and the fee, plus a
> link to the record; the same for calendar bookings and merchandise.

A payment covering a basket read as a list of descriptions and figures. It answered neither *who was
this for* nor *where did it go* — and the description cannot answer the first, because it is composed
when the basket is filled: two children entered in one class produce two lines reading identically.

## Where the name comes from

`payment_transactions.fulfilment_ref` — the id fulfilment writes back when a line produces
something. It is the only link between a payment and the thing it bought, so `listPayments` follows
it:

```sql
LEFT JOIN event_entries ee  ON pt.item_type = 'event_entry'  AND ee.id  = pt.fulfilment_ref
LEFT JOIN members mem       ON pt.item_type = 'membership'   AND mem.id = pt.fulfilment_ref
LEFT JOIN registrations reg ON pt.item_type = 'registration' AND reg.id = pt.fulfilment_ref
LEFT JOIN bookings bk       ON pt.item_type = 'booking'      AND bk.id  = pt.fulfilment_ref
```

Each is on a primary key and matches at most one row, so none of them multiplies the `json_agg`
above it. A line whose fulfilment failed, or whose record has been deleted, simply has no name.

**One trap, found by running it rather than by reading it.** The first version collapsed the four
branches with `COALESCE(CONCAT_WS(...), CONCAT_WS(...), …)`, and every membership line came back
nameless while the entries looked right. `CONCAT_WS` returns an **empty string**, not null, when all
its arguments are null — so the first branch always won. Each branch now nulls its own empty string.

## Where each line leads

`lineDestination` maps a line to the closest thing the account app actually has:

| Item type | Goes to |
|---|---|
| `event_entry` | `/:orgCode/entries/:id` — the entry itself |
| `merchandise` | `/:orgCode/orders/:paymentId` — that page is keyed by the **payment**, so it is the one link not built from `fulfilmentRef` |
| `membership` | `/:orgCode/memberships` |
| `registration` | `/:orgCode/registrations` |
| `booking` | `/:orgCode/entries` — bookings share that screen |

The last three go to a list because the account app has no page for one of those records on its own.
That still answers "where did this money go", and is honest about how far the app can take them
today; a detail page for each is a larger piece of work than this.

**No link where there is nothing to open.** An unfulfilled line — an offline order the club has not
recorded yet — has produced no record, and a link to nothing is worse than no link.

## The seed now has baskets

Payments used to be one per purchase, which never exercised the screen this was built for. Two
baskets now hold several things each:

| Basket | Lines |
|---|---|
| `mcgrath-season` — Kildare, €184 | two children entered, the family membership renewed, a hoodie |
| `mcnamara-day` — Meath, €98 | an entry, the horse's papers renewed, a show cap |

Read back through the service, which is how this was verified:

```
KHPC | PAYMENT paid 184.00 — 4 lines
      membership    Conor McGrath        96.00 linkable
      event_entry   Áine McGrath         25.00 linkable
      event_entry   Rónán McGrath        25.00 linkable
      merchandise   —                    38.00 linkable

MHPC | PAYMENT paid 98.00 — 3 lines
      event_entry   Bríd McNamara        45.00 linkable
      registration  Ballinteer Boy       35.00 linkable
      merchandise   —                    18.00 linkable
```

Merchandise has no subject name on purpose: the description already carries the product and the
option, and there is no person to name.

Three things this needed in the seed:

- **`SHOP_ORDERS`**, because merchandise orders were not seeded at all and a basket without one
  could not show the case that was asked for.
- **Payments written last**, after every other loop, because a basket holds an entry, a membership
  and a shop order and those are created in three different places.
- **`fulfilment_ref` on every line**, without which a seeded payment's lines lead nowhere.

A basket settles once, by one method, so `database.ts` **refuses** a basket whose lines disagree on
status or payment method rather than writing a shape a real checkout cannot produce.

---

# Follow-up: the money, and where a shop line leads

## "View order" went to the wrong page

`merchandise` linked to `/:orgCode/orders/:paymentId`, which is the order
**confirmation for a whole payment** — so clicking the hoodie on the four-line
basket landed on "Order confirmed, €184", the total rather than the item.

It now goes to `/:orgCode/orders?order={fulfilmentRef}` — the shop orders list,
scrolled to that order and outlined. The same `?event=` pattern the events list
already uses, and for the same reason: the shop has no page for a single order,
so the list opened at the right card is the honest destination.

**Marked, not just scrolled to.** A card found by a scroll is lost again the
moment the member looks away from where the page landed.

That change surfaced a gap in the test setup: **jsdom implements no
`scrollIntoView`**, so the call threw during the effect flush and unmounted the
tree — the test saw an empty document and a "cannot find the text" failure with
nothing pointing at the missing browser API. `src/test/setup.ts` now stubs it,
beside the `matchMedia` polyfill that is there for the same class of reason.

## The money, broken down

A payment carrying a handling fee showed one figure, and the lines beneath it
added up to less. Nothing said why.

The expanded detail now shows **Subtotal / Handling fee / Total** — but only
where a fee was actually charged. With no fee the lines already sum to the
total, and three more rows would restate it twice. The subtotal is derived as
`total − handlingFee` rather than summed from the lines, so the three figures
reconcile even if a line is missing.

Each line also carries **its own share of the fee**, where it bears one. That is
the difference between "included" and "added on", shown on the row it applies
to: an item whose price already absorbs the fee shows nothing.

The card/offline split was already there and stays, shown only when the basket
really was settled both ways.

## Five baskets, one account

All on `aine.mcgrath@example.test` at Kildare, so every case is reachable from
one login. Which items bear a fee is the club's decision and lives on the item,
so these are composed from activities and products that already carry the flag
they need — the Spring League grades and the club hoodie include their fee,
everything else at Kildare adds it on.

| | Basket | Read back from the service |
|---|---|---|
| 1 | all card, fee **added on** | `sub €55.00  fee €1.08  total €56.08` |
| 2 | all card, fee **included** | `sub €67.00  fee €0.00  total €67.00` |
| 3 | all card, **one of each** | `sub €57.00  fee €0.58  total €57.58` |
| 4 | card added-on **+ offline** | `sub €64.00  fee €0.61  total €64.61`, card €24.61 / offline €40.00 |
| 5 | card included **+ offline** | `sub €52.00  fee €0.00  total €52.00`, card €42.00 / offline €10.00 |

Case 2 is the one worth checking: **no fee at all, not even the fixed element**,
because nothing in the basket bears one. That is rule 3 of the handling-fee
module, and a seed that charged 25c there would be teaching the wrong rule.

Three things this needed in the seed:

- **The fee is computed by the cart's own module.** `database.ts` imports
  `calculateHandlingFee` and `allocateHandlingFee` from `src/utils/handling-fee`
  rather than doing the arithmetic itself. A fixture with its own copy of the
  rule the member is charged by is two implementations that will drift.
- **A basket may mix methods.** The writer used to refuse one, which made cases
  4 and 5 impossible. It still refuses a basket that mixes *statuses* — a basket
  settles once — but the method is per line, because that is what the offline
  option is.
- **`payment_method_id` on each line**, so a line says which way it was settled.
