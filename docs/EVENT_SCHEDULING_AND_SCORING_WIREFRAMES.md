# Event scheduling and scoring — wireframes

The design in [EVENT_SCHEDULING_AND_SCORING_PROPOSAL.md](EVENT_SCHEDULING_AND_SCORING_PROPOSAL.md),
drawn. Read that first; this shows what the decisions look like on a screen and settles the ones that
only become real once something is drawn.

Following DESIGN.md throughout: sentence case everywhere, warm grounds, hairline rules, no zebra
striping, one orange that decorates and one that speaks. Org-admin is **laptop-first** — dense
tables, drag, bulk actions — and the member and public pages are **phone-first**. Every string is an
i18n key in six locales, so every box below has to survive German.

**Sections**

1. [Platform: the event type template](#1-platform-the-event-type-template)
2. [Settings, and where they are overridden](#2-settings-and-where-they-are-overridden)
3. [Setting a schedule up: resources and days](#3-setting-a-schedule-up-resources-and-days)
4. [The editor — the screen this feature lives or dies on](#4-the-editor)
5. [Publishing a schedule](#5-publishing-a-schedule)
6. [The member's and the public's schedule](#6-the-members-and-the-publics-schedule)
7. [Scoring](#7-scoring)
8. [Results, and the objections clock](#8-results-and-the-objections-clock)
9. [Teams](#9-teams)
10. [What the drawing settled](#10-what-the-drawing-settled)

---

## 1. Platform: the event type template

Super admin only. This is **shape** — the part a club cannot override (§2.1).

```
┌────────────────────────────────────────────────────────────────────────────────┐
│  Platform admin › Event type templates › Eventing                              │
│                                                                                │
│  Key            equestrian.eventing            Status  ● Published             │
│  Display name   Eventing                                                       │
│  Capability     equestrian-disciplines    ⓘ Clubs see this template only       │
│                                              where their organisation type or  │
│                                              their own capabilities include it │
│  ──────────────────────────────────────────────────────────────────────────    │
│  SHAPE                            ⓘ Not overridable by a club. A club needing  │
│                                     different phases needs a new template.     │
│                                                                                │
│  Scheduler      ▾ Sequential phases                                            │
│                   Each competitor takes their turn, one at a time.             │
│                                                                                │
│  Phases                                                        [ + Add phase ] │
│  ┌──────┬───────────────┬──────────────┬───────────────────────┬────────────┐  │
│  │  ⠿   │ Key           │ Name         │ Runs on               │            │  │
│  ├──────┼───────────────┼──────────────┼───────────────────────┼────────────┤  │
│  │  ⠿   │ dressage      │ Dressage     │ Arena                 │  Edit  ⌫   │  │
│  │  ⠿   │ xc            │ Cross country│ Course                │  Edit  ⌫   │  │
│  │  ⠿   │ sj            │ Show jumping │ Arena                 │  Edit  ⌫   │  │
│  └──────┴───────────────┴──────────────┴───────────────────────┴────────────┘  │
│                                                                                │
│  Phase order    ◉ Strict — in the order above                                  │
│                 ○ Any order                                                    │
│                 ☑ A club may reorder these for one event                       │
│                   ⓘ Dressage, then cross country, then show jumping — or       │
│                     dressage, show jumping, cross country. Both are eventing.  │
│                                                                                │
│  Resource kinds                                             [ + Add kind ]     │
│    Arena    default label “Arena”     used by  Dressage, Show jumping          │
│    Course   default label “Course”    used by  Cross country                   │
│                                                                                │
│  Entity      ▾ Registration, falling back to a form field                      │
│                Label “Horse”   ·  Registration type “Horse”                    │
│                Form field when there is no registration:  ▾ Horse name         │
│                                                                                │
│  [ Cancel ]                                            [ Save template ]       │
└────────────────────────────────────────────────────────────────────────────────┘
```

**Why the shape panel says so, on the screen.** The one sentence that prevents a support
conversation is *"a club needing different phases needs a new template."* Said here, in front of the
person who would otherwise be asked to make phases editable.

**A club may reorder** is itself part of the shape — the platform decides whether reordering is a
legitimate variation of this discipline, and the club then exercises it per event.

---

## 2. Settings, and where they are overridden

The same panel appears three times — on the template, on the organisation type, and on the
organisation — and looks nearly identical each time. That is the point: an administrator learns it
once.

```
┌────────────────────────────────────────────────────────────────────────────────┐
│  Organisation type › Irish Pony Club › Event rules › Eventing                  │
│                                                                                │
│  ⓘ These are the defaults every club of this type starts from. A club may      │
│    change anything not locked.                                                 │
│                                                                                │
│  ┌───────────────────────────────┬──────────────┬──────────┬────────────────┐  │
│  │ Setting                       │ Value        │ From     │ Locked         │  │
│  ├───────────────────────────────┼──────────────┼──────────┼────────────────┤  │
│  │ Minutes per competitor        │              │          │                │  │
│  │   Dressage                    │   [   8   ]  │ Template │  ☐             │  │
│  │   Cross country               │   [   6   ]  │ Template │  ☐             │  │
│  │   Show jumping                │   [   4   ]  │ ● Type   │  ☑             │  │
│  │ Minutes between a competitor’s│              │          │                │  │
│  │ own rounds                    │   [  20   ]  │ ● Type   │  ☑             │  │
│  │ Break after every N rounds    │   [  25   ]  │ Template │  ☐             │  │
│  │ Break length (minutes)        │   [  10   ]  │ Template │  ☐             │  │
│  │ Objections window (minutes)   │   [  30   ]  │ ● Type   │  ☐             │  │
│  └───────────────────────────────┴──────────────┴──────────┴────────────────┘  │
│                                                                                │
│         ● = changed here.  Everything else is inherited and follows the        │
│             template if we improve it.                                         │
│                                                                                │
│  [ Reset all to template ]                                     [ Save ]        │
└────────────────────────────────────────────────────────────────────────────────┘
```

**The `From` column is the feature.** Inheritance is invisible until something goes wrong, and then
the only question anybody asks is *"where did 20 minutes come from?"* Showing the source on every row
answers it before it is asked, and **Reset to template** is what makes an override reversible rather
than a one-way door.

**Locked, seen by a club:**

```
│   Show jumping                │      4       │ Set by Irish Pony Club  🔒     │
```

The field is **removed, not greyed out** — the rule
[ORGANISATION_TYPE_LOGO.md](ORGANISATION_TYPE_LOGO.md) already settled: a disabled control explains
nothing, a sentence naming who set it explains everything.

---

## 3. Setting a schedule up: resources and days

Reached from the event: **Events › Autumn One-Day Event › Schedule**.

**The tab strip below is indicative, not current.** `EventDetailsPage` is a single scrolling page
with no tabs today. The real entry point should follow how **ticketing** already does it — its own
menu item plus a button on the event that opens `‹module›/:eventId` — because that pattern exists,
is understood, and keeps the schedule out of an event page that is already 520 lines. Introducing a
tab strip on the event is a separate decision, worth taking deliberately if Schedule, Results and
Ticketing all end up hanging off an event.

```
┌────────────────────────────────────────────────────────────────────────────────┐
│  ← Autumn One-Day Event                                                        │
│  Overview │ Activities │ Entries │ ► Schedule │ Results │ Ticketing            │
│                                                                                │
│  ⚠ Entries close on 12 September. Building a schedule now means rebuilding it  │
│    if more entries arrive.                          [ Build it anyway ]        │
│  ──────────────────────────────────────────────────────────────────────────    │
│                                                                                │
│  DAYS                                                          [ + Add day ]   │
│  ┌────────────────┬──────────────────────────────────────────────────────────┐ │
│  │ Sat 20 Sep     │  Arena 1  09:00–17:00   ·  Arena 2  09:00–13:00      Edit│ │
│  │ Sun 21 Sep     │  The Bank 10:00–16:00                                Edit│ │
│  └────────────────┴──────────────────────────────────────────────────────────┘ │
│                                                                                │
│  RESOURCES                                                [ + Add resource ]   │
│  ┌───────────────┬──────────┬────────────────────────┬───────────────────────┐ │
│  │ Name          │ Kind     │ Open                   │                       │ │
│  ├───────────────┼──────────┼────────────────────────┼───────────────────────┤ │
│  │ Arena 1       │ Arena    │ Sat 09:00–17:00        │  Edit    Remove       │ │
│  │ Arena 2       │ Arena    │ Sat 09:00–13:00        │  Edit    Remove       │ │
│  │ The Bank      │ Course   │ Sun 10:00–16:00        │  Edit    Remove       │ │
│  └───────────────┴──────────┴────────────────────────┴───────────────────────┘ │
│                                                                                │
│  WHERE EACH CLASS RUNS                                                         │
│  ┌────────────────────┬─────────────┬─────────────┬──────────────────────────┐ │
│  │ Class              │ Dressage    │ Cross ctry  │ Show jumping             │ │
│  ├────────────────────┼─────────────┼─────────────┼──────────────────────────┤ │
│  │ 80cm  (24 entries) │ ▾ Arena 1   │ ▾ The Bank  │ ▾ Arena 1                │ │
│  │ 90cm  (19 entries) │ ▾ Arena 2   │ ▾ The Bank  │ ▾ Arena 1                │ │
│  │ 100cm (11 entries) │ ▾ Arena 2   │ ▾ The Bank  │ ▾ Arena 2                │ │
│  └────────────────────┴─────────────┴─────────────┴──────────────────────────┘ │
│                                                                                │
│  Order competitors by   ▾ Draw order (random, fixed once generated)            │
│                                                                                │
│                                        [ Generate draft schedule ]             │
└────────────────────────────────────────────────────────────────────────────────┘
```

**A resource's opening hours live on the day**, not on the resource — that is §3.2.1's *sessions*
made visible. Arena 2 closing at 13:00 on Saturday is exactly the fact a naive model loses.

**The warning at the top is not decoration.** Generating a schedule before entries close is the
single most likely way to waste an evening, and the product knows the closing date.

**"Draw order (random, fixed once generated)"** — the parenthesis matters. An organiser who
regenerates must not get a different draw unless they ask for one, or the running order they printed
this morning is wrong.

---

## 4. The editor

The screen the feature lives or dies on. **One day at a time**, resources across, time down.

```
┌────────────────────────────────────────────────────────────────────────────────┐
│  ← Autumn One-Day Event › Schedule                    ● Draft · not published  │
│                                                                                │
│  ◀  Sat 20 Sep  │  Sun 21 Sep  ▶            [ Regenerate ]  [ Publish… ]       │
│  ──────────────────────────────────────────────────────────────────────────    │
│           Arena 1                    Arena 2                                   │
│  ┌──────────────────────────┬──────────────────────────┐                       │
│  09:00 │ 80cm Dressage      │ 90cm Dressage            │                       │
│        │ 1  Aoife Byrne     │ 1  Cian Murphy           │                       │
│  09:08 │ 2  Tom Nolan       │ 2  Sara Field            │                       │
│  09:16 │ 3  Aoife Byrne  ⚠  │ 3  Ruth Lyons            │   ⚠ Aoife Byrne is on │
│        │    (Copper Beech)  │                          │     Kilkea at 09:00 — │
│  09:24 │ 4  Mia Kelly       │ 4  Joe Behan             │     16 minutes apart, │
│        │ …                  │ …                        │     20 required.      │
│  ──────┼────────────────────┼──────────────────────────┤                       │
│  13:00 │ ▨ Lunch (30 min)   │ ▨ Lunch (30 min)         │                       │
│  ──────┼────────────────────┼──────────────────────────┤                       │
│  13:30 │ 80cm Show jumping  │ ⌀ Arena 2 closed 13:00   │                       │
│        │ 1  Tom Nolan       │                          │                       │
│  …                                                                             │
│  ──────────────────────────────────────────────────────────────────────────    │
│  ⚠ 1 warning     ⓘ Warnings do not stop you publishing.   [ Show all (1) ]     │
└────────────────────────────────────────────────────────────────────────────────┘
```

**Drag a row to move it.** After a manual move the constraints become **warnings on the affected
rows**, never refusals — the decision in §3.3. A club with a reason to break its own rule at 9pm the
night before must be able to, and the line at the foot of the screen says so out loud.

**The warning names the conflict in the club's own terms** — *"Aoife Byrne is on Kilkea at 09:00"* —
not *"constraint competitorGapMinutes violated"*. The entity label from §1 is what makes the horse's
name appear here at all.

**A closed resource is drawn, not hidden.** `⌀ Arena 2 closed 13:00` answers *"why can't I drop
anything here?"* in place.

### 4.1 What regenerating does to manual work

```
┌────────────────────────────────────────────────────────────────┐
│  Regenerate the draft?                                         │
│                                                                │
│  You have moved 6 rounds by hand. Regenerating rebuilds the    │
│  whole day and those changes are lost.                         │
│                                                                │
│  ☐ Keep the draw order                                         │
│    Competitors keep their numbers; only the times are rebuilt. │
│                                                                │
│                          [ Cancel ]   [ Regenerate ]           │
└────────────────────────────────────────────────────────────────┘
```

Naming the number of manual changes is the difference between a considered click and a lost evening.

---

## 5. Publishing a schedule

```
┌────────────────────────────────────────────────────────────────────────────────┐
│  Publish the schedule                                                          │
│                                                                                │
│  Autumn One-Day Event · 2 days · 3 resources · 54 rounds                       │
│  ⚠ 1 unresolved warning. Publishing anyway is allowed.                         │
│  ──────────────────────────────────────────────────────────────────────────    │
│  WHO CAN SEE IT                                                                │
│    ☑ Members of Kildare Hunt, on their home screen                             │
│    ☐ Anyone with the link — a public page, no sign-in needed                   │
│                                                                                │
│  ┌──────────────────────────────────────────────────────────────────────────┐  │
│  │ ⓘ A running order names people, and often children.                      │  │
│  │                                                                          │  │
│  │ On the public page, show competitors as                                  │  │
│  │   ◉ Full name              Aoife Byrne                                   │  │
│  │   ○ First name and initial Aoife B.                                      │  │
│  │   ○ Number only            Competitor 3                                  │  │
│  │                                                                          │  │
│  │ Members always see full names.                                           │  │
│  └──────────────────────────────────────────────────────────────────────────┘  │
│                                                                                │
│  [ Cancel ]                                            [ Publish ]             │
└────────────────────────────────────────────────────────────────────────────────┘
```

**Public is off by default and the name choice sits inside the public branch**, because it only means
anything there. This is §5.4 drawn — the decision that needs a decision, not a default.

---

## 6. The member's and the public's schedule

Phone-first, club-branded, and the **same page** whether or not somebody is signed in — only the
names differ.

```
   MEMBER HOME (B3)                    THE SCHEDULE PAGE
 ┌────────────────────────┐        ┌────────────────────────────┐
 │ Kildare Hunt           │        │ ← Autumn One-Day Event     │
 │                        │        │                            │
 │ Coming up              │        │ Running order              │
 │ ┌────────────────────┐ │        │ Updated 19:40, Fri 19 Sep  │
 │ │ 🗓 Autumn One-Day   │ │        │ ─────────────────────────  │
 │ │    Event            │ │        │  Sat 20 Sep │ Sun 21 Sep  │
 │ │    Sat 20 Sep       │ │        │ ─────────────────────────  │
 │ │                     │ │        │ ▾ Arena 1                  │
 │ │  [ Running order ]  │ │        │   09:00  80cm Dressage     │
 │ │  [ Results ]        │ │        │   ┌──────────────────────┐ │
 │ └────────────────────┘ │        │   │ 1  Aoife Byrne       │ │
 │                        │        │   │    Copper Beech      │ │
 │ Notices                │        │   │              09:00   │ │
 │ …                      │        │   ├──────────────────────┤ │
 └────────────────────────┘        │   │ 2  Tom Nolan     ★   │ │
                                   │   │    Ballylinch        │ │
   ★ = you, or somebody you        │   │              09:08   │ │
       entered. Highlighted, and   │   └──────────────────────┘ │
       the page opens there.       │ ▾ Arena 2                  │
                                   │   …                        │
                                   │ [ Download Excel ] [ Print]│
                                   └────────────────────────────┘
```

**"Updated 19:40, Fri 19 Sep" is the most useful line on the page.** Everyone who looks at a running
order has one real question: *is this the current one?*

**Your own rounds are marked and the page opens at them.** A parent scrolling 54 rounds to find their
child is the failure this avoids — and it is the one thing the member's version can do that the
public one cannot.

**Print is a print stylesheet**, not a server-rendered PDF (§5.5): the club's name, the day, the
published time, no navigation. It works on the public page too, so anyone can print a running order.

---

## 7. Scoring

Laptop-first, keyboard-first. **The start list down, the score sheet across** — one row per round.

```
┌────────────────────────────────────────────────────────────────────────────────┐
│  ← Autumn One-Day Event › Results › 80cm                                       │
│                                                                                │
│  Phase  [ Dressage ] [ Cross country ] [ Show jumping ]        24 of 24 scored │
│  ──────────────────────────────────────────────────────────────────────────    │
│  ┌────┬──────────────────┬─────────────┬────────┬────────┬────────┬─────────┐  │
│  │ №  │ Competitor       │ Horse       │ Marks  │  %     │ Pen.   │ Status  │  │
│  ├────┼──────────────────┼─────────────┼────────┼────────┼────────┼─────────┤  │
│  │ 1  │ Aoife Byrne      │ Copper Beech│ [ 128 ]│  64.0  │  36.0  │ ▾ Scored│  │
│  │ 2  │ Tom Nolan        │ Ballylinch  │ [ 141 ]│  70.5  │  29.5  │ ▾ Scored│  │
│  │ 3  │ Aoife Byrne      │ Kilkea      │ [ 119 ]│  59.5  │  40.5  │ ▾ Scored│  │
│  │ 4  │ Mia Kelly        │ Rosco       │ [     ]│        │        │ ▾ E     │  │
│  │    │                  │             │        │        │        │   Elim. │  │
│  └────┴──────────────────┴─────────────┴────────┴────────┴────────┴─────────┘  │
│                                                                                │
│  ⓘ % and penalties are calculated. Tab moves down the column.                  │
│                                                                     [ Saved ]  │
└────────────────────────────────────────────────────────────────────────────────┘
```

**Tab moves *down*, not across.** A scorer works one column at a time from a sheet of papers in
competitor order. Moving across the row is how a form behaves and not how scoring is done.

**Calculated columns are visibly not editable** and update as you type — the % is the check that the
mark was typed correctly.

**Status carries elimination, retirement and withdrawal on the round**, not the entry (§4.3): a
competitor eliminated in the second phase keeps their first-phase score, and the design must not lose
it.

**Saves as you go.** A scorer will close the laptop lid.

---

## 8. Results, and the objections clock

```
┌────────────────────────────────────────────────────────────────────────────────┐
│  ← Autumn One-Day Event › Results                                              │
│                                                                                │
│  ┌──────────────────────────────────────────────────────────────────────────┐  │
│  │  ⏱  Provisional — objections close at 16:45                              │  │
│  │     Published 16:15 by Marie Kelleher. Becomes official automatically.   │  │
│  └──────────────────────────────────────────────────────────────────────────┘  │
│                                                                                │
│  80cm   Individual │ Team                                                      │
│  ┌───────┬──────────────────┬──────────────┬────────┬────────┬─────────┬─────┐ │
│  │ Place │ Competitor       │ Horse        │ Dress. │ XC     │ SJ      │Total│ │
│  ├───────┼──────────────────┼──────────────┼────────┼────────┼─────────┼─────┤ │
│  │  1    │ Tom Nolan        │ Ballylinch   │  29.5  │   0    │    0    │29.5 │ │
│  │  2    │ Aoife Byrne      │ Copper Beech │  36.0  │   0    │    4    │40.0 │ │
│  │  3    │ Ruth Lyons       │ Clonmel Boy  │  38.5  │  2.4   │    0    │40.9 │ │
│  │  —    │ Mia Kelly        │ Rosco        │   —    │   —    │    —    │ E   │ │
│  └───────┴──────────────────┴──────────────┴────────┴────────┴─────────┴─────┘ │
│                                                                                │
│  [ Amend a score ]            [ Download Excel ]  [ Print ]  [ Publish… ]      │
└────────────────────────────────────────────────────────────────────────────────┘
```

**The banner is computed from two columns and the clock** (§4.5) — `published_at` plus the objections
minutes. Nothing runs on a timer, and the page cannot disagree with itself.

**After the window closes:**

```
│  ✓  Official — since 16:45 on Sat 20 Sep                                       │
```

**After an amendment:**

```
│  ⚠  Amended — 18:02, after this result became official                         │
│     Aoife Byrne · Show jumping · 4 → 8 · “Second refusal missed on the sheet”  │
│     Was published 16:15. [ See what was published before ]                     │
```

**An amendment is loud, and keeps the previous snapshot addressable.** A silently corrected official
result is worse than a wrong one, because nobody knows to look — and the correction reason is the
first thing anybody asks for.

---

## 9. Teams

```
┌────────────────────────────────────────────────────────────────────────────────┐
│  Autumn One-Day Event › Teams                                                  │
│                                                                                │
│  Teams come from   ◉ The entry form — “Team name”                              │
│                    ○ Assigned here by hand                                     │
│  Score             ◉ Individual and team    ○ Team only    ○ Individual only   │
│  ──────────────────────────────────────────────────────────────────────────    │
│  ⚠ Two team names look like the same team.                                     │
│    “Kildare” (3)   and   “Kildare Hunt” (2)          [ Merge… ]                │
│                                                                                │
│  ┌────────────────────┬──────────┬────────────────────────────────────────────┐│
│  │ Team               │ Members  │                                            ││
│  ├────────────────────┼──────────┼────────────────────────────────────────────┤│
│  │ Kildare Hunt       │ 5        │  View    Rename    Merge                   ││
│  │ Laois Hunt         │ 4        │  View    Rename    Merge                   ││
│  │ Ward Union         │ 3        │  View    Rename    Merge                   ││
│  │ Meath Hunt         │ 2  ⚠     │  View    Rename    Merge                   ││
│  │   ⓘ Fewer than the 3 scores needed — this team will not be placed.        ││
│  └────────────────────┴──────────┴────────────────────────────────────────────┘│
└────────────────────────────────────────────────────────────────────────────────┘
```

**The near-duplicate warning is the whole reason the form-field option is usable.** "Kildare" and
"Kildare Hunt" typed by two parents are one team, and finding that out when the results are published
is finding out too late.

**A team that cannot be placed says so before the day**, not afterwards — `minimumScorers` from
§4.6.3, surfaced where it can still be fixed.

### 9.1 The team result, with the dropped score shown

```
│  80cm   Individual │ ► Team                                                    │
│  ┌───────┬──────────────────┬───────────────────────────────────┬────────────┐ │
│  │ Place │ Team             │ Counting scores                   │ Total      │ │
│  ├───────┼──────────────────┼───────────────────────────────────┼────────────┤ │
│  │  1    │ Kildare Hunt     │ 29.5 + 40.0 + 40.9   (54.2 dropped)│  110.4     │ │
│  │  2    │ Laois Hunt       │ 33.0 + 41.2 + 44.8   (E dropped)   │  119.0     │ │
│  │  —    │ Meath Hunt       │ only 2 scores — not placed        │   —        │ │
│  └───────┴──────────────────┴───────────────────────────────────┴────────────┘ │
```

**The dropped score is shown, not hidden.** It is the tie-break (§4.6.3), so the system keeps it
anyway — and showing it is what makes a team total something a club can check rather than take on
trust.

---

## 10. What the drawing settled

Things that were a paragraph in the proposal and became a decision here.

| | |
|---|---|
| **The `From` column on every setting** | Inheritance is invisible until something is wrong, and then "where did 20 minutes come from?" is the only question. §2 |
| **Warnings live on the row *and* at the foot** | A conflict two screens down is a conflict nobody sees. §4 |
| **Regenerate names how many manual moves it will discard** | The difference between a considered click and a lost evening. §4.1 |
| **The draw is fixed once generated** | Regenerating times must not reshuffle numbers already printed. §3 |
| **A closed resource is drawn, not hidden** | Answers "why can't I drop here?" in place. §4 |
| **Tab moves down the column, not across the row** | A scorer works from a pile of sheets in competitor order. §7 |
| **The member's schedule opens at their own rounds** | The one thing the member version can do that the public one cannot. §6 |
| **The dropped score is shown** | It is the tie-break, so it is kept anyway; showing it makes the total checkable. §9.1 |
| **Two team names that look alike are flagged before the day** | The failure mode that makes form-field teams usable at all. §9 |

### Still to draw, when they are next

- The **public** schedule and results pages at desktop width — the phone layout above is the
  constraint that matters, but a shared link is opened on a laptop as often as not.
- The **print** view itself, which is a different document from the screen.
- `heats-and-finals` and `bracket` editors — deliberately not drawn, because the slot model (§3.3)
  is what has to hold, and drawing an editor for a scheduler nobody has specified would be inventing
  requirements.
