# Stripe webhook timeouts

Stripe reported 85 timed-out deliveries to `https://itsps.org/api/webhooks/stripe` on a test system
whose payments were otherwise working:

> 85 requests timed out. Make sure your server quickly responds to acknowledge receipt of the webhook
> event.

Stripe abandons a delivery after about **20 seconds** and records it as a timeout. Two things in this
application could take longer than that, and one of them could take four minutes.

## 1. The Stripe client had no timeout — the cause

Every `new Stripe(...)` was constructed with an API version and nothing else:

```ts
this.client = new Stripe(config.secretKey, {
  apiVersion: STRIPE_API_VERSION as Stripe.LatestApiVersion,
});
```

`stripe-node` defaults, verified against the installed version 22.4.0:

```
default timeout (ms): 80000
default maxNetworkRetries: 2
```

**Eighty seconds per attempt, and up to three attempts — 240 seconds for a single call.** The webhook
handler makes such calls: `getPaymentState`, `settleAuthorisation`, `confirmPayment`, and
`persistFromAccount` for a Connect account. One slow call and Stripe has long since given up, retried,
and made the same call again — which is how a working system produces a run of timeouts rather than
a handful.

Three clients existed — `stripe.provider.ts`, `stripe-connect.service.ts`, `lodgement.service.ts` —
each with its own copy of the API version. They now share
[`config/stripe-client.ts`](../packages/backend/src/config/stripe-client.ts), because a timeout that
applied to two of the three would be a bug on exactly the path nobody tested:

```ts
export const stripeClientOptions = (): Stripe.StripeConfig => ({
  apiVersion: STRIPE_API_VERSION as Stripe.LatestApiVersion,
  timeout: 8_000,
  maxNetworkRetries: 1,
});
```

Eight seconds is far longer than a healthy Stripe call, which answers in well under a second. One
retry rather than the library's two, because three attempts at eight seconds is 24 — already past
Stripe's deadline.

## 2. The handler had no deadline of its own — the structural fix

Bounding the outbound calls is not enough on its own: processing a payment event confirms the payment
and then fulfils **every line of the order**, and that work is unbounded in principle. The route now
races it:

```ts
const work = webhookService.process(provider.name, event);
work.catch(() => undefined);
const result = await withDeadline(work, responseDeadlineMs());
```

- Finishes in time → **200**, as before.
- Genuine failure → **500**, as before, and the service has already released its claim so Stripe's
  retry reprocesses the event in full.
- Outruns the deadline → **500 immediately**, and the work is left running.

### Why the work is not abandoned, and why a 500 is right

A promise cannot be cancelled, and abandoning this one would be worse than useless: it holds the
**claim** on the event in `processed_webhook_events`. Letting it finish is what makes Stripe's
redelivery cheap — the retry arrives to find the event already claimed and takes the idempotent
path that `webhook.service.ts` already documents at length, re-attempting fulfilment (safe per line)
and settling an authorisation (safe on a payment still awaiting a decision).

A **500 keeps Stripe as the retry engine**, which is the whole point. A 202 would be a 2xx, Stripe
would stop retrying, and this application would have quietly taken on the job of retrying payment
events itself with nothing built to do it. Answering "not finished, come back" in ten seconds is both
true and better than saying nothing for twenty.

Should the background work then fail, it releases its own claim, so the retry does the full
processing. Either way the payment is not lost.

### The rejection nobody is awaiting

Past the deadline no caller holds the promise, and an unhandled rejection ends the Node process under
its default — turning one slow webhook into an outage. `work.catch(() => undefined)` is attached
before anything can reject. The service has already logged the cause by that point; this only stops
the rejection escaping.

## Configuration

`WEBHOOK_RESPONSE_DEADLINE_MS`, default `10000`, read per request rather than at import so it can be
turned down without a rebuild. A deployment whose database is slow wants to answer **sooner**, not
later. A blank or unparseable value falls back to the default rather than to zero, which would answer
500 to every webhook instantly.

## What this does not explain

The timeouts should stop. If they do not, the remaining candidates are outside the application code
and worth checking in this order:

1. **Outbound network from the server to Stripe.** The 8-second timeout now bounds it, but if calls to
   `api.stripe.com` are being blocked or are slow to resolve, every webhook that makes one will take
   8 seconds and the logs will show it.
2. **The proxy in front of the app.** A `proxy_read_timeout` shorter than the handler's deadline turns
   a slow webhook into a 504 rather than a timeout — different symptom, same cause.
3. **The endpoint being unreachable at all.** Stripe reports "timed out" for a connection it cannot
   complete, not only for a slow response.

`logger.info('Webhook received', …)` records every arrival with its event id and payment id, and the
new deadline warning names any event that outran it. A tail of the logs during a test payment
distinguishes all three.

## Tests

`src/__tests__/routes/webhook-deadline.routes.test.ts` — 9 tests: the ordinary 200, the 400s that must
never be retried, the 500 on genuine failure, and the three properties of the deadline path (it
answers, it does not abandon or duplicate the work, and a late rejection cannot escape). Real timers
throughout: supertest drives a real socket, and freezing the clock underneath it stops the request
ever reaching the handler.
