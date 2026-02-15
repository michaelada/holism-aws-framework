# Admin Authentication 401 Fix - Summary

## Issue
Super admin interface was returning 401 Unauthorized when accessing `/api/admin/organization-types` and other backend endpoints after successful Keycloak login.

## Root Cause
**Token Audience Mismatch**:
- Admin frontend uses Keycloak client: `aws-framework-admin`
- Backend expects tokens with audience: `aws-framework-backend`
- Tokens from admin client only had audience `aws-framework-admin`
- Backend auth middleware rejected tokens without matching audience

## Solution Applied
Configure Keycloak to add the backend client as an audience in tokens issued by the admin client.

## Implementation Steps

### 1. Access Keycloak Admin Console
```
URL: http://localhost:8080
Login: admin / admin
```

### 2. Navigate to Admin Client
- Clients → `aws-framework-admin`

### 3. Add Audience Mapper
- Client scopes tab → `aws-framework-admin-dedicated`
- Mappers tab → Add mapper → By configuration → Audience

### 4. Configure Mapper
```
Name: backend-audience
Mapper Type: Audience
Included Client Audience: aws-framework-backend
Add to ID token: OFF
Add to access token: ON ✓
```

### 5. Test
1. Logout from admin interface
2. Clear browser cache/cookies
3. Login again
4. Navigate to "Organisation Types"
5. Should see successful 200 responses

## Verification

### Check Token in Browser Console
```javascript
// After login, in browser console:
const payload = JSON.parse(atob(keycloak.token.split('.')[1]));
console.log('Audience:', payload.aud);
// Expected: ["aws-framework-admin", "aws-framework-backend"]
```

### Check Network Tab
- Authorization header should be present: `Bearer eyJ...`
- Response should be 200 OK, not 401 Unauthorized

### Check Backend Logs
```bash
cd packages/backend
npm run dev
# Should see successful API requests
```

## Files Updated
- `docs/KEYCLOAK_ADMIN_CLIENT_AUDIENCE_FIX.md` - Detailed fix guide
- `docs/KEYCLOAK_SETUP.md` - Updated with Step 9 for admin client configuration

## Technical Details

### Auth Flow
1. User logs into admin frontend via Keycloak
2. Keycloak issues JWT token with:
   - Issuer: `http://localhost:8080/realms/aws-framework`
   - Audience: `["aws-framework-admin", "aws-framework-backend"]` ← Fixed
   - Roles: `["admin", "super-admin"]`
3. Frontend attaches token to API requests via Authorization header
4. Backend validates token:
   - Verifies signature using Keycloak public key
   - Checks issuer matches
   - Checks audience includes `aws-framework-backend` ← Now passes
   - Extracts user info and roles
5. Request proceeds to route handler

### Code References

**Frontend - Token Attachment**:
```typescript
// packages/admin/src/context/ApiContext.tsx
const api = new AdminApiService({
  baseURL: import.meta.env.VITE_API_URL,
  getToken: () => keycloak?.token || null,  // Gets token from Keycloak
  onUnauthorized: () => keycloak?.logout()
});
```

**Backend - Token Validation**:
```typescript
// packages/backend/src/middleware/auth.middleware.ts
jwt.verify(
  token,
  getKey(client),
  {
    issuer,
    audience: config.clientId,  // Checks for 'aws-framework-backend'
    algorithms: ['RS256']
  },
  (err, decoded) => { /* ... */ }
);
```

## Alternative Solutions (Not Used)

### Option 2: Disable Auth (Development Only)
```bash
# packages/backend/.env
DISABLE_AUTH=true
```
Not recommended - bypasses all security.

### Option 3: Modify Backend to Accept Multiple Clients
Requires code changes to auth middleware to accept array of valid client IDs. More complex and not necessary with audience mapper.

## Production Considerations

1. **Apply to all environments**: Repeat configuration in staging/production Keycloak
2. **Document in deployment**: Include in infrastructure setup guides
3. **Automate**: Consider Keycloak Terraform provider or REST API
4. **Monitor**: Ensure tokens include correct audience in production

## Related Issues

This same configuration is needed for any additional frontend clients that need to call the backend API:
- Organization admin interface (if separate client)
- Mobile apps
- Third-party integrations

## Success Criteria

✅ Admin interface loads without errors
✅ Organisation Types page displays data
✅ No 401 errors in browser console
✅ Backend logs show successful authenticated requests
✅ Token includes both admin and backend in audience claim

## Next Steps

After fixing this issue:
1. Test all admin interface features
2. Verify role-based access control works
3. Test creating/editing organization types
4. Verify super-admin role restrictions work correctly
