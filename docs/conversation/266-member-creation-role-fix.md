# Member Creation Role Authorization Fix

## Issue
When creating a member, the POST request to `/api/orgadmin/members` returns a 403 error:
```json
{"error":{"code":"FORBIDDEN","message":"Access denied. Required role: admin"}}
```

The user has the "full-administrator" role, but the middleware was only checking for "admin" role.

## Root Cause

The `requireOrgAdmin()` middleware in `packages/backend/src/middleware/orgadmin-role.middleware.ts` was hardcoded to only accept the `'admin'` role:

```typescript
export function requireOrgAdmin() {
  return requireOrgAdminRole('admin');
}
```

However, the system has a "full-administrator" role that should also have admin privileges.

## Fix Applied

Updated the `requireOrgAdmin()` middleware to accept both roles:

```typescript
export function requireOrgAdmin() {
  return requireOrgAdminRole(['admin', 'full-administrator']);
}
```

This change allows users with either the `'admin'` or `'full-administrator'` role to access endpoints protected by `requireOrgAdmin()`.

## Affected Endpoints

The following endpoints use `requireOrgAdmin()` middleware and will now accept both roles:

1. **POST /api/orgadmin/members** - Create member (the endpoint that was failing)
2. Any other endpoints in the system that use `requireOrgAdmin()` middleware

## Testing

To test the fix:
1. Restart the backend server to load the updated middleware
2. Try to create a member again through the UI
3. The request should now succeed with a 201 status code

## Files Modified

- `packages/backend/src/middleware/orgadmin-role.middleware.ts`
  - Updated `requireOrgAdmin()` function to accept both 'admin' and 'full-administrator' roles

## Related Context

From the context transfer, the user mentioned:
- User has "Full Administrator" role (name: "full-administrator") not "admin" role
- This is a system-level role configuration issue, not a user-specific problem

## Next Steps

After restarting the backend:
1. The form submission should continue to work (already working)
2. The member creation should now succeed
3. The user should be redirected back to the members database with a success message
