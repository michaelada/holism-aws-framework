# Event scheduling — task breakdown for S0 and S1

The third artefact, after
[EVENT_SCHEDULING_AND_SCORING_PROPOSAL.md](EVENT_SCHEDULING_AND_SCORING_PROPOSAL.md) (design) and
[EVENT_SCHEDULING_AND_SCORING_WIREFRAMES.md](EVENT_SCHEDULING_AND_SCORING_WIREFRAMES.md) (how it
looks). CLAUDE.md §1.3.

**Scope: S0 and S1 only.** S0 is the spine and shows a club nothing. S1 makes a one-day, one-phase
event schedulable. S2 (multi-phase, multi-day, entities, breaks) and S3 (publishing, Excel, print)
are sketched at the end so the seams are built for them, not so they are built now.

---

## 0. Decisions this is built on

Settled, and not to be relitigated inside a task:

| | |
|---|---|
| **Default shapes; settings overridable** | Shape is the platform's. A different shape is a **new template**, never a per-club edit |
| **A slot holds participants**, plural | S1 writes exactly one per slot. The column and table exist from the first migration |
| **A resource has sessions** | Date, opens-at, closes-at. S1 writes one per resource |
| **Individual scores are always recorded** | Not S0/S1, but the schema must not preclude it |
| **Local wall-clock time, never an instant** | A slot is a **date** plus a **local time**. The members export was bitten by a `date` at local midnight; a running order is the worst place to repeat it |

---

## S0 — the spine

Nothing user-visible. Done when a super admin can define a template, a club inherits its settings,
and an override resolves correctly.

### S0-1 · Migration: templates and the settings chain ✅ **done**

`packages/backend/migrations/1709000000046_event-type-templates.js`, with
`src/__tests__/migrations/event-type-templates-migration.test.ts` (14 tests).

**One deviation from the plan below, deliberately.** The override table was specified with a `scope`
word and an untyped `scope_id`; it was built with **two nullable foreign keys** and a check that
exactly one is set. A polymorphic id has no referential integrity, so an organisation type deleted
tomorrow would leave override rows pointing at nothing and no constraint would notice. Two real keys
let the database cascade, and let a reader see what a row refers to without consulting a string.

```
event_type_templates
  id · key (unique) · display_name · description
  capability            varchar   -- which capability reveals it
  scheduler_kind        varchar   -- 'sequential-phases'
  shape                 jsonb     -- phases, order, resource kinds, entity
  default_settings      jsonb     -- the settings this template defaults
  status                varchar   -- draft | published
  timestamps

event_type_setting_overrides
  id
  template_id           uuid → event_type_templates      ON DELETE CASCADE
  organization_type_id  uuid null → organization_types   ON DELETE CASCADE   -- as built
  organisation_id       uuid null → organizations        ON DELETE CASCADE   -- as built
  settings              jsonb     -- ONLY what differs at this level
  locked_keys           jsonb     -- type level only, enforced by a check
  timestamps
  check  num_nonnulls(organization_type_id, organisation_id) = 1
  check  organization_type_id IS NOT NULL OR locked_keys = '[]'
  unique (template_id, organization_type_id) where organization_type_id is not null
  unique (template_id, organisation_id)      where organisation_id is not null

event_types
  + template_id         uuid null → event_type_templates
```

**Acceptance — all met**

- ✅ `event_types.template_id` is **nullable**; all 24 existing rows keep working untouched, and
  retiring a template sets it null rather than deleting a club's event type — which matters because
  `events.event_type_id` references that row.
- ✅ The override table stores *only differences*; a level that changes nothing has no row.
- ✅ `locked_keys` is enforced at the organisation-type level by a **check constraint**, not a
  convention: a club cannot lock a setting against itself.
- ✅ Applied to dev **and** the test database.
- ✅ **`down` verified by running it** — the tables and the column go, the 24 event types remain. A
  migration whose reverse has never been run is found to be broken at the worst moment.

**Two things the next task needs to know:**

- Uniqueness is **two partial indexes**, not one constraint across three columns. In Postgres a NULL
  never equals a NULL, so the obvious unique constraint would happily accept two overrides for the
  same template and organisation. There is a test for exactly that.
