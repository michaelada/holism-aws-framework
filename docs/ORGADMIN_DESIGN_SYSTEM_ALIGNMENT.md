# Org-admin: bringing the interface onto the design system

A polish pass over `/orgadmin`, run against the app in a browser rather than
against the source. DESIGN.md is normative and its "Known divergence" table
listed org-admin's palette as outstanding; this closes those rows and three
things the table had not caught.

Nothing here is a redesign. Every layout, illustration, string and behaviour is
the one that was there — what changed is which colours carry which job.

## What was wrong, measured

| | Before | After |
|---|---|---|
| Primary button fill | `#FF9800 → #E65100`, white text at **2.16:1** on the left stop | `#D24400 → #BF360C`, **4.60:1** |
| Selected navigation label | Flare Orange on its own tint, **≈2:1** | Deep Orange, **5.16:1** |
| Page titles | `#64748B`, **4.76:1** | `#1E293B`, **14.63:1** |
| Discount chips | Flare Gold text, **1.63:1** | Signal Gold, **5.19:1** |
| Status colours | #EF4444 / #22C55E / #3B82F6 / #F59E0B, all under 4.5:1 | #D32F2F / #15803D / #1D4ED8 / #A15C00 |
| Destructive confirmations | orange, with an orange glow | red |
| Module card accents | 15 Material-palette hues | one warm accent |

A contrast sweep over the dashboard, members, events, payments and settings —
compositing translucent grounds over what is behind them — now returns **zero**
failures at the AA thresholds.

## The seven fixes

### 1. Flare Orange was `primary.main`

`#FF9800` measures 2.16:1 on white. DESIGN.md is explicit that it decorates and
never speaks — yet it was the palette's `primary.main`, so MUI painted it onto
everything that carries meaning: the selected navigation label, the left half of
every primary button, primary-tinted icons, focus rings. Signal Orange
(`#D24400`, 4.60:1) is now `main`; Flare survives as `light`, where it is still
the right value for a hover wash or an input border.

### 2. `contained` hard-coded the gradient, so `color` did nothing

```js
contained: { background: 'linear-gradient(135deg, #FF9800, #E65100)', … }
```

That override beat the `color` prop, so **seven delete and cancel confirmations**
across calendar, forms, users, events, merchandise and registrations rendered as
orange buttons with an orange glow. Orange is this product's invitation colour;
spending it on a deletion leaves the interface no way to say *danger*. The
gradient moved to `containedPrimary`, and `contained` now keeps only the lift and
press that belong to every contained button.

### 3. Headings inherited the muted body colour

`typography.body1.color` is applied to `<body>` by CssBaseline, so every element
without a colour of its own inherited `#64748B` — page titles included. "Members
Database" was rendering in the *secondary* text colour at 4.76:1, making the most
important label on an operational screen the faintest heading in the system. An
`MuiTypography` override puts h1–h6 on Ink; body copy stays muted, as DESIGN.md
asks.

### 4. Selection reached the icon but not the word

The rail renders its labels as `body2` Typography, which carries a colour of its
own and overrode the selected state — so the icon turned orange and the label
stayed muted at 2.2:1. The theme now names `.MuiListItemText-primary` explicitly.

It also uses **Deep Orange**, not Signal. Signal's quoted 4.60:1 is against
white, and this label is never on white: on its own 12% flare wash it is 4.23:1.
DESIGN.md's Measured Value Rule has been amended to say so.

### 5. Flare Gold was labelling the discount chips

`secondary.main` was `#FFC107` — 1.63:1, the lowest-contrast value in the system,
and the one DESIGN.md calls an absolute decoration-only rule. MUI uses
`secondary.main` as a *text* colour on outlined chips, so the discount labels on
the events table were effectively unreadable. Now Signal Gold (`#A15C00`).

### 6. The dashboard was a fifteen-colour rainbow

