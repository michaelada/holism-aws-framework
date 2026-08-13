# Account User Application — catalogue, basket and checkout (phase 8)

The cart API and the handling-fee calculator existed from phase 4 and **nothing called either**.
This phase closes the loop: a member can now find something, add it to a basket, pay for it, and see
the order confirmed.

**Decisions taken before building** (asked and answered):

| Question | Decision |
|---|---|
| Where does the platform's handling fee go? | **Stripe Connect, taken as an `application_fee_amount`** |
| Helix Pay, with no API contract available? | **Provider abstraction, Stripe implemented, Helix an explicit stub** |
| Scope | **Full end-to-end** |

---

## 1. ⚠️ Connect changes the credential model — action required

This is the most important thing in this document.

The org-admin payment settings tab used to store **per-organisation** `stripeSecretKey`,
`stripePublishableKey` and `stripeWebhookSecret`. That is the **direct-charge** model: each club has
its own Stripe account and its own keys, and every charge — handling fee included — settles into the
club's balance. The platform would have to invoice for its fee afterwards.

Connect destination charges work the other way round:

| | Direct (what was stored) | Connect (what is built) |
|---|---|---|
| Secret key | per organisation | **one, the platform's, from the environment** |
| Webhook secret | per organisation | **one, the platform's, from the environment** |
| Publishable key | per organisation | **one, the platform's** |
| Per organisation | keys | **`settings.stripeConnect.accountId` (`acct_…`)** |
| Handling fee | settles with the club | **`application_fee_amount`, kept by the platform** |

So:

**New environment variables** — the platform's, not a club's:

```
STRIPE_SECRET_KEY=sk_live_…          # backend
STRIPE_WEBHOOK_SECRET=whsec_…        # backend
VITE_STRIPE_PUBLISHABLE_KEY=pk_live_…  # packages/account-shell
```

**Per-organisation state:** `settings.stripeConnect`, written by the onboarding flow below.

⚠️ **Not `settings.paymentSettings`, and that matters.** `updatePaymentSettings` rebuilds that whole
object from its own defaults and sanitiser on every save, so any key it does not know about is
wiped. Storing the connected account id there would mean an unrelated settings change silently
severed the club's ability to take money, and the next member to pay would be refused with no
obvious cause. It is also not user-editable configuration — it is state Stripe gave us.

(An earlier draft of the checkout service read `settings.payment`, which is neither path. It would
never have found the account id.)

**Connect onboarding is built** — see §2a.

**The old per-organisation key fields have been removed** — see
[REMOVE_PER_ORG_STRIPE_KEYS.md](REMOVE_PER_ORG_STRIPE_KEYS.md). They survived this phase as unused
fields, on the reasoning that removing a field a recently-built UI saves is a change worth making
deliberately. That change has now been made: the "Stripe Configuration" section is gone from the
settings tab, the four keys are out of the `PaymentSettings` contract and sanitiser, and migration
`1709000000014` deletes them from stored settings.

**One webhook endpoint serves every club**, because every charge is on the platform account:
`POST /api/webhooks/stripe`.

---

## 2. Backend

### The provider abstraction

`src/services/payment-providers/` — `PaymentProvider` (the contract), `StripeProvider`,
`HelixPayProvider`, and a registry.

Money crosses this boundary **only in integer minor units**, because that is what
`utils/handling-fee.ts` produces and no float rounding should ever reach a charge.

**`HelixPayProvider` is a deliberate stub that throws.** Helix Pay's API contract is not in this
repository or its documentation, and a payment integration is the last place to guess — an invented
request shape fails when a member is trying to pay, not at build time. `isConfigured()` returns
false, so the registry never selects it and checkout refuses the configuration cleanly. Note for
whoever implements it: the Connect-style split has to be expressed in whatever terms Helix offers,
or the handling fee has nowhere to go. That is a commercial question as much as a technical one.

### Checkout — `checkout.service.ts`

The order of operations is the design:

1. **Re-price the cart server-side.** Nothing the client says about money is trusted.
2. **Create the `payments` row first**, `pending`. It is what the provider's metadata points back
   at, so it must exist before the charge. A payment with no charge is a harmless abandoned row; a
   charge with no payment row is money that cannot be reconciled.
