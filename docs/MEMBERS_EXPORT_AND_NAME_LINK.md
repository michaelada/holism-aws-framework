# Exporting the member database, and opening a member by name

> *"On the Members Database page I clicked on the Export To Excel button and nothing happened."*
>
> *"Can you make the person's name clickable so that the user can drill into that member account
> without having to scroll right."*

---

## 1. Why nothing happened

The button was a stub:

```ts
const handleExport = async () => {
  try {
    // Export logic would go here
    console.log('Exporting members...');
  } catch (error) {
    console.error('Failed to export members:', error);
  }
};
```

No request, no file, no message — and a `catch` around nothing, which makes it read as finished.
There was no `/members/export` endpoint behind it either, so this is a feature that was drawn and
never built rather than one that broke.

It is the same shape as the ticket dialog's *Download PDF* and *Mark as Scanned*
([TICKET_ACTIONS_THAT_DID_NOTHING.md](TICKET_ACTIONS_THAT_DID_NOTHING.md)) and the four report
export buttons ([REPORTING_EXPORT.md](REPORTING_EXPORT.md)): a control that announces a capability
the product does not have. The locale key for the failure — `memberships.failedToExport` — was
already there in all six languages, waiting for an error the stub could never raise.

## 2. It exports what is on screen

**The member list is filtered entirely in the browser.** The status tabs, the search box and the
saved custom filters are all applied in `filterMembers()` over the members already loaded; there is
no server-side query that reproduces them.

That is the decision this feature turns on. Two options:

| | |
|---|---|
| Re-derive the filters on the server | A second implementation of every filter rule. This codebase already carries two of those — slot availability and booking cancellation — and both summaries warn that changing one rule means changing both. A third would be a choice, not an inheritance |
| **Send the ids the screen is showing** | The workbook is the table, by construction. No rule is written twice, so none can drift |

So `POST /organisations/:organisationId/members/export` takes `{ memberIds }` and builds the
workbook from exactly those.

**A POST, though it reads.** A club with two thousand members would put 72KB of ids in a query
string, which is past what a URL may carry.

**The ids are not trusted.** `organisation_id = $1` is in the statement alongside
`id = ANY($2::uuid[])`, so an id belonging to another club selects nothing. The caller's right to
this organisation is established by `byParam('organisationId')` before the handler runs; this is the
second lock. Ids that are not UUIDs are refused at the route rather than left for Postgres to reject
while casting.

**A body that named ids and had none survive is a 400**, not an export of everything. Falling
through to "the whole organisation" would hand somebody the entire database when they asked for a
filtered slice of it — the opposite of what they pressed.

Sending no ids at all *does* export the whole organisation, which is what an unfiltered screen is
showing anyway.

## 3. The workbook: one sheet per membership type

Built by the server with `exceljs`, and **split by membership type**, each sheet carrying a column
for every field of that type's membership form and a row per member with what they answered.

### 3.1 Why it is not one table

A club exporting its roster is nearly always after the answers — the dietary requirement, the
emergency contact, the boat class. The first version of this export carried twelve fixed columns and
none of them.

Once the answers are in, the columns belong to the **form**, and two membership types may ask
entirely different questions. A single flat table could only hold the union of every form's fields,
which gives every Adult member a row of blanks under *Number of children* and every Family member a
blank under *Boat class* — a table where most cells are empty by construction, and where no column
means the same thing on every row.

So the workbook splits, on exactly the principle the entries export already uses
(`eventEntryService.exportEntriesToExcel`, one sheet per activity). Two features doing the same job
two different ways is how a product stops being one product.

### 3.2 Per type, not per form

Two membership types that happen to share a form still get a sheet each.

A **membership type** is the thing a club recognises, filters by and sets a fee against. A sheet
named after a *form* would carry a name most administrators have never seen, and merging Adult with
Family because they happen to ask the same questions produces a table that is neither of them. The
grouping is by type **id** rather than name, because two types can share a name across a rename and
the columns come from the form.

### 3.3 The columns

