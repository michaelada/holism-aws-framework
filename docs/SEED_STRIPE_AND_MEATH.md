# Seed: Stripe test accounts, and a club with every capability

Two changes to `npm run seed:demo`, which had two related gaps: no club could
take a card payment, and no single club exercised the whole product.

## Stripe test connected accounts

Every seeded club now gets a **test-mode connected account**, so the card path
works from a fresh seed.

### Why the obvious approach doesn't work

The question that prompted this was whether a platform's *production* Connect
data — account ids, publishable and secret keys for organisations that had
authorised it — could be turned into test credentials for a dev environment.

It cannot, and the reasons are structural rather than procedural:

- **A live `acct_...` has no test counterpart.** Test connected accounts are
  separate objects with different ids. There is no mapping.
- **OAuth tokens are issued per mode.** A connection made in live mode yields
  live credentials only, and no endpoint exchanges one for the other.
- **A connected account's test keys belong to that business.** Only they can see
  them, in their own dashboard.

It is also unnecessary here. **This codebase stores no per-organisation Stripe
keys** — only `settings.stripeConnect.accountId`, with charges made as
destination charges on the platform's key (see `REMOVE_PER_ORG_STRIPE_KEYS.md`).
A freshly created test account is a complete substitute.

Separately: production Connect credentials should not be in a dev environment at
all. An OAuth access token acts on the live account and can move real money.

### What the seed does instead

`scripts/seed/stripe.ts` creates one account per club against the platform's own
`sk_test_` key.

**Custom, not Standard.** `stripe-connect.service` creates `standard` accounts,
which is right in production — the club owns the account and completes Stripe's
onboarding. That is useless in a seed, because a Standard account stays
`charges_enabled: false` until a human clicks through a hosted form. These are
`custom` accounts with the test fixtures pre-filled. The application only ever
reads the account id, so the difference is invisible downstream.

**A live key is refused outright, with no override flag.** This module creates
connected accounts from a script whose sibling command is `--reset`.

**Accounts are tagged and purged.** Each carries `metadata.seededBy`, and
`--reset` deletes the ones it can prove it created — not every account on the
platform.

```bash
npm run seed:demo -- --reset              # includes Stripe when a test key is set
npm run seed:demo -- --reset --no-stripe  # skip it (offline, or leave Stripe alone)
```

### Three things Stripe made awkward

Each cost a round of trial and error, and each produces a misleading error:

| Symptom | Cause |
|---|---|
| `Not a valid URL` on `business_profile[url]` | Stripe validates against real domains and rejects both the seed's `.test` addresses **and** `example.com`. Solved with `product_description` instead. |
| `charges_enabled: false`, `past_due: [external_account, individual.address.state]` | An account needs somewhere to pay out to and a county. Neither is obvious from the API reference's required-fields list. |
| One club in four stuck at `card_payments: pending` with **nothing** in `currently_due` | Identity verification is asynchronous and uneven. Handled by reconciling the whole batch once after all accounts exist, rather than waiting per club. |

If an account is still verifying when the seed finishes, it says so. Stripe
finishes on its own, and opening that club's Payment Settings re-reads it.

## Meath Hunt Pony Club

A fourth club, `mhpc`, with **every capability** — 22, against 13–14 for the
others.

The existing three each leave something switched off deliberately, so that the
*absence* of a capability stays represented: Kildare alone has the shop, Laois
alone has bookings, Ward Union has no card payments. That is good for testing
and poor for demonstrating, because no single login reached the whole product.
Meath fills that gap without disturbing it.

Capabilities are switched on with an `allCapabilities` flag rather than a copied
list, which would go stale the moment the type gained one. The new capabilities
were added to the org type's `defaultCapabilities` **and** its
`optInCapabilities`, so the other three clubs are unchanged.

| | |
|---|---|
| Org admin | `admin@meathhunt.test` |
| Members | Bríd McNamara, Colm Fitzgerald, Aoibhínn Regan, Séamus Donnelly, Maeve Kiernan, plus Niamh Walsh and Darragh O'Toole who also belong elsewhere |
| Events | Summer Pony Camp (event-level cap), Tara Hunter Trial (**electronic tickets**), Winter Dressage Series (entries not yet open) |
| Memberships | 10, including a three-child family membership and one lapsed |
| Shop | Softshell jacket, show cap, embroidered numnah |
| Bookings | Indoor arena (exclusive, with a harrowing gap), Group lessons (4 places, minimum 2) |
| Discounts | 6, one per module — including the seed's only `registrations` discount |
| Registrations | 2 types, 6 registered horses |

Everything uses the password in the seed's own printout.

## Registering a horse

The registrations capability had **no seed data at all**, so its screens had
nothing to show.

A registration is the one part of the platform that is not about a person. The
seed makes that explicit: a new `horseRegistration` form built from horse
vocabulary — passport number, microchip, year foaled, flu vaccination date,
registered owner — rather than reusing the rider fields, which would have hidden
the distinction.

Three things are allowed to be three different answers, which is precisely what
makes a registration not a membership with another label:

- `entity_name` — the horse (*Ballinteer Boy*)
- `owner_name` — whoever the passport says owns it (*Fitzgerald Family*)
- `user_id` — the member whose login it sits under

Both period mechanisms are represented:

- **Horse registration 2026** — annual. `is_rolling_registration: false` with a
  fixed `valid_until`, so every horse lapses on the same day, the way a season
  does. Six horses, covering active, pending approval and expired.
- **Day registration** — rolling, three months from whenever it is taken out,
  for a visiting horse.

## Verified

The seed was run end to end. Checked live through the account API: Meath's 22
capabilities, its registration types and a member's own registration, the shop,
the calendars, and all three events including the one whose entries are not yet
open.

The card path was exercised for the first time in this environment — a basket
add taking a two-minute hold, then a real checkout producing a Stripe
PaymentIntent:

```
status         : requires_payment_method
capture_method : manual
transfer_dest  : acct_… (Meath's connected account)
payment methods: card
```

That confirms three things previously only asserted against mocks: manual
capture is really in force, destination charges route to the club, and
`payment_method_types` is card-only — the bank-redirect trade-off described in
[MANUAL_CAPTURE_AND_HOLD_CONTROL.md](MANUAL_CAPTURE_AND_HOLD_CONTROL.md),
observed rather than predicted.

**Still not verified:** a card actually being confirmed, authorised and captured.
That needs a browser driving Stripe's card form; the seeded environment can now
support it, which it could not before.

## Known wrinkle

`--reset --no-stripe` clears the database but leaves the previous run's Stripe
accounts behind, because the purge is part of the Stripe step. The next full
`--reset` deletes them by their metadata, so it self-heals rather than
accumulating.
