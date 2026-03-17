# Implementation Plan

- [x] 1. Write bug condition exploration test
  - **Property 1: Fault Condition** - Registration Type Discount IDs Silently Dropped
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate the bug exists
  - **Scoped PBT Approach**: Scope the property to concrete failing cases: create/update Registration Type with non-empty `discountIds` array
  - Test file: `packages/backend/src/services/__tests__/registration-discount-bug.property.test.ts`
  - Test that `createRegistrationType({ ..., discountIds: ['valid-id'] })` returns a result with `discountIds` containing the provided IDs (from Fault Condition in design: `isBugCondition(input)` where `operation = 'create' AND discountIds IS NOT EMPTY`)
  - Test that `updateRegistrationType(id, { discountIds: ['valid-id'] })` returns a result with updated `discountIds` (from Fault Condition: `operation = 'update' AND discountIds IS DEFINED`)
  - Test that reading a Registration Type returns `discountIds` field (from Fault Condition: `operation = 'read'`)
  - Test that `createRegistrationType` with invalid discount IDs throws a validation error (from Fault Condition: no `validateDiscountIds()` exists)
  - Run test on UNFIXED code - expect FAILURE (this confirms the bug exists)
  - **EXPECTED OUTCOME**: Test FAILS because `discountIds` field doesn't exist on interfaces, INSERT/UPDATE queries don't include `discount_ids`, `rowToRegistrationType()` doesn't map it, and no validation exists
  - Document counterexamples found (e.g., `result.discountIds` is `undefined`, no validation error for invalid IDs)
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 1.1, 1.2, 1.3, 1.5_

