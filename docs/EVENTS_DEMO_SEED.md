# Events demo seed

A script that puts a local environment into a known state for testing the events capability, and
that can wipe and rebuild that state on demand.

```bash
npm run seed:demo -- --dry-run      # report what it would do, change nothing
npm run seed:demo -- --reset        # wipe everything, then seed
npm run seed:demo -- --reset-only   # wipe everything and stop
npm run seed:demo                   # seed into an empty database
```

The bare form refuses to run against a database that already holds a seed, naming what it found
and the flag to use instead. See §5.

Source: [`packages/backend/scripts/seed/`](../packages/backend/scripts/seed/) — `index.ts` (CLI and
guards), `dataset.ts` (what gets created), `database.ts` (SQL and the reset), `keycloak.ts` (users,
groups, roles).

---

## 1. What it creates

| | |
|---|---|
| Organisation type | **Irish Pony Clubs** — EUR, en-GB, 20 capabilities, handling fee €0.25 + 1.5% **+ 23% VAT**, platform share a flat **€0.60** (Laois negotiated to €0.45) |
| Organisations | **Kildare Hunt** (`khpc`), **Laois Hunt** (`lhpc`), **Ward Union** (`wupc`) |
| Logins | 1 super admin, 3 organisation admins, 16 account users across 24 club affiliations |
| Events | 18, with 41 activities — 15 published publicly |
| Forms | 6 forms per club (18), built from 26 fields per club (78) covering 13 field types |
| Memberships | 5 membership types per club (13 in total), with 22 members for this season |
| Shop | 8 products at Kildare Hunt, each with a generated image, plus 10 option groups and 30 option values |
| Bookings | 4 calendars at Laois Hunt, with 6 slot patterns, 10 durations, 2 blocks and 2 schedule rules |
| Discounts | 24, spread across all three clubs and every capability each holds (33 applications) |

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

### Two events cover the members-only entry rules

Both run by Kildare, both wide open in their entry window — what is being demonstrated is *who* may
enter, so nothing else should be in the way. They are the only seeded activities with an
`entryEligibility`; every other one is `all`, exactly as before.

| Event | Activity | Who can enter |
|---|---|---|
| **Kildare Members' Cup** | Members' Championship | Kildare members only |
| | Open Warm-up Round | anyone — a restricted and an open row side by side |
| **Inter-Branch Championship** | Inter-Branch Team Class | members of **any** Irish Pony Club branch |
| | Host Club Class | Kildare members only |

The second event is the interesting one. Its team class is what makes it appear under *Events at
other organisations* on the home page of Laois, Ward Union and Meath account users, and its host
club class sits beside it restricted to Kildare — so the difference between the second and third
options is visible in a single list.

**Nobody holds an active membership in more than one club.** A person belongs to a club; a login at
several clubs is a different thing, and `ACCOUNT_USERS` still overlaps heavily to exercise the
organisation switcher. The distinction is load-bearing here: a member of one branch entering
another's event is the whole case, and it cannot be shown by someone who is a member of both.

**Every club gets `organisation-level-members`**, rather than one club opting in. The federation
option is only interesting when more than one club has it: one club opens an event, and the others'
account users are the ones who have to see it.

Ready-made subjects:

| Login | Why |
|---|---|
| `niamh.walsh@example.test` | **the main subject.** A login at all four clubs, a member of **Laois only**. In Kildare's catalogue the team class is open to her *as her Laois membership*, and both Kildare-members-only classes are refused |
| `ruairi.kelly@example.test` | Laois member with no Kildare account — sees the Inter-Branch Championship on the Laois home page and is prompted to join Kildare |
| `eoin.brady@example.test` | belongs to Ward Union only, one membership — the same path from a different branch |
| `sinead.gallagher@example.test` | holds four memberships on one login — the parent case, for the "which member?" selector |

### Fifteen events are published publicly

Twelve of them also appear on the platform listing at **`/account/events`** (`/events` in
production). The spread is deliberate: that page is a *filterable* surface, and a fixture where
every event shares a club, a county and a type gives each filter one option and proves nothing.

| | On the platform page |
|---|---|
| Clubs | all four |
| Regions | Co. Kildare (4), Co. Laois (3), Co. Meath (5) |
| Event types | Show Jumping (3), Cross Country (3), Dressage (2), Fun Day (2), Camp (1), Rally (1) |
| Entry windows | open, closing in days, not yet open, closed, finished |

