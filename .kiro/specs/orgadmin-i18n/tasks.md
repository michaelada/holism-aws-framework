# Implementation Plan: Internationalization (i18n) Support

## Overview

This implementation plan breaks down the i18n feature into discrete, incremental tasks following a phased approach: backend foundation, frontend infrastructure, pilot module (Events), remaining modules, and validation. Each task builds on previous work, with checkpoints to ensure quality and gather feedback.

## Tasks

- [x] 1. Backend: Database schema and API foundation
  - [x] 1.1 Create migration to add default_locale column to organization_types table
    - Add VARCHAR(10) column with default value 'en-GB'
    - Add check constraint to validate locale format 'xx-XX'
    - Add index on default_locale for query performance
    - _Requirements: 1.3, 1.4_
  
  - [x] 1.2 Extend OrganizationTypeService to handle locale field
    - Update create method to accept optional default_locale parameter
    - Update update method to accept optional default_locale parameter
    - Add validateLocale method to check format and supported locales
    - Implement fallback to 'en-GB' for invalid locales
    - _Requirements: 1.1, 1.2, 1.5, 2.3, 2.4_
  
  - [x] 1.3 Update organization type API routes to include locale
    - Modify POST /api/organization-types to accept default_locale
    - Modify PUT /api/organization-types/:id to accept default_locale
    - Ensure GET /api/organization-types/:id returns default_locale
    - Add validation middleware for locale format
    - _Requirements: 2.2_
  
  - [x] 1.4 Extend OrganizationService to include locale in responses
    - Modify getById to join organization_types and include default_locale
    - Ensure organization response includes organization_type.default_locale
    - _Requirements: 2.1_
  
  - [x] 1.5 Write property tests for backend locale handling
    - **Property 1: Locale Validation** - Test that only supported locales are accepted
    - **Property 2: Locale Persistence Round Trip** - Test create/update/retrieve preserves locale
    - **Property 3: API Response Includes Locale** - Test API responses include locale field
    - _Requirements: 1.2, 1.4, 1.5, 2.1, 2.2, 2.3_
  
  - [x] 1.6 Write unit tests for backend locale edge cases
    - Test default locale is 'en-GB' when not specified
    - Test invalid locale format returns 400 error
    - Test unsupported locale returns 400 error
    - Test fallback to 'en-GB' for corrupted data
    - _Requirements: 1.3, 2.3, 2.4_

- [x] 2. Checkpoint: Backend foundation complete
  - Run all backend tests to ensure locale storage and retrieval works correctly
  - Verify migration runs successfully
  - Test API endpoints with Postman/curl to confirm locale field is present
  - Ask user if any questions or issues arise

