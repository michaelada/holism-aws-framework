# Events demo seed

A script that puts a local environment into a known state for testing the events capability, and
that can wipe and rebuild that state on demand.

```bash
npm run seed:demo -- --dry-run      # report what it would do, change nothing
npm run seed:demo -- --reset        # wipe everything, then seed
npm run seed:demo -- --reset-only   # wipe everything and stop
npm run seed:demo                   # seed on top of what is there
```

Source: [`packages/backend/scripts/seed/`](../packages/backend/scripts/seed/) — `index.ts` (CLI and
guards), `dataset.ts` (what gets created), `database.ts` (SQL and the reset), `keycloak.ts` (users,
groups, roles).

---

## 1. What it creates

| | |
|---|---|
| Organisation type | **Irish Pony Clubs** — EUR, en-GB, 13 capabilities, handling fee €0.25 + 1.5%, platform share €0.30 + 1.5% |
| Organisations | **Kildare Hunt** (`khpc`), **Laois Hunt** (`lhpc`), **Ward Union** (`wupc`) |
| Logins | 1 super admin, 3 organisation admins, 16 account users across 24 club affiliations |
| Events | 13, with 29 activities |
| Forms | 6 forms per club (18), built from 26 fields per club (78) covering 13 field types |
| Memberships | 5 membership types per club (13 in total), with 22 members for this season |
| Shop | 8 products at Kildare Hunt, each with a generated image, plus 10 option groups and 30 option values |
| Bookings | 4 calendars at Laois Hunt, with 6 slot patterns, 10 durations, 2 blocks and 2 schedule rules |
| Discounts | 13, applied across events, activities, memberships, merchandise and calendars (25 applications) |

Every login uses the password **`Passw0rd!`**, non-temporary and with the email pre-verified, so no
seeded account lands on a password-change or confirm-your-email wall.

### The three clubs differ on purpose

- **Kildare** — both payment methods, inherits the type's platform share.
- **Laois** — both methods, but a **negotiated platform share** (€0.15 + 1.0%), so the per-organisation
  override is visible without editing anything.
- **Ward Union** — **offline payment only**, and its platform share is explicitly unconfigured. This is
  the club that catches code assuming a card provider exists: any activity asking for card payment
  is seeded as offline instead, because a club with no card provider cannot offer one.

### Member overlap is the point

Eight people, fifteen memberships, five in each club:

| Member | Clubs |
|---|---|
| Niamh Walsh, Cillian Murphy | all three |
| Órla Kavanagh | Kildare, Laois |
| Darragh O'Toole | Laois, Ward |
| Fionn Doyle | Kildare, Ward |
| Saoirse Brennan / Ruairí Kelly / Tadhg Nolan | one each |

Tadhg is left **pending**, so the awaiting-approval screen (A8) has a subject. Five unrelated people
per club would leave the organisation switcher and the "which club am I acting as" resolution
untested.

### Events cover every entry-window state

| State | Count | Example |
|---|---|---|
| Open, closing in a while | 3 | Spring Show Jumping League (closes in 14 days) |
| **Closing soon** | 3 | Autumn Rally (closes tomorrow), Autumn Hunter Trial (2 days), Hunt Ball (3 days) |
| Not open yet | 2 | Summer Camp (opens in 21 days) |
| Closed to entries | 3 | Winter Dressage — Round 3 |
| No window configured | 1 | Ward Union Open Day |
| Draft | 1 | Christmas Fun Day |

Plus one event already in the past, for reporting and for a member's completed entries.

### Settings coverage across the 29 activities

- **12** cap applicants (activity-level limit); **6 events** cap total entries (event-level limit)
- **5** allow the member to choose a quantity
- **3** require terms and conditions; **3** include the handling fee in the fee shown
- **27** attach an application form
- Payment: 16 offer both methods, 3 card only, 10 offline only

### Field types exercised

