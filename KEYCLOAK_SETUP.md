# Keycloak Setup Guide

This guide walks you through setting up Keycloak for the AWS Web Application Framework.

## Prerequisites

- Keycloak running in Docker at http://localhost:8080
- Admin access to Keycloak

## Step 1: Access Keycloak Admin Console

1. Open your browser and go to: http://localhost:8080
2. Click on "Administration Console"
3. Login with the admin credentials:
   - Username: `admin`
   - Password: `admin` (or whatever you set in docker-compose.yml)

## Step 2: Create a Realm

1. In the top-left corner, hover over "Master" and click "Create Realm"
2. Enter the realm name: `aws-framework`
3. Click "Create"

## Step 3: Create a Client for the Frontend

1. In the left sidebar, click "Clients"
2. Click "Create client"
3. Configure the client:
   - **Client type**: OpenID Connect
   - **Client ID**: `aws-framework-frontend`
   - Click "Next"

4. **Capability config**:
   - Enable "Client authentication": OFF (public client)
   - Enable "Authorization": OFF
   - Enable "Standard flow**: ON
   - Enable "Direct access grants**: ON
   - Click "Next"

5. **Login settings**:
   - **Valid redirect URIs**: 
     - `http://localhost:5173/*`
     - `http://localhost:5174/*`
     - `http://localhost:5175/*`
   - **Valid post logout redirect URIs**: 
     - `http://localhost:5173/*`
     - `http://localhost:5174/*`
     - `http://localhost:5175/*`
   - **Web origins**: 
     - `http://localhost:5173`
     - `http://localhost:5174`
     - `http://localhost:5175`
   - Click "Save"

## Step 4: Create a Client for the Backend

1. Click "Clients" in the left sidebar
2. Click "Create client"
3. Configure the client:
   - **Client type**: OpenID Connect
   - **Client ID**: `aws-framework-backend`
   - Click "Next"

4. **Capability config**:
   - Enable "Client authentication": ON (confidential client)
   - Enable "Authorization**: OFF
   - Enable "Service accounts roles**: ON
   - Click "Next"

5. **Login settings**:
   - Leave defaults
   - Click "Save"

6. Go to the "Credentials" tab and copy the "Client secret" - you'll need this for the backend

## Step 5: Create Roles

1. In the left sidebar, click "Realm roles"
2. Click "Create role"
3. Create the following roles:
   - **Role name**: `admin`
   - **Description**: Administrator role with full access
   - Click "Save"
   
4. Create another role:
   - **Role name**: `user`
   - **Description**: Standard user role
   - Click "Save"

## Step 6: Create a Test User

1. In the left sidebar, click "Users"
2. Click "Create new user"
3. Configure the user:
   - **Username**: `testuser`
   - **Email**: `testuser@example.com`
   - **First name**: `Test`
   - **Last name**: `User`
   - **Email verified**: ON
   - Click "Create"

4. Set the user's password:
   - Click on the "Credentials" tab
   - Click "Set password"
   - **Password**: `password` (or your choice)
   - **Temporary**: OFF
   - Click "Save"
   - Confirm by clicking "Save password"

5. Assign roles to the user:
   - Click on the "Role mapping" tab
   - Click "Assign role"
   - Select "admin" and "user" roles
   - Click "Assign"

## Step 7: Configure Frontend Environment

Your frontend `.env` file should already have:

```bash
VITE_API_BASE_URL=http://localhost:3000
VITE_KEYCLOAK_URL=http://localhost:8080
VITE_KEYCLOAK_REALM=aws-framework
VITE_KEYCLOAK_CLIENT_ID=aws-framework-frontend
```

If `VITE_DISABLE_AUTH=true` is set, remove it or set it to `false`.

## Step 8: Configure Backend Environment

Update your backend `.env` file with the Keycloak client secret:

```bash
KEYCLOAK_URL=http://localhost:8080
KEYCLOAK_REALM=aws-framework
KEYCLOAK_CLIENT_ID=aws-framework-backend
KEYCLOAK_CLIENT_SECRET=<your-client-secret-from-step-4>
```

## Step 9: Restart Services

1. Restart the backend (if running in Docker):
   ```bash
   docker-compose restart backend
   ```

2. Restart the frontend dev server (Ctrl+C and restart):
   ```bash
   npm run dev:frontend
   ```

## Step 10: Test Authentication

1. Open http://localhost:5173 in your browser
2. You should be redirected to the Keycloak login page
3. Login with:
   - Username: `testuser`
   - Password: `password` (or what you set)
4. You should be redirected back to the application and logged in

## Troubleshooting

### "Failed to initialize authentication"
- Check that Keycloak is running: http://localhost:8080
- Verify the realm name is exactly `aws-framework`
- Verify the client ID is exactly `aws-framework-frontend`

### "Invalid redirect URI"
- Make sure you added all the redirect URIs in Step 3
- Check that the frontend is running on the correct port

### "CORS errors"
- Make sure you added the Web origins in Step 3
- Verify the origins match your frontend URL exactly

### "frame-ancestors" CSP error
- This is normal and can be ignored - it's Keycloak's security policy
- The authentication should still work

## Additional Configuration (Optional)

### Customize Login Theme
1. Go to "Realm settings" > "Themes"
2. Select a login theme from the dropdown
3. Click "Save"

### Enable User Registration
1. Go to "Realm settings" > "Login"
2. Enable "User registration"
3. Click "Save"

### Configure Token Lifespans
1. Go to "Realm settings" > "Tokens"
2. Adjust token lifespans as needed
3. Click "Save"

## Next Steps

Once Keycloak is configured, you can:
- Create more users through the Keycloak admin console
- Assign different roles to users
- Configure additional clients for other services
- Set up social login providers (Google, GitHub, etc.)
