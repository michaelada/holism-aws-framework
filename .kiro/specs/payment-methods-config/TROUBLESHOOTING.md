# Payment Methods UI Troubleshooting Guide

## Issue: Payment Methods selector not visible in Create/Edit Organization pages

### Possible Causes and Solutions

#### 1. Frontend Not Rebuilt
The most common issue is that the frontend hasn't been rebuilt after the new code was added.

**Solution:**
```bash
# Navigate to the admin package
cd packages/admin

# Rebuild the frontend
npm run build

# Or if running in development mode, restart the dev server
npm run dev
```

#### 2. Browser Cache
The browser might be caching the old version of the application.

**Solution:**
- Hard refresh the browser: `Ctrl+Shift+R` (Windows/Linux) or `Cmd+Shift+R` (Mac)
- Or clear browser cache and reload
- Or open in incognito/private browsing mode

#### 3. Backend Not Running or Routes Not Loaded
The backend might not be running or the routes might not be properly loaded.

**Solution:**
```bash
# Check if backend is running
curl http://localhost:3000/health

# Check if payment methods endpoint is accessible
curl http://localhost:3000/api/admin/payment-methods

# If not running, start the backend
cd packages/backend
npm run dev
```

#### 4. Database Migrations Not Applied
The payment methods tables might not exist in the database.

**Solution:**
```bash
cd packages/backend

# Check current migration status
npm run migrate:up

# If tables don't exist, run migrations
npm run migrate:up
```

#### 5. API Client Configuration
The API client might not be configured with the correct base URL.

**Solution:**
Check `packages/admin/.env` file:
```env
VITE_API_URL=http://localhost:3000
```

#### 6. CORS Issues
The backend might be blocking requests from the frontend.

**Solution:**
Check `packages/backend/.env` file:
```env
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3001
```

### Verification Steps

1. **Check Browser Console**
   - Open browser developer tools (F12)
   - Look for any JavaScript errors
   - Check the Network tab for failed API requests

2. **Verify API Response**
   ```bash
   # Test the payment methods endpoint directly
   curl http://localhost:3000/api/admin/payment-methods
   
   # Expected response:
   # [
   #   {
   #     "id": "...",
   #     "name": "pay-offline",
   #     "displayName": "Pay Offline",
   #     "description": "...",
   #     "requiresActivation": false,
   #     "isActive": true
   #   },
   #   ...
   # ]
   ```

3. **Check Component Import**
   Open browser console and type:
   ```javascript
   // This should not throw an error
   import('/src/components/PaymentMethodSelector.tsx')
   ```

4. **Verify Database Tables**
   ```bash
   # Connect to your database and check if tables exist
   psql -d your_database_name
   
   # Run these queries:
   \dt payment_methods
   \dt org_payment_method_data
   
   # Check if seed data exists:
   SELECT * FROM payment_methods;
   ```

### Quick Fix Checklist

- [ ] Rebuild frontend: `cd packages/admin && npm run build`
- [ ] Hard refresh browser (Ctrl+Shift+R)
- [ ] Verify backend is running: `curl http://localhost:3000/health`
- [ ] Check payment methods endpoint: `curl http://localhost:3000/api/admin/payment-methods`
- [ ] Verify migrations are applied: `cd packages/backend && npm run migrate:up`
- [ ] Check browser console for errors (F12)
- [ ] Verify .env files are configured correctly

### Still Not Working?

If the payment methods selector is still not visible after trying all the above:

1. **Check the React component is rendering:**
   - Add a console.log in CreateOrganizationPage.tsx:
   ```typescript
   console.log('Payment Methods:', paymentMethods);
   console.log('Selected:', formData.enabledPaymentMethods);
   ```

2. **Verify the component is imported:**
   - Check that `PaymentMethodSelector` is imported at the top of CreateOrganizationPage.tsx
   - Check that it's exported from `packages/admin/src/components/index.ts`

3. **Check for TypeScript errors:**
   ```bash
   cd packages/admin
   npx tsc --noEmit
   ```

4. **Restart everything:**
   ```bash
   # Stop all services
   # Then restart backend
   cd packages/backend
   npm run dev
   
   # In another terminal, restart frontend
   cd packages/admin
   npm run dev
   ```

### Contact Support

If none of these solutions work, please provide:
- Browser console errors (if any)
- Network tab showing the API request/response
- Output of `curl http://localhost:3000/api/admin/payment-methods`
- Screenshot of the Create Organization page
