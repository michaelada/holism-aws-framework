# Manual Testing Checklist - i18n Feature

## Test Date: [To be filled during testing]
## Tester: [To be filled during testing]

## Overview
This checklist covers comprehensive manual testing of the i18n feature across all modules and locales.

## Supported Locales
- [ ] en-GB (English - UK)
- [ ] fr-FR (French - France)
- [ ] es-ES (Spanish - Spain)
- [ ] it-IT (Italian - Italy)
- [ ] de-DE (German - Germany)
- [ ] pt-PT (Portuguese - Portugal)

## 1. Module Testing by Locale

### 1.1 Events Module
Test with each locale:
- [ ] en-GB: Events list page displays correctly
- [ ] en-GB: Create event form labels translated
- [ ] en-GB: Event details page translated
- [ ] en-GB: Date formatting correct (dd/MM/yyyy)
- [ ] en-GB: Currency formatting correct
- [ ] fr-FR: All text translated
- [ ] fr-FR: Date formatting correct
- [ ] fr-FR: Currency formatting correct
- [ ] es-ES: All text translated
- [ ] es-ES: Date formatting correct
- [ ] es-ES: Currency formatting correct
- [ ] it-IT: All text translated
- [ ] it-IT: Date formatting correct
- [ ] it-IT: Currency formatting correct
- [ ] de-DE: All text translated
- [ ] de-DE: Date formatting correct
- [ ] de-DE: Currency formatting correct (€1.234,56)
- [ ] pt-PT: All text translated
- [ ] pt-PT: Date formatting correct
- [ ] pt-PT: Currency formatting correct

### 1.2 Memberships Module
Test with each locale:
- [ ] en-GB: Membership types list translated
- [ ] en-GB: Create membership form translated
- [ ] en-GB: Members database translated
- [ ] en-GB: Date and currency formatting correct
- [ ] fr-FR: All text translated
- [ ] es-ES: All text translated
- [ ] it-IT: All text translated
- [ ] de-DE: All text translated
- [ ] pt-PT: All text translated

### 1.3 Registrations Module
Test with each locale:
- [ ] en-GB: Registration types list translated
- [ ] en-GB: Create registration form translated
- [ ] en-GB: Registrations database translated
- [ ] en-GB: Date and currency formatting correct
- [ ] fr-FR: All text translated
- [ ] es-ES: All text translated
- [ ] it-IT: All text translated
- [ ] de-DE: All text translated
- [ ] pt-PT: All text translated

### 1.4 Calendar Module
Test with each locale:
- [ ] en-GB: Calendars list translated
- [ ] en-GB: Bookings list translated
- [ ] en-GB: Date and time formatting correct
- [ ] fr-FR: All text translated
- [ ] fr-FR: Date and time formatting correct
- [ ] es-ES: All text translated
- [ ] it-IT: All text translated
- [ ] de-DE: All text translated
- [ ] pt-PT: All text translated

### 1.5 Merchandise Module
Test with each locale:
- [ ] en-GB: Merchandise types list translated
- [ ] en-GB: Create merchandise form translated
- [ ] en-GB: Orders list translated
- [ ] en-GB: Currency formatting correct
- [ ] fr-FR: All text translated
- [ ] es-ES: All text translated
- [ ] it-IT: All text translated
- [ ] de-DE: All text translated
- [ ] pt-PT: All text translated

### 1.6 Ticketing Module
Test with each locale:
- [ ] en-GB: Ticketing dashboard translated
- [ ] en-GB: Ticket details translated
- [ ] en-GB: Date and currency formatting correct
- [ ] fr-FR: All text translated
- [ ] es-ES: All text translated
- [ ] it-IT: All text translated
- [ ] de-DE: All text translated
- [ ] pt-PT: All text translated

