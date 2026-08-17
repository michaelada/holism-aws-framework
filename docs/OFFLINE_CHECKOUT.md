# Paying the club directly: the order that went nowhere

Reported as: two slots booked with **Pay Offline**, checkout accepted and said
the club still had to be paid — and then nothing under *My entries & bookings*.
Repeating it produced a second payment. The basket still held both slots.

Every part of that is one of two faults.

## 1. The offline path never closed the cart

`confirmPayment` closes the cart for a card order:

```sql
UPDATE carts SET status = 'ordered' WHERE id = $1
```

The offline path had no equivalent — `markAwaitingOfflinePayment` only touched
`payments`. So the cart stayed `open` with every line in it.

The consequence is not just cosmetic. A member who checks out and sees their
items still in the basket does the only sensible thing and checks out again.
**Five payments had accumulated against one pair of slots** before it was
reported.

It also matters for the slots themselves: availability only counts holds on a
cart that is still `open`, so a cart that never closes goes on holding slots
until the hold lapses.

Fixed in `markAwaitingOfflinePayment`, beside the status it already sets, so the
two cannot drift apart again.

## 2. Bookings were held back until the money arrived

Fulfilment created **only event entries** ahead of payment:

```ts
if (!paid && itemTypeOf(line.item_type) !== 'event_entry') { deferred += 1; continue; }
```

For a membership that is right — an entitlement running for a year, given away
if granted before payment, with no gate to check on the day. Merchandise, the
same: goods should not be posted unpaid.

**A booking is the opposite case and was wrongly grouped with them.** A slot that
is not booked is a slot *still on sale*: the basket hold lapses two minutes after
checkout, so the member who has just committed to pay watches it go to somebody
else. Meanwhile they see nothing at all under *My entries & bookings*, which is
what was reported.

Everything needed to do this properly already existed: `bookings` records its own
`payment_status`, and the account app has an `awaiting-payment` state it renders.
Bookings now join entries in being created ahead of the money, and
`calendar.service` is passed the payment method — it reads one as "not paid yet"
and sets `payment_status` accordingly — so the booking says plainly that it is
not settled.

One existing test asserted the old behaviour (`waits for the money on an offline
booking`). It was pinning the bug, and has been corrected rather than worked
around.

## 3. Shop orders were held back too

Reported separately, once the bookings were working: an item bought with Pay
Offline, and nothing under *My shop orders*.

Merchandise was deferred alongside memberships, on the reasoning that goods
should not be posted unpaid. That confuses **creating the order** with
**dispatching it**. `merchandise_orders` defaults *both* `order_status` and
`payment_status` to `pending`, so the order can exist while nothing is sent —
and without it the member saw nothing *and the club had no order at all*: no
record that money was owed, or what to set aside.

An order record is not the goods. Merchandise now joins entries and bookings,
with the payment method recorded so the club's list says what it is waiting for.
Stock is reserved on creation, which is the same trade a booking makes with its
slot.

### What is still deferred, and why

Memberships and registrations, for a reason that genuinely applies to them:
`createMember` and `createRegistration` set `active` when the type
auto-approves, so creating one before payment hands over the entitlement itself
rather than a record of an intention. Making them visible would mean forcing
`pending` when unpaid regardless of auto-approval — a decision about approval
rather than about fulfilment, so it has been left alone.

**This means a membership bought offline is still invisible to the member until
the club records the payment.** Worth deciding on separately.

## The rule, as it now stands

An offline order creates every record that can exist in a state granting
nothing:

| Type | Created before payment? | Why |
|---|---|---|
| `event_entry` | yes | created `pending`; the gate checks on the day |
| `booking` | yes | an unbooked slot is still on sale, and the hold lapses |
| `merchandise` | yes | `order_status` and `payment_status` both `pending` |
| `membership` | no | `active` on auto-approve — that is the entitlement |
| `registration` | no | same |

## Verified

The exact scenario, live: two Group lessons slots at Meath Hunt, both Pay
Offline, one checkout.

| | Before | After |
|---|---|---|
| Basket afterwards | 2 items | **empty** |
| My entries & bookings | nothing | **2 bookings, `awaiting-payment`** |
| Payments | one per attempt | **one**, `awaiting_offline`, 2 lines |
| Cart status | `open` | `ordered` |

Backend suite: 2790 passing.

## Did the seed need resetting?

No — this was a code fault, and a reset would have reproduced it exactly. But
the failed attempts had left debris (five stray payments, an unclosed cart), and
an earlier `--reset --no-stripe` run of mine had left the clubs without Connect
accounts, so a clean `npm run seed:demo -- --reset` was worth doing anyway.

One thing to know about that: Stripe's identity verification is asynchronous and
uneven, and one club in four tends to be still `pending` when the seed's
reconcile pass gives up. The seed says which. Opening that club's Payment
Settings re-reads the account and clears it; it is not a failure.
