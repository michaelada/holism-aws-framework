# i18n Page Reload Fix

## Date: February 24, 2026

## Problem

When users reloaded the OrgAdmin UI landing page (F5 or Ctrl+R), the interface would revert to English, even though the organization was configured for a different language (e.g., French).

## Root Cause

The i18n system was being initialized before the organization data was available. This caused a race condition:

1. App loads and `useAuth` hook starts fetching organization data
2. `organizationLocale` defaults to `'en-GB'` because `organisation` is still `null`
3. i18n initializes with `'en-GB'`
4. Components render in English
5. Organization data arrives with language setting (`fr-FR`)
6. LocaleProvider attempts to change language, but components have already rendered

On subsequent navigation within the app, the language would be correct because the organization data was already loaded. But on a full page reload, the race condition would occur again.

## Solution

Modified the initialization flow to wait for organization data before initializing i18n:

### Key Changes

1. **Return null when no organization data**: The `organizationLocale` now returns `null` instead of defaulting to `'en-GB'` when organization data isn't available yet

2. **Wait for organization data**: The loading screen now waits for organization data: `if (loading || !i18nReady || (authenticated && !organisation))`

3. **Initialize with correct language**: i18n only initializes once we have the organization data and know the correct language

### Before (Incorrect)

```typescript
// Organization locale defaults to en-GB immediately
const organizationLocale = useMemo(() => {
  if (organisation && organisation.language) {
    return organisation.language;
  }
  return 'en-GB'; // ❌ Returns en-GB before organization data arrives
}, [organisation]);

// i18n initializes with en-GB
useEffect(() => {
  if (organizationLocale && !i18nInitialized) {
    await initializeI18n(organizationLocale); // ❌ Initializes with en-GB
    setI18nReady(true);
  }
}, [organizationLocale, i18nInitialized]);

// Loading screen doesn't wait for organization data
if (loading || !i18nReady) {
  return <LoadingScreen />;
}
```

### After (Correct)

```typescript
// Organization locale returns null until data is available
const organizationLocale = useMemo(() => {
  if (!organisation) {
    return null; // ✅ Wait for organization data
  }
  
  if (organisation.language) {
    return organisation.language;
  }
  if (organisation.organizationType?.defaultLocale) {
    return organisation.organizationType.defaultLocale;
  }
  return 'en-GB';
}, [organisation]);

// i18n only initializes when we have the organization locale
useEffect(() => {
  if (organizationLocale && !i18nInitialized) {
    console.log('Initializing i18n with locale:', organizationLocale);
    await initializeI18n(organizationLocale); // ✅ Initializes with correct language
    setI18nReady(true);
    setI18nInitialized(true);
  }
}, [organizationLocale, i18nInitialized]);

// Loading screen waits for organization data
if (loading || !i18nReady || (authenticated && !organisation)) {
  return <LoadingScreen />; // ✅ Waits for organization data
}
```

## Benefits

- **No Flash of English**: Components render in the correct language immediately
- **Consistent on Reload**: Page reloads maintain the organization's language
- **Better UX**: Users don't see the UI switching languages after load
- **Proper Initialization**: i18n starts with the correct language from the beginning

## Testing

To verify the fix:

1. **Set Organization Language**:
   - Log into Super Admin UI
   - Edit an organization and set Language to "French" (fr-FR)
   - Save changes

2. **Test Initial Load**:
   - Log into OrgAdmin UI with a user from that organization
   - Verify the UI displays in French immediately
   - Check console for: "Initializing i18n with locale: fr-FR"

3. **Test Page Reload** (Critical Test):
   - Press F5 or Ctrl+R to reload the page
   - Verify the UI displays in French immediately (no flash of English)
   - Check console for: "Initializing i18n with locale: fr-FR"
   - Verify module cards show French titles (e.g., "Créateur de formulaires")

4. **Test Navigation**:
   - Navigate to different pages within the app
   - Verify all pages display in French
   - Reload any page and verify it stays in French

## Console Logging

You should see these logs in the correct order:

```
Organization language found: fr-FR
Initializing i18n with locale: fr-FR
```

If you see "Initializing i18n with locale: en-GB" when your organization is set to French, the fix isn't working correctly.

## Files Modified

- `packages/orgadmin-shell/src/App.tsx` - Updated i18n initialization flow to wait for organization data

## Related Documentation

- `docs/ORGANIZATION_LANGUAGE_CONFIGURATION.md` - Complete language configuration guide
- `docs/I18N_MODULE_REGISTRATION_ISSUE.md` - Module translation implementation
- `docs/I18N_MODULE_TRANSLATION_COMPLETION.md` - Translation completion summary

## Impact

This fix ensures a seamless multilingual experience for all OrgAdmin users. Organizations configured with non-English languages will now see their language consistently applied from the very first render, even on page reloads.
