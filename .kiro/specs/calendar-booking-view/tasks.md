# Implementation Plan: Calendar Booking View

## Overview

Transform the placeholder `BookingsCalendarPage` into a fully interactive calendar booking management interface. Implementation spans three layers: database migration for `slot_reservations`, backend API endpoints for reservations and booking cancellation with refund, and frontend components using `react-big-calendar` with MUI dialogs/drawers. Tasks are ordered database → backend → frontend types → hook → page → dialogs → translations to ensure each step builds on the previous.

## Tasks

- [x] 1. Database migration and backend data layer
  - [x] 1.1 Create migration 013 for slot_reservations table
    - Create `packages/backend/src/database/migrations/013_create_slot_reservations.sql`
    - Define `slot_reservations` table with columns: `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`, `calendar_id UUID NOT NULL REFERENCES calendars(id) ON DELETE CASCADE`, `reserved_by UUID NOT NULL`, `slot_date DATE NOT NULL`, `start_time TIME NOT NULL`, `duration INTEGER NOT NULL`, `reason TEXT`, `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`, `updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`
    - Add UNIQUE constraint on `(calendar_id, slot_date, start_time, duration)`
    - Add index `idx_slot_reservations_calendar_date` on `(calendar_id, slot_date)`
    - _Requirements: 6.1, 6.5_

  - [x] 1.2 Add reservation service methods to CalendarService
    - In `packages/backend/src/services/calendar.service.ts`:
    - Add `SlotReservation` interface and `rowToReservation` private mapper
    - Add `getReservationsByCalendarAndDateRange(calendarId, start, end)` — query `slot_reservations` WHERE `slot_date BETWEEN start AND end`
    - Add `createReservation(calendarId, reservedBy, slotDate, startTime, duration, reason?)` — INSERT into `slot_reservations`, return 409 if unique constraint violated (slot already reserved) or if slot is fully booked
    - Add `deleteReservation(id)` — DELETE from `slot_reservations` by ID
    - Add `cancelBookingWithRefund(bookingId, cancelledBy, reason, refund)` — UPDATE bookings SET `booking_status='cancelled'`, `cancelled_by`, `cancellation_reason`, `cancelled_at=NOW()`, and `refund_processed=refund`
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_

  - [ ]* 1.3 Write property test: fetch reservations returns exactly those in date range
    - Test file: `packages/backend/src/services/__tests__/calendar-reservations-date-range.property.test.ts`
    - Generate random sets of reservations with various `slotDate` values and random date ranges using fast-check
    - Verify that querying with `[start, end]` returns exactly the reservations whose `slotDate` falls within that range
    - **Property 10: Fetch reservations returns exactly those in date range**
    - **Validates: Requirements 6.3**

  - [ ]* 1.4 Write property test: reserving an already-reserved or fully-booked slot fails
    - Test file: `packages/backend/src/services/__tests__/calendar-reservation-conflict.property.test.ts`
    - Generate random slot parameters, create a reservation, attempt to reserve the same slot again, verify 409/error
    - Also test reserving a slot that has reached booking capacity
    - **Property 11: Reserving an already-reserved or fully-booked slot fails**
    - **Validates: Requirements 6.4**

  - [ ]* 1.5 Write property test: cancellation with refund sets correct booking fields
    - Test file: `packages/backend/src/services/__tests__/calendar-cancellation-refund.property.test.ts`
    - Generate random booking data with `paymentStatus='paid'`, cancel with `refund: true`, verify `bookingStatus='cancelled'`, `cancelledBy` matches admin ID, `cancellationReason` matches input, `refundProcessed=true`
    - **Property 12: Cancellation with refund sets correct booking fields**
    - **Validates: Requirements 6.6**