- [x] 3. Frontend: i18n infrastructure setup
  - [x] 3.1 Install i18n dependencies in orgadmin-shell
    - Install react-i18next, i18next, i18next-browser-languagedetector
    - Install date-fns locales: date-fns/locale/{en-GB,fr,es,it,de,pt}
    - Update package.json and lock file
    - _Requirements: 3.1, 6.3_
  
  - [x] 3.2 Create i18n configuration module
    - Create packages/orgadmin-shell/src/i18n/config.ts
    - Initialize i18next with supported locales
    - Configure fallback to 'en-GB'
    - Set up interpolation and React integration
    - Export initialization function
    - _Requirements: 3.1_
  
  - [x] 3.3 Create translation resource structure
    - Create packages/orgadmin-shell/src/locales/ directory
    - Create subdirectories for each locale: en-GB, fr-FR, es-ES, it-IT, de-DE, pt-PT
    - Create translation.json in each locale directory
    - Add minimal common translations (actions, status, validation)
    - _Requirements: 4.1, 4.5_
  
  - [x] 3.4 Create LocaleContext and provider
    - Create packages/orgadmin-shell/src/context/LocaleContext.tsx
    - Implement LocaleProvider component that wraps app
    - Provide locale state and setLocale function
    - Integrate with i18n to change language
    - Handle loading state during locale changes
    - _Requirements: 3.2, 3.3_
  
  - [x] 3.5 Create useTranslation hook wrapper
    - Create packages/orgadmin-shell/src/hooks/useTranslation.ts
    - Wrap react-i18next's useTranslation hook
    - Provide consistent interface for all modules
    - Export useLocale hook for accessing locale context
    - _Requirements: 3.4, 3.5_
  
  - [x] 3.6 Create date formatting utilities
    - Create packages/orgadmin-shell/src/utils/dateFormatting.ts
    - Implement formatDate, formatTime, formatDateTime functions
    - Create locale map for date-fns locales
    - Implement parseDate with locale support
    - Export getDateFnsLocale helper
    - _Requirements: 6.1, 6.2, 6.5_
  
  - [x] 3.7 Create currency formatting utilities
    - Create packages/orgadmin-shell/src/utils/currencyFormatting.ts
    - Implement formatCurrency using Intl.NumberFormat
    - Implement parseCurrency for locale-aware parsing
    - Handle edge cases (zero, negative, large numbers)
    - _Requirements: 7.1, 7.4_
  
  - [x] 3.8 Write unit tests for i18n infrastructure
    - Test i18n initializes with all six locales
    - Test LocaleContext provides locale to components
    - Test useTranslation hook returns translation function
    - Test date formatting utilities with different locales
    - Test currency formatting utilities with different locales
    - _Requirements: 3.1, 3.2, 3.4, 6.1, 6.2, 7.1_

- [x] 4. Frontend: Integrate i18n into App initialization
  - [x] 4.1 Initialize i18n in App.tsx
    - Import and call i18n initialization in App.tsx
    - Wrap app with LocaleProvider
    - Load organization data and extract locale
    - Pass organization locale to LocaleProvider
    - _Requirements: 3.3, 8.1, 8.2_
  
  - [x] 4.2 Update OrganisationContext to handle locale
    - Modify OrganisationContext to extract default_locale from API response
    - Provide locale to LocaleProvider
    - Handle locale changes when switching organizations
    - _Requirements: 8.5_
  
  - [x] 4.3 Write property tests for locale initialization
    - **Property 4: Organization Locale Initialization** - Test locale is set from organization data
    - **Property 11: Locale Persistence Across Navigation** - Test locale persists during navigation
    - **Property 12: Organization Switch Updates Locale** - Test locale updates when switching orgs
    - _Requirements: 3.3, 8.1, 8.4, 8.5_

- [x] 5. Checkpoint: Infrastructure ready for translation
  - Test that i18n is initialized and locale context is available
  - Verify that changing locale in code updates the active language
  - Test date and currency formatting utilities work correctly
  - Ask user if any questions or issues arise

- [-] 6. Pilot Module: Translate Events module
  - [x] 6.1 Extract Events module text into translation keys
    - Audit all text in packages/orgadmin-events/src/
    - Create translation keys following naming convention: events.{feature}.{element}
    - Add English translations to locales/en-GB/translation.json
    - Document all translation keys in a reference file
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.6, 5.7, 5.8, 5.9, 5.10_
  
  - [x] 6.2 Update Events components to use translations
    - Replace hardcoded text with useTranslation hook calls
    - Update EventsListPage with translated text
    - Update CreateEventPage with translated text
    - Update EventActivityForm with translated text
    - Update EventEntryDetailsDialog with translated text
    - _Requirements: 3.5, 4.2_
  
  - [x] 6.3 Update Events date and currency displays
    - Replace date formatting with dateFormatting utilities
    - Replace currency formatting with currencyFormatting utilities
    - Ensure all dates respect active locale
    - Ensure all currency values respect active locale
    - _Requirements: 6.1, 6.2, 7.1_
  
  - [x] 6.4 Create translations for Events in all languages
    - Translate Events keys to French (fr-FR)
    - Translate Events keys to Spanish (es-ES)
    - Translate Events keys to Italian (it-IT)
    - Translate Events keys to German (de-DE)
    - Translate Events keys to Portuguese (pt-PT)
    - _Requirements: 9.2, 9.3, 9.4, 9.5, 9.6_
  
  - [x] 6.5 Write property tests for Events translation
    - **Property 5: Translation Lookup Correctness** - Test correct locale text is returned
    - **Property 6: Translation Fallback to English** - Test fallback for missing translations
    - **Property 8: Locale Change Reactivity** - Test UI updates when locale changes
    - _Requirements: 3.5, 4.2, 4.3, 6.4, 7.3, 8.3_
  
  - [x] 6.6 Write unit tests for Events module i18n
    - Test Events components display translated text
    - Test Events dates format according to locale
    - Test Events currency formats according to locale
    - Test missing translation keys fall back to English
    - _Requirements: 5.1-5.10, 6.1, 6.2, 7.1_

