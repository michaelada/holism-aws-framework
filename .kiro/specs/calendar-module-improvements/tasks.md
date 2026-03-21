# Implementation Plan: Calendar Module Improvements

## Overview

Five improvement areas for the Calendar module: (1) application form selection following MembershipTypeForm pattern, (2) missing translation keys across 6 locales, (3) time slot configuration UI rewrite, (4) blocked periods UI rewrite, (5) functional schedule rules with proper fields. Changes span `packages/orgadmin-calendar/`, `packages/orgadmin-shell/src/locales/`, and `packages/backend/src/services/calendar.service.ts`.

## Tasks

- [x] 1. Application Form Selection
  - [x] 1.1 Update CalendarFormData type and backend DTOs
    - In `packages/orgadmin-calendar/src/types/calendar.types.ts`, add `applicationFormId?: string` to `CalendarFormData`
    - In `packages/backend/src/services/calendar.service.ts`, add `applicationFormId?: string` to `CreateCalendarDto` and `UpdateCalendarDto`
    - In `calendar.service.ts`, add `application_form_id` to the INSERT/UPDATE SQL in `createCalendar` and `updateCalendar`
    - In `calendar.service.ts`, map `application_form_id` in `rowToCalendar`
    - Note: S3 keys and similar values need unescaping due to global `sanitizeBody()` middleware HTML-escaping `/` to `&#x2F;`
    - _Requirements: 1.6, 1.7, 1.8_

  - [x] 1.2 Fetch application forms in CreateCalendarPage and pass to CalendarForm
    - In `packages/orgadmin-calendar/src/pages/CreateCalendarPage.tsx`:
    - Add state: `const [applicationForms, setApplicationForms] = useState<Array<{ id: string; name: string }>>([]);`
    - Add `loadApplicationForms` function that fetches from `/api/orgadmin/organisations/{orgId}/application-forms`
    - Call `loadApplicationForms` in `useEffect` — do NOT include the `execute` function from `useApi` in the dependency array (it returns a new reference on every render)
    - Add `applicationFormId` to the initial form state (undefined)
    - Pass `applicationForms` prop to `<CalendarForm>`
    - _Requirements: 1.2, 1.4, 1.5_

  - [x] 1.3 Add Application Form dropdown to CalendarForm
    - In `packages/orgadmin-calendar/src/components/CalendarForm.tsx`:
    - Add `applicationForms?: Array<{ id: string; name: string }>` to the component props interface, following the MembershipTypeForm pattern
    - Add a `FormControl` with `Select` dropdown in the Basic Information section, labelled with `t('calendar.fields.applicationForm')`
    - Include an empty/none option so the field is optional
    - On change, update `formData.applicationFormId` via the `onChange` callback
    - In edit mode, pre-select the saved `applicationFormId` from form data
    - _Requirements: 1.1, 1.3, 1.4, 1.5_

  - [ ]* 1.4 Write property test: application form selection stores form ID
    - Test file: `packages/orgadmin-calendar/src/components/__tests__/CalendarForm.application-form.property.test.tsx`
    - Generate random application form lists using `fc.array(fc.record({ id: fc.uuid(), name: fc.string({ minLength: 1 }) }), { minLength: 1, maxLength: 10 })`
    - Render CalendarForm with generated forms, simulate selecting a form, verify `onChange` produces `applicationFormId` matching the selected form's ID
    - **Property 1: Application form selection stores the selected form ID**
    - **Validates: Requirements 1.3**

  - [ ]* 1.5 Write property test: application form ID round-trip through edit mode
    - Test file: `packages/orgadmin-calendar/src/components/__tests__/CalendarForm.application-form-edit.property.test.tsx`
    - Generate random `applicationFormId` values, create form data with that ID and a matching application forms list
    - Render CalendarForm, verify the dropdown displays the corresponding form as selected
    - **Property 2: Application form ID round-trip through edit mode**
    - **Validates: Requirements 1.5**

  - [ ]* 1.6 Write property test: application form ID persistence round-trip
    - Test file: `packages/backend/src/services/__tests__/calendar-application-form.property.test.ts`
    - Generate random `applicationFormId` strings, create a calendar via the service, read it back, verify the `applicationFormId` matches
    - **Property 3: Application form ID persistence round-trip**
    - **Validates: Requirements 1.8**