- [x] 2. Backend API routes for reservations and booking cancellation
  - [x] 2.1 Add reservation and cancellation endpoints to calendar routes
    - In `packages/backend/src/routes/calendar.routes.ts`:
    - Add `GET /calendars/:calendarId/bookings/range?start=&end=` — fetch bookings for a calendar within a date range, calls `getBookingsByCalendarAndDateRange`
    - Add `GET /calendars/:calendarId/reservations?start=&end=` — fetch reservations for a calendar within a date range
    - Add `POST /calendars/:calendarId/reservations` — reserve a time slot, accepts `{ slotDate, startTime, duration, reason? }`, uses `req.user.id` as `reservedBy`
    - Add `DELETE /reservations/:id` — free a reserved slot
    - Add `POST /bookings/:id/cancel` — cancel a booking with `{ reason, refund }` body, uses `req.user.id` as `cancelledBy`
    - All endpoints use `authenticateToken()` middleware
    - Reservation endpoints use `requireCalendarBookingsCapability` guard
    - _Requirements: 6.1, 6.2, 6.3, 6.6_

  - [x] 2.2 Add getBookingsByCalendarAndDateRange to CalendarService
    - In `packages/backend/src/services/calendar.service.ts`:
    - Add `getBookingsByCalendarAndDateRange(calendarId, start, end)` — query bookings WHERE `calendar_id = calendarId AND booking_date BETWEEN start AND end AND booking_status = 'confirmed'`
    - Include user name and email via JOIN or subquery
    - _Requirements: 1.6, 2.1, 2.2_

- [x] 3. Checkpoint — Verify database migration and backend API
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 4. Frontend types and slot generation with reservation awareness
  - [x] 4.1 Add SlotReservation and request/response types
    - In `packages/orgadmin-calendar/src/types/calendar.types.ts`:
    - Add `SlotReservation` interface: `id`, `calendarId`, `reservedBy`, `slotDate` (string YYYY-MM-DD), `startTime` (HH:MM), `duration` (minutes), `reason?`, `createdAt`, `updatedAt`
    - Add `ReserveSlotRequest` interface: `calendarId`, `slotDate`, `startTime`, `duration`, `reason?`
    - Add `CancelBookingRequest` interface: `reason`, `refund` (boolean)
    - Add `CalendarEvent` interface for react-big-calendar: `id`, `title`, `start` (Date), `end` (Date), `resource: { slot: CalendarSlotView, status: 'available' | 'booked' | 'reserved' }`
    - Extend `CalendarSlotView` with `isReserved: boolean` and `reservation?: SlotReservation`
    - _Requirements: 3.6, 4.1, 6.1_

  - [x] 4.2 Update slotAvailabilityCalculator to merge reservation status
    - In `packages/orgadmin-calendar/src/utils/slotAvailabilityCalculator.ts`:
    - Add `reservations: SlotReservation[]` parameter to `calculateAvailableSlots`
    - After calculating places remaining, merge reservation status: for each slot, check if a matching reservation exists (same date, startTime, duration) and set `isReserved = true` and attach the `reservation` object
    - A reserved slot should have `isAvailable = false`
    - _Requirements: 1.4, 1.5, 3.6_

  - [ ]* 4.3 Write property test: slot generation matches time slot configurations
    - Test file: `packages/orgadmin-calendar/src/utils/__tests__/slotAvailabilityCalculator.generation.property.test.ts`
    - Generate random `TimeSlotConfiguration` arrays and date ranges using fast-check
    - Verify generated slots match configurations for matching days-of-week and recurrence patterns, minus blocked periods
    - **Property 2: Slot generation matches time slot configurations**
    - **Validates: Requirements 1.4**

  - [ ]* 4.4 Write property test: reserve then free round-trip restores available status
    - Test file: `packages/orgadmin-calendar/src/utils/__tests__/slotAvailabilityCalculator.reserve-free.property.test.ts`
    - Generate random available slots, add a reservation, verify `isReserved=true` and `isAvailable=false`, remove the reservation, verify `isReserved=false` and `isAvailable=true`
    - **Property 6: Reserve then free round-trip restores available status**
    - **Validates: Requirements 3.4, 4.5, 6.1, 6.2**

- [ ] 5. Custom hook: useCalendarView
  - [x] 5.1 Create useCalendarView hook
    - Create `packages/orgadmin-calendar/src/hooks/useCalendarView.ts`
    - Implement the `UseCalendarViewReturn` interface from the design
    - Fetch calendars list on mount using `useApi`
    - When `selectedCalendarId` changes, fetch time slot configurations, blocked periods, bookings (date range), and reservations (date range) for the visible date range
    - Use `calculateAvailableSlots` to generate `CalendarSlotView[]` from configs + bookings + reservations
    - Implement `selectCalendar(id)`, `setDateRange(start, end)`, `reserveSlot(data)`, `freeSlot(reservationId)`, `releaseBooking(bookingId, reason, refund)`, `refresh()`
    - Do NOT include `execute` from `useApi` in `useCallback`/`useEffect` dependency arrays
    - On mutation success (reserve/free/release), call `refresh()` to reload data
    - _Requirements: 1.4, 1.6, 1.9, 3.3, 3.4, 4.4, 5.6, 5.7_

