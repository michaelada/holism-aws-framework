# OrgAdmin Keycloak Client Setup Guide

This guide provides step-by-step instructions for setting up the `orgadmin-client` in Keycloak, which is required for the Organisation Admin Portal authentication.

## Prerequisites

- Keycloak running at http://localhost:8080 (or your configured URL)
- Admin access to Keycloak
- The `aws-web-framework` realm already created (see [KEYCLOAK_SETUP.md](./KEYCLOAK_SETUP.md) for initial setup)

## Overview

The OrgAdmin Portal is a separate frontend application that allows organisation administrators to manage their organisation's settings, users, events, memberships, and other capabilities. It requires its own Keycloak client configuration.

## Step 1: Access Keycloak Admin Console

1. Open your browser and go to: http://localhost:8080
2. Click on "Administration Console"
3. Login with the admin credentials:
   - Username: `admin`
   - Password: `admin` (or whatever you set in docker-compose.yml)

## Step 2: Select the Correct Realm

1. In the top-left corner, click on the realm dropdown (it might say "Master" or "aws-web-framework")
2. Select **`aws-web-framework`** realm
   - If this realm doesn't exist, follow the [KEYCLOAK_SETUP.md](./KEYCLOAK_SETUP.md) guide first

## Step 3: Create the OrgAdmin Client

1. In the left sidebar, click **"Clients"**
2. Click **"Create client"** button
3. Configure the client:
   - **Client type**: OpenID Connect
   - **Client ID**: `orgadmin-client`
   - Click **"Next"**

## Step 4: Configure Client Capabilities

On the "Capability config" screen:

- **Client authentication**: OFF (this is a public client - browser-based SPA)
- **Authorization**: OFF
- **Authentication flow**:
  - ✅ **Standard flow**: ON (required for login redirects)
  - ✅ **Direct access grants**: ON (optional, for testing)
  - ❌ **Implicit flow**: OFF (deprecated, not recommended)
  - ❌ **Service accounts roles**: OFF (not needed for frontend)
  - ❌ **OAuth 2.0 Device Authorization Grant**: OFF
  - ❌ **OIDC CIBA Grant**: OFF

Click **"Next"**

## Step 5: Configure Login Settings

On the "Login settings" screen, configure the following:

### Root URL
Leave empty or set to: `http://localhost:5177`

### Home URL
Leave empty or set to: `/orgadmin`

### Valid redirect URIs
Add the following URIs (one per line):
```
http://localhost:5177/*
http://localhost:5177/orgadmin/*
```

**For production**, add your production URLs:
```
https://yourdomain.com/orgadmin/*
```

### Valid post logout redirect URIs
Add the same URIs as redirect URIs:
```
http://localhost:5177/*
http://localhost:5177/orgadmin/*
```

### Web origins
Add the base URLs (without wildcards):
```
http://localhost:5177
```

**For production**:
```
https://yourdomain.com
```

Click **"Save"**

## Step 6: Configure Advanced Settings (Optional but Recommended)

After saving, you can configure additional settings:

1. Click on the **"Advanced"** tab
2. Scroll to **"Advanced settings"**
3. Configure the following:

### Access Token Lifespan
- Default: 5 minutes
- Recommended: 15 minutes (for better user experience)

### Proof Key for Code Exchange (PKCE)
- **PKCE Code Challenge Method**: S256 (most secure)

This is automatically used by the orgadmin frontend for enhanced security.

Click **"Save"** if you made changes

## Step 7: Configure Audience Mapper (Critical for API Access)

The orgadmin frontend needs to call the backend API, which validates tokens against the `aws-framework-backend` client. We need to add an audience mapper so the backend accepts tokens from the orgadmin client.

1. Click on the **"Client scopes"** tab
2. Click on **`orgadmin-client-dedicated`** (the dedicated scope for this client)
3. Click the **"Mappers"** tab
4. Click **"Add mapper"** → **"By configuration"**
5. Select **"Audience"**
6. Configure the mapper:
   - **Name**: `backend-audience`
   - **Mapper Type**: Audience
   - **Included Client Audience**: Select `aws-framework-backend` from dropdown
   - **Add to ID token**: OFF (leave unchecked)
   - **Add to access token**: ON (✅ check this)
