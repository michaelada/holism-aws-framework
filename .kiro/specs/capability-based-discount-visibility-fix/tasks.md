# Implementation Plan

- [x] 1. Write bug condition exploration test
  - **Property 1: Fault Condition** - Event Discount Selector Capability Check
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate the bug exists
  - **Scoped PBT Approach**: For deterministic bugs, scope the property to the concrete failing case(s) to ensure reproducibility
  - Test that CreateEventPage and EditEventPage hide discount selector when organization lacks 'entry-discounts' capability
  - Test implementation details from Fault Condition in design: `isBugCondition(input)` where `input.page IN ['CreateEventPage', 'EditEventPage'] AND 'entry-discounts' NOT IN input.organisation.enabledCapabilities`
  - The test assertions should match the Expected Behavior Properties from design: discount selector SHALL be hidden for organizations without 'entry-discounts' capability
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS (this is correct - it proves the bug exists)
  - Document counterexamples found to understand root cause (e.g., "discount selector is visible when organization has ['events'] but not 'entry-discounts'")
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 2.3_

- [x] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - Existing Capability Checks
  - **IMPORTANT**: Follow observation-first methodology
  - Observe behavior on UNFIXED code for non-buggy inputs (membership forms, navigation menu)
  - Write property-based tests capturing observed behavior patterns from Preservation Requirements
  - Test that CreateSingleMembershipTypePage correctly hides discount selector without 'entry-discounts' capability
  - Test that CreateGroupMembershipTypePage correctly hides discount selector without 'entry-discounts' capability
  - Test that Discounts submenu item is correctly filtered by Layout component based on 'entry-discounts' capability
  - Test that CreateEventPage shows discount selector when organization HAS 'entry-discounts' capability
  - Property-based testing generates many test cases for stronger guarantees
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.4, 3.5_

- [x] 3. Fix for capability-based discount visibility

  - [x] 3.1 Implement the fix in CreateEventPage
    - Import useCapabilities hook from @aws-web-framework/orgadmin-shell
    - Initialize hook: `const { hasCapability } = useCapabilities();`
    - Update conditional rendering: change `{discounts.length > 0 && (` to `{hasCapability('entry-discounts') && discounts.length > 0 && (`
    - _Bug_Condition: isBugCondition(input) where input.page = 'CreateEventPage' AND 'entry-discounts' NOT IN input.organisation.enabledCapabilities_
    - _Expected_Behavior: discount selector SHALL be hidden when organization lacks 'entry-discounts' capability_
    - _Preservation: Existing capability checks in Layout and membership forms remain unchanged_
    - _Requirements: 2.3, 3.1, 3.2, 3.4, 3.5_

  - [x] 3.2 Implement the fix in EditEventPage (if applicable)
    - Import useCapabilities hook from @aws-web-framework/orgadmin-shell
    - Initialize hook: `const { hasCapability } = useCapabilities();`
    - Update conditional rendering: change `{discounts.length > 0 && (` to `{hasCapability('entry-discounts') && discounts.length > 0 && (`
    - _Bug_Condition: isBugCondition(input) where input.page = 'EditEventPage' AND 'entry-discounts' NOT IN input.organisation.enabledCapabilities_
    - _Expected_Behavior: discount selector SHALL be hidden when organization lacks 'entry-discounts' capability_
    - _Preservation: Existing capability checks in Layout and membership forms remain unchanged_
    - _Requirements: 2.3, 3.1, 3.2, 3.4, 3.5_

  - [x] 3.3 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - Event Discount Selector Capability Check
    - **IMPORTANT**: Re-run the SAME test from task 1 - do NOT write a new test
    - The test from task 1 encodes the expected behavior
    - When this test passes, it confirms the expected behavior is satisfied
    - Run bug condition exploration test from step 1
    - **EXPECTED OUTCOME**: Test PASSES (confirms bug is fixed)
    - _Requirements: Expected Behavior Properties from design (2.3)_

  - [x] 3.4 Verify preservation tests still pass
    - **Property 2: Preservation** - Existing Capability Checks
    - **IMPORTANT**: Re-run the SAME tests from task 2 - do NOT write new tests
    - Run preservation property tests from step 2
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)
    - Confirm all tests still pass after fix (no regressions)

- [x] 4. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.
