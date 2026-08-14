# Naming the bookings area, and marking each calendar

Two related changes to how a club's bookable things present themselves to members, plus the
merchandise discount gap that was closed alongside them.

## 1. A club names its own bookings area

"Bookings" is what the software does. A club's members know it as the court, the arena or the pool,
and a tennis club whose menu says "Bookings" is reading someone else's vocabulary.

**Set under Settings → Branding**, in a *Naming* section that appears only when the organisation has
the `calendar-bookings` capability. A club with no calendars renaming a menu it does not have is a
setting that cannot be checked and will not be remembered.

| | |
|---|---|
| Stored | `organizations.settings → branding.bookingsLabel` |
| Default | empty, meaning the member app uses its own translated word |
| Limit | 40 characters — long enough for "Cross-country schooling", short enough for a nav rail |
| Exposed | `GET /api/public/organisations/:code` → `branding.bookingsLabel` |

Empty is stored rather than the default word, so a club that never touches this keeps following the
translated default **in every language**. The custom label is deliberately *not* translated: it is a
name the club chose, and machine-translating "Court Booking" into five languages would produce five
things the club never agreed to.

`useBookingsLabel()` in `account-shell` is the single reader. Both places the member app names the
area — the navigation entry and the home screen's section heading — go through it, so they cannot
drift apart.

## 2. Bookings get their own row on the home screen

"What's on" used to mix everything a club offers into one row. Bookings are a different kind of
thing: they recur where events and shirts are one-offs, and the club has renamed the area to match
what it actually books. Mixing them in buried both facts.

They now sit in a second row beneath, headed by the club's own word for them — *Court Booking*,
*Arena Booking*, or the default *Bookings*. The general row keeps the "What's on" heading and only
appears when there is something non-booking to put in it, so a bookings-only club sees one row, not
an empty heading above a full one.

## 3. Each calendar carries an icon

A club's bookable things are not interchangeable — a court, an arena and a clubhouse read very
differently — and colour alone does not carry that at a glance in a row of cards.

`calendars.display_icon` holds a **name from a curated set**, not an uploaded file. The set ships
with both front ends, so it renders instantly, needs no bucket and survives offline; a picker over
the whole Material library is a search box nobody knows what to type into, and bundling it to make a
dozen icons reachable is a megabyte spent on nothing.

- Set in the calendar form, beside the colour — the two are one decision, and choosing them apart
  invites a green tennis racket.
- Drawn by `CalendarIcon` (in `packages/components`, §1.5) in the calendar's own colour, on a faint
  tint of the same colour so it sits on something rather than floating.
- **Falls back rather than disappearing.** A club that chose nothing, and a stored icon this build
  no longer ships, both get the generic calendar mark — a card with a hole where its icon should be
  reads as a fault in the club's own setup.

Adding an icon to the set is a line in `calendarIcons.ts`, its import in `CalendarIcon.tsx`, and a
label in each of the six locale files.

## 4. Bookings are budgeted their own row

The home screen's teasers were capped at four **across every kind**, with one of each kind taken
first. A club with events, a shop and three calendars therefore showed exactly **one** calendar —
which looked broken next to a bookings page listing three, with nothing on screen to say it was a
limit rather than all the club had.

Now that bookings have their own row they have their own allowance: four for the general row and
four for bookings, counted separately.

## 5. Each calendar is marked by its icon, not a colour bar

The bookings page listed calendars behind a thin coloured bar. A column of coloured bars asks the
member to remember which colour means the arena; a racket or a stable says it outright. The bar is
replaced by the calendar's icon, drawn in its colour on a faint tint of the same colour — the same
treatment as the home screen's booking cards, so the two read as one thing.

Calendars with no icon chosen get the generic calendar mark rather than a gap, which keeps the
column even.

## 6. The default favicon is the ItsPlainSailing logo

`useOrganisationFavicon` already fell back to `/favicon.png` whenever a club had no logo — but that
file was a generic account glyph, so an unbranded club got someone's idea of a person rather than
the platform's own mark. It is now the sail logo, padded square and sized to 48px.

The rest of the PWA icon set (`icon-192`, `icon-512`, the maskable variants and
`apple-touch-icon`) is **still the old glyph**. Those are baked into an installed homescreen
shortcut, so changing them silently would alter the icon on devices that already installed the app;
worth doing deliberately rather than as a side effect.

## 7. The basket sits beside the week, and chosen slots go green

Choosing several slots means running a total in your head, and a summary below
the fold makes you scroll to check it after every tap. The week grid now takes
two thirds of the page with the basket, terms and the add button in a **sticky**
column beside it, stacking underneath on a phone where there is no room.

Chosen slots fill **success green** rather than the default grey. With several
selectable at once, "which have I picked?" is the question the grid has to
answer at a glance, and a selected-but-grey button reads as disabled next to the
ones that genuinely are.

## 8. The shop gets a row, with thumbnails

Merchandise now sits in its own row after bookings, each card led by a thumbnail
of the product — the thing a shopper recognises before reading a word. The row
carries its own budget of four, like the other two.

Cards in a named row no longer repeat their kind as a caption: "Shop" above a
grid of cards each captioned "Shop" is the same word twice, and the caption is
the one that can go.

## 9. Seeded products are drawn, not coloured

The first pass at seeded images was a coloured tile with the product's name on
it. It proved the plumbing and nothing else: every card looked like every other
card, and a screen meant to show a shop showed a colour chart.

`scripts/seed/artwork.ts` draws each product as itself — a collared shirt, a
hoodie, a cap, a saddle pad, a rosette, a book, a kit bag, a snowflake jumper.
Still generated SVG `data:` URIs for the same reasons (no bucket, no binary
assets, understood by both render paths), and deliberately flat shapes rather
than illustrations, because they have to read at 56 pixels in a thumbnail.

Keyed by product key rather than inferred from the name: a fixture that guessed
from words would fall back to a blank tile the first time somebody renamed a
product, and quietly stop testing what it exists to test.

## 10. Merchandise can finally carry a discount

A club could already **create** merchandise discounts — the pages are there, gated on
`merchandise-discounts` — and the product page already rendered a `DiscountSelector`. But
`merchandise_types` had no `discount_ids` column, and `merchandise.service` mapped the field to a
hardcoded `[]`. Every other sellable thing carried the column; merchandise was the one omission, so
its discount pages produced discounts that could never be applied to anything, and the picker's
selection was silently discarded on save.

The column now exists and the service reads and writes it, which was the whole of the gap — the
org-admin UI and the route needed no change. Verified end to end: created with two discounts, read
back with two, updated to one.

## Where it lives

| Piece | Location |
|---|---|
| Migration | `migrations/1709000000024_merchandise-discounts-and-calendar-icons.js` |
| `bookingsLabel` storage and validation | `services/organization-branding.service.ts` |
| Public exposure | `services/account-organisation.service.ts` |
| Branding field | `orgadmin-core/src/settings/components/BrandingTab.tsx` |
| Icon set and component | `components/src/components/CalendarIcon/` |
| Icon picker | `orgadmin-calendar/src/components/CalendarForm.tsx` |
| Label reader | `account-shell/src/hooks/useBookingsLabel.ts` |
| Home rows and cards | `account-shell/src/pages/HomePage.tsx`, `components/WhatsOnCard.tsx` |
| Per-row teaser limits | `services/account-dashboard.service.ts` — `WHATS_ON_LIMIT`, `BOOKINGS_LIMIT` |
| Multi-slot booking | `account-shell/src/pages/BookCalendarPage.tsx` |
| Default favicon | `account-shell/public/favicon.png` |