Every module carried its own Material hue: red for Events, blue for
Registrations, green for Calendar, pink for Users. Three of those are the status
vocabulary, so "Go" on Events read as danger and "Go" on Calendar read as
success — against a system whose rule is that red, green and blue report state
and never decorate.

All twelve now take the one warm accent and are told apart by their
illustrations, which is also what the navigation rail does — the rail has never
been colour-coded, so the mapping was never reinforced anywhere the
administrator actually spends their time.

### 7. Text that did not fit, and rows that cost time

- Cards went from six across to **four**. At six a card was ~170px on a 1440
  laptop and eight of the twelve clipped their description mid-word — in
  English, the shortest of the six locales this ships in.
- The "Go" links are floored, so they share a baseline across a row instead of
  scattering with the description length.
- The members table's action icons no longer wrap, taking the row from **101px
  to 85px** on the screen an administrator scans most.
- Button padding relaxes below `sm`, where two pills at `2rem` turned into four
  lines of text.

## Stacked rows below `md`

The members table now becomes one record per row on a phone, as DESIGN.md's
Layout rule asks. A 997px, ten-column table in a 390px window is not a table any
more: nine columns sit off-screen behind a horizontal scroll, under a pinned
Actions column that covers the name while you drag it.

Every column survives — they are read *down* the row instead of across it:

```
[✓]  Aoife McNamara
     400009 · Associate Member          [pending]
     Date Last Renewed   16 Aug 2026
     Valid Until         11 Aug 2027
     [Associate] [Non-riding]
     (○)                 View Details   Edit
```

Four decisions worth recording:

- **Rows inside the existing Paper, not twelve cards.** A card per record would
  nest a card inside a card, which the system rules out, and would lose the
  hairline rhythm the desktop table reads by.
- **The dates keep their column names.** Stripped of the header row,
  "16 Aug 2026" beside "11 Aug 2027" says nothing about which is the renewal
  and which is the expiry.
- **The name owns its line.** Sharing it with the status chip left ~180px on a
  390px screen, so "Aoife McNamara" broke across two lines while the chip sat in
  the space it had taken.
- **The row actions are named.** On the desktop table they are icons in a column
  an administrator learns; met once in a while on a phone, they carry their
  words. The checkbox is labelled with the member's name — an unlabelled
  checkbox in a list of people is heard as "checkbox" nine times.

The breakpoint is read through `useMediaQuery`, and the shared test harness
answers `matches: false` for every query, so the existing suites still exercise
the desktop table unchanged.

## Every other list table: one component, 26 call sites

[`ResponsiveTable`](../packages/orgadmin-core/src/components/ResponsiveTable.tsx)
is a drop-in replacement for `TableContainer` that stops being a table below
`md`. Twenty-six list pages now use it; the change at each call site is the tag
name.

It **reads the column headings out of the DOM** after each render and copies
them onto the cells as `data-label`, which CSS then draws. That is what makes
one component enough: no call site describes its columns twice, and a column
added to the header is labelled on the phone without anyone remembering to.

Three cells deliberately get no label — one under a blank heading, one that
spans the table ("No payments yet." is a message, not a field), and any cell in
a table with no header row.

### What the real tables taught it

Each of these was a defect on screen before it was a rule:

- **The `<table>` box has to go, not just the rows.** Left as `display: table`
  it kept sizing itself from its widest row — call sites set `minWidth: 650`
  and up — so `width: 100%` on a cell resolved against 997px and every value
  ran off the right-hand edge.
- **The label leads, whatever the call site says.** An actions cell often sets
  `flex-direction: row-reverse` to lay its icons out from the right; that put
  the label on the right and ran five icons off the left edge.
- **A cell holding more than one thing stacks.** The two-column layout makes the
  cell a flex row, which treats every child as a column: a membership type's
  name cell carries the name *and* its description, and side by side they were
  pushed to opposite ends with the description squeezed into a third of the
  width. The labelling pass counts the children and marks those cells, which is
  cheaper and more honest than trying to say "has more than one child" in a
  selector.
