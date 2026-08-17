# One table for entries and bookings

*My entries & bookings* showed two tables behind two tabs. It now shows one,
with each row marked by the icon for what it is.

## Why one table

The tabs made the member do the merging. A Saturday with a lesson at ten and a
show entry at two was two screens, and neither said which came first — the
question the page exists to answer is "what have I got on", and that is a single
list.

The kinds keep the detail that differs. An entry names its activity; a booking
names its time and its length. They are told apart by the mark on the left
rather than by which tab you are looking at.

| | |
|---|---|
| Entry | event name, activity beneath, event date |
| Booking | calendar name, `09:00–10:00 · 60 min` beneath, booking date |

## The mark

`CartItemIcon` already did exactly this job in the basket, so it is reused
rather than reimplemented: an entry gets the event glyph, and a **booking gets
its own calendar's icon in its own colour** — the same one the member chose it
from, so a court, an arena and a clubhouse are told apart rather than sharing
one generic booking symbol.

That needed the icon on the wire. `listBookings` now selects
`calendars.display_icon` and `display_colour`, the way the cart service already
did for basket lines.

## Ordering

**Coming up first, soonest first; then what has been and gone, most recent
first.**

A single sort in either direction puts the least useful end at the top:
ascending opens on last season, descending on something months away. An entry
with no date sorts as far future rather than as 1970.

## Smaller decisions

- **Only entry rows are clickable.** An entry has a detail screen; a booking's
  detail is already in its row, and a cursor promising a page that does not
  exist is worse than none.
- **The icon column has no heading.** It labels the row rather than holding a
  value.
- **Cancel stays where it was**, on bookings the club's policy allows, with the
  reason shown when it refuses.

Removed as now meaningless: `entries.tabEntries`, `tabBookings`, `colEvent`,
`colActivity`, `colCalendar`, `colSlot`, `colDuration`, `emptyBookings`, and the
`?tab=` URL parameter. Added: `entries.colItem`. All six locales.

## Verified

Backend 2787 passing, account-shell 545. Live: a booking comes back carrying
`displayIcon: equestrian` and `displayColour: #123c2b` — the club's own choice
for that calendar.

The 3 remaining account-shell failures are the pre-existing `packages/components`
breakage, unrelated.
