# The recent-payments card leaves the home screen

Removed at the club's request: it was not needed. Payments have their own page
(C6), and the home screen is for what a member can act on rather than a receipt
they have already had.

## Removed all the way down, not hidden

The card was the only consumer of `AccountDashboard.recentPayments`, and that
field was the only reason the dashboard read payments at all:

```ts
const [entries, bookings, memberships, cart, payments, whatsOn] = await Promise.all([
  ...
  accountActivityService.listPayments(organisationId, organisationUserId),   // gone
```

Dropping the card and leaving the query would have cost every member a payments
read on the first screen they see, for data nothing renders — and nothing would
ever have failed to say so. So the field went from the response, the call went
from the `Promise.all`, and `RECENT_PAYMENTS_LIMIT` went with them.

A test pins it, because this is the kind of thing a type cannot catch:

> `it('does not read payments at all')` — `expect(activity.listPayments).not.toHaveBeenCalled()`

## What changed

| | |
|---|---|
| `GET /api/account/:orgCode/dashboard` | no longer returns `recentPayments` |
| `AccountDashboard` | field removed, backend and `account-shell` types alike |
| `home.recentPayments`, `home.allPayments` | removed from all six locales |
| B3 wireframe | payments card dropped; the basket card keeps the row |

The account app is the only consumer of that endpoint, so nothing else had to
be reconciled.

## The empty-page check

The home screen renders a "nothing yet" card when a member has nothing at all,
and `recentPayments` was one of the conjuncts it tested. That conjunct went too.

It was harmless rather than urgent — `!undefined` is `true`, so an absent field
would have left the test permanently satisfied rather than permanently blocked,
and the message would still have appeared. But a condition that can no longer be
false is one a later reader has to work out from the API shape, and the next
person adding a section to that list would have copied it.

## Verified

Backend 2822 passing, account-shell 561, both type-clean. The wireframe was
re-rendered with `scripts/wireframes/ascii_to_svg.py build`, which changed only
`B3-home-my-dashboard.svg`.

The 3 remaining account-shell failures are the pre-existing `packages/components`
breakage described in [PHANTOM_CAPABILITIES.md](PHANTOM_CAPABILITIES.md).