- The **test database is schema only** — organisations and organisation types exist from the
  migrations, and there are **no `event_types` at all**. A fixture read from seed data passes on a
  developer's machine and fails in CI; build what you need inside the transaction.

### S0-2 · Migration: the capabilities ✅ **done**

`1709000000047_scheduling-capabilities.js`, with
`src/__tests__/migrations/scheduling-capabilities-migration.test.ts` (4 tests).

- ✅ `event-scheduling` — *may this club build a running order at all?* Gates the module, its routes
  and its menu.
- ✅ `equestrian-disciplines` — *which templates may this club see?* Read against
  `event_type_templates.capability`. Kept separate deliberately: one capability would mean every club
  that can schedule is offered every discipline the platform has ever defined.
- ✅ Both `additional-feature` and inactive for everyone until granted. Nothing is gated yet, because
  the module does not exist — the rows exist so that granting is *possible*.
- ✅ Rows in `capabilities` first, so `1709000000027_strip-unknown-capabilities` cannot silently
  delete a grant.

**`down` cleans three places, not one.** The plan said `capabilities` and every organisation's
`enabled_capabilities`. A capability name is also written into `organization_types.default_capabilities`
**and** `organization_admin_roles.capability_permissions` — and a role still naming a deleted
capability is the exact fault behind *"the club has the capability and the menu item is missing"*
recorded in the announcements module summary. All three are cleaned, and the reverse was **run
against real grants in all three** to prove nothing is stranded.

Note `capability_permissions` is a jsonb **object** (`{"venues": "admin", …}`), not an array. The
`?` and `-` operators behave identically on both, which is why the same SQL serves all three
columns — checked rather than assumed.

### S0-3 · Settings resolution ✅ **done**

`packages/backend/src/services/event-type-template.service.ts`, with 13 unit tests and 5
integration tests (`src/__tests__/integration/event-type-settings-chain.test.ts`).

**Settings are a flat map of dotted keys** — `minutesPerCompetitor.dressage`, never
`{ minutesPerCompetitor: { dressage: 8 } }`. This was not written down before and everything rests
on it: each setting a club can see needs **its own source** and **its own lock**, and a nested object
cannot carry either without inventing a path language to name its leaves. Flat keys make merging
shallow, sources exact, and locks meaningful, and cost nothing but a dot.

The one piece of logic in S0, and the one most likely to be reimplemented by accident later:

```ts
resolveSettings(templateId, organisationId): Promise<{
  settings: Record<string, unknown>;
  sources: Record<string, 'template' | 'organisation-type' | 'organisation'>;
  locked: string[];
}>
```

**Acceptance — all met**

- ✅ Last wins: template → organisation type → organisation.
- ✅ `sources` names where **each key** came from.
- ✅ A locked key resolves to the type's value — or the **template's**, where the type locked it
  without setting one, which means "nobody below may change this" rather than "this has no value" —
  and the club's row for it is **ignored rather than refused**. Refusing belongs at the route, where
  there is somebody to tell; here the answer merely has to be right, including for a row written
  before the lock existed.
- ✅ Raising a platform default reaches a club that has its own override row but does not name that
  key. Tested explicitly.
- ✅ **One query for the whole chain**, not one per level — both overrides are found by joining
  through the organisation's own type. A club with forty settings costs the same round trip as a club
  with one.

**The unit tests mock the pool, so they cannot prove the query.** That gap is closed by an
integration suite running the real SQL against the test database, because the join is where the
**isolation** lives: a club must not receive another type's rules, nor another club's. Verified both
ways round, plus that a non-existent organisation resolves to nothing — which is what makes the
service's `NotFoundError` correct rather than incidental.

Also defensive about a jsonb column holding an array or a string: an unusable value is treated as no
override rather than taking the resolution down.

### S0-4 · CRUD and routes ✅ **done**

`packages/backend/src/routes/event-type-template.routes.ts` (super admin, mounted at
`/api/admin/event-type-templates`) plus three routes appended to
`orgadmin-organisation.routes.ts` for the club's own half. 22 service unit tests, 25 route tests and
12 integration tests.

