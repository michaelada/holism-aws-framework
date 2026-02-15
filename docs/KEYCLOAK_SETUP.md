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

## Step 8: Create Admin Service Account Client

This client is used by the backend to perform administrative operations (managing users, roles, and tenants).

1. Click "Clients" in the left sidebar
2. Click "Create client"
3. Configure the client:
   - **Client type**: OpenID Connect
   - **Client ID**: `admin-cli`
   - Click "Next"

4. **Capability config**:
   - Enable "Client authentication": ON (confidential client)
   - Enable "Authorization**: OFF
   - Enable "Service accounts roles**: ON
   - Enable "Standard flow**: OFF
   - Enable "Direct access grants**: OFF
   - Click "Next"

5. **Login settings**:
   - Leave defaults
   - Click "Save"

6. Go to the "Credentials" tab and copy the "Client secret" - you'll need this for the backend admin operations

7. Assign admin roles to the service account:
   - Click on the "Service account roles" tab
   - Click "Assign role"
   - Click the "Filter by clients" dropdown and select "realm-management"
   - Select the following roles (these are required for admin operations):
     - **realm-admin**: Full realm administration access
     - **manage-users**: Create, update, delete users
     - **manage-clients**: Manage clients
     - **manage-realm**: Manage realm settings
     - **view-users**: View user information
     - **view-clients**: View client information
     - **view-realm**: View realm information
     - **query-users**: Query user information
     - **query-groups**: Query group information
     - **manage-authorization**: Manage authorization settings
   - Click "Assign"

**Note**: The `realm-admin` role includes all other roles, but it's good practice to explicitly assign the specific roles your application needs for clarity and security auditing.

### Understanding Service Account Roles

Each role grants specific permissions for admin operations:

| Role | Purpose | Required For |
|------|---------|--------------|
| `realm-admin` | Full administrative access to the realm | All admin operations (includes all roles below) |
| `manage-users` | Create, update, delete users and manage group memberships | User CRUD operations, tenant assignments |
| `view-users` | Read user information | Listing users, viewing user details |
| `query-users` | Search and filter users | User search and filtering by tenant |
| `query-groups` | Search and filter groups | Tenant member count, group queries |
| `manage-realm` | Manage realm-level settings and roles | Creating and managing realm roles |
| `view-realm` | View realm configuration | Reading realm settings |
| `manage-clients` | Manage OAuth clients | Client configuration (if needed) |
| `view-clients` | View OAuth clients | Reading client information (if needed) |
| `manage-authorization` | Manage authorization policies | Advanced permission management (if needed) |

**Recommended Minimal Setup**: For the Keycloak Admin Integration feature, assign only `realm-admin` for simplicity, or assign these specific roles for least privilege:
- `manage-users`
- `view-users`
- `query-users`
- `query-groups`
- `manage-realm`
- `view-realm`

## Step 9: Create Admin Frontend Client

This client is used by the super admin interface to manage organization types, organizations, and capabilities.

1. Click "Clients" in the left sidebar
2. Click "Create client"
3. Configure the client:
   - **Client type**: OpenID Connect
   - **Client ID**: `aws-framework-admin`
   - Click "Next"

4. **Capability config**:
   - Enable "Client authentication": OFF (public client)
   - Enable "Authorization**: OFF
   - Enable "Standard flow**: ON
   - Enable "Direct access grants**: ON
   - Click "Next"

5. **Login settings**:
   - **Valid redirect URIs**: 
     - `http://localhost:5176/*`
   - **Valid post logout redirect URIs**: 
     - `http://localhost:5176/*`
   - **Web origins**: 
     - `http://localhost:5176`
   - Click "Save"

6. **Configure Audience Mapper** (Critical for API access):
   - Click on the **Client scopes** tab
   - Click on `aws-framework-admin-dedicated` (the dedicated scope for this client)
   - Click the **Mappers** tab
   - Click **Add mapper** → **By configuration**
   - Select **Audience**
   - Configure the mapper:
     - **Name**: `backend-audience`
     - **Mapper Type**: Audience
     - **Included Client Audience**: Select `aws-framework-backend` from dropdown
     - **Add to ID token**: OFF (leave unchecked)
     - **Add to access token**: ON (check this)
   - Click **Save**

