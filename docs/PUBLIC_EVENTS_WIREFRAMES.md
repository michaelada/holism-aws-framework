# Public event listings — visual design

Companion to [PUBLIC_EVENTS.md](PUBLIC_EVENTS.md). **For review. Nothing here is built.**

---

## 1. The design problem, stated

Every other screen in this product is **Operate**: someone with a job to do, signed in, who wants the
interface out of the way. The platform events page is the first surface that is **Persuade** — a
stranger with no account, no club, no reason to stay, deciding whether any of this is for them.

That changes what good looks like. On the member app, density is a service. Here, density is a wall.
The page has to answer three questions in the first viewport, in this order:

1. *What is this?* — a place to find equestrian events near you
2. *Is there anything for me?* — visibly yes, with dates and places
3. *How do I narrow it?* — search and filters within reach, not below the fold

It also has to do this while looking like the same product as the rest, which means working inside
**The Bright Morning** rather than inventing a marketing skin beside it. The constraint is a
generous one: warm daylight on white paper, wide margins, and one orange that means *act*.

### What carries over from DESIGN.md, and what changes

| | Member app | Public pages |
|---|---|---|
| Density | comfortable | **airy** — 1.5× vertical rhythm, cards breathe |
| Type scale | functional | **larger display step** for the hero only; body unchanged |
| Colour | white ground, orange for action | **one warm band** at the top; white below |
| Orange | signal only, sparingly | unchanged — the *Two Oranges Rule* still holds absolutely |
| Motion | minimal | a single 120 ms card lift on hover; nothing else |

---

## 2. Platform page — `/events`

### 2.1 Desktop, ≥1200px

```
┌───────────────────────────────────────────────────────────────────────────────────────┐
│  ItsPlainSailing                                              Find your club   Sign in │  ← 64px, paper
├───────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                       │
│   What's on                                                                           │  ← 40/44 Ink
│   Equestrian events across every club on ItsPlainSailing.                              │  ← 18 Muted Ink
│                                                                                       │
│   ┌──────────────────────────────────────────────────────────┐  ┌──────────────────┐   │
│   │ 🔍  Search events, clubs or venues                       │  │ Soonest first  ▾ │   │
│   └──────────────────────────────────────────────────────────┘  └──────────────────┘   │
│                                                                                       │
│   ▸ 47 events · 12 clubs                                                              │
└───────────────────────────────────────────────────────────────────────────────────────┘
      ▲ warm band: paper-warm #FAF8F5, ending on a hairline. No gradient, no image.

┌──────────────────────┬────────────────────────────────────────────────────────────────┐
│  Refine              │                                                                │
│  ────────────────    │   ┌─────────────────────────────────────────────────────────┐  │
│                      │   │ ┌────┐                                                  │  │
│  Event type          │   │ │SEPT│  Spring Show Jumping League          €25.00 from  │  │
│  ☐ Show Jumping  12  │   │ │ 9  │  Kildare Hunt Pony Club                           │  │
│  ☐ Cross Country  8  │   │ │2026│  Craddockstown Equestrian · Co. Kildare           │  │
│  ☐ Dressage       6  │   │ └────┘                                                  │  │
│  ☐ Camp           4  │   │         [Show Jumping]  ⏳ Closes in 6 days              │  │
│  ☐ Rally          9  │   │         4 activities · 120 of 120 places                 │  │
│  ☐ Fun Day        8  │   │                                          Details ▾      │  │
│                      │   └─────────────────────────────────────────────────────────┘  │
│  Region              │                                                                │
│  ☐ Co. Kildare   14  │   ┌─────────────────────────────────────────────────────────┐  │
│  ☐ Co. Meath     11  │   │ ┌────┐                                                  │  │
│  ☐ Co. Laois      7  │   │ │SEPT│  Kildare Members' Cup                €20.00 from  │  │
│  ☐ Co. Dublin     5  │   │ │ 23 │  Kildare Hunt Pony Club                           │  │
│                      │   │ │2026│  Craddockstown Equestrian · Co. Kildare           │  │
│  Club                │   │ └────┘                                                  │  │
│  ☐ Kildare Hunt  11  │   │         [Show Jumping]  ✓ Entries open                   │  │
│  ☐ Meath Hunt     9  │   │         2 activities · 1 members only                    │  │
│  ☐ Ward Union     7  │   │                                          Details ▾      │  │
│  ☐ Laois Hunt     6  │   └─────────────────────────────────────────────────────────┘  │
│  + 8 more            │                                                                │
│                      │   ┌─────────────────────────────────────────────────────────┐  │
│  When                │   │ ┌────┐                                                  │  │
│  ◉ Any time          │   │ │ OCT│  Inter-Branch Championship          €30.00 from   │  │
│  ○ This month        │   │ │  7 │  Kildare Hunt Pony Club                           │  │
│  ○ Next 3 months     │   │ │2026│  Punchestown Event Centre · Co. Kildare           │  │
│  ○ Choose dates…     │   │ └────┘                                                  │  │
│                      │   │         [Cross Country]  ✓ Entries open                  │  │
│  ☐ Entries open now  │   │         2 activities · open to all branches              │  │
│                      │   │                                          Details ▾      │  │
│  ──────────────────  │   └─────────────────────────────────────────────────────────┘  │
│  Clear all           │                                                                │
│                      │                        [ Show more events ]                    │
│  260px, sticky       │                                                                │
└──────────────────────┴────────────────────────────────────────────────────────────────┘
```