```
Membership Number · Name · First Name · Last Name ·
   ‹every field of this type's form, in the form's own order› ·
Date Last Renewed · Status · Valid Until · Labels · Processed ·
Payment Status · Payment Method
```

What the sheet is *about* on the left, the administration on the right — the order the entries
export settled on. A club reading a roster wants the number, the name and the answers to its own
questions; payment status and method are there to be looked up rather than scanned.

**A question nobody answered still has a column.** The club asked it, and a missing column reads as
a question never put. Answers are formatted with `formatAnswer` — the same helper the member's own
screens use — so a "Yes" in the workbook and a "Yes" on screen mean the same thing rather than
being `true` in one place and `"Yes"` in the other.

**Membership Type is no longer a column**, because it is now the sheet.

### 3.4 The details that would otherwise bite

- **Sheet names.** Excel caps them at 31 characters and forbids `: \ / ? * [ ]`. Two types can
  share a name, and exceljs *throws* on a duplicate — losing the whole export rather than one sheet
  — so they are numbered and re-trimmed.
- **An empty result still opens.** A workbook with no sheets cannot be opened at all, so a filter
  matching nothing produces one sheet saying so.
- **Three queries, whatever the roster size**: the members, the form fields per type, the
  submissions. Not one lookup per member.

### 3.5 Dates are written as text, and that is deliberate

`date_last_renewed` and `valid_until` are Postgres **`date`** columns. node-postgres hands a `date`
back as a JS Date at **local midnight**, so a renewal on 12 July in Ireland arrives as
`2026-07-11T23:00:00.000Z`. Written into a cell as a Date, exceljs keeps that instant and Excel
displays **11 July**.

That would put every renewal and expiry in the workbook a day early through the summer — and
correct through the winter, which is the worst kind of wrong, because it looks fine when somebody
checks it in January. Verified before fixing, not assumed:

```
the club means      : 2026-07-12
node-postgres gives : 2026-07-11T23:00:00.000Z
excel would display : 2026-07-11        => OFF BY ONE
```

They are written as `yyyy-mm-dd` strings built from the **local** date parts, which cannot shift and
still sort chronologically as text. It is the rule the audit viewer already follows: render a
date-only value without an invented midnight.

Checked end to end against the seeded club — 11 members, every date in the file identical to the
database.

`saveBlob` — the anchor-and-revoke dance, written once for the report exports — moved to
`orgadmin-core`'s public surface rather than being written a second time (CLAUDE.md §1.5). The
second implementation is always the one that forgets to revoke the object URL.

**A failure is now visible.** `execute` answers `null` on error unless told to throw, which is
exactly how this class of bug stays invisible; the call passes `throwOnError`, the page shows an
alert, and it prefers the server's own words over axios's *"Request failed with status code 400"*.
The button is disabled while an export is running and when the filters have emptied the table.

## 4. The name opens the member

The members table is wide enough to scroll, and its View button is **pinned to the right**
(`position: sticky`), so reaching it meant dragging the row sideways first — past the name the
administrator was already looking at and already pointing at.

The name is now a `Link` that opens the member. **The View button stays**: this is a second way in,
not a replacement, and an administrator who has learned the icon column should not have to relearn
it. Same treatment as the ticketing list
([TICKET_ACTIONS_THAT_DID_NOTHING.md](TICKET_ACTIONS_THAT_DID_NOTHING.md) §4).

**The phone's card layout is deliberately untouched.** It carries the three row actions spelled out
in words rather than as icons, it does not scroll horizontally, and the name is already the heading
of the card. There is nothing there to fix.

## 5. What it touches

| | |
|---|---|
| The workbook, split by type | `membership.service.exportMembersToExcel`, with `formFieldsByMembershipType` and `membershipSubmissions` |
| The endpoint | `membership.routes` — `POST /organisations/:organisationId/members/export` |
| The button, the link, the error | `orgadmin-memberships` → `MembersDatabasePage` |
| The download helper, now shared | `orgadmin-core` re-exports `saveBlob` from `reporting/exportReport` |
| Locale | `memberships.failedToExport` — already present in all six, previously unreachable |