| Method | Path | Who |
|---|---|---|
| `GET` | `/api/admin/event-type-templates` | super admin |
| `GET` `POST` | `/api/admin/event-type-templates`, `/:id` | super admin |
| `PUT` | `/api/admin/event-type-templates/:id` | super admin |
| `GET` `PUT` | `/api/admin/event-type-templates/:id/rules/organisation-type/:organizationTypeId` | super admin |
| `GET` | `/api/orgadmin/organisation/event-templates` | org admin |
| `GET` `PUT` | `/api/orgadmin/organisation/event-rules/:templateId` | org admin |

**Three paths differ from the plan, deliberately.**

The organisation-type rules hang off the **template** rather than off
`/api/admin/organisation-types/:id`, so the whole feature sits in one router under one mount instead
of being split across an unrelated one. (Note also that the existing super-admin mount is
`organization-types`, with a z — the American spelling that column names use.)

The org-admin read is `/api/orgadmin/organisation/event-templates`, not
`/api/orgadmin/event-type-templates`. Everything under `/api/orgadmin/organisation/` is served by
`orgadmin-organisation.routes.ts`, which resolves the club from the token and the
`X-Organisation-Id` header and is already listed in `useApi`'s `UNSCOPED_ORGADMIN_PATHS`. Putting
these three anywhere else would have needed a new bare mount and a fourth entry in that list, for no
gain — and the Settings screen these serve (S0-6) reaches every other tab the same way.

**Acceptance — all met**

- ✅ **The list is the gate.** `listTemplatesForOrganisation` is one `WHERE` clause checking *two*
  capabilities — `event-scheduling` for the module and the template's own for the discipline — and
  the read and the write both go through it, so they cannot come to disagree. A club holding
  `equestrian-disciplines` without the module sees nothing.
- ✅ A template the club may not use is a **404, not a 403**: the error must not confirm that a
  discipline it has not been granted exists.
- ✅ OpenAPI annotations on every route. Note the tag is `@swagger` in the new admin router and
  `@openapi` in the org-admin one — swagger-jsdoc treats them as synonyms, and each file matches its
  neighbours rather than the other file.
- ✅ A **locked** key is refused with a 403 **naming every key refused**, not merely the first, and
  nothing is written. Accepting the write and quietly discarding the key would show the club its old
  value back with no way to tell a federation's rule from a bug.
- ✅ `audited()` on all three writes, with `event-template.updated` (platform) and
  `event-rules.updated` (settings) in the registry, `auditLabels.ts` and **all six locales**.

**Two decisions the plan did not cover.**

An empty `settings` object is **"reset to template"** and deletes the club's row rather than storing
`{}` — an absent row is the honest record of a club that overrides nothing.

Locking a key that exists at *neither* the template nor the type is refused with a 400. It is a
typo, and one that would otherwise sit in the database forbidding a setting nobody has, surfacing
much later as a club unable to change something for no visible reason. Locking a key the type has
not *set* is still allowed — that means "the template's value, and no club may move it".

**What the mocked tests could not prove, and how that was closed.** Three things here are SQL, and a
mocked pool exercises none of them:

- The capability gate is a `WHERE` clause →
  `src/__tests__/integration/event-template-visibility.test.ts`, which imports
  `TEMPLATES_FOR_ORGANISATION_SQL` **from the service** rather than copying it, so the test cannot
  drift from what ships.
- The two upserts use `ON CONFLICT ... WHERE` against **partial** indexes, which fails at run time
  and never at compile time → `src/__tests__/integration/event-template-overrides.test.ts`, likewise
  importing the statements it runs.
- The migration's two check constraints — a club cannot lock a setting against itself, and a row
  belongs to exactly one level → asserted in the same suite, each violation inside a `SAVEPOINT`,
  because the first one aborts the transaction and the second would otherwise report "current
  transaction is aborted" while appearing to pass.

Finally, the whole chain was run end to end through the real service against the test database:
create → publish → visible → type override with a lock → club write applied to the unlocked key →
locked write refused with a 403 → reset removing the row → adding a capability gate hiding the
template immediately. Cleaned up afterwards, with the count checked.

### S0-5 · Platform admin UI

`packages/admin` — template list, the shape editor (§1 of the wireframes), the settings defaults.

**Acceptance**

