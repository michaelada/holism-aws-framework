# Task 2: Preservation Property Tests Summary

## Overview

Task 2 involved writing preservation property tests BEFORE implementing the fix. These tests capture the baseline behavior that must remain unchanged after the fix is applied.

## Tests Created

### 1. CreateEventPage Preservation Tests
**File**: `packages/orgadmin-events/src/pages/__tests__/CreateEventPage.preservation.property.test.tsx`

**Status**: ✅ PASSING on unfixed code

**What it tests**:
- Property 2a: CreateEventPage shows discount selector when organization HAS 'entry-discounts' capability
- Concrete test cases with various capability combinations

**Test Results**:
- All 4 tests PASS on unfixed code
- This confirms the baseline behavior: when an organization HAS the capability, the discount selector is shown
- This behavior must be preserved after the fix

**Property-Based Testing**:
- Uses fast-check to generate 10 different capability combinations
- Each combination includes 'entry-discounts' capability
- Verifies DiscountSelector component is rendered in all cases

### 2. Discounts Submenu Preservation Tests
**File**: `packages/orgadmin-memberships/src/__tests__/DiscountsSubmenu.preservation.property.test.tsx`

**Status**: ✅ PASSING on unfixed code

**What it tests**:
- Property 2f: Discounts submenu item has 'entry-discounts' capability requirement
- Property 2g: Other submenu items have no additional capability requirements
- Property 2h: Module configuration remains consistent
- Property 2i: Capability filtering logic works correctly across all capability combinations

**Test Results**:
- All 8 tests PASS on unfixed code
- This confirms the baseline behavior: the submenu filtering already works correctly
- This behavior must be preserved after the fix

**Property-Based Testing**:
- Uses fast-check to generate 50 different capability combinations
- Verifies that Discounts submenu visibility matches capability presence
- Verifies that other submenu items remain visible regardless of 'entry-discounts' capability

## Membership Forms Preservation

**Note**: The membership type forms (CreateSingleMembershipTypePage and CreateGroupMembershipTypePage) already implement the correct capability checking behavior. These forms use `hasCapability('entry-discounts')` to conditionally render the discount selector.

**Verification Method**: Manual code inspection confirms:
- `packages/orgadmin-memberships/src/pages/CreateSingleMembershipTypePage.tsx` line 488: `{hasCapability('entry-discounts') && (`
- `packages/orgadmin-memberships/src/pages/CreateGroupMembershipTypePage.tsx` line 658: `{hasCapability('entry-discounts') && (`

These implementations are already correct and will not be affected by the fix to CreateEventPage.

## Expected Outcome

**All preservation tests PASS on unfixed code** ✅

This confirms:
1. CreateEventPage correctly shows discount selector when organization HAS 'entry-discounts' capability
2. Discounts submenu item is correctly filtered based on 'entry-discounts' capability
3. Other submenu items remain visible regardless of discount capability
4. Membership forms already implement correct capability checking

## Next Steps

After implementing the fix in Task 3:
1. Re-run these preservation tests to ensure they still PASS
2. This will confirm no regressions were introduced
3. The bug condition exploration tests from Task 1 should also PASS after the fix

## Validates Requirements

- **Requirement 3.1**: Organizations with 'entry-discounts' capability continue to see Discounts submenu
- **Requirement 3.2**: Membership forms continue to check capability correctly
- **Requirement 3.3**: Event pages with capability continue to show discount selector
- **Requirement 3.4**: Submenu items without capability requirements remain visible
- **Requirement 3.5**: Other capabilities are not affected by discount capability checks
