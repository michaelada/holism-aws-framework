# Every entry says who it is for

Event entry forms now open with a name field, before the club's own questions.
It is not part of the form the club designed, and a club cannot remove it.

## Why it is built in

The name was the one thing every club was building by hand. One put "Rider
name" at the top of its entry form; the next called it "Competitor"; a third
forgot, and found out when the entry list came back as a column of account
holders' names with no way to tell one family's three entries apart.

The name is not a question *about* the entry — it **is** the entry. So it stops
being something a form designer has to remember, and clubs no longer need to put
a name field on their own forms.

## How the field behaves

Three things decide it, all answered on the server:

| Activity | Completes against | A typed name |
|---|---|---|
| Entries open to all | the club's active members | **accepted** — an entrant who is not a member of anything |
| Entries open to our members only | the club's active members | refused |
| Entries open to members (all orgs/branches) | active members of every club in the organisation type | refused |

Two further rules cut across all three:

- **No memberships, no completion.** A club that does not run memberships — or
  runs them and has no active member yet — gets a plain text box. That is the
  right answer rather than a degraded one: an autocomplete that can never
  suggest anything is a text field that also spins.
- **A member's own club is named when it is not the host.** Only federation-wide
  entries can produce this, and it is the difference between two members called
  Sarah Byrne being distinguishable and not.

"Active" means `status = 'active'` **and** `valid_until >= today`. The date
comparison is not redundant: a lapsed membership keeps `status = 'active'` until
something sweeps it, and a rally in July must not accept a card that expired in
March.

## What changed about who may be named

This is the part worth reading carefully, because it is a deliberate widening.

The members-only work answered a narrower question — *which of your own people
may enter* — and validated a chosen member against `eligibleMembers`, the
caller's own active memberships. That is right for deciding eligibility and
wrong for filling in a name, because entries are made on other people's behalf
constantly: a secretary enters half the club, a parent enters the child whose
membership is held on the other parent's login. Under the old rule every one of
those was refused.

So the search and the check are now over **the roster in scope**, not over the
caller's memberships.

### What that costs, and what still holds

Any signed-in account user of the club can see that a member exists, and can
enter them. The mitigations are deliberate rather than incidental:

- a caller must already be a connected account user of the club to reach the
  endpoint at all;
- a query shorter than two characters returns nothing, so the roster cannot
  simply be asked for;
- results are capped at twenty;
- the payload carries a name, a membership type and a membership number — no
  email, no address, no date of birth;
- the duplicate guards still refuse the same member twice, both against
  `event_entries` and against the basket.

**What did *not* change is who may reach a members-only activity.** The caller
must still hold an eligible membership themselves; a non-member still sees "you
do not hold an active membership" rather than a form. Widening who may be
*named* did not widen who may *enter*. That gate lives in the catalogue
(`unavailableReason: 'members-only'`) and is untouched.

## Where the rules live

`packages/backend/src/services/entrant.service.ts`.

Scope is derived there from the activity's `entry_eligibility` and is **never**
accepted as a parameter. A client that could name its own scope could ask an
open club event for the federation-wide roster, and the difference between "my
club's members" and "every club's members" is the whole of the members-only
feature.

`searchEntrants` and `resolveEntrant` read that scope through the same function
and share one definition of "active in scope". These two agreeing is the safety
property of the feature: if they drifted, a name could be offered in the
dropdown and then refused on submit — or, far worse, accepted when it should not
have been.

### The endpoint

```
GET /api/account/:orgCode/catalogue/activities/:activityId/entrants?q=
  → { autocomplete, allowFreeText, scope, matches[] }
```

One call answers both halves. The form needs the mode in order to render the
field at all, and needs it before anything has been typed to match against;
splitting it would mean two round trips to draw one field. The first call is
made with an empty query as the page loads, and every call after it is a search.

The client debounces at 300ms and guards responses with a cancellation flag —
answers to "Sar", "Sara" and "Sarah" can return in any order, and without it the
list can settle on the results for a prefix of what is in the box.

### The guard

`assertAddable` in `packages/backend/src/routes/account.routes.ts` is what
actually decides. The field validates as the member types and the listing hides
what cannot be entered, but neither has stopped anyone who can post to the
endpoint:

- a members-only activity requires a `memberId` that resolves in scope, and
  refuses a typed name outright;
- an open activity requires *a name*, and still validates a `memberId` if one is
  supplied — open entry means a name need not be a member, not that a member id
  goes unchecked;
- whitespace is not a name.

### What is stored

The basket line carries both on its `contextRef`:

```json
{ "activityId": "…", "eventId": "…", "entrantName": "Saoirse Byrne", "memberId": "…" }
```

At fulfilment (`fulfilment.service.ts`) the membership record wins where there
is one — it is the club's own spelling of that person's name, and letting a
typed variant override it would put "sarah byrne" on one entry list beside
"Sarah Byrne" on another. A typed name is split on the *first* space into the
`first_name` / `last_name` columns `event_entries` already keeps, so
"Mary O'Brien Kelly" keeps its compound surname whole. A single word is a whole
name: mononyms exist, and a club is entitled to enter a pony called Bluebell.

## The shared component

`EntrantNameField` lives in `packages/components` (CLAUDE.md §1.5), not in the
account app, because the same question is asked wherever an entry is created —
an org admin entering a phone booking needs exactly this field. It is
presentational: it neither fetches nor debounces, and every string arrives as a
prop, so the app that owns the API and the translations keeps owning them.

On a members-only activity it clears an unmatched value on blur. That is the
refusal happening *at the field*: without it the member fills in the whole of
the club's form and is told at the end that the name they typed is not a member,
by which point they have to find the field again.

## Consequences for existing clubs

A club whose entry form already carries a hand-built "Rider name" or
"Competitor" field will now ask for the name twice. Those fields can be removed
from the form builder — nothing depends on them — but nothing forces it, and an
existing form keeps working untouched.

## Tests

| What | Where |
|---|---|
| Scope, active-membership definition, the short-query floor, name splitting | `backend/src/services/__tests__/entrant.service.test.ts` |
| The endpoint, and the basket guard for all three eligibilities | `backend/src/routes/__tests__/account-catalogue.routes.test.ts` |
| The field's three modes, blur behaviour, cross-club labelling | `components/src/components/EntrantNameField/__tests__/EntrantNameField.test.tsx` |
| The form: preselection, searching, what is submitted | `account-shell/src/pages/__tests__/EntryFormPage.test.tsx` |

See also [MEMBERS_ONLY_ENTRIES.md](MEMBERS_ONLY_ENTRIES.md) for the eligibility
options themselves, and [ENTRANT_NAME_WIREFRAMES.md](ENTRANT_NAME_WIREFRAMES.md).
