# Implementation Plan

- [x] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** — Ticketing Fields Silently Dropped
  - **CRITICAL**: This test MUST FAIL on unfixed code — failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior — it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate ticketing fields are silently dropped by `updateEvent()`
  - **Scoped PBT Approach**: Generate random `UpdateEventDto` payloads where at least one ticketing field is defined (`generateElectronicTickets`, `ticketHeaderText`, `ticketInstructions`, `ticketFooterText`, `ticketValidityPeriod`, `includeEventLogo`, `ticketBackgroundColor`)
  - Create test file at `packages/backend/src/services/__tests__/event-ticketing-save-bug.property.test.ts`
  - Use `fast-check` to generate payloads satisfying `isBugCondition(input)`:
    ```
    isBugCondition(X) = X.generateElectronicTickets IS DEFINED
        OR X.ticketHeaderText IS DEFINED
        OR X.ticketInstructions IS DEFINED
        OR X.ticketFooterText IS DEFINED
        OR X.ticketValidityPeriod IS DEFINED
        OR X.includeEventLogo IS DEFINED
        OR X.ticketBackgroundColor IS DEFINED
    ```
  - Mock `db.query` for the `events` table UPDATE (existing behavior)
  - Mock `ticketingService.getTicketingConfigByEvent()`, `ticketingService.createTicketedEvent()`, and `ticketingService.updateTicketedEvent()`
  - Assert that after `updateEvent(id, payload)`, either `createTicketedEvent()` or `updateTicketedEvent()` was called with the ticketing fields from the payload
  - Include concrete scoped cases: (1) new config with `generateElectronicTickets = true`, (2) update existing config with modified `ticketHeaderText`, (3) disable ticketing with `generateElectronicTickets = false`, (4) only optional field like `ticketBackgroundColor`
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS (proves the bug exists — `updateEvent()` never calls `TicketingService` methods)
  - Document counterexamples found (e.g., "updateEvent with generateElectronicTickets=true never calls createTicketedEvent")
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.2, 2.3_

- [x] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** — Non-Ticketing Updates Leave Config Unchanged
  - **IMPORTANT**: Follow observation-first methodology
  - Observe behavior on UNFIXED code: `updateEvent()` with non-ticketing fields persists to `events` table and never touches `event_ticketing_config`
  - Create test file at `packages/backend/src/services/__tests__/event-ticketing-save-preservation.property.test.ts`
  - Use `fast-check` to generate random `UpdateEventDto` payloads where NO ticketing field is defined (`isBugCondition(X) = false`):
    - Random combinations of `name`, `description`, `startDate`, `endDate`, `status`, `eventTypeId`, `venueId`, `discountIds`, `activities`, etc.
  - Mock `db.query` for the `events` table UPDATE (returns updated row)
  - Mock `eventActivityService.replaceActivitiesForEvent()` for activity updates
  - Assert that `ticketingService.getTicketingConfigByEvent()` is NOT called
  - Assert that `ticketingService.createTicketedEvent()` is NOT called
  - Assert that `ticketingService.updateTicketedEvent()` is NOT called
  - Assert that the `events` table UPDATE query is still executed with the correct non-ticketing fields
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (confirms baseline behavior — non-ticketing updates never touch ticketing config)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3_

- [x] 3. Implement ticketing persistence in `updateEvent()`

  - [x] 3.1 Add ticketing persistence logic to `updateEvent()` in `packages/backend/src/services/event.service.ts`
    - Add a helper check (inline or function) to detect if any ticketing field is present in `data` (mirrors `isBugCondition`)
    - After the existing activity handling block (around line 480), add a new block:
      - If any ticketing field is present in `data`:
        - Dynamically import `ticketingService` from `./ticketing.service` (following the existing `eventActivityService` import pattern)
        - Call `ticketingService.getTicketingConfigByEvent(id)` to check for existing config
        - Build the ticketing fields object from `data`, only including defined fields
        - If NO existing config: call `ticketingService.createTicketedEvent({ eventId: id, generateElectronicTickets: data.generateElectronicTickets ?? false, ...ticketingFields })`
        - If existing config: call `ticketingService.updateTicketedEvent(id, ticketingFields)`
    - Keep the new code inside the existing try/catch block for consistent error handling
    - _Bug_Condition: isBugCondition(input) where any of generateElectronicTickets, ticketHeaderText, ticketInstructions, ticketFooterText, ticketValidityPeriod, includeEventLogo, ticketBackgroundColor is defined_
    - _Expected_Behavior: When isBugCondition is true, ticketing fields are persisted to event_ticketing_config via createTicketedEvent() or updateTicketedEvent()_
    - _Preservation: When isBugCondition is false, event_ticketing_config table is untouched; events table persistence and activity handling remain identical_
    - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.2, 2.3, 3.1, 3.2, 3.3_

  - [x] 3.2 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** — Ticketing Fields Are Persisted
    - **IMPORTANT**: Re-run the SAME test from task 1 — do NOT write a new test
    - The test from task 1 encodes the expected behavior (ticketing fields are persisted via TicketingService)
    - When this test passes, it confirms the expected behavior is satisfied
    - Run `packages/backend/src/services/__tests__/event-ticketing-save-bug.property.test.ts`
    - **EXPECTED OUTCOME**: Test PASSES (confirms bug is fixed)
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 3.3 Verify preservation tests still pass
    - **Property 2: Preservation** — Non-Ticketing Updates Leave Config Unchanged
    - **IMPORTANT**: Re-run the SAME tests from task 2 — do NOT write new tests
    - Run `packages/backend/src/services/__tests__/event-ticketing-save-preservation.property.test.ts`
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)
    - Confirm all tests still pass after fix (no regressions)

- [x] 4. Checkpoint — Ensure all tests pass
  - Run both property test files and the existing `event.service.test.ts` to confirm nothing is broken
  - Ensure all tests pass, ask the user if questions arise
