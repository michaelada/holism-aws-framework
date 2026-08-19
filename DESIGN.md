---
name: Its Plain Sailing
description: A warm, daylight-bright interface for club administrators who have twenty minutes and no training.
colors:
  orange-flare: "#FF9800"
  orange-signal: "#D24400"
  orange-deep: "#BF360C"
  orange-ember: "#9A3412"
  gold-flare: "#FFC107"
  gold-signal: "#A15C00"
  ink: "#1E293B"
  ink-muted: "#64748B"
  charcoal: "#1A1E2E"
  paper: "#FFFFFF"
  paper-warm: "#FAF8F5"
  paper-warm-deep: "#F1EDE8"
  hairline: "rgba(0, 0, 0, 0.06)"
  danger: "#D32F2F"
  success: "#15803D"
  info: "#1D4ED8"
  warning: "#A15C00"
typography:
  display:
    fontFamily: "Sora, Roboto, Helvetica, Arial, sans-serif"
    fontSize: "clamp(2.8rem, 6vw, 4.5rem)"
    fontWeight: 800
    lineHeight: 1.08
    letterSpacing: "-0.03em"
  headline:
    fontFamily: "Sora, Roboto, Helvetica, Arial, sans-serif"
    fontSize: "clamp(2rem, 4vw, 3rem)"
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: "-0.02em"
  title:
    fontFamily: "Sora, Roboto, Helvetica, Arial, sans-serif"
    fontSize: "1.75rem"
    fontWeight: 600
    lineHeight: 1.3
  body:
    fontFamily: "Sora, Roboto, Helvetica, Arial, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.7
  label:
    fontFamily: "Sora, Roboto, Helvetica, Arial, sans-serif"
    fontSize: "0.95rem"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "0.01em"
rounded:
  sm: "8px"
  md: "12px"
  lg: "20px"
  pill: "60px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.orange-signal}"
    textColor: "{colors.paper}"
    rounded: "{rounded.pill}"
    padding: "0.85rem 2rem"
    typography: "{typography.label}"
  button-primary-hover:
    backgroundColor: "{colors.orange-deep}"
    textColor: "{colors.paper}"
  button-outlined:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "0.85rem 2rem"
  button-outlined-hover:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
  button-text:
    backgroundColor: "transparent"
    textColor: "{colors.ink-muted}"
    rounded: "{rounded.pill}"
    padding: "0.85rem 1.25rem"
  button-text-hover:
    textColor: "{colors.orange-signal}"
  card:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "24px"
  input:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "14px 16px"
  chip:
    backgroundColor: "{colors.paper-warm-deep}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "4px 10px"
  nav-item-selected:
    backgroundColor: "rgba(255, 152, 0, 0.12)"
    textColor: "{colors.orange-signal}"
    rounded: "{rounded.sm}"
    padding: "8px 12px"
  table-head:
    backgroundColor: "{colors.paper-warm}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
  tooltip:
    backgroundColor: "{colors.charcoal}"
    textColor: "{colors.paper}"
    rounded: "{rounded.sm}"
    padding: "8px 12px"
---

# Design System: Its Plain Sailing

## Overview

**Creative North Star: "The Bright Morning"**

The product is named for a promise — that this will be easy — and the interface has to pay it before
a word is read. The Bright Morning is what that looks like: warm daylight on white paper, generous
air, orange and gold used the way early sun falls across a desk rather than the way a warning light
blinks. Nothing here is nocturnal, dense, or severe. An unpaid volunteer opening this at nine at
night should feel that the work is smaller than they feared.

Daylight is a colour, not a mood: it is bright but it is not loud, and it is never the same thing as
an alarm. That distinction carries the whole palette. Orange announces where a decision is being
asked for, gold warms a surface, and the moment something is genuinely wrong the interface reaches
for red — a colour the brand otherwise never uses. If orange also meant danger the product would
have no way left to say so.

The form language is confident and slightly generous: fully rounded buttons, soft cards that lift
under the cursor, a warm shadow under the primary action. That expressiveness is inherited from the
marketing site and deliberately kept, because the administrator is not a professional operator being
handed a console — they are a volunteer who chose this product and should keep recognising it. What
the expressiveness is *not* allowed to do is cost legibility: every value below has been measured
against white, and the brand's brightest orange did not survive the measurement.