- [x] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - Existing Registration Type Fields and Membership Discount Pipeline
  - **IMPORTANT**: Follow observation-first methodology
  - Test file: `packages/backend/src/services/__tests__/registration-discount-preservation.property.test.ts`
  - Observe: `createRegistrationType({ name: 'Test', entityName: 'Registrant', ... })` on unfixed code returns all fields correctly
  - Observe: `updateRegistrationType(id, { name: 'Updated' })` on unfixed code preserves all other fields
  - Observe: `MembershipService.validateDiscountIds()` continues to validate with `module_type = 'memberships'`
  - Observe: `DiscountService.getMembershipTypesUsingDiscount()` continues to return correct membership type IDs
  - Write property-based test: for all Registration Type create operations without `discountIds`, all existing fields (name, description, entityName, registrationFormId, registrationStatus, isRollingRegistration, validUntil, numberOfMonths, automaticallyApprove, registrationLabels, supportedPaymentMethods, useTermsAndConditions, termsAndConditions) are stored and returned identically (from Preservation Requirements in design)
  - Write property-based test: for all Registration Type update operations without `discountIds` in payload, existing fields are preserved and only specified fields change
  - Write property-based test: membership discount validation and `getMembershipTypesUsingDiscount()` produce identical results
  - Verify tests pass on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 3. Fix Registration Type discount integration

  - [x] 3.1 Add database migration for `discount_ids` column
    - Create migration file `packages/backend/src/database/migrations/009_add_registration_type_discount_ids.sql`
    - Add `ALTER TABLE registration_types ADD COLUMN discount_ids JSONB DEFAULT '[]';`
    - Existing rows will get the default empty array
    - _Bug_Condition: isBugCondition(input) — no `discount_ids` column exists on `registration_types` table_
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 3.2 Update interfaces and DTOs in `registration.service.ts`
    - Add `discountIds: string[];` to `RegistrationType` interface
    - Add `discountIds?: string[];` to `CreateRegistrationTypeDto` interface
    - Add `discountIds?: string[];` to `UpdateRegistrationTypeDto` interface
    - _Bug_Condition: isBugCondition(input) — interfaces lack `discountIds` field_
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 3.3 Update `rowToRegistrationType()` to map `discount_ids`
    - Add mapping: `discountIds: row.discount_ids ? (Array.isArray(row.discount_ids) ? row.discount_ids : JSON.parse(row.discount_ids)) : []`
    - Follow the same pattern used in `rowToMembershipType()` in `membership.service.ts`
    - _Bug_Condition: isBugCondition(input) where operation = 'read' — `discount_ids` not mapped from DB row_
    - _Expected_Behavior: `result.discountIds` equals stored discount IDs_
    - _Requirements: 2.3_

  - [x] 3.4 Add `validateDiscountIds()` method to `RegistrationService`
    - Copy pattern from `MembershipService.validateDiscountIds()` (line 792 of membership.service.ts)
    - Change expected `module_type` from `'memberships'` to `'registrations'`
    - Batch query discounts using `WHERE id = ANY($1)` and validate: existence, organisation ownership, module type, active status
    - Return `{ valid: boolean, errors: Array<{ discountId, reason, message }> }`
    - _Bug_Condition: isBugCondition(input) — no validation exists for discount IDs on registration types_
    - _Expected_Behavior: Invalid discount IDs rejected with specific error reasons_
    - _Requirements: 2.5_

  - [x] 3.5 Update `createRegistrationType()` to validate and store `discountIds`
    - Add discount validation block before INSERT: call `this.validateDiscountIds(data.discountIds, data.organisationId)` when `discountIds` is non-empty
    - Throw error with validation details if invalid
    - Add `discount_ids` to INSERT column list (position 15)
    - Add `JSON.stringify(data.discountIds || [])` to INSERT values array
    - Update parameter placeholders ($1-$15)
    - _Bug_Condition: isBugCondition(input) where operation = 'create' AND discountIds IS NOT EMPTY_
    - _Expected_Behavior: `createRegistrationType_fixed(input).discountIds = input.discountIds`_
    - _Preservation: Creates without discountIds continue to work with empty array default_
    - _Requirements: 2.1, 2.5, 3.1_

  - [x] 3.6 Update `updateRegistrationType()` to validate and conditionally update `discountIds`
    - Add discount validation block: when `data.discountIds` is defined and non-empty, call `this.validateDiscountIds(data.discountIds, existing.organisationId)`
    - Add conditional update block: `if (data.discountIds !== undefined) { updates.push(\`discount_ids = $\${paramCount++}\`); values.push(JSON.stringify(data.discountIds)); }`
    - _Bug_Condition: isBugCondition(input) where operation = 'update' AND discountIds IS DEFINED_
    - _Expected_Behavior: `updateRegistrationType_fixed(input).discountIds = input.discountIds`_
    - _Preservation: Updates without discountIds in payload do not alter existing discount_ids_
    - _Requirements: 2.2, 2.5, 3.2_

  - [x] 3.7 Add `getRegistrationTypesUsingDiscount()` to `DiscountService`
    - Copy pattern from `getMembershipTypesUsingDiscount()` (line 700 of discount.service.ts)
    - Query `registration_types` table instead of `membership_types`
    - Use `discount_ids @> $2::jsonb` containment operator
    - Return array of Registration Type IDs
    - _Bug_Condition: isBugCondition(input) where operation = 'queryUsage'_
    - _Expected_Behavior: Returns all Registration Type IDs whose `discount_ids` contains the queried discount ID_
    - _Preservation: `getMembershipTypesUsingDiscount()` remains unchanged_
    - _Requirements: 2.4_

  - [x] 3.8 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - Registration Type Discount IDs Persisted and Returned
    - **IMPORTANT**: Re-run the SAME test from task 1 - do NOT write a new test
    - The test from task 1 encodes the expected behavior
    - When this test passes, it confirms the expected behavior is satisfied
    - Run bug condition exploration test from step 1
    - **EXPECTED OUTCOME**: Test PASSES (confirms bug is fixed)
    - _Requirements: 2.1, 2.2, 2.3, 2.5_

  - [x] 3.9 Verify preservation tests still pass
    - **Property 2: Preservation** - Existing Registration Type Fields and Membership Discount Pipeline
    - **IMPORTANT**: Re-run the SAME tests from task 2 - do NOT write new tests
    - Run preservation property tests from step 2
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)
    - Confirm all tests still pass after fix (no regressions)

- [x] 4. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.
