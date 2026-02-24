# Org Admin UI i18n Initialization Fix

## Issue
When accessing http://localhost:5176/orgadmin/, the application flashes the landing page but then goes white with the error:
```
Uncaught TypeError: Cannot read properties of undefined (reading 'hasLanguageSomeTranslations')
at setLng (chunk-FXPUQAHK.js?v=46099c06:1999:28)
at _I18n.changeLanguage (chunk-FXPUQAHK.js?v=46099c06:2020:7)
at LocaleContext.tsx:35:12
```

## Root Cause
The `LocaleProvider` component was trying to call `i18n.changeLanguage()` before i18n was fully initialized. The initialization happens in `App.tsx` in a `useEffect` hook, but `LocaleProvider` mounts and tries to use i18n immediately, causing the error.

## Solution Applied

### 1. Added Initialization Check in LocaleContext
Updated `packages/orgadmin-shell/src/context/LocaleContext.tsx` to check if i18n is initialized before trying to change the language:

**In the useEffect that updates i18n language:**
```typescript
// Only change language if i18n is initialized
if (i18n.isInitialized && i18n.language !== locale) {
  i18n.changeLanguage(locale).catch((error) => {
    console.error('Failed to change language:', error);
  });
}
```

**In the setLocale function:**
```typescript
// Wait for i18n to be initialized
if (!i18n.isInitialized) {
  console.warn('i18n not initialized yet, waiting...');
  // Set locale state anyway, it will be applied when i18n initializes
  setLocaleState(newLocale);
  return;
}
```

## Current Status

### ✅ Fixed
- Added i18n initialization checks to prevent errors
- LocaleContext now gracefully handles uninitialized i18n
- Dev server running on http://localhost:5176/orgadmin (port changed from 5175)

### 🧪 Testing Required
1. Navigate to http://localhost:5176/orgadmin
2. Verify the app loads without errors
3. Check browser console for any warnings
4. Test language switching if available

## Files Modified
- `packages/orgadmin-shell/src/context/LocaleContext.tsx`

## Previous Issues Fixed
- Import errors for `formatCurrency` (see NAVIGATION_FIX_SUMMARY.md)

## Next Steps

### For Org Admin UI:
1. Test the application at http://localhost:5176/orgadmin
2. Verify authentication flow works
3. Test all module pages load correctly

### For Super Admin UI:
Once org admin is verified working, return to fixing the super admin 401 error by:
1. Opening Keycloak Admin Console (http://localhost:8080)
2. Configuring the `aws-framework-admin` client with audience mapper
3. Following the guide in `docs/KEYCLOAK_ADMIN_CLIENT_AUDIENCE_FIX.md`

## Related Documentation
- `ADMIN_AUTH_FIX_SUMMARY.md` - Super admin authentication fix guide
- `docs/KEYCLOAK_ADMIN_CLIENT_AUDIENCE_FIX.md` - Detailed Keycloak configuration
- `docs/KEYCLOAK_SETUP.md` - Complete Keycloak setup guide
