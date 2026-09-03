# Event scheduling and event scoring — a proposal

**Status: proposal, revised. Nothing here is built.** This is the case for a design, not a plan that
has been agreed.

**Revision 5** records the three decisions taken (§11) and moves to wireframes:
[EVENT_SCHEDULING_AND_SCORING_WIREFRAMES.md](EVENT_SCHEDULING_AND_SCORING_WIREFRAMES.md).

**Revision 4** added **team scoring** (§4.6), settles the rule-variation question that revision 3 left
open (§10.1), and closes the export question — for now, results only need to be read by a human.

**Revision 3** folded in the answers to §9 — rules settable per organisation type and per club,
club-named resources, **multi-day schedules**, an objections window in minutes, results exported to
Excel and PDF, and scheduling shipping before scoring.

**Revision 2** folded in the answers to the questions the first draft ended on (§8). Three of them
changed the design rather than confirming it, and each is marked **‹answered›** where it bites:
tennis and swimming are in scope as later disciplines, which breaks the one-competitor-per-slot model
the first draft assumed; results may be **official**, which makes audit and a result lifecycle
structural rather than polish; and the scheduled entity may be a **registration**, which the entry
form cannot currently reference at all.

Both features are asked for in the same shape — *configurable behaviour, chosen by event type, gated
by a capability, publishable to members and to the public* — so they are proposed together. They
share a spine, and building them apart would produce two of everything.

---

## 1. What exists today

Grounded in the code, because two findings change the design before it starts.

### 1.1 `event_types` is club-owned free text with no behaviour

```
event_types: id · organisation_id · name · description · timestamps
```

Every club writes its own. Kildare has *Camp, Cross Country, Dressage, Fun Day, Rally, Show
Jumping*; Laois has its own rows with the same names. There is **no platform-level event type**, and
no place to hang behaviour on one.

The request is for *"predefined Event Types … preconfigured for all organisations within that
organisation type"*, so this is the gap the whole design turns on. See §2.

### 1.2 The metadata repository is not the low-code substrate

`object_definitions` / `object_fields` / `field_definitions` exist and hold **zero rows**. They are
scaffold from the original framework, described in `architecture.md` as driving "the generic CRUD
API", and nothing in the product uses them.

The machinery that *is* live and proven is the **Form Builder**: 156 `application_fields` and 28
`application_forms` in the demo data alone, with 15 datatypes, per-field validation enforced on
**both** client and server, a renderer (`FieldRenderer`), grouping and multi-step wizards.

That matters, because scoring needs exactly this — a configurable set of typed, validated fields —
and the honest answer is to reuse it rather than to revive the unused abstraction next to it.

### 1.3 What else is already in place and should be reused

| | |
|---|---|
| **Capabilities** gate backend, module, route and menu together; `organization_types.default_capabilities` is the existing "every club of this type gets it" hook | The gating asked for needs no new mechanism |
| **Public, no-login pages** — `/api/public/organisations/:code/events/:slug` → `PublicEventPage`, with `schema.org/Event`, Open Graph, canonical URLs, self-hosted fonts and `anonymous: true` on every request | The external-URL requirement is a well-trodden path, not new ground |
| **The account dashboard** returns the whole home screen in one call and already carries announcements behind a capability | A schedule or results link is one more section, not one more round trip |
| **Capability modules** are lazy-loaded packages declaring their own routes, menu and card | Two new modules drop in without touching the shell |
| **`entry_status = 'removed'`** for withdrawals, soft deletes throughout | A scratching is already modelled |

### 1.4 What is missing that scheduling needs

- **Nothing links an entry to a horse.** `event_entries` has `member_id` (the rider, when they are a
  member) and `form_submission_id` (the answers). The horse's name lives in a **form answer** —
  whatever field the club happened to build. `registrations.entity_name` *is* the horse in the
  registrations module, but no entry references a registration.
- **There is no notion of a resource.** No arenas, no courses, no rings.
- The old system's equivalent was three fields on an activity — start time, end time, colour — feeding
  a calendar view. That is a diary entry, not a schedule.

---

## 2. The spine: event type templates

**Introduce a platform-level `event_type_templates`, managed by the super admin, and let a club's
`event_types` optionally derive from one.**

```
event_type_templates
  id · key ('equestrian.showjumping') · display_name · description
  capability          -- which capability unlocks it
  scheduling_model    jsonb   -- §3
  scoring_model       jsonb   -- §4
  status              -- draft | published
```

```
event_types  (unchanged, plus)
  template_id  uuid null  -- null = a plain club-defined type, exactly as today
```

Three properties worth having:

- **Existing types keep working.** `template_id` null is what every row is today, and a club that
  never buys either capability sees no change at all.
- **A club still owns its own list.** "Show Jumping" in Kildare's list is still Kildare's row; it
  simply points at the platform's Show Jumping template for its behaviour. Renaming it locally does
  not break anything.
- **"Preconfigured for all organisations of a type" falls out of the existing model.** Put the
  capability in `organization_types.default_capabilities`; a small job (or a step in club setup)
  materialises an `event_types` row per template the club can now see. No new gating concept.

