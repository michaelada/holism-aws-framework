# Registration Type Discount Integration Bugfix Design

## Overview

The backend registration service is missing the entire discount pipeline that the membership service already implements. The frontend `RegistrationTypeForm` component renders a `<DiscountSelector>` and includes `discountIds` in its form state, but the backend silently discards these values on create/update and never returns them on read. The fix replicates the proven membership service pattern: add a `discount_ids JSONB` column to `registration_types`, add `discountIds` to all interfaces and DTOs, wire up validation via `validateDiscountIds()`, and add `getRegistrationTypesUsingDiscount()` to the discount service.

## Glossary

- **Bug_Condition (C)**: Any create, update, or read operation on a Registration Type that involves discount IDs — the discount data is silently dropped or missing
- **Property (P)**: Discount IDs should be validated, persisted, and returned identically to how the membership service handles them
- **Preservation**: All existing Registration Type fields (name, description, entityName, etc.) and all Membership Type discount functionality must remain unchanged
- **`RegistrationService`**: The service in `packages/backend/src/services/registration.service.ts` that manages Registration Type CRUD operations
- **`DiscountService`**: The service in `packages/backend/src/services/discount.service.ts` that manages discount operations and usage queries
- **`MembershipService`**: The reference implementation in `packages/backend/src/services/membership.service.ts` that has the working discount pipeline

## Bug Details

### Fault Condition

The bug manifests when any Registration Type operation involves discount IDs. The `RegistrationService` has no `discountIds` field on any interface, no `discount_ids` column in the INSERT/UPDATE queries, no mapping in `rowToRegistrationType()`, and no validation logic. The `DiscountService` also lacks a `getRegistrationTypesUsingDiscount()` method.

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type { operation: 'create' | 'update' | 'read' | 'queryUsage', discountIds?: string[], registrationTypeId?: string, discountId?: string }
  OUTPUT: boolean

  IF input.operation = 'create' AND input.discountIds IS NOT EMPTY
    RETURN TRUE  // discountIds silently discarded on INSERT
  END IF

  IF input.operation = 'update' AND input.discountIds IS DEFINED
    RETURN TRUE  // discountIds silently discarded on UPDATE
  END IF

  IF input.operation = 'read' AND registrationTypeHasStoredDiscounts(input.registrationTypeId)
    RETURN TRUE  // discountIds not mapped from DB row
  END IF

  IF input.operation = 'queryUsage' AND input.discountId IS DEFINED
    RETURN TRUE  // no getRegistrationTypesUsingDiscount() method exists
  END IF

  RETURN FALSE