- Shape carries the sentence *"a club needing different phases needs a new template"* on the screen.
- Phases reorder by drag; `key` is immutable once the template is published, because a saved event
  references it.
- Publishing a template is a deliberate action; a draft is invisible to clubs.

### S0-6 · Org-admin settings screen

`orgadmin-core` Settings — a new **Event rules** tab, visible only with `event-scheduling`.

**Acceptance**

- The `From` column on every row, and **Reset to template** per row and for all.
- A locked setting is **removed** and replaced by a line naming who set it —
  [ORGANISATION_TYPE_LOGO.md](ORGANISATION_TYPE_LOGO.md)'s rule, not a disabled input.
- Six locales for every string.

---

## S1 — a schedulable day

Done when an organiser can generate, adjust and save a running order for a one-day, one-phase event.
Not published, not public — that is S3.

### S1-1 · Migration: resources, sessions, slots

`1709000000048_event-schedules.js`

```
event_schedules
  id · event_id → events · status ('draft')
  version           integer not null default 1   -- optimistic locking
  settings          jsonb                        -- the resolved snapshot at generation
  timestamps

schedule_resources
  id · schedule_id · kind (varchar) · name (varchar) · position integer

schedule_resource_sessions
  id · resource_id · on_date date · opens_at time · closes_at time

schedule_slots
  id · session_id · starts_at time · minutes integer
  activity_id → event_activities · phase_key varchar
  kind varchar   -- 'competitor' | 'break' | 'closed'
  position integer

schedule_slot_participants
  id · slot_id · position integer
  entry_id      uuid null → event_entries
  derived_from  jsonb null   -- {"slotId": "...", "place": 1} for a later round
  check (entry_id is not null or derived_from is not null)
```

**Acceptance**

- `on_date` is a **`date`** and `opens_at` / `starts_at` are **`time`** — never `timestamptz`. A
  running order is wall-clock time at a venue.
- `schedule_slot_participants` exists with `position` from day one even though S1 writes one row per
  slot. Adding it later is a migration and a rewrite of every read.
- Deleting an event cascades; deleting an **entry** does not delete a slot — it leaves a participant
  row pointing at a withdrawn entry, which the editor shows as a gap to remove. Silent disappearance
  from a printed running order is worse.

### S1-2 · The scheduler

`packages/backend/src/services/scheduling/sequential-phases.ts`, behind a registry keyed by
`scheduler_kind`.

```ts
generate(input: {
  entries, activities, resources, sessions, settings, order
}): { slots: DraftSlot[]; warnings: Warning[] }
```

**Acceptance**

- **Pure and deterministic.** No database access, no clock. Same input, same output — which is what
  makes "the draw is fixed once generated" true and the tests readable.
- The draw order is seeded and the **seed is stored** on the schedule, so regenerating times does not
  reshuffle numbers already printed.
- Respects: one slot per resource at a time; one slot per competitor at a time; session opening
  hours; periodic breaks.
- Returns **warnings rather than throwing** when it cannot satisfy everything — a schedule that
  cannot fit is still a starting point.
- The registry exists in S1 with one entry. A registry with one implementation is a guess, but adding
  it later means changing every call site.

### S1-3 · Service and routes

`schedule.service.ts` / `schedule.routes.ts`, under `event-scheduling` and scoped by
`byResource('event', 'eventId')`.

```
GET    /api/orgadmin/events/:eventId/schedule
POST   /api/orgadmin/events/:eventId/schedule/generate
PUT    /api/orgadmin/events/:eventId/schedule          -- save edits, with version
POST   /api/orgadmin/events/:eventId/schedule/resources
```

**Acceptance**

- `PUT` takes the client's `version`; a mismatch is **409** with the current schedule in the body, so
  the editor can say *"Someone else changed this at 18:20"* and show it. This is the whole of the
  concurrency requirement.
- Generating **replaces** the draft and says how many manual moves it discarded, so the confirmation
  dialog can name the number.
- Every write audited: `schedule.generated`, `schedule.updated`.

### S1-4 · The module package

`packages/orgadmin-scheduling`, a capability module like the others.

