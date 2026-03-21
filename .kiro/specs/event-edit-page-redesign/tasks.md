# Implementation Plan: Event Edit Page Redesign

## Overview

Transform the event editing experience from a multi-step wizard into a single scrollable page with vertically stacked collapsible sections, sticky sidebar navigation, and a sticky save bar. The create event flow remains unchanged. Implementation proceeds by first extracting shared hooks and section components from `CreateEventPage`, then building the new `EditEventPage` shell, wiring everything together, adding i18n keys, and updating routing.

## Tasks

- [x] 1. Extract shared custom hooks from CreateEventPage
  - [x] 1.1 Create `useEventForm` hook
    - Extract form state management (`formData`, `setFormData`, `fieldErrors`, `handleChange`, `handleAddActivity`, `handleUpdateActivity`, `handleRemoveActivity`, `handleClearFieldError`, `loadEvent`, etc.) from `CreateEventPage` into `packages/orgadmin-events/src/hooks/useEventForm.ts`
    - The hook must return the `UseEventFormReturn` interface defined in the design
    - Include `loadEvent(eventId)` method that fetches an existing event from the API and populates `formData`
    - _Requirements: 7.1, 7.2, 7.3_

  - [x] 1.2 Create `useEventValidation` hook
    - Extract validation logic from `CreateEventPage` into `packages/orgadmin-events/src/hooks/useEventValidation.ts`
    - Expose `validateAll(formData)` and `validateStep(step, formData)` methods
    - Validation rules must be identical to the current wizard validation
    - _Requirements: 7.2_

  - [x] 1.3 Create `useSectionObserver` hook
    - Create `packages/orgadmin-events/src/hooks/useSectionObserver.ts`
    - Use Intersection Observer API to track which section is currently visible
    - Return `activeSectionId`, `sectionRefs`, and `registerSection` as defined in the design
    - _Requirements: 4.3_

  - [x] 1.4 Refactor `CreateEventPage` to use extracted hooks
    - Replace inline state management and validation in `CreateEventPage` with `useEventForm` and `useEventValidation` hooks
    - Verify the create wizard flow still works identically after refactoring
    - _Requirements: 1.1, 1.2, 1.3, 7.1, 7.2_

- [x] 2. Checkpoint - Verify create flow still works
  - Ensure all tests pass, ask the user if questions arise.

- [x] 3. Extract shared section components from CreateEventPage
  - [x] 3.1 Create `EventBasicInfoSection` component
    - Extract `renderBasicInformation()` from `CreateEventPage` into `packages/orgadmin-events/src/components/sections/EventBasicInfoSection.tsx`
    - Accept props as defined in the `EventBasicInfoSectionProps` interface in the design
    - Reuse existing form field components (TextField, DatePicker, DiscountSelector, etc.)
    - _Requirements: 7.1, 3.2_

  - [x] 3.2 Create `EventDatesSection` component
    - Extract `renderEventDates()` from `CreateEventPage` into `packages/orgadmin-events/src/components/sections/EventDatesSection.tsx`
    - Accept props as defined in the `EventDatesSectionProps` interface in the design
    - _Requirements: 7.1, 3.2_

  - [x] 3.3 Create `EventTicketingSection` component
    - Extract `renderTicketingSettings()` from `CreateEventPage` into `packages/orgadmin-events/src/components/sections/EventTicketingSection.tsx`
    - Accept props as defined in the `EventTicketingSectionProps` interface in the design
    - _Requirements: 7.1, 3.2_

  - [x] 3.4 Create `EventActivitiesSection` component
    - Extract `renderActivities()` from `CreateEventPage` into `packages/orgadmin-events/src/components/sections/EventActivitiesSection.tsx`
    - Accept props as defined in the `EventActivitiesSectionProps` interface in the design
    - _Requirements: 7.1, 3.2_

  - [x] 3.5 Refactor `CreateEventPage` to use extracted section components
    - Replace inline render methods in `CreateEventPage` with the new section components
    - Verify the create wizard flow still renders each step correctly
    - _Requirements: 1.1, 1.2, 1.3, 7.1_