- [x] 7. Checkpoint: Pilot module complete
  - Test Events module with all six locales
  - Verify all text is translated correctly
  - Verify dates and currency format correctly
  - Verify locale switching works without page reload
  - Ask user for feedback on translation quality and approach

- [x] 8. Translate Memberships module
  - [x] 8.1 Extract and translate Memberships module text
    - Audit packages/orgadmin-memberships/src/ for all text
    - Create translation keys: memberships.{feature}.{element}
    - Add translations for all six languages
    - _Requirements: 5.1-5.10, 9.1-9.6_
  
  - [x] 8.2 Update Memberships components to use translations
    - Update MembershipTypesListPage
    - Update CreateSingleMembershipTypePage
    - Update CreateGroupMembershipTypePage
    - Update MembershipTypeDetailsPage
    - Update MembersDatabasePage
    - Update MemberDetailsPage
    - Update MembershipTypeForm
    - Update PersonConfigurationSection
    - Update CreateCustomFilterDialog
    - Replace date and currency formatting
    - _Requirements: 3.5, 4.2, 6.1, 6.2, 7.1_
  
  - [x] 8.3 Write tests for Memberships module i18n
    - Test components display translated text
    - Test date and currency formatting
    - Test locale switching
    - _Requirements: 5.1-5.10, 6.1, 6.2, 7.1_

- [x] 9. Translate Registrations module
  - [x] 9.1 Extract and translate Registrations module text
    - Audit packages/orgadmin-registrations/src/ for all text
    - Create translation keys: registrations.{feature}.{element}
    - Add translations for all six languages
    - _Requirements: 5.1-5.10, 9.1-9.6_
  
  - [x] 9.2 Update Registrations components to use translations
    - Update RegistrationTypesListPage
    - Update CreateRegistrationTypePage
    - Update RegistrationTypeDetailsPage
    - Update RegistrationsDatabasePage
    - Update RegistrationDetailsPage
    - Update RegistrationTypeForm
    - Update BatchOperationsDialog
    - Update CreateCustomFilterDialog
    - Replace date and currency formatting
    - _Requirements: 3.5, 4.2, 6.1, 6.2, 7.1_
  
  - [x] 9.3 Write tests for Registrations module i18n
    - Test components display translated text
    - Test date and currency formatting
    - Test locale switching
    - _Requirements: 5.1-5.10, 6.1, 6.2, 7.1_

- [x] 10. Translate Calendar module
  - [x] 10.1 Extract and translate Calendar module text
    - Audit packages/orgadmin-calendar/src/ for all text
    - Create translation keys: calendar.{feature}.{element}
    - Add translations for all six languages
    - _Requirements: 5.1-5.10, 9.1-9.6_
  
  - [x] 10.2 Update Calendar components to use translations
    - Update CalendarsListPage
    - Update BookingsListPage
    - Update CalendarForm
    - Update CancelBookingDialog
    - Replace date and time formatting (critical for calendar)
    - _Requirements: 3.5, 4.2, 6.1, 6.2, 7.1_
  
  - [x] 10.3 Write tests for Calendar module i18n
    - Test components display translated text
    - Test date and time formatting (especially important)
    - Test locale switching
    - _Requirements: 5.1-5.10, 6.1, 6.2, 7.1_

