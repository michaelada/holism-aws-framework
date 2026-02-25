# Organization Language Configuration

## Overview

Organizations can now have their own language settings that will automatically apply to the OrgAdmin UI when users log in.

## Changes Made

### 1. Backend Changes

#### Type Definitions
- Updated `UpdateOrganizationDto` to include `currency` and `language` fields
- Updated `CreateOrganizationDto` to include `currency` and `language` fields

#### API Endpoints
- `/api/orgadmin/auth/me` - Returns organization data including `language` field
- `/api/admin/organizations/:id` - Update endpoint now accepts `language` and `currency` fields

### 2. Frontend Changes (Super Admin UI)

#### EditOrganizationPage
- Added Language dropdown with options:
  - English (UK) - `en-GB`
  - English (US) - `en-US`
  - French (France) - `fr-FR`
  - German (Germany) - `de-DE`
  - Spanish (Spain) - `es-ES`
  - Italian (Italy) - `it-IT`
  - Portuguese (Portugal) - `pt-PT`

- Added Currency dropdown with options:
  - British Pound (£) - `GBP`
  - US Dollar ($) - `USD`
  - Euro (€) - `EUR`
  - Australian Dollar (A$) - `AUD`
  - Canadian Dollar (C$) - `CAD`
  - New Zealand Dollar (NZ$) - `NZD`

#### CreateOrganizationPage
- Same language and currency dropdowns as EditOrganizationPage
- Default values: `en-GB` and `GBP`

### 3. Frontend Changes (OrgAdmin UI)

#### App.tsx
- Updated to read `organisation.language` field
- Falls back to `organisation.organizationType.defaultLocale` if language not set
- Finally falls back to `en-GB` if neither is available
- Passes the language to `LocaleProvider` which handles i18n

#### LocaleContext
- Already had support for `organizationLocale` prop
- Automatically switches language when organization locale changes
- Preloads translations for better performance

## How It Works

1. **Super Admin sets language**: 
   - Navigate to Organizations → Select Organization → Edit
   - Change the Language dropdown to desired language (e.g., French)
   - Save changes

2. **Backend stores language**:
   - Language is stored in the `organizations` table in the `language` column
   - Updates are immediately available via API

3. **OrgAdmin UI loads language**:
   - When user logs in, `/api/orgadmin/auth/me` returns organization data including `language`
   - App.tsx extracts the language and passes it to LocaleProvider
   - LocaleProvider loads the appropriate translation file
   - i18n switches to the organization's language
   - All UI text is displayed in the organization's language

## Troubleshooting

### Issue: UI Reverts to English on Page Reload

**Symptom**: When you reload the page (F5 or Ctrl+R), the UI briefly shows English before switching to the organization's language, or stays in English.

**Root Cause**: The i18n system was being initialized with the default locale (`en-GB`) before the organization data was available, causing components to render in English first.

**Solution Implemented**: The i18n initialization now waits for the organization data and initializes with the correct language from the start. The fix ensures:
- i18n is initialized with the organization's language BEFORE components render
- The `i18nInitialized` flag prevents re-initialization on subsequent renders
- Components always render in the correct language, even on page reload

**Code Changes** (in `App.tsx`):
```typescript
// Initialize i18n with the organization's locale
useEffect(() => {
  const initI18n = async () => {
    console.log('Initializing i18n with locale:', organizationLocale);
    await initializeI18n(organizationLocale);
    setI18nReady(true);
    setI18nInitialized(true);
  };
  
  // Only initialize once when we have the organization locale
  if (organizationLocale && !i18nInitialized) {
    initI18n();
  }
}, [organizationLocale, i18nInitialized]);
```

### Language not changing after update

1. **Clear browser cache**:
   ```
   Hard refresh: Ctrl+Shift+R (Windows/Linux) or Cmd+Shift+R (Mac)
   ```

2. **Check browser console**:
   - Open Developer Tools (F12)
   - Look for console logs showing:
     - "Organization language found: fr-FR"
     - Or "Using organizationType defaultLocale: en-GB"
     - Or "Falling back to en-GB"

3. **Verify backend data**:
   - Check the API response from `/api/orgadmin/auth/me`
   - Ensure the `organisation.language` field contains the correct value

4. **Rebuild frontend** (if code changes were made):
   ```bash
   cd packages/orgadmin-shell
   npm run build
   ```

5. **Restart Docker containers**:
   ```bash
   docker-compose restart orgadmin
   ```

### Checking the database directly

```sql
SELECT id, name, display_name, language, currency 
FROM organizations 
WHERE name = 'your-org-name';
```

