# Design Document: Internationalization (i18n) Support

## Overview

This design implements comprehensive internationalization support for the orgadmin system using react-i18next, the industry-standard i18n framework for React applications. The solution enables organization-level language configuration through a backend locale field and provides seamless frontend translation support across all user-facing text, dates, and currency formats.

The architecture follows a centralized configuration approach where the orgadmin-shell package initializes and manages i18n infrastructure, making translations available to all feature modules through React context and hooks. Translation resources are organized by locale in JSON files, with automatic fallback to English for missing translations.

## Architecture

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│         Super Admin Interface (packages/admin)               │
│              Organization Type Configuration                 │
└───────────────────────────┬─────────────────────────────────┘
                            │ Sets default_locale
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                    Backend (PostgreSQL)                      │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  organization_types table                            │  │
│  │  - id, name, capabilities, default_locale            │  │
│  └──────────────────────────────────────────────────────┘  │
└───────────────────────────┬─────────────────────────────────┘
                            │ Returns locale in API response
                            ↓
┌─────────────────────────────────────────────────────────────┐
│              Orgadmin Frontend (React)                       │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  orgadmin-shell (i18n initialization)                │  │
│  │  - i18n config                                       │  │
│  │  - LocaleContext provider                            │  │
│  │  - useTranslation hook wrapper                       │  │
│  └────────────────┬─────────────────────────────────────┘  │
│                   │ Provides translations                   │
│                   ↓                                          │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Feature Modules                                     │  │
│  │  - orgadmin-events                                   │  │
│  │  - orgadmin-memberships                              │  │
│  │  - orgadmin-core (forms, users, payments, etc.)     │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            │
                            ↓
┌─────────────────────────────────────────────────────────────┐
│              Translation Resources                           │
│  locales/                                                    │
│    ├── en-GB/translation.json                               │
│    ├── fr-FR/translation.json                               │
│    ├── es-ES/translation.json                               │
│    ├── it-IT/translation.json                               │
│    ├── de-DE/translation.json                               │
│    └── pt-PT/translation.json                               │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow

1. **Configuration Phase**: Super admin sets default_locale on organization_types table
2. **Authentication Phase**: User logs in, frontend fetches organization details including locale
3. **Initialization Phase**: orgadmin-shell initializes i18n with the organization's locale
4. **Runtime Phase**: Components use useTranslation hook to access localized text
5. **Rendering Phase**: All text, dates, and currency values display in the active locale

## Components and Interfaces

### Backend Components

#### Database Schema Extension

```typescript
// Migration: Add default_locale to organization_types table
interface OrganizationTypeMigration {
  up: () => Promise<void>;  // Add default_locale column (VARCHAR(10), default 'en-GB')
  down: () => Promise<void>; // Remove default_locale column
}
```

#### Organization Type Service (Existing - To Be Extended)

The existing `OrganizationTypeService` in `packages/backend/src/services/organization-type.service.ts` will be extended to handle locale:

```typescript
interface OrganizationTypeService {
  // Create organization type with locale
  create(data: {
    name: string;
    capabilities: string[];
    default_locale?: string; // Optional, defaults to 'en-GB'
  }): Promise<OrganizationType>;
  
  // Update organization type locale
  update(id: string, data: {
    name?: string;
    capabilities?: string[];
    default_locale?: string;
  }): Promise<OrganizationType>;
  
  // Get organization type with locale
  getById(id: string): Promise<OrganizationType>;
  
  // Validate locale format
  validateLocale(locale: string): boolean; // Returns true if format is 'xx-XX'
}

interface OrganizationType {
  id: string;
  name: string;
  capabilities: string[];
  default_locale: string; // e.g., 'en-GB', 'fr-FR'
  created_at: Date;
  updated_at: Date;
}
```

#### Organization Service (Existing - To Be Extended)

The existing `OrganizationService` in `packages/backend/src/services/organization.service.ts` will be extended to include locale in responses:

```typescript
interface OrganizationService {
  // Get organization with locale from organization type
  getById(id: string): Promise<OrganizationWithLocale>;
}

interface OrganizationWithLocale {
  id: string;
  name: string;
  organization_type_id: string;
  organization_type: {
    id: string;
    name: string;
    default_locale: string; // Included in response
  };
  // ... other fields
}
```

