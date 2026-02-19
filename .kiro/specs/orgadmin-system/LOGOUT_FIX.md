# Logout Button Fix - OrgAdmin UI

## Issue
The logout button in the OrgAdmin UI was not working when authentication was disabled for development (`VITE_DISABLE_AUTH=true`).

## Root Cause
When `VITE_DISABLE_AUTH=true` is set in the environment configuration, the Keycloak instance is never initialized. The logout function was calling `keycloak?.logout()`, which does nothing when `keycloak` is `null`.

## Solution
Updated the `logout` function in `packages/orgadmin-shell/src/hooks/useAuth.ts` to handle the case when authentication is disabled:

```typescript
const logout = useCallback(() => {
  if (authDisabled) {
    // In dev mode with auth disabled, just reload the page
    window.location.href = '/';
  } else {
    keycloak?.logout();
  }
}, [keycloak, authDisabled]);
```

## Testing
- All existing tests pass (24 tests in useAuth.test.ts)
- The logout button now works in both modes:
  - **With auth enabled**: Calls Keycloak logout
  - **With auth disabled**: Redirects to home page

## How to Test
1. Ensure `VITE_DISABLE_AUTH=true` in `packages/orgadmin-shell/.env`
2. Start the orgadmin dev server: `cd packages/orgadmin-shell && npm run dev`
3. Navigate to the OrgAdmin UI
4. Click the logout button in the top right corner (on landing page) or in the drawer
5. The page should reload/redirect to the home page

## Files Modified
- `packages/orgadmin-shell/src/hooks/useAuth.ts`