**Three are club-page-only** — Kildare's Members' Cup, Laois's closed event, Meath's summer camp.
Without them the two flags would always agree and a bug that ignored one would pass unnoticed.

**Three are not public at all**, one of which is a draft: a draft can never reach the public whatever
its flags say, and having one in the fixture makes that rule testable rather than assumed.

A filter combination worth trying, because it is the one a naive implementation gets wrong:

```
/account/events?type=Cross+Country&region=Co.+Meath
```

It returns Meath Hunt's Tara Hunter Trial **and Ward Union's** Cross Country League — Ward Union's
grounds are in Co. Meath despite the club's name. Filtering location by club name would miss it.

### Events cover every entry-window state

Every event has all four dates — starts, ends, opens to entries and closes to entries. None is
left ungated: `eventService.createEvent` refuses an event missing any of them, and a null entry
window reads as *unbounded* to `public-event.service`, so a fixture carrying one would describe a
state the API can no longer produce. The seed asserts this before it writes
(`scripts/seed/database.ts`), so the dataset cannot drift back. See
[EVENT_ENTRY_DATE_INVENTION_FIX.md](EVENT_ENTRY_DATE_INVENTION_FIX.md).

| State | Count | Example |
|---|---|---|
| Open, closing in a while | 8 | Spring Show Jumping League (closes in 14 days) |
| **Closing soon** | 3 | Autumn Rally (closes tomorrow), Autumn Hunter Trial (2 days), Hunt Ball (3 days) |
| Not open yet | 3 | Summer Camp (opens in 21 days) |
| Closed to entries | 2 | Winter Dressage — Round 3 |
| Draft | 1 | Christmas Fun Day (opens in 60 days) |
| Already past | 1 | Summer Show — for reporting and a member's completed entries |

### Settings coverage across the 29 activities

- **12** cap applicants (activity-level limit); **6 events** cap total entries (event-level limit)
- **5** allow the member to choose a quantity
- **3** require terms and conditions; **3** include the handling fee in the fee shown
- **27** attach an application form
- Payment: 16 offer both methods, 3 card only, 10 offline only

### Field types exercised

`text`, `textarea`, `number`, `email`, `phone`, `date`, `time`, `datetime`, `boolean`, `select`,
`multiselect`, `radio`, `checkbox` — across four form shapes: a three-step wizard with grouped
sections (`fullEntry`), a grouped single-page form (`campBooking`), a two-field minimum
(`shortEntry`), and a no-pony form (`spectator`).

`file` and `image` are **deliberately absent**. They need the document-upload storage path
configured, and a seeded form that half works is worse than one that does not claim to.

### Every club names its forms differently

Each of the four clubs gets its own `application_forms` row per shape — same fields, **different
name**, in that club's own vocabulary and after its own venue where the form has one:

| Shape | Kildare | Laois | Ward Union | Meath Hunt |
|---|---|---|---|---|
| `fullEntry` | Kildare championship entry | Ballyroan entry form | Ward Union rider entry | Meath Hunt full entry |
| `campBooking` | Craddockstown camp booking | Ballyroan camp booking | Ward Union camp booking | Tara camp booking |
| `shortEntry` | Kildare one-class entry | Ballyroan short form | Ward Union quick entry | Meath Hunt short entry |
| `spectator` | Kildare gate list | Ballyroan visitor sign-in | Ward Union day ticket details | Meath Hunt spectator list |
| `membershipSingle` | Kildare membership application | Laois membership form | Ward Union membership | Meath Hunt membership application |
| `membershipFamily` | Kildare family membership | Laois family membership form | Ward Union household membership | Meath Hunt family application |
| `horseRegistration` | Kildare horse passport record | Laois horse details | Ward Union horse register | Meath Hunt horse registration |

They used to share one name each, and four identical *Camp booking* forms made it impossible to
tell at a glance whether a list was correctly scoped or quietly showing every club's. The fixture
should make a scoping bug obvious; instead it camouflaged one. A form seen under the wrong club now
announces itself. `SeedForm.name` is typed as a record over every organisation key, so a form added
without a name for one of the clubs fails to compile rather than borrowing another's.