**Why this shape, and not a grid of tiles.** A grid looks better in a screenshot and works worse
here. These events differ along *date, place and club* — three text facts — and a grid forces each
into a narrow column where the venue wraps to three lines and the date shrinks. A single column of
wide rows lets the date tile anchor the left edge, the name lead, and the club and venue sit on one
line each. It also scans vertically, which is how anyone reads a list of dates.

**Counts beside every filter.** `Show Jumping 12` tells the visitor what a click will cost them
before they spend it, and a zero-count option is disabled rather than hidden — an option that
vanishes as you filter makes the panel feel unstable.

**The date tile is `EventDateTile`, already built** (`packages/components`, month band / weekday /
day / year). Reusing it means the public page and the member app read the same, and the accessible
label logic — one `role="group"` with the full date, the pieces `aria-hidden` — is already right.

### 2.2 The expanded card

`Details ▾` opens in place. It does not navigate: the visitor is comparing, and losing the list to
see three activity names is a bad trade.

```
   ┌─────────────────────────────────────────────────────────────────────────┐
   │ ┌────┐                                                                  │
   │ │SEPT│  Spring Show Jumping League                        €25.00 from   │
   │ │ 9  │  Kildare Hunt Pony Club                                          │
   │ │2026│  Craddockstown Equestrian · Naas, Co. Kildare                    │
   │ └────┘                                                                  │
   │         [Show Jumping]  ⏳ Closes 2nd Sept 2026, 18:27                   │
   │ ──────────────────────────────────────────────────────────────────────  │
   │  Four-round league over the spring, graded 1 to 3.                      │
   │                                                                         │
   │  Activities                                                             │
   │   Grade 1 — 80cm      Introductory round            €25.00   40 places  │
   │   Grade 2 — 90cm      Intermediate round            €25.00   40 places  │
   │   Grade 3 — 1.00m     Open round                    €30.00   40 places  │
   │   Members' Class      Kildare members only          €20.00   ⊘ members  │
   │                                                                         │
   │  Entries open  10th Aug 2026        Entries close  2nd Sept 2026, 18:27 │
   │  Event limit   120 entries          Places left    120                  │
   │                                                                         │
   │                        ┌──────────────────────────────────────────┐     │
   │                        │  Enter with Kildare Hunt Pony Club   →    │     │  ← signal orange
   │                        └──────────────────────────────────────────┘     │
   │                        You'll sign in or join the club to enter.        │  ← 13px Muted Ink
   └─────────────────────────────────────────────────────────────────────────┘
```