`text`, `textarea`, `number`, `email`, `phone`, `date`, `time`, `datetime`, `boolean`, `select`,
`multiselect`, `radio`, `checkbox` — across four forms: a three-step wizard with grouped sections
(*Full competition entry*), a grouped single-page form (*Camp booking*), a two-field minimum
(*Short entry*), and a no-pony form (*Spectator registration*).

`file` and `image` are **deliberately absent**. They need the document-upload storage path
configured, and a seeded form that half works is worse than one that does not claim to.

### Membership types and members

Five types per club, chosen to cover the axes the membership pages branch on:

| Type | Category | Fee | Term | Approval |
|---|---|---|---|---|
| Junior Member | single | €45 | to the end of the season | automatic |
| Senior Member | single | €75 | to the end of the season | reviewed |
| Family Membership | group, 2–5 people | €160 | to the end of the season | reviewed |
| Associate Member | single | €30 | **rolling**, 12 months from joining | automatic |
| Founder Member | single | €0 | to the end of the season | **closed** to new applications |

*Founder Member* exists only at Kildare Hunt, so a club without it is also represented. A type can
only offer what its club has switched on, so every type at Ward Union is offline-only.

The season is the **calendar year**, computed when the seed runs rather than written down — a seed
with a hard-coded year quietly produces nothing but expired memberships once that year passes.

The 22 members are deliberately uneven, because a member list where every row is identical proves
nothing about the filters and batch actions the page is built around:

- **Active, paid** members across all five types
- One **pending** application awaiting approval, with its form submission still `pending`
- One **elapsed** member from last season who never renewed
- One **unpaid** and one **refunded** membership
- Two **households** on group memberships, sharing a `group_membership_id` with numbered person slots
- **Three memberships due for renewal**, expiring inside the 30-day window

Every member has a real `form_submissions` row behind them, keyed by field name, so the application
a member submitted can actually be opened.

#### Parents holding their children's memberships

**A membership belongs to a person, who may have no login of their own.** `members.user_id` is the
*holder* — whoever signs in — while `first_name` / `last_name` are the person it is for. Two seeded
logins exercise this:

| Login | Holds |
|---|---|
| `aine.mcgrath@example.test` | 4 in Kildare: her own Senior (**expiring**), Conor and Éabha on a Family membership, Rónán on a Junior |
| `lorcan.hayes@example.test` | 2 in Ward Union: Maeve and Cathal, **both expiring**, and nothing of his own |

Conor, Éabha, Rónán, Maeve and Cathal appear in `ACCOUNT_USERS` **not at all** — they exist only as
`members` rows. Lorcán is the sharper case: every membership under his login is for somebody else,
so a screen naming the holder would be wrong on every card.

Renewal dates are computed from the run date, not the calendar, so an *expiring* membership is still
expiring whenever the seed is run.

#### Membership numbers

Each club counts from its own band — 100000, 200000, 300000 — and `membership_number_sequences` is
left pointing at each club's next free value, so the first member created through the UI continues
where the seed stopped.

The banding works around a contradiction worth knowing about: `members.membership_number` carries a
UNIQUE constraint across the **whole table**, while the organisation type is configured
`membership_number_uniqueness = 'organization'`. Taken literally, that configuration lets two clubs
both allocate 100000 — and the second insert fails. The seed sidesteps it; the schema still needs
reconciling.

### Merchandise — Kildare Hunt only

**Only Kildare has the `merchandise` capability**, so a club *without* a shop stays represented. The
capability is opt-in rather than a type default: an organisation's `enabled_capabilities` must be a
subset of its type's, so `merchandise` is listed in `ORG_TYPE.defaultCapabilities` (which permits it)
and named in `optInCapabilities` (which keeps it off by default). `capabilitiesFor(org)` combines
the two, and feeds both the organisation row **and** its admin role — granting a role a capability
the club has not switched on would give an administrator menu entries leading to endpoints that
refuse them.

Eight products, chosen to cover what the merchandise pages branch on rather than to look like a
plausible catalogue:

