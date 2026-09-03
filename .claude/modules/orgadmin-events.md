# `packages/orgadmin-events` — Events capability module

Lets an organisation publish events, define the activities people enter, take entries and manage
event-level discounts, types and venues.

- **Capability:** `event-management` (module-level). Sub-areas gate on `event-types`, `venues`,
  `entry-discounts`.
- **Tests:** Vitest — `npm run test:orgadmin-events` (~23 test files).
- **Related:** `orgadmin-ticketing` adds electronic tickets to events; the Forms area of
  `orgadmin-core` supplies the application forms activities reference.

## Routes (`src/index.ts`)

| Path | Page | Capability |
|---|---|---|
| `events` | `EventsListPage` | — |  <!-- columns: name, dates, status, entries, entry limit, discounts, actions -->
| `events/new` | `CreateEventPage` | — |
| `events/:id` | `EventDetailsPage` | — |
| `events/:id/edit` | `EditEventPage` | — |
| `events/:id/entries` | `EventEntriesPage` | — |  <!-- grouped by activity: name, email, entered, status -->
| `events/:id/entries/:entryId` | `EventEntryDetailsPage` | — |  <!-- Edit opens EditEntryAnswersDialog: the entrant's name plus every field of the activity's form -->
| `events/types` | `EventTypesListPage` | `event-types` |
| `events/venues` | `VenuesListPage` | `venues` |
| `events/discounts` | `DiscountsListPage` | `entry-discounts` |
| `events/discounts/new` | `CreateDiscountPage` | `entry-discounts` |
| `events/discounts/:id/edit` | `CreateDiscountPage` (edit mode) | `entry-discounts` |
| `events/discounts/:id/stats` | `DiscountUsagePage` | `entry-discounts` |  <!-- shared: memberships, merchandise and calendar mount it too -->

## Layout

```
src/
  index.ts                 eventsModule registration (routes, menu, card)
  pages/                   The nine pages above
  components/
    EventActivityForm      One activity within an event — the densest form in the module
    sections/              EventBasicInfoSection, EventDatesSection,
                           EventTicketingSection, EventActivitiesSection
    CollapsibleSection, SidebarNavigation, StickySaveBar
    EventEntryDetailsDialog
  hooks/
    useEventForm           Form state, load/populate, activity add/update/remove, field errors
    useEventValidation     validateAll (save) and validateStep (wizard) — shared by both pages
    useDiscountService, useSectionObserver
  services/discount.service.ts
  types/                   event.types, discount.types, module.types
```

## Create vs edit

Two pages over one shared form model:

- **`CreateEventPage`** — a five-step wizard: Basic Information (0), Event Dates (1), Ticketing (2),
  Activities (3), Review & Confirm (4). "Next" calls `validateStep`; saving calls `validateAll`.
- **`EditEventPage`** — a single scrolling page of the same sections with sidebar navigation and a
  sticky save bar. Saving calls `validateAll`.

Both render the same section components, so a change to a section affects both flows. Validation
lives in `useEventValidation` precisely so the two flows cannot drift apart.

## Validation rules (`hooks/useEventValidation.ts`)

- Basic info: `name` and `description` are required.
- Activities: at least one activity; every activity needs a non-blank name and description; **every
  activity must have an application form selected**. The checks short-circuit in that order, so
  only the most fundamental error is surfaced at a time.

`EventActivityForm` mirrors this: the Application Form dropdown's placeholder is disabled (a
selection can be changed but not cleared) and the field renders in error state once the parent
passes `showErrors`, which `EventActivitiesSection` derives from `fieldErrors.activities`.

## Data it touches

- `/api/orgadmin/events`, `/events/:id/activities`, `/events/:id/entries`,
  `/events/:id/entries/:entryId` (the entry in full: activity, fee, form answers, the payment it
  arrived on, the member behind the entrant), `PUT /events/:id/entries/:entryId/answers`
  (correcting the name and the answers)
- `/api/orgadmin/application-forms/:formId/with-fields` (the fields the editor offers, including the
  ones nobody answered)
- `/api/orgadmin/event-types`, `/api/orgadmin/venues`
- `/api/orgadmin/organisations/:orgId/application-forms`
- `/api/orgadmin/organisations/:orgId/discounts/events`
- `/api/orgadmin/payment-methods` (which methods an activity may accept)

Backend counterparts: `event.service`, `event-activity.service`, `event-entry.service`,
`event-type.service`, `venue.service`, `discount*.service`, `application-form.service`.

## Activities

An activity is what someone actually enters. It carries name, description, public visibility, a
**mandatory** application form, an **entry eligibility**, optional applicant limits and quantity, optional terms and
conditions (rich text via `react-quill`), fee, supported payment methods, a handling-fee flag,
cheque/offline instructions, discount ids, and **how many people one of its tickets admits**
(`ticketsAdmit`, minimum 1). Payment methods are classified by name — a method containing `card`,
`stripe` or `helix` counts as a card method, which is what reveals the handling-fee option.

