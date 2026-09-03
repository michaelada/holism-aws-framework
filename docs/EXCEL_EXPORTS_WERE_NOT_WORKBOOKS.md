# Every Excel export produced a file no spreadsheet could open

## The report

> I clicked the Export to Excel button for event entries, downloaded the file, but when I click on it
> in Finder it says it can't open the file and that "The file format is invalid."

It was not an invalid workbook. It was **not a workbook at all** — a four-byte file containing the
text `null`.

## What was wrong

```
Error exporting entries to Excel: import_exceljs.default is not a constructor
```

`exceljs` exports a namespace with `Workbook` on it and **no default export**. All five exports in
this application did `new ExcelJS()`:

| | |
|---|---|
| `event-entry.service` | entries for an event |
| `payment.service` | the payments list |
| `registration.service` | registrations |
| `merchandise.service` | merchandise orders |
| `reporting.service` | the reports |

Every one of them threw, the endpoint answered 500, and the page — where `execute` resolves to
`null` on an error rather than throwing — wrapped that `null` in a Blob and saved it as `.xlsx`.
The download looked like it had worked. The file *was* the error.

## Why nothing caught it

Two layers of stand-in, each hiding the real module.

**A hand-written ambient declaration.** `src/types/exceljs.d.ts` declared:

```ts
declare module 'exceljs' {
  export default class Workbook { … }
}
```

This **overrides the library's own typings**, which declare `export class Workbook` and no default.
So `new ExcelJS()` type-checked, and the compiler had been told a shape the runtime does not have.
Deleted; the library's typings are correct and complete.

**A global module mapping.** `jest.config.js` mapped `^exceljs$` to a stand-in class in
`__mocks__/exceljs.js`, deliberately exported three ways:

```js
module.exports = Workbook;
module.exports.default = Workbook;
module.exports.Workbook = Workbook;
```

— which is to say, shaped so that *no* import style could fail. Nothing in the suite could notice
that the real module has no default. Four test files then mocked it a second time, locally, the same
way.

The mapping and all four local mocks are gone. `exceljs` is fast and pure; running it for real is
what lets a test assert on the bytes:

```ts
// An .xlsx is a zip archive: it starts PK\x03\x04.
expect(buffer.subarray(0, 4).toString('hex')).toBe('504b0304');
```

## The fixes

- `import { Workbook } from 'exceljs'` and `new Workbook()` in all five services.
- `Buffer.from(buffer as ArrayBuffer)` where two of them cast `writeBuffer()`'s result to `Buffer` —
  it answers exceljs's own `Buffer` interface, not Node's, and the cast compiled only because of the
  ambient declaration.
- **The page no longer saves a failure.** `EventEntriesPage` checks the response is a `Blob` before
  creating an object URL, and says *"We could not produce the export. Nothing has been downloaded."*
  when it is not. Checked by type rather than for null, so a JSON error body returned with a 200 is
  caught too. The object URL is revoked afterwards, which it never was.

Read back against the development database:

```
entries        8672 bytes  504b0304
payments       8902 bytes  504b0304
registrations  6718 bytes  504b0304
```

## Tests

`event-entry.service.test.ts` — the export is a real workbook, and so is the export of an event
nobody entered (headers alone are still a workbook; an empty file is not).
`EventEntriesPage.test.tsx` — a failed export shows the message and creates **no** object URL, and a
successful one downloads exactly the blob the server sent. `src/test/setup.ts` now stubs
`URL.createObjectURL` / `revokeObjectURL`, which jsdom does not implement — without them the click
handler throws and the failure names whatever the page did not render.

---

# Follow-up: the entries export carries the form

> The table of entries should have a column for every field in the form, and each row should
> represent one entry with all its entry form values included.

It had eight fixed columns — dates, names, email, payment — and not one of the form's. A class list
without the horse's name, the vaccination date or the emergency contact is a list of names, which is
rarely what a club exports for.

## A column per field, per sheet

The sheets were already one per activity, and that is where the columns belong: two activities of one
event may ask entirely different questions.

```
[Open class]   23 columns
  Entry Date | First Name | Last Name | Email | Quantity | Payment Status | Payment Method
  | Entrant name | Entrant date of birth | Entrant email address | Entrant mobile number
  | Entrant age group | How many years the entrant has ridden | Pony or horse name
  | Pony height in hands | Pony or horse breed | Vaccination status of the pony | Entrant grade
  | Who to call in an emergency | Emergency telephone number | Entrant medical notes
  | Happy to be called on as a first aider | Entry ID

[Spectator car pass]   12 columns
  … | Entrant name | Entrant email address | Entrant mobile number
  | Entrant dietary requirements | Entry ID
```

Three things this had to get right:

- **The columns come from the *form*, not from the answers.** `formSummariesFor` drops unanswered
  fields — right for a summary, wrong for a table, where a missing column shifts every cell after it
  and two entries stop lining up. The export reads `application_form_fields` directly, in the form's
  own order, and leaves an unanswered cell blank.