| Product | Covers |
|---|---|
| Club polo shirt | **quantity-based delivery** (3 bands, free over 6), two option groups, one size sold out |
| Club hoodie | **fixed delivery**, tracked stock, handling fee included |
| Club cap | **free delivery**, untracked stock, max order quantity |
| Embroidered saddle pad | asks for an **application form**, terms and conditions, custom confirmation message |
| Rosettes, set of ten | quantity-based delivery, min/max order, quantity increments |
| Club yearbook | **sold out** — every option value at zero, so the catalogue reports `out-of-stock` |
| Grooming kit | out of stock with `hide`, so it **drops out of the catalogue entirely** |
| Christmas jumper | **inactive** with stock on the shelf — `not-on-sale` is about the switch, not the shelf |

Verified against `accountCatalogueService.listMerchandise`: the yearbook comes back
`out-of-stock`, the jumper `not-on-sale`, the grooming kit not at all, and the remaining five as
available.

#### Product images

Every product carries at least one image, because **the application requires it** —
`merchandise.service.createMerchandiseType` refuses an item with an empty `images` array, so
products seeded without one sat in a state the app itself would not have created.

Each product is **drawn as itself** — a collared shirt, a hoodie, a cap, a saddle pad, a rosette, a
book, a kit bag, a snowflake jumper — by `scripts/seed/artwork.ts`. The first pass was a coloured
tile with the product's name on it, which proved the plumbing and nothing else: every card looked
like every other card, and a screen meant to show a shop showed a colour chart.

They are **generated SVG data URIs**, not uploads. Real images are S3 keys put there by the
org-admin gallery, and a seed that needed a configured bucket would fail on most machines. A data
URI is the one form both paths understand: `resolveImageUrls` passes anything starting with `data:`
or `http` through untouched rather than trying to sign it, and the member-facing shop renders the
stored value directly. Each is a couple of kilobytes of flat SVG shapes — flat rather than illustrated, because they have
to read at 56 pixels in a home-screen thumbnail. Two products carry extra views, drawn on deeper
grounds so a gallery has something to page through without pretending to be a second photograph.

> **Worth knowing:** `listMerchandise` (the member path) returns `images` **raw**, while the
> org-admin routes call `resolveImageUrls` first. Data URIs work either way, so the seeded shop
> looks right — but a **genuinely uploaded** image is an S3 key that the member-facing shop would
> render as a broken `<img>`. Seeding data URIs makes the fixture work without fixing that.

**Untracked stock is `NULL`, not `0`.** Zero reads as sold out, which is a different claim from
"not counted" — and `hasStock` treats null as "always available", so the distinction decides whether
the cap and the saddle pad are buyable.

### Calendar bookings — Laois Hunt only

**Only Laois has the `calendar-bookings` capability.** Each club now carries exactly one opt-in
capability and Ward Union none, so "capability off" stays represented on every screen:

| Club | Opt-in capability |
|---|---|
| Kildare Hunt | `merchandise` |
| Laois Hunt | `calendar-bookings` |
| Ward Union | none |

Four calendars, covering what the booking pages branch on:

| Calendar | Covers |
|---|---|
| Outdoor arena | **exclusive hire** (1 place), two patterns (weekday evenings, weekend mornings), three durations, cancellation with **automatic refund**, reminder emails, and a **blocked week** for re-sanding |
| Group lessons | **shared places** (6 and 8), a **minimum** below which the lesson does not run, a **fortnightly** Saturday clinic, a **recurring daily gap** while the arena is dragged, cancellation with **manual** refund |
| Cross-country schooling | 4 places, long durations, **cancellations refused**, and an **automated open/close** pair |
| Clubhouse hire | **closed** with a full schedule behind it — `not-open-for-bookings` is about the switch, not the absence of slots |

Each carries a **display icon** from the shared set (`equestrian`, `lesson`, `hiking`, `clubhouse`)
alongside its colour, which is what the member's home screen draws to tell one from another.

