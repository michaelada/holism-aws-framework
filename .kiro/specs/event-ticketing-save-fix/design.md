# Event Ticketing Save Fix — Bugfix Design

## Overview

The `updateEvent()` method in `event.service.ts` accepts ticketing fields (`generateElectronicTickets`, `ticketHeaderText`, `ticketInstructions`, etc.) via `UpdateEventDto` but only persists columns on the `events` table. It never delegates to the `TicketingService` to write to the `event_ticketing_config` table. The fix adds a ticketing persistence step at the end of `updateEvent()`: when any ticketing field is present in the payload, check if a config row already exists for the event, then call `createTicketedEvent()` or `updateTicketedEvent()` accordingly.

## Glossary

- **Bug_Condition (C)**: The update payload contains at least one ticketing field (`generateElectronicTickets`, `ticketHeaderText`, `ticketInstructions`, `ticketFooterText`, `ticketValidityPeriod`, `includeEventLogo`, `ticketBackgroundColor`)
- **Property (P)**: When ticketing fields are present, they are persisted to the `event_ticketing_config` table (created or updated)
- **Preservation**: When no ticketing fields are present, the `event_ticketing_config` table is untouched and all existing `events` table persistence works identically
- **`updateEvent()`**: The method in `EventService` (`packages/backend/src/services/event.service.ts`) that handles `PUT /api/orgadmin/events/{id}`
- **`TicketingService`**: Service in `packages/backend/src/services/ticketing.service.ts` with `createTicketedEvent()`, `updateTicketedEvent()`, and `getTicketingConfigByEvent()` methods
- **`event_ticketing_config`**: Database table storing per-event ticketing configuration

## Bug Details

### Bug Condition

The bug manifests when a user saves an event update that includes any ticketing field. The `updateEvent()` method builds a dynamic SQL `UPDATE` for the `events` table but has no code path to persist ticketing fields to the `event_ticketing_config` table. The ticketing fields are accepted in the DTO but silently dropped.

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type UpdateEventDto
  OUTPUT: boolean

  RETURN input.generateElectronicTickets IS DEFINED
      OR input.ticketHeaderText IS DEFINED
      OR input.ticketInstructions IS DEFINED
      OR input.ticketFooterText IS DEFINED
      OR input.ticketValidityPeriod IS DEFINED
      OR input.includeEventLogo IS DEFINED
      OR input.ticketBackgroundColor IS DEFINED
