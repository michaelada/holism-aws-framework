# Requirements Document

## Introduction

The Calendar Booking View feature provides org administrators with an interactive calendar interface to visualise and manage time slot bookings across their calendars. Administrators can view bookings in day, week, or month formats, inspect booking details, reserve slots to block availability for account users, free reserved slots, and release booked slots with optional refund processing. This feature enhances the existing `BookingsCalendarPage` (currently a placeholder) into a fully functional calendar management view.

## Glossary

- **Calendar_View**: The interactive calendar interface displayed to the org administrator, supporting day, week, and month display formats
- **Time_Slot**: A bookable period on a calendar, generated from `TimeSlotConfiguration` records, with a date, start time, duration, and capacity
- **Booked_Slot**: A Time_Slot that has one or more confirmed `Booking` records associated with it
- **Reserved_Slot**: A Time_Slot that an administrator has manually marked as unavailable, preventing account users from booking it
- **Available_Slot**: A Time_Slot that is neither booked nor reserved and is open for account users to book
- **Org_Administrator**: A user with administrative privileges for the calendar module within an organisation
- **Account_User**: A regular member or user who can make calendar bookings through the public-facing booking interface
- **Booking_Details_Panel**: A UI panel or dialog that displays the full details of a booking when an administrator clicks on a Booked_Slot
- **Release_Booking_Dialog**: A confirmation dialog shown when an administrator releases a Booked_Slot, including an optional refund prompt
- **Reserve_Slot_Dialog**: A confirmation dialog shown when an administrator reserves an Available_Slot
- **Slot_Status**: The visual state of a Time_Slot in the Calendar_View — one of available, booked, or reserved

## Requirements

### Requirement 1: Calendar View Display

**User Story:** As an Org_Administrator, I want to see a visual calendar of all time slots for a selected calendar, so that I can quickly understand booking availability at a glance.

#### Acceptance Criteria

1. WHEN the Org_Administrator navigates to the Calendar_View page, THE Calendar_View SHALL display a weekly calendar layout as the default view format
2. THE Calendar_View SHALL provide controls to switch between day, week, and month display formats
3. WHEN the Org_Administrator switches the display format, THE Calendar_View SHALL re-render the time slots in the selected format without losing the current date context
4. THE Calendar_View SHALL display all Time_Slots for the visible date range, generated from the calendar's TimeSlotConfiguration records
5. THE Calendar_View SHALL visually distinguish between Available_Slots, Booked_Slots, and Reserved_Slots using distinct colours or visual indicators
6. WHEN the Calendar_View loads, THE Calendar_View SHALL fetch bookings and reserved slots from the backend for the visible date range
7. THE Calendar_View SHALL provide navigation controls to move forward and backward through dates (previous/next day, week, or month depending on the active format)
8. THE Calendar_View SHALL provide a control to return to the current date (today)
9. WHEN the Org_Administrator selects a different calendar from the calendar selector, THE Calendar_View SHALL reload the time slots and bookings for the newly selected calendar

### Requirement 2: View Booking Details

**User Story:** As an Org_Administrator, I want to click on a booked time slot and see the booking details, so that I can review who booked it and the booking information.

#### Acceptance Criteria

1. WHEN the Org_Administrator clicks on a Booked_Slot, THE Booking_Details_Panel SHALL display the booking reference, user name, user email, booking date, start time, end time, duration, places booked, total price, payment status, and booking status
2. WHEN a Booked_Slot has multiple bookings (capacity greater than 1), THE Booking_Details_Panel SHALL display a list of all confirmed bookings for that Time_Slot
3. THE Booking_Details_Panel SHALL provide a link to navigate to the full BookingDetailsPage for each displayed booking
4. WHEN the Org_Administrator closes the Booking_Details_Panel, THE Calendar_View SHALL return focus to the calendar grid

### Requirement 3: Reserve a Time Slot

**User Story:** As an Org_Administrator, I want to click on an available time slot and mark it as reserved, so that account users cannot book that slot.

#### Acceptance Criteria

1. WHEN the Org_Administrator clicks on an Available_Slot, THE Reserve_Slot_Dialog SHALL open with the slot date, start time, and duration pre-populated
2. THE Reserve_Slot_Dialog SHALL provide a text field for the Org_Administrator to enter an optional reason for the reservation
3. WHEN the Org_Administrator confirms the reservation, THE Calendar_View SHALL send a reserve request to the backend API
4. WHEN the backend confirms the reservation, THE Calendar_View SHALL update the Time_Slot to display as a Reserved_Slot without requiring a full page reload
5. IF the reserve request fails, THEN THE Calendar_View SHALL display an error message to the Org_Administrator and keep the slot in its previous state
6. WHILE a Time_Slot is reserved, THE Calendar_View SHALL display the Time_Slot as a Reserved_Slot with the reserved visual indicator

