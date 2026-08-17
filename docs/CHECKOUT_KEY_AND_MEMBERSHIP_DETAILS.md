# A dead Pay button, and three smaller things

Four changes, from one report. The first was a bug; the rest are the account
app's membership screens.

## Pay Now was greyed out for ever

Reported at Meath Hunt: the checkout summary showed the right total, and the Pay
button could not be pressed.

**The account app had no Stripe publishable key.** It read
`VITE_STRIPE_PUBLISHABLE_KEY` from `packages/account-shell/.env`, a file that
does not exist in this repository — only `.env.example` does. So:

```
loadStripe('')  →  rejects
useStripe()     →  null for ever
disabled={!stripe || …}  →  a button that can never be enabled
```

The key *did* exist, in `packages/backend/.env`. It was simply in the wrong
place for a separate Vite app to read, and nothing said so.

Two fixes, because there were two faults:

**The key now comes from the API.** `CheckoutResult.publishableKey` is served
beside the client secret, read from the platform's own environment next to the
secret key it already holds. A front end needs no payment configuration of its
own, and the publishable and secret keys cannot drift onto different Stripe
accounts — a failure that presents as a card form silently refusing every
payment. The `VITE_` variable is still honoured as a fallback.

**And when there is no key at all, the page says so.** A disabled button with no
explanation is indistinguishable from a broken browser, and this is the club's
configuration rather than the member's card. It now reads "Card payment is not
available for this club at the moment", and the form is not mounted.

Verified live: `publishableKey: pk_test_…` and a client secret both present in
the checkout response, for a Meath basket.

## The membership card is the link

Each membership card on the home screen carried a *View memberships* button.
With four cards in the row that was the same three words four times, while the
obvious target — the card — did nothing.

The button is gone and the whole card opens My Memberships, as a
`CardActionArea` so it is a real button: keyboard-reachable, announced as one,
with the hover and ripple that say it can be pressed.

**Renew stays outside it.** It goes somewhere else (the membership catalogue),
and nesting a button inside a button is invalid markup that browsers resolve by
firing both.

## My Memberships shows what was filled in

Each membership now has a collapsed *Your details (n answers)* section holding
every answer from the application form, labelled and in the club's own field
order.

This is the only record a member has of what the club was told — the form itself
is gone once the membership exists — so it is where they check the pony's name,
the age group or the emergency contact they gave, and spot what needs
correcting.

Three deliberate choices:

- **Collapsed by default.** It is reference material; a card opening fifteen
  rows of it buries the membership number and expiry date that most people came
  for.
- **Unmounted while collapsed**, not merely hidden. A member can hold several
  memberships of a dozen answers each, and the default would render a hundred
  hidden rows — findable by page search and by a screen reader walking the card.
- **Nothing at all when the club asked nothing.** An empty accordion invites a
  click that reveals nothing and implies the answers were lost.

The builder that joins submissions to their form labels moved to
`utils/form-summary.ts`. The basket already did this, and two copies would
eventually disagree about how an unanswered optional field looks — the sort of
difference a member notices and cannot explain.

## Nothing in the seed costs more than €100

Nine items were over, across **all four clubs**, not only the one that prompted
the report:

| | |
|---|---|
| Table of ten (Ward Union) | €500 → €90 |
| Full week, residential (Kildare) | €395 → €95 |
| Camp — full week, club pony (Meath) | €280 → €98 |
| Full week, non-residential (Kildare) | €275 → €75 |
| Camp — full week, own pony (Meath) | €220 → €85 |
| Family Membership (all four) | €160 → €96 |

The rule is now written where the fees are declared, alongside the units, since
both have been got wrong once each:

> Every fee in this file is in **major units** — `fee: 25` is €25 — and is
> inserted raw. Nothing costs more than €100.

Re-seeded and checked: the dearest item anywhere is €98.

## Verified

Both suites pass — 2768 backend, 522 front-end. Live against a running stack:
the publishable key and client secret reaching the checkout response, membership
records carrying their form answers, and no seeded price above €100 in any of
events, memberships, merchandise, calendar durations or registrations.
