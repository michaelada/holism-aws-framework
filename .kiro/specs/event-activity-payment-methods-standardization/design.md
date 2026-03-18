# Event Activity Payment Methods Standardization Bugfix Design

## Overview

The Event Activity module uses a hardcoded single-select dropdown with three string values (`'card'`, `'cheque'`, `'both'`) for payment method selection, while every other module (Memberships, Registrations, Calendar, Merchandise) uses a dynamic multi-select dropdown that loads payment methods from the `/api/orgadmin/payment-methods` API and stores an array of UUIDs. This fix standardizes the Event Activity module to use the same dynamic multi-select pattern, including the card-based detection logic for the handling fee toggle and the offline detection logic for cheque payment instructions.

## Glossary

- **Bug_Condition (C)**: The condition that triggers the bug — when the Event Activity form renders a hardcoded single-select payment method dropdown instead of a dynamic multi-select, and stores a string enum instead of UUID arrays
- **Property (P)**: The desired behavior — Event Activity form loads payment methods from the API, renders a multi-select dropdown, stores UUID arrays, and uses dynamic name-based detection for handling fee and offline payment visibility
- **Preservation**: Existing behavior that must remain unchanged — fee=0 hides payment UI, handling fee boolean storage, cheque instructions storage, all other form fields, and all other modules
- **EventActivityForm**: The React component in `packages/orgadmin-events/src/components/EventActivityForm.tsx` that renders the activity configuration form
- **EventActivityFormData**: The TypeScript interface in `packages/orgadmin-events/src/types/event.types.ts` defining the form data shape
- **EventActivityService**: The backend service in `packages/backend/src/services/event-activity.service.ts` that persists activities to the database
- **isCardPaymentMethod**: A helper function (used in MembershipTypeForm and other modules) that checks if a payment method name contains 'card', 'stripe', or 'helix' (case-insensitive)
- **supportedPaymentMethods**: The standardized field name used by all other modules — an array of payment method UUID strings

## Bug Details

### Bug Condition

The bug manifests when an admin configures payment methods for an Event Activity. The `EventActivityForm` component renders a hardcoded `<Select>` with three `<MenuItem>` options (`'card'`, `'cheque'`, `'both'`) instead of loading payment methods from the API. The backend `EventActivityService` stores a single `VARCHAR(20)` string in the `allowed_payment_method` column instead of a JSONB array of UUIDs. The handling fee toggle visibility checks `allowedPaymentMethod === 'card' || allowedPaymentMethod === 'both'` instead of dynamically looking up payment method names.

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type { component: string, field: string, fee: number }
  OUTPUT: boolean
  
  RETURN input.component == 'EventActivityForm'
         AND input.fee > 0
         AND (
           input.field == 'paymentMethodSelection'
           OR input.field == 'handlingFeeVisibility'
           OR input.field == 'chequeInstructionsVisibility'
           OR input.field == 'paymentMethodStorage'
         )