Verified against `accountCatalogueService`: three come back bookable and the clubhouse does not.
Slot generation was checked too — the re-sanding block removes exactly days 21–27 and no more, the
fortnightly clinic lands 14 days apart, and the blocked 19:30 segment is absent from Wednesdays.

Dates are offsets from the run, so the blocked week is always still ahead of today.

> **Fixed while seeding this:** `listCalendars` tested `status !== 'active'`, a value the column
> never takes — `calendar.service` writes `open`, and the union is `open | closed`. Every calendar
> was therefore reported as `not-open-for-bookings`, so no member could book anything at all. Test
> fixtures using `active` / `inactive` had pinned the bug in place. This is the same mistake as the
> membership renewal one fixed in `account-activity.service` (`membership_status = 'active'`),
> in a second service.

### Discounts

| Discount | Type | Scope | Code |
|---|---|---|---|
| Early bird 10% | percentage | item | `EARLYBIRD` |
| Club member €5 off | fixed | item | — (automatic) |
| Third entry free | percentage 100% | quantity-based, every 3rd | — |
| Spring promotion | percentage | item | `SPRING24` — **expired**, so the expiry path has a subject |
| €10 off baskets over €60 | fixed | cart | `BASKET10` — with usage limits |
| Family rate 15% | percentage | quantity-based, from the 2nd | — |
| Winter league 20% | percentage | item | `WINTER20` — capped at €15, 25 uses, 4 already used |

Six more cover the other capabilities, so every discountable thing in the platform has a worked
example rather than only events:

| Discount | Applies to | Scope |
|---|---|---|
| Family membership 10% | Family membership type | item, automatic |
| Early renewal €5 off | Senior membership type | item, code `RENEW5` |
| Club kit 15% | Polo and hoodie | item, code `KIT15` |
| Second item half price | Polo | quantity-based, from the 2nd |
| Off-peak 20% | Outdoor arena | item, code `OFFPEAK` |
| Block of five lessons 10% | Group lessons | quantity-based, from the 5th |

Each is written to `discount_applications` **and** to the `discount_ids` array on the target,
because both are in the schema and different code paths read different ones — the array drives the
screens, the join table answers "where is this discount used?".

---

## 2. Every date is relative to the run

The seed exists to reach specific **states** — entries closing this week, a membership due for
renewal, a blocked week still ahead — and those are relationships to today, not calendar dates.
Written down as fixed dates they hold for a fortnight and then quietly stop testing anything.

So every date it writes is an offset resolved at run time, in
[`scripts/seed/dates.ts`](../packages/backend/scripts/seed/dates.ts):

| Data | Expressed as |
|---|---|
| Events | `startDays`, `endDays`, `openDays`, `closeDays` from the run |
| Discounts | `validFromDays`, `validUntilDays` |
| Calendars | slot `fromDays` / `untilDays`, blocked periods, schedule rules |
| Members | `renewedDaysAgo`, and a season (below) |
| Application forms | ages, not birth years — a junior born in a fixed year becomes an adult |

Run it in a month, a year or five years and the same fixture appears, shifted forward. Verified at
several run dates including 20 December, 3 January, a leap day and 2031: 12 events still ahead, 6
open for entry, 3 closing within three days, 2 not yet open, memberships clear of renewal except
the 3 meant to be due, the previous season lapsed, the blocked week ahead, and both a live and an
expired discount — identical every time.

### The membership season

A membership year is the calendar year, so "this season" ordinarily ends on 31 December of the year
the seed is run in. **Except near its end.** Run it in December and every current membership would
expire within days, so the whole cohort would read as due for renewal and the two or three meant to
stand out would not. Past `SEASON_ROLLOVER_DAYS` (60) the seed moves on to the following season,
which is what a club would have done by then anyway.

`previous` is then the last season that has actually *finished*, not simply one before the current
one — after the rollover those are different, and counting back from the current season lands on a
date that has not passed yet.

