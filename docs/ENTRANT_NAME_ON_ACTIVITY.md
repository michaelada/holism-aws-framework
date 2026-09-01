# The lists never said who the entry was for

## The report

> In the "Coming up" section on the home page where it shows upcoming entries, can you also include
> the entered person's name. And the same when you drill into "My entries & bookings".

## Why it mattered

A parent holds every entry in the household on one login. Áine McGrath has four memberships, so four
of her children in the same class produced four rows reading:

```
Spring Hunter Trials
14 Sept 2026 · Class 2
```

— four times, identically. The child is the only thing that distinguishes them, and the child was
the one thing the row did not say.

The name was already on the row. `event_entries.first_name` / `last_name` are written on every
entry, and `AccountEntryDetail` has carried them all along for the single-entry screen. The **list**
query simply never selected them.

## What changed

| Where | What |
|---|---|
| `account-activity.service.listEntries` | Selects `ee.first_name, ee.last_name`; `AccountEntry` gains `entrantName` |
| `account-dashboard.service.pickComingUp` | `DashboardComingUp` gains `entrantName`, from the entry. **Null on a booking** — a booking is made by the account holder, so there is nobody else to name |
| `HomePage` — Coming up | `14 Sept 2026 · Class 2 · Rónán McGrath` |
| `MyEntriesPage` | `Class 2 · Rónán McGrath` under the event name |

Both screens join with `·`, and both drop the separator when there is no name rather than leaving one
dangling — an entry with nothing recorded reads exactly as it did before.

## Verified in the running app

Signed in as Niamh Walsh at Kildare:

```
Coming up      Spring Show Jumping League
               22 Sept 2026 · Grade 2 — 90cm · Niamh Walsh

My entries     Spring Show Jumping League
               Grade 2 — 90cm · Niamh Walsh          22 Sept 2026    €30.00
```

## Tests

- `account-activity.service.test.ts` — the name is returned, the query asks for both columns, and
  one part alone does not leave a stray space.
- `account-dashboard.service.test.ts` — the name reaches the card, a booking gets `null`, and an
  entry with an empty name reports `null` rather than a blank string.
- `HomePage.test.tsx` — the name renders beside the class, two entries in the same class are
  distinguishable, and a booking gains no trailing separator.
- `MyEntriesPage.test.tsx` — the same three, plus the two existing assertions updated from an exact
  match on the class to one that allows the name after it.