- [x] 2. Missing Translation Keys
  - [x] 2.1 Add all missing translation keys to 6 locale files
    - In `packages/orgadmin-shell/src/locales/{locale}/translation.json` for each locale (en-GB, de-DE, fr-FR, es-ES, it-IT, pt-PT):
    - Add `calendar.sections.paymentConfiguration` — "Payment Configuration" (en-GB)
    - Add `calendar.sections.timeSlotConfiguration` — "Time Slot Configuration" (en-GB)
    - Add `calendar.sections.blockedPeriods` — "Blocked Periods" (en-GB)
    - Add `calendar.fields.applicationForm` — "Application Form" (en-GB)
    - Add `calendar.fields.supportedPaymentMethods` — "Supported Payment Methods" (en-GB)
    - Add all time slot configuration field keys: `calendar.fields.daysOfWeek`, `calendar.fields.startTime`, `calendar.fields.endTime`, `calendar.fields.effectiveDateStart`, `calendar.fields.effectiveDateEnd`, `calendar.fields.recurrenceWeeks`, `calendar.fields.placesAvailable`, `calendar.fields.durationOptionLabel`, `calendar.fields.durationOptionDuration`, `calendar.fields.durationOptionPrice`
    - Add all blocked period field keys: `calendar.fields.blockType`, `calendar.fields.blockedReason`, `calendar.fields.blockedStartDate`, `calendar.fields.blockedEndDate`, `calendar.fields.blockedStartTime`, `calendar.fields.blockedEndTime`, `calendar.fields.blockedDaysOfWeek`
    - Add all schedule rule field keys: `calendar.fields.scheduleRuleAction`, `calendar.fields.scheduleRuleStartDate`, `calendar.fields.scheduleRuleEndDate`, `calendar.fields.scheduleRuleTimeOfDay`, `calendar.fields.scheduleRuleReason`
    - en-GB gets English values; other locales get placeholder values matching the key name pattern
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9_

  - [ ]* 2.2 Write property test: all required translation keys exist
    - Test file: `packages/orgadmin-calendar/src/__tests__/calendar-translation-keys.property.test.tsx`
    - Extract all `t()` keys used in calendar module components, verify each exists in the en-GB translation file with a non-empty string value
    - **Property 4: All required translation keys exist**
    - **Validates: Requirements 2.6, 2.7, 2.8, 2.9**

- [x] 3. Checkpoint — Verify application form selection and translations
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Time Slot Configuration UI
  - [x] 4.1 Rewrite TimeSlotConfigurationSection with full form fields
    - In `packages/orgadmin-calendar/src/components/TimeSlotConfigurationSection.tsx`:
    - Replace placeholder card rendering with full editable form fields per configuration entry
    - Each entry renders: days of week multi-select checkboxes, start time picker, effective date start picker, effective date end picker (optional), recurrence weeks number input, places available number input
    - Add nested Duration Options section per configuration: each option has label (text), duration in minutes (number), price (number) fields
    - Add "Add Duration Option" button per configuration and remove button per duration option
    - Add "Add Configuration" button and remove button per configuration entry
    - Use translation keys from `calendar.fields.*` for all labels
    - Component receives `timeSlotConfigurations: TimeSlotConfigurationFormData[]` and `onChange` callback
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8_

  - [x] 4.2 Wire TimeSlotConfigurationSection into CalendarForm
    - In `packages/orgadmin-calendar/src/components/CalendarForm.tsx`:
    - Add `TimeSlotConfigurationSection` as a dedicated card section
    - Pass `formData.timeSlotConfigurations` and an `onChange` handler that updates the parent form data
    - Add `timeSlotConfigurations: []` to initial form state in `CreateCalendarPage.tsx` if not already present
    - _Requirements: 3.6, 3.7_

  - [ ]* 4.3 Write property test: removing an item decreases list length by one
    - Test file: `packages/orgadmin-calendar/src/components/__tests__/TimeSlotConfigurationSection.remove.property.test.tsx`
    - Generate random lists of 1-10 time slot configurations and random valid indices, simulate remove, verify length decreases by 1 and the removed item is absent
    - Also test removing duration options within a configuration
    - **Property 5: Removing an item from a section list decreases length by one**
    - **Validates: Requirements 3.4, 3.5**

  - [ ]* 4.4 Write property test: adding a duration option increases count
    - Test file: `packages/orgadmin-calendar/src/components/__tests__/TimeSlotConfigurationSection.add-duration.property.test.tsx`
    - Generate random time slot configs with 0-5 duration options, add one, verify count increases by 1
    - **Property 6: Adding a duration option increases the options count**
    - **Validates: Requirements 3.3**

  - [ ]* 4.5 Write property test: time slot configuration data populates form fields
    - Test file: `packages/orgadmin-calendar/src/components/__tests__/TimeSlotConfigurationSection.populate.property.test.tsx`
    - Generate random `TimeSlotConfigurationFormData` arrays, render component, verify fields are populated with corresponding values
    - **Property 7: Time slot configuration data populates form fields**
    - **Validates: Requirements 3.7**