**The alternative I rejected:** putting the behaviour directly on each club's `event_types` row.
That makes every club maintain its own copy of the Show Jumping rules, which is 200 copies of one
thing to keep in step, and it makes "we improved eventing scheduling" an unshippable change.

### 2.1 Shape is the platform's; settings are inherited and overridable

**‹answered — rules should have defaults but be settable per organisation type or per club›** So the
model is not one value but a chain, and the useful distinction is between the two halves of a
template.

| | Set by | Overridable |
|---|---|---|
| **Shape** — which phases exist, their order, `schedulerKind`, which calculator computes a result | The platform only | **No** |
| **Settings** — minutes per competitor, competitor gap, time allowed, penalty per second, break rules, resource labels | The platform, as defaults | **Yes**: organisation type → organisation → the event itself |

**Decided:** default shapes, with the ability to override default settings.

The split is the whole point. If a club can redefine what eventing *is*, there are soon two hundred
definitions of it and the calculators stop meaning anything; if a club cannot set its own minutes per
competitor, the feature is unusable. Shape is a statement about a discipline; settings are a
statement about how this club runs a day.

**One consequence worth being explicit about**, because "default shape" can be read as "and I can
change it": a club that needs a genuinely *different* shape — eventing with a fourth phase, a
dressage type with three tests — is asking for **a new template**, not an override. That is a
super-admin action taking minutes, and the club then points its event type at the new template. What
it is not is a per-club edit of the phases, which is the thing that produces two hundred divergent
definitions and a calculator that no longer knows what it is computing.

Resolution is last-wins down the chain, storing **only what differs** at each level — so improving a
platform default reaches every club that never overrode it. That is exactly how
`organization_type_payment_fees` and its per-organisation override already work
([ORGANISATION_APPLICATION_FEE.md](ORGANISATION_APPLICATION_FEE.md)), and how branding inherits a
logo from the organisation type.

**Borrow the lock, too.** The organisation-type logo can be *locked* so a club may not replace it
([ORGANISATION_TYPE_LOGO.md](ORGANISATION_TYPE_LOGO.md)). A federation that needs its clubs to run
the same rules wants precisely that on a setting — so each setting carries a `locked` flag at the
type level, and a locked setting is **removed** from the club's screen rather than shown greyed out,
which is the rule that document already settled.

---

## 3. Scheduling

### 3.1 The observation the design rests on

Everything in the brief is a **resource-constrained scheduling problem with precedence**, and almost
all of the variation described is **parameters, not logic**:

| Described | Expressed as |
|---|---|
| Show jumping, single round | 1 phase |
| Show jumping, 2 rounds + jump-off | 3 phases, the third entered by qualification |
| Eventing, DR → XC → SJ *or* DR → SJ → XC | 3 phases, order configured per event |
| Dressage, one test or two | 1 or 2 phases |
| Multiple arenas, classes assigned to each | resources, and an assignment per activity |
| Rider on two horses needs time to change | minimum gap between one **competitor's** runs |
| Time per competitor, lunch, a break every N | duration, fixed breaks, periodic breaks |

So one generic scheduler covers all of it, and a new discipline is a **row of configuration**.

### 3.2 The model

A template declares the *shape*:

```jsonc
{
  "schedulerKind": "sequential-phases",      // the seam — see §3.5
  "phases": [
    { "key": "dressage", "name": "Dressage",     "defaultMinutes": 8 },
    { "key": "xc",       "name": "Cross Country", "defaultMinutes": 6 },
    { "key": "sj",       "name": "Show Jumping",  "defaultMinutes": 3 }
  ],
  "phaseOrder": "strict",                    // strict | any
  "orderConfigurable": true,                 // the club may swap XC and SJ
  "resourceKinds": [
    { "key": "arena",  "label": "Arena",  "phases": ["dressage", "sj"] },
    { "key": "course", "label": "Course", "phases": ["xc"] }
  ],
  "competitorGapMinutes": 20,                // default; the club may raise it
  "entity": { /* §3.4 */ }
}
```

**‹answered — resources should be labelled by the club›** `label` is a **setting** (§2.1), so it
defaults from the template and a club may call it *Arena*, *Ring*, *Court*, *Lane* or *Pool*. It
follows the rule the bookings menu name already set: a club-chosen label is **not translated**,
because it is a name the club chose rather than a word the product owns, and an untouched club keeps
following the translated default in every language.