### 1.7 Forms Module
Test with each locale:
- [ ] en-GB: Forms list translated
- [ ] en-GB: Form builder translated
- [ ] en-GB: Fields list translated
- [ ] fr-FR: All text translated
- [ ] es-ES: All text translated
- [ ] it-IT: All text translated
- [ ] de-DE: All text translated
- [ ] pt-PT: All text translated

### 1.8 Users Module
Test with each locale:
- [ ] en-GB: Users list translated
- [ ] en-GB: User details translated
- [ ] fr-FR: All text translated
- [ ] es-ES: All text translated
- [ ] it-IT: All text translated
- [ ] de-DE: All text translated
- [ ] pt-PT: All text translated

### 1.9 Payments Module
Test with each locale:
- [ ] en-GB: Payments list translated
- [ ] en-GB: Payment details translated
- [ ] en-GB: Lodgements page translated
- [ ] en-GB: Currency formatting correct
- [ ] fr-FR: All text translated
- [ ] es-ES: All text translated
- [ ] it-IT: All text translated
- [ ] de-DE: All text translated
- [ ] pt-PT: All text translated

### 1.10 Reporting Module
Test with each locale:
- [ ] en-GB: Reporting dashboard translated
- [ ] en-GB: Events report translated
- [ ] en-GB: Members report translated
- [ ] en-GB: Revenue report translated
- [ ] en-GB: Date and currency formatting correct
- [ ] fr-FR: All text translated
- [ ] es-ES: All text translated
- [ ] it-IT: All text translated
- [ ] de-DE: All text translated
- [ ] pt-PT: All text translated

### 1.11 Settings Module
Test with each locale:
- [ ] en-GB: Organisation details translated
- [ ] en-GB: Payment settings translated
- [ ] en-GB: Branding tab translated
- [ ] en-GB: Email templates translated
- [ ] fr-FR: All text translated
- [ ] es-ES: All text translated
- [ ] it-IT: All text translated
- [ ] de-DE: All text translated
- [ ] pt-PT: All text translated

## 2. Locale Switching Tests

### 2.1 Between Organizations
- [ ] Create test org type with en-GB locale
- [ ] Create test org type with fr-FR locale
- [ ] Switch between organizations
- [ ] Verify locale updates automatically
- [ ] Verify all text updates without page reload
- [ ] Verify dates update to new locale format
- [ ] Verify currency updates to new locale format

### 2.2 Within Same Organization
- [ ] Navigate to different modules
- [ ] Verify locale persists across navigation
- [ ] Verify no locale reset on page refresh
- [ ] Verify locale maintained in browser session

## 3. Navigation and Layout Tests

### 3.1 Navigation Menu
Test with each locale:
- [ ] en-GB: All menu items translated
- [ ] fr-FR: All menu items translated
- [ ] es-ES: All menu items translated
- [ ] it-IT: All menu items translated
- [ ] de-DE: All menu items translated
- [ ] pt-PT: All menu items translated

### 3.2 Dashboard
Test with each locale:
- [ ] en-GB: Dashboard widgets translated
- [ ] en-GB: Dashboard stats translated
- [ ] fr-FR: All text translated
- [ ] es-ES: All text translated
- [ ] it-IT: All text translated
- [ ] de-DE: All text translated
- [ ] pt-PT: All text translated

## 4. Date and Currency Formatting Tests

### 4.1 Date Formatting
- [ ] en-GB: dd/MM/yyyy format (e.g., 14/02/2026)
- [ ] fr-FR: dd/MM/yyyy format (e.g., 14/02/2026)
- [ ] es-ES: dd/MM/yyyy format (e.g., 14/02/2026)
- [ ] it-IT: dd/MM/yyyy format (e.g., 14/02/2026)
- [ ] de-DE: dd.MM.yyyy format (e.g., 14.02.2026)
- [ ] pt-PT: dd/MM/yyyy format (e.g., 14/02/2026)