- **A pinned column has nothing left to pin to.** A sticky cell inside a block
  row lifts out of the flow and lands on top of its neighbours.

Four tables are deliberately left alone: `BrandingPreview` (a swatch grid),
`TicketDetailsDialog` (already sized for the phone), `FieldConfigurationTable`
(a settings matrix that loses its meaning without the grid), and the members
database, which has a hand-designed layout of its own.

## The drawer was see-through on a phone

`getGradientBackground` returned `linear-gradient(135deg, ${color}15, ${lightColor}25)`.
The `15` and `25` are alpha — 8% and 15% — and on `.MuiDrawer-paper` that
*replaced* the opaque white the theme sets. The permanent rail got away with it
by sitting against a white page; the temporary drawer on a phone is an overlay,
so the page showed straight through the menu.

Removed rather than made opaque, for two reasons. DESIGN.md is explicit that the
rail is white and "never a tinted sidebar — the warmth in this system comes from
the page, not from a coloured chrome". And now that every module shares one
accent, a per-module tint is the same tint everywhere: it distinguishes nothing,
and on the app bar it cost the 95%-white blur the design specifies.

## `identityColumn` — which column says *which record this is*

The generic layout's one real weakness was that it treated every column alike,
so the reader had to find the name among eight equal rows of text. It now takes
a single prop naming the column that identifies the record:

```tsx
<ResponsiveTable component={Paper} identityColumn={t('events.table.eventName')}>
```

That cell moves to the top of the row and is set as a heading, **with no label
of its own** — a name captioned "Name" tells the reader nothing they cannot
already see. Everything else stays a label/value pair beneath it.

```
Winter Dressage Series
Dates          18 Nov 2026
Status         Published
Entry Limit    Unlimited
Actions        👥 👁 ✏ ⧉ 🗑
```

Two details worth knowing:

- **The heading is matched by text, case- and padding-insensitively**, so the
  call site passes the same `t()` call its header uses and the two cannot drift
  apart in one locale but not another. An index is accepted too, for a heading
  that is an icon or is blank.
- **It is never the same position twice** — a members table opens on Membership
  Type, an events table on Event Name, a tickets table on a reference — which is
  exactly why it could not be inferred and had to be said.

Twenty-five of the twenty-six call sites name one. `EventEntriesPage` does not:
First Name and Last Name are separate columns and neither alone identifies the
entrant, so it stays label/value rather than leading on half a name.

### Two bugs its own tests found

- The identity cell was still being given a `data-label`. The CSS hid it, so
  nothing looked wrong — but the attribute contradicted itself, and the label
  would have reappeared the moment the identity styling changed.
- Multi-child detection counted `children`, which sees elements only. A cell
  written as `<TableCell>{name}<span>{note}</span></TableCell>` has one element
  child and *two* flex items, so that shape was missed and its two halves were
  pushed to opposite ends of the row. It counts child nodes now.

## The members database, still bespoke

It keeps its hand-written layout. The gap has narrowed to three things the
generic wrapper does not do: the membership number and type share one line, the
status chip sits beside them rather than in the field list, and the row actions
carry their names ("View Details", "Edit") with the checkbox labelled by the
member's name.

Those are worth something on the screen an administrator uses most. Converging
it is now a one-line change if the consistency is worth more — the shape is
otherwise identical.

## Still outstanding
- **Three unused dashboard card variants** (`DashboardCard`, `DashboardCardHero`,
  `DashboardCardPhoto`) are kept as switchable alternatives, per a comment in
  `DashboardPage.tsx`. Deliberate, but dead.
- `packages/admin`, `packages/frontend` and the three-copies-of-one-theme
  problem are untouched; they remain in the divergence table.

## Verified

- Contrast sweep over five routes at desktop and 390px: zero failures.
- The impeccable detector over the changed files: clean.
- All eight org-admin package suites pass — 2,412 tests. One test in
  `orgadmin-registrations` pinned the literal `#1565c0`; it now asserts that a
  card *defines* a colour, which is what the requirement it cites actually says.