- [x] 5. Blocked Periods UI
  - [x] 5.1 Rewrite BlockedPeriodsSection with full form fields
    - In `packages/orgadmin-calendar/src/components/BlockedPeriodsSection.tsx`:
    - Replace placeholder card rendering with full editable form fields per blocked period entry
    - Add block type selector (Date Range / Time Segment) per entry
    - Date Range type renders: start date picker, end date picker, reason text input
    - Time Segment type renders: days of week multi-select checkboxes, start time picker, end time picker, reason text input
    - Add "Add Blocked Period" button and remove button per entry
    - Use translation keys from `calendar.fields.*` for all labels
    - Component receives `blockedPeriods: BlockedPeriodFormData[]` and `onChange` callback
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8_

  - [x] 5.2 Wire BlockedPeriodsSection into CalendarForm
    - In `packages/orgadmin-calendar/src/components/CalendarForm.tsx`:
    - Add `BlockedPeriodsSection` as a dedicated card section
    - Pass `formData.blockedPeriods` and an `onChange` handler that updates the parent form data
    - Add `blockedPeriods: []` to initial form state in `CreateCalendarPage.tsx` if not already present
    - _Requirements: 4.6, 4.7_

  - [ ]* 5.3 Write property test: blocked period data populates form fields based on block type
    - Test file: `packages/orgadmin-calendar/src/components/__tests__/BlockedPeriodsSection.populate.property.test.tsx`
    - Generate random `BlockedPeriodFormData` arrays with mixed block types, render component, verify correct conditional fields per block type
    - **Property 8: Blocked period data populates form fields based on block type**
    - **Validates: Requirements 4.7**

- [x] 6. Checkpoint — Verify time slot configuration and blocked periods
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Functional Schedule Rules
  - [x] 7.1 Rewrite ScheduleRulesSection with proper fields
    - In `packages/orgadmin-calendar/src/components/ScheduleRulesSection.tsx`:
    - Replace name-only placeholder cards with expandable cards showing a summary line (action, date range, time)
    - Each rule renders: action select (open/close), start date picker, end date picker (optional), time of day picker, reason text input
    - Default action to "open" when no action is selected
    - Add "Add Rule" button and remove button per rule
    - Use translation keys from `calendar.fields.*` for all labels
    - Component receives schedule rules data and `onChange` callback
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7_

  - [ ]* 7.2 Write property test: schedule rule field changes propagate to parent
    - Test file: `packages/orgadmin-calendar/src/components/__tests__/ScheduleRulesSection.field-change.property.test.tsx`
    - Generate random schedule rules and random field changes, apply change, verify onChange produces updated data where only the changed field differs
    - **Property 9: Schedule rule field changes propagate to parent**
    - **Validates: Requirements 5.3**

  - [ ]* 7.3 Write property test: schedule rule summary displays action, dates, and time
    - Test file: `packages/orgadmin-calendar/src/components/__tests__/ScheduleRulesSection.summary.property.test.tsx`
    - Generate random schedule rules with action, start date, and time of day, render component, verify summary text contains action, date range representation, and time
    - **Property 10: Schedule rule summary displays action, dates, and time**
    - **Validates: Requirements 5.5**

  - [ ]* 7.4 Write property test: schedule rule data populates form fields in edit mode
    - Test file: `packages/orgadmin-calendar/src/components/__tests__/ScheduleRulesSection.populate.property.test.tsx`
    - Generate random schedule rule arrays, render component, verify fields are populated with corresponding values
    - **Property 11: Schedule rule data populates form fields in edit mode**
    - **Validates: Requirements 5.7**

- [x] 8. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Property tests use `fast-check` (already used in sibling module tests)
- Follow MembershipTypeForm pattern for application form selection
- Do NOT include `useApi`'s `execute` function in useCallback/useEffect dependency arrays — it returns a new reference on every render
- Route paths should NOT have leading slashes
- Global `sanitizeBody()` middleware HTML-escapes `/` to `&#x2F;` — unescape S3 keys and similar values as needed
- Existing types `TimeSlotConfigurationFormData`, `BlockedPeriodFormData`, `DurationOption` in `calendar.types.ts` are used as-is