`ticketsAdmit` is the club's gate setting — labelled **Scans allowed per ticket** — 1 for a day
ticket, 4 for a family ticket. It is enforced by the gate *and* by the org-admin's own *Mark as
scanned*. It is
**copied onto each ticket at issue** (`electronic_tickets.admits`) rather than read live, so raising
it in March does not change what a ticket sold in February lets somebody through with. Note that
cloning an event carries it — along with `entryEligibility`, which the clone was silently dropping
until this landed, quietly reopening a members-only activity to everybody. See
[GATE_SCANNING.md](../../docs/GATE_SCANNING.md).

## Documentation

### Show publicly (`showOnOrganisationPage`, `showOnPlatformPage`)

Two booleans on the event, both false by default. `(false, false)` **is** "Show publicly: No" — the
Yes/No radio on `EventBasicInfoSection` is derived from "is either one on", so unticking both turns
it off and there is no invalid state to validate. The second checkbox needs the `public-search`
capability.

A public event appears at `/account/{urlCode}/whats-on` and, with the second flag, on the platform
listing at `/events`. Draft events never reach either — the public read requires
`status = 'published'` as well as the flag.

`VenuesListPage` carries a **region** field. It is the only value the public listings can filter
locations on: `venues.address` is prose and cannot be filtered without parsing it.

See [PUBLIC_EVENTS.md](../../docs/PUBLIC_EVENTS.md).

### Who can enter (`entryEligibility`)

Three values, defaulting to `'all'` — which is the previous behaviour, so every existing activity is
unchanged:

| Value | Meaning | Offered when |
|---|---|---|
| `all` | anyone with an account | always |
| `members` | an active membership of **this** club | `memberships` capability **and** the club has members |
| `org-type-members` | an active membership of **any** club of the same organisation type | `organisation-level-members` capability |

The two gates are independent: a club with the federation capability but no members of its own sees
the third option and not the second. Nothing is offered at all when neither holds, and the field is
not rendered — a setting whose only possible effect is to lock everyone out is worse than no setting.

`organisation-level-members` also makes the event visible to account users of every **other** club of
the same type, so choosing it reaches outside the organisation. See
[MEMBERS_ONLY_ENTRIES.md](../../docs/MEMBERS_ONLY_ENTRIES.md).

## Documentation

`docs/EVENTS_MODULE_WIREFRAMES.md` holds the wireframes and the activity validation rules table.
Several `docs/EVENT_*.md` and `docs/DISCOUNT_*.md` files record specific fixes.

## Where to look for what

