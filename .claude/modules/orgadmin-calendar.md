# `packages/orgadmin-calendar` — Calendar bookings capability module

Bookable resources (moorings, berths, rooms, courts) with schedules, time slots, blocked periods
and a booking workflow.

- **Capability:** `calendar-bookings`. Discount pages gate on `calendar-discounts`.
- **Display icon:** each calendar carries a `display_icon` from the shared curated set
  (`components/CalendarIcon`), chosen beside its colour and drawn in that colour wherever the
  calendar is offered. Falls back to a generic mark rather than rendering nothing. See
  `docs/BOOKINGS_NAMING_AND_CALENDAR_ICONS.md`.
- **Demo data:** the seed gives **only Laois Hunt** bookings — 4 calendars covering exclusive and
  shared places, a fortnightly pattern, a blocked week, a recurring gap, cancellation allowed and
  refused, and a closed calendar. See `docs/EVENTS_DEMO_SEED.md`.
- **Tests:** Vitest — `npm run test:orgadmin-calendar` (~3 test files; light coverage — add tests
  with new work).

## Routes (`src/index.ts`)

| Path | Page | Capability |
|---|---|---|
| `calendar` | `CalendarsListPage` | — |
| `calendar/new` | `CreateCalendarPage` | — |
| `calendar/:id` | `CalendarDetailsPage` | — |
| `calendar/:id/edit` | `CreateCalendarPage` (edit mode) | — |
| `calendar/bookings` | `BookingsListPage` | — |
| `calendar/bookings/calendar-view` | `BookingsCalendarPage` | — |
| `calendar/bookings/:id` | `BookingDetailsPage` | — |
| `calendar/discounts` | `DiscountsListPage` | `calendar-discounts` |
| `calendar/discounts/new` | `CreateDiscountPage` | `calendar-discounts` |
| `calendar/discounts/:id/edit` | `EditDiscountPage` | `calendar-discounts` |

## Layout

```
src/
  index.ts        calendarModule registration
  pages/          The pages above
  components/
    CalendarForm                    Calendar definition
    ScheduleRulesSection            Recurring availability rules
    TimeSlotConfigurationSection    Slot length, duration options
    BlockedPeriodsSection           Maintenance/closure windows
    EmbeddedCalendarView            Month/week/day grid
    CalendarToolbar                 View switching and navigation
    BookingDetailsPanel, ReservedSlotPanel
    ReserveSlotDialog, ReleaseBookingDialog, CancelBookingDialog
  hooks/useCalendarView.ts          View state (range, granularity, navigation)
  utils/
    slotAvailabilityCalculator.ts   Schedule rules + blocked periods + bookings → free slots
    cancellationValidator.ts        Whether a booking may be cancelled/released
  types/          calendar.types, module.types
```

## Concepts

- **Calendar** — a bookable resource with schedule rules, time-slot configuration, duration
  options and blocked periods (`calendars`, `schedule_rules`, `time_slot_configurations`,
  `duration_options`, `blocked_periods`).
- **Availability** — derived, never stored. `slotAvailabilityCalculator` subtracts blocked periods
  and existing bookings from the schedule. Availability bugs almost always live there.
  **There is a second implementation**, `backend/src/utils/slot-availability.ts`, which answers the
  same question for the member-facing app — a booking cannot be decided in the browser. Change one
  rule and you must change both; both suites cover the same cases
  ([docs/ACCOUNT_USER_APP_PHASE11_CATALOGUE_COMPLETION.md](../../docs/ACCOUNT_USER_APP_PHASE11_CATALOGUE_COMPLETION.md)).
- **Booking lifecycle** — reserve → confirm → cancel/release, each with its own dialog, audited in
  `booking_history`. `cancellationValidator` owns the rules about what is permitted when — and, like
  the availability calculator, **has a second implementation on the server**
  (`backend/src/utils/booking-cancellation.ts`) because a member cancelling their own booking cannot
  be decided in the browser. Change a rule and you must change both.
- **Two views** — a list (`BookingsListPage`) and a calendar grid (`BookingsCalendarPage`) over the
  same data.

## Data it touches

`/api/orgadmin/calendars`, `/api/orgadmin/bookings` and related endpoints, plus calendar discounts.
Backend: `calendar.service`, `discount*.service`. Tables: `calendars`, `bookings`,
`booking_history`, `blocked_periods`, `schedule_rules`, `time_slot_configurations`,
`duration_options`.

## Where to look for what

| Question | Start at |
|---|---|
| "Why is this slot shown as unavailable?" | `utils/slotAvailabilityCalculator.ts` |
| "Why can't this booking be cancelled?" | `utils/cancellationValidator.ts` |
| "How is recurring availability defined?" | `components/ScheduleRulesSection.tsx` |
| "How does the grid switch views?" | `hooks/useCalendarView.ts` + `CalendarToolbar` |

## Deleting a calendar withdraws it; bookings are cancelled, not deleted

`deleteCalendar` is a **soft delete** — see [docs/SOFT_DELETE.md](../../docs/SOFT_DELETE.md).
`bookings` reference calendars, and the refund trail hangs off them.

**Bookings themselves have no `deleted` flag, deliberately.** `booking_status`, `cancelled_at`,
`cancelled_by` and `cancellation_reason` already model this, and `cancelBookingWithRefund` uses
them — cancellation carries more than a boolean would. Adding a second flag would mean every query
had to check both.