- [ ] 6. BookingsCalendarPage and CalendarToolbar
  - [x] 6.1 Refactor BookingsCalendarPage with react-big-calendar
    - In `packages/orgadmin-calendar/src/pages/BookingsCalendarPage.tsx`:
    - Replace placeholder content with full implementation using `useCalendarView` hook
    - Manage state: `viewMode` ('day' | 'week' | 'month') defaulting to 'week', `currentDate`, dialog/drawer open states
    - Render `react-big-calendar` `Calendar` component with `localizer` (use `momentLocalizer` or `dateFnsLocalizer`), `events` mapped from `slots` to `CalendarEvent[]`, custom `components.toolbar` and `components.event`
    - Map each `CalendarSlotView` to a `CalendarEvent` with colour-coded status: available=green, booked=blue, reserved=grey
    - On event click: dispatch to `BookingDetailsPanel` (booked), `ReserveSlotDialog` (available), or `ReservedSlotPanel` (reserved) based on `event.resource.status`
    - Handle `onNavigate` to update `currentDate` and trigger date range refetch
    - Handle `onView` to update `viewMode` without changing `currentDate`
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9_

  - [x] 6.2 Create CalendarToolbar component
    - Create `packages/orgadmin-calendar/src/components/CalendarToolbar.tsx`
    - Custom toolbar replacing react-big-calendar default toolbar
    - Render view mode toggle buttons (day/week/month), date navigation (previous/next/today), current date range label
    - Include calendar selector dropdown (receives calendars list and selected ID from props)
    - Use MUI `ToggleButtonGroup`, `IconButton`, `Select` components
    - All labels use translation keys
    - _Requirements: 1.2, 1.7, 1.8, 1.9_

  - [ ]* 6.3 Write property test: view mode switch preserves date context
    - Test file: `packages/orgadmin-calendar/src/pages/__tests__/BookingsCalendarPage.view-mode.property.test.tsx`
    - Generate random dates and view mode transitions using fast-check
    - Verify that switching view mode does not change the currently focused date
    - **Property 1: View mode switch preserves date context**
    - **Validates: Requirements 1.3**

  - [ ]* 6.4 Write property test: slot status maps to distinct visual indicator
    - Test file: `packages/orgadmin-calendar/src/pages/__tests__/BookingsCalendarPage.slot-status.property.test.tsx`
    - Generate random slot statuses (available, booked, reserved) using fast-check
    - Verify each status maps to a visually distinct colour/class different from the other two
    - **Property 3: Slot status maps to distinct visual indicator**
    - **Validates: Requirements 1.5, 3.6**

- [x] 7. Checkpoint — Verify calendar page renders with slot data
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 8. BookingDetailsPanel and ReleaseBookingDialog
  - [x] 8.1 Create BookingDetailsPanel component
    - Create `packages/orgadmin-calendar/src/components/BookingDetailsPanel.tsx`
    - MUI `Drawer` (anchor="right") that opens when clicking a booked slot
    - Receives `open`, `slot: CalendarSlotView | null`, `onClose`, `onRelease(booking: Booking)` props
    - Display all confirmed bookings for the slot (supports multi-capacity slots per Req 2.2)
    - Per booking: render booking reference, user name, user email, booking date, start time, end time, duration, places booked, total price, payment status, booking status
    - Include "View Full Details" link per booking navigating to `BookingDetailsPage` (use React Router `Link`)
    - Include "Release Slot" button per booking that calls `onRelease(booking)`
    - On close, return focus to the calendar grid (use `onClose` callback)
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 5.1_

  - [x] 8.2 Create ReleaseBookingDialog component
    - Create `packages/orgadmin-calendar/src/components/ReleaseBookingDialog.tsx`
    - MUI `Dialog` following the existing `CancelBookingDialog` pattern
    - Receives `open`, `booking: Booking | null`, `onClose`, `onConfirm(reason, refund)` props
    - Display booking reference and user name
    - Cancellation reason text field (required)
    - Conditional refund checkbox: shown only when `booking.paymentStatus === 'paid'`
    - On confirm: call `onConfirm(reason, refund)` — parent wires to `releaseBooking` from `useCalendarView`
    - _Requirements: 5.2, 5.3, 5.4, 5.5, 5.6, 5.7_

  - [ ]* 8.3 Write property test: booking details panel renders all confirmed bookings with required fields
    - Test file: `packages/orgadmin-calendar/src/components/__tests__/BookingDetailsPanel.bookings.property.test.tsx`
    - Generate random arrays of 1-5 confirmed bookings with all required fields using fast-check
    - Render `BookingDetailsPanel` with a slot containing those bookings
    - Verify exactly N booking entries rendered, each containing: reference, user name, email, date, time, duration, places, price, payment status, booking status, navigation link, and release button
    - **Property 4: Booking details panel renders all confirmed bookings with required fields and actions**
    - **Validates: Requirements 2.1, 2.2, 2.3, 5.1**

  - [ ]* 8.4 Write property test: refund checkbox visibility matches payment status
    - Test file: `packages/orgadmin-calendar/src/components/__tests__/ReleaseBookingDialog.refund.property.test.tsx`
    - Generate random bookings with various `paymentStatus` values using fast-check
    - Verify refund checkbox is visible if and only if `paymentStatus === 'paid'`
    - Verify booking reference and user name are always displayed
    - **Property 8: Refund checkbox visibility matches payment status**
    - **Validates: Requirements 5.2, 5.4, 5.5**

  - [ ]* 8.5 Write property test: cancellation decreases booking count
    - Test file: `packages/orgadmin-calendar/src/components/__tests__/BookingDetailsPanel.cancellation-count.property.test.tsx`
    - Generate random booking counts N (1-10) using fast-check, simulate cancelling one booking
    - Verify the slot shows N-1 confirmed bookings; if N-1 === 0, verify slot status changes to available
    - **Property 9: Cancellation decreases booking count**
    - **Validates: Requirements 5.8**

