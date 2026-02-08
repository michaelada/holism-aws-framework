# Keycloak Configuration for AWS Web Application Framework

This document describes how to configure Keycloak for authentication and authorization in the AWS Web Application Framework.

## Overview

Keycloak provides SSO (Single Sign-On) authentication using OpenID Connect and JWT tokens. The framework uses Keycloak to:
- Authenticate users
- Issue JWT tokens
- Manage user roles and permissions
- Provide role-based access control (RBAC)

## Local Development Setup

### 1. Start Keycloak

Keycloak is included in the docker-compose.yml file and starts automatically:

```bash
docker-compose up -d keycloak
```

Access Keycloak Admin Console at: http://localhost:8080
- Username: `admin`
- Password: `admin`

### 2. Create Realm

1. Log in to Keycloak Admin Console
2. Click on the dropdown in the top-left (currently showing "master")
3. Click "Create Realm"
4. Enter realm name: `aws-framework`
5. Click "Create"

### 3. Create Client

1. In the `aws-framework` realm, go to "Clients"
2. Click "Create client"
3. Configure the client:
   - **Client ID**: `aws-framework-backend`
   - **Client Protocol**: `openid-connect`
   - Click "Next"
4. Configure capability:
   - **Client authentication**: ON (for confidential client)
   - **Authorization**: OFF
   - **Authentication flow**: 
     - Standard flow: ON
     - Direct access grants: ON
   - Click "Next"
5. Configure login settings:
   - **Root URL**: `http://localhost:3000`
   - **Valid redirect URIs**: `http://localhost:3000/*`
   - **Web origins**: `http://localhost:3000`
   - Click "Save"

### 4. Get Client Secret

1. Go to the "Credentials" tab of your client
2. Copy the "Client Secret" value
3. Add it to your `.env` file:

```env
KEYCLOAK_CLIENT_SECRET=<your-client-secret>
```

### 5. Create Roles

1. In the `aws-framework` realm, go to "Realm roles"
2. Click "Create role"
3. Create the following roles:
   - **admin**: Full access to all resources
   - **user**: Standard user access
   - **viewer**: Read-only access

### 6. Create Test Users

1. Go to "Users" in the left menu
2. Click "Add user"
3. Create test users:

**Admin User:**
- Username: `admin@example.com`
- Email: `admin@example.com`
- First name: `Admin`
- Last name: `User`
- Email verified: ON
- Click "Create"
- Go to "Credentials" tab
- Set password: `admin123`
- Temporary: OFF
- Go to "Role mapping" tab
- Click "Assign role"
- Select "admin" role

**Regular User:**
- Username: `user@example.com`
- Email: `user@example.com`
- First name: `Test`
- Last name: `User`
- Email verified: ON
- Click "Create"
- Go to "Credentials" tab
- Set password: `user123`
- Temporary: OFF
- Go to "Role mapping" tab
- Click "Assign role"
- Select "user" role

## Environment Variables

Add the following to your `.env` file:

```env
# Keycloak Configuration
KEYCLOAK_URL=http://localhost:8080
KEYCLOAK_REALM=aws-framework
KEYCLOAK_CLIENT_ID=aws-framework-backend
KEYCLOAK_CLIENT_SECRET=<your-client-secret>
```

## JWT Token Structure

Keycloak issues JWT tokens with the following structure:

```json
{
  "exp": 1234567890,
  "iat": 1234567890,
  "jti": "unique-token-id",
  "iss": "http://localhost:8080/realms/aws-framework",
  "sub": "user-id",
  "typ": "Bearer",
  "azp": "aws-framework-backend",
  "realm_access": {
    "roles": ["admin", "user"]
  },
  "email": "user@example.com",
  "preferred_username": "user@example.com"
}
```

## Testing Authentication

### Get Access Token

Use the following curl command to get an access token:

```bash
curl -X POST http://localhost:8080/realms/aws-framework/protocol/openid-connect/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "client_id=aws-framework-backend" \
  -d "client_secret=<your-client-secret>" \
  -d "grant_type=password" \
  -d "username=admin@example.com" \
  -d "password=admin123"
```

Response:
```json
{
  "access_token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expires_in": 300,
  "refresh_expires_in": 1800,
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "Bearer"
}
```

### Use Access Token

Include the access token in API requests:

```bash
curl -X GET http://localhost:3000/api/metadata/fields \
  -H "Authorization: Bearer <access-token>"
```

## Production Configuration

For production environments:

1. Use a dedicated Keycloak instance (not the dev server)
2. Enable HTTPS for all Keycloak URLs
3. Use strong client secrets (store in AWS Secrets Manager)
4. Configure proper redirect URIs for your production domain
5. Enable additional security features:
   - Token expiration policies
   - Refresh token rotation
   - Session management
   - Brute force detection

## Troubleshooting

### Token Validation Fails

- Verify KEYCLOAK_URL is accessible from the backend
- Check that the realm name matches
- Ensure client ID and secret are correct
- Verify the token hasn't expired

### CORS Issues

- Add your frontend URL to "Web origins" in the client configuration
- Ensure the backend CORS middleware allows the Authorization header

### Role Mapping Not Working

- Verify roles are assigned to users in Keycloak
- Check that the JWT token includes the `realm_access.roles` claim
- Ensure the backend middleware correctly extracts roles from the token