### Frontend Components

#### i18n Configuration (orgadmin-shell)

```typescript
// packages/orgadmin-shell/src/i18n/config.ts
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

interface I18nConfig {
  supportedLocales: string[]; // ['en-GB', 'fr-FR', 'es-ES', 'it-IT', 'de-DE', 'pt-PT']
  defaultLocale: string; // 'en-GB'
  fallbackLocale: string; // 'en-GB'
  resources: Record<string, { translation: Record<string, any> }>;
}

function initializeI18n(config: I18nConfig): void {
  i18n
    .use(initReactI18next)
    .use(LanguageDetector)
    .init({
      resources: config.resources,
      lng: config.defaultLocale,
      fallbackLng: config.fallbackLocale,
      supportedLngs: config.supportedLocales,
      interpolation: {
        escapeValue: false, // React already escapes
      },
      react: {
        useSuspense: false, // Avoid suspense for better UX
      },
    });
}
```

#### Locale Context Provider

```typescript
// packages/orgadmin-shell/src/context/LocaleContext.tsx
interface LocaleContextValue {
  locale: string; // Current active locale
  setLocale: (locale: string) => void; // Change locale
  isLoading: boolean; // Loading state during locale change
}

interface LocaleProviderProps {
  children: React.ReactNode;
  organizationLocale?: string; // From API
}

function LocaleProvider({ children, organizationLocale }: LocaleProviderProps): JSX.Element {
  // Initialize with organization locale or default to 'en-GB'
  // Update i18n when locale changes
  // Provide context value to children
}

function useLocale(): LocaleContextValue {
  // Hook to access locale context
}
```

#### Translation Hook Wrapper

```typescript
// packages/orgadmin-shell/src/hooks/useTranslation.ts
import { useTranslation as useI18nextTranslation } from 'react-i18next';

interface TranslationFunction {
  (key: string, options?: Record<string, any>): string;
}

interface UseTranslationResult {
  t: TranslationFunction; // Translation function
  i18n: {
    language: string; // Current language
    changeLanguage: (lng: string) => Promise<void>;
  };
  ready: boolean; // Whether translations are loaded
}

function useTranslation(namespace?: string): UseTranslationResult {
  // Wrapper around react-i18next's useTranslation
  // Provides consistent interface across all modules
}
```

#### Date Formatting Utilities

```typescript
// packages/orgadmin-shell/src/utils/dateFormatting.ts
import { format, parse } from 'date-fns';
import { enGB, fr, es, it, de, pt } from 'date-fns/locale';

interface DateFormattingUtils {
  // Format date according to locale
  formatDate(date: Date, formatString: string, locale: string): string;
  
  // Format time according to locale
  formatTime(date: Date, locale: string): string;
  
  // Format datetime according to locale
  formatDateTime(date: Date, locale: string): string;
  
  // Parse date string according to locale
  parseDate(dateString: string, formatString: string, locale: string): Date;
  
  // Get date-fns locale object
  getDateFnsLocale(locale: string): Locale;
}

const localeMap: Record<string, Locale> = {
  'en-GB': enGB,
  'fr-FR': fr,
  'es-ES': es,
  'it-IT': it,
  'de-DE': de,
  'pt-PT': pt,
};
```

#### Currency Formatting Utilities

```typescript
// packages/orgadmin-shell/src/utils/currencyFormatting.ts
interface CurrencyFormattingUtils {
  // Format currency according to locale
  formatCurrency(
    amount: number,
    currency: string, // 'EUR', 'GBP', 'USD'
    locale: string
  ): string;
  
  // Parse currency string to number
  parseCurrency(currencyString: string, locale: string): number;
}

function formatCurrency(amount: number, currency: string, locale: string): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currency,
  }).format(amount);
}
```

## Data Models

### Translation Resource Structure

Translation files follow a nested JSON structure organized by feature area:

