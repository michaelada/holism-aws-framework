# Org Admin Authentication Error Handling Fix

## Issue

When a super admin user (or any user without org-admin permissions) tries to login to the org admin portal, they see a white screen with "Loading ItsPlainSailing..." indefinitely. The console shows an error from `/api/orgadmin/auth/me`:

```json
{
  "error": "Access denied",
  "message": "User is not an organization administrator or account is not active"
}
```

The user is stuck on the loading screen with no way to return to the login page.

## Root Cause

The issue was in the conditional rendering order in `App.tsx`. The loading check was happening BEFORE the error check:

```typescript
// OLD ORDER (BROKEN)
if (loading || !i18nReady || (authenticated && !organisation)) {
  return <LoadingScreen />;
}
if (error) {
  return <ErrorScreen error={error} onLogout={logout} />;
}
```

When `fetchOrganisation` fails with a 403 error:
1. `setError(errorMessage)` is called ✓
2. `setLoading(false)` is called ✓
3. BUT `organisation` remains `null` ✗

The condition `(authenticated && !organisation)` was still `true`, so the LoadingScreen was shown instead of the ErrorScreen, even though the error state was set correctly.

## Fix Applied

### 1. Fixed Conditional Rendering Order in `App.tsx`

**CRITICAL FIX**: Reordered the conditional checks so error state is checked FIRST:

```typescript
// NEW ORDER (FIXED)
// Error state - check this FIRST before loading state
if (error) {
  return <ErrorScreen error={error} onLogout={logout} />;
}

// Loading state - show loading screen while auth or i18n is loading
if (loading || !i18nReady || (authenticated && !organisation)) {
  return <LoadingScreen />;
}
```

This ensures error messages are shown even if `organisation` data failed to load.

### 2. Enhanced Error Message Extraction in `useAuth.ts`

```typescript
catch (err: any) {
  console.error('Error fetching organisation:', err);
  
  // Extract error message from response if available
  let errorMessage = 'Failed to load organisation data';
  
  if (err.response?.status === 403) {
    // User is not an org admin or account is not active
    errorMessage = err.response.data?.message || 
      'You do not have permission to access the Organisation Admin Portal. ' +
      'Please contact your system administrator if you believe this is an error.';
  } else if (err.response?.data?.message) {
    errorMessage = err.response.data.message;
  } else if (err.message) {
    errorMessage = err.message;
  }
  
  throw new Error(errorMessage);
}
```

### 3. Proper Loading State Management in `useAuth.ts`

```typescript
if (auth) {
  try {
    await fetchOrganisation(kc);
    setError(null);
    setLoading(false);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Failed to load organisation';
    console.error('Authentication error:', errorMessage);
    setError(errorMessage);
    setIsOrgAdmin(false);
    setLoading(false); // Ensure loading is set to false on error
  }
} else {
  setLoading(false);
}
```

## User Experience After Fix

When a user without org-admin permissions tries to login:

1. Keycloak authentication succeeds
2. The `/api/orgadmin/auth/me` endpoint returns a 403 error
3. The error message is extracted from the response
4. The loading state is set to false
5. The `ErrorScreen` component is displayed with:
   - Clear error message: "User is not an organization administrator or account is not active"
   - A "Return to Login" button that calls the logout function
   - The user can click the button to return to the Keycloak login page

## Error Screen Component

The existing `ErrorScreen` component in `App.tsx` already provides:
- Clear error heading
- Error message display
- "Return to Login" button that triggers logout
- Proper styling and layout

## Testing

To test this fix:

1. Login with a super admin account (or any account without org-admin role)
2. Verify the error screen is displayed instead of infinite loading
3. Verify the error message is clear and helpful
4. Click "Return to Login" button
5. Verify you're redirected back to the Keycloak login page

## Related Components

- `packages/orgadmin-shell/src/App.tsx` - **FIXED**: Reordered conditional rendering
- `packages/orgadmin-shell/src/hooks/useAuth.ts` - Enhanced error handling
- `packages/backend/src/routes/orgadmin-auth.routes.ts` - Backend auth endpoint (no changes needed)