- [x] 11. Translate Merchandise module
  - [x] 11.1 Extract and translate Merchandise module text
    - Audit packages/orgadmin-merchandise/src/ for all text
    - Create translation keys: merchandise.{feature}.{element}
    - Add translations for all six languages
    - _Requirements: 5.1-5.10, 9.1-9.6_
  
  - [x] 11.2 Update Merchandise components to use translations
    - Update MerchandiseTypesListPage
    - Update CreateMerchandiseTypePage
    - Update MerchandiseTypeDetailsPage
    - Update MerchandiseOrdersListPage
    - Update ImageGalleryUpload
    - Update DeliveryConfigurationSection
    - Update BatchOrderOperationsDialog
    - Replace date and currency formatting
    - _Requirements: 3.5, 4.2, 6.1, 6.2, 7.1_
  
  - [x] 11.3 Write tests for Merchandise module i18n
    - Test components display translated text
    - Test date and currency formatting
    - Test locale switching
    - _Requirements: 5.1-5.10, 6.1, 6.2, 7.1_

- [x] 12. Translate Ticketing module
  - [x] 12.1 Extract and translate Ticketing module text
    - Audit packages/orgadmin-ticketing/src/ for all text
    - Create translation keys: ticketing.{feature}.{element}
    - Add translations for all six languages
    - _Requirements: 5.1-5.10, 9.1-9.6_
  
  - [x] 12.2 Update Ticketing components to use translations
    - Update TicketingDashboardPage
    - Update TicketDetailsDialog
    - Update BatchTicketOperationsDialog
    - Update TicketingStatsCards
    - Replace date and currency formatting
    - _Requirements: 3.5, 4.2, 6.1, 6.2, 7.1_
  
  - [x] 12.3 Write tests for Ticketing module i18n
    - Test components display translated text
    - Test date and currency formatting
    - Test locale switching
    - _Requirements: 5.1-5.10, 6.1, 6.2, 7.1_

- [x] 13. Checkpoint: Feature modules complete
  - Test all feature modules with all six locales
  - Verify translation consistency across modules
  - Verify date and currency formatting is consistent
  - Ask user if any questions or issues arise

- [x] 14. Translate Core modules (Forms, Users, Payments, Reporting, Settings)
  - [x] 14.1 Extract and translate Forms module text
    - Audit packages/orgadmin-core/src/forms/ for all text
    - Create translation keys: forms.{feature}.{element}
    - Add translations for all six languages
    - Update FormsListPage, FormBuilderPage, FormPreviewPage, FieldsListPage
    - Replace date formatting
    - _Requirements: 5.1-5.10, 9.1-9.6, 3.5, 4.2, 6.1, 6.2_
  
  - [x] 14.2 Extract and translate Users module text
    - Audit packages/orgadmin-core/src/users/ for all text
    - Create translation keys: users.{feature}.{element}
    - Add translations for all six languages
    - Update OrgAdminUsersListPage, AccountUsersListPage, UserDetailsPage
    - Replace date formatting
    - _Requirements: 5.1-5.10, 9.1-9.6, 3.5, 4.2, 6.1, 6.2_
  
  - [x] 14.3 Extract and translate Payments module text
    - Audit packages/orgadmin-core/src/payments/ for all text
    - Create translation keys: payments.{feature}.{element}
    - Add translations for all six languages
    - Update PaymentsListPage, PaymentDetailsPage, LodgementsPage
    - Replace date and currency formatting
    - _Requirements: 5.1-5.10, 9.1-9.6, 3.5, 4.2, 6.1, 6.2, 7.1_
  
  - [x] 14.4 Extract and translate Reporting module text
    - Audit packages/orgadmin-core/src/reporting/ for all text
    - Create translation keys: reporting.{feature}.{element}
    - Add translations for all six languages
    - Update ReportingDashboardPage, EventsReportPage, MembersReportPage, RevenueReportPage
    - Replace date and currency formatting
    - _Requirements: 5.1-5.10, 9.1-9.6, 3.5, 4.2, 6.1, 6.2, 7.1_
  
  - [x] 14.5 Extract and translate Settings module text
    - Audit packages/orgadmin-core/src/settings/ for all text
    - Create translation keys: settings.{feature}.{element}
    - Add translations for all six languages
    - Update OrganisationDetailsTab, PaymentSettingsTab, BrandingTab, EmailTemplatesTab
    - Replace date formatting
    - _Requirements: 5.1-5.10, 9.1-9.6, 3.5, 4.2, 6.1, 6.2_
  
  - [x] 14.6 Write tests for Core modules i18n
    - Test Forms module translation and formatting
    - Test Users module translation and formatting
    - Test Payments module translation and formatting
    - Test Reporting module translation and formatting
    - Test Settings module translation and formatting
    - _Requirements: 5.1-5.10, 6.1, 6.2, 7.1_

