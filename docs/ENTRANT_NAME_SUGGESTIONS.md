# The entry form offers the names you have used before

## The ask

> When entering an event, underneath the autocomplete list show existing membership names and the
> last 5 names used for entries, that the user can click to auto-populate the Name field.

A parent who enters three children every fortnight was typing all three, every time. On a
members-only activity typing is not even an answer — the field refuses a name it cannot match — so
the work was: type enough to search, wait, pick, repeat.

## What is offered

Two lists under the field, not one. They answer different questions and a merged list would have to
decide which a name was:

| | What it is | Where it comes from |
|---|---|---|
| *(no heading)* | The memberships — who this account *may* enter, mostly a parent's children | `activeMembershipsFor` / `activeMembershipsAcrossType`, the same source the catalogue uses |
| **Used before** | Who it *has* entered, most recent first, five of them | `event_entries` for this account in this club |

**Only the second row is headed.** The memberships had a "Your memberships" heading and it was
removed: the hint above already says what to do with every name below it, these are simply the names
on the account, and each chip carries its membership type — a heading there was a label on the
obvious, and a second one between two short rows made them read as two separate mechanisms. "Used
before" keeps its heading because it says something the names cannot: that they were typed on a
previous entry rather than held as a membership.

**The screen says they can be clicked** — "Select a name to fill it in.", once, above both rows. A
row of chips under a form field reads as labels until something says otherwise — a membership type,
a category, something the form is telling you — and a member who reads them that way retypes the
name that was sitting right there, which is the whole thing this exists to save. Said once rather
than on each heading: it is one instruction covering everything below it, and repeating it makes two
short lists look like two separate mechanisms.

Clicking a chip fills the field. A membership chip carries its `memberId`, so it **selects the
membership** rather than only typing the name — which matters on a members-only activity, where a
suggestion that merely filled the box would look like it had worked and then fail on submit.

Three decisions worth stating:

- **Scoped the way the activity is.** An activity open to the whole federation suggests memberships
  held anywhere in it; one open to the club suggests only the club's. Suggesting a name the activity
  would then refuse is worse than suggesting nothing.
- **Recent names are per club.** `event_entries.user_id` is the account's row in *this*
  organisation, which is the right scope anyway — who somebody enters at their own club is not much
  of a guide to who they enter at another.
- **A name already offered as a membership is dropped from "used before".** The lists sit one above
  the other, and the same name twice reads as two different people.

`EntrantSuggestion.memberId` is null for a name that was only ever typed. Those are still offered —
often they are the one the member wants, and a friend with no login is exactly the case free-text
entry exists for.

## Its own endpoint

`GET /api/account/:orgCode/catalogue/activities/:activityId/entrant-suggestions`.

Deliberately not more of the `/entrants` response. That one is called on **every keystroke** — it is
the search — and neither of these lists changes as the member types; folding them in would re-send a
fixed answer per character. It is also not needed to draw the field, which is the reason `/entrants`
answers mode and matches together. This one arrives when it arrives and the form fills in, and a
failure is quiet: a form that can be completed by typing must not be blocked by a convenience that
did not load.

## Where the code lives

`EntrantNameField` is in `packages/components`, because the same question is asked wherever an entry
is created — an org admin taking a phone booking needs this field too (CLAUDE.md §1.5). It stays
presentational: it neither fetches nor debounces, and every string arrives as a prop. The suggestion
rows render under the autocomplete *and* under the plain text box, since a club with no roster still
has the names this account entered last time — and those are the ones most worth a click when there
is nothing to complete against.

## Tests

- `EntrantNameField.suggestions.test.tsx` (10) — both headings render; a membership click returns
  its `memberId`; a typed name returns `memberId: null`; offered on a plain box too; nothing
  rendered when both lists are empty or the prop is absent. And the hint: shown when there is
  anything to pick, exactly once however many lists there are, absent when there is nothing to pick,
  and omitted entirely when the caller supplies no wording for it.
- `entrant.suggestions.test.ts` (7) — memberships carry their type, or the club when it is another
  one; scope follows the activity; recent names come back most-recent-first with ids preserved; the
  query asks for five and only this account's entries; a name already offered as a membership is not
  repeated; another club's activity is refused.