**Why is this needed?** The admin frontend gets tokens from the `aws-framework-admin` client, but the backend validates tokens against the `aws-framework-backend` client. The audience mapper adds the backend client to the token's audience claim, allowing the backend to accept tokens from the admin frontend.

## Step 10: Configure Backend Environment

Update your backend `.env` file with both the backend client secret and admin client secret:

```bash
# Keycloak Configuration (for token validation)
KEYCLOAK_URL=http://localhost:8080
KEYCLOAK_REALM=aws-framework
KEYCLOAK_CLIENT_ID=aws-framework-backend
KEYCLOAK_CLIENT_SECRET=<your-client-secret-from-step-4>

# Keycloak Admin Configuration (for admin operations)
KEYCLOAK_ADMIN_CLIENT_ID=admin-cli
KEYCLOAK_ADMIN_CLIENT_SECRET=<your-admin-client-secret-from-step-8>
KEYCLOAK_ADMIN_BASE_URL=http://localhost:8080
KEYCLOAK_ADMIN_REALM=aws-framework
```

## Step 11: Configure Admin Frontend Environment

Create or update `packages/admin/.env`:

```bash
VITE_API_URL=http://localhost:3000
VITE_KEYCLOAK_URL=http://localhost:8080
VITE_KEYCLOAK_REALM=aws-framework
VITE_KEYCLOAK_CLIENT_ID=aws-framework-admin
```

## Step 12: Restart Services

1. Restart the backend (if running in Docker):
   ```bash
   docker-compose restart backend
   ```

2. Restart the frontend dev server (Ctrl+C and restart):
   ```bash
   npm run dev:frontend
   ```

## Step 13: Test Authentication

1. Open http://localhost:5173 in your browser
2. You should be redirected to the Keycloak login page
3. Login with:
   - Username: `testuser`
   - Password: `password` (or what you set)
4. You should be redirected back to the application and logged in

## Step 14: Test Admin Service Account (Optional)

You can verify that the admin service account is configured correctly by testing the token endpoint:

```bash
curl -X POST http://localhost:8080/realms/aws-framework/protocol/openid-connect/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "client_id=admin-cli" \
  -d "client_secret=<your-admin-client-secret-from-step-8>" \
  -d "grant_type=client_credentials"
```

If successful, you should receive an access token response:

```json
{
  "access_token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expires_in": 60,
  "refresh_expires_in": 0,
  "token_type": "Bearer",
  "not-before-policy": 0,
  "scope": "profile email"
}
```

You can then use this token to test admin operations, for example, listing users:

```bash
curl -X GET http://localhost:8080/admin/realms/aws-framework/users \
  -H "Authorization: Bearer <access-token-from-above>"
```

## Security Considerations

### Service Account Security

The admin service account has powerful privileges and should be protected:

1. **Never commit secrets to version control**: Always use environment variables for client secrets
2. **Use strong secrets**: Generate cryptographically secure random strings for client secrets
3. **Rotate secrets regularly**: Change the admin client secret periodically (e.g., every 90 days)
4. **Limit scope**: Only assign the minimum required roles for your use case
5. **Monitor usage**: Enable audit logging in Keycloak to track admin operations
6. **Secure storage**: In production, store secrets in AWS Secrets Manager or similar secure storage

### Production Recommendations

For production environments:

1. **Use a dedicated admin client**: Don't reuse the same client for authentication and admin operations
2. **Enable IP restrictions**: Configure Keycloak to only accept admin API calls from your backend servers
3. **Use HTTPS**: Always use HTTPS for Keycloak in production
4. **Enable audit logging**: Track all admin operations for compliance and security monitoring
5. **Implement rate limiting**: Protect against brute force attacks on the admin API
6. **Regular security updates**: Keep Keycloak updated with the latest security patches

### Principle of Least Privilege

Instead of assigning `realm-admin` (which grants full access), you can assign only the specific roles needed:

**For user management only**:
- `manage-users`
- `view-users`
- `query-users`

**For role management**:
- `manage-realm` (for realm roles)
- `view-realm`