**One orange thing on the whole page**, and it is this button. Everything above it — chips, counts,
filters, the entry-window pill — is Ink, Muted Ink or a status colour. The *Two Oranges Rule* says
signal marks where a decision is asked for; on a page whose entire purpose is one decision, spending
orange anywhere else spends it on nothing.

**The sentence under the button is not a disclaimer, it is the design.** A stranger clicking "Enter"
and landing on a sign-in wall has been ambushed. Told first, the same screen is the expected next
step. Eight words buy that.

**Members-only activities are listed and marked** (§3 of the proposal). `⊘ members` in the places
column, no price emphasis, no button. The visitor learns the class exists and that membership is the
route to it.

### 2.3 Mobile, ≤600px

```
┌───────────────────────────────┐
│ ItsPlainSailing        Sign in│
├───────────────────────────────┤
│                               │
│  What's on                    │
│  Equestrian events across     │
│  every club.                  │
│                               │
│  ┌─────────────────────────┐  │
│  │ 🔍 Search               │  │
│  └─────────────────────────┘  │
│                               │
│  ┌───────────┐ ┌───────────┐  │
│  │ Filters 2 │ │ Soonest ▾ │  │  ← the badge is the count of active filters
│  └───────────┘ └───────────┘  │
│                               │
│  47 events                    │
├───────────────────────────────┤
│ ┌───────────────────────────┐ │
│ │ ┌────┐                    │ │
│ │ │SEPT│ Spring Show        │ │
│ │ │ 9  │ Jumping League     │ │
│ │ │2026│                    │ │
│ │ └────┘                    │ │
│ │ Kildare Hunt Pony Club    │ │
│ │ Craddockstown             │ │
│ │ Co. Kildare               │ │
│ │                           │ │
│ │ [Show Jumping]            │ │
│ │ ⏳ Closes in 6 days        │ │
│ │ 4 activities · from €25   │ │
│ │                Details ▾  │ │
│ └───────────────────────────┘ │
└───────────────────────────────┘
```

Filters become a bottom sheet, not a full-screen page — the results stay visible behind it, so the
count changing is feedback rather than a surprise on return. The sheet has *Apply* and *Clear*;
selections do not apply live behind a covering surface, because a visitor cannot see what they are
doing.

The date tile keeps its size on mobile. It is the one element worth its space at every width: it is
how the list is scanned.

---

## 3. Organisation page — `/{orgCode}/whats-on`

The club's own page, in the club's own branding. Shorter, because there is no cross-club problem to
solve: a visitor here already knows whose page it is.

```
┌───────────────────────────────────────────────────────────────────────────┐
│  ◯ K   Kildare Hunt Pony Club                                    Sign in  │
├───────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│   What's on at Kildare Hunt Pony Club                                     │
│   Open to everyone unless a class says otherwise.                         │
│                                                                           │
│   ┌────────────────────────────┐   ┌───────────────────┐                  │
│   │ 🔍 Search these events     │   │ Soonest first  ▾  │                  │
│   └────────────────────────────┘   └───────────────────┘                  │
├───────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│    ┌────┐  Spring Show Jumping League                     €25.00 from     │
│    │SEPT│  Craddockstown Equestrian · Co. Kildare                         │
│    │ 9  │  [Show Jumping]  ⏳ Closes in 6 days                            │
│    │2026│  4 activities · 120 places                        Details ▾     │
│    └────┘                                                                 │
│   ─────────────────────────────────────────────────────────────────────   │
│    ┌────┐  Kildare Members' Cup                            €20.00 from    │
│    │SEPT│  Craddockstown Equestrian · Co. Kildare                         │
│    │ 23 │  [Show Jumping]  ✓ Entries open                                 │
│    │2026│  2 activities · 1 members only                     Details ▾    │
│    └────┘                                                                 │
│                                                                           │
├───────────────────────────────────────────────────────────────────────────┤
│   Already a member?  Sign in to enter        Not a member?  Join the club  │
└───────────────────────────────────────────────────────────────────────────┘
```

No filter rail: a club with eleven public events does not need faceted search, and a panel with
three options in it looks like a page that failed to load. Search and sort only, and they appear
only above **six** events.