- [ ] 9. ReserveSlotDialog and ReservedSlotPanel
  - [x] 9.1 Create ReserveSlotDialog component
    - Create `packages/orgadmin-calendar/src/components/ReserveSlotDialog.tsx`
    - MUI `Dialog` that opens when clicking an available slot
    - Receives `open`, `slot: CalendarSlotView | null`, `onClose`, `onConfirm(reason?)` props
    - Display slot date, start time, and duration as read-only fields
    - Optional reason text field
    - Confirm / Cancel buttons
    - On confirm: call `onConfirm(reason)` — parent wires to `reserveSlot` from `useCalendarView`
    - On error from parent, display error snackbar and keep slot in previous state
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

  - [x] 9.2 Create ReservedSlotPanel component
    - Create `packages/orgadmin-calendar/src/components/ReservedSlotPanel.tsx`
    - MUI `Drawer` (anchor="right") that opens when clicking a reserved slot
    - Receives `open`, `slot: CalendarSlotView | null`, `onClose`, `onFreeSlot(reservationId)` props
    - Display reservation date, reason (if provided), reserved by admin info
    - "Free Slot" button that triggers a confirmation prompt (MUI `Dialog` or `confirm`)
    - On confirm free: call `onFreeSlot(reservation.id)` — parent wires to `freeSlot` from `useCalendarView`
    - On error from parent, display error snackbar and keep slot reserved
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_

  - [ ]* 9.3 Write property test: reserve dialog pre-populates slot data
    - Test file: `packages/orgadmin-calendar/src/components/__tests__/ReserveSlotDialog.prepopulate.property.test.tsx`
    - Generate random slot dates, start times, and durations using fast-check
    - Render `ReserveSlotDialog` with the generated slot, verify the displayed values match exactly
    - **Property 5: Reserve dialog pre-populates slot data**
    - **Validates: Requirements 3.1**

  - [ ]* 9.4 Write property test: reservation details display
    - Test file: `packages/orgadmin-calendar/src/components/__tests__/ReservedSlotPanel.details.property.test.tsx`
    - Generate random `SlotReservation` objects with optional reasons using fast-check
    - Render `ReservedSlotPanel`, verify reason is displayed when provided and reservation date is always shown
    - **Property 7: Reservation details display**
    - **Validates: Requirements 4.1**