**Key Characteristics:**
- Warm white ground, never grey — `paper-warm` (#FAF8F5) is the coolest the background ever gets
- One accent family, orange to gold, on a strict two-role split between decoration and speech
- Fully rounded buttons against gently rounded everything else
- Depth by soft ambient shadow and hover lift, never by borders or hard rules
- Sora throughout, at a fluid display scale and a fixed scale everywhere else
- Red, green and blue exist only to report state, never to decorate

## Colors

A single warm accent family — orange through gold — laid on warm white, with a cool slate for text
and three status colours that never appear decoratively.

### Primary

- **Flare Orange** (`orange-flare`, #FF9800): the brand's own orange, and the most misused value in
  the system. At **2.16:1 on white it fails every contrast threshold there is**. It is a decorative
  colour only: tints, hover washes, selected-row fills, borders, icon backgrounds, and display type
  at 24px+ where the large-text threshold applies. It may never be the colour of body text, of a
  link, of a small icon that carries meaning, or of a fill that has white text on it.
- **Signal Orange** (`orange-signal`, #D24400): the working accent — **4.60:1 on white**, the
  lightest orange in this family that clears the normal-text threshold. Contained buttons, the
  active navigation item, orange text of any size, meaningful icons. When a screen needs orange to
  *say* something rather than warm something, this is the value.
- **Deep Orange** (`orange-deep`, #BF360C, 5.60:1): the far end of the primary gradient, and the
  hover state of Signal Orange.
- **Ember** (`orange-ember`, #9A3412, 7.31:1): pressed states and the hover terminus of the
  gradient. The darkest the accent goes.

### Secondary

- **Flare Gold** (`gold-flare`, #FFC107, 1.63:1): decoration only, and the rule is absolute — this
  is the lowest-contrast value in the system. Badges on tinted grounds, chart fills, illustrative
  accents.
- **Signal Gold** (`gold-signal`, #A15C00, 5.19:1): what gold becomes when it has to carry text or
  be read as a status.

### Neutral

- **Ink** (`ink`, #1E293B, 14.63:1): all primary text, headings, and the outlined button's stroke.
  A cool slate deliberately, so warm surfaces read as warm by contrast.
- **Muted Ink** (`ink-muted`, #64748B, 4.76:1): body copy, secondary text, captions, and the resting
  colour of text buttons. It clears AA — barely — so it must not be taken any lighter.
- **Charcoal** (`charcoal`, #1A1E2E): the one near-black, reserved for tooltips and any surface that
  needs to sit visually above the page rather than within it.
- **Paper** (`paper`, #FFFFFF): the default background and every card.
- **Warm Paper** (`paper-warm`, #FAF8F5): table headers, section grounds, and any band that needs to
  separate itself from the page without a border.
- **Deep Warm Paper** (`paper-warm-deep`, #F1EDE8): chip and badge grounds, and the warm edge where
  a hairline would be too cold.
- **Hairline** (`hairline`, rgba(0,0,0,0.06)): every divider, table rule and card border. Barely
  there on purpose.

### Tertiary — status only

- **Danger** (`danger`, #D32F2F, 4.98:1), **Success** (`success`, #15803D, 5.02:1),
  **Info** (`info`, #1D4ED8, 6.70:1), **Warning** (`warning`, #A15C00, 5.19:1). All four clear AA on
  white. Their tinted grounds are #FEF2F2, #F0FDF4, #EFF6FF and #FFFBEB respectively, each paired
  with a darkened text colour rather than the status colour itself.

### Named Rules

**The Two Oranges Rule.** Every orange in this system is either *flare* or *signal*. Flare decorates
and can never be read; signal speaks and always passes 4.5:1. Before using an orange, answer which
one it is — if the answer is "both", the design is wrong. There is no third orange.

**The Daylight Rule.** Orange is daylight, never an alarm. It marks where attention is invited, not
where something has gone wrong. The instant orange is used to mean danger, the product loses the
only vocabulary it has for danger.

**The Measured Value Rule.** No colour enters this system on the strength of a comment. Every value
above carries its measured ratio against white; the incumbent code claimed 4.6:1 for a colour that
measures 3.79:1, and that claim shipped. Measure, then write the number down.

## Typography

**Display Font:** Sora (with Roboto, Helvetica, Arial, sans-serif)
**Body Font:** Sora (the same face, at lower weights)
**Label/Mono Font:** none — labels are Sora at 600

**Character:** Sora is geometric and slightly humanist: open counters, low contrast, a squared-off
warmth that stays friendly at 800 weight and stays legible at 0.9rem. One face across the whole
product is deliberate — a volunteer should never feel a seam between the marketing that sold them
the product and the tool they use on Tuesday.

### Hierarchy

- **Display** (800, `clamp(2.8rem, 6vw, 4.5rem)`, 1.08, -0.03em): page-owning titles and the empty
  states that carry a whole screen. Rare in the administrator's tools; common on welcome and
  first-run surfaces.
- **Headline** (700, `clamp(2rem, 4vw, 3rem)`, 1.15, -0.02em): section openers and dialog titles
  that need to feel like an announcement.
- **Title** (600, 1.75rem, 1.3): page titles in the working interface. Below it sit fixed steps at
  1.5rem, 1.25rem and 1.1rem, all at 600 and 1.3, for nested headings.
- **Body** (400, 1rem, 1.7): all running text, in `ink-muted`. The 1.7 line height is generous on
  purpose — it is what makes a dense settings page readable in a hurry. Cap measure at 65–75
  characters wherever text runs long.
- **Label** (600, 0.95rem, 0.01em, sentence case): buttons, table headers, form labels, chips.

### Named Rules

**The Two Fluid Sizes Rule.** Only Display and Headline use `clamp()`. Everything below is a fixed
rem step. Product UI is read at a consistent distance and has far more type roles than a landing
page; fluid sizing at title and body level makes tables reflow for no reason and turns a screenshot
into an unreliable record.

**The Sentence Case Rule.** Nothing is uppercased by transform — not buttons, not table heads, not
labels. Six locales run through this interface, and German and Portuguese are long enough already;
uppercase costs width the layout does not have and readability the volunteer needs.

## Layout

Content sits on white in a left-rail shell: a permanent 248px navigation rail from `md` upward,
collapsing behind a hamburger below it. The rail is white with a `hairline` right border, never a
tinted sidebar — the warmth in this system comes from the page, not from a coloured chrome.

Spacing runs on an 8px base (4 / 8 / 16 / 24 / 32). Cards take 24px of internal padding, buttons
0.85rem × 2rem, tooltips 8px × 12px, navigation items 8px × 12px with a 2px × 8px outer margin so
the selected pill never touches the rail edge.

Density is deliberately not uniform. Configuration screens — settings, form builder, organisation
details — breathe at 24px and above, because they are read once and understood. Operational screens
— entries, members, payments, orders — tighten toward 16px, because they are scanned repeatedly and
vertical distance costs the administrator time. When the two conflict, the operational screen wins;
that is where the recurring work happens.

Responsive behaviour is desktop-first and deliberately asymmetric. The administrator's tools are
designed at laptop width; below `md` every function stays reachable and nothing breaks, but dense
tables become stacked rows rather than horizontally scrolling grids, and no layout is compromised
at desktop to improve the phone. The member-facing app inverts this entirely and is designed for the
phone first.

### Named Rules

**The Reachable Not Optimised Rule.** On a phone, an administrator must be able to complete any task
and must never be blocked. They are not entitled to the same efficiency — a bulk action that takes
three taps instead of one is acceptable; a bulk action that cannot be reached is not.

## Elevation & Depth

Depth is ambient and soft: wide, low-opacity shadows with no visible edge, on a system that has
almost no borders. Surfaces are separated by light rather than by lines — the only rules in the
interface are `hairline` dividers inside tables and along the navigation rail.

Shadows carry meaning in one direction only: **resting elements are quiet, and lift is a response to
the cursor.** Cards rise 4px on hover; primary buttons rise 2px. Nothing lifts on its own.

### Shadow Vocabulary

- **Rest** (`0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)`): paper at rest, list surfaces,
  anything that needs to be a surface without asking for attention.
- **Raised** (`0 4px 20px rgba(0,0,0,0.06), 0 2px 8px rgba(0,0,0,0.04)`): cards, popovers and menus
  at rest.
- **Lifted** (`0 10px 40px rgba(0,0,0,0.08), 0 4px 12px rgba(0,0,0,0.04)`): the hover state of a card
  or menu, and modal dialogs.
- **Action Glow** (`0 8px 30px rgba(255,152,0,0.25)`, hover `0 12px 35px rgba(255,152,0,0.35)`): a
  warm orange halo, under primary buttons only.
- **Bar** (`0 1px 30px rgba(0,0,0,0.06)`): the app bar, which also carries `backdrop-filter:
  blur(20px)` over a 95%-opaque white so content dissolves rather than cuts as it scrolls under.

### Named Rules

**The Glow Belongs To Action Rule.** The orange glow is the single most distinctive thing in this
interface and it means exactly one thing: *this is the primary action*. One per screen region. On a
card, on an input, on a static badge, it is decoration and it is wrong — and a screen with three
glowing things has no primary action at all.

## Shapes

Rounding is graduated by how much a thing behaves like an object. Buttons are fully rounded pills
(60px) because they are the most object-like element on the page and the thing a hesitant user is
looking for. Cards are generously rounded (20px) because they are surfaces you hold. Inputs, paper
and alerts take 12px; chips, tooltips and navigation items take 8px, tight enough to read as
labels rather than as controls.

Borders are close to absent. Cards carry a 1px `rgba(0,0,0,0.04)` edge that exists only to keep a
white card from dissolving into a white page. Inputs are the exception and carry a deliberate **2px**
stroke — heavier than the rest of the system — because a form field must be unmistakably a place to
type, and a hairline field on white is a field a hurried volunteer will miss.

### Named Rules

**The Pill Is A Promise Rule.** 60px full rounding belongs to buttons and to nothing else. When any
other element goes fully round, the button stops being the most clickable shape on the page, and the
one affordance the interface guarantees is diluted.

## Components

### Buttons

The character is confident and slightly soft — a raised, fully rounded object that responds when
approached.

- **Shape:** fully rounded pill (60px), padding 0.85rem × 2rem, label at 600 in sentence case.
- **Primary:** the orange gradient, `linear-gradient(135deg, #D24400, #BF360C)`, white text, with
  the Action Glow beneath. **Both stops clear 4.5:1 against white text** — the incumbent gradient
  started at #FF9800 (2.16:1) and did not.
- **Hover / Focus:** gradient darkens to `linear-gradient(135deg, #BF360C, #9A3412)`, lifts 2px,
  glow strengthens; `transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1)`. Active returns to 0px.
  Focus-visible shows a 3px `orange-signal` ring at 40% opacity, offset 2px — never the browser
  default, never removed.
- **Secondary (outlined):** 2px `ink` border on white, `ink` label; inverts to `ink` ground with
  white text on hover and lifts 2px.
- **Tertiary (text):** `ink-muted` label, no border; on hover the ground washes to
  `rgba(255,152,0,0.08)` and the label becomes `orange-signal`.

### Cards / Containers

- **Corner Style:** 20px.
- **Background:** `paper`, always.
- **Shadow Strategy:** Raised at rest, Lifted on hover with a 4px rise.
- **Border:** 1px `rgba(0,0,0,0.04)`, present only to hold the edge against a white page.
- **Internal Padding:** 24px, dropping to 16px on operational screens.

### Inputs / Fields

- **Style:** white ground, 12px radius, **2px** stroke in `rgba(0,0,0,0.08)`.
- **Hover:** stroke becomes `orange-flare` — decorative use, legitimate because a border is not text.
- **Focus:** stroke `orange-flare` plus a 4px `rgba(255,152,0,0.1)` halo. The halo replaces the
  outline; it must never be removed without one.
- **Error:** stroke and helper text in `danger`, and the message states what to do, not what failed.
- **Disabled:** ground `paper-warm`, stroke `hairline`, label `ink-muted` at 60%.

### Chips

- **Style:** `paper-warm-deep` ground, `ink` label, 8px radius, weight 500, no border.
- **State:** selected chips take `rgba(255,152,0,0.12)` with an `orange-signal` label.

### Navigation

The rail is white, 248px, with a `hairline` right edge. Items are 8px-radius rows at 8px × 12px with
a 2px × 8px margin. Resting items are `ink-muted`; hover washes to `rgba(255,152,0,0.08)`; the
selected item takes `rgba(255,152,0,0.12)` with an `orange-signal` label at 600 and a matching icon.
Selection is carried by ground and colour together, never by colour alone. Below `md` the rail
becomes a temporary drawer with `keepMounted`.

### Tables

Headers sit on `paper-warm` with `ink` labels at 600 — the one place a warm ground does structural
work. Rows are separated by `hairline` bottom borders and nothing else: no zebra striping, no
vertical rules, no outer border. Row hover washes to `rgba(255,152,0,0.08)`.

### Alerts

12px radius on a tinted ground with darkened text: success #F0FDF4/#166534, error #FEF2F2/#991B1B,
warning #FFFBEB/#92400E, info #EFF6FF/#1E40AF. The tint carries the meaning; the icon confirms it,
so the alert still reads for a colour-blind user.

### Tooltips

`charcoal` ground, white text at 0.85rem, 8px radius, 8px × 12px padding. The only near-black
surface in the product.

## Do's and Don'ts

### Do:

- **Do** decide which orange you are using before you use it. `orange-flare` (#FF9800) decorates;
  `orange-signal` (#D24400) speaks and clears 4.5:1.
- **Do** put the Action Glow under exactly one button per screen region.
- **Do** carry state in ground *and* colour together — a selected navigation item changes both.
- **Do** keep body text at `ink-muted` (#64748B) or darker. It measures 4.76:1 and has no headroom.
- **Do** let operational screens tighten to 16px while configuration screens stay at 24px.
- **Do** measure any new colour against its real background and write the ratio next to it.
- **Do** design tables to become stacked rows below `md`, not horizontally scrolling grids.

### Don't:

- **Don't** put white text on `orange-flare` or `gold-flare`. They measure 2.16:1 and 1.63:1; this
  is the single most common way to break this system.
- **Don't** use orange to mean danger, or red to mean anything else. Status colours are not palette.
- **Don't** fully round anything that is not a button.
- **Don't** apply `clamp()` below Headline.
- **Don't** uppercase labels by transform — six locales, and German and Portuguese are long already.
- **Don't** add borders to create separation. This system separates with light and warm ground; a
  new hard rule will look foreign next to everything around it.
- **Don't** lift an element that the cursor is not on. Depth here is a response, not a property.
- **Don't** hard-code a club's colour into a shared component. The member app themes per club at
  runtime from an arbitrary hex, and anything that assumes orange will break there.

---

## Known divergence from the implementation

This file is normative; the code is not yet. Recorded so the gap is a task list, not a discovery:

| Where | Current | Required |
|---|---|---|
| `packages/orgadmin-shell` primary fill | `#FF9800 → #E65100` gradient, white text at 2.16:1 | `#D24400 → #BF360C`, 4.60:1 |
| `packages/orgadmin-shell` status colours | #EF4444 / #22C55E / #3B82F6 / #F59E0B, all below 4.5:1 | #D32F2F / #15803D / #1D4ED8 / #A15C00 |
| `packages/admin` form language | flat, `disableElevation`, radius 8, fixed type scale | pills, gradient, lift, glow, radius 12 |
| `packages/frontend` | Sora not linked in `index.html`; falls back to Roboto | link Sora, as the other three apps do |
| Theme location | three near-identical copies in three packages | one theme in `packages/components` |

`packages/account-shell` is deliberately outside this table. It themes per club at runtime from the
organisation's primary colour, and its job is to carry the *club's* identity, not the platform's.
The rules above that still bind it are structural: the type scale, the spacing rhythm, the shape
language, and the requirement that contrast be computed against the resolved club colour rather than
assumed.