### Requirement 4: Free a Reserved Slot

**User Story:** As an Org_Administrator, I want to click on a reserved time slot and free it up, so that account users can book it again.

#### Acceptance Criteria

1. WHEN the Org_Administrator clicks on a Reserved_Slot, THE Calendar_View SHALL display the reservation details including the reservation reason (if provided) and the date the slot was reserved
2. THE Calendar_View SHALL provide a "Free Slot" action button when viewing a Reserved_Slot
3. WHEN the Org_Administrator clicks the "Free Slot" button, THE Calendar_View SHALL prompt for confirmation before proceeding
4. WHEN the Org_Administrator confirms freeing the slot, THE Calendar_View SHALL send an unreserve request to the backend API
5. WHEN the backend confirms the unreserve, THE Calendar_View SHALL update the Time_Slot to display as an Available_Slot without requiring a full page reload
6. IF the unreserve request fails, THEN THE Calendar_View SHALL display an error message to the Org_Administrator and keep the slot in its reserved state

### Requirement 5: Release a Booked Slot

**User Story:** As an Org_Administrator, I want to release a booked time slot when a person can no longer make it, so that the slot becomes available again.

#### Acceptance Criteria

1. WHEN the Org_Administrator views a Booked_Slot in the Booking_Details_Panel, THE Booking_Details_Panel SHALL provide a "Release Slot" action button for each confirmed booking
2. WHEN the Org_Administrator clicks the "Release Slot" button, THE Release_Booking_Dialog SHALL open with the booking reference and user name displayed
3. THE Release_Booking_Dialog SHALL provide a text field for the Org_Administrator to enter a cancellation reason
4. WHEN the booking has a payment status of "paid", THE Release_Booking_Dialog SHALL display a checkbox asking "Refund the booking fee to the user?"
5. WHEN the booking has a payment status other than "paid", THE Release_Booking_Dialog SHALL not display the refund checkbox
6. WHEN the Org_Administrator confirms the release with refund selected, THE Calendar_View SHALL send a cancellation request to the backend API with the refund flag set to true
7. WHEN the Org_Administrator confirms the release without refund selected, THE Calendar_View SHALL send a cancellation request to the backend API with the refund flag set to false
8. WHEN the backend confirms the cancellation, THE Calendar_View SHALL update the Time_Slot booking count and visual status without requiring a full page reload
9. IF the cancellation request fails, THEN THE Calendar_View SHALL display an error message to the Org_Administrator

### Requirement 6: Backend API for Slot Reservation

**User Story:** As a developer, I want backend API endpoints for reserving and unreserving time slots, so that the Calendar_View can persist reservation state.

#### Acceptance Criteria

1. THE Calendar_Service SHALL provide an endpoint to reserve a Time_Slot, accepting calendar ID, date, start time, duration, and an optional reason
2. THE Calendar_Service SHALL provide an endpoint to unreserve a previously reserved Time_Slot, accepting the reservation ID
3. THE Calendar_Service SHALL provide an endpoint to fetch all reservations for a calendar within a date range
4. WHEN a reserve request is received for a Time_Slot that is already fully booked or reserved, THE Calendar_Service SHALL return an error indicating the slot is unavailable
5. THE Calendar_Service SHALL store reservations with the administrator's user ID, the reservation timestamp, and the optional reason
6. WHEN a cancellation request with refund is received, THE Calendar_Service SHALL update the booking status to "cancelled", set the cancelled_by field to the administrator's user ID, record the cancellation reason, and set refund_processed to true

### Requirement 7: Internationalisation

**User Story:** As an Org_Administrator using the platform in a non-English locale, I want the Calendar_View to display all labels and messages in my language, so that I can use the feature comfortably.

#### Acceptance Criteria

1. THE Calendar_View SHALL use translation keys for all user-facing text, including button labels, dialog titles, status labels, error messages, and confirmation prompts
2. THE Calendar_View SHALL provide translations in all six supported locales: en-GB, de-DE, fr-FR, es-ES, it-IT, and pt-PT
3. WHEN the Org_Administrator's locale changes, THE Calendar_View SHALL re-render all text in the selected locale without requiring a page reload