- [x] 10. Checkpoint — Verify all dialogs and panels
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 11. Internationalisation
  - [x] 11.1 Add all calendar booking view translation keys to 6 locale files
    - In `packages/orgadmin-shell/src/locales/{locale}/translation.json` for each locale (en-GB, de-DE, fr-FR, es-ES, it-IT, pt-PT):
    - Add keys for CalendarToolbar: `calendar.bookingView.title`, `calendar.bookingView.viewDay`, `calendar.bookingView.viewWeek`, `calendar.bookingView.viewMonth`, `calendar.bookingView.today`, `calendar.bookingView.previous`, `calendar.bookingView.next`
    - Add keys for slot statuses: `calendar.bookingView.statusAvailable`, `calendar.bookingView.statusBooked`, `calendar.bookingView.statusReserved`
    - Add keys for BookingDetailsPanel: `calendar.bookingView.bookingDetails`, `calendar.bookingView.bookingReference`, `calendar.bookingView.userName`, `calendar.bookingView.userEmail`, `calendar.bookingView.startTime`, `calendar.bookingView.endTime`, `calendar.bookingView.duration`, `calendar.bookingView.placesBooked`, `calendar.bookingView.totalPrice`, `calendar.bookingView.paymentStatus`, `calendar.bookingView.bookingStatus`, `calendar.bookingView.viewFullDetails`, `calendar.bookingView.releaseSlot`
    - Add keys for ReserveSlotDialog: `calendar.bookingView.reserveSlot`, `calendar.bookingView.reserveSlotMessage`, `calendar.bookingView.reservationReason`
    - Add keys for ReservedSlotPanel: `calendar.bookingView.reservedSlotDetails`, `calendar.bookingView.reservedOn`, `calendar.bookingView.reservedBy`, `calendar.bookingView.freeSlot`, `calendar.bookingView.freeSlotConfirm`
    - Add keys for ReleaseBookingDialog: `calendar.bookingView.releaseBooking`, `calendar.bookingView.releaseBookingMessage`, `calendar.bookingView.cancellationReason`, `calendar.bookingView.refundBookingFee`
    - Add keys for errors: `calendar.bookingView.errors.slotUnavailable`, `calendar.bookingView.errors.reserveFailed`, `calendar.bookingView.errors.freeFailed`, `calendar.bookingView.errors.releaseFailed`, `calendar.bookingView.errors.loadFailed`, `calendar.bookingView.errors.timeout`
    - Add keys for empty states: `calendar.bookingView.noCalendars`, `calendar.bookingView.noBookings`
    - en-GB gets English values; other locales get translated values
    - _Requirements: 7.1, 7.2, 7.3_

  - [ ]* 11.2 Write property test: translation keys exist in all six locales
    - Test file: `packages/orgadmin-calendar/src/__tests__/calendar-booking-view-i18n.property.test.ts`
    - Enumerate all `calendar.bookingView.*` translation keys used in the components
    - Verify each key exists with a non-empty value in all six locale files (en-GB, de-DE, fr-FR, es-ES, it-IT, pt-PT)
    - **Property 13: Translation keys exist in all six locales**
    - **Validates: Requirements 7.2**

- [ ] 12. Wire components together and integrate into page
  - [x] 12.1 Wire all dialogs and panels into BookingsCalendarPage
    - In `packages/orgadmin-calendar/src/pages/BookingsCalendarPage.tsx`:
    - Import and render `BookingDetailsPanel`, `ReserveSlotDialog`, `ReservedSlotPanel`, `ReleaseBookingDialog`
    - Manage open/close state for each dialog/panel
    - Wire slot click handler: available → open `ReserveSlotDialog`, booked → open `BookingDetailsPanel`, reserved → open `ReservedSlotPanel`
    - Wire `BookingDetailsPanel` release button → open `ReleaseBookingDialog` with selected booking
    - Wire `ReserveSlotDialog` confirm → `useCalendarView.reserveSlot()`, on success close dialog, on error show snackbar
    - Wire `ReservedSlotPanel` free → `useCalendarView.freeSlot()`, on success close panel, on error show snackbar
    - Wire `ReleaseBookingDialog` confirm → `useCalendarView.releaseBooking()`, on success close dialog and refresh panel, on error show snackbar
    - Add MUI `Snackbar` for error/success messages using translation keys
    - _Requirements: 1.5, 2.4, 3.3, 3.4, 3.5, 4.4, 4.5, 4.6, 5.6, 5.7, 5.8, 5.9_

- [x] 13. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Property tests use `fast-check` (already used in sibling module tests)
- Do NOT include `useApi`'s `execute` function in useCallback/useEffect dependency arrays — it returns a new reference on every render
- Route paths should NOT have leading slashes (React Router v6 convention)
- Global `sanitizeBody()` middleware HTML-escapes `/` to `&#x2F;` — unescape S3 keys and similar values as needed
- Follow the existing `CancelBookingDialog` pattern for the `ReleaseBookingDialog`
- Follow the memberships module patterns as reference implementation
- Next migration number is 013
- Database connection: localhost:5432, db aws_framework, user framework_user, password framework_password