### 4.2 Time Formatting
- [ ] en-GB: 24-hour format (e.g., 14:30)
- [ ] fr-FR: 24-hour format (e.g., 14:30)
- [ ] es-ES: 24-hour format (e.g., 14:30)
- [ ] it-IT: 24-hour format (e.g., 14:30)
- [ ] de-DE: 24-hour format (e.g., 14:30)
- [ ] pt-PT: 24-hour format (e.g., 14:30)

### 4.3 Currency Formatting
- [ ] en-GB: €1,234.56 format
- [ ] fr-FR: 1 234,56 € format
- [ ] es-ES: 1.234,56 € format
- [ ] it-IT: 1.234,56 € format
- [ ] de-DE: 1.234,56 € format
- [ ] pt-PT: 1 234,56 € format

## 5. Missing Translations Check

### 5.1 Console Warnings
- [ ] Open browser console
- [ ] Navigate through all modules
- [ ] Verify no "missing translation" warnings
- [ ] Document any missing keys found

### 5.2 Visual Inspection
- [ ] Check for untranslated text (English in non-English locales)
- [ ] Check for translation keys displayed as text
- [ ] Check for empty labels or buttons
- [ ] Document any issues found

## 6. Shared Components Tests

### 6.1 OrgDataTable
- [ ] Column headers translated
- [ ] Action buttons translated
- [ ] Pagination text translated
- [ ] Empty state messages translated

### 6.2 MetadataForm
- [ ] Field labels translated
- [ ] Validation messages translated
- [ ] Help text translated

### 6.3 Date Pickers
- [ ] Month names translated
- [ ] Day names translated
- [ ] Date format correct for locale

### 6.4 File Upload Components
- [ ] Upload button text translated
- [ ] File size messages translated
- [ ] Error messages translated

### 6.5 Payment Widgets
- [ ] Payment status translated
- [ ] Currency amounts formatted correctly
- [ ] Action buttons translated

## 7. Super Admin Interface Tests

### 7.1 Organization Type Configuration
- [ ] Locale field visible in create form
- [ ] Locale field visible in edit form
- [ ] All six locales available in dropdown
- [ ] Locale names displayed correctly (not just codes)
- [ ] Default locale is en-GB
- [ ] Locale saves correctly
- [ ] Locale displays in details page

## 8. Error Handling Tests

### 8.1 Missing Translations
- [ ] Remove a translation key temporarily
- [ ] Verify fallback to English works
- [ ] Verify no application crash
- [ ] Verify console warning in dev mode

### 8.2 Invalid Locale
- [ ] Set invalid locale in database
- [ ] Verify fallback to en-GB
- [ ] Verify application continues functioning

### 8.3 Translation Loading Failure
- [ ] Simulate network error loading translations
- [ ] Verify fallback to English
- [ ] Verify user notification displayed
- [ ] Verify application remains functional

## 9. Accessibility Tests

### 9.1 HTML Lang Attribute
- [ ] Verify lang attribute updates with locale change
- [ ] Test with screen reader (if available)

### 9.2 ARIA Labels
- [ ] Verify ARIA labels are translated
- [ ] Verify ARIA descriptions are translated

## Test Results Summary

### Issues Found
[Document any issues discovered during testing]

### Locales Fully Tested
- [ ] en-GB
- [ ] fr-FR
- [ ] es-ES
- [ ] it-IT
- [ ] de-DE
- [ ] pt-PT

### Modules Fully Tested
- [ ] Events
- [ ] Memberships
- [ ] Registrations
- [ ] Calendar
- [ ] Merchandise
- [ ] Ticketing
- [ ] Forms
- [ ] Users
- [ ] Payments
- [ ] Reporting
- [ ] Settings
- [ ] Navigation/Layout
- [ ] Shared Components

### Overall Status
- [ ] All tests passed
- [ ] Minor issues found (documented above)
- [ ] Major issues found (requires fixes)

### Sign-off
Tester: ___________________
Date: ___________________