- [x] 15. Translate shared components
  - [x] 15.1 Extract and translate shared component text
    - Audit packages/components/src/components/ for all text
    - Create translation keys: components.{component}.{element}
    - Add translations for all six languages
    - Update OrgDataTable, MetadataForm, FieldRenderer components
    - Update OrgFileUpload, OrgDatePicker, OrgPaymentWidget components
    - Replace date and currency formatting in components
    - _Requirements: 5.1-5.10, 9.1-9.6, 3.5, 4.2, 6.1, 6.2, 7.1_
  
  - [x] 15.2 Write tests for shared components i18n
    - Test components display translated text
    - Test date and currency formatting in components
    - Test locale switching affects components
    - _Requirements: 5.1-5.10, 6.1, 6.2, 7.1_

- [x] 16. Translate navigation and layout
  - [x] 16.1 Extract and translate navigation text
    - Audit packages/orgadmin-shell/src/components/Layout.tsx
    - Create translation keys: navigation.{item}
    - Add translations for all six languages
    - Update Layout component to use translations
    - _Requirements: 5.1, 9.1-9.6, 3.5_
  
  - [x] 16.2 Extract and translate dashboard text
    - Audit packages/orgadmin-shell/src/pages/DashboardPage.tsx
    - Create translation keys: dashboard.{element}
    - Add translations for all six languages
    - Update DashboardPage to use translations
    - _Requirements: 5.2, 9.1-9.6, 3.5_
  
  - [x] 16.3 Write tests for navigation and layout i18n
    - Test navigation displays translated text
    - Test dashboard displays translated text
    - Test locale switching updates navigation
    - _Requirements: 5.1, 5.2_

- [x] 17. Update Super Admin interface to configure locale
  - [x] 17.1 Add locale field to organization type form
    - Update packages/admin/src/components/TenantList.tsx or relevant form
    - Add locale dropdown with six supported locales
    - Display locale name (e.g., "English (UK)") not just code
    - Set default to 'en-GB'
    - _Requirements: 1.1_
  
  - [x] 17.2 Display locale in organization type details
    - Update packages/admin/src/pages/TenantDetailsPage.tsx
    - Show current locale for organization type
    - Allow editing locale
    - _Requirements: 1.1_
  
  - [x] 17.3 Write tests for Super Admin locale configuration
    - Test locale field appears in form
    - Test locale can be set and updated
    - Test locale displays in details page
    - _Requirements: 1.1_

- [x] 18. Checkpoint: All modules translated
  - Test entire application with all six locales
  - Verify all text is translated
  - Verify dates and currency format correctly everywhere
  - Verify no console warnings for missing translations
  - Ask user if any questions or issues arise

