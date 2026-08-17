# Soft holds on basket items

Adding a court slot or a capped event entry to a basket now **holds** it. The
place comes out of everybody else's catalogue for a short window, and the hold
lapses on its own if the member does not go on to pay.

## The problem this solves

Before this, a basket recorded an intention and nothing more. Two members could
add the same Saturday arena slot; both reached checkout; both paid. The loser
found out only at fulfilment, which re-checks availability and failed their
line — leaving the club a refund to process and a member with every reason to
be annoyed.

The window was not theoretical. It was demonstrated live: two members adding the
same exclusive-hire arena slot both received `201`.

## How a hold works

A hold is an expiry stamp on the basket line — `cart_items.expires_at` — and
nothing more. Availability queries subtract lines whose stamp is still in the
future:

```sql
AND c.status = 'open'
AND ci.expires_at IS NOT NULL
AND ci.expires_at > NOW()
```

That is the whole expiry mechanism. **Nothing runs on a timer and nothing has to
be swept.** An abandoned basket simply stops counting, and a process that
crashes mid-checkout leaves no debris to clean up.

Holds are **advisory, not a lock.** They remove the ordinary race, not a
determined one. The authority on whether a slot was actually got is still
`fulfilment.service`, which re-checks at the moment it creates the booking.

### The two windows

| Window | Length | Set by |
|---|---|---|
| Browsing | 2 minutes | adding the item to the basket |
| Payment | 15 minutes | starting checkout |

Both live in [`packages/backend/src/utils/holds.ts`](../packages/backend/src/utils/holds.ts).

The server decides the expiry; a value sent by the client is ignored. Otherwise
a crafted request could hold a contended court for an hour.

### What takes a hold

Only things that can actually run out.

- **Bookings** — always. A slot is exclusive by its nature.
- **Event entries** — only where the event *or* the activity caps entries. A cap
  at either level is enough, since an activity with no limit of its own is still
  constrained by an event limited to 60 entries.
- **Memberships, merchandise, registrations** — never. There is no slot for a
  second member to lose, and an expiry would drop the line out of the basket
  total two minutes later for no benefit.

## What each member sees

| State | The member holding it | Everybody else |
|---|---|---|
| Slot | **In your basket**, with a live countdown | **Held by someone else** |
| Entry | **In your basket** | **Held by someone else** |

Two deliberate choices here.

**Held, not full.** A held place may well come back in a minute or two. A member
told "full" goes away for good, so the wording distinguishes places that are
genuinely gone (`full`, `activity-full`) from places somebody is holding
(`held`, `held-by-others`).

**The countdown is only ever your own.** The server never sends another member's
expiry. How long a stranger has left is not the viewer's business, and showing it
would invite people to sit and wait for the clock to run out.

When the countdown reaches zero the page reloads itself, so a member is never
left looking at a slot the server no longer considers theirs.

## Payment that starts and never finishes

This is the case worth spelling out, because two minutes is nowhere near enough
to get through a card form, a bank's 3-D Secure step and a redirect back. Left
alone, the hold would lapse while the member was typing, somebody else could take
the slot, and fulfilment would refuse a member who had already paid.

The lifecycle:

1. **Checkout starts** — every live hold on the cart is extended to 15 minutes.
   Only lines that were *already* holding something are touched, and a hold that
   had already lapsed is not revived: reviving one would hand back a slot
   somebody else may have taken, so `startCheckout` refuses the whole basket
   instead (`HOLD_EXPIRED`).
2. **The member abandons the payment page** — nothing happens, and nothing needs
   to. The hold lapses 15 minutes later and the slot returns by itself.
3. **The payment fails or is declined** — `failPayment` drops the holds back to
   the browsing window, so the slot returns in about two minutes rather than
   sitting out the rest of the payment window with nobody paying for it. A retry
   re-extends them.
4. **The payment succeeds** — the cart becomes `ordered`, which takes it out of
   the hold query, and a real `booking` row stands behind the slot instead.
5. **A stale payment completes after its hold lapsed** — fulfilment's
   `assertSlotAvailable` refuses the line with a reason, exactly as it did
   before. This is the backstop that makes the whole scheme safe to keep
   advisory.

Fulfilment leaves the buyer's **own** hold out of the sum when it re-checks
(`excludeViewerHolds`). That line *is* the hold being redeemed, and counting it
would have the member's own reservation block the booking it exists to
guarantee.

## Two bugs found while building this

Both pre-dated the feature and are fixed here, because holds do not work without
them.

**`carts.status = 'ordered'` violated its own check constraint.**
`confirmPayment` sets `'ordered'`, but `carts_status_check` allowed only `open`,
`checked_out` and `abandoned`. The update raised a constraint violation inside
the confirm transaction, rolling the whole confirmation back. It also matters
here specifically: `'ordered'` is what hands a slot on from the hold to the
booking that replaces it, so a cart that cannot leave `open` keeps holding a slot
it has already paid for.
See [`1709000000025_cart-ordered-status.js`](../packages/backend/migrations/1709000000025_cart-ordered-status.js).

**A two-minute hold measured one hour and two minutes.** `expires_at` was
`timestamp without time zone`, following the convention `created_at` sets. The
API sends a JavaScript `Date`, which node-postgres renders with the server's
offset; a `timestamp` column drops that offset and keeps the local reading, and
`NOW()` in a UTC session is then an hour behind it.

Worse than the size of the error was its shape: Ireland is UTC+1 in summer and
UTC+0 in winter, so holds would have been correct for half the year and held
slots for an extra hour for the other half.
See [`1709000000026_cart-item-hold-expiry-timezone.js`](../packages/backend/migrations/1709000000026_cart-item-hold-expiry-timezone.js).

## Where the code lives

| Concern | File |
|---|---|
| Windows, holdable types, expiry helpers | `packages/backend/src/utils/holds.ts` |
| What a hold does to a slot | `packages/backend/src/utils/slot-availability.ts` |
| Querying live holds; event and activity caps | `packages/backend/src/services/account-catalogue.service.ts` |
| Taking the hold on add | `packages/backend/src/routes/account.routes.ts` (`assertAddable`) |
| Extending and releasing | `packages/backend/src/services/checkout.service.ts` |
| Redeeming | `packages/backend/src/services/fulfilment.service.ts` |
| The member-facing countdown | `packages/account-shell/src/components/HoldCountdown.tsx` |

New i18n keys, in all six locales: `holds.remaining`, `holds.expired`,
`book.reason.in-your-basket`, `browse.reason.held-by-others`,
`browse.reason.in-your-basket`. `book.reason.held` was reworded from "Being
booked" to "Held by someone else".

## Since this was written

[MANUAL_CAPTURE_AND_HOLD_CONTROL.md](MANUAL_CAPTURE_AND_HOLD_CONTROL.md) takes the
payment side further: the card is now authorised rather than charged, the order
is re-checked before the money is taken, and an expired hold cancels the payment
intent so a stale tab cannot pay. Point 5 below — the stale payment that
completes late — is now caught before the money moves rather than after.

## Known gap

A hold is taken by a `SELECT`-then-`INSERT` with no lock between them, so two
requests arriving in the same few milliseconds can both pass the check. Closing
that would need a unique constraint on the slot or a row lock on the calendar.
It has been left as it is deliberately: fulfilment already refuses the second
booking, so the outcome is the pre-existing one this feature otherwise removes,
and the exposure is now milliseconds rather than the length of a checkout.