3. **Snapshot the fee configuration.** The super-admin can change an organisation type's fees at any
   time; without the snapshot, last month's payment silently re-prices when a report is opened.
4. **Then create the intent**, with `idempotencyKey = payment_<paymentId>`.

`startCheckout` is idempotent: an in-flight payment is reused, so a reloaded checkout page does not
produce a second charge.

**Fulfilment does not happen here.** Creating the entry or membership happens when the webhook
confirms the money arrived. Doing it at checkout hands out entries for payments that then fail.

An order with nothing to charge (everything offline) is completed immediately and never reaches a
provider, which would reject a zero charge.

### Webhooks — `webhook.service.ts` + `routes/webhook.routes.ts`

Providers retry until they get a 2xx and resend events regardless. Processing twice means two
entries for one payment.

The guard is an **insert-first claim** on `processed_webhook_events`, unique on
`(provider, event_id)`: try to insert, treat a unique violation as "someone else has it", otherwise
do the work. Checking-then-inserting leaves a window where two concurrent deliveries both find
nothing. `confirmPayment` additionally takes `FOR UPDATE` on the payment row and re-checks its
status, so even a bug in the claim cannot double-fulfil.

A failure **releases the claim** so the retry can succeed — otherwise a transient database error
would permanently mark the event handled and the member is charged and gets nothing.

Two details in the route that are easy to get wrong:

- **`express.raw()`, mounted before the global `express.json()`.** Stripe signs the exact bytes it
  sent; parsing and re-serialising invalidates every signature. `src/index.ts` mounts
  `/api/webhooks` ahead of the JSON parser, with a comment saying why.
- **Status codes drive retries.** Bad signature → 400 (never retry). Processing failure → 500
  (retry). Already processed, or an event we ignore → **200**, or the provider retries an event that
  will never be actioned, forever. That last one is the subtle failure: the endpoint looks healthy
  while being hammered.

### Catalogue — `account-catalogue.service.ts`

Events open for entry and membership types open to join, **with availability decided on the server**
(G8). The cart trusts its caller, so availability the browser decided would be no protection: a
member could post to `/cart/items` directly and enter a closed or full event.

Unavailable rows are returned **with a reason** rather than filtered out. Someone looking for an
event they know exists is better served by "entries closed" than by an empty list.

### New endpoints

```
GET  /api/account/:orgCode/catalogue/events              (event-management)
GET  /api/account/:orgCode/catalogue/membership-types    (memberships)
POST /api/account/:orgCode/checkout
GET  /api/account/:orgCode/payments/:paymentId
POST /api/webhooks/stripe                                (unauthenticated; signature is the auth)
```

### 2a. Connect onboarding — `stripe-connect.service.ts`

Deliberately **not** behind the `PaymentProvider` abstraction: that contract is about taking a
payment, and onboarding a connected account has no counterpart in a provider that has not been
implemented. Inventing a generic shape for one real implementation would be a guess dressed as a
design.

```
GET  /api/orgadmin/organisation/stripe-connect                  status, refreshed from Stripe
POST /api/orgadmin/organisation/stripe-connect/onboarding-link  start or resume
```

- **The account is created on first use and its id recorded immediately**, before anything else can
  fail. An account created at Stripe but not recorded here is orphaned — invisible to us, and the
  next attempt would create a second one for the same club.
- **Account links are minted per request, never stored.** Stripe's are single-use and short-lived,
  so a cached link is an expired link by the time anyone clicks it.
- **The return URLs are checked against `ALLOWED_ORIGINS`** (`utils/allowed-origins.ts`, shared with
  CORS). Stripe redirects the administrator's browser to them, so an unvalidated value makes the
  endpoint an open redirect — and one the victim is walked through by Stripe itself.

  This first shipped comparing against the request's own `Host` header, which was **wrong and broke
  the button entirely**: every front end reaches the API through a proxy that rewrites `Host` —
  Vite's dev server with `changeOrigin: true`, nginx in production — so the backend compared the
  browser's `localhost:5175` against its own `localhost:3000` and returned 400. An explicit allowlist
  does not depend on how the request was routed, and is the stronger check.

  If the button returns 400 with "Return URLs must be on an allowed origin", add the address the
  admin app is served from to `ALLOWED_ORIGINS`.