END FUNCTION
```

### Examples

- **Example 1**: Admin opens Event Activity form with fee > 0 → sees single-select with "Card", "Cheque", "Both" options. Expected: sees multi-select dropdown populated from `/api/orgadmin/payment-methods` API with dynamic payment method names.
- **Example 2**: Admin selects "Card" payment method → form stores `allowedPaymentMethod: 'card'`. Expected: form stores `supportedPaymentMethods: ['uuid-of-card-method']`.
- **Example 3**: Organisation adds a new payment method "Bank Transfer" via API → Event Activity form still shows only "Card", "Cheque", "Both". Expected: "Bank Transfer" appears in the multi-select dropdown automatically.
- **Example 4**: Admin selects a card-based payment method → handling fee toggle visibility is determined by `allowedPaymentMethod === 'card'`. Expected: visibility is determined by checking if any selected method's name contains 'card', 'stripe', or 'helix' (case-insensitive).

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- When fee is 0, the payment method selection UI must remain hidden (requirement 3.1)
- All other modules (Memberships, Registrations, Calendar, Merchandise) must continue using their existing multi-select pattern with no code changes (requirement 3.2)
- The `handlingFeeIncluded` boolean must continue to be stored correctly when the handling fee checkbox is toggled (requirement 3.3)
- The `chequePaymentInstructions` text must continue to be stored correctly when entered (requirement 3.4)
- All other Event Activity fields (name, description, application form, limits, terms and conditions, discounts) must function identically (requirement 3.5)
- When no card-based payment method is selected, the handling fee flag must auto-reset to false (requirement 3.6)

**Scope:**
All inputs that do NOT involve the payment method selection, payment method storage, handling fee toggle visibility logic, or cheque instructions visibility logic in the Event Activity module should be completely unaffected by this fix. This includes:
- All form fields other than payment method selection
- All other modules' payment method handling
- Mouse/keyboard interactions with non-payment fields
- Event creation/update flows for non-payment data

## Hypothesized Root Cause

Based on the bug description and code analysis, the root causes are:

1. **Hardcoded UI in EventActivityForm.tsx**: Lines ~258-270 render a single-select `<Select>` with three hardcoded `<MenuItem>` values (`'card'`, `'cheque'`, `'both'`) instead of loading payment methods from the API and rendering a multi-select with `<Chip>` display, as done in `MembershipTypeForm.tsx` lines ~210-230.

2. **Wrong Type Definition in event.types.ts**: The `EventActivityFormData` interface defines `allowedPaymentMethod: 'card' | 'cheque' | 'both'` (a string enum) instead of `supportedPaymentMethods: string[]` (a UUID array), preventing the form from storing multiple payment method UUIDs.

3. **Hardcoded Visibility Logic in EventActivityForm.tsx**: The handling fee toggle visibility checks `activity.allowedPaymentMethod === 'card' || activity.allowedPaymentMethod === 'both'` (lines ~272-280) instead of using the `isCardPaymentMethod` pattern that looks up method names dynamically. Similarly, cheque instructions visibility checks `activity.allowedPaymentMethod === 'cheque' || activity.allowedPaymentMethod === 'both'`.

4. **Database Schema Mismatch**: The `event_activities` table uses `allowed_payment_method VARCHAR(20)` with a CHECK constraint limiting values to `('card', 'cheque', 'both')`, while other modules use a JSONB column for `supported_payment_methods` that stores a JSON array of UUID strings.

5. **Backend Service Uses Wrong Column**: The `EventActivityService` reads/writes `allowed_payment_method` as a single string value instead of `supported_payment_methods` as a JSON array, and the `rowToActivity` mapping reflects this.

6. **No Payment Methods API Call**: The `EventActivityForm` component does not fetch payment methods from `/api/orgadmin/payment-methods`, unlike the parent pages of other modules (e.g., `CreateSingleMembershipTypePage`) which load payment methods and pass them as props.

## Correctness Properties

Property 1: Bug Condition - Dynamic Payment Method Multi-Select Rendering

_For any_ set of payment methods returned by the `/api/orgadmin/payment-methods` API endpoint, when the Event Activity form is rendered with fee > 0, the form SHALL display a multi-select dropdown labeled "Supported Payment Methods" containing all returned payment methods, and selecting any subset SHALL store an array of the corresponding payment method UUIDs in the `supportedPaymentMethods` field.

**Validates: Requirements 2.1, 2.2, 2.5**

Property 2: Bug Condition - Card-Based Handling Fee Toggle Visibility

_For any_ set of selected payment methods in the Event Activity form, the handling fee toggle SHALL be visible if and only if at least one selected payment method has a name containing 'card', 'stripe', or 'helix' (case-insensitive), and the fee is greater than 0. When no card-based method is selected, `handlingFeeIncluded` SHALL be reset to false.

**Validates: Requirements 2.3, 3.6**

Property 3: Bug Condition - Offline Payment Instructions Visibility

_For any_ set of selected payment methods in the Event Activity form, the cheque/offline payment instructions field SHALL be visible if and only if at least one selected payment method is an offline method (name does not contain 'card', 'stripe', or 'helix', case-insensitive), and the fee is greater than 0.

**Validates: Requirements 2.4**

Property 4: Bug Condition - Backend UUID Array Storage

_For any_ array of payment method UUIDs submitted for an Event Activity, the backend service SHALL store the array in the `supported_payment_methods` JSONB column and retrieve it correctly as a `string[]`, replacing the old `allowed_payment_method VARCHAR(20)` column.

**Validates: Requirements 2.2, 2.6**

Property 5: Preservation - Payment UI Hidden When Fee Is Zero

_For any_ Event Activity with fee equal to 0, the payment method selection UI SHALL NOT be rendered, preserving the existing behavior where payment methods are only relevant for paid activities.

**Validates: Requirements 3.1**

Property 6: Preservation - Other Form Fields Unchanged

_For any_ Event Activity form interaction that does not involve payment method selection, the form SHALL produce the same behavior as the original code, preserving all existing functionality for name, description, application form, limits, terms and conditions, discounts, and other fields.

**Validates: Requirements 3.5**


## Fix Implementation

### Changes Required

Assuming our root cause analysis is correct:

**File**: `packages/orgadmin-events/src/types/event.types.ts`

**Interfaces**: `EventActivity`, `EventActivityFormData`

**Specific Changes**:
1. **Replace `allowedPaymentMethod` with `supportedPaymentMethods`**: Change the field from `allowedPaymentMethod: 'card' | 'cheque' | 'both'` to `supportedPaymentMethods: string[]` in both `EventActivity` and `EventActivityFormData` interfaces. Update the `EventEntry.paymentMethod` type if needed.

---

**File**: `packages/orgadmin-events/src/components/EventActivityForm.tsx`

**Component**: `EventActivityForm`

**Specific Changes**:
2. **Add `paymentMethods` prop**: Add a `paymentMethods: Array<{ id: string; name: string }>` prop to `EventActivityFormProps`, matching the pattern in `MembershipTypeForm`.
3. **Add `isCardPaymentMethod` helper**: Add the card detection function that checks if a payment method name contains 'card', 'stripe', or 'helix' (case-insensitive), matching `MembershipTypeForm`.
4. **Replace single-select with multi-select**: Replace the hardcoded `<Select>` with a `multiple` `<Select>` that renders `<MenuItem>` for each payment method from props, with `<Chip>` display for selected values, matching `MembershipTypeForm`.
5. **Update handling fee visibility**: Replace `activity.allowedPaymentMethod === 'card' || activity.allowedPaymentMethod === 'both'` with `hasCardPayment && activity.fee > 0` using the `isCardPaymentMethod` helper.
6. **Update cheque instructions visibility**: Replace `activity.allowedPaymentMethod === 'cheque' || activity.allowedPaymentMethod === 'both'` with a check for any non-card payment method in the selected methods.
7. **Add `handlePaymentMethodsChange` handler**: Add a handler that updates `supportedPaymentMethods` and auto-resets `handlingFeeIncluded` when no card method is selected, matching `MembershipTypeForm.handlePaymentMethodsChange`.

---

**File**: `packages/orgadmin-events/src/pages/CreateEventPage.tsx`

**Component**: `CreateEventPage`

**Specific Changes**:
8. **Load payment methods from API**: Add a `loadPaymentMethods` function that fetches from `/api/orgadmin/payment-methods`, matching `CreateSingleMembershipTypePage`.
9. **Pass `paymentMethods` prop to `EventActivityForm`**: Pass the loaded payment methods array to each `EventActivityForm` instance.
10. **Update default activity initialization**: Change `allowedPaymentMethod: 'both'` to `supportedPaymentMethods: []` in `handleAddActivity`.

---

**File**: `packages/backend/src/services/event-activity.service.ts`

**Service**: `EventActivityService`

**Specific Changes**:
11. **Update interfaces**: Replace `allowedPaymentMethod: 'card' | 'cheque' | 'both'` with `supportedPaymentMethods: string[]` in `EventActivity` and `CreateEventActivityDto`.
12. **Update SQL INSERT**: Replace `allowed_payment_method` column with `supported_payment_methods` and use `JSON.stringify()` for the value, matching `membership.service.ts`.
13. **Update SQL UPDATE**: Replace `allowed_payment_method` column reference with `supported_payment_methods` and use `JSON.stringify()`.
14. **Update `rowToActivity` mapping**: Replace `allowedPaymentMethod: row.allowed_payment_method` with `supportedPaymentMethods: row.supported_payment_methods || []`.

---

**File**: `packages/backend/src/services/event.service.ts`

**Service**: `EventService`

**Specific Changes**:
15. **Update `EventActivity` interface**: Replace `allowedPaymentMethod` with `supportedPaymentMethods: string[]`.
16. **Update `cloneEvent` activity mapping**: Replace `allowedPaymentMethod: activity.allowedPaymentMethod` with `supportedPaymentMethods: activity.supportedPaymentMethods`.

---

**Database Migration**:

17. **Add new column**: `ALTER TABLE event_activities ADD COLUMN supported_payment_methods JSONB DEFAULT '[]'::jsonb;`
18. **Migrate existing data**: Convert existing `allowed_payment_method` values to UUID arrays by looking up corresponding payment method IDs, or store empty arrays for migration.
19. **Drop old column**: `ALTER TABLE event_activities DROP COLUMN allowed_payment_method;`

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate the bug on unfixed code, then verify the fix works correctly and preserves existing behavior.

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate the bug BEFORE implementing the fix. Confirm or refute the root cause analysis. If we refute, we will need to re-hypothesize.

**Test Plan**: Write tests that render the `EventActivityForm` with fee > 0 and assert that a multi-select dropdown is rendered with dynamic payment methods from props. Run these tests on the UNFIXED code to observe failures and confirm the hardcoded dropdown is the root cause.

**Test Cases**:
1. **Multi-Select Rendering Test**: Render EventActivityForm with fee > 0 and payment methods prop → assert multi-select dropdown exists with API-loaded options (will fail on unfixed code because the dropdown is hardcoded)
2. **UUID Storage Test**: Select payment methods and assert `supportedPaymentMethods` array is produced in onChange (will fail on unfixed code because it produces `allowedPaymentMethod` string)
3. **Dynamic Card Detection Test**: Select a payment method named "Card Payment (Stripe)" and assert handling fee toggle is visible via name-based detection (will fail on unfixed code because it checks hardcoded string)
4. **Backend Array Storage Test**: Call `createActivity` with `supportedPaymentMethods: ['uuid1', 'uuid2']` and assert it stores a JSONB array (will fail on unfixed code because the column doesn't exist)

**Expected Counterexamples**:
- EventActivityForm renders a single-select with hardcoded 'card'/'cheque'/'both' options instead of a multi-select with API data
- Form onChange produces `{ allowedPaymentMethod: 'card' }` instead of `{ supportedPaymentMethods: ['uuid'] }`
- Handling fee toggle visibility is determined by string comparison, not by payment method name lookup

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds, the fixed function produces the expected behavior.

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := EventActivityForm_fixed(input)
  ASSERT result.paymentDropdown.type == 'multi-select'
  ASSERT result.paymentDropdown.options == loadedFromAPI
  ASSERT result.selectedValues IS Array<UUID>
  ASSERT result.handlingFeeVisible == hasCardPaymentMethod(selectedMethods)
  ASSERT result.chequeInstructionsVisible == hasOfflinePaymentMethod(selectedMethods)
END FOR
```

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold, the fixed function produces the same result as the original function.

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT EventActivityForm_original(input) = EventActivityForm_fixed(input)
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- It generates many test cases automatically across the input domain
- It catches edge cases that manual unit tests might miss
- It provides strong guarantees that behavior is unchanged for all non-buggy inputs