### And so does every field

The same applies one layer down: **all 160 field labels are different** — the 40 fields × 4 clubs.
The Fields list and the form builder's field picker both render the label, so identical labels hid
a mis-scoped list just as effectively as identical form names did.

Each club has its own vocabulary, which is what lets you attribute a stray field on sight:

| | Person | Mount | Registration wording |
|---|---|---|---|
| Kildare | Rider | Pony | *Registered horse breed*, *Passport number* |
| Laois | Competitor | Horse | *Breed of horse*, *Equine passport number* |
| Ward Union | Member | Mount | *Breed on the register*, *Passport number on the register* |
| Meath Hunt | Entrant | Pony or horse | *Breed of the registered horse*, *Number on the equine passport* |

So `riderName` reads *Rider name* at Kildare, *Competitor name* at Laois, *Member name* at Ward
Union and *Entrant name* at Meath; `yearsRiding` reads *Years riding*, *Years competing*, *Years in
the saddle* and *How many years the entrant has ridden*.

The machine `name` — `rider_name`, `pony_breed` — is deliberately **not** varied. It is the
platform's canonical key and what a submission's answers are stored under, so it stays common to
all four clubs; the label is the part a club sees and the part that identifies the row as its own.

Tidied up in passing: *Breed* and *Height (hands)* each appeared twice within a single club, once
for the pony and once for the registered horse. A label now identifies both the club and the
field.

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

**Payment methods are stored as ids, not names.** `supported_payment_methods` is compared against
`cart_items.payment_method_id` — a uuid — and the org-admin pickers match on `pm.id`. The seed wrote
its own slugs (`"pay-offline"`, `"stripe"`) for a while, which produced lists nothing could match and
made every add to basket fail with "that payment method is not accepted for this item".

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

**24, spread so every club has a discount list for every capability it holds** — and none for the
ones it does not:

| Club | events | memberships | merchandise | calendar |
|---|---|---|---|---|
| Kildare Hunt | 5 | 2 | 3 | — (no calendars) |
| Laois Hunt | 3 | 2 | — (no shop) | 3 |
| Ward Union | 4 | 2 | — | — |

Ward is the club worth having: no shop and no bookings, so its discount pages show what the module
looks like for a club that only runs events and memberships.

Between them they cover the shapes the discount engine branches on:

| Axis | Covered by |
|---|---|
| **Type** | 14 percentage, 9 fixed |
| **Scope** | item, cart, quantity-based, and one `category` |
| **Codes** | 13 with a code, 11 applied automatically |
| **Quantity rules** | every-Nth (third free), from-the-Nth (family rate), one-of-N (second item half) |
| **Usage limits** | 3, including one with a cap on the discount itself and a per-member limit |
| **Eligibility** | 6, covering `requiresCode`, minimum order value, members-only and volunteers-only |
| **Status** | 22 active, 1 **expired**, 1 **inactive** — the club's switch, not the calendar |
| **Validity** | one **not yet valid**, starting next month |
| **Combinable** | 13 yes, 11 no |

> **Two bugs fixed while spreading these.**
>
> Every seeded discount was written with `module_type = 'events'`, so the membership, merchandise
> and calendar ones existed but were invisible: the org-admin pages and the pickers filter on that
> column, and each of those lists came back empty. `SeedDiscount` now carries its `module`.
>
> Discount keys resolved **globally**, while membership types are defined once and created for every
> club — so Ward's Family Membership carried Kildare's discount and its Senior carried Laois's. Keys
> are now scoped to their organisation, which lets `familyMembership` mean "this club's family
> discount" and resolve to nothing for a club that has none. Verified: zero cross-organisation
> attachments across memberships, events, merchandise and calendars.

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

- **Not idempotent: the bare form only seeds an empty database.** It builds a fixture rather than
  merging into one, so a second run without `--reset` is refused up front:

  ```
  ✖ 127.0.0.1/aws_framework already has the "irish-pony-clubs" organisation type and all 4 of its clubs.

    The seed builds its fixture from an empty database; it does not merge into one
    that already holds it. Choose one:

      npm run seed:demo -- --reset        wipe all application data, then seed
      ...
  ```

  It used to discover this at its first `INSERT` and report
  `duplicate key value violates unique constraint "organization_types_name_key"` — a message that
  names a constraint rather than the mistake. And it got there **last**: by then the run had
  reconciled every Keycloak user and created four live Stripe test connected accounts, so each
  failed attempt stranded four more. `existingSeedData` now asks two queries before any of that
  happens, so a mistaken re-run costs nothing and leaves nothing behind. (`--reset` deletes
  previously seeded Stripe accounts by their metadata tag, including any stranded by the old
  behaviour.) `--reset` is almost always what you want.