END FUNCTION
```

### Examples

- **Create with discounts**: User creates a Registration Type with `discountIds: ['disc-1', 'disc-2']` → discounts are silently dropped, saved with no discount association
- **Update with discounts**: User updates a Registration Type to add `discountIds: ['disc-3']` → update succeeds but discount change is ignored
- **Read after manual DB insert**: If `discount_ids` were manually set in the DB, `rowToRegistrationType()` would not include them in the response
- **Invalid discount on create**: User provides `discountIds: ['nonexistent-id']` → no validation error, silently dropped
- **Discount usage query**: Discount service checks if a discount is used by any Registration Type → always returns empty because no method or column exists

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- All existing Registration Type fields (name, description, entityName, registrationFormId, registrationStatus, isRollingRegistration, validUntil, numberOfMonths, automaticallyApprove, registrationLabels, supportedPaymentMethods, useTermsAndConditions, termsAndConditions) must continue to be created, updated, and read identically
- Creating a Registration Type without discounts must continue to work with an empty discount array
- Updating a Registration Type without providing `discountIds` in the payload must not alter existing discount associations
- Membership Type discount validation and storage via `MembershipService` must remain unchanged
- `getMembershipTypesUsingDiscount()` in `DiscountService` must continue to return correct results
- `isDiscountInUse()` must continue to check events and event_activities tables

**Scope:**
All inputs that do NOT involve `discountIds` on Registration Types should be completely unaffected by this fix. This includes:
- Registration Type CRUD without discount fields
- All Registration (individual registration record) operations
- All Membership Type and Member operations
- All Discount CRUD operations
- Custom filter operations
- Export operations

## Hypothesized Root Cause

Based on the code analysis, the root cause is straightforward — the discount pipeline was never implemented for Registration Types:

1. **Missing Database Column**: The `registration_types` table has no `discount_ids` column. The membership_types table has `discount_ids JSONB DEFAULT '[]'` which was added as part of the membership discount feature, but the equivalent was never added for registrations.

2. **Missing Interface Fields**: `RegistrationType`, `CreateRegistrationTypeDto`, and `UpdateRegistrationTypeDto` interfaces all lack a `discountIds` field. The membership equivalents (`MembershipType`, `CreateMembershipTypeDto`, `UpdateMembershipTypeDto`) all include `discountIds: string[]` / `discountIds?: string[]`.

3. **Missing Row Mapping**: `rowToRegistrationType()` does not map `row.discount_ids`. The membership equivalent `rowToMembershipType()` maps it with: `discountIds: row.discount_ids ? (Array.isArray(row.discount_ids) ? row.discount_ids : JSON.parse(row.discount_ids)) : []`.

4. **Missing Validation**: `RegistrationService` has no `validateDiscountIds()` method. `MembershipService` has this method which batch-queries discounts and validates existence, organisation ownership, module type (`'memberships'`), and active status.

5. **Missing SQL in Create/Update**: The INSERT query in `createRegistrationType()` does not include `discount_ids` in its column list or values. The UPDATE query in `updateRegistrationType()` has no conditional block for `discount_ids`. Both membership equivalents include these.

6. **Missing Discount Service Method**: `DiscountService` has `getMembershipTypesUsingDiscount()` but no `getRegistrationTypesUsingDiscount()` equivalent.

## Correctness Properties

Property 1: Fault Condition - Discount IDs Persisted and Returned on Create

_For any_ Registration Type creation where `discountIds` is a non-empty array of valid discount IDs (existing, correct organisation, module type `'registrations'`, active status), the fixed `createRegistrationType` function SHALL persist the discount IDs in the `discount_ids` JSONB column and return them in the `discountIds` field of the response.

**Validates: Requirements 2.1, 2.3**

Property 2: Fault Condition - Discount IDs Updated and Returned on Update

_For any_ Registration Type update where `discountIds` is provided, the fixed `updateRegistrationType` function SHALL validate the discount IDs and update the `discount_ids` column, returning the updated values in the response.

**Validates: Requirements 2.2, 2.3**

Property 3: Fault Condition - Invalid Discount IDs Rejected

_For any_ Registration Type create or update where `discountIds` contains invalid IDs (non-existent, wrong organisation, wrong module type, or inactive), the fixed service SHALL reject the request with a validation error containing specific reasons per invalid ID.

**Validates: Requirements 2.5**

Property 4: Fault Condition - Registration Type Usage Query

_For any_ discount ID query, the fixed `getRegistrationTypesUsingDiscount` function SHALL return the IDs of all Registration Types whose `discount_ids` column contains the queried discount ID.

**Validates: Requirements 2.4**

Property 5: Preservation - Existing Fields Unchanged

_For any_ Registration Type create or update operation, the fixed service SHALL produce the same result as the original service for all non-discount fields (name, description, entityName, registrationFormId, registrationStatus, isRollingRegistration, validUntil, numberOfMonths, automaticallyApprove, registrationLabels, supportedPaymentMethods, useTermsAndConditions, termsAndConditions).

**Validates: Requirements 3.1, 3.2, 3.4**

Property 6: Preservation - Membership Discount Pipeline Unchanged

_For any_ Membership Type operation involving discounts, the fixed code SHALL produce exactly the same behavior as the original code, preserving all existing membership discount validation, storage, and query functionality.

**Validates: Requirements 3.3, 3.5**

## Fix Implementation

### Changes Required

Assuming our root cause analysis is correct:

**File**: `packages/backend/src/database/migrations/009_add_registration_type_discount_ids.sql`

**Specific Changes**:
1. **Add migration**: `ALTER TABLE registration_types ADD COLUMN discount_ids JSONB DEFAULT '[]';`

**File**: `packages/backend/src/services/registration.service.ts`

**Specific Changes**:
1. **Add `discountIds` to `RegistrationType` interface**: Add `discountIds: string[];` field
2. **Add `discountIds` to `CreateRegistrationTypeDto`**: Add `discountIds?: string[];` optional field
3. **Add `discountIds` to `UpdateRegistrationTypeDto`**: Add `discountIds?: string[];` optional field
4. **Add `DiscountValidationResult` interface**: Copy from membership service (or import shared type)
5. **Update `rowToRegistrationType()`**: Add mapping: `discountIds: row.discount_ids ? (Array.isArray(row.discount_ids) ? row.discount_ids : JSON.parse(row.discount_ids)) : []`
6. **Update `createRegistrationType()`**:
   - Add discount validation block before INSERT (call `this.validateDiscountIds(data.discountIds, data.organisationId)`)
   - Add `discount_ids` to INSERT column list and `JSON.stringify(data.discountIds || [])` to values
7. **Update `updateRegistrationType()`**:
   - Add discount validation block (call `this.validateDiscountIds(data.discountIds, existing.organisationId)`)
   - Add conditional update block: `if (data.discountIds !== undefined) { updates.push(...); values.push(JSON.stringify(data.discountIds)); }`
8. **Add `validateDiscountIds()` method**: Copy pattern from `MembershipService.validateDiscountIds()`, changing expected `module_type` from `'memberships'` to `'registrations'`

**File**: `packages/backend/src/services/discount.service.ts`

**Specific Changes**:
1. **Add `getRegistrationTypesUsingDiscount()` method**: Copy pattern from `getMembershipTypesUsingDiscount()`, querying `registration_types` table instead of `membership_types`

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate the bug on unfixed code, then verify the fix works correctly and preserves existing behavior.

### Exploratory Fault Condition Checking

**Goal**: Surface counterexamples that demonstrate the bug BEFORE implementing the fix. Confirm or refute the root cause analysis. If we refute, we will need to re-hypothesize.

**Test Plan**: Write tests that call `createRegistrationType` and `updateRegistrationType` with `discountIds` and assert the values are persisted and returned. Run these tests on the UNFIXED code to observe failures.

**Test Cases**:
1. **Create with discountIds**: Call `createRegistrationType` with `discountIds: ['valid-id']` and assert `result.discountIds` contains the ID (will fail — field doesn't exist on interface or response)
2. **Update with discountIds**: Call `updateRegistrationType` with `discountIds: ['valid-id']` and assert `result.discountIds` is updated (will fail — field ignored)
3. **Read discountIds**: Read a Registration Type and assert `discountIds` field exists in response (will fail — not mapped)
4. **Invalid discount validation**: Call `createRegistrationType` with `discountIds: ['nonexistent']` and assert validation error (will fail — no validation exists)

**Expected Counterexamples**:
- `result.discountIds` is `undefined` because the field doesn't exist on the interface
- No validation error thrown for invalid discount IDs
- Possible cause: missing interface fields, missing DB column, missing validation method

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds, the fixed function produces the expected behavior.

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  IF input.operation = 'create' THEN
    result := createRegistrationType_fixed(input)
    ASSERT result.discountIds = input.discountIds
  END IF
  IF input.operation = 'update' THEN
    result := updateRegistrationType_fixed(input)
    ASSERT result.discountIds = input.discountIds
  END IF
  IF input.operation = 'read' THEN
    result := getRegistrationTypeById_fixed(input.id)
    ASSERT result.discountIds = storedDiscountIds
  END IF
  IF input.operation = 'queryUsage' THEN
    result := getRegistrationTypesUsingDiscount_fixed(input.discountId)
    ASSERT result CONTAINS all registration type IDs that reference input.discountId
  END IF
END FOR
```

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold, the fixed function produces the same result as the original function.

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT createRegistrationType_original(input) = createRegistrationType_fixed(input)  // for non-discount fields
  ASSERT updateRegistrationType_original(input) = updateRegistrationType_fixed(input)  // for non-discount fields
  ASSERT getRegistrationTypeById_original(input) = getRegistrationTypeById_fixed(input)  // existing fields identical
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- It generates many combinations of Registration Type field values to verify non-discount fields are unchanged
- It catches edge cases in the dynamic UPDATE query builder where adding the `discount_ids` parameter could shift parameter indices
- It provides strong guarantees that the INSERT column/value alignment is correct after adding the new column