**For group/tenant management**:
- `query-groups`
- `manage-users` (groups are managed through user operations)

To implement this, in Step 8.7, only select the specific roles your application needs instead of `realm-admin`.

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

### Admin Service Account Issues

**"Client not found" or "Invalid client credentials"**
- Verify the `KEYCLOAK_ADMIN_CLIENT_ID` matches the client ID created in Step 8 (should be `admin-cli`)
- Check that the `KEYCLOAK_ADMIN_CLIENT_SECRET` is correct (copy from Credentials tab)
- Ensure the client has "Service accounts roles" enabled

**"Access denied" or "Insufficient permissions"**
- Verify the service account has the required roles assigned (Step 8.7)
- Check that you selected "realm-management" in the filter when assigning roles
- Ensure at least `realm-admin` or the specific required roles are assigned

**"Failed to authenticate admin client"**
- Verify `KEYCLOAK_ADMIN_BASE_URL` is accessible from the backend
- Check that the realm name in `KEYCLOAK_ADMIN_REALM` matches your realm
- Test the token endpoint manually using the curl command in Step 12

**"Token expired" errors**
- Service account tokens expire after 60 seconds by default
- The backend should automatically refresh tokens - check the KeycloakAdminService implementation
- Verify the `ensureAuthenticated()` method is being called before each operation

**Backend can't reach Keycloak**
- If running in Docker, use `http://keycloak:8080` instead of `http://localhost:8080`
- Check Docker network connectivity: `docker-compose exec backend ping keycloak`
- Verify Keycloak container is running: `docker-compose ps keycloak`

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

## Quick Reference

### Environment Variables Summary

**Frontend (.env)**:
```bash
VITE_API_BASE_URL=http://localhost:3000
VITE_KEYCLOAK_URL=http://localhost:8080
VITE_KEYCLOAK_REALM=aws-framework
VITE_KEYCLOAK_CLIENT_ID=aws-framework-frontend
```

**Backend (.env)**:
```bash
# Authentication
KEYCLOAK_URL=http://localhost:8080
KEYCLOAK_REALM=aws-framework
KEYCLOAK_CLIENT_ID=aws-framework-backend
KEYCLOAK_CLIENT_SECRET=<backend-client-secret>

# Admin Operations
KEYCLOAK_ADMIN_CLIENT_ID=admin-cli
KEYCLOAK_ADMIN_CLIENT_SECRET=<admin-client-secret>
KEYCLOAK_ADMIN_BASE_URL=http://localhost:8080
KEYCLOAK_ADMIN_REALM=aws-framework
```

### Clients Summary

| Client ID | Type | Purpose | Authentication | Service Account |
|-----------|------|---------|----------------|-----------------|
| `aws-framework-frontend` | Public | Frontend authentication | OFF | N/A |
| `aws-framework-backend` | Confidential | Backend token validation | ON | OFF |
| `admin-cli` | Confidential | Admin operations | ON | ON |

### Required Roles Summary

**User Roles** (assigned to users):
- `admin`: Full access to admin interface
- `user`: Standard user access

**Service Account Roles** (assigned to admin-cli client):
- `realm-admin`: Full realm administration (recommended for simplicity)
- OR specific roles: `manage-users`, `view-users`, `query-users`, `query-groups`, `manage-realm`, `view-realm`

### Useful Keycloak Admin API Endpoints

```bash
# Get admin token
POST http://localhost:8080/realms/aws-framework/protocol/openid-connect/token

# List users
GET http://localhost:8080/admin/realms/aws-framework/users

# Get user by ID
GET http://localhost:8080/admin/realms/aws-framework/users/{user-id}

# Create user
POST http://localhost:8080/admin/realms/aws-framework/users

# List groups
GET http://localhost:8080/admin/realms/aws-framework/groups

# List realm roles
GET http://localhost:8080/admin/realms/aws-framework/roles
```

### Docker Network Configuration

When running in Docker, use these URLs in backend .env:
```bash
KEYCLOAK_URL=http://keycloak:8080
KEYCLOAK_ADMIN_BASE_URL=http://keycloak:8080
```

When accessing from host machine (browser, curl), use:
```bash
http://localhost:8080
```