- [x] 19. Error handling and graceful degradation
  - [x] 19.1 Implement error handling for translation loading
    - Add try-catch around translation resource loading
    - Fall back to English if loading fails
    - Display non-intrusive notification to user
    - Log errors for debugging
    - _Requirements: 10.5_
  
  - [x] 19.2 Implement missing translation handling
    - Configure i18n to log missing keys in development
    - Ensure missing keys fall back to English
    - Ensure ultimate fallback displays key itself
    - Verify no crashes occur with missing translations
    - _Requirements: 4.3, 4.4, 9.7, 10.1, 10.2, 10.3, 10.4_
  
  - [x] 19.3 Implement error handling for date/currency formatting
    - Add try-catch around date formatting calls
    - Add try-catch around currency formatting calls
    - Fall back to raw values if formatting fails
    - Log formatting errors
    - _Requirements: Error Handling section_
  
  - [x] 19.4 Write property tests for error handling
    - **Property 13: Graceful Handling of Missing Translations** - Test no crashes with missing keys
    - Test application continues functioning with partial translations
    - Test fallback chain works correctly
    - _Requirements: 10.3, 10.4_

- [x] 20. Property-based testing for date and currency
  - [x] 20.1 Write property tests for date formatting
    - **Property 7: Date and Time Formatting by Locale** - Test different locales produce different formats
    - **Property 9: Date Parsing by Locale** - Test round-trip parsing and formatting
    - _Requirements: 6.1, 6.2, 6.5_
  
  - [x] 20.2 Write property tests for currency formatting
    - **Property 10: Currency Formatting by Locale** - Test different locales produce different formats
    - Test currency code preservation across formatting
    - _Requirements: 7.1, 7.4_

- [x] 21. Performance optimization
  - [x] 21.1 Implement lazy loading for translation resources
    - Configure i18n to load translations on demand
    - Cache loaded translations in memory
    - Measure and optimize bundle size
    - _Requirements: Performance Considerations section_
  
  - [x] 21.2 Implement memoization for formatting functions
    - Memoize date formatting results
    - Memoize currency formatting results
    - Measure performance improvement
    - _Requirements: Performance Considerations section_

- [x] 22. Accessibility improvements
  - [x] 22.1 Update HTML lang attribute dynamically
    - Update document.documentElement.lang when locale changes
    - Ensure screen readers announce language correctly
    - _Requirements: Accessibility Considerations section_
  
  - [x] 22.2 Translate ARIA labels and descriptions
    - Audit all ARIA attributes for hardcoded text
    - Extract ARIA text into translation keys
    - Update components to use translated ARIA text
    - _Requirements: Accessibility Considerations section_

- [x] 23. Final validation and testing
  - [x] 23.1 Comprehensive manual testing
    - Test all modules with all six locales
    - Test locale switching between organizations
    - Test navigation maintains locale
    - Test date and currency formatting in all contexts
    - Verify no missing translations
    - _Requirements: All requirements_
  
  - [x] 23.2 Translation quality review
    - Review all translations for accuracy
    - Check for consistent terminology within each language
    - Verify cultural appropriateness
    - Fix any translation issues
    - _Requirements: 9.8_
  
  - [x] 23.3 Run full test suite
    - Run all unit tests
    - Run all property tests
    - Run integration tests
    - Run E2E tests with different locales
    - Ensure all tests pass
    - _Requirements: All requirements_
  
  - [x] 23.4 Performance testing
    - Measure initial load time with i18n
    - Measure locale switching performance
    - Measure memory usage with all translations loaded
    - Optimize if necessary
    - _Requirements: Performance Considerations section_

- [x] 24. Final checkpoint and documentation
  - Ensure all tests pass
  - Verify all six locales work correctly
  - Document any known limitations or future improvements
  - Ask user for final approval before considering feature complete

## Notes

- All tasks including tests are required for comprehensive implementation
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation and user feedback
- Property tests validate universal correctness properties with minimum 100 iterations
- Unit tests validate specific examples and edge cases
- Translation work is broken down by module for manageable scope
- Backend changes are completed first to enable frontend development
- Events module serves as pilot to validate approach before scaling to other modules
