# An entrant is named once

## The ask

> The person who is entered in an event is always the person whose name is selected or typed into the
> "Who is this entry for?" box. Entry forms should not need an additional field, e.g. called Entrant
> name or Rider name, in the form definition, as the name is already captured. Update all the seed
> data to reflect this.

## Why there were two

They come from different places and nothing reconciles them.

**First name / Last name** are columns on the entry (`event_entries`). `fulfilment.service` writes
them from the first of these it can find:

1. **the membership** named in the basket line — the club's own spelling wins where the entrant was
   chosen from the member list;
2. **the name typed** into "Who is this entry for?", for an open activity entered for somebody who is
   no member;
3. **the account holder**, if neither.

**"Entrant name"** was a *field on the club's form* — `rider_name`, relabelled per club (Kildare
"Rider name", Laois "Competitor name", Ward Union "Member name", Meath "Entrant name") — answered as
free text and stored in `form_submissions.submission_data`.

So an entry could hold two different names for one person: pick a child from the member list, type
something else into the form, and the entry says one thing and its answers another. Nothing warns,
and both are stored. It showed up as two name columns on the entries export sitting side by side.

## What changed

The field is off the four forms an event activity uses:

| Form | Was | Now |
|---|---|---|
| `fullEntry` | 15 fields | 14 |
| `campBooking` | 9 | 8 |
| `shortEntry` | 2 | **1** — the pony's name and nothing else |
| `spectator` | 4 | 3 |

`entrySubmission` in the seed writer no longer answers `rider_name` either: with the field off the
form, an answer would be an orphan key in `submission_data` that nothing displays.

**The membership and registration forms still ask, and should.** A membership takes its name from the
**account holder** (`createMembership` reads `organization_users`), so a household naming each person
on a family membership has nowhere else to say it. Removing the field there would lose the
information rather than de-duplicate it. `riderName` therefore stays in `FIELDS`.

`spectator` keeps its **email**: the entry's email is the account holder's — where the club writes —
and a spectator's own address is a different answer.

Read back after seeding:

```
Meath Hunt full entry            asks name: no    14 fields
Meath Hunt short entry           asks name: no     1 field
Meath Hunt spectator list        asks name: no     3 fields
Tara camp booking                asks name: no     8 fields
Meath Hunt membership application asks name: yes   13 fields
Meath Hunt family application     asks name: yes   10 fields
```

And the export that prompted the question:

```
[Open class]  22 columns
  Entry Date | First Name | Last Name | Email | Quantity | Payment Status | Payment Method
  | Entrant date of birth | Entrant email address | … | Entry ID
```

## In an existing development database

The same links were deleted there, by form rather than by attachment — the seed changes those forms
by definition, so a form no activity happens to point at today should match too. Sixteen rows across
four clubs. Existing submissions keep their `rider_name` key; nothing reads it, because the export
and the entry detail both read the **form's** fields.

## Tests

`scripts/seed/__tests__/dataset.test.ts` — four: no form an activity uses asks for the entrant's
name; the membership forms still do; the field itself survives, because those forms use it; and every
entry form still has something to ask, since a form with no fields is a step in the journey that
shows nothing.

---

# The same for a membership application

> When a user fills out a Membership Type application form, implement the same solution used for
> event entries — the special name field offering names already used, autocompleting as they type,
> or accepting free text — and remove the need for a name field in the application form.

## The membership had it worse

An entry at least *stored* the form's answer somewhere a club could read. A membership did not:
`createMembership` took the name from the **account holder** and nothing else, so a parent joining
three children produced three member records all reading "Aoife Byrne". The club's "Member name"
field was answered, filed, and never looked at again.

## "Who is this membership for?"

The same `EntrantNameField`, above the club's own questions, with this account's own names beneath
it:

```
Who is this membership for?
[ Rónán McGrath                                   ]
The person this membership is for. Type a name, or pick one you have used before.

  [Éabha McGrath · Family Membership]  [Conor McGrath · Family Membership]
  [Áine McGrath · Senior Member]
  Used before
  [Bríd McNamara]
```

The name travels on the basket line — `contextRef: { membershipTypeId, memberName }` — and
`createMembership` uses it, falling back to the account holder for a line raised before this existed.
Read through `parseContextRef`, like every other reader in that file: the column comes back as a
string under some drivers and an object under others.

## One deliberate difference: no roster search

An entry searches the **club's whole roster**, because a members-only activity has to resolve the
name to a real membership and entries are made on other people's behalf all the time.

An application resolves to nothing — it *creates* the membership, for whoever the account names. So
there is no search: the field is a plain box with this account's own names offered under it.
Searching the roster here would offer other families' names to somebody who has no business with
them and could not use them anyway.

`GET /catalogue/membership-types/:typeId/applicant-suggestions` returns two lists:

| | |
|---|---|
| **memberships** | everyone this account already holds a membership for at this club — *whatever its state*, because the common case is a household renewing the same three children and hiding a lapsed one hides exactly the name they are about to type |
| **recent** | the names it has used on entries, deduplicated against the first list |

No `memberId` travels with either. On an entry the id proves eligibility; here it would read as
"renew this one", which is a different journey with its own route (`?renew=`). This list fills the
name in and nothing more.

The type is checked against the club before anything is read — these are the caller's own names, but
the URL should not be a way to ask a club they have nothing to do with.

## The field is gone from the library entirely

`riderName` is now used by no form, and has been removed from `FIELDS` rather than left sitting in
every club's field library — where it is an invitation to put the question back on a form and get a
second name that nothing reconciles with the first. The seed writer no longer answers `rider_name`
for memberships either.

**Registrations keep asking**, and should: a registration is about a *horse*, and there is no "who is
this for" box for an animal, so `entity_name` stays on the form.

Applied to the development database too — eight more links, leaving the membership application at 12
fields and the family form at 9.

## Tests

| Suite | Covers |
|---|---|
| `entrant.suggestions.test.ts` | the two lists, a lapsed membership still offered, no `memberId` carried, deduplication, another club's type refused, and — as a property — that **every** query naming `members` is filtered by the caller's own id |
| `fulfilment.service.test.ts` | the membership created in the name the application gave, a context recorded as a string, and the fallback to the account holder |
| `EntryFormPage.test.tsx` | the field appears on an application, the button is held until it is named, the message once the field is left, the name on the basket line, a suggestion filling it in, and that it asks the **membership** endpoint and never the entrants one |
| `dataset.test.ts` | no form asks the name, the library has no name field at all, and the registration form still names the horse |
