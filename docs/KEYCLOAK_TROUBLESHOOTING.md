# Keycloak Redirect Loop Troubleshooting

If you're experiencing an infinite redirect loop after logging into Keycloak, here are the solutions:

## Quick Fix: Disable Authentication for Development

The easiest solution for local development is to disable authentication:

1. Edit `packages/frontend/.env`
2. Set `VITE_DISABLE_AUTH=true`
3. Restart the frontend dev server
4. Access http://localhost:5173 - you should now see the application without authentication

## Fixing the Redirect Loop (For Production Use)

The redirect loop is usually caused by a mismatch between the redirect URI in your application and what's configured in Keycloak.

### Step 1: Verify Keycloak Client Configuration

1. Go to Keycloak Admin Console: http://localhost:8080
2. Select the `aws-framework` realm
3. Go to Clients → `aws-framework-frontend`
4. Check the following settings:

**Access settings:**
- Root URL: `http://localhost:5173`
- Home URL: `http://localhost:5173`
- Valid redirect URIs: 
  ```
  http://localhost:5173/*
  ```
- Valid post logout redirect URIs:
  ```
  http://localhost:5173/*
  ```
- Web origins:
  ```
  http://localhost:5173
  ```

**Important:** Make sure there are NO trailing slashes and the port matches exactly.

### Step 2: Check Client Settings

Scroll down to **Capability config** and verify:
- Client authentication: **OFF** (this must be a public client)
- Authorization: **OFF**
- Authentication flow:
  - Standard flow: **ON**
  - Direct access grants: **ON**
  - Implicit flow: **OFF**
  - Service accounts roles: **OFF**

### Step 3: Clear Browser Data

1. Open browser DevTools (F12)
2. Go to Application tab (Chrome) or Storage tab (Firefox)
3. Clear all cookies for localhost
4. Clear Local Storage for localhost
5. Clear Session Storage for localhost
6. Close and reopen the browser

### Step 4: Test with Incognito/Private Window

Try accessing the application in an incognito/private browsing window to rule out cached data issues.

### Step 5: Check Browser Console

Open the browser console (F12) and look for errors. Common issues:

**"Invalid redirect_uri"**
- The redirect URI doesn't match what's configured in Keycloak
- Solution: Double-check the Valid redirect URIs in Keycloak

**"CORS error"**
- The Web origins aren't configured correctly
- Solution: Add `http://localhost:5173` to Web origins in Keycloak

**"Invalid client"**
- The client ID doesn't match
- Solution: Verify `VITE_KEYCLOAK_CLIENT_ID` matches the client ID in Keycloak

### Step 6: Alternative Keycloak Configuration

If the issue persists, try this alternative configuration:

1. In Keycloak, go to the client settings
2. Set **Access Type** to `public` (if using older Keycloak versions)
3. Enable **Standard Flow Enabled**
4. Disable **Implicit Flow Enabled**
5. Disable **Direct Access Grants Enabled** (try this if other options don't work)
6. Set Valid Redirect URIs to:
   ```
   http://localhost:5173
   http://localhost:5173/
   http://localhost:5173/*
   ```

### Step 7: Update Frontend Code (Advanced)

If none of the above works, you can try changing the Keycloak initialization:

Edit `packages/frontend/src/context/AuthContext.tsx` and change the init options:

```typescript
kc.init({
  onLoad: 'check-sso',  // Change back to check-sso
  silentCheckSsoRedirectUri: window.location.origin + '/silent-check-sso.html',
  pkceMethod: 'S256',
  checkLoginIframe: false,
  flow: 'standard',  // Add this
  responseMode: 'fragment',  // Add this
})
```

## Common Causes of Redirect Loops

1. **Mismatched redirect URIs** - Most common cause
2. **Browser caching** - Old tokens or session data
3. **CORS issues** - Web origins not configured
4. **Client type mismatch** - Client should be public, not confidential
5. **Multiple Keycloak instances** - Make sure you're configuring the right realm/client

## Recommended Approach for Development

For local development, we recommend:

1. **Use `VITE_DISABLE_AUTH=true`** - Simplest and fastest
2. **Configure Keycloak properly** - Only if you need to test authentication flows
3. **Use a separate Keycloak realm for development** - Keeps production config clean

## Testing Authentication in Production

When deploying to production:

1. Remove `VITE_DISABLE_AUTH` or set it to `false`
2. Update all URLs in Keycloak to use your production domain
3. Use HTTPS (Keycloak requires HTTPS in production)
4. Configure proper redirect URIs for your production domain

## Still Having Issues?

If you're still experiencing redirect loops:

1. Check Keycloak logs:
   ```bash
   docker logs keycloak
   ```

2. Enable debug logging in the frontend:
   Add this to `AuthContext.tsx` before `kc.init()`:
   ```typescript
   kc.enableLogging = true;
   ```

3. Check the Network tab in browser DevTools to see the redirect chain

4. Verify the realm and client exist and are enabled in Keycloak

## Alternative: Use a Different Auth Provider

If Keycloak continues to be problematic, consider:
- Auth0
- AWS Cognito
- Firebase Auth
- Simple JWT-based auth

These are often easier to set up for development purposes.
