# Discount Capability Naming Fix

## Issue

When logging into the org admin for an organization that doesn't have the `membership-discounts` capability, the Discounts submenu was still visible in the Members module. Clicking on it resulted in a console error:

```json
{
  "error": {
    "code": "FORBIDDEN",
    "message": "Access denied. Required capability: membership-discounts",
    "requiredCapabilities": ["membership-discounts"]
  }
}
```

The backend was correctly checking for `membership-discounts` capability, but the frontend was checking for `entry-discounts` capability instead.

## Root Cause

There was a capability naming mismatch between the frontend and backend:

- **Backend**: Uses `membership-discounts` for membership-related discount operations (defined in `discount.routes.ts`)
- **Frontend (Memberships Module)**: Was using `entry-discounts` for the Discounts submenu and routes

The backend has different discount capabilities for different modules:
- `entry-discounts` - For event entries
- `membership-discounts` - For memberships
- `calendar-discounts` - For calendar bookings
- `merchandise-discounts` - For merchandise

## Fix Applied

Updated the memberships module to use the correct `membership-discounts` capability:

### Files Changed

1. **packages/orgadmin-memberships/src/index.ts**
   - Changed Discounts submenu item capability from `entry-discounts` to `membership-discounts`
   - Changed all discount routes capabilities from `entry-discounts` to `membership-discounts`

2. **packages/orgadmin-memberships/src/pages/CreateSingleMembershipTypePage.tsx**
   - Changed discount selector capability check from `hasCapability('entry-discounts')` to `hasCapability('membership-discounts')`

3. **packages/orgadmin-memberships/src/pages/CreateGroupMembershipTypePage.tsx**
   - Changed discount selector capability check from `hasCapability('entry-discounts')` to `hasCapability('membership-discounts')`

4. **packages/orgadmin-memberships/src/__tests__/DiscountsSubmenu.preservation.property.test.tsx**
   - Updated all test assertions to expect `membership-discounts` instead of `entry-discounts`

## Verification

All preservation tests pass after the fix:
- ✅ Discounts submenu item has correct `membership-discounts` capability requirement
- ✅ Discount routes have correct `membership-discounts` capability requirement
- ✅ Capability filtering logic works correctly across all capability combinations
- ✅ Concrete test cases verify expected behavior

## Impact

- Organizations without `membership-discounts` capability will no longer see the Discounts submenu in the Members module
- Organizations with `membership-discounts` capability will continue to see and access the Discounts submenu
- The frontend now correctly aligns with the backend's capability checking

## Related

This fix complements the recent capability-based discount visibility fix for event pages (which correctly uses `entry-discounts` for event-related discounts).
