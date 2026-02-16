# Super Admin Interface - Fix Instructions

## Current Status

I've fixed the CORS issue by updating the backend configuration. Now you need to complete the Keycloak configuration manually.

## What I Fixed (Completed)

### CORS Configuration
Updated `packages/backend/.env` to allow requests from the admin frontend:
```env
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5174,http://localhost:5175
```

**Action Required**: Restart your backend server for this change to take effect:
```bash
cd packages/backend
npm run dev
```

## What You Need to Do (Manual Steps)

### Configure Keycloak Audience Mapper

The backend requires tokens to include `aws-framework-backend` in the audience claim. You need to configure Keycloak to add this.

#### Step 1: Open Keycloak Admin Console
- URL: http://localhost:8080
- Login with your admin credentials

#### Step 2: Navigate to Admin Client
1. Click **Clients** in the left sidebar
2. Click on **aws-framework-admin**

#### Step 3: Add Audience Mapper
1. Click the **Client scopes** tab
2. Click **aws-framework-admin-dedicated**
3. Click the **Mappers** tab
4. Click **Add mapper** → **By configuration**
5. Select **Audience**

#### Step 4: Configure the Mapper
Fill in these values:
- **Name**: `backend-audience`
- **Mapper Type**: Audience
- **Included Client Audience**: `aws-framework-backend`
- **Add to ID token**: OFF (unchecked)
- **Add to access token**: ON (checked) ✓

Click **Save**

## Testing the Fix

After completing both steps above:

1. **Clear your browser cache and cookies** for localhost
2. **Logout** from the admin interface (if logged in)
3. **Login again** to get a new token with the correct audience
4. **Navigate to "Organisation Types"** in the admin interface
5. **Check the browser console** - you should see:
   - No CORS errors
   - No 401 errors
   - Successful 200 responses from `/api/admin/organization-types`

## Verification

### Quick Token Check (Easiest Method)
1. Login to the admin interface at http://localhost:5174
2. Open http://localhost:5174/check-token.html in a new tab
3. Click "Check Token" button
4. Review the results - it will tell you if the backend audience is present

### Manual Check in Browser Console
After logging in, open the browser console and run:
```javascript
// Decode the token to check the audience
const payload = JSON.parse(atob(keycloak.token.split('.')[1]));
console.log('Audience:', payload.aud);
// Expected output: ["aws-framework-admin", "aws-framework-backend"]
```

### Check Network Tab
- Open Developer Tools → Network tab
- Navigate to Organisation Types
- Look for the request to `/api/admin/organization-types`
- Status should be **200 OK** (not 401 or CORS error)
- Response should contain organization type data

## Troubleshooting

### Still seeing CORS errors?
- Verify backend is restarted with the new ALLOWED_ORIGINS setting
- Check backend logs for CORS-related messages
- Verify the admin frontend is running on port 5174

### Still seeing 401 errors?
- Verify you completed the Keycloak audience mapper configuration
- Make sure you logged out and back in after the Keycloak change
- Check the token audience in browser console (see verification above)
- Ensure the mapper is set to add to **access token** (not just ID token)

### Token doesn't include backend audience?
- Double-check the mapper configuration in Keycloak
- Ensure "Included Client Audience" is set to `aws-framework-backend`
- Try deleting and recreating the mapper if it still doesn't work
- Clear browser cache completely and login again

## Summary

**Completed**:
- ✅ Backend CORS configuration updated
- ✅ Documentation updated

**Your Action Required**:
1. Restart backend server
2. Configure Keycloak audience mapper (5 minutes)
3. Logout and login to get new token
4. Test the admin interface

## Additional Resources

- Full documentation: `docs/KEYCLOAK_ADMIN_CLIENT_AUDIENCE_FIX.md`
- Summary: `ADMIN_AUTH_FIX_SUMMARY.md`
- Keycloak setup guide: `docs/KEYCLOAK_SETUP.md`