- [x] 4. Checkpoint - Verify create flow with extracted sections
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Build new EditEventPage shell components
  - [x] 5.1 Create `CollapsibleSection` component
    - Create `packages/orgadmin-events/src/components/CollapsibleSection.tsx`
    - Implement as an MUI Card with an expandable/collapsible header (click to toggle)
    - Accept `id`, `title`, `expanded`, `onToggle`, and `children` props as defined in the design
    - Use MUI `Collapse` for the expand/collapse animation
    - Set `id` attribute on the root element for anchor linking
    - _Requirements: 3.1, 3.2, 6.1, 6.2, 6.3, 6.4_

  - [ ]* 5.2 Write property test for CollapsibleSection toggle behaviour
    - **Property 6: Section header click toggles expanded state**
    - Create test in `packages/orgadmin-events/src/components/__tests__/CollapsibleSection.property.test.tsx`
    - Generate random initial expanded states, simulate header click, verify state inversion
    - **Validates: Requirements 6.3**

  - [x] 5.3 Create `SidebarNavigation` component
    - Create `packages/orgadmin-events/src/components/SidebarNavigation.tsx`
    - Render a sticky list of section titles as anchor links
    - Highlight the `activeSectionId` link
    - Hide below MUI `md` breakpoint using `sx={{ display: { xs: 'none', md: 'block' } }}`
    - Accept `sections`, `activeSectionId`, and `onSectionClick` props as defined in the design
    - _Requirements: 4.1, 4.2, 4.4, 4.5_

  - [x] 5.4 Create `StickySaveBar` component
    - Create `packages/orgadmin-events/src/components/StickySaveBar.tsx`
    - Render a fixed-position bar at the bottom of the viewport
    - Include Cancel, Save as Draft, and Publish buttons
    - Disable buttons while `loading` is true
    - Accept `onCancel`, `onSaveDraft`, `onPublish`, `loading`, and `disabled` props as defined in the design
    - _Requirements: 5.1, 5.2_

- [x] 6. Implement EditEventPage
  - [x] 6.1 Create `EditEventPage` component
    - Create `packages/orgadmin-events/src/pages/EditEventPage.tsx`
    - Read `id` from route params via `useParams`
    - Use `useEventForm` hook to load event data and manage form state
    - Use `useEventValidation` hook for validation
    - Use `useSectionObserver` hook for scroll-aware sidebar highlighting
    - Render all four sections (Basic Info, Event Dates, Ticketing, Activities) vertically stacked using `CollapsibleSection` wrappers
    - Use MUI `Grid` layout: 9-column main area + 3-column sidebar
    - All sections expanded by default
    - Define `EDIT_PAGE_SECTIONS` configuration array as specified in the design
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 3.1, 3.2, 3.3, 6.1, 6.2_

  - [x] 6.2 Wire sidebar navigation click to expand collapsed sections and scroll
    - When a sidebar link is clicked for a collapsed section, expand it first, then smooth-scroll to it
    - Use `scrollIntoView({ behavior: 'smooth' })` for scrolling
    - _Requirements: 4.2, 6.5_

  - [x] 6.3 Wire StickySaveBar save action with validation and error scrolling
    - On Save click, call `validateAll` on the form data
    - If validation passes, submit the API request (PUT `/api/orgadmin/events/:id`)
    - If validation fails, populate `fieldErrors`, expand the first section with errors, and scroll to it
    - API payload structure must match the CreateEventPage payload
    - _Requirements: 5.3, 5.4, 7.3_

  - [ ]* 6.4 Write property test for edit page pre-population
    - **Property 2: Edit page pre-populates all form fields from API data**
    - Create test in `packages/orgadmin-events/src/pages/__tests__/EditEventPage.property.test.tsx`
    - Generate random valid Event objects, mock API, verify form field values match
    - **Validates: Requirements 2.4**

  - [ ]* 6.5 Write property test for save validation behaviour
    - **Property 4: Save validates all sections before submission**
    - Add to `packages/orgadmin-events/src/pages/__tests__/EditEventPage.property.test.tsx`
    - Generate random form data (valid and invalid), verify API call count matches validation result
    - **Validates: Requirements 5.3**

  - [ ]* 6.6 Write property test for validation failure scroll target
    - **Property 5: Validation failure scrolls to first error section**
    - Add to `packages/orgadmin-events/src/pages/__tests__/EditEventPage.property.test.tsx`
    - Generate random form data with errors in various sections, verify scroll target is the first error section in order
    - **Validates: Requirements 5.4**

  - [ ]* 6.7 Write property test for sidebar expand-before-scroll
    - **Property 7: Sidebar navigation expands collapsed sections before scrolling**
    - Add to `packages/orgadmin-events/src/pages/__tests__/EditEventPage.property.test.tsx`
    - Generate random collapsed section states, simulate sidebar click, verify expansion before scroll
    - **Validates: Requirements 6.5**

