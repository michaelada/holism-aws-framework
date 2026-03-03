# Capability-Based Discount Visibility Fix - Bugfix Design

## Overview

This bugfix addresses the inconsistent capability checking for discount-related UI elements across the org admin application. While the Discounts submenu item and membership type forms correctly check for the 'entry-discounts' capability, the event creation/edit pages display the discount selector regardless of whether the organization has this capability enabled. This creates confusion for users and exposes functionality that should not be accessible.

The fix involves adding capability checks to the CreateEventPage and EditEventPage components to conditionally render the discount selector section only when the organization has the 'entry-discounts' capability.

## Glossary

- **Bug_Condition (C)**: The condition that triggers the bug - when an organization without 'entry-discounts' capability views event creation/edit pages, the discount selector is displayed
- **Property (P)**: The desired behavior - discount selector should only be visible when organization has 'entry-discounts' capability
- **Preservation**: Existing capability-checking behavior in Layout component and membership forms that must remain unchanged
- **hasCapability**: Hook function from useCapabilities that checks if organization has a specific capability enabled
- **entry-discounts**: The capability identifier that controls access to discount management features
- **DiscountSelector**: The UI component that allows users to select and apply discounts to events or membership types

## Bug Details

### Fault Condition

The bug manifests when an organization without the 'entry-discounts' capability accesses the event creation or edit pages. The CreateEventPage and EditEventPage components render the DiscountSelector component without checking if the organization has the required capability, unlike the membership type forms which correctly implement this check.

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type { page: string, organisation: Organisation }
  OUTPUT: boolean
  
  RETURN input.page IN ['CreateEventPage', 'EditEventPage']
         AND 'entry-discounts' NOT IN input.organisation.enabledCapabilities
         AND discountSelectorIsRendered(input.page)