`scripts/seed/__tests__/dates.test.ts` runs this arithmetic against dates the calendar has not
reached, which is the one claim a suite run today cannot make by accident. `jest.config.js` includes
`scripts` in its roots for that reason.

## 3. The reset

`--reset` deletes **all application data** — every organisation type, organisation, event, membership,
form, discount, cart, payment and login — and every Keycloak user and group tree the script created.
Then it rebuilds from scratch. Three consecutive resets were verified to produce byte-identical
counts.

### What it will not do

The Keycloak purge deletes **only what it can prove it created**: users carrying a
`seededBy: itsplainsailing-demo` attribute, plus the emails read out of `organization_users` before
the tables were cleared. Both are needed — the attribute misses a user created before tagging
existed, the email list misses one whose database row was already gone. A realm-wide wipe would take
the operator's own account with it, and on a shared dev realm everyone else's too.

### Guards

`--reset` is unrecoverable, so the script checks where it is pointed before doing any of it:

| Condition | Behaviour |
|---|---|
| `NODE_ENV=production` | **Refused. No override.** |
| Database host not local | Refused unless `SEED_ALLOW_REMOTE_DB=yes` |
| Keycloak URL not local | Refused unless `SEED_ALLOW_REMOTE_KEYCLOAK=yes` |

Environment variables rather than an interactive prompt, because a prompt that can be piped past is
not a guard once this ends up in a CI job.

### Deletion is explicit, not cascaded

`resetDatabase` names all 50-odd tables in child-to-parent order. Several would cascade from
`organizations`, but not all do, and relying on cascade would make the blast radius depend on which
migration last touched a foreign key. The list **is** the blast radius, reviewable in one place.
`TRUNCATE ... CASCADE` was rejected for the opposite reason: it reaches tables that are not named.

Tables absent from a given database are skipped by checking `information_schema` up front rather
than catching the error — inside a transaction, one failed statement aborts everything after it, so
the catch would never have worked.

---

## 4. Verified

Run against a scratch database (`aws_framework_seedtest`) and the local Keycloak realm, then dropped
and purged. The developer database was not touched.

- All migrations applied cleanly to an empty database, including `1709000000021`
  (organisation application fees, with its backfill) and `1709000000022` (status two-states, with
  its `CHECK`) — both previously unverified against Postgres.
- Seed → 288 rows across 17 tables, 12 Keycloak users, 1 group tree.
- `--reset` three times consecutively → identical counts each time.
- `--reset-only` against an un-migrated database → cleans Keycloak, reports 0 database rows, stops.

### Two bugs this testing found

1. **Keycloak group purge silently did nothing.** `GET /groups` returns a *brief* representation
   without `attributes`, so the `seededBy` check never matched and the org-type group tree survived
   every reset. Each group now gets an individual `findOne`.
2. **The reset aborted on any missing table.** See above.

---

## 5. Known limits

- **Not idempotent without `--reset`.** Running the seed twice without it creates a second
  organisation type and a second set of everything. `--reset` is almost always what you want; the
  bare form exists mainly for a first run on an empty database.
- **No entries, payments or carts are seeded.** The events are open and ready to be entered, but
  nothing has been entered yet — so reporting screens and a member's "my entries" will be empty
  until you make an entry through the UI. Seeding entries convincingly means seeding form
  submissions and payments to match, which is a larger job than this.
- **Stripe is enabled but not connected.** Kildare and Laois have the Stripe payment method switched
  on, but no Connect account, so a card checkout will hit the "club has not connected a payment
  account" refusal. That is a faithful state — it is what a real club looks like before onboarding —
  but it means card checkout cannot be tested end to end from this seed alone.
- **The 60-second token.** Dev Keycloak issues short-lived tokens and this script makes upwards of
  forty calls, so it refreshes on every operation. On a slow connection a single operation could
  still straddle an expiry; re-running is safe.