7. Click **"Save"**

**Why is this needed?** The orgadmin frontend gets tokens from the `orgadmin-client`, but the backend validates tokens against the `aws-framework-backend` client. The audience mapper adds the backend client to the token's audience claim, allowing the backend to accept tokens from the orgadmin frontend.

## Step 8: Create Organisation Admin Role (If Not Exists)

The orgadmin portal requires users to have the `org-admin` role to access the interface.

1. In the left sidebar, click **"Realm roles"**
2. Check if `org-admin` role exists
3. If not, click **"Create role"**:
   - **Role name**: `org-admin`
   - **Description**: Organisation administrator with access to orgadmin portal
   - Click **"Save"**

## Step 9: Assign Org-Admin Role to Test User
**Important**: Set `VITE_DISABLE_AUTH=false` to enable Keycloak authentication. If set to `true`, the app will run in development mode without authentication.

To test the orgadmin portal, you need a user with the `org-admin` role:

1. In the left sidebar, click **"Users"**
2. Find or create a test user (see [KEYCLOAK_SETUP.md](./KEYCLOAK_SETUP.md) Step 6 for creating users)
3. Click on the user
4. Click on the **"Role mapping"** tab
5. Click **"Assign role"**
6. Find and select **`org-admin`** role
7. Click **"Assign"**

## Step 10: Configure OrgAdmin Frontend Environment

Create or update `packages/orgadmin-shell/.env`:

```bash
# Backend API Configuration
VITE_API_URL=http://localhost:3000
VITE_API_BASE_URL=http://localhost:3000

# Keycloak Authentication Configuration
VITE_KEYCLOAK_URL=http://localhost:8080
VITE_KEYCLOAK_REALM=aws-web-framework
VITE_KEYCLOAK_CLIENT_ID=orgadmin-client

# Development Mode - Set to false to enable authentication
VITE_DISABLE_AUTH=false
```

**Important**: Set `VITE_DISABLE_AUTH=false` to enable Keycloak authentication. If set to `true`, the app will run in development mode without authentication.

## Step 11: Configure Backend for OrgAdmin

The backend needs to be configured to accept tokens from the orgadmin client. This should already be configured if you followed the main Keycloak setup, but verify your `packages/backend/.env` has:

```bash
# Keycloak Configuration (for token validation)
KEYCLOAK_URL=http://localhost:8080
KEYCLOAK_REALM=aws-web-framework
KEYCLOAK_CLIENT_ID=aws-framework-backend
KEYCLOAK_CLIENT_SECRET=<your-backend-client-secret>
```

The backend validates tokens against `aws-framework-backend`, but accepts tokens from any client in the realm that has the correct audience (which we configured in Step 7).

## Step 12: Start the OrgAdmin Frontend

1. Navigate to the orgadmin-shell package:
   ```bash
   cd packages/orgadmin-shell
   ```

2. Install dependencies (if not already done):
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

4. The orgadmin portal should be available at: http://localhost:5177/orgadmin

## Step 13: Test Authentication

1. Open http://localhost:5177/orgadmin in your browser
2. You should be automatically redirected to the Keycloak login page
3. Login with a user that has the `org-admin` role:
   - Username: `testuser` (or your test user)
   - Password: `password` (or what you set)
4. After successful login, you should be redirected back to the orgadmin portal
5. You should see the organisation dashboard

### Expected Behavior

- ✅ **Successful login**: Redirected to orgadmin dashboard
- ✅ **User has org-admin role**: Can access all orgadmin features
- ❌ **User without org-admin role**: Shows "Access Denied" screen with logout button
- ❌ **Not authenticated**: Redirected to Keycloak login page

## Step 14: Verify Backend API Access

The orgadmin frontend needs to call the backend API. Verify this works:

