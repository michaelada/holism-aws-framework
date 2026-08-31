# Twenty-four org-admin routes served other clubs' data

## How it surfaced

Looking at the demo seed, the same seven forms and forty fields appeared under
Kildare, Laois and Meath, and the obvious question was whether the seed had
built one shared set.

It had not. `scripts/seed/database.ts` loops `for (const org of ORGS)` and
writes a **separate** row per organisation — 4 × 40 fields and 4 × 7 forms, each
with its own `organisation_id` and its own uuid, and every downstream reference
(`formIds[event.org]`, `formIds[member.org]`, `formIds[type.org]`,
`formIds[item.org]`) takes the form belonging to that club. Same names, four
independent sets.

The duplication on screen came from the API. Pulling that thread found three
faults in the forms routes and, behind them, the same fault on twenty-one more.

## Fault 1 — the fields list ran unfiltered

`GET /api/orgadmin/application-fields` called `getAllApplicationFields()` with
no argument, and the service's organisation filter was optional:

```ts
let query = 'SELECT * FROM application_fields';
if (organisationId) {
  query += ' WHERE organisation_id = $1';   // never reached
}
```

`byCurrentOrganisation()` was on the route and set `req.organisationId`. The
handler simply never read it.

Two pages call this endpoint — `FieldsListPage` and the form builder's field
picker, `FormBuilderPage`. Against the seed a Kildare administrator's Fields
list showed all 160 fields, each of the 40 names four times over, and the
builder offered Laois's and Meath's fields as choices when composing a form.
That was the visible symptom.

**Fixed by making the service parameter required**, not only by passing it at
the route. It was the optionality that made the leak possible: a filter that can
be left off eventually is. `getAllApplicationFields('')` now throws.

## Fault 2 — twenty-three routes trusted the path

```
GET /api/orgadmin/organisations/:organisationId/...
```

The routers are mounted twice, bare and scoped, with no parent guard —
`index.ts` states that "every route establishes and verifies its organisation
for itself". Twenty-three did not. They carried `authenticateToken()`, then read
`req.params.organisationId` and served it. Any signed-in org administrator could
read another club's data by putting that club's id in the URL:

| Router | Routes |
|---|---|
| `application-form` | application-forms, form-submissions |
| `discount` | discounts |
| `membership` | membership-types, **members** |
| `merchandise` | merchandise-types, merchandise-orders, orders export |
| `calendar` | calendars, bookings |
| `registration` | registration-types, registrations, **`POST` registrations**, registrations export, registrations filters |
| `ticketing` | ticketed-events |
| `payment` | **payments, payments export** |
| `reporting` | dashboard, events, members, revenue, export |

Members, payments, submitted form answers, and one route that **writes** a
registration into a club the caller has nothing to do with.

The org-admin app never did this — every call passes the organisation from
`OrganisationContext`, which is the caller's own. Nothing stopped a hand-made
request.

**Fixed with `byParam('organisationId')` on each**, placed after
`authenticateToken()` and before anything else, so a refused request is turned
away before a capability lookup and — on the reporting routes — before `audited`
records a report view that never happened.

### Why the capability middleware was not already stopping this

Fifteen of the twenty-three did carry a guard, which is why the omission read as
deliberate: `requireMembershipsCapability`, `requireMerchandiseCapability`,
`requireCalendarBookingsCapability`, `requireRegistrationsCapability`,
`requireEventTicketingCapability`. Each is a local function in its own router,
and each asks the same question:

```ts
const organisationId = req.params.organisationId || req.body.organisationId;
const result = await db.query(
  `SELECT enabled_capabilities FROM organizations WHERE id = $1`, [organisationId]
);
```

Whether **that organisation** has the capability enabled. Never whether **the
caller** administers it. None of the five so much as reads `req.user`. A club
with memberships turned on was readable by any administrator of any other club.

These are left in place — they still do the job they are named for. `byParam`
now supplies the question they were never asking.

## Why the structural test did not catch any of it

`src/routes/__tests__/orgadmin-routes-are-scoped.test.ts` enumerates every
org-admin route and fails on any guarded by authentication alone. It passed on
all twenty-three, because of one clause:

```ts
route.path.includes(':organisationId') ||
```

A path that *names* an organisation was treated as a path that *verifies* one.
It does not. Naming a club in the URL is the claim being made, and the id comes
from the caller; the guard is what checks the caller may make it. The exemption
excused precisely the routes that most needed checking.

**The clause is now gone**, which is the part of this change that stops it
happening again. Removing a guard from any of these routes fails the test by
name.

## Tests

| File | Covers |
|---|---|
| `src/__tests__/routes/application-form.routes.scoping.test.ts` (new) | Mounts the router as `index.ts` does — bare, then scoped — and runs the **real** `organisation-scope.middleware` against a stubbed database, so it asserts the refusal itself rather than the presence of a middleware in a list. Ten cases: the fields list scoped on both mounts, a foreign club in the `x-organisation-id` header refused, and each path route serving its own club while refusing another's id and a malformed one — checking each time that the service was never reached |
| `src/services/__tests__/application-form.service.test.ts` | `getAllApplicationFields` filters, never issues an unfiltered query, and refuses to run with no organisation |
| `src/routes/__tests__/reporting-export.routes.test.ts` | Updated: it drove the export route with `org-1` and no database, which the new guard reads as "not yours". Now stubs the membership lookup, and gained a case asserting another club's export is refused — an export being the bulk read that matters most |
| `src/routes/__tests__/orgadmin-routes-are-scoped.test.ts` | The exemption clause removed; the two existing cases now hold all 195 routes to a real guard |

Seven of these fail against the unfixed sources, one per fault. Removing a
single `byParam` and re-running names the route it was removed from.