```json
{
  "common": {
    "actions": {
      "save": "Save",
      "cancel": "Cancel",
      "delete": "Delete",
      "edit": "Edit",
      "create": "Create",
      "search": "Search",
      "filter": "Filter",
      "export": "Export",
      "import": "Import"
    },
    "status": {
      "active": "Active",
      "inactive": "Inactive",
      "pending": "Pending",
      "completed": "Completed"
    },
    "validation": {
      "required": "This field is required",
      "invalidEmail": "Please enter a valid email address",
      "invalidDate": "Please enter a valid date",
      "minLength": "Must be at least {{min}} characters",
      "maxLength": "Must be no more than {{max}} characters"
    }
  },
  "navigation": {
    "dashboard": "Dashboard",
    "events": "Events",
    "memberships": "Memberships",
    "registrations": "Registrations",
    "calendar": "Calendar",
    "merchandise": "Merchandise",
    "ticketing": "Ticketing",
    "forms": "Forms",
    "users": "Users",
    "payments": "Payments",
    "reporting": "Reporting",
    "settings": "Settings"
  },
  "events": {
    "title": "Events",
    "createEvent": "Create Event",
    "eventDetails": "Event Details",
    "eventName": "Event Name",
    "eventDate": "Event Date",
    "eventLocation": "Event Location",
    "eventDescription": "Event Description",
    "activities": "Activities",
    "entries": "Entries",
    "noEventsFound": "No events found"
  },
  "memberships": {
    "title": "Memberships",
    "membershipTypes": "Membership Types",
    "members": "Members",
    "createMembershipType": "Create Membership Type",
    "memberDetails": "Member Details",
    "membershipStatus": "Membership Status",
    "renewalDate": "Renewal Date",
    "noMembersFound": "No members found"
  }
  // ... additional feature areas
}
```

### Locale Configuration Model