1. Open browser developer tools (F12)
2. Go to the Network tab
3. Navigate around the orgadmin portal
4. Look for API calls to `http://localhost:3000/api/orgadmin/*`
5. Check that these calls return 200 OK (not 401 Unauthorized)

If you see 401 errors, the audience mapper (Step 7) might not be configured correctly.

## Troubleshooting

### "Failed to initialize authentication"

**Symptoms**: Error message on page load, can't reach Keycloak

**Solutions**:
- Check that Keycloak is running: http://localhost:8080
- Verify the realm name is exactly `aws-web-framework` (case-sensitive)
- Verify the client ID is exactly `orgadmin-client` (case-sensitive)
- Check browser console for detailed error messages

### "Invalid redirect URI" or "Invalid parameter: redirect_uri"

**Symptoms**: Keycloak shows error page after login attempt

**Solutions**:
- Verify you added the redirect URIs in Step 5
- Check that the URIs include the wildcard: `http://localhost:5177/*`
- Make sure the orgadmin frontend is running on port 5177
- Check for typos in the redirect URIs (no trailing slashes before /*)

### "Access Denied" screen after login

**Symptoms**: Successfully logged in but see "Access Denied" message

**Solutions**:
- Verify the user has the `org-admin` role (Step 9)
- Check the backend logs for role validation errors
- Verify the backend is configured to check for `org-admin` role
- Try logging out and logging in again

### CORS Errors

**Symptoms**: Browser console shows CORS errors, API calls fail

**Solutions**:
- Verify you added the Web origins in Step 5
- Check that the origin matches your frontend URL exactly: `http://localhost:5177`
- Restart the Keycloak server after making changes
- Clear browser cache and try again

### 401 Unauthorized on API Calls

**Symptoms**: Frontend loads but API calls return 401 errors

**Solutions**:
- Verify the audience mapper is configured correctly (Step 7)
- Check that `aws-framework-backend` client exists in Keycloak
- Verify the backend is running and configured correctly
- Check the token in browser dev tools (Application → Local Storage → look for token)
- Decode the token at https://jwt.io and verify it has the correct audience

### "frame-ancestors" CSP Error

**Symptoms**: Console warning about Content Security Policy

**Solutions**:
- This is normal and can be ignored
- It's Keycloak's security policy preventing iframe embedding
- Authentication should still work correctly

### Logout Button Not Working

**Symptoms**: Clicking logout does nothing

**Solutions**:
- If `VITE_DISABLE_AUTH=true`, logout redirects to home page (this is expected)
- If `VITE_DISABLE_AUTH=false`, logout should call Keycloak logout
- Check browser console for JavaScript errors
- Verify the post logout redirect URIs are configured (Step 5)
- Try clearing browser cache and cookies

### Backend Can't Validate Tokens

**Symptoms**: Backend logs show token validation errors

**Solutions**:
- Verify backend `KEYCLOAK_URL` is accessible from backend
- If running in Docker, use `http://keycloak:8080` instead of `http://localhost:8080`
- Check that `KEYCLOAK_REALM` matches: `aws-web-framework`
- Verify `KEYCLOAK_CLIENT_ID` is set to `aws-framework-backend`
- Check that the backend client secret is correct

## Production Deployment

For production environments, update the following:

### 1. Update Redirect URIs

In Keycloak client settings (Step 5), add production URLs:
```
https://yourdomain.com/orgadmin/*
https://yourdomain.com/*
```

### 2. Update Web Origins

Add production domain:
```
https://yourdomain.com
```

### 3. Update Frontend Environment

Update `packages/orgadmin-shell/.env.production`:
```bash
VITE_API_URL=https://api.yourdomain.com
VITE_API_BASE_URL=https://api.yourdomain.com
VITE_KEYCLOAK_URL=https://keycloak.yourdomain.com
VITE_KEYCLOAK_REALM=aws-web-framework
VITE_KEYCLOAK_CLIENT_ID=orgadmin-client
VITE_DISABLE_AUTH=false
```

### 4. Security Recommendations

- ✅ Use HTTPS for all URLs (Keycloak, frontend, backend)
- ✅ Use strong, randomly generated client secrets
- ✅ Enable PKCE (already configured in Step 6)
- ✅ Set appropriate token lifespans (15-30 minutes for access tokens)
- ✅ Enable refresh token rotation
- ✅ Configure proper CORS policies
- ✅ Use secure cookies for session management
- ✅ Enable audit logging in Keycloak
- ✅ Regularly update Keycloak to latest security patches

## Quick Reference

### Client Configuration Summary

| Setting | Value |
|---------|-------|
| Client ID | `orgadmin-client` |
| Client Type | OpenID Connect |
| Client Authentication | OFF (public client) |
| Standard Flow | ON |
| Direct Access Grants | ON |
| Valid Redirect URIs | `http://localhost:5177/*` |
| Web Origins | `http://localhost:5177` |
| Audience Mapper | `aws-framework-backend` |

### Environment Variables

**OrgAdmin Frontend** (`packages/orgadmin-shell/.env`):
```bash
VITE_API_URL=http://localhost:3000
VITE_API_BASE_URL=http://localhost:3000
VITE_KEYCLOAK_URL=http://localhost:8080
VITE_KEYCLOAK_REALM=aws-web-framework
VITE_KEYCLOAK_CLIENT_ID=orgadmin-client
VITE_DISABLE_AUTH=false
```

**Backend** (`packages/backend/.env`):
```bash
KEYCLOAK_URL=http://localhost:8080
KEYCLOAK_REALM=aws-web-framework
KEYCLOAK_CLIENT_ID=aws-framework-backend
KEYCLOAK_CLIENT_SECRET=<your-backend-client-secret>
```

### Required Roles

- **`org-admin`**: Required for users to access the orgadmin portal

### Port Reference

| Service | Port | URL |
|---------|------|-----|
| Keycloak | 8080 | http://localhost:8080 |
| Backend API | 3000 | http://localhost:3000 |
| OrgAdmin Frontend | 5177 | http://localhost:5177/orgadmin |
| Super Admin Frontend | 5176 | http://localhost:5176 |
| Main Frontend | 5173 | http://localhost:5173 |

## Testing Checklist

Use this checklist to verify your setup:

- [ ] Keycloak is running and accessible at http://localhost:8080
- [ ] `aws-web-framework` realm exists
- [ ] `orgadmin-client` client is created and configured
- [ ] Redirect URIs include `http://localhost:5177/*`
- [ ] Web origins include `http://localhost:5177`
- [ ] Audience mapper is configured with `aws-framework-backend`
- [ ] `org-admin` role exists
- [ ] Test user has `org-admin` role assigned
- [ ] OrgAdmin frontend `.env` is configured correctly
- [ ] Backend `.env` is configured correctly
- [ ] OrgAdmin frontend starts without errors
- [ ] Accessing http://localhost:5177/orgadmin redirects to Keycloak login
- [ ] Login with test user succeeds
- [ ] After login, redirected to orgadmin dashboard
- [ ] API calls to backend return 200 OK (not 401)
- [ ] Can navigate around orgadmin portal without errors
- [ ] Logout button works correctly

## Related Documentation

- [Main Keycloak Setup Guide](./KEYCLOAK_SETUP.md) - Initial Keycloak configuration
- [OrgAdmin Implementation Guide](./ORGADMIN_IMPLEMENTATION_GUIDE.md) - OrgAdmin architecture and features
- [OrgAdmin User Guide](./ORGADMIN_USER_GUIDE.md) - How to use the orgadmin portal
- [OrgAdmin Deployment Guide](./ORGADMIN_DEPLOYMENT_GUIDE.md) - Production deployment instructions

## Support

If you encounter issues not covered in this guide:

1. Check the browser console for detailed error messages
2. Check the backend logs for authentication errors
3. Check the Keycloak logs for token validation issues
4. Review the [Troubleshooting](#troubleshooting) section above
5. Consult the [KEYCLOAK_SETUP.md](./KEYCLOAK_SETUP.md) for general Keycloak issues