**Test Plan**: Observe behavior on UNFIXED code first for fee=0 activities and non-payment fields, then write property-based tests capturing that behavior.

**Test Cases**:
1. **Fee Zero Preservation**: Observe that payment UI is hidden when fee=0 on unfixed code, then write property test to verify this continues after fix across many fee=0 scenarios
2. **Other Fields Preservation**: Observe that name, description, application form, limits, T&Cs, discounts all work on unfixed code, then write property test to verify these fields are unaffected by the fix
3. **Handling Fee Storage Preservation**: Observe that `handlingFeeIncluded` boolean is stored correctly on unfixed code, then write test to verify this continues after fix
4. **Cheque Instructions Storage Preservation**: Observe that `chequePaymentInstructions` text is stored correctly on unfixed code, then write test to verify this continues after fix

### Unit Tests

- Test that EventActivityForm renders a multi-select dropdown with payment methods from props when fee > 0
- Test that selecting payment methods produces a `supportedPaymentMethods` UUID array via onChange
- Test that handling fee toggle is visible only when a card-based method is selected and fee > 0
- Test that cheque instructions field is visible only when an offline method is selected and fee > 0
- Test that `handlingFeeIncluded` resets to false when the last card-based method is deselected
- Test that payment UI is hidden when fee is 0
- Test backend `createActivity` stores `supported_payment_methods` as JSONB array
- Test backend `rowToActivity` correctly maps `supported_payment_methods` to `supportedPaymentMethods: string[]`

### Property-Based Tests

- Generate random sets of payment methods with random names and verify the multi-select renders all of them
- Generate random subsets of payment methods and verify `isCardPaymentMethod` correctly identifies card-based methods by name substring matching
- Generate random fee values (including 0) and verify payment UI visibility is correct
- Generate random activity form data for non-payment fields and verify they are unaffected by the fix
- Generate random UUID arrays and verify backend round-trip storage/retrieval preserves the array

### Integration Tests

- Test full event creation flow: load payment methods from API → select methods in multi-select → submit → verify backend stores UUID array
- Test event editing flow: load existing event with `supportedPaymentMethods` → verify multi-select shows correct selections → update → verify storage
- Test event cloning: clone an event with `supportedPaymentMethods` → verify cloned activity has the same payment methods
- Test that handling fee toggle and cheque instructions visibility update dynamically as payment methods are selected/deselected
