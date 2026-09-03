# Ticketed entries in the seed

## The ask

> In the seed program can you add a set of ticket based entries, so I can see the functionality in
> action.

The seed configured **one event** for electronic tickets and issued **none**. So the ticketing module
— the issued / scanned / remaining cards, the scan history, a ticket's own dialog, the ticketed
events overview — had nothing to show on any club, and neither had the account side.

## What is seeded now

A ticket is written for **every entry on a ticketing event**, because that is what the application
does: `fulfilment.service` calls `ticketingService.issueTicketForEntry` after creating the entry. The
fixture does not ask for a ticket; it says what happened to it afterwards.

```
Electronic tickets
  Dunshaughlin Gate Day (completed)  Meath Hunt Pony Club     6 issued, 4 scanned
  Tara Hunter Trial                  Meath Hunt Pony Club     5 issued, 0 scanned
```

**Two events, deliberately.** Before the day a club looks at tickets issued and none scanned;
afterwards it looks at who actually came. With only the future event in the fixture, a scan would
have to be dated in the future — a state a gate cannot produce. So a completed ticketed event was
added: **Dunshaughlin Gate Day**, twelve days ago, at Meath (the only club with `event-ticketing`).

| Entrant | State | What it shows |
|---|---|---|
| Bríd McNamara | `scanned` | admitted at the Main gate |
| Colm Fitzgerald | `scanned` | |
| Éabha O'Toole | `scannedTwice` | **presented twice** — `scan_count` 2 and two rows in its history, which is how a duplicate shows |
| Séamus Donnelly | `issued` | paid and never came: a ticket still unscanned after the day |
| Maeve Kiernan | `cancelled` | withdrew, so the ticket was cancelled rather than scanned |
| Aoibhínn Regan | `scanned` | scanned at the Junior ring, so the location is not always the same |

Read back from a scratch database:

```
TKT-2026-000001  Bríd McNamara     issued     scanned      1   20 Aug 09:20  Main gate
TKT-2026-000002  Colm Fitzgerald   issued     scanned      1   20 Aug 09:20  Main gate
TKT-2026-000003  Éabha O'Toole     issued     scanned      2   20 Aug 11:45  Main gate
TKT-2026-000004  Séamus Donnelly   issued     not_scanned  0   —
TKT-2026-000005  Maeve Kiernan     cancelled  not_scanned  0   —
TKT-2026-000006  Aoibhínn Regan    issued     scanned      1   20 Aug 09:20  Junior ring

scan history
  TKT-2026-000003  success  20 Aug 09:20  Main gate  Ticket scanned successfully
  TKT-2026-000003  success  20 Aug 11:45  Main gate  Ticket presented a second time at the gate
```

## Written the way the service writes one

- **The reference comes from the same sequence** (`electronic_ticket_reference_seq`), so a seeded
  ticket and one issued by the running application cannot collide.
- **Validity mirrors `issueTicketForEntry`**: from the start of the event *day* — not the moment of
  issue, or a ticket bought in March reads as valid-since-March on its face — to the end of the last
  day plus the configured period.
- **Every scan is in the history, not only the last.** The ticket row keeps the most recent; the
  history is what shows a ticket presented twice, which is the point of keeping a history rather
  than a flag.
- **`scan_result` is `success` even for the repeat**, because that is the only value
  `updateTicketScanStatus` ever writes. A duplicate is told from an admission by the *count*, not by
  the result.

The writer refuses a fixture that names a ticket state on an event issuing no tickets — it would
silently do nothing, which is the kind of fixture that reads as covered and is not.

## Two things found on the way

**`ticket_validity_period` disagrees with its own label.** The service adds it to the event's last
day (`validUntil.setDate(getDate() + period)` — *days, after the event*), while the form labels the
field **"Ticket Validity Period (hours)"** and its help text says *"hours before event start that
the ticket becomes valid"*. The unit and the end of the window both differ. A club entering 24
meaning "valid from the day before" gets a ticket valid for 24 extra days afterwards. The fixture
follows the code, because that is what the data will look like — the Tara Hunter Trial's 24 became
1 — and the disagreement is left reported rather than silently resolved: changing either side moves
the validity of tickets already issued.

**`scanResult` has two vocabularies.** `orgadmin-ticketing/src/types/ticketing.types.ts` declares
`'valid' | 'invalid' | 'already_scanned' | 'expired'`; the backend only ever writes `'success'`. The
dialog prints the value raw, so nothing breaks, but the type describes a set the API does not
produce.

## A gate you can actually work

Added after the first pass, because the fixture had no ticket that was **valid now**.

There was a gate day twelve days ago and a hunter trial three weeks out, which between them cover
*afterwards* and *before the day* — and leave out the state the scanner is used in. A past event's
tickets are expired; a future event's cannot honestly be scanned, since a scan carries a time. So
every seeded ticket was either used up or not yet live, and trying the scan path meant editing dates
by hand first.

**`mhpc-gate-today` — "Dunshaughlin Gate Day (today)"** runs today, `startDays: 0`, entries closed
yesterday. Seven tickets: **five unscanned and valid right now**, two already admitted this morning,
so the dashboard's issued/scanned/remaining counts read as a morning in progress rather than as
all-or-nothing. Validity is a day past the event, so a ticket issued for today is still good this
evening.

One of them is a **Family car pass**, the only seeded activity with `ticketsAdmit: 4`. Scan it four
times and the fifth is refused. Nothing else in the fixture can show the gate's ceiling working,
because everything else admits one and a used ticket looks the same as a used-up one. See
[GATE_SCANNING.md](GATE_SCANNING.md).

This moved one fixture invariant: `dataset.test.ts` used to require every scanned ticket to sit on an
event with `startDays < 0`. A scan at *today's* gate is not a fiction, so the rule is now `<= 0`,
with a second test asserting that an event happening now leaves tickets unscanned — the property the
whole addition exists for.

## In an existing development database

The five entries already on the Tara Hunter Trial were given their tickets through
`issueTicketForEntry` itself, so the ticketing module is not empty before a reseed. The completed
gate day — and so every scan, the duplicate and the cancellation — comes with `npm run seed:demo`.

Today's gate day was added to a live development database the same way: the event, its two classes
and its ticketing configuration written directly, the six entries inserted, and the tickets issued by
`issueTicketForEntry` so they are the rows the application itself would have made. Those entries
carry **no `payments` row** — a re-seed produces them properly — so they are ticketing fixtures
rather than payment ones.

## Tests

`scripts/seed/__tests__/dataset.test.ts` — seven: a ticketed event in the past and one to come;
every ticketed event has entries; a ticket state only where tickets are issued; all four states
covered; no scan at a gate that has not opened (`startDays <= 0`); **an event happening now with
tickets still waiting to be scanned**; and every ticketed entry made before its event ran.
