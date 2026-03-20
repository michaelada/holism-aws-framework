# Requirements Document

## Introduction

The Calendar module currently supports basic calendar creation with payment configuration, terms and conditions, cancellation policy, and email notifications. However, several key features are missing or incomplete compared to sibling modules (Memberships, Events). This specification covers four improvement areas: adding application form selection to the calendar booking flow, adding missing translation keys, implementing full time slot configuration UI, and making schedule rules functional with proper fields.

## Glossary

- **Calendar_Form**: The admin form used to create or edit a Calendar entity, rendered by `CalendarForm.tsx`
- **Application_Form**: A reusable form template (from the organisation's form builder) that collects information from a person booking a calendar slot
- **Time_Slot_Configuration**: A set of rules defining when bookable slots are available, including days of week, start/end times, duration, and recurrence
- **Blocked_Period**: A date range or recurring time segment during which bookings are not allowed
- **Schedule_Rule**: An automated rule that opens or closes a calendar based on date ranges, days of week, and times of day
- **Duration_Option**: A selectable booking length with an associated price and label within a Time Slot Configuration
- **Translation_Key**: An i18n key used by the `useTranslation` hook to render localised UI text
- **Calendar_Service**: The backend service (`calendar.service.ts`) that handles CRUD operations for Calendar entities
- **Payment_Method**: A configured payment option (e.g., Stripe, Pay Offline) available to the organisation

## Requirements

### Requirement 1: Application Form Selection

**User Story:** As an organisation admin, I want to select an application form for my calendar, so that people booking a slot can provide required information (e.g., contact details, preferences).

#### Acceptance Criteria

1. THE Calendar_Form SHALL display an Application Form dropdown selector in the Basic Information section
2. WHEN the Calendar_Form loads, THE Calendar_Form SHALL fetch available Application Forms from the organisation's application forms API endpoint (`/api/orgadmin/organisations/{orgId}/application-forms`)
3. WHEN an admin selects an Application Form, THE Calendar_Form SHALL store the selected form ID in the `applicationFormId` field of the calendar form data
4. THE Calendar_Form SHALL allow the Application Form field to be optional (no form required for booking)
5. WHEN the Calendar_Form is in edit mode, THE Calendar_Form SHALL pre-select the previously saved Application Form
6. THE CalendarFormData type SHALL include an `applicationFormId` field of type `string | undefined`
7. THE CreateCalendarDto and UpdateCalendarDto in the Calendar_Service SHALL include an `applicationFormId` field of type `string | undefined`
8. WHEN a calendar is saved with an applicationFormId, THE Calendar_Service SHALL persist the applicationFormId value to the database

### Requirement 2: Missing Translation Keys

**User Story:** As an organisation admin, I want all calendar form labels and section headings to display properly translated text, so that the interface is consistent and localised.

#### Acceptance Criteria

1. THE Translation files SHALL include the key `calendar.sections.paymentConfiguration` with value "Payment Configuration" in en-GB
2. THE Translation files SHALL include the key `calendar.fields.supportedPaymentMethods` with value "Supported Payment Methods" in en-GB
3. THE Translation files SHALL include the key `calendar.fields.applicationForm` with value "Application Form" in en-GB
4. THE Translation files SHALL include the key `calendar.sections.timeSlotConfiguration` with value "Time Slot Configuration" in en-GB
5. THE Translation files SHALL include the key `calendar.sections.blockedPeriods` with value "Blocked Periods" in en-GB
6. THE Translation files SHALL include translation keys for all new schedule rule fields: `calendar.fields.scheduleRuleAction`, `calendar.fields.scheduleRuleStartDate`, `calendar.fields.scheduleRuleEndDate`, `calendar.fields.scheduleRuleTimeOfDay`, `calendar.fields.scheduleRuleReason`
7. THE Translation files SHALL include translation keys for all new time slot configuration fields: `calendar.fields.daysOfWeek`, `calendar.fields.startTime`, `calendar.fields.endTime`, `calendar.fields.effectiveDateStart`, `calendar.fields.effectiveDateEnd`, `calendar.fields.recurrenceWeeks`, `calendar.fields.placesAvailable`, `calendar.fields.durationOptionLabel`, `calendar.fields.durationOptionDuration`, `calendar.fields.durationOptionPrice`
8. THE Translation files SHALL include translation keys for blocked period fields: `calendar.fields.blockType`, `calendar.fields.blockedReason`, `calendar.fields.blockedStartDate`, `calendar.fields.blockedEndDate`, `calendar.fields.blockedStartTime`, `calendar.fields.blockedEndTime`, `calendar.fields.blockedDaysOfWeek`
9. WHEN a translation key is used in a component, THE corresponding key SHALL exist in the en-GB translation file to prevent rendering raw key strings

### Requirement 3: Time Slot Configuration UI

**User Story:** As an organisation admin, I want to configure available time slots for my calendar, so that people can only book during the times I specify.

#### Acceptance Criteria

1. THE TimeSlotConfigurationSection SHALL render editable form fields for each time slot configuration entry
2. WHEN an admin adds a new time slot configuration, THE TimeSlotConfigurationSection SHALL display fields for: days of week (multi-select checkboxes), start time (time picker), effective date start (date picker), effective date end (optional date picker), recurrence weeks (number input), and places available (number input)
3. THE TimeSlotConfigurationSection SHALL allow adding one or more Duration Options per configuration, each with a label (text), duration in minutes (number), and price (number) field
4. WHEN an admin removes a time slot configuration, THE TimeSlotConfigurationSection SHALL remove the configuration from the list and update the parent form data
5. WHEN an admin removes a Duration Option, THE TimeSlotConfigurationSection SHALL remove the option from the configuration's duration options list
6. THE TimeSlotConfigurationSection SHALL be included in the CalendarForm as a dedicated card section
7. WHEN the CalendarForm is in edit mode, THE TimeSlotConfigurationSection SHALL populate fields with existing time slot configuration data
8. THE CalendarFormData type SHALL include a `timeSlotConfigurations` field of type `TimeSlotConfigurationFormData[]`

### Requirement 4: Blocked Periods UI

**User Story:** As an organisation admin, I want to block specific dates or recurring time segments from being booked, so that I can manage maintenance windows, holidays, or other unavailable periods.

#### Acceptance Criteria

1. THE BlockedPeriodsSection SHALL render editable form fields for each blocked period entry
2. WHEN an admin adds a date range blocked period, THE BlockedPeriodsSection SHALL display fields for: start date (date picker), end date (date picker), and reason (text input)
3. WHEN an admin adds a time segment blocked period, THE BlockedPeriodsSection SHALL display fields for: days of week (multi-select checkboxes), start time (time picker), end time (time picker), and reason (text input)
4. THE BlockedPeriodsSection SHALL provide a block type selector to choose between "Date Range" and "Time Segment" types
5. WHEN an admin removes a blocked period, THE BlockedPeriodsSection SHALL remove the entry from the list and update the parent form data
6. THE BlockedPeriodsSection SHALL be included in the CalendarForm as a dedicated card section
7. WHEN the CalendarForm is in edit mode, THE BlockedPeriodsSection SHALL populate fields with existing blocked period data
8. THE CalendarFormData type SHALL include a `blockedPeriods` field of type `BlockedPeriodFormData[]`

### Requirement 5: Functional Schedule Rules

**User Story:** As an organisation admin, I want to define automated opening and closing rules with proper fields, so that my calendar status changes automatically based on dates and times.

#### Acceptance Criteria

1. THE ScheduleRulesSection SHALL render editable form fields for each schedule rule entry
2. WHEN an admin adds a new schedule rule, THE ScheduleRulesSection SHALL display fields for: action (select: "open" or "close"), start date (date picker), end date (optional date picker), time of day (time picker), and reason (text input)
3. WHEN an admin changes a schedule rule field, THE ScheduleRulesSection SHALL update the corresponding rule in the parent form data
4. WHEN an admin removes a schedule rule, THE ScheduleRulesSection SHALL remove the rule from the list and update the parent form data
5. THE ScheduleRulesSection SHALL display each rule in an expandable card with a summary showing the action, date range, and time
6. IF a schedule rule has no action selected, THEN THE ScheduleRulesSection SHALL default the action to "open"
7. WHEN the CalendarForm is in edit mode, THE ScheduleRulesSection SHALL populate fields with existing schedule rule data
