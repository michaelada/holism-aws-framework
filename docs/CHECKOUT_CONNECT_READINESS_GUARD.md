# Checkout must check that a club *can* take charges, not just that it started onboarding

Found by driving the Stripe Connect onboarding flow against real Stripe (test mode) rather than
against the stubbed SDK the unit tests use.

## The bug

`CheckoutService.startCheckout` resolved the club's connected account and refused the payment when
there was no account id:

```ts
const destinationAccountId = await this.connectedAccountId(organisationId);
if (!destinationAccountId) {
  throw new ValidationError('This organisation has not finished connecting its payment account');
}
```

An account id is recorded the moment a club clicks **Connect with Stripe** — `accounts.create` runs
before the club has typed anything into Stripe's hosted onboarding. A club that starts onboarding
and stops, which is the normal outcome of a first sitting, therefore has an `acct_…` on file while
Stripe still reports:

```
details_submitted:  false
charges_enabled:    false
capabilities:       {}
currently_due:      business_profile.url, external_account, tos_acceptance.date, …
disabled_reason:    requirements.past_due
```

The presence check passes, so checkout proceeds to `paymentIntents.create` with
`transfer_data.destination` — and Stripe rejects it, because the destination account has no
`transfers` capability. The member sees a **failed payment** at the moment they try to pay, phrased
in Stripe's language about destination-account capabilities. It is a setup problem being reported as
a card problem, to the one person who cannot do anything about it.

The message for this situation already existed. It just was not reachable.

## The fix

Guard on readiness, not on presence: `connectedAccountId` becomes `connectedAccount`, returning the
id together with `chargesEnabled`, and checkout refuses unless Stripe will actually let the club take
money.

`chargesEnabled` is read from `settings.stripeConnect`, as persisted by onboarding and refreshed by
the `account.updated` webhook, rather than by calling Stripe on each checkout. An extra round trip on
the payment path buys little when the webhook keeps the value current, and the failure directions are
not symmetric:

- a stale `false` costs a club one clear "finish your setup" message until the next refresh;
- a stale `true` costs a member a failed payment.

The safe direction to be wrong in is the first.

## Verified against real Stripe

`StripeConnectService` was driven directly against the platform's test-mode key, exercising our own
service rather than the SDK:

| Step | Result |
|---|---|
| `getState` | read the persisted account from the database |
| `refreshState` | live `accounts.retrieve`, state re-persisted |
| `createOnboardingLink` | live `accountLinks.create`, returned a working hosted-onboarding URL |

This also settles an earlier open question: `accounts.create` and `accountLinks.create` **have** now
run against real Stripe. The connected account (`acct_1U2a8…`, standard, IE/EUR) exists and is
reachable; it is simply not onboarded yet.

## What is still untested end to end

Completing hosted onboarding is a human step — bank account and Stripe's terms — so no automated run
can reach a `charges_enabled: true` club. Until someone finishes onboarding for a test club, these
remain unexercised against real Stripe:

- a destination charge with `application_fee_amount`
- the `account.updated` webhook flipping `chargesEnabled` to true
- payment fulfilment after `payment_intent.succeeded`

## Tests

`checkout.service.test.ts` — the `withConnectedAccount` fixture now carries `charges_enabled`, since
an id alone no longer represents a club that can be paid. A new case covers the started-but-unfinished
state and asserts no payment intent is created.