- **`account.updated` keeps the status fresh.** It is the only prompt we get that a club finished
  onboarding; without acting on it a club stays marked unable to take payments until somebody
  happens to open the settings screen. An account this deployment does not recognise is ignored
  rather than 500'd, so Stripe does not retry an event that will never match.
- **Status is cached, not fetched per page load** — `chargesEnabled` decides whether a club can
  sell, and asking Stripe on every checkout would put a network call in the payment path. A Stripe
  outage leaves the stored state stale rather than failing the settings screen.
- `requirementsDue` carries Stripe's `currently_due` only. `eventually_due` is excluded: showing a
  club paperwork it does not need yet makes onboarding look unfinished when it is not.

The org-admin UI is `StripeConnectPanel`, first on the Payment Settings tab because nothing else
there matters until it is done. It distinguishes **"details submitted" from "can take charges"** —
a club that stops at Stripe's last screen would otherwise believe it had finished.

### 2b. Membership pricing

Membership basket lines were being added at **zero**, on my assumption that a membership's price
lived on its application form. It does not: `membership_types.fee` is the price, exactly as
`event_activities.fee` is for an activity. Every membership was therefore free.

The catalogue now returns `fee` and `handlingFeeIncluded` for each membership type, the browse screen
shows the price, and the basket line carries it. A line at zero now means the club has genuinely set
no fee.

### 2c. Application forms at add-to-basket

```
GET  /api/account/:orgCode/forms/:formId        the form to complete
POST /api/account/:orgCode/form-submissions     record the answers
```

This is what makes membership fulfilment reachable: `members.form_submission_id` is NOT NULL, so a
basket line with no submission is paid for and then fails. `ApplicationFormDialog` collects the
answers before the item enters the basket, creating the submission **first** and adding the line
with its id — an orphaned submission is harmless, whereas a line pointing at answers that were never
saved is an order that cannot be fulfilled.

Both endpoints check the form belongs to the caller's organisation; the service looks forms up by id
alone, so without that check a member could read any club's form by guessing an id. The submission
is attributed to the resolved session, never to a user id in the request body.

### Migration `1709000000010`

`payments.application_fee_amount`, `payments.provider_account_id` (recorded per payment, so a club
that re-onboards does not retroactively rewrite where past money went), and the
`processed_webhook_events` table.

---

## 3. Front end

| Screen | Route |
|---|---|
| **D1/D4** Enter or join | `/:orgCode/browse` |
| **F1** Basket | `/:orgCode/cart` |
| **F2** Payment | `/:orgCode/checkout` |
| **F3** Order outcome | `/:orgCode/orders/:paymentId` |

**Every figure comes from the server.** The handling fee depends on which items are card-paid, on
the organisation type's configuration and on tax; a second implementation in the browser would
eventually disagree with the one that takes the money. The fee is shown as its own line rather than
folded into the total, because a member who meets an unexpected figure at the card form abandons the
basket.

**The client's success is not the order's success.** Stripe tells the browser the card was accepted,
but the order exists only once the webhook is processed. So checkout **polls the payment status**
before showing a receipt, and the confirmation screen keeps checking while the payment is pending
rather than claiming success. Both give up after a bounded wait — an indefinite spinner is worse
than a page that says "still confirming".

Basket and checkout are **not** capability-gated: a basket can hold items from any enabled area, and
gating it on one capability would hide it from a club that sells through another.

---

## 4. Tests — 57 backend, 28 front-end

| Suite | Tests |
|---|---|
| `checkout.service.test.ts` | 22 — Connect split, idempotency, offline orders, rollback, scoping |
| `stripe.provider.test.ts` | 24 — Connect params, retry classification, signature verification, registry, Helix stub |
| `webhook.service.test.ts` | 11 — exactly-once, claim-then-work, release on failure |
| `BrowsePage.test.tsx` | 11 |
| `CartPage.test.tsx` | 9 |
| `OrderConfirmationPage.test.tsx` | 8 |

`packages/account-shell`: **173 passing, 0 skipped**, typecheck clean, builds.
`packages/backend`: 102 suites passing (was 98), 1,991 tests passing (was 1,932); nothing regressed.
183 i18n keys aligned across all six locales.

