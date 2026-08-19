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
| `events` | `EventsListPage` | — |
| `events/new` | `CreateEventPage` | — |
| `events/:id` | `EventDetailsPage` | — |
| `events/:id/edit` | `EditEventPage` | — |
| `events/:id/entries` | `EventEntriesPage` | — |
| `events/types` | `EventTypesListPage` | `event-types` |
| `events/venues` | `VenuesListPage` | `venues` |
| `events/discounts` | `DiscountsListPage` | `entry-discounts` |
| `events/discounts/new` | `CreateDiscountPage` | `entry-discounts` |
| `events/discounts/:id/edit` | `CreateDiscountPage` (edit mode) | `entry-discounts` |

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

- `/api/orgadmin/events`, `/events/:id/activities`, `/events/:id/entries`
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
cheque/offline instructions, and discount ids. Payment methods are classified by name — a method
containing `card`, `stripe` or `helix` counts as a card method, which is what reveals the
handling-fee option.

## Documentation

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
| "Which page owns this URL?" | The route table in `src/index.ts` |
| "How do discounts attach to an activity?" | `services/discount.service.ts` + `DiscountSelector` from `packages/components` |