**Test Plan**: Observe behavior on UNFIXED code first for creates/updates without discounts, then write property-based tests capturing that behavior.

**Test Cases**:
1. **Create without discounts preservation**: Create Registration Types with various field combinations (no discountIds) and verify all fields are stored and returned identically to unfixed code
2. **Update without discounts preservation**: Update Registration Types without providing discountIds and verify existing fields are unchanged
3. **Membership discount preservation**: Verify `MembershipService.validateDiscountIds()` and `DiscountService.getMembershipTypesUsingDiscount()` continue to work identically

### Unit Tests

- Test `validateDiscountIds()` with valid IDs, non-existent IDs, wrong organisation, wrong module type, inactive discounts, and empty array
- Test `rowToRegistrationType()` maps `discount_ids` correctly for JSONB array, JSON string, null, and undefined
- Test `createRegistrationType()` includes `discount_ids` in INSERT and returns it
- Test `updateRegistrationType()` conditionally updates `discount_ids` and returns it
- Test `getRegistrationTypesUsingDiscount()` returns correct Registration Type IDs

### Property-Based Tests

- Generate random valid discount ID arrays and verify round-trip: create → read returns same `discountIds`
- Generate random Registration Type field combinations without discounts and verify all fields preserved identically
- Generate random discount ID arrays for update and verify only `discountIds` changes while other fields remain stable

### Integration Tests

- Test full create → read → update → read flow with discount IDs
- Test that creating a Registration Type with discounts and then querying `getRegistrationTypesUsingDiscount` returns the correct ID
- Test that invalid discount IDs on create/update produce validation errors with correct reasons
- Test that the migration adds the column with correct default and existing rows get `'[]'`