END FUNCTION
```

### Examples

- **Enable ticketing on new event**: User sets `generateElectronicTickets = true` and `ticketHeaderText = "Welcome"` on an event with no existing config → Expected: new row in `event_ticketing_config` | Actual: no row created, fields lost
- **Update existing ticketing config**: User changes `ticketInstructions` from "Show at gate" to "Scan QR code" on an event with existing config → Expected: config row updated | Actual: config row unchanged
- **Disable ticketing**: User sets `generateElectronicTickets = false` on an event with existing config → Expected: config row updated with `generate_electronic_tickets = false` | Actual: config row unchanged, ticketing remains enabled
- **Edge case — only optional fields**: User sets only `ticketBackgroundColor = "#FF0000"` without setting `generateElectronicTickets` → Expected: config created/updated with the background color | Actual: field lost

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Non-ticketing field updates (name, description, dates, status, venue, etc.) must continue to persist to the `events` table exactly as before
- Activity updates via `eventActivityService.replaceActivitiesForEvent()` must continue to work when `data.activities` is provided
- Validation logic for dates, entries limit, and confirmation message must remain unchanged
- When no ticketing fields are present in the payload, the `event_ticketing_config` table must not be touched at all

**Scope:**
All inputs where `isBugCondition(input) = false` (no ticketing fields in the payload) should be completely unaffected by this fix. This includes:
- Updates to event name, description, dates, status
- Updates to venue, event type, discount IDs
- Updates to entries limit and confirmation message settings
- Updates to activities only

## Hypothesized Root Cause

Based on the code analysis, the root cause is clear and singular:

1. **Missing Ticketing Persistence Code Path**: The `updateEvent()` method (lines 350–491 in `event.service.ts`) builds a dynamic SQL `UPDATE` statement for the `events` table and handles activity updates via `eventActivityService`, but contains zero code to delegate ticketing fields to `TicketingService`. The ticketing fields were added to `UpdateEventDto` (lines 127–133) but the corresponding persistence logic was never implemented.

2. **No Create-or-Update Logic**: Even if a single ticketing field were somehow persisted, there is no logic to determine whether to call `createTicketedEvent()` (for events without existing config) vs `updateTicketedEvent()` (for events with existing config). This create-or-update branching is the key missing piece.

## Correctness Properties

Property 1: Bug Condition — Ticketing Fields Are Persisted

_For any_ update payload where at least one ticketing field is defined (isBugCondition returns true), the fixed `updateEvent()` function SHALL persist the ticketing fields to the `event_ticketing_config` table — creating a new row if none exists for the event, or updating the existing row otherwise — such that a subsequent `getTicketingConfigByEvent()` call returns a config reflecting the provided ticketing fields.

**Validates: Requirements 2.1, 2.2, 2.3**

Property 2: Preservation — Non-Ticketing Updates Leave Config Unchanged

_For any_ update payload where no ticketing fields are defined (isBugCondition returns false), the fixed `updateEvent()` function SHALL produce the same result as the original function for the `events` table, and the `event_ticketing_config` table SHALL remain unchanged (no rows created, updated, or deleted).

**Validates: Requirements 3.1, 3.2, 3.3**

## Fix Implementation

### Changes Required

Assuming our root cause analysis is correct:

**File**: `packages/backend/src/services/event.service.ts`

**Function**: `updateEvent()`

**Specific Changes**:

1. **Add ticketing field detection helper**: Create a local function or inline check to determine if any ticketing field is present in the `data` payload (mirrors `isBugCondition`).

2. **Import TicketingService**: Add a dynamic import for `ticketingService` from `./ticketing.service` (following the existing pattern used for `eventActivityService`).

3. **Add create-or-update branching**: After the existing event table update and activity handling, add a block that:
   - Checks if any ticketing field is present in `data`
   - If yes, calls `ticketingService.getTicketingConfigByEvent(id)` to check for existing config
   - If no existing config: calls `ticketingService.createTicketedEvent()` with `eventId: id` and the ticketing fields from `data`
   - If existing config: calls `ticketingService.updateTicketedEvent(id, ...)` with the ticketing fields from `data`

4. **Extract ticketing fields from data**: Build the `CreateTicketingConfigDto` or `UpdateTicketingConfigDto` object from the relevant fields in `data`, only including fields that are defined.

5. **Error handling**: Wrap the ticketing persistence in the existing try/catch block so errors are logged and propagated consistently.

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate the bug on unfixed code, then verify the fix works correctly and preserves existing behavior.

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate the bug BEFORE implementing the fix. Confirm that ticketing fields are silently dropped by the current `updateEvent()` implementation.

**Test Plan**: Write tests that call `updateEvent()` with ticketing fields and assert that the `event_ticketing_config` table is populated. Run these tests on the UNFIXED code to observe failures.

**Test Cases**:
1. **Create Config Test**: Call `updateEvent()` with `generateElectronicTickets = true` on an event with no existing config (will fail on unfixed code — no row created)
2. **Update Config Test**: Call `updateEvent()` with modified `ticketHeaderText` on an event with existing config (will fail on unfixed code — row unchanged)
3. **Disable Ticketing Test**: Call `updateEvent()` with `generateElectronicTickets = false` on an event with existing config (will fail on unfixed code — row unchanged)
4. **Optional Fields Only Test**: Call `updateEvent()` with only `ticketBackgroundColor` set (will fail on unfixed code — field lost)

**Expected Counterexamples**:
- `getTicketingConfigByEvent()` returns `null` after enabling ticketing on a new event
- Config row fields don't match the values provided in the update payload

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds, the fixed function produces the expected behavior.

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := updateEvent_fixed(id, input)
  config := getTicketingConfigByEvent(id)
  ASSERT config IS NOT NULL
  ASSERT config reflects the ticketing fields from input
END FOR
```

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold, the fixed function produces the same result as the original function.

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  configBefore := getTicketingConfigByEvent(id)
  result := updateEvent_fixed(id, input)
  configAfter := getTicketingConfigByEvent(id)
  ASSERT configBefore = configAfter
  ASSERT event table fields are persisted identically to original function
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- It generates many random non-ticketing payloads to verify the config table is never touched
- It catches edge cases like empty payloads, payloads with only activities, etc.
- It provides strong guarantees that the fix is surgical and doesn't affect unrelated code paths

**Test Plan**: Observe behavior on UNFIXED code first for non-ticketing updates, then write property-based tests capturing that behavior.

**Test Cases**:
1. **Non-Ticketing Update Preservation**: Verify that updating name/description/dates does not create or modify any `event_ticketing_config` row
2. **Activity Update Preservation**: Verify that updating activities continues to work via `eventActivityService.replaceActivitiesForEvent()` and does not affect ticketing config
3. **Existing Config Preservation**: Verify that an event with existing ticketing config retains that config unchanged when only non-ticketing fields are updated

### Unit Tests

- Test `updateEvent()` with ticketing fields on an event with no existing config → assert config row created
- Test `updateEvent()` with ticketing fields on an event with existing config → assert config row updated
- Test `updateEvent()` with `generateElectronicTickets = false` → assert config row updated
- Test `updateEvent()` with no ticketing fields → assert config table untouched
- Test `updateEvent()` with only optional ticketing fields (no `generateElectronicTickets`) → assert config created/updated

### Property-Based Tests

- Generate random `UpdateEventDto` payloads with ticketing fields and verify config is always persisted correctly (fix checking)
- Generate random `UpdateEventDto` payloads without ticketing fields and verify config table is never modified (preservation checking)
- Generate random combinations of ticketing and non-ticketing fields and verify both are persisted correctly

### Integration Tests

- Test full edit event flow: load event → modify ticketing settings → save → reload → verify ticketing settings persisted
- Test enabling ticketing, then updating it, then disabling it in sequence
- Test concurrent updates to ticketing and non-ticketing fields in a single save
