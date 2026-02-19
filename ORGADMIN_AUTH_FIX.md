# OrgAdmin Authentication Fix

## Problem
After fixing the Keycloak realm name from `aws-web-framework` to `aws-framework`, the orgadmin frontend successfully authenticates with Keycloak but fails to load organization data with a 404 error on `/api/orgadmin/auth/me`.

## Root Cause
The `/api/orgadmin/auth/me` endpoint did not exist in the backend.

## Solution Implemented

### 1. Created New Backend Route
Created `packages/backend/src/routes/orgadmin-auth.routes.ts` with the following functionality:
- Validates JWT token from Keycloak
- Looks up the user in the `organization_users` table by `keycloak_user_id`
- Verifies the user is an active org-admin
- Fetches the user's organization details
- Fetches the user's roles and aggregates capabilities
- Returns user profile, organization details, and capabilities

### 2. Registered Route
Added the route to `packages/backend/src/index.ts`:
```typescript
import orgadminAuthRoutes from './routes/orgadmin-auth.routes';
// ...
app.use('/api/orgadmin', orgadminAuthRoutes);
```

## Next Steps

### Step 1: Restart Backend Server
The backend needs to be restarted to pick up the new route:
```bash
# Stop the current backend server (Ctrl+C in the terminal where it's running)
# Then restart it:
cd packages/backend
npm run dev
```

### Step 2: Verify Database Has Org-Admin User
The endpoint requires an `organization_users` record that:
- Has `user_type = 'org-admin'`
- Has `status = 'active'`
- Has `keycloak_user_id` matching your Keycloak user's ID

Check if you have an org-admin user:
```bash
# Using docker exec to access the database
docker exec -it aws-framework-db psql -U framework_user -d aws_framework -c "
SELECT 
    ou.id,
    ou.email,
    ou.keycloak_user_id,
    ou.user_type,
    ou.status,
    o.name as org_name
FROM organization_users ou
INNER JOIN organizations o ON ou.organization_id = o.id
WHERE ou.user_type = 'org-admin';
"
```

### Step 3: Get Your Keycloak User ID
If you don't have an org-admin user, you need to find your Keycloak user ID:

1. Go to Keycloak admin console: http://localhost:8080
2. Login as admin
3. Select the `aws-framework` realm
4. Go to Users
5. Find your user and click on it
6. Copy the ID from the URL or the user details page

### Step 4: Create Org-Admin User (If Needed)
If you don't have an org-admin user, create one:

```bash
# First, find an organization ID
docker exec -it aws-framework-db psql -U framework_user -d aws_framework -c "
SELECT id, name, display_name FROM organizations LIMIT 5;
"

# Then create the org-admin user
docker exec -it aws-framework-db psql -U framework_user -d aws_framework -c "
INSERT INTO organization_users (
    organization_id,
    keycloak_user_id,
    user_type,
    email,
    first_name,
    last_name,
    status
) VALUES (
    '<organization-id-from-above>',
    '<your-keycloak-user-id>',
    'org-admin',
    'your-email@example.com',
    'Your',
    'Name',
    'active'
);
"
```

### Step 5: Test the Endpoint
After restarting the backend and ensuring the user exists:

1. Clear browser cache and cookies for localhost:5175
2. Go to http://localhost:5175/orgadmin/
3. Login with your Keycloak credentials
4. You should now see the orgadmin dashboard instead of the error

## Verification

Check the browser console - you should see:
```
Initializing Keycloak for OrgAdmin Portal...
Keycloak initialized. Authenticated: true
```

And NO 404 error for `/api/orgadmin/auth/me`.

Check the backend logs - you should see:
```
Fetching organization for user: your-email@example.com (keycloak-user-id)
Successfully fetched organization for user: your-email@example.com
```

## Troubleshooting

### Still Getting 404
- Verify the backend restarted successfully
- Check backend logs for any startup errors
- Verify the route is registered: `curl http://localhost:3000/api/orgadmin/auth/me` (should return 401, not 404)

### Getting 403 Access Denied
- Verify the user exists in `organization_users` table
- Verify `user_type = 'org-admin'` (not 'account-user')
- Verify `status = 'active'`
- Verify `keycloak_user_id` matches your Keycloak user ID

### Getting 401 Unauthorized
- Verify Keycloak is running
- Verify the realm name is `aws-framework` in both frontend and backend `.env` files
- Verify the backend can reach Keycloak (check `KEYCLOAK_URL` in backend `.env`)
- Check if the audience mapper is configured correctly in Keycloak (see ORGADMIN_KEYCLOAK_SETUP.md Step 7)

## Files Modified
- `packages/backend/src/routes/orgadmin-auth.routes.ts` (created)
- `packages/backend/src/index.ts` (added route registration)
- `packages/orgadmin-shell/.env` (fixed realm name from `aws-web-framework` to `aws-framework`)

## Related Documentation
- `docs/ORGADMIN_KEYCLOAK_SETUP.md` - Complete Keycloak setup guide
- `docs/ORGADMIN_IMPLEMENTATION_GUIDE.md` - OrgAdmin architecture