- **Answers are formatted the way the member's own screens read them**, through the shared
  `formatAnswer`: `true` is "Yes" and `['Sat','Sun']` is "Sat, Sun", not `true` and `Sat,Sun`.
- **Grouped by activity id, not name** — the same correction the entries page needed. A two-day
  event runs "80cm" on both days; merged, the sheet is a class list no class ever had, and its
  columns could belong to neither form.

## Two faults the change surfaced

**A duplicate sheet name threw.** Once activities were grouped by id, two called "80cm" produced two
sheets of that name — and `exceljs` throws on the second, so the *whole export* would have failed
rather than losing a sheet. Sheet names are now numbered (`80cm`, `80cm (2)`), re-trimmed to Excel's
31-character limit including the suffix.

**An event nobody has entered produced a workbook with no sheets**, which Excel cannot open — the
same "file format is invalid" as before, for a different reason. It now gets one sheet saying *No
entries yet*, which is a perfectly ordinary thing to export: a club checking the form before entries
open.

## Tests

Seven more in `event-entry.service.test.ts`, all reading the workbook back with `exceljs` rather than
trusting a stub: every form field gets a column, in the form's order; an unanswered question is blank
and the row still lines up; booleans and lists read as a person would write them; each activity gets
its own form's columns; two activities of one name stay apart and are numbered; an entry with no form
at all still exports.

`formatAnswer` is deliberately **not** stubbed in that suite — only `formSummariesFor` is. A stub
would let the tests agree that a boolean renders as "true".

---

# Follow-up: one name, as it was given

> The entrant's name is split into first name and last name, but it may have been typed freely as one
> name — I think it should be shown that way.

It should. The name is typed as **one string** into "Who is this entry for?", and `splitName` cuts it
at the first space purely so `event_entries` has somewhere to put it. Two columns present that split
as though the club had asked for it:

| Typed | Stored | Was shown | Now |
|---|---|---|---|
| Áine de Búrca | `Áine` / `de Búrca` | *Áine* · *de Búrca* | **Áine de Búrca** |
| Bramble | `Bramble` / `` | *Bramble* · *(blank)* | **Bramble** |

A single-word name is not a mistake — an open activity accepts one — and it arrived as a first name
with an empty column beside it.

**Rejoining is lossless.** `splitName` cuts at the first space and normalises the whitespace, so the
two halves put back together are exactly the name as it was given. The columns stay in the database:
plenty reads them, and the export is a presentation.

```
Entry Date | Name            | Email                        | Quantity | Payment Status
2026-09-01 | Rónán O'Toole   | darragh.otoole@example.test  | 1        | paid
2026-08-26 | Bríd McNamara   | brid.mcnamara@example.test   | 1        | paid
```

The **entry details page** showed the same invented split as two fields, and now shows one. The
entries list already joined them.

## Tests

`event-entry.service.test.ts` — the header is `Name`, a two-word surname survives, and a one-word
name leaves no gap. `EventEntryDetailsPage.test.tsx` — one Name field, and no First/Last.

---

# Follow-up: the columns in the order a club reads them

> Move Email and Payment Method to the rightmost part of the table. Rename Payment Status to just
> Status and move it to the rightmost column. Remove Quantity. Add a new column called **Entered By**
> with the name of the account holder that made the entry.

```
Entry Date | Name | ‹the form's own questions…› | Email | Payment Method | Entered By | Entry ID | Status
```

What the sheet is *about* on the left, the administration on the right. A club reading a class list
wants the date, the name and the answers to its own questions; the email and how it was paid are
looked up rather than scanned, and were sitting between the name and the first thing the club
actually asked for.

- **Status**, not "Payment Status": a longer word for the same column of paid/pending, and it is the
  one most often sorted on, so it is last.
- **Quantity is gone.** One on every entry, which said nothing. The summary row's "Total Quantity"
  went with it; the count of entries remains.
- **Entered By** is `event_entries.user_id` → the account holder's name, joined in
  `getEntriesByEvent`. **Not the entrant**: a parent enters three children, a secretary enters half
  the club. The `Email` column beside it is that same person's — it is where the club writes about
  the entry — so the two belong together. Blank where the login has since been removed; the entry
  happened either way.

Read back from the development database:

```
[Spectator car pass]  10 columns

Entry Date | Name          | Entrant email address      | Entrant mobile number | Entrant dietary requirements | Email                      | Payment Method | Entered By    | Entry ID  | Status
2026-08-24 | Maeve Kiernan | maeve.kiernan@example.test | +353 87 000 0000      |                              | maeve.kiernan@example.test | offline        | Maeve Kiernan | 8869c41a… | pending
```

## Tests

Four more in `event-entry.service.test.ts`: the account holder is named and is not the entrant; the
column is blank where the login is gone; the sheet ends with `Status` under that name; and there is
no Quantity column. The tests that assert on the tail find it **by column name** rather than by
index — it sits after however many questions the club's form asks.
