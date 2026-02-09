# Keycloak Infinite Redirect Loop - Fix Summary

## Problem
After successfully logging into Keycloak, the application was stuck in an infinite redirect loop, continuously redirecting between the application and Keycloak login page. The browser console showed an error about 3rd party cookies being blocked.

## Root Cause
The issue was caused by multiple factors:

1. **3rd Party Cookie Blocking**: Modern browsers block 3rd party cookies by default. Keycloak's `check-sso` with `silentCheckSsoRedirectUri` requires 3rd party cookies to work, causing authentication failures.

2. **Re-initialization on every render**: The `useEffect` dependency array included config properties that could trigger re-initialization.

3. **No guard against multiple initializations**: The effect didn't properly prevent Keycloak from being initialized multiple times.

## Solution

### 1. Fixed AuthContext.tsx
- Removed `silentCheckSsoRedirectUri` which requires 3rd party cookies
- Removed `flow` and `responseMode` options (use defaults)
- Kept `checkLoginIframe: false` to avoid iframe-based checks that need 3rd party cookies
- Simplified to use only `onLoad: 'check-sso'` with `pkceMethod: 'S256'`
- **Used refs (`isInitializing` and `isInitialized`) to prevent multiple initializations** - this is critical because state checks don't work reliably during the redirect flow
- Simplified dependency array to include only the config properties
- Added console logging for debugging

### 2. Fixed App.tsx
- Used `useMemo` to memoize the `keycloakConfig` object so it doesn't get recreated on every render
- Used `useMemo` for `apiBaseURL` as well to prevent unnecessary re-renders

### 3. Disabled React StrictMode (main.tsx)
- **Temporarily disabled StrictMode** which causes double-mounting in development
- StrictMode intentionally mounts components twice to detect side effects, but this interferes with Keycloak initialization
- This is a common issue with authentication libraries that have side effects
- Can be re-enabled after authentication is stable or for production builds

### 4. Added TypeScript Definitions
- Created `vite-env.d.ts` to properly type the Vite environment variables

## How It Works Now

1. **Initial Load**: 
   - Keycloak initializes once with `check-sso` mode (no 3rd party cookies needed)
   - If user has an active session (via URL fragment after redirect), they're authenticated
   - If no session exists, the app explicitly calls `kc.login()` to redirect to Keycloak

2. **After Login**:
   - Keycloak redirects back with auth tokens in the URL fragment
   - The same Keycloak instance processes the callback
   - Authentication state is set to `true`
   - User can access the application
   - No re-initialization occurs because of the guard check

3. **Token Refresh**:
   - A background interval checks token expiry every minute
   - Tokens are refreshed automatically before expiration
   - If refresh fails, the interval is cleared

## Why This Works Without 3rd Party Cookies

The solution uses:
- **PKCE (Proof Key for Code Exchange)**: A secure OAuth 2.0 flow that doesn't require cookies
- **URL Fragment**: Tokens are passed via URL fragment after redirect (not cookies)
- **No Silent SSO**: We don't use silent iframe-based SSO which requires 3rd party cookies
- **Explicit Login**: When not authenticated, we explicitly redirect to Keycloak login page

## Testing

To test the fix:

1. **Clear browser data**:
   - Open DevTools (F12)
   - Go to Application tab
   - Clear all cookies, local storage, and session storage for localhost
   - Close and reopen the browser

2. **Test the flow**:
   - Navigate to http://localhost:5173
   - You should see "Loading authentication..." briefly
   - Then be redirected to Keycloak login (only once)
   - Login with `testuser` / `password`
   - You should be redirected back to the application and stay logged in

3. **Check console logs**:
   - "Initializing Keycloak..." - Should appear only once
   - "Keycloak initialized. Authenticated: true" - After successful login
   - No errors about 3rd party cookies
   - No redirect loop

## Files Modified

- `packages/frontend/src/context/AuthContext.tsx` - Fixed initialization logic, removed 3rd party cookie dependencies, added refs to prevent double initialization
- `packages/frontend/src/App.tsx` - Memoized config objects
- `packages/frontend/src/main.tsx` - Disabled React StrictMode to prevent double-mounting (new change)
- `packages/frontend/src/vite-env.d.ts` - Added TypeScript definitions (new file)

## Configuration

No changes needed to `.env` files or Keycloak configuration. The fix is purely in the frontend code.

## Debugging

If issues persist, check the browser console for these log messages:
- "Initializing Keycloak..." - Should appear only once
- "Keycloak already initialized, skipping..." - If effect runs again (shouldn't happen)
- "Keycloak initialized. Authenticated: true/false" - Shows auth status
- "Not authenticated, redirecting to login..." - Only if no session exists
- "Token refreshed" - Appears every minute when tokens are refreshed

## Browser Compatibility

This solution works with:
- Chrome/Edge with 3rd party cookies blocked (default)
- Firefox with Enhanced Tracking Protection
- Safari with Intelligent Tracking Prevention
- Any browser with strict privacy settings

## Alternative: Disable Auth for Development

If you still want to develop without Keycloak, you can set in `.env`:
```
VITE_DISABLE_AUTH=true
```

This bypasses all Keycloak authentication and uses a mock user.
