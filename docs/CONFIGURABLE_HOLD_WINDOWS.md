# Hold windows a club can set, and a basket that tells the truth

Three changes to how holds behave, plus a layout fix.

## A lapsed hold is removed, not greyed out

An expired line used to sit in the basket priced at nothing, blocking checkout
until the member noticed and deleted it by hand. That is a basket lying about
what it holds: the slot went back on sale the moment the hold ran out, and
anybody could have taken it since.

`getCart` now deletes lines whose hold has lapsed and reports what went:

> *"Indoor arena — Saturday 17:00" was held for you, but the hold ran out and it
> has been removed*

Deleted on read rather than by a sweeper, which keeps the design's one good
property: **nothing runs on a timer**, and an abandoned basket needs no tidying.
Only lines that were actually holding something are touched — a membership or a
jumper never held a place and must not vanish for sitting in a basket.

The warning carries a description rather than an id, because the row is already
gone. That is the point: the basket must not simply shrink.

## Both windows are per-organisation

| | Default | Range | Was |
|---|---|---|---|
| Basket hold | **3 minutes** | 1–60 | fixed at 2 |
| Payment hold | **15 minutes** | 5–180 | fixed at 15 |

Set in the Platform Admin, on the organisation's own page, and stored in
`organizations.settings.holds`.

Per club because the right window is a property of the club rather than of the
platform. A riding school taking bookings all day wants a short basket hold so
slots come back quickly; a club selling a handful of event entries a season does
not care. Both were stuck with the platform's number.

### Reading is forgiving, writing is strict

`holdWindowsFrom` falls back to the default for anything missing, unparseable,
zero, negative or out of range, and clamps rather than throwing. It is asked
while a member is adding something to a basket, and refusing *that* because a
setting was mistyped would be a far worse outcome than a hold of the standard
length.

`holdWindowsError` — used on save — reports the limit instead. An administrator
who typed 500 should be told the maximum, not silently given 180.

### Two details worth knowing

**The settings column is merged, not replaced**, so saving hold windows cannot
wipe `stripeConnect` sitting beside them. Verified: the connected account
survives a hold-window save.

**The windows are cached for 30 seconds**, since they are read on every
add-to-basket and every checkout and change perhaps twice in an organisation's
life. `updateOrganization` drops the cache for that club, so an edit applies to
the very next basket — confirmed live, an 8-minute window taking effect
immediately after the save.

## The basket block on the home page

Two things were pushing it right, and they had to be fixed in turn.

**It was the second cell of a two-column summary grid**, so with anything beside
it the card sat in the right-hand half while every row below started at the
left. It now has a row of its own, and comes first: a basket with something in
it is the most actionable thing on that page, and it is what the member came
back to finish.

**The title is inside the card**, where its neighbours keep theirs. "Coming up"
and "Recent payments" both titled themselves, so lifting this one out to sit at
the container edge — level with "Memberships" — made it the odd card of the
three. The grid was what made the block look indented; the title only inherits
the card's padding, and the card's own edge lines up with the teasers below
either way. ("Recent payments" has since been removed from the home screen; the
basket keeps its title for the same reason, now alongside "Coming up" alone.)

It carries a **shopping-cart mark in the same orange as the count in the
navigation**, so the badge that says there is something in the basket and the
card that shows it read as one thing.

## Verified

Live, against a running stack:

| | |
|---|---|
| Default basket hold | **3.0 minutes** |
| Meath set to 8 / 40 | basket **8.0**, extended to **40.0** at checkout |
| `stripeConnect` after that save | intact |
| `basketMinutes: 500` | 400, *"must be between 1 and 60 minutes"*, stored value untouched |
| `checkoutMinutes: 2` | 400, *"must be between 5 and 180 minutes"* |
| A lapsed hold, basket re-read | line gone, warning naming it, no row left in the table |

Backend 2809 passing; account-shell 548.

The 3 remaining account-shell failures, and one in the admin app's `RolesPage`,
are the pre-existing breakages described in
[PHANTOM_CAPABILITIES.md](PHANTOM_CAPABILITIES.md) — untouched by this change.