The club name is not repeated on every row — it is the page.

The footer band is the page's second job. Someone reading a club's what's-on page is a prospective
member, and this is the only place in the product where that is true.

---

## 4. Org admin — the *Show Public* control

On the event form, in **Basic Information**, below the status. It belongs with "is this published"
because it is the same kind of question: who can see this.

```
┌─ Basic Information ───────────────────────────────────────────────────────┐
│                                                                           │
│  Status            ( Published ▾ )                                        │
│                                                                           │
│  Show publicly     ○ No    ◉ Yes                                          │
│                    Off, only signed-in members of your club can see this   │
│                    event.                                                 │
│                                                                           │
│      ☑  Show it on our own public page                                    │
│         itsps.org/account/khpc/whats-on                          [copy]   │
│                                                                           │
│      ☑  Show it on the ItsPlainSailing events page                        │
│         Anyone searching itsps.org/events can find it.                    │
│                                                                           │
│      ⓘ  Anyone can see the event, its classes and its prices. Entries      │
│         are still made by signing in, and members-only classes stay        │
│         members-only.                                                      │
└───────────────────────────────────────────────────────────────────────────┘
```

**The toggle is derived, not stored** (§2 of the proposal). Unticking both boxes moves the radio back
to *No* on its own — the state is honest, and there is no validation error to write.

**The URL is shown and copyable.** The most common thing a club will do after switching this on is
paste the link into Facebook. Making them hunt for it is the difference between a feature that gets
used and one that gets asked about.

**The note is factual, not cautionary.** It says what becomes visible — including prices, which is
the thing an administrator will not have thought about — without discouraging the choice.

The second checkbox appears only for an organisation with the `public-search` capability
([decision 2](PUBLIC_EVENTS.md#7-decisions-for-you)). With one option left, the pair collapses to a
single statement rather than a checkbox list of one.

---

## 5. States

| State | Treatment |
|---|---|
| **Loading** | Three skeleton rows at the real card height. Not a spinner: the layout should not jump when results land |
| **No results after filtering** | "No events match those filters." + the filters as removable chips + *Clear all*. Never an empty page with no way back |
| **No public events at all** | "No clubs have published events here yet." Honest, and not the visitor's fault |
| **Club with none** | "This club has not published any events publicly." + sign-in prompt, since members may see more |
| **Entries closed** | The card stays, greyed status, no *Enter* button. A closed event is information; hiding it makes the club look inactive |
| **Offline** | The account app already has an offline banner and cache; public pages reuse both |

---

## 6. Accessibility

Not a section of extras — these are the parts most easily got wrong on a filter page.

- **Filter changes announce their result.** An `aria-live="polite"` region reads "47 events" after
  each change. Without it, a screen-reader user ticking a box gets silence.
- **Filters are a `<fieldset>` per group** with a `<legend>`, not a list of unlabelled checkboxes.
- **Card headings are real headings** (`h3`) in document order, so the list is navigable by heading.
- **`Details ▾` is a real disclosure** — `aria-expanded`, `aria-controls`, and the button is the
  whole row on mobile.
- **Focus ring** is DESIGN.md's 3px `orange-signal` at 40%, offset 2px. Never the browser default.
- **The status pills carry text, not only colour** — "Closes in 6 days", not an amber dot.
- **Contrast**: every value in use is from the committed palette; the only orange on white is
  `orange-signal` at 4.60:1. `gold-flare` appears nowhere near text.

---

## 7. What I would build first

If this is worth trying before it is worth finishing, the order that proves the idea soonest:

1. The flags, the org-admin control, and the **organisation page**. One club can publish and share a
   link. This is useful on its own and needs no filters, no region field and no search.
2. The **click-through and sign-in return path** — without it neither page delivers an entry.
3. The **platform page**, with search, type and club filters only.
4. **Region** filtering, once venues have the field filled in.

Steps 1 and 2 are a complete, shippable feature. Step 3 is the one the request describes as needing
to be "nicely styled", and it is better built against real published events than against seed data.
