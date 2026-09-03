# Correcting an entry

## The ask

> Could you add the ability to the org-admin for an administrator to edit the form fields of an
> entry, e.g. in the case where the person entering made a mistake. Note, this would want that the
> Edit Form Submission Data would have to show all fields from the form, even those that have no
> value.

and, a moment later:

> Actually, with the edit option can you also allow them to edit the entrant's name.

## What there was

Nothing. An entry's answers were written once, at checkout, by the member — and after that the only
way to change a mistyped vaccination date or a pony's name was a `psql` session. The entry detail
page could *show* the answers (`formSummary`), but a summary is not an editor:

- it holds **display text**, built server-side from the form's labels — `"Yes"`, `"12 May 2012"` —
  not the values behind them;
- it **drops blanks**, which is right for reading back what somebody said and wrong for correcting
  it. The question the member skipped is exactly the one an administrator is most likely to be
  filling in.

The name had the same problem from the other direction: it lives on `event_entries` as
`first_name`/`last_name`, and a name typed in a hurry — or a child entered under a parent's — could
not be fixed at all.

## The screen

An **Edit** button beside *Who entered*, not beside the answers: the name is the commoner correction,
and an activity that asks nothing still has one to fix.

```
┌ Who entered ─────────────────────────────────────── [✎ Edit] ┐
│ Name           Áine McGrath                                   │
│ Email          aine@example.test                              │
└───────────────────────────────────────────────────────────────┘

  ┌ Edit this entry ────────────────────────────────────────────┐
  │ Correct the entrant's name or any answer given on the form.  │
  │                                                              │
  │ Name *                                                       │
  │ [ Áine McGrath                                            ]  │
  │ ──────────────────────────────────────────────────────────   │
  │ Pony name          [ Bramble                              ]  │
  │ Entrant age group  [ Under 12                          ▾ ]  │
  │ Medical notes      [                                      ]  │  ← never answered
  │ Entrant date of birth [ 12/05/2012              ] 📅         │
  │                                                              │
  │ ⚠ Still needed: Emergency contact name                       │
  │                                        [ Cancel ] [ Save ]   │
  └──────────────────────────────────────────────────────────────┘
```

**Every field of the form**, in the form's own order, whether it was answered or not — the point of
the ask. The dialog fetches `/application-forms/:formId/with-fields` rather than deriving fields
from the answers, so a question nobody answered still gets a box.

The **name is one field**, not two. It is typed as one string into "Who is this entry for?" and split
at the first space only so the schema has somewhere to put it; offering "first" and "last" here would
ask the club to maintain a split it never made.

Fields render through the shared `FieldRenderer`, so a date is a date picker and a choice is a
choice — the same controls the member met. The `LocalizationProvider` sits in the dialog rather than
in the library: through the source alias Vite can load a second copy of `@mui/x-date-pickers`, and a
provider inside the library would belong to a different module instance than the pickers rendered
here.

Save is held while a required answer is missing or an answer is wrong for its field, and the dialog
says which — by label, so it names the question the club asked rather than the column it is stored
in.

## The endpoint

```
PUT /api/orgadmin/events/:eventId/entries/:entryId/answers
    { name?: string, answers?: Record<string, unknown> }
```

Scoped with `byResource('event', 'eventId')` — the guard authorises the **event**, so
`updateEntryAnswers` re-checks that the entry belongs to it and answers **404** otherwise. Without
that, an entry id from another club could be corrected by naming one of your own events. A 404 rather
than a 403, because confirming the id exists is the leak.

`getEntryById` now also returns `applicationFormId` and `formValues` — the raw `submission_data` —
alongside the formatted `formSummary`. Both, because the page reads one and the dialog edits the
other.

### Everything is checked before anything is written

The name and the answers are corrected in one sitting, so a refusal has to leave the entry exactly as
it was. The first cut renamed the entrant and *then* validated the answers, which meant a rejected
form still renamed them: the club saw an error over a screen that had already half-changed
underneath it. Caught against the development database rather than in a test — the service was
called with a nonsense value for a select field, and the entry came back refused and renamed.

So, in order: the entry is found, the name is checked for emptiness, an activity with no form refuses
answers, the form is loaded and the answers validated — and only then does anything write.

Other rules:

- **A blank name is refused** (`Enter the name of the person this entry is for`). An empty name would
  leave the entrant list with a blank row, which is the one thing that list cannot be. A *missing*
  name — no `name` key at all — is not a rename; correcting an answer is not renaming anybody.
- **Answers are validated with `validateSubmissionData`**, the same rules the member's own submission
  passed. An administrator typing into a date box produces nonsense as readily as anybody else, and a
  bad submission is a bad record rather than a bad screen. Refusals come back as `fieldErrors` naming
  the field and its label.
- **A missing submission is created, not refused.** An entry made before the club added a form to the
  activity has answers to give and nowhere to put them; the new submission is linked back onto the
  entry.
- **An activity that asks nothing still accepts a rename**, and refuses answers.
- **The membership link is left alone.** A club fixing a spelling has not said the entry is for
  somebody else.

### Audited

`entry.answers-corrected`, on the audit registry and in all six locales. The recorded values carry
the entrant's name and the stored answers, so the trail shows what an entry was changed *to* — with
`sensitiveFields` applied, since a form can ask for medical details.

## Tests

| Suite | Covers |
|---|---|
| `event-entry.service.test.ts` | stores the correction; refuses an entry on another event; validates against the form; creates a submission for an entry made before the form existed; splits a corrected name the way an entry is stored; refuses a blank name; leaves the name alone when none was sent; renames on an activity that asks nothing; **renames nobody when the answers are refused** |
| `event-entry-detail.routes.test.ts` | passes name and answers through; a name-only correction; 400 naming each field; 404 across events; refuses answers that are not an object |
| `EditEntryAnswersDialog.test.tsx` | opens on the stored name and answers; **shows a question nobody answered**; sends name and answers together; one name field, not two; will not save a blank name; holds the save while a required answer is missing; reports a refusal in the server's own words; reopens on what is stored, not the last edit; edits the name where the activity asks nothing |
| `EventEntryDetailsPage.test.tsx` | the Edit button opens the editor; the editor is handed the raw answers, not the summary; offered for an activity with no form; the entry is re-read once a correction is saved |

Verified against the development database: the detail carries the form id and raw values, a
correction saves and reads back, a nonsense choice is refused naming `Entrant age group`, a blank
name and a cross-event id are refused, and a refusal leaves the name untouched.