- **Thirty-eight entries are seeded, with the payments behind them. Carts still are not.** `ENTRIES` in `dataset.ts` names
  who entered what, and the seed writes them the way `fulfilment.service` does — the names on the
  entry, a `member_id` where a membership stands behind the name, and a form submission wherever the
  activity asks for one. `entry_date` is backdated, which is the one thing a real entry cannot do
  and what makes "most recently used" mean anything.

  **Every login has entries, in every club it belongs to.** An entry belongs to an account's row in
  one organisation (`event_entries.user_id`), so a member of three clubs who has entered at one
  would still see an empty "My entries" at the other two — which reads as broken rather than as
  empty, and is the screen an organisation switch lands on. All 23 account users are covered, and
  so is every login-and-club pair.

  **Placed so nothing testable is consumed.** Kildare and Laois carry their history on events that
  have finished or closed. Ward Union and Meath Hunt have no such event, so theirs sit on live ones
  — on **uncapped** activities. Across the whole fixture exactly two capped activities give up a
  single place each, out of 25 and 40, so the limits those events exist to demonstrate are
  untouched. Four entries are unpaid, for the organiser's chasing-payment view, and five carry a
  name with no membership behind it.

  Áine McGrath is the account to look at for the entry form: four memberships, four names entered,
  and a fifth for a friend with no login — five distinct names, which is what the "used before" list
  is sized for. See docs/ENTRANT_NAME_SUGGESTIONS.md.

  **Every entry and every membership carries a `payments` row and a `payment_transactions` line**,
  the way `checkout.service` writes them — because in this system nothing else can produce an entry.
  A checkout writes the payment, then `fulfilment.service` writes the entry. A fixture with entries
  and no payments gave a member an entry marked "Awaiting payment" beside an empty Payments page:
  two screens disagreeing about one purchase, with nothing wrong in the code.

  **Two of them are baskets.** Most purchases get a payment of their own, but naming a `basket` in
  the dataset puts several on one — which is what a household actually does:

  | Basket | Lines |
  |---|---|
  | `mcgrath-season` (Kildare, €184) | two children entered, the family membership renewed, a hoodie |
  | `mcnamara-day` (Meath, €98) | an entry, the horse's papers renewed, a show cap |

  A basket settles once, by one method, so every line in one must agree on status and payment
  method; `database.ts` refuses a basket that mixes them rather than writing a shape the application
  cannot produce. Payments are written after every other loop for the same reason — a basket holds
  an entry, a membership and a shop order, and those are created in three different places.

  Every line carries `fulfilment_ref`, the id of the record it produced. That is what lets the
  member's payment detail name who an entry was for and link through to it.

  **A member's Payments page lists money that moved** — `listPayments` excludes `pending` — so an
  unpaid entry deliberately does not appear there. Every login therefore has at least one *paid*
  purchase in every club it belongs to, or the page would be empty in a way that reads as broken.
  Niamh Walsh at Ward Union is the pair to look at: one entry paid and listed, one awaiting payment
  and not, which is the distinction made visible.

  **Three shop orders** are seeded too (`SHOP_ORDERS`), only for what they demonstrate: a shirt on a
  payment beside an entry and a membership. The shop is a module of its own and a fixture of orders
  is not what this seed is for.

  Carts remain unseeded, so a basket is empty until you put something in it.
- **Stripe is enabled but not connected.** Kildare and Laois have the Stripe payment method switched
  on, but no Connect account, so a card checkout will hit the "club has not connected a payment
  account" refusal. That is a faithful state — it is what a real club looks like before onboarding —
  but it means card checkout cannot be tested end to end from this seed alone.
- **The 60-second token.** Dev Keycloak issues short-lived tokens and this script makes upwards of
  forty calls, so it refreshes on every operation. On a slow connection a single operation could
  still straddle an expiry; re-running is safe.