- [x] 7. Checkpoint - Verify EditEventPage renders and functions
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 8. Hook property tests and validation consistency
  - [ ]* 8.1 Write property test for useSectionObserver
    - **Property 3: Scroll-aware sidebar highlights the visible section**
    - Create test in `packages/orgadmin-events/src/hooks/__tests__/useSectionObserver.property.test.ts`
    - Generate random intersection entries for sections, verify `activeSectionId` is the section with the highest intersection ratio
    - **Validates: Requirements 4.3**

  - [ ]* 8.2 Write property test for validation consistency between create and edit
    - **Property 8: Validation rules are identical between create and edit flows**
    - Create test in `packages/orgadmin-events/src/hooks/__tests__/useEventValidation.property.test.ts`
    - Generate random `EventFormData`, verify `validateAll` returns identical results regardless of context
    - **Validates: Requirements 7.2**

  - [ ]* 8.3 Write property test for API payload structure consistency
    - **Property 9: API payload structure is identical between create and edit flows**
    - Add to `packages/orgadmin-events/src/hooks/__tests__/useEventValidation.property.test.ts`
    - Generate random valid `EventFormData`, verify payload structure equality between create and edit
    - **Validates: Requirements 7.3**

  - [ ]* 8.4 Write property test for wizard step validation
    - **Property 1: Wizard step validation blocks advancement on invalid data**
    - Create test in `packages/orgadmin-events/src/pages/__tests__/CreateEventPage.property.test.tsx`
    - Generate random invalid form data per step, verify step doesn't advance and fieldErrors are populated
    - **Validates: Requirements 1.3**

- [x] 9. Add i18n translation keys for all 6 locales
  - [x] 9.1 Add new translation keys to all locale files
    - Add `events.editPage.sidebarTitle`, `events.editPage.saveDraft`, `events.editPage.publish`, `events.editPage.cancel`, `events.editPage.saving`, `events.editPage.unsavedChanges` to all 6 locale files (en-GB, de-DE, fr-FR, es-ES, it-IT, pt-PT)
    - Provide proper translations for each locale
    - _Requirements: 8.1, 8.2_

  - [ ]* 9.2 Write property test for translation key completeness
    - **Property 10: New translation keys exist in all supported locales**
    - Create test in `packages/orgadmin-events/src/__tests__/edit-page-i18n.property.test.ts`
    - Enumerate all new translation keys, verify each exists with a non-empty string value in all 6 locale files
    - **Validates: Requirements 8.2**

- [x] 10. Update routing and final wiring
  - [x] 10.1 Update routing configuration in `index.ts`
    - In `packages/orgadmin-events/src/index.ts`, change the `events/:id/edit` route from `CreateEventPage` to `EditEventPage`
    - Add `EditEventPage` to the module exports
    - _Requirements: 9.1, 9.2, 9.3_

  - [ ]* 10.2 Write unit tests for routing separation
    - Verify `/events/new` renders `CreateEventPage` and `/events/:id/edit` renders `EditEventPage`
    - Verify no Stepper, Next, or Back buttons on the edit page
    - Verify all 4 sections render in correct DOM order on the edit page
    - Create test in `packages/orgadmin-events/src/pages/__tests__/EditEventPage.test.tsx`
    - _Requirements: 2.2, 2.3, 9.1, 9.2, 9.3_

- [x] 11. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation after major refactoring steps
- Property tests validate universal correctness properties from the design document
- The create event wizard must remain fully functional throughout all refactoring steps
- Section extraction (tasks 1 and 3) must be done carefully to avoid breaking the existing create flow
