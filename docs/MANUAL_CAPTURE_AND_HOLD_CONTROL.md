# Manual capture, and control over an expiring hold

Follows on from [BASKET_SOFT_HOLDS.md](BASKET_SOFT_HOLDS.md), which added the
holds themselves. This is about what happens when a member starts paying and the
hold behind their order runs out.

## The question

> Can we use Stripe embedded payments to have better control over the hold —
> e.g. if the person is taking too long to make their payment, we can stop it?

The premise needed correcting first: **the checkout was already embedded.**
`CheckoutPage` renders Stripe's `PaymentElement` and calls
`stripe.confirmPayment()` on our own page. There was never a hosted redirect to
move away from.

What was missing was not the integration shape but the control it makes
possible. The payment screen had no idea a hold existed, and nothing anywhere
could cancel a payment intent.

## Three levers, and what each is worth

| Lever | Stops | Doesn't stop |
|---|---|---|
| Countdown, disabled Pay button | The honest case: a member watching the screen | A stale tab, whose `client_secret` is still valid |
| Cancelling the PaymentIntent | The stale tab — the secret stops working | A confirmation already in flight |
| **Manual capture** | Money moving for something that has gone | The race itself |

All three are implemented. The third is the one that changes the outcome rather
than narrowing the window.

## Manual capture

Payment intents are now created with `capture_method: 'manual'`. Confirming
authorises the card — funds held, nothing moved — and the platform decides
afterwards.

```
member confirms
      ↓
payment_intent.amount_capturable_updated   ← funds held, nothing taken
      ↓
orderAvailabilityService.check(paymentId)  ← are the slots and entries still there?
      ↓
   yes → capturePayment()  → payment_intent.succeeded → confirm → fulfil
   no  → cancelPayment()   → failPayment(reason)      → holds released
```

**Reversing an authorisation is not a refund.** No money moved, so there is no
refund fee, and nothing lands on the member's statement beyond a pending
authorisation that drops off. Previously the same situation — slot gone, member
already charged — left the club with a refund to process and a member to
apologise to.

### What it costs

- **Bank redirects disappear.** `automatic_payment_methods` now only offers
  methods that support manual capture: cards and card-backed wallets. iDEAL,
  Bancontact and SEPA cannot authorise without taking, so Stripe excludes them.
- **Capture becomes a step that must happen.** An authorisation left uncaptured
  expires after a few days and the club is simply never paid. This is why
  `capturePayment` raises a *retryable* error, and why a redelivered
  authorisation event still settles even when the event was already claimed — a
  first delivery that died mid-decision must not strand the funds.
- **The race is not eliminated.** Between confirming and Stripe processing, a
  cancel can lose. Manual capture makes losing cost an auth reversal instead of
  a refund; the guarantee that two members never get one slot is still
  fulfilment's re-check.

## Stopping a payment whose hold ran out

`POST /api/account/:orgCode/checkout/:paymentId/abandon`, called by the payment
screen when its countdown reaches zero. It cancels the payment intent, which is
what makes the expiry bite: the `client_secret` held by a tab left open stops
working, so a laptop woken an hour later cannot pay for a slot that has since
gone to somebody else.

Deliberately forgiving:

- A payment already `authorised` is **not** cancelled — it is mid-decision on
  the server, and cancelling underneath that would race the capture. Returns
  `{ abandoned: false }`.
- A Stripe outage does not fail the response. The member is being told their
  hold expired; failing that message over a best-effort tidy-up would leave them
  at a form that no longer works.
- Scoped by member, 404 for anything else — a payment id must not be actionable
  by whoever guesses it.

On the screen itself: the hold notice carries a live countdown, the Pay button
is disabled the moment it lapses, and a *Back to basket* button appears. The
countdown hides once the payment is in flight — a timer ticking down beside
"processing" reads as a threat to a payment that has already left.

## What is re-checked, and what is not

`orderAvailabilityService` looks only at **bookings and capped event entries**.
A membership or a jumper cannot be taken by somebody else between authorising
and capturing, so re-checking them would add failure modes without preventing
anything; merchandise stock stays with fulfilment, which decrements it
transactionally.

**The buyer's own holds are excluded throughout** (`excludeOwnHolds`,
`excludeViewerHolds`). The order being checked *is* those holds being redeemed.
Counting them would have a member's own reservation report their slot as taken
and reverse a payment that should have gone through.

This also closes a gap that pre-dated holds: fulfilment re-checked booking slots
but never event-entry capacity, so a capped activity could be oversold. It is
now checked before the money is taken.

## A third dormant bug, found on the way

`payment_transactions.item_type` is copied verbatim from the basket, which
writes `event_entry`. Fulfilment switched on `event-entry`. **Every paid event
entry would have failed** with "fulfilment is not implemented for event_entry",
and the offline-entry rule — the one that creates an entry before the money
arrives — never matched either.

It survived for two reasons worth recording:

1. No payment had ever reached fulfilment at all, because confirming one always
   rolled back on the `carts.status = 'ordered'` constraint fault fixed in
   [BASKET_SOFT_HOLDS.md](BASKET_SOFT_HOLDS.md). Two dormant bugs hid each other.
2. The fixture in `fulfilment.service.test.ts` used the hyphen too. **The test
   agreed with the code rather than with the database**, which is the failure
   mode a fixture is most prone to.

Fixed by normalising both spellings, with tests that assert the spelling
production actually writes.

## Where the code lives

| Concern | File |
|---|---|
| `capture_method`, capture, cancel, new webhook events | `packages/backend/src/services/payment-providers/stripe.provider.ts` |
| `capturePayment` / `cancelPayment` on the contract | `packages/backend/src/services/payment-providers/payment-provider.ts` |
| The capture-or-reverse decision | `checkout.service.ts` (`settleAuthorisation`) |
| Stopping an expired checkout | `checkout.service.ts` (`abandonCheckout`) |
| Is the order still available? | `order-availability.service.ts` |
| Routing the `authorised` outcome | `webhook.service.ts` |
| Countdown, disabled Pay, abandon call | `packages/account-shell/src/pages/CheckoutPage.tsx` |

New i18n keys in all six locales: `checkout.holdNotice`, `checkout.holdLapsed`,
`checkout.backToBasket`.

## Verified

Unit tests cover the settlement decision, the provider's idempotency in both
directions, webhook routing and redelivery, the availability check, and the
screen. Live against a running stack: `holdExpiresAt` reaching the client, the
abandon endpoint releasing a 15-minute hold back to the 2-minute window,
returning `{ abandoned: false }` on a second call, and 404 for a payment that is
not the member's.

**Not verified end to end against Stripe.** No seeded club has a Connect
account, and a destination charge needs one, so no real authorisation was
created. The capture and cancel calls are proven against a mocked client only.
Before this goes near production it wants one manual pass in Stripe test mode
with a connected account: confirm a card, watch `requires_capture`, and check
both branches — capture, and reversal when the slot is taken underneath it.