- `capability: 'event-scheduling'`, `ModuleRegistration` in `src/index.ts`.
- Routes `schedule` (the ticketed-events-style list of events) and `schedule/:eventId` (the editor).
- Entry point follows **ticketing's** precedent: its own menu item, plus a button on the event.
  `EventDetailsPage` has no tabs today and S1 should not add them.
- Added to the shell's `ALL_MODULES` and to `vite.config.shared.ts`'s alias and dedupe lists.

### S1-5 · The editor

The screen from §4 of the wireframes.

**Acceptance**

- One day at a time; resources across, time down.
- Drag to move a slot; after a manual move the constraints become **warnings on the row**, never
  refusals, with the count at the foot and the line saying warnings do not stop you publishing.
- Warnings name people and entities in the club's words, not constraint names.
- A closed session is drawn, not hidden.
- Regenerate names how many manual moves it will discard.
- `saveBlob` is not needed yet; Excel is S3.

### S1-6 · Tests

Per CLAUDE.md §1.2, and the shape of them matters more than the count.

- **Scheduler (Jest, pure):** the interesting cases are the ones the model exists for — two
  competitors, one resource; a competitor in two classes; a session that ends mid-class; the seed
  producing the same draw twice; warnings rather than an exception when it cannot fit.
- **Settings resolution (Jest):** each level winning; a locked key ignoring the organisation's row;
  a changed template default reaching a club that never overrode it.
- **Routes (Jest + supertest):** capability refusal; the 409 on a version mismatch; a template the
  club has no capability for absent from the list.
- **Editor (Vitest):** a drag producing a warning and not a refusal; regenerate naming the count;
  the day tabs.
- Remember the house patterns: MUI `Select` opens on `mouseDown`; `useApi`/`useOrganisation` mocks
  must return **stable references** or the load effect loops.

### S1-7 · Documentation, in the same pass

- `docs/EVENT_SCHEDULING.md` — the feature record, replacing this file's forward-looking sections.
- `.claude/modules/orgadmin-scheduling.md` — a new module summary; and the index in `CLAUDE.md` §2.
- `.claude/modules/architecture.md` — the new capabilities in the seeded list.
- `.claude/marketing/` — §3 of `what-changed.md` gains a line: scheduling is something version 4
  cannot do at all.
- Seed: one club with a scheduled event, or the editor cannot be seen working.

---

## What S0 and S1 deliberately do not do

Named so nobody builds them early or assumes they are missing by accident.

| | Where it lands |
|---|---|
| Multiple phases, phase order, competitor gaps | S2 |
| Multi-day (a phase across two days) | S2 — the schema carries it; the editor does not yet |
| Entity resolution (horse/boat) and its warnings | S2 |
| Breaks configured by the club | S2 |
| Publishing: member home screen, public URL, name-display choice | S3 |
| Excel and print | S3 |
| Anything about scoring | R1 onward |
| `heats-and-finals`, `bracket` | X2, behind the registry S1-2 builds |

---

## Sequencing

```
S0-1 ─┬─ S0-3 ── S0-4 ─┬─ S0-5
S0-2 ─┘                └─ S0-6

S1-1 ── S1-2 ── S1-3 ── S1-4 ── S1-5 ── S1-6 ── S1-7
         ▲
         └─ needs S0-3: the scheduler is fed resolved settings
```

S0-5 and S0-6 are independent of each other and of S1-1/S1-2, so the front-end and back-end halves
can proceed in parallel after S0-4.

**The one ordering that matters:** S1-2 must not be written before S0-3, or the scheduler grows its
own idea of where a setting comes from.

---

## Definition of done, for every task

The house rules, restated because they are what "finished" means here:

1. **Tests** — new functionality gets a full set; changed code has its tests updated. Jest for the
   backend, Vitest for every front end, never mixed.
2. **Six locales** — every new user-facing string in all of `en-GB`, `de-DE`, `es-ES`, `fr-FR`,
   `it-IT`, `pt-PT`, with a minimal JSON diff.
3. **Documentation in the same pass** — `docs/` for the feature, `.claude/modules/` for anything that
   adds a page, route, service or capability.
4. **Deployment artefacts** — nothing here needs new environment configuration, which is worth
   confirming rather than assuming when S0-2 lands.
5. **No git operations** unless asked.
