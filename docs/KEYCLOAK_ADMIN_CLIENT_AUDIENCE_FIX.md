# Keycloak Admin Client Audience Configuration

## Problem
The admin frontend (`aws-framework-admin` client) was getting 401 Unauthorized and CORS errors when calling backend APIs:

1. **Token Audience Issue**: JWT tokens didn't include the backend client (`aws-framework-backend`) in the audience claim
2. **CORS Issue**: Backend wasn't configured to allow requests from the admin frontend origin (`http://localhost:5174`)

## Solutions

### Solution 1: Backend CORS Configuration (Completed)
Updated backend `.env` to include admin frontend in allowed origins.

### Solution 2: Keycloak Audience Mapper (Manual Configuration Required)
Configure the admin client to include the backend client as an audience in issued tokens.

## Configuration Steps

### Step 1: Backend CORS Configuration (Completed)

The backend has been updated to allow requests from the admin frontend:

```env
# packages/backend/.env
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5174,http://localhost:5175
```

Restart the backend server after this change:
```bash
cd packages/backend
npm run dev
```

### Step 2: Keycloak Audience Mapper (Manual Configuration Required)

### 1. Access Keycloak Admin Console
- URL: `http://localhost:8080`
- Login with admin credentials

### 2. Navigate to Admin Client
1. Left sidebar → **Clients**
2. Click on `aws-framework-admin`

### 3. Add Audience Mapper
1. Click **Client scopes** tab
2. Click `aws-framework-admin-dedicated`
3. Click **Mappers** tab
4. Click **Add mapper** → **By configuration**
5. Select **Audience**

### 4. Configure Mapper
- **Name**: `backend-audience`
- **Mapper Type**: Audience
- **Included Client Audience**: `aws-framework-backend`
- **Add to ID token**: OFF
- **Add to access token**: ON ✓

Click **Save**

## Verification Steps

### 1. Test the Token
After configuration, log out and log back into the admin interface:

```bash
# In browser console (after login), check the token
console.log(keycloak.token);
```

### 2. Decode the Token
Use jwt.io or decode in console:

```javascript
// In browser console
const payload = JSON.parse(atob(keycloak.token.split('.')[1]));
console.log('Audience:', payload.aud);
// Should show: ["aws-framework-admin", "aws-framework-backend"]
```

### 3. Test API Call
Try accessing the organization types endpoint:
- Navigate to "Organisation Types" in the admin interface
- Check browser console - should see successful 200 responses
- Check Network tab - Authorization header should be present

### 4. Backend Logs
Check backend logs for successful authentication:

```bash
cd packages/backend
npm run dev
# Should see successful API requests without 401 errors
```

## Expected Token Structure

After configuration, the access token should contain:

```json
{
  "aud": [
    "aws-framework-admin",
    "aws-framework-backend"
  ],
  "realm_access": {
    "roles": ["admin", "super-admin"]
  },
  "sub": "user-id",
  "email": "user@example.com"
}
```

## Troubleshooting

### Still Getting CORS Errors

1. **Verify backend .env configuration**
   ```bash
   # In packages/backend/.env
   ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5174,http://localhost:5175
   ```

2. **Restart backend server**
   ```bash
   cd packages/backend
   npm run dev
   ```

3. **Check browser console**
   - Look for CORS-specific error messages
   - Verify the request origin matches one in ALLOWED_ORIGINS

### Still Getting 401 Errors

1. **Clear browser cache and cookies**
   - Logout completely
   - Clear site data
   - Login again

2. **Verify mapper is active**
   - Go back to Client scopes → Mappers
   - Ensure mapper is enabled

3. **Check backend configuration**
   ```bash
   # In packages/backend/.env
   KEYCLOAK_CLIENT_ID=aws-framework-backend
   KEYCLOAK_REALM=aws-framework
   KEYCLOAK_URL=http://localhost:8080
   ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5174,http://localhost:5175
   ```

4. **Restart backend server**
   ```bash
   cd packages/backend
   npm run dev
   ```

### Token Not Including Backend Audience

- Ensure you selected the correct client (`aws-framework-backend`) in the mapper
- Verify "Add to access token" is checked
- Try creating a new mapper if the first one doesn't work

### Backend Still Rejecting Token

Check if the backend is using the correct client ID:
```typescript
// packages/backend/src/middleware/auth.middleware.ts
// Should validate against: process.env.KEYCLOAK_CLIENT_ID
```

## Alternative: Multiple Client Support

If you need the backend to accept tokens from multiple clients without audience configuration, you can modify the auth middleware to accept an array of valid client IDs. This requires code changes.

## Production Considerations

1. **Apply to all environments**: Repeat this configuration in staging/production Keycloak instances
2. **Document in deployment guide**: Add this step to infrastructure setup
3. **Automate if possible**: Consider using Keycloak Terraform provider or REST API for automated setup

## Related Files
- `packages/backend/src/middleware/auth.middleware.ts` - Token validation logic
- `packages/admin/src/context/ApiContext.tsx` - Token attachment to requests
- `packages/backend/.env` - Backend Keycloak configuration
- `packages/admin/.env` - Admin frontend Keycloak configuration
