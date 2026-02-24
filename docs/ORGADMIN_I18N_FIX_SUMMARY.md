# Org Admin UI Module Resolution and i18n Initialization Fix

## Issues

### Issue 1: Module Import Errors
When accessing http://localhost:5175/orgadmin/, the application showed a blank screen with the error:
```
Uncaught SyntaxError: The requested module '/orgadmin/utils/dateFormatting.ts' does not provide an export named 'formatCurrency'
```

### Issue 2: i18n Initialization Race Condition
After fixing the import errors, the app flashed briefly then crashed with:
```
Uncaught TypeError: Cannot read properties of undefined (reading 'hasLanguageSomeTranslations')
at setLng (chunk-FXPUQAHK.js:1999:28)
at _I18n.changeLanguage (chunk-FXPUQAHK.js:2020:7)
at LocaleContext.tsx:35:12
```

## Root Causes

### Issue 1: Incorrect Import Paths
Multiple files were incorrectly importing `formatCurrency` from the `dateFormatting` utility module instead of the `currencyFormatting` module.

### Issue 2: i18n Race Condition
The `LocaleProvider` component was trying to call `i18n.changeLanguage()` before i18next was fully initialized. The initialization happened asynchronously in a `useEffect` in App.tsx, but React was rendering the `LocaleProvider` before the initialization completed.

## Solutions Applied

### Solution 1: Fixed Import Statements
Updated 7 files to import `formatCurrency` from the correct module:

**Payment Pages:**
- `packages/orgadmin-core/src/payments/pages/PaymentsListPage.tsx`
- `packages/orgadmin-core/src/payments/pages/PaymentDetailsPage.tsx`
- `packages/orgadmin-core/src/payments/pages/LodgementsPage.tsx`

**Reporting Pages:**
- `packages/orgadmin-core/src/reporting/pages/ReportingDashboardPage.tsx`
- `packages/orgadmin-core/src/reporting/pages/MembersReportPage.tsx`
- `packages/orgadmin-core/src/reporting/pages/RevenueReportPage.tsx`
- `packages/orgadmin-core/src/reporting/pages/EventsReportPage.tsx`

Changed from:
```typescript
import { formatDate, formatCurrency } from '@aws-web-framework/orgadmin-shell/utils/dateFormatting';
```

Changed to:
```typescript
import { formatDate } from '@aws-web-framework/orgadmin-shell/utils/dateFormatting';
import { formatCurrency } from '@aws-web-framework/orgadmin-shell/utils/currencyFormatting';
```

### Solution 2: Fixed i18n Initialization Timing
Modified `packages/orgadmin-shell/src/App.tsx` to:
1. Add `i18nReady` state to track when i18n initialization is complete
2. Wait for i18n to initialize before rendering the `LocaleProvider`
3. Show loading screen while i18n is initializing

Key changes:
```typescript
// Added state to track i18n initialization
const [i18nReady, setI18nReady] = useState(false);

// Modified useEffect to set i18nReady when complete
useEffect(() => {
  const initI18n = async () => {
    try {
      await initializeI18n();
      setI18nReady(true);
    } catch (error) {
      console.error('Failed to initialize i18n:', error);
      setI18nReady(true); // Set to true anyway to allow app to render
    }
  };
  initI18n();
}, []);

// Modified loading check to include i18nReady
if (loading || !i18nReady) {
  return <LoadingScreen />;
}
```

## Current Status

### ✅ Fixed
- All import errors resolved
- i18n initialization race condition fixed
- Dev server running on http://localhost:5175/orgadmin
- Hot Module Replacement (HMR) working correctly
- Application should now load without errors

### Testing Required
Please test the application at http://localhost:5175/orgadmin and verify:
1. App loads without crashing
2. No console errors
3. Navigation works between modules
4. Translations are displayed correctly

## Next Steps

### For Org Admin UI:
1. Test the application thoroughly
2. Verify all pages load correctly
3. Test language switching if applicable

### For Super Admin UI:
Once org admin is verified working, return to fixing the super admin 401 error by:
1. Opening Keycloak Admin Console (http://localhost:8080)
2. Configuring the `aws-framework-admin` client with audience mapper
3. Following the guide in `docs/KEYCLOAK_ADMIN_CLIENT_AUDIENCE_FIX.md`

## Files Modified
- `packages/orgadmin-shell/src/App.tsx` - Added i18n initialization state tracking
- `packages/orgadmin-shell/src/context/LocaleContext.tsx` - Simplified language change logic
- `packages/orgadmin-core/src/payments/pages/PaymentsListPage.tsx` - Fixed imports
- `packages/orgadmin-core/src/payments/pages/PaymentDetailsPage.tsx` - Fixed imports
- `packages/orgadmin-core/src/payments/pages/LodgementsPage.tsx` - Fixed imports
- `packages/orgadmin-core/src/reporting/pages/ReportingDashboardPage.tsx` - Fixed imports
- `packages/orgadmin-core/src/reporting/pages/MembersReportPage.tsx` - Fixed imports
- `packages/orgadmin-core/src/reporting/pages/RevenueReportPage.tsx` - Fixed imports
- `packages/orgadmin-core/src/reporting/pages/EventsReportPage.tsx` - Fixed imports

## Related Documentation
- `ADMIN_AUTH_FIX_SUMMARY.md` - Super admin authentication fix guide
- `docs/KEYCLOAK_ADMIN_CLIENT_AUDIENCE_FIX.md` - Detailed Keycloak configuration
- `docs/KEYCLOAK_SETUP.md` - Complete Keycloak setup guide
