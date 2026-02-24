# Super Admin Role Fix

## Problem
You're getting a "FORBIDDEN: Access denied. Required role: super-admin" error when trying to create organizations in the admin UI.

## Root Cause
The backend requires the `super-admin` realm role for administrative operations, but your Keycloak user doesn't have this role assigned.

## Solution Options

### Option 1: Add super-admin Role in Keycloak (Recommended)

1. **Access Keycloak Admin Console**
   - Navigate to: http://localhost:8080
   - Login with admin credentials

2. **Create super-admin Role (if it doesn't exist)**
   - Select realm: `aws-framework`
   - Go to: Realm roles (left sidebar)
   - Click: "Create role"
   - Role name: `super-admin`
   - Description: "Super administrator with full system access"
   - Click: "Save"

3. **Assign super-admin Role to Your User**
   - Go to: Users (left sidebar)
   - Search for and select your user
   - Go to: "Role mapping" tab
   - Click: "Assign role"
   - Filter: "Filter by realm roles"
   - Select: `super-admin`
   - Click: "Assign"

4. **Verify the Role Assignment**
   - Still in your user's "Role mapping" tab
   - You should see `super-admin` listed under "Assigned roles"

5. **Logout and Login Again**
   - In the admin UI, logout
   - Login again to get a fresh token with the new role
   - Try creating an organization again

### Option 2: Temporarily Disable Auth on Frontend (Development Only)

If you just want to test quickly without setting up Keycloak properly:

1. Edit `packages/admin/.env`:
   ```env
   VITE_DISABLE_AUTH=true
   ```

2. Restart the admin frontend:
   ```bash
   cd packages/admin
   npm run dev
   ```

**Warning**: This bypasses all authentication. Only use for local development!

### Option 3: Use Admin Role Instead (Not Recommended)

You could change the backend to accept `admin` role instead of `super-admin`, but this would reduce security separation between different admin levels.

## Verification

After applying Option 1, you can verify the token contains the role:

1. Open browser DevTools (F12)
2. Go to Application/Storage → Local Storage
3. Find the Keycloak token
4. Decode it at https://jwt.io
5. Check that `realm_access.roles` includes `super-admin`

## Current Configuration

- Backend: `DISABLE_AUTH=true` (mock user with super-admin role)
- Frontend: Keycloak authentication enabled
- Required role: `super-admin`

The mismatch is that the frontend is sending a real Keycloak token without the `super-admin` role, while the backend (even with DISABLE_AUTH=true) still validates the role from the token when auth is not disabled.

## Recommended Next Steps

1. Follow Option 1 to properly configure Keycloak
2. Once working, set `DISABLE_AUTH=false` in backend `.env` for proper security
3. Test that authentication and authorization work correctly