| Question | Start at |
|---|---|
| "Why won't the event save / the wizard advance?" | `hooks/useEventValidation.ts` |
| "Where is this field on the activity form?" | `components/EventActivityForm.tsx` |
| "How is form state managed?" | `hooks/useEventForm.ts` |
| "Where does an entry's name come from?" | The entry's own `first_name`/`last_name`, written by `fulfilment.service` from the membership named in the basket line, else the name typed into "Who is this entry for?", else the account holder. **Not** from the form — entry forms no longer ask. Screens show the two **joined**: the split is a storage detail (`splitName` cuts at the first space), not something the club asked for |
| "What is in the entries export?" | One sheet per activity: `Entry Date · Name · ‹the form's own questions› · Email · Payment Method · Entered By · Entry ID · Status`. A column for **every** field of that activity's form, read from `application_form_fields`, so a question nobody answered still has one. **Entered By** is the account holder who made the entry, not the entrant. `eventEntryService.exportEntriesToExcel`; see [EXCEL_EXPORTS_WERE_NOT_WORKBOOKS.md](../../docs/EXCEL_EXPORTS_WERE_NOT_WORKBOOKS.md). The members export follows the same shape, one sheet per membership type — [MEMBERS_EXPORT_AND_NAME_LINK.md](../../docs/MEMBERS_EXPORT_AND_NAME_LINK.md) |
| "Which events issue tickets?" | The ones with an `event_ticketing_config` row where `generate_electronic_tickets` is true — written by the event form's ticketing step. In the seed, two Meath events; see [SEED_TICKETS.md](../../docs/SEED_TICKETS.md) |
| "Why is an entry missing from the list?" | `entry_status = 'removed'` — withdrawn when its payment was refunded and the club chose to. `getEntriesByEvent` excludes them unless `includeRemoved`; the entry's own page still opens and is headed by a withdrawal notice |
| "Where does the discounts list's View Usage icon go?" | `‹section›/discounts/:id/stats` → `DiscountUsagePage`, shared the way `DiscountsListPage` is and mounted by events, memberships, merchandise and calendar under the same capability as the list. It 404'd in every module until it was built: the navigation lives here and the routing lives in four other packages, so nothing joined them up. `discount-usage-route.test.ts` now does. See [DISCOUNT_USAGE_PAGE.md](../../docs/DISCOUNT_USAGE_PAGE.md) |
| "Why is the entries page grouped?" | A club works in classes: the entries for the 80cm are a class list, and a flat table across six of them is not one. Grouped by activity **id**, not name — a two-day event runs "80cm" on both days. See [REFUNDS_SETTLEMENT_AND_ENTRY_DETAIL.md](../../docs/REFUNDS_SETTLEMENT_AND_ENTRY_DETAIL.md) |
| "Can an administrator fix a mistake on an entry?" | Yes — **Edit**, beside "Who entered" on `EventEntryDetailsPage`, opening `EditEntryAnswersDialog`: the entrant's name as one field plus **every** field of the activity's form, answered or not, fetched from `/application-forms/:formId/with-fields` (the summary drops blanks, which is right for reading and useless for editing). Saves `PUT /events/:id/entries/:entryId/answers` → `eventEntryService.updateEntryAnswers`, validated with `validateSubmissionData` and audited as `entry.answers-corrected`. Everything is checked before anything is written, so a refused correction renames nobody. See [CORRECTING_AN_ENTRY.md](../../docs/CORRECTING_AN_ENTRY.md) |
| "Where can I see what an entrant put on the form?" | `EventEntryDetailsPage` → `GET /events/:id/entries/:entryId` → `eventEntryService.getEntryById`, which joins the answers with `formSummariesFor`. The form itself is gone once the entry exists, so this is the only place they can be read back. `EventEntryDetailsDialog` is a superseded component: never mounted, and its API hook is a stub |
| "Where does the entries count on the list come from?" | `Event.entryCount`, a `COUNT(*)` of `event_entries` added to `getEventsByOrganisation` only. It is the same count the event-level limit is checked against and the same set `GET /events/:id/entries` lists, so the number and the screen it links to agree. `undefined` elsewhere means *not counted*, which the list renders as an em dash rather than `0` |
| "Why does an event have entry dates nobody set?" | It used to. `useEventForm` filled an absent entry window with `new Date()`, so opening an event and saving anything wrote the load time into both columns. Now absent stays absent. `docs/EVENT_ENTRY_DATE_INVENTION_FIX.md` |
| "Which event dates are required?" | **All four** — start, end, entry opening, entry closing. `useEventValidation.validateDates` on save and on the wizard's step 1; `eventService.createEvent` refuses a create missing any, and `updateEvent` refuses to clear one. The **columns stay nullable**: pre-rule events and the seed's deliberately ungated `Ward Union Open Day` still read correctly, and a null window still means *unbounded* in `public-event.service` |
| "Which page owns this URL?" | The route table in `src/index.ts` |
| "Is there anything for scheduling a running order, or scoring an event?" | **No — proposed, not built.** [EVENT_SCHEDULING_AND_SCORING_PROPOSAL.md](../../docs/EVENT_SCHEDULING_AND_SCORING_PROPOSAL.md) works both through: platform-level **event type templates** carrying a scheduling and a scoring model, a generic resource-and-phases scheduler configured per discipline, score sheets built on the existing Form Builder, and publishing to the member's home screen and to a public no-login URL. Revision 2 folds in the answers: tennis and swimming are later disciplines (so the unit is a **slot** with one or more participants, not one competitor), results may be **official** (a `provisional → final → amended` lifecycle on the existing audit trail), and the scheduled **entity** resolves from a registration or a nominated form field. Revision 3 adds a **settings chain** (template → organisation type → club → event, with an unoverridable *shape*), club-named resources, **multi-day** schedules built on resource *sessions*, an objections window derived from `published_at` rather than stored, and Excel/print export. Scheduling ships before scoring. Note the findings that shape it: `event_types` is club-owned free text with no behaviour, nothing links an entry to a registration, no form field type picks one, and **there is no backend PDF engine**. Revision 4 adds **team scoring** — membership resolved from a form field or assigned by hand, `individual｜team｜both`, and `best-n-of-m` drop scores — reusing the entity resolver and the calculator seam rather than adding mechanisms. Wireframes: [EVENT_SCHEDULING_AND_SCORING_WIREFRAMES.md](../../docs/EVENT_SCHEDULING_AND_SCORING_WIREFRAMES.md); task breakdown for the first two phases: [EVENT_SCHEDULING_TASKS_S0_S1.md](../../docs/EVENT_SCHEDULING_TASKS_S0_S1.md). **Nothing is implemented** |
| "How do discounts attach to an activity?" | `services/discount.service.ts` + `DiscountSelector` from `packages/components` |