```typescript
interface LocaleConfig {
  code: string; // 'en-GB', 'fr-FR', etc.
  name: string; // 'English (UK)', 'Français (France)', etc.
  direction: 'ltr' | 'rtl'; // Text direction (all supported locales are LTR)
  dateFormat: string; // Default date format for locale
  timeFormat: string; // Default time format for locale
  currencyPosition: 'before' | 'after'; // Currency symbol position
}

const supportedLocales: LocaleConfig[] = [
  {
    code: 'en-GB',
    name: 'English (UK)',
    direction: 'ltr',
    dateFormat: 'dd/MM/yyyy',
    timeFormat: 'HH:mm',
    currencyPosition: 'before',
  },
  {
    code: 'fr-FR',
    name: 'Français (France)',
    direction: 'ltr',
    dateFormat: 'dd/MM/yyyy',
    timeFormat: 'HH:mm',
    currencyPosition: 'after',
  },
  // ... other locales
];
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*


### Property 1: Locale Validation

*For any* locale string, the system should accept it if and only if it matches one of the six supported locale codes: 'en-GB', 'fr-FR', 'es-ES', 'it-IT', 'de-DE', 'pt-PT'.

**Validates: Requirements 1.2, 2.3**

### Property 2: Locale Persistence Round Trip

*For any* organization type with a valid locale, creating or updating the organization type with that locale and then retrieving it should return the same locale value.

**Validates: Requirements 1.4, 1.5**

### Property 3: API Response Includes Locale

*For any* organization or organization type retrieved via API, the response should include the default_locale field with a valid locale value.

**Validates: Requirements 2.1, 2.2**

### Property 4: Organization Locale Initialization

*For any* organization with a configured locale, when the frontend loads that organization's data, the active i18n locale should be set to match the organization's default_locale.

**Validates: Requirements 3.3, 8.1**

### Property 5: Translation Lookup Correctness

*For any* translation key that exists in the active locale's translation file, requesting that translation should return the text from the active locale, not from any other locale.

**Validates: Requirements 3.5, 4.2**

### Property 6: Translation Fallback to English

*For any* translation key that exists in English but not in the active locale, requesting that translation should return the English text.

**Validates: Requirements 4.3, 10.1**

### Property 7: Date and Time Formatting by Locale

*For any* date and time value, formatting it with different locales should produce different formatted strings that conform to each locale's conventions (e.g., dd/MM/yyyy for en-GB vs MM/dd/yyyy for en-US style locales).

**Validates: Requirements 6.1, 6.2**

### Property 8: Locale Change Reactivity

*For any* displayed content (text, dates, currency), when the active locale changes, all displayed values should update to reflect the new locale without requiring a page reload or navigation.

**Validates: Requirements 6.4, 7.3, 8.3**

### Property 9: Date Parsing by Locale

*For any* valid date string formatted according to a specific locale's conventions, parsing it with that locale should produce a valid Date object, and formatting that Date object back with the same locale should produce an equivalent string (round-trip property).

**Validates: Requirements 6.5**

### Property 10: Currency Formatting by Locale

*For any* numeric amount and currency code, formatting it with different locales should produce different formatted strings (e.g., "€1.234,56" for de-DE vs "€1,234.56" for en-GB), but the underlying currency code should remain unchanged.

**Validates: Requirements 7.1, 7.4**

### Property 11: Locale Persistence Across Navigation

*For any* active locale set during a user session, navigating between different pages within the application should maintain the same active locale without reverting to the default.

**Validates: Requirements 8.4**

### Property 12: Organization Switch Updates Locale

*For any* two organizations with different configured locales, when a user switches from one organization to the other, the active locale should update to match the new organization's locale.

**Validates: Requirements 8.5**

### Property 13: Graceful Handling of Missing Translations

*For any* translation key (whether it exists or not), requesting that translation should never throw an error or crash the application, and should always return a string (either the translation, the English fallback, or the key itself).

**Validates: Requirements 10.3, 10.4**

## Error Handling

### Backend Error Handling

1. **Invalid Locale Format**: When an invalid locale format is provided (not matching 'xx-XX'), the API should return a 400 Bad Request with a descriptive error message
2. **Unsupported Locale**: When a locale format is valid but not in the supported list, the API should return a 400 Bad Request indicating the locale is not supported
3. **Database Constraint Violations**: If locale storage fails due to database constraints, return a 500 Internal Server Error with appropriate logging
4. **Fallback for Corrupted Data**: If an organization type has an invalid locale stored (data corruption), the API should return 'en-GB' as fallback and log a warning

### Frontend Error Handling

1. **Translation Resource Loading Failure**: If translation files fail to load, fall back to English and display a non-intrusive notification to the user
2. **Missing Translation Keys**: When a translation key is missing, log a warning to console (development mode only) and display the English fallback or the key itself
3. **Invalid Locale from API**: If the API returns an invalid or unsupported locale, fall back to 'en-GB' and log an error
4. **i18n Initialization Failure**: If react-i18next fails to initialize, catch the error, fall back to English, and allow the application to continue functioning
5. **Date/Currency Formatting Errors**: If Intl APIs or date-fns throw errors during formatting, catch the error, log it, and display the raw value with a fallback format

### Error Recovery Strategies

1. **Automatic Fallback Chain**: Missing translation → English translation → Translation key
2. **Graceful Degradation**: Application remains fully functional even with missing translations
3. **User Notification**: Only notify users of critical errors (e.g., failed to load translations), not minor issues (e.g., missing individual keys)
4. **Development Warnings**: In development mode, log all missing translations to help developers identify gaps
5. **Production Silence**: In production mode, silently fall back without console warnings to avoid noise

## Testing Strategy

### Dual Testing Approach

This feature requires both unit tests and property-based tests to ensure comprehensive coverage:

- **Unit tests**: Verify specific examples (e.g., English fallback for a specific missing key), edge cases (e.g., empty translation files), and integration points (e.g., API responses include locale field)
- **Property tests**: Verify universal properties across all inputs (e.g., any valid locale persists correctly, any translation key never crashes the system)

Together, these approaches provide comprehensive coverage where unit tests catch concrete bugs and property tests verify general correctness across the wide range of possible inputs (different locales, translation keys, dates, currency values).

### Property-Based Testing

All correctness properties should be implemented using property-based testing with a minimum of 100 iterations per test. We will use:
- **Backend**: fast-check (TypeScript property-based testing library)
- **Frontend**: fast-check with React Testing Library

Each property test must include a comment tag referencing the design document property:
```typescript
// Feature: orgadmin-i18n, Property 2: Locale Persistence Round Trip
```

### Unit Testing Focus Areas

1. **Backend API Tests**:
   - Test that organization type creation with locale stores correctly
   - Test that organization type update with locale persists
   - Test that organization retrieval includes locale from organization type
   - Test validation rejects invalid locale formats
   - Test default locale is 'en-GB' when not specified

2. **Frontend i18n Configuration Tests**:
   - Test that i18n initializes with all six supported locales
   - Test that LocaleContext provides current locale to components
   - Test that useTranslation hook returns translation function
   - Test that translation files exist for all supported locales

3. **Frontend Component Tests**:
   - Test that components display translated text
   - Test that date components format dates according to locale
   - Test that currency components format amounts according to locale
   - Test that locale changes trigger re-renders with new translations

4. **Integration Tests**:
   - Test full flow: login → load organization → set locale → display translated UI
   - Test organization switching updates locale
   - Test navigation maintains locale across pages

### Test Data Strategy

1. **Locale Test Data**: Use all six supported locales in tests
2. **Translation Test Data**: Create minimal translation files with known keys for testing
3. **Date Test Data**: Use various dates including edge cases (leap years, month boundaries, different timezones)
4. **Currency Test Data**: Use various amounts including edge cases (zero, negative, very large numbers, many decimal places)
5. **Organization Test Data**: Create test organizations with different locales

### Testing Tools and Libraries

- **Backend**: Jest, Supertest, fast-check
- **Frontend**: Jest, React Testing Library, fast-check, @testing-library/user-event
- **E2E**: Playwright (for testing full user flows with locale switching)

## Implementation Notes

### Migration Strategy

1. **Phase 1: Backend Foundation**
   - Add default_locale column to organization_types table
   - Update organization type service to handle locale
   - Update API responses to include locale
   - Deploy backend changes

2. **Phase 2: Frontend Infrastructure**
   - Install react-i18next and dependencies
   - Create i18n configuration in orgadmin-shell
   - Create LocaleContext and useTranslation hook
   - Create date and currency formatting utilities
   - Test infrastructure with minimal translations

3. **Phase 3: Pilot Module (Events)**
   - Extract all text from Events module into translation keys
   - Create English translations for Events module
   - Update Events components to use useTranslation hook
   - Test Events module with locale switching
   - Create translations for other five languages

4. **Phase 4: Remaining Modules**
   - Repeat Phase 3 process for each module:
     - Memberships
     - Registrations
     - Calendar
     - Merchandise
     - Ticketing
     - Forms
     - Users
     - Payments
     - Reporting
     - Settings
   - One module at a time to manage scope

5. **Phase 5: Validation and Polish**
   - Review all translations for completeness
   - Test all modules with all six locales
   - Fix any formatting or display issues
   - Performance testing with locale switching
   - User acceptance testing

### Translation Key Naming Conventions

Use a hierarchical naming structure:
- `{module}.{feature}.{element}` for specific elements
- `common.{category}.{element}` for shared elements

Examples:
- `events.createEvent.title` → "Create Event"
- `common.actions.save` → "Save"
- `memberships.memberDetails.renewalDate` → "Renewal Date"
- `common.validation.required` → "This field is required"

### Performance Considerations

1. **Lazy Loading**: Load translation files on demand rather than all at once
2. **Caching**: Cache loaded translations in memory to avoid repeated fetches
3. **Bundle Size**: Keep translation files separate from main bundle to reduce initial load time
4. **Memoization**: Memoize formatted dates and currency values to avoid repeated formatting
5. **Suspense Boundaries**: Use React Suspense to handle translation loading states gracefully

### Accessibility Considerations

1. **Language Attribute**: Update HTML lang attribute when locale changes
2. **Screen Readers**: Ensure translated text is properly announced by screen readers
3. **RTL Support**: While current locales are all LTR, design system to support RTL in future
4. **Keyboard Navigation**: Ensure locale switching (if manual) is keyboard accessible
5. **ARIA Labels**: Translate all ARIA labels and descriptions

### Security Considerations

1. **Input Validation**: Strictly validate locale values to prevent injection attacks
2. **XSS Prevention**: Ensure translation interpolation doesn't allow script injection
3. **Resource Access**: Validate translation file paths to prevent directory traversal
4. **API Security**: Ensure locale changes don't bypass authorization checks
5. **Audit Logging**: Log locale changes for security audit trails