The **event** then configures the instance: which resources exist ("Arena 1", "Arena 2", "The
Bank"), which activity's phase runs on which resource, when each resource is open, minutes per
competitor where it differs, and breaks.

### 3.2.1 A schedule has days, and a resource has sessions

**‹answered — a schedule can span more than one day›** and the examples given are the ones that break
a naive model:

- dressage on day 1, show jumping **and** cross country on day 2;
- all three phases on separate days;
- **dressage across days 1 *and* 2**, cross country day 3, show jumping day 4.

The third is the one that matters: **a single phase can span more than one day**, so "day" cannot be
a property of a phase, and "start time" cannot be a property of a resource.

So a resource has **sessions** — a date, a start time and an end time — and slots are placed into
sessions:

```
schedule           → event, status, version, published_at
resource           → schedule, kind, name ("Arena 1")
resource_session   → resource, date, opens_at, closes_at
slot               → resource_session, starts_at, minutes, phase, activity
slot_participant   → slot, position, entry_id | derived_from
```

Two consequences fall out for free, which is the sign the model is right:

- **The phase-order constraint spans days without knowing about them.** Dressage before cross country
  holds whether they are two hours or two days apart.
- **The competitor gap stops mattering across a day boundary.** Twenty minutes between a rider's two
  horses is a within-session concern; overnight is not a constraint anyone needs expressed.

It also means the schedule editor is a **day at a time** — resources across, time down, one tab per
day — rather than one enormous grid. A four-day event is four readable screens.

### 3.3 What the scheduler produces, and who owns it

**‹answered — tennis and swimming›** The first draft called the unit a *run* and defined it as
`(entry × phase)`: exactly one competitor. That holds for every equestrian discipline and breaks
immediately for the other two named:

| | Unit | Participants |
|---|---|---|
| Equestrian | a round | **1** |
| Swimming | a heat | **6–8**, each in a lane |
| Tennis | a match | **2**, one per side |

So the unit is a **slot** — a resource, a start time, a duration and **one or more participants**,
each with a position within it (lane 4, the far side). Equestrian is the case where that number is
one.

A participant is normally an entry. In a bracket or a final it may instead be **derived** — *"winner
of QF1"*, *"first two from Heat 3"* — which is what lets a tennis draw or a heats-and-finals
timetable be published in full before anybody competes. Nothing about that needs live recomputation
(§3.6); the later slots simply name their source rather than a person.

This costs almost nothing to model now and is a rewrite to retrofit, so the storage should carry it
from the first migration even though phase 1 only ever writes one participant per slot.

The scheduler places every slot on a resource at a time, subject to:

- a resource does one slot at a time;
- a competitor is in one slot at a time;
- a competitor's phases obey the template's order, where it is strict;
- a competitor's consecutive slots are at least `competitorGapMinutes` apart;
- fixed breaks (lunch) and periodic breaks (every N slots) are respected.

**The critical product decision: the schedule is a document the club owns, not a solver's verdict.**
The system produces a *draft*, and the organiser drags things. After a manual move the constraints
become **warnings on the affected rows** — *"Aoife is in Arena 2 at 10:40 and Arena 1 at 10:45"* —
never a refusal. A club with a reason to break its own rule at 9pm the night before must be able to.

**‹answered — one organiser at a time, several over the days before›** So no concurrent editing, and
no operational-transform machinery. What is needed is the cheap half: an optimistic **version check
on save**, so the second administrator is told *"Someone else changed this schedule at 18:20"* and
offered the current one, rather than silently overwriting an afternoon's work. That is a column and
a comparison, and it is the difference between a rare annoyance and a lost schedule.

That also means the algorithm should be **explainable rather than optimal**. A list scheduler with a
declared ordering (draw order, reverse order of merit, random with a seed, grouped by club) is
enough, and an organiser can answer *"why is Mary at 10:40?"* A constraint solver that produces a
better timetable nobody can explain is the wrong trade at a pony club.

### 3.4 The competitor and the entity they compete with

A rider on two horses is the constraint most specific to this domain, and today **nothing knows
which horse an entry is for** (§1.4).

**‹answered — a registered item should be a first-class record where the club uses one, and a form
field where it does not›** So this is not one mechanism but a resolver with two ordered sources,
configured per event type. Nothing here is horse-specific: the registrations module already calls
the thing an **entity** (`registrations.entity_name`), and a boat, a dog or a doubles partner reads
the same way.

```jsonc
"entity": {
  "label": "Horse",                    // what the club's screens call it
  "source": "registration",            // registration | field | none
  "registrationTypeKey": "horse",      // which kind of registration
  "fallbackField": "horseName"         // when the form has no picker
}
```

1. **A registration, where the entry names one.** Real identity — a passport number rather than a
   string somebody typed — so the same horse entered twice in one class is detectable, and two
   spellings of one name are one horse.
2. **A nominated form field, where it does not.** The value is normalised and treated as an opaque
   identity. Works with the forms clubs already build and needs no schema change.
3. **None**, for a discipline where the competitor is the only thing that matters — swimming, tennis.

**The gap this exposes:** the Form Builder has 15 datatypes and **none of them picks a
registration**, and nothing links `event_entries` to `registrations`. Making source (1) real needs
both — a `registration` field type that offers the entrant their own registered horses, and the
column to store the choice. That is a genuine piece of work, and it is worth knowing it sits on the
critical path for equestrian rather than discovering it in phase 2.

Source (2) needs neither, which is why it should ship first and stay supported permanently: plenty
of clubs will never register a horse.

### 3.5 Where configuration stops, and code begins

Being honest about the ceiling is more useful than claiming there isn't one.

**Configuration covers:** the number, naming and order of phases; durations; resources and their
assignment; start times; breaks; competitor gaps; draw order from a named set; whether a phase is
entered by qualification.

**New code is needed for a new *shape*.** **‹answered — tennis and swimming are the next two›** so
these are no longer hypothetical, and naming them now is what keeps the seam honest:

| Kind | For | What it adds |
|---|---|---|
| `sequential-phases` | equestrian, and anything where each competitor takes their turn | The generic one. Phase 1 |
| `heats-and-finals` | swimming, athletics | Slots hold many participants in **lanes**; heats are formed by a **seed** value and lanes assigned by rank; finals are derived from heat outcomes |
| `bracket` | tennis, and any knockout | Slots hold **two** participants; later rounds are **derived** (*winner of QF1*); seeding and byes |
| — | pursuit starts from a previous phase's scores; team competitions with drop scores | Not requested; listed so the seam is not mistaken for covering them |

All three fit the slot model in §3.3 and differ in **how slots are populated and ordered**, which is
the seam: the template carries **`schedulerKind`**, defaulting to `sequential-phases`, and a kind
declares its own config schema. Everything around it — templates, the editor, publishing, the public
page, the score sheets — is unchanged.

**Ordering is a second, smaller seam.** Draw order, reverse order of merit, random-with-a-seed,
grouped by club, and *seeded by a declared field* (swimming's entry times, tennis rankings) are
strategies chosen by name, not by code.

I would not promise a rules engine or a DSL. Every one I have seen in this position ends up a
programming language with no debugger, maintained by the one person who understands it.

### 3.6 The schedule is published before the event and does not change during it

**‹answered›** A useful boundary, and it removes the largest piece of work in the brief. No live
recomputation, no progressive publishing, no reacting to a class running late.

Two consequences worth stating so they are not mistaken for gaps:

- **A morning scratching is handled by republishing**, not by logic. Withdraw the entry, regenerate
  or drag, publish again; the page says *"Updated 08:20"*. That is the whole feature, and it is
  enough.
- **`heats-and-finals` and `bracket` still work**, because their later slots are *derived* (§3.3)
  rather than recomputed. A published draw shows *"Winner of QF1"* at 14:30, and that is what a
  printed order of play does too.

If live scheduling is ever wanted, it is a new `schedulerKind` and a recompute endpoint — not a
change to any of this.

---

## 4. Scoring and results

### 4.1 Reuse the Form Builder, do not invent a second one

A score sheet is *a set of typed, validated fields* — which is precisely what
`application_fields` / `application_forms` already are, with validation enforced on both client and
server and a renderer that handles all 15 datatypes.

So: **a template's scoring model references a form per phase.** Dressage's sheet is a form of
numeric fields; show jumping's is faults and time. The club can extend one if the platform's default
does not suit, using a builder it already knows.

The alternative — a bespoke score-sheet schema — means a second field type system, a second
validator, a second renderer, and the two drifting.

### 4.2 The template declares how scores become a result

```jsonc
{
  "phases": {
    "dressage": { "formKey": "equestrian.dressage-sheet",
                  "calculator": "dressage-percentage",
                  "params": { "maxMarks": 200 } },
    "sj":       { "formKey": "equestrian.sj-sheet",
                  "calculator": "showjumping-faults",
                  "params": { "timeAllowed": 78, "penaltyPerSecond": 0.4 } }
  },
  "aggregate":  { "calculator": "sum-penalties", "lowestWins": true },
  "tieBreak":   ["xc.timePenalties", "dressage.percentage"],
  "resultColumns": [
    { "key": "place",  "label": "Place" },
    { "key": "rider",  "label": "Rider" },
    { "key": "horse",  "label": "Horse" },
    { "key": "dressage.percentage", "label": "Dressage" },
    { "key": "total",  "label": "Total" }
  ]
}
```

**Named calculators, not a formula language.** A general expression evaluator over club-supplied
strings is a security and support liability, and this codebase already refuses `javascript:` URLs on
exactly that reasoning. A named calculator with parameters covers every scoring system in the brief:

```
dressage-percentage · showjumping-faults · eventing-penalties
points-table · time-fastest · placings-sum
```

If configuration-only extension later proves essential, the smallest safe step is a **restricted
arithmetic expression** over declared score-sheet fields — numbers and `+ - * / ( )` only, no
function calls, no property access, evaluated by a parser we own. That is a deliberate second phase
with its own risk, not something to slip into the first.

### 4.3 Entering scores

A **scoring screen per activity**: the start list down the page, the score sheet's fields across, one
row per run, keyboard-first. Two properties from the way this product already works:

- **Partial scoring is normal.** A dressage phase is scored while cross-country is still running, so
  a result is *provisional* until every phase has a score, and must say which.
- **Withdrawals already exist.** `entry_status = 'removed'` and the eliminated/retired/withdrawn
  distinction belong on the run, not on the entry — a competitor eliminated in the second phase
  still has a first-phase score.

### 4.4 The results themselves

Computed on read from the stored scores, not stored as a placing. A corrected score must reorder the
class, and a stored placing is a second answer that goes stale. Published results are a **snapshot**
(§5) so what was shared is what people saw.

### 4.5 Official results change the requirements, not the design

**‹answered — results could potentially be official›** Nothing above changes, but three things stop
being polish and become structural. A result that a governing body or a qualification depends on is
held to a different standard than a note on a noticeboard.

**A lifecycle, stated on every screen that shows a result:**

```
provisional  →  published (objections open)  →  official  →  amended
```

*Provisional* while any phase is unscored. *Published* is a deliberate act by a named administrator,
and it **starts a clock**. *Official* is what the result becomes when that clock runs out. *Amended*
is what it becomes when a score changes afterwards — and it must **say so**, with what changed and
when. A silently corrected official result is worse than a wrong one, because nobody knows to look.

**‹answered — a variable number of minutes for objections before results become official›** So the
window is a **setting** in the sense of §2.1: a number of minutes, defaulted by the template,
overridable by organisation type, club and event. Zero is a legitimate value and means *official on
publication*.

**Derive "official" from the clock; do not store it as a status.** `published_at` plus
`objections_minutes` says everything, and a stored status alongside them is a second fact that can
disagree — a job that failed to run leaves a result that is official by the clock and provisional in
the column. This is the rule the announcements module already settled: its three states come from
the window alone, because *"a status column alongside would make publishing two facts that can
disagree."* The same reasoning, the same answer.

The consequence is that nothing needs to run on a timer. A results page renders *"Official"* or
*"Provisional — objections close at 16:45"* from two columns and the current time, and it is right
even if nothing has touched the row since it was published.

**Every score change is audited.** The product already has the machinery — `audit_events`
partitioned by month, categories, labels in six locales, a per-organisation viewer, and
`AuditChanges` rendering a before-and-after diff. Scoring needs its own actions
(`score.recorded`, `score.amended`, `result.finalised`, `result.amended`) and nothing else. This is
the single strongest argument for building on what is here rather than beside it.

**Published snapshots are immutable.** Amending produces a **new** snapshot; the previous one is kept
and addressable. If a club has to demonstrate what was published on the day, the answer should be a
row, not a memory.

Two smaller consequences: a **correction reason** should be required when amending a final result —
it is the first thing anyone asks — and the objections window is a per-event setting, because
disciplines differ and clubs differ more.

### 4.6 Teams

**‹answered — team scoring needs extra work, in three parts›** and the three parts given are exactly
the right decomposition. Two of them turn out to be shapes the design already has.

#### 4.6.1 Who is in a team — the same resolver as the entity

*"Assign entries to teams and name them, or select the field in the form which names the team so it
happens automatically."*

That is the **entity resolver** from §3.4 asked about a different question, so it should be the same
mechanism rather than a second one:

```jsonc
"teams": {
  "enabled": true,
  "label": "Team",                 // a setting: Team, Squad, Branch, House
  "source": "field",               // explicit | field | none
  "teamField": "teamName",         // when the form asks
  "scope": "event"                 // teams are per event, not per class
}
```

- **`field`** — a nominated form field names the team, and teams appear as the entries arrive. Zero
  admin work, and wrong the moment somebody types "Kildare" and somebody else types "Kildare Hunt".
  So the screen shows the distinct values it found and lets an administrator **merge** two spellings,
  which is a rename rather than a re-entry.
- **`explicit`** — an administrator builds the teams and drags entries in. More work, and the only
  option that supports a team picked *after* entries close, which is how a lot of clubs actually do
  it.
- Both write to the same place, so a club can start with the field and correct by hand.

**Teams are per event, not per class.** A rider enters three classes for one team, and a team defined
per class would be three teams with one name.

#### 4.6.2 Individual, team, or both

*"Define if individual scoring still needed or just team scoring."*

A setting with three values — `individual`, `team`, `both` — defaulted by the template and settable
per event, because the same club runs both kinds of day. **`both` is the common case** in the
equestrian examples given: a rider gets a placing and their team gets a placing from the same scores.

It is a display and computation flag, not a different scoring path: team results are always
**derived from individual scores** (§4.6.3), so `team` only means the individual table is not
published, never that individual scores are not recorded. Recording them anyway matters — it is what
makes a team total explicable, and what lets a club publish individuals later without rescoring.

#### 4.6.3 How a team score is computed

*"Define the rules for team scores, e.g. best 3 to count."*

A **drop-score aggregation**, and a named team calculator with parameters — the same seam as §4.2:

```jsonc
"teamScore": {
  "calculator": "best-n-of-m",
  "params": {
    "countBest": 3,               // best 3 to count
    "minimumScorers": 3,          // fewer finishers than this and the team is unplaced
    "onEliminated": "discard"     // discard | maximum-penalty
  },
  "tieBreak": ["dropped-score", "best-individual"]
}
```

Three details that decide whether a club trusts the result, none of them obvious:

- **What happens to a team that loses one.** Three of four eliminated is a discard; three of *three*
  is a team with no result. `minimumScorers` is the difference, and it must be a setting because
  disciplines differ.
- **An eliminated rider is not a zero.** Some rule sets discard them, others substitute a maximum
  penalty so the team is punished rather than unaffected. `onEliminated` says which.
- **The tie-break is usually the dropped score** — the one that did not count — which means the
  system has to keep it rather than discard it during aggregation. Easy to design out by accident.

#### 4.6.4 What teams do *not* need yet

**Team scheduling is a separate thing and is not required for team scoring.** Spreading a team's
riders through a running order, or grouping them, was already listed as needing a new
`schedulerKind` (§3.5). Team *results* work on top of whatever order the day ran in, so they can ship
without it — and should.

---

## 5. Publishing — one mechanism, two consumers

Both features publish the same way, and this is where the existing product does most of the work.

### 5.1 Publish is explicit, and versioned

`draft → published`, with a stored snapshot and a `published_at`. A club must never have a
half-built running order appear on Facebook because somebody opened the editor. Re-publishing
replaces the snapshot and says when it last changed — *"Updated 19:40, Friday"* is the single most
useful thing on a schedule page.

### 5.2 On the member's home screen

One more section on `GET /api/account/:orgCode/dashboard`, capability-gated exactly as announcements
are, linking to the event's schedule or results. It costs no extra round trip.

### 5.3 Publicly, with no login

`/account/:orgCode/whats-on/:slug/schedule` and `…/results`, alongside the public event page that
already exists — anonymous, club-branded, indexable, with Open Graph tags so a link pasted into
Facebook renders as a card. The `anonymous: true` request pattern, the slug format and the metadata
handling are all already there.

### 5.4 The point that needs a decision, not a default

**A start list is personal data**, and often about children. Publishing one to an indexable page is a
choice a club must make deliberately, per event:

- publishing publicly is **off** by default;
- the club chooses what a public page shows — full names, or first name and initial, or numbers only;
- the members-only version can be fuller than the public one;
- the page states when it was published and by whom.

The old system's help carries a whole GDPR section on exactly this instinct. I would not ship
public publishing without the name-display choice attached to it.

### 5.5 Off the screen: Excel and print

**‹answered — results should be exportable to Excel for downloading, or PDF for printing›** Both, and
they are not the same job. This applies to the schedule as much as the results: a running order gets
printed and pinned up far more often than a results sheet does.

**Excel is already solved.** The product builds workbooks server-side with `exceljs` in three places
now, and the members export settled the pattern this needs: **a sheet per class**, each with the
columns that class actually has — because two classes score differently for the same reason two
membership types ask different questions. `saveBlob` on the front end is shared. Nothing new is
required beyond the sheet builder itself.

One trap already paid for: a schedule is **dates and wall-clock times**, and a Postgres `date` comes
back at local midnight, which Excel then shows a day early through the summer. The members export hit
exactly this. Write date-only values as `yyyy-mm-dd` text and times as text; do not hand exceljs a
`Date` and hope.

**PDF is not solved, and should not be pretended otherwise.** There is **no PDF engine in the
backend** — a fact this product has already been bitten by, when the ticket dialog's *Download PDF*
called an endpoint that never existed and reported success anyway. The resolution there was to build
the document in the browser and print it, and the button was renamed **Print / Save as PDF** to say
what it does.

I would do the same here, deliberately:

- a **print view** of the schedule and of the results — a clean page with a print stylesheet, the
  club's name and logo, the published time, and no navigation;
- the browser's own *Save as PDF* produces the file;
- it works from the **public** page too, so anyone can print a running order without an account.

The alternative — a server-side renderer such as Puppeteer — produces a byte-identical PDF and costs
a headless browser in the deployment, its memory, and its patching. That is a real decision, not a
detail, and it should be made because someone needs a *server-generated* PDF (an emailed results
sheet, a federation submission) rather than because "PDF" was in the requirement. Until then, print
is the honest answer and it is genuinely good.

---

## 6. Shape of the work

Each phase is useful on its own, which matters more than the total.

**‹answered — scheduling ships alone first›** So this is two deliveries, not one, and the first is a
complete product on its own. A club that schedules and never scores has been sold something whole.

### 6.1 Scheduling

| | | |
|---|---|---|
| **S0** | `event_type_templates`, `event_types.template_id`, the settings chain (§2.1) with its type and organisation overrides, super-admin editor, capability plumbing | The spine. Nothing user-visible |
| **S1** | Resources with club labels, sessions, days; the `sequential-phases` scheduler; the day-at-a-time editor with drag and version checking | A club can time a one-day, one-phase show jumping event |
| **S2** | Multi-phase, configurable phase order, competitor gaps, entity resolution **by form field**, breaks, **multi-day** | Eventing works, including dressage across two days |
| **S3** | Member-facing schedule on the home screen; public URL with the name-display choice and Open Graph; **Excel and print** | Shareable and printable |

**Ships as a product at S3.** S1 and S2 are useful internally before that but not worth announcing.

### 6.2 Scoring

| | | |
|---|---|---|
| **R1** | Score sheets on the Form Builder, the scoring screen, provisional results computed on read | A club can score |
| **R2** | The lifecycle (§4.5), the objections clock, audit actions, immutable snapshots, correction reasons | Results can be official |
| **R3** | Publishing member-facing and public, **Excel and print** | Complete |
| **R4** | Teams (§4.6): membership, `individual \| team \| both`, `best-n-of-m` with its drop-score tie-break | Team competitions work |

### 6.3 Afterwards, in either order

| | | |
|---|---|---|
| **X1** | A `registration` form-field type and `event_entries.registration_id`; entity resolution **by registration** | The horse is a record, not a string |
| **X2** | A second `schedulerKind` — `heats-and-finals` or `bracket` | Proves the seam is real |

**X2 is not optional**, only deferrable. A seam that has never had a second implementation through it
is a guess, and this one has two known future tenants.

**X1 is separable and should stay that way.** Equestrian clubs will run whole seasons on
entity-by-form-field, and it touches the Form Builder, which every module depends on — so it should
not be the first thing built, and it should not block scheduling.

## 7. Risks worth stating now

- **Scheduling is the kind of feature that looks done and is not.** The first club with three arenas,
  a shared warm-up, a rider on four horses and a phase spread over two days will find what the model
  missed. Manual override (§3.3)
  is what makes that survivable rather than a support incident.
- **Scoring is high-stakes and public.** A wrong result is worse than no result. Provisional states,
  an audit trail on every score change, and a visible "last updated" are not polish.
- **Two capabilities or four?** `event-scheduling` and `event-scoring` gate the modules; the
  discipline templates need gating too. My proposal: template rows carry their own `capability`, so
  `equestrian-disciplines` unlocks the equestrian set without a new gating concept — and
  `aquatic-disciplines`, `racquet-disciplines` follow the same pattern later.
- **The generic scheduler is being designed from one discipline.** Equestrian is the first customer
  and the only one whose rules are known in detail here. `sequential-phases` should not be stretched
  to fit swimming or tennis when the time comes; those are `schedulerKind`s (§3.5), and the honest
  risk is the temptation to bend the first one rather than write the second.
- **This is the largest addition since the account app.** Two modules, a platform-level concept, a
  scheduler, a scoring engine and two public surfaces. **Settled: scheduling ships alone first**
  (§6), which is what makes the size survivable.
- **Timezones and dates.** A schedule is wall-clock time at a venue. The product has already been
  bitten twice by naive timestamps — most recently the members export, where a Postgres `date` came
  back at local midnight and would have printed every renewal a day early. A running order is the
  worst possible place to repeat that, and it needs deciding once, up front: store a slot as a date
  plus a local time, not as an instant.
- **A registration field type touches the Form Builder**, which every module depends on. Phase 6
  should not be the first thing built.

---

## 8. Answered

The first draft ended on six questions. All six are answered; three changed the design.

| | Answer | What it changed |
|---|---|---|
| **1. Which disciplines?** | Equestrian first; **tennis and swimming** are real examples too | **Changed the model.** One competitor per unit became a **slot with one or more participants** (§3.3), and `heats-and-finals` and `bracket` are named future `schedulerKind`s rather than hypotheticals (§3.5) |
| **2. Who schedules?** | One organiser at a time; different administrators over the days before | **Simplified.** No concurrent editing — an optimistic **version check on save** is the whole requirement (§3.3) |
| **3. Live during the event?** | No. Posted before, not expected to change during | **Removed the largest piece of work.** A morning scratching is republishing, not logic (§3.6) |
| **4. Official results?** | Potentially | **Changed the requirements.** A `provisional → final → amended` lifecycle, every score change audited through the existing trail, immutable published snapshots, a required correction reason (§4.5) |
| **5. Registered items?** | Yes — first class where used; a nominated form field where not | **Generalised it.** An **entity resolver** with two ordered sources, nothing horse-specific (§3.4). Exposed a real gap: no `registration` field type and no entry-to-registration link exist, so that is its own phase (§6) |
| **6. Pricing?** | Not commercial yet; possibly an **additional application fee** for organisations or types using it | **Needs nothing new.** §8.1 |

### 8.1 The application fee already does this

Charging more where a club uses these capabilities needs **no new mechanism**. The platform's cut is
already configured per organisation type and **inherited into each organisation, with a
per-organisation override** — `organization_type_payment_fees.application_fee_fixed` /
`application_fee_percentage` for the type's default, and a row in
`organization_payment_application_fees` for a club that differs. Recorded in
[ORGANISATION_APPLICATION_FEE.md](ORGANISATION_APPLICATION_FEE.md).

So an uplift for a club using scheduling or scoring is a **commercial setting on an existing dial**,
applied by the super admin. Worth noting two things before it is treated as free:

- **It charges the club's payers, not the club.** An application fee is taken from card payments, so
  an uplift lands on entry fees. A club that schedules but takes no card payments pays nothing, and a
  club with a busy season pays a lot. That may be exactly right — usage-based — but it is a different
  shape from a subscription and should be chosen deliberately.
- **Nothing today ties a fee to a capability.** The override is per organisation, set by hand. If the
  uplift should follow the capability automatically, that is a small piece of work: a per-capability
  fee delta, applied when the capability is granted. Worth doing only if this is expected to be
  sold widely rather than negotiated per club.

---

## 9. Answered, second round

| | Answer | What it changed |
|---|---|---|
| **1. Whose rules?** | Defaults, settable **per organisation type or per organisation** | **Changed the model.** A settings chain — template → type → club → event — split from an unoverridable **shape** (§2.1), storing only what differs, with a `locked` flag borrowed from the organisation-type logo |
| **2. Resource words?** | Yes — Arena, ring, court, lane, pool | **Confirmed.** A resource kind's `label` is a setting, and follows the bookings-menu rule: a club-chosen name is **not translated** (§3.2) |
| **3. Multi-day?** | Yes, including **one phase across two days** | **Changed the model.** Days cannot hang off a phase and start times cannot hang off a resource: a resource has **sessions** (date, opens, closes) and slots live in sessions (§3.2.1). The editor becomes a day at a time |
| **4. Objections?** | A **variable number of minutes** before results become official | **Simplified it.** The window is a setting; *official* is **derived** from `published_at + minutes`, not stored — the rule announcements already settled, so nothing runs on a timer (§4.5) |
| **5. Getting results out?** | **Excel** to download, **PDF** to print | **Half solved already.** Excel is the members-export pattern, sheet per class, with the date-as-text trap already paid for. **There is no backend PDF engine** — print view plus the browser's *Save as PDF*, as the ticket does, unless a server-rendered PDF is genuinely needed (§5.5) |
| **6. Scheduling first?** | Yes | **Two deliveries.** S0–S3 ship a complete scheduling product; R1–R3 follow (§6) |

---

## 10. Answered, third round

### 10.1 What that first question was actually asking — and my answer to it

The question was badly put. Here is what was behind it, with the concrete case.

**Show jumping faults are not one universal rule.** Everyone agrees a knocked fence is 4, but beyond
that the authorities differ:

| | Pony Club-ish | Another rule set |
|---|---|---|
| First refusal | 4 faults | 4 faults |
| Second refusal | elimination | 8 faults, elimination on the third |
| Over the time allowed | 1 fault per second started | 0.4 faults per second |
| Fall of horse or rider | elimination | elimination |

Every one of those differences is a **number or a threshold**. So the design question was: is
`showjumping-faults` **one calculator with parameters** —

```jsonc
{ "faultsPerFenceDown": 4, "faultsPerRefusal": 4, "refusalsBeforeElimination": 2,
  "timePenaltyPerSecond": 1, "timePenaltyRounding": "started-second" }
```

— in which case a rule set is *configuration* and §2.1's settings chain already delivers it; or do
the rule sets differ **structurally**, needing genuinely different code?

**My answer: build it as one parameterised calculator.** Every variation above is numeric, the
settings chain already puts those numbers on the organisation type or the club, and a federation can
lock them. That is the cheap path and I believe it holds.

**The one thing that would break it** — and the narrower question actually worth your answer — is a
rule set where the *structure* differs, not the numbers. The example to watch is a **jump-off**:
whether it is a separate phase scored on its own (which the phase model handles), or a rule that
changes how the first round is scored, which it does not. If any discipline you sell into does the
second, that is a second calculator rather than a parameter.

**The second half of the question was smaller.** *Time allowed* can be typed in per class ("78
seconds"), or derived from course length ÷ required speed ("450m at 325 m/min"). Deriving it is less
error-prone and is what an organiser has on the course plan. **Proposal: allow both** — a length and
a speed which compute the time, and a direct override for the class that does not fit. That is one
extra field pair on a class, and it removes the arithmetic somebody currently does on paper.

Neither answer blocks anything: both are R1 decisions, and S0–S3 do not touch them.

### 10.2 The rest

| | Answer | What it changed |
|---|---|---|
| **2. Results leaving the system?** | **For now, just a human reading it** | **Closed.** §5.5 stands as the whole requirement: Excel to download, print view for paper. No federation format, no API. The seam that would reopen it is a governing body asking for a named layout — the same conversation as the PCUK/Pelham gap |
| **3. Teams?** | Needed, in three parts: assign or read from a form field; individual and/or team; rules such as best 3 to count | **New section, §4.6.** Two of the three parts reuse shapes the design already has — team membership is the **entity resolver** asked about a different question, and the team score is a **named calculator with parameters**, the same seam as every other calculator. Only the drop-score details are new |

---

### 10.3 What §4.6 adds to the work

Teams sit entirely inside scoring, and only R2 onwards.

| | | |
|---|---|---|
| **R4** | Team membership (field-resolved with merge, or explicit), `individual \| team \| both`, `best-n-of-m` with its drop-score tie-break, team results published alongside individual | Team competitions work |

**Not** a change to S0–S3. Team *scheduling* remains a `schedulerKind` for later (§4.6.4), and team
results do not need it.

## 11. Where this now stands

**Every question the proposal raised has been answered.** Nothing outstanding blocks starting, and
one narrow question remains worth watching rather than deciding now: whether any discipline you sell
into scores a **jump-off** as a rule that changes the first round rather than as a phase of its own
(§10.1). That is an R1 concern; it does not touch scheduling at all.

**S0 and S1 can begin.**

**All three of the decisions I asked for are taken:**

- ✅ **Default shapes, with overridable default settings** (§2.1). A different shape is a new
  template, not a per-club edit.
- ✅ **A slot holds participants**, plural (§3.3), and a resource has **sessions** (§3.2.1) — both
  carried from the first migration even though S1 writes one of each.
- ✅ **Individual scores are always recorded**, whatever is published (§4.6.2).

**The three artefacts are complete**, per CLAUDE.md §1.3:

1. This document — requirements and design.
2. [EVENT_SCHEDULING_AND_SCORING_WIREFRAMES.md](EVENT_SCHEDULING_AND_SCORING_WIREFRAMES.md) — how it
   looks, and the nine decisions that only became decisions once drawn.
3. [EVENT_SCHEDULING_TASKS_S0_S1.md](EVENT_SCHEDULING_TASKS_S0_S1.md) — the breakdown for the spine
   and the first schedulable day, with acceptance criteria and what is deliberately excluded.

Implementation has not started.
