# "Confirming your payment", forever

## The report

> I pay for a membership with the Stripe test card. It says "Confirming your
> payment…", then after about 30 seconds changes to "Confirming your order —
> your payment is being confirmed. This page will update shortly", but it never
> does. The item is still in my basket with the option to check out again.

The money had been taken. Nothing else had happened.

## What was actually true

The stuck payment was still in the database as `pending`, with a Stripe
reference on it. Asking Stripe directly:

```
pi_3UAp4B2lw1vfQg8P1Z84xz43  ->  requires_capture   amount 7670 eur   received 0
```

**`requires_capture`, not `succeeded`.** Card payments here are taken in two
steps — authorise at checkout, capture once the order is confirmed still
available — and this one was authorised and never captured.

## Why it stopped there

Both steps are driven by webhooks:

| Stripe event | What the application does |
|---|---|
| `payment_intent.amount_capturable_updated` | `settleAuthorisation` — check availability, then capture |
| `payment_intent.succeeded` | `confirmPayment` — mark paid, close the cart — then `fulfilPayment` |

`confirmPayment` and `settleAuthorisation` had exactly one caller between them:
`webhook.service`. So if no webhook arrived, nothing could ever move the payment
on.

Which is precisely what happens on a development machine — **Stripe cannot reach
a laptop** without `stripe listen --forward-to …` — and what happens in
production any time a delivery is missed or delayed.

Meanwhile the confirmation screen polls `GET /payments/:id` ten times over
twenty seconds and then gives up, because that endpoint only ever re-read a row
that nothing was updating. It reported the truth. The truth was that the payment
was stuck.

## The fix: ask, rather than wait to be told

`webhookService.reconcilePayment(paymentId)` brings a payment up to date from
the provider's own view of it, and the status endpoint calls it whenever the
payment is still `pending` or `authorised`.

Every step is the same code the webhook runs, and every step is idempotent —
`settleAuthorisation` acts only on a payment still pending or authorised,
`confirmPayment` takes a row lock and returns false if it is already paid — so a
webhook arriving in the middle changes nothing.

| Provider says | What happens |
|---|---|
| `authorised` (`requires_capture`) | settle it, which captures the money |
| `succeeded` | confirm it, close the cart, fulfil it |
| `failed` (`canceled`) | fail it, with a reason |
| `pending` — mid 3-D Secure — or `unknown` | nothing at all |

**Two passes, not one.** Settling captures the money, and capture is what makes
Stripe's own status `succeeded`; the next poll two seconds later confirms it.
Guessing that the capture worked would be the same mistake in the other
direction.

Anything already `paid`, `refunded`, `failed` or `abandoned` is somebody's
considered answer: it is not re-opened by a page refresh, and the provider is not
even asked.

Reconciling is wrapped so it cannot fail the request. A provider that cannot be
reached must not turn a slow confirmation into an error page — the status just
read is still the honest answer.

## Proved on the stuck payment

Run against the real row that prompted the report:

```
BEFORE:  pending
pass 1 -> settled   payment now authorised
pass 2 -> paid      payment now paid

payment: paid, paid_at 2026-09-01 10:45:03
cart:    ordered
line:    membership | fulfilled | ref=f181c74f-…
```

Payment settled, basket closed, membership created — the three things that had
not happened.

## What did not change

`PaymentProvider` gained `getPaymentState`, mapping the provider's vocabulary to
what happened to the money — `requires_capture` is an authorisation, and
everything from `requires_payment_method` to `requires_action` is a payment
still in flight, not a failure. It never throws: an unreachable provider is
`unknown`, and the caller leaves the payment as it found it.

Webhooks remain the primary path and are untouched. This is the safety net under
them, and it happens to be what makes card payments work on a machine Stripe
cannot reach.

## Tests

`webhook.service.test.ts` — captures an unsettled authorisation without
confirming it; confirms and fulfils a captured one; still fulfils when something
else confirmed it first; fails a cancelled one; leaves in-flight, unknown,
already-settled, reference-less and non-existent payments alone.

`account-payment-status.routes.test.ts` — a settled payment never reaches the
provider; a pending or authorised one is reconciled and the **post-reconcile**
status returned; no re-read when nothing changed; a reconcile that throws still
answers 200 with what was read; an unknown payment is refused before any of it.