END FUNCTION
```

### Examples

- Organization "Sports Club" has capabilities ['events', 'memberships'] but NOT 'entry-discounts'. When creating an event, the discount selector section is displayed (incorrect - should be hidden)
- Organization "Community Center" has capabilities ['events'] only. When editing an existing event, the discount selector section is displayed (incorrect - should be hidden)
- Organization "Arts Council" has capabilities ['events', 'entry-discounts']. When creating an event, the discount selector section is displayed (correct - should remain visible)
- Organization "Youth Group" has no 'entry-discounts' capability. When creating a membership type, the discount selector is correctly hidden (correct - existing behavior to preserve)

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- The Discounts submenu item in Members module must continue to be filtered by the Layout component based on 'entry-discounts' capability
- CreateSingleMembershipTypePage must continue to check hasCapability('entry-discounts') before rendering discount selector
- CreateGroupMembershipTypePage must continue to check hasCapability('entry-discounts') before rendering discount selector
- All other capability-based UI filtering throughout the application must remain unchanged

**Scope:**
All inputs that do NOT involve the CreateEventPage or EditEventPage discount selector rendering should be completely unaffected by this fix. This includes:
- Navigation menu filtering based on capabilities
- Membership type form discount selector visibility
- Other capability-based feature visibility checks
- Event form sections unrelated to discounts

## Hypothesized Root Cause

Based on the bug description and code analysis, the most likely issues are:

1. **Missing Capability Check**: The CreateEventPage and EditEventPage components do not import or use the useCapabilities hook to check for 'entry-discounts' capability before rendering the DiscountSelector component

2. **Inconsistent Implementation Pattern**: While membership type forms follow the pattern of wrapping the discount Card in `{hasCapability('entry-discounts') && (...)}`, the event pages only check `{discounts.length > 0 && (...)}`, which is insufficient

3. **Copy-Paste Error**: The event pages may have been created before the capability-checking pattern was established, or the capability check was omitted during implementation

4. **Incomplete Feature Integration**: When the discount system was integrated with events, the capability checking requirement may have been overlooked

## Correctness Properties

Property 1: Fault Condition - Event Discount Selector Capability Check

_For any_ organization that does NOT have the 'entry-discounts' capability enabled, the CreateEventPage and EditEventPage SHALL hide the discount selector section, preventing users from seeing or interacting with discount functionality they cannot use.

**Validates: Requirements 2.3**

Property 2: Preservation - Existing Capability Checks

_For any_ UI component that already implements capability checking (Layout submenu filtering, membership type forms), the fixed code SHALL produce exactly the same visibility behavior as before, preserving all existing capability-based filtering logic.

**Validates: Requirements 3.1, 3.2, 3.4, 3.5**

## Fix Implementation

### Changes Required

Assuming our root cause analysis is correct:

**File**: `packages/orgadmin-events/src/pages/CreateEventPage.tsx`

**Function**: `CreateEventPage` component

**Specific Changes**:
1. **Import useCapabilities Hook**: Add import statement for useCapabilities from @aws-web-framework/orgadmin-shell
   - Add: `import { useCapabilities } from '@aws-web-framework/orgadmin-shell';`

2. **Initialize Hook**: Call useCapabilities hook to get hasCapability function
   - Add: `const { hasCapability } = useCapabilities();` near other hook calls

3. **Update Conditional Rendering**: Modify the discount selector rendering condition to include capability check
   - Change: `{discounts.length > 0 && (`
   - To: `{hasCapability('entry-discounts') && discounts.length > 0 && (`

**File**: `packages/orgadmin-events/src/pages/EditEventPage.tsx` (if it exists and has similar issue)

**Function**: `EditEventPage` component

**Specific Changes**: Same as CreateEventPage above

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate the bug on unfixed code, then verify the fix works correctly and preserves existing behavior.

### Exploratory Fault Condition Checking

**Goal**: Surface counterexamples that demonstrate the bug BEFORE implementing the fix. Confirm or refute the root cause analysis. If we refute, we will need to re-hypothesize.

**Test Plan**: Write tests that render CreateEventPage with organizations that do NOT have 'entry-discounts' capability and assert that the discount selector is NOT visible. Run these tests on the UNFIXED code to observe failures and understand the root cause.

**Test Cases**:
1. **Event Page Without Capability**: Render CreateEventPage with organization having ['events'] capabilities only (will fail on unfixed code - discount selector will be visible)
2. **Event Page With Other Capabilities**: Render CreateEventPage with organization having ['events', 'memberships'] but not 'entry-discounts' (will fail on unfixed code)
3. **Edit Page Without Capability**: Render EditEventPage with organization lacking 'entry-discounts' (will fail on unfixed code if EditEventPage exists)
4. **Membership Page Without Capability**: Render CreateSingleMembershipTypePage without capability (should pass on unfixed code - already implemented correctly)

**Expected Counterexamples**:
- Discount selector section is visible in event pages when organization lacks 'entry-discounts' capability
- Possible causes: missing useCapabilities hook import, missing hasCapability check in conditional rendering

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds, the fixed function produces the expected behavior.

**Pseudocode:**
```
FOR ALL organisation WHERE 'entry-discounts' NOT IN organisation.enabledCapabilities DO
  page := renderCreateEventPage(organisation)
  ASSERT discountSelectorNotVisible(page)
END FOR
```

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold, the fixed function produces the same result as the original function.

**Pseudocode:**
```
FOR ALL component WHERE component != CreateEventPage AND component != EditEventPage DO
  ASSERT componentBehavior_original(component) = componentBehavior_fixed(component)
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- It generates many test cases automatically across the input domain
- It catches edge cases that manual unit tests might miss
- It provides strong guarantees that behavior is unchanged for all non-buggy inputs

**Test Plan**: Observe behavior on UNFIXED code first for membership forms and navigation, then write property-based tests capturing that behavior.

**Test Cases**:
1. **Membership Form Preservation**: Observe that CreateSingleMembershipTypePage correctly hides discount selector without capability on unfixed code, then write test to verify this continues after fix
2. **Navigation Menu Preservation**: Observe that Discounts submenu item is correctly hidden without capability on unfixed code, then write test to verify this continues after fix
3. **Event Page With Capability**: Observe that CreateEventPage shows discount selector when organization has 'entry-discounts' capability, then write test to verify this continues after fix

### Unit Tests

- Test CreateEventPage renders discount selector when organization has 'entry-discounts' capability
- Test CreateEventPage hides discount selector when organization lacks 'entry-discounts' capability
- Test EditEventPage renders discount selector when organization has 'entry-discounts' capability
- Test EditEventPage hides discount selector when organization lacks 'entry-discounts' capability

### Property-Based Tests

- Generate random organization capability sets and verify discount selector visibility matches capability presence across all event pages
- Generate random organization configurations and verify membership form discount selector visibility remains unchanged (preservation)
- Test that all capability checks are consistent across different form types (events vs memberships)

### Integration Tests

- Test full event creation flow with and without 'entry-discounts' capability
- Test navigation to event pages and verify discount section visibility based on organization capabilities
- Test switching between organizations with different capabilities and verify UI updates correctly
