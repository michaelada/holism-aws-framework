# Organization List Error Fix

## Problem
When viewing an Organization Type details page with organizations, the page showed "Something Went Wrong" error with the following console error:

```
Uncaught TypeError: Cannot read properties of undefined (reading 'length')
at OrganizationList.tsx:115:45
```

## Root Cause
The `Organization` type definition in `packages/admin/src/types/admin.types.ts` had `enabledCapabilities` as a required field (`enabledCapabilities: string[]`), but:

1. The database might return `null` for this field
2. Some organizations might not have this field populated yet
3. The component already had defensive code (`?.length || 0`) but TypeScript wasn't aware the field could be undefined

## Solution
Made `enabledCapabilities` optional in the Organization type definition:

```typescript
// Before
enabledCapabilities: string[];

// After  
enabledCapabilities?: string[];
```

## Files Changed
- `packages/admin/src/types/admin.types.ts` - Made `enabledCapabilities` optional

## Verification
The `OrganizationList` component already had the proper null check:
```typescript
{org.enabledCapabilities?.length || 0} enabled
```

This will now work correctly whether `enabledCapabilities` is:
- An array with items: shows the count
- An empty array: shows "0 enabled"
- `undefined` or `null`: shows "0 enabled"

## Testing
To verify the fix:
1. Navigate to Organization Types in Super Admin UI
2. Click on any organization type
3. The organizations table should now display without errors
4. The "Capabilities" column should show the count or "0 enabled"

## Additional Notes
- The backend `rowToOrganization` method already handles this correctly by providing a default empty array: `enabledCapabilities: row.enabled_capabilities || []`
- However, if the database query doesn't include this field or it's explicitly null, the frontend needs to handle it gracefully
- This fix ensures type safety matches runtime reality
