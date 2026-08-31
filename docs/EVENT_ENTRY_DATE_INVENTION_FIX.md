# The event form invented entry dates

## The symptom

Edit one field on an event — the name, say — and the audit log reported that
the entry opening and closing dates had changed too. Nobody had touched them.

It looked like the timezone fault fixed in `15ccffd`, which walked naive
timestamps backwards by the server's UTC offset on every save. It was not.

## What the trail actually said

```
2026-08-29 11:20  Christmas Fun Day  openDateEntries {"to": "2026-08-29T11:19:50.760Z", "from": null}
2026-08-21 16:47  Christmas Fun Day  openDateEntries {"to": "2026-08-21T15:47:14.704Z", "from": null}
2026-08-21 12:58  Spring Dressage    openDateEntries {"to": "…T16:23:46.254Z", "from": "…T17:23:46.254Z"}
2026-08-21 12:38  Winter Dressage    openDateEntries {"to": "…T16:23:46.269Z", "from": "…T17:23:46.269Z"}
```

Two different faults, and the dates separate them:

- The **August 21st pair** is the timezone bug — exactly one hour backwards, the
  Dublin offset. Both pre-date `15ccffd`. Fixed, and it stayed fixed.
- The **`from: null` rows** are this one. Nothing drifted. The field had no
  value, and the save gave it one — `11:19:50`, about twelve seconds before the
  save at `11:20:02`, which is when the edit page finished loading.

A round-trip through the driver confirmed the timestamps are stable now: an
event's `open_date_entries` read as `2026-08-19 12:12:34.758`, went back to the
browser as `2026-08-19T12:12:34.758Z`, was written back verbatim, and the audit
diff came out empty.

## The cause

`useEventForm.loadEvent` filled absent entry dates with the current time:

```ts
openDateEntries: response.openDateEntries ? new Date(response.openDateEntries) : new Date(),
entriesClosingDate: response.entriesClosingDate ? new Date(response.entriesClosingDate) : new Date(),
```

`handleSave` sends the whole of `formData`, so opening an event with no entry
window and saving anything wrote two timestamps the user never entered.

A null entry window is not missing data. The server reads it as *unbounded*:

```sql
(e.open_date_entries IS NULL OR e.open_date_entries <= NOW())
AND (e.entries_closing_date IS NULL OR e.entries_closing_date >= NOW())
```

So inventing a value is a data change, not a default — it silently converts
"entries always open" into "entries opened at the moment somebody looked at this
page".

### The same fault on the create form, with a worse result

`DEFAULT_FORM_DATA` had the same two `new Date()` calls. Both dates identical
means `entries_closing_date >= NOW()` fails a second later, so **a new event
whose entry dates were never touched was closed to entries from the moment it
was created**.

That constant was also evaluated once at module import, not per form, so a tab
left open overnight opened its next Create Event form on yesterday's date.

## The rule

**An event cannot be created without all four dates** — start, end, entry
opening and entry closing. None of them has a usable default, which is what the
old fallbacks were pretending otherwise.

That makes the two halves of this fix one change: the form stops *inventing* a
value, and validation stops the save until somebody supplies one. Removing the
invention on its own would only have moved the problem, letting a club create an
event that is permanently open to entries.

Enforced in three places, because the form is not the only way in:

| Where | What |
|---|---|
| `useEventValidation.validateDates` | All four required, on `validateAll` (save) and on `validateStep(1)` (the wizard's Next). Also asserts `endDate >= startDate` and `entriesClosingDate > openDateEntries` |
| `eventService.createEvent` | Rejects a create missing any of the four, naming all the missing ones at once |
| `eventService.updateEvent` | Rejects an explicit `null` or `''` for any of the four. `undefined` still means "not part of this update", so partial updates keep working |

**The columns stay nullable.** This is a rule about what may be written, not
about what the table can hold: events created before the rule still have to read
back correctly, so `public-event.service`'s `IS NULL` handling stays exactly as
it is.

The seed no longer carries an ungated event. `Ward Union Open Day` was the one
exception — "no entry window configured at all" — and it now has a long window
instead of none, so every seeded event is a shape the API would accept today.
`scripts/seed/database.ts` asserts all four dates before it inserts, because the
seed writes with raw SQL and never meets `createEvent`'s guard.

## The fix

`packages/orgadmin-events/src/hooks/useEventForm.ts`

- `DEFAULT_FORM_DATA` becomes `createDefaultFormData()`, called per form, so
  `new Date()` means "now" rather than "whenever this bundle was first loaded".
- Both entry dates default to `undefined` — on the blank form and on load.
  Absent stays absent; the club is then asked for a value rather than given one.
- `startDate` and `endDate` keep their `new Date()` fallback. Those columns are
  `NOT NULL`, and a blank form opening on today's date is a helpful default
  rather than an invented one.

`packages/orgadmin-events/src/components/sections/EventDatesSection.tsx`

Each picker now shows its own error and clears it as soon as a date is chosen.
Previously the section took no `fieldErrors` at all, so a required-date message
would have had nowhere to appear.

`packages/orgadmin-events/src/pages/CreateEventPage.tsx`, `EditEventPage.tsx`

Both jump to the section or wizard step holding the first error; neither knew
about the dates step, so a date error would have been reported with nothing on
screen to show for it. The review step renders `events.dates.notSet` for an
unset date instead of an empty cell.

New i18n keys, all in six locales: `events.dates.notSet` and
`events.dates.validation.*` (four required-messages, plus `endBeforeStart` and
`closingBeforeOpening`).

## Consequence for events already affected

Events saved through the old form have real timestamps in those columns now.
They are indistinguishable from dates somebody meant to set, so nothing is
corrected automatically. A club that finds an event with an unexpected entry
window can change it; the trail shows when it was introduced and by whom.

**Legacy events with no entry window can still be edited**, but the first save
will now ask for one — `validateDates` runs on every save, not only on create.
That is the intended behaviour: the alternative is a form that silently keeps a
state new events are not allowed to reach. Clearing a date back to empty is
refused by `updateEvent`.

## Tests

| File | Covers |
|---|---|
| `orgadmin-events/.../useEventForm.entryDates.test.ts` | An absent window stays absent on load; a present one round-trips to the millisecond; the blank form starts empty and is dated when opened rather than at import; `startDate`/`endDate` keep their fallback; choosing an opening date still derives a closing date an hour later |
| `orgadmin-events/.../useEventValidation.dates.test.ts` | Each of the four is required; all missing ones reported at once; `null`, `''` and an unparseable date all count as missing; ISO strings accepted as well as `Date`s; end-before-start and closing-before-opening rejected; a single-day event and a zero-length entry window; the wizard blocked and released on step 1 |
| `backend/.../event.service.requiredDates.test.ts` | Create refused for each missing date, before the insert; all missing ones named in one message; inverted and zero-length entry windows refused; update refuses to clear any of the four via `null` or `''`, leaves unmentioned dates alone, and still accepts a legitimate change |

`CreateEventPage.test.tsx` gained a `fillEventDates()` helper: five discount
tests walked the wizard to the Activities step, and `Next` now correctly refuses
to leave the dates step until they are set.

## Related

- `docs/TIMESTAMP_ROUND_TRIP.md` — the fault this was mistaken for.
- `docs/AUDIT_SESSION_EVENTS_FIX.md` — found while reading the same trail.