### Verifying API response

```bash
# Get auth token from browser (check Network tab in DevTools)
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:3000/api/orgadmin/auth/me
```

Look for the `language` field in the `organisation` object.

## Supported Languages

The system currently supports the following languages:

| Language | Code | Translation File |
|----------|------|------------------|
| English (UK) | en-GB | `/locales/en-GB/translation.json` |
| English (US) | en-US | `/locales/en-US/translation.json` |
| French | fr-FR | `/locales/fr-FR/translation.json` |
| German | de-DE | `/locales/de-DE/translation.json` |
| Spanish | es-ES | `/locales/es-ES/translation.json` |
| Italian | it-IT | `/locales/it-IT/translation.json` |
| Portuguese | pt-PT | `/locales/pt-PT/translation.json` |

## Adding New Languages

To add a new language:

1. Create translation file:
   ```
   packages/orgadmin-shell/src/locales/[LOCALE]/translation.json
   ```

2. Add to supported locales in `i18n/config.ts`:
   ```typescript
   export const SUPPORTED_LOCALES = [
     'en-GB',
     'fr-FR',
     // ... existing locales
     'ja-JP', // Add new locale
   ] as const;
   ```

3. Add to language dropdown in Super Admin UI:
   ```typescript
   const LANGUAGES = [
     // ... existing languages
     { code: 'ja-JP', label: 'Japanese (Japan)' },
   ];
   ```

4. Ensure all translation keys are present in the new translation file

## Testing

### Test Scenario 1: Change language for existing organization

1. Log in to Super Admin UI
2. Navigate to Organizations
3. Click on an organization
4. Click "Edit"
5. Change Language to "French (France)"
6. Click "Update Organisation"
7. Log out of Super Admin
8. Log in to OrgAdmin UI as a user from that organization
9. Verify UI is displayed in French

### Test Scenario 2: Create new organization with specific language

1. Log in to Super Admin UI
2. Navigate to Organizations
3. Click "Create Organisation"
4. Fill in organization details
5. Set Language to "Spanish (Spain)"
6. Set Currency to "Euro (€)"
7. Click "Create Organisation"
8. Create an admin user for the organization
9. Log in to OrgAdmin UI as that user
10. Verify UI is displayed in Spanish

### Test Scenario 3: Fallback behavior

1. Create organization without setting language (or set to null in database)
2. Log in to OrgAdmin UI
3. Verify UI falls back to organization type's default locale
4. If that's also not set, verify it falls back to English (UK)

## Architecture

```
┌─────────────────┐
│  Super Admin UI │
│  (Edit Org)     │
└────────┬────────┘
         │ PUT /api/admin/organizations/:id
         │ { language: "fr-FR" }
         ▼
┌─────────────────┐
│   Backend API   │
│  (Update DB)    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   PostgreSQL    │
│  organizations  │
│  table          │
└────────┬────────┘
         │
         │ GET /api/orgadmin/auth/me
         ▼
┌─────────────────┐
│  OrgAdmin UI    │
│  (Login)        │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  LocaleProvider │
│  (Load i18n)    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  UI in French   │
└─────────────────┘
```

## Related Files

### Backend
- `packages/backend/src/services/organization.service.ts` - Organization CRUD operations
- `packages/backend/src/routes/orgadmin-auth.routes.ts` - Auth/me endpoint
- `packages/backend/src/types/organization.types.ts` - Type definitions

### Super Admin UI
- `packages/admin/src/pages/EditOrganizationPage.tsx` - Edit organization page
- `packages/admin/src/pages/CreateOrganizationPage.tsx` - Create organization page
- `packages/admin/src/types/organization.types.ts` - Type definitions

### OrgAdmin UI
- `packages/orgadmin-shell/src/App.tsx` - Main app component
- `packages/orgadmin-shell/src/context/LocaleContext.tsx` - Locale management
- `packages/orgadmin-shell/src/i18n/config.ts` - i18n configuration
- `packages/orgadmin-shell/src/locales/*/translation.json` - Translation files

## Future Enhancements

1. **User-level language preference**: Allow individual users to override organization language
2. **Dynamic language switching**: Add language selector in OrgAdmin UI
3. **Translation management UI**: Allow admins to edit translations
4. **RTL language support**: Add support for right-to-left languages (Arabic, Hebrew)
5. **Date/time formatting**: Ensure dates and times are formatted according to locale
6. **Number formatting**: Format numbers, currencies according to locale
7. **Pluralization**: Handle plural forms correctly for each language
