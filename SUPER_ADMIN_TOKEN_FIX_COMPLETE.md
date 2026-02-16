# Super Admin 401 Fix - Complete Solution

## Problem Summary
The super admin interface was getting 401 Unauthorized errors because:
1. ~~CORS was blocking requests~~ ✅ FIXED
2. API calls weren't including the authentication token ✅ FIXED
3. Token doesn't include backend audience (still requires Keycloak configuration)

## What I Fixed

### Fix 1: CORS Configuration ✅
Updated `packages/backend/.env` to allow admin frontend:
```env
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5174,http://localhost:5175
```

### Fix 2: Token Attachment ✅
The `organizationApi.ts` was using plain axios without authentication. I've updated it to:
1. Create an authenticated axios client with request interceptor
2. Attach the Keycloak token to all requests
3. Expose Keycloak instance globally for the interceptor to access

**Files Modified:**
- `packages/admin/src/services/organizationApi.ts` - Added authenticated axios client
- `packages/admin/src/context/AuthContext.tsx` - Exposed Keycloak instance globally

## What You Still Need to Do

### Configure Keycloak Audience Mapper

Even though the token is now being sent, the backend will still reject it because the token doesn't include `aws-framework-backend` in the audience claim.

#### Quick Steps:
1. Open http://localhost:8080 (Keycloak Admin Console)
2. Login with admin credentials
3. Go to: Clients → `aws-framework-admin` → Client scopes → `aws-framework-admin-dedicated` → Mappers
4. Click "Add mapper" → "By configuration" → "Audience"
5. Configure:
   - Name: `backend-audience`
   - Included Client Audience: `aws-framework-backend`
   - Add to access token: ON ✓
6. Save

#### After Configuration:
1. Logout from admin interface
2. Clear browser cache/cookies
3. Login again
4. The 401 errors should be gone

## Testing

### Option 1: Check Token (Recommended)
I've created a token checker tool. After logging in:
1. Open http://localhost:5174/check-token.html
2. In the admin interface, open browser console
3. Type: `window.keycloak.token`
4. Copy the token
5. Paste it into the token checker
6. It will tell you if the backend audience is included

### Option 2: Browser Console
After logging in, run in console:
```javascript
const payload = JSON.parse(atob(window.keycloak.token.split('.')[1]));
console.log('Audience:', payload.aud);
// Should include: ["aws-framework-admin", "aws-framework-backend"]
```

## Current Status

✅ Backend CORS configured
✅ Token attachment fixed
✅ Code changes complete
⏳ Keycloak audience mapper (manual step required)

## Next Steps

1. **Restart your admin frontend** to pick up the code changes:
   ```bash
   cd packages/admin
   npm run dev
   ```

2. **Configure Keycloak** (5 minutes, see above)

3. **Test** - Login and navigate to Organisation Types

## Troubleshooting

### Still getting 401 after Keycloak configuration?
- Make sure you logged out and back in after the Keycloak change
- Check the token using the token checker tool
- Verify the mapper is set to add to "access token" not just "ID token"

### Token checker shows backend audience is missing?
- Double-check the Keycloak mapper configuration
- Ensure "Included Client Audience" is exactly: `aws-framework-backend`
- Try deleting and recreating the mapper

### Network tab shows no Authorization header?
- Make sure you restarted the admin frontend after the code changes
- Check browser console for any errors
- Verify `window.keycloak` is defined in console

## Documentation

- Full guide: `docs/KEYCLOAK_ADMIN_CLIENT_AUDIENCE_FIX.md`
- Summary: `ADMIN_AUTH_FIX_SUMMARY.md`
- Token checker: http://localhost:5174/check-token.html