---

## 4a. Fulfilment

`fulfilment.service.ts`, migration `1709000000011`. A paid order now creates what it bought:
**event entries** directly, and **memberships** via `membershipService.createMember` — delegated
rather than reimplemented, because that is where membership-number generation and expiry live, and a
second implementation would draw from a second sequence and quietly break uniqueness.

### It runs *after* the payment is confirmed, not inside its transaction

The obvious design — one transaction for money and goods — is wrong here:

- **The money must never be lost.** If fulfilment fails, a payment that has genuinely been taken
  must still be recorded as paid. Rolling it back leaves the member charged by Stripe and marked
  unpaid here: the worst of both.
- **Lines fail independently.** A membership with no application form cannot be created; the entry
  beside it can. One bad line must not block the rest of the order.
- **It has to be resumable.** A retry after a partial failure must finish the job without
  re-issuing what already succeeded.

So fulfilment state lives **per line** on `payment_transactions` — `fulfilled_at` (the idempotency
guard), `fulfilment_ref` (what was created, which is what a refund will need to undo) and
`fulfilment_error` (why a line could not be fulfilled). A single boolean on the payment would lose
all of that: one failed line would either block the whole order or be forgotten.

### The redelivery subtlety

A first version wired fulfilment only into the freshly-claimed path, which was wrong: the webhook's
idempotency claim returns early on a redelivery, so an order whose payment was confirmed and whose
fulfilment then failed would never be completed — the member charged, with nothing to show.

The claim guards *event processing*; it is **not** a record that the order was completed. So a
redelivery of a succeeded event now still attempts fulfilment. That is safe precisely because
fulfilment is idempotent per line: a redelivery can only ever complete outstanding work, never
duplicate it.

A line-level failure is **recorded, not thrown**. Retrying will not conjure a missing application
form, and a provider hammering the endpoint over an unfulfillable line helps nobody — the reason
sits on the line for a human to act on.

**Membership fulfilment works but is unreachable in practice**: `members.form_submission_id` is NOT
NULL, and nothing yet puts a form submission on a basket line, so every membership line currently
fails with "the membership application form has not been completed for this item". That is the
honest failure rather than a constraint violation, and it will start working the moment application
forms are wired into add-to-basket.

Merchandise, bookings and registrations fail explicitly as "not implemented for <type>" rather than
appearing fulfilled.

## 4b. ⚠️ A destructive test corrupts the test database

`src/__tests__/migrations/membership-type-discount-ids-migration.test.ts` runs

```sql
DROP TABLE IF EXISTS membership_types CASCADE;
```

against the **shared** `aws_framework_test` database, recreates a stripped-down version to exercise
the migration, and **never restores the real one**. The suite passes, so this is silent.

The effect: after any full backend run, `aws_framework_test` is missing `membership_types` while
`pgmigrations` still records its creation as applied — so `migrate:up` will not put it back, and the
schema is quietly wrong until the database is rebuilt:

```bash
dropdb aws_framework_test && createdb -O framework_user aws_framework_test
cd packages/backend && DATABASE_URL=…/aws_framework_test npx node-pg-migrate up -m migrations
```

**Scope, measured rather than assumed:** no suite in the current failing set references
`membership_types`, so this is not causing the 17 failures. It is latent damage — it will bite the
first suite that needs that table against a real database, and it makes any schema-dependent result
depend on run order.

Two ways to fix it, both a decision about test architecture rather than a repair, so neither is done
here: give the destructive migration tests their own throwaway database, or have them restore the
real schema afterwards. Other suites in `src/__tests__/migrations/` drop `payment_methods` and
`org_payment_method_data` the same way.

## 5. What still does not work

- **Nothing has been run against real Stripe** — see the last bullet.
- **No refunds through this path**, no discount application at checkout, no merchandise or calendar
  items, no Apple/Google Pay beyond whatever `automatic_payment_methods` enables.
- **Nothing has been run against real Stripe.** Every test uses a stubbed client. The Connect
  parameters and the webhook contract are written to Stripe's documented API but have not been
  exercised against a sandbox — that needs the platform account and keys from §1.
