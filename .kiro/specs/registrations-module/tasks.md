# Implementation Plan: Registrations Module

## Overview

This implementation creates the registrations module frontend package (`packages/orgadmin-registrations`) with full page implementations, navigation integration, discount support, and feature parity with the memberships module's core workflows. The backend API is already implemented; this plan focuses on frontend pages, components, module registration updates, and discount integration.

## Tasks

- [x] 1. Update module registration with sub-menu items and discount routes
  - [x] 1.1 Update `packages/orgadmin-registrations/src/index.ts` to add sub-menu items
    - Import `LocalOffer as DiscountIcon` from `@mui/icons-material`
    - Replace single `menuItem` with `subMenuItems` array containing:
      - "Registrations Database" → `/registrations` (icon: RegistrationIcon)
      - "Registration Types" → `/registrations/types` (icon: RegistrationIcon)
      - "Discounts" → `/registrations/discounts` (icon: DiscountIcon, capability: `registration-discounts`)
    - _Requirements: 1.4, 1.5, 1.6_

  - [x] 1.2 Add discount routes to module registration
    - Add route `/registrations/discounts` → `DiscountsListPage` (capability: `registration-discounts`)
    - Add route `/registrations/discounts/new` → `CreateDiscountPage` (capability: `registration-discounts`)
    - Add route `/registrations/discounts/:id/edit` → `EditDiscountPage` (capability: `registration-discounts`)
    - _Requirements: 10.1, 10.2, 10.3, 10.9_

  - [x] 1.3 Write unit tests for module registration configuration
    - Test that subMenuItems contains 3 entries
    - Test that Discounts sub-menu item has `capability: 'registration-discounts'`
    - Test that discount routes have `capability: 'registration-discounts'`
    - Test that 9 routes are registered total
    - _Requirements: 1.4, 1.5, 1.6, 10.9_

- [x] 2. Create discount page wrappers
  - [x] 2.1 Create `packages/orgadmin-registrations/src/pages/DiscountsListPage.tsx`
    - Wrapper component rendering `DiscountsListPage` from `@aws-web-framework/orgadmin-events` with `moduleType="registrations"`
    - Follow the same pattern as `packages/orgadmin-memberships/src/pages/DiscountsListPage.tsx`
    - _Requirements: 10.1, 10.4_

  - [x] 2.2 Create `packages/orgadmin-registrations/src/pages/CreateDiscountPage.tsx`
    - Wrapper component rendering `CreateDiscountPage` from `@aws-web-framework/orgadmin-events` with `moduleType="registrations"`
    - _Requirements: 10.2_

  - [x] 2.3 Create `packages/orgadmin-registrations/src/pages/EditDiscountPage.tsx`
    - Wrapper component rendering `CreateDiscountPage` from `@aws-web-framework/orgadmin-events` with `moduleType="registrations"` (edit mode detected from URL param)
    - _Requirements: 10.3_

  - [x] 2.4 Update `packages/orgadmin-registrations/src/index.ts` exports
    - Export DiscountsListPage, CreateDiscountPage, EditDiscountPage
    - _Requirements: 10.1, 10.2, 10.3_

  - [x] 2.5 Write unit tests for discount page wrappers
    - Test DiscountsListPage renders events module page with `moduleType="registrations"`
    - Test CreateDiscountPage renders events module page with `moduleType="registrations"`
    - Test EditDiscountPage renders events module page with `moduleType="registrations"`
    - _Requirements: 10.1, 10.2, 10.3, 10.4_

- [x] 3. Add DiscountSelector to CreateRegistrationTypePage
  - [x] 3.1 Update `packages/orgadmin-registrations/src/pages/CreateRegistrationTypePage.tsx`
    - Import `DiscountSelector` from `@aws-web-framework/components`
    - Import `useCapabilities` from `@aws-web-framework/orgadmin-shell`
    - Add `discountIds: []` to form state
    - Add `fetchDiscounts` function calling `/api/orgadmin/organisations/:orgId/discounts/registrations`
    - Conditionally render DiscountSelector when `hasCapability('registration-discounts')` is true
    - Pass `moduleType="registrations"` to DiscountSelector
    - Include `discountIds` in form submission payload
    - _Requirements: 10.5, 10.6, 10.7, 10.8_

  - [x] 3.2 Write property test for DiscountSelector capability gating
    - **Property 23: DiscountSelector capability gating on registration type form**
    - For any organisation, DiscountSelector should be visible iff `registration-discounts` capability is enabled
    - Use fast-check to generate random capability sets
    - **Validates: Requirements 10.5, 10.8**

  - [x] 3.3 Write unit tests for DiscountSelector integration
    - Test DiscountSelector renders when capability is enabled
    - Test DiscountSelector hidden when capability is disabled
    - Test form submission includes discountIds
    - Test discountIds pre-populated in edit mode
    - _Requirements: 10.5, 10.6, 10.7, 10.8_

- [x] 4. Implement RegistrationsDatabasePage
  - [x] 4.1 Implement `packages/orgadmin-registrations/src/pages/RegistrationsDatabasePage.tsx`
    - Fetch registrations from `/api/orgadmin/organisations/:orgId/registrations`
    - Render table with columns: registration type name, entity name, owner name, registration number, date last renewed, status, valid until, labels, processed flag
    - Implement search bar filtering by entity name, owner name, or registration number
    - Implement status toggle (current/elapsed/all) where current = active + pending
    - Implement custom filter dropdown with saved filter sets
    - Implement "Create Filter" button opening CreateCustomFilterDialog
    - Implement checkbox selection for batch operations
    - Implement "Add Registration" button (visible when types exist and user is admin)
    - Implement "Export to Excel" button
    - Implement processed flag toggle icon per row
    - Implement view action navigating to RegistrationDetailsPage
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 5.1, 6.1, 7.1, 7.2_

  - [x] 4.2 Write property test for search filtering
    - **Property 7: Search filters by entity name, owner name, or registration number**
    - **Validates: Requirements 3.2**

  - [x] 4.3 Write property test for status filter partitioning
    - **Property 8: Status filter partitions registrations correctly**
    - **Validates: Requirements 3.3, 8.2**

  - [x] 4.4 Write property test for batch operation button visibility
    - **Property 10: Batch operation buttons visibility follows selection state**
    - **Validates: Requirements 5.1**

  - [x] 4.5 Write property test for Add Registration button visibility
    - **Property 14: Add Registration button visibility**
    - **Validates: Requirements 6.1**

  - [x] 4.6 Write property test for processed flag toggle
    - **Property 17: Processed flag toggle and icon consistency**
    - **Validates: Requirements 7.1, 7.2**

  - [x] 4.7 Write unit tests for RegistrationsDatabasePage
    - Test table renders all required columns
    - Test loading and empty states
    - Test export button triggers download
    - Test custom filter dropdown
    - _Requirements: 3.1, 3.4, 3.5, 3.6_

- [x] 5. Implement RegistrationDetailsPage
  - [x] 5.1 Implement `packages/orgadmin-registrations/src/pages/RegistrationDetailsPage.tsx`
    - Fetch registration from `/api/orgadmin/registrations/:id`
    - Display: registration number, entity name, owner name, registration type, status, valid until, date last renewed, labels, processed flag, payment status, form submission data
    - Back button preserving previous filter state
    - _Requirements: 4.1, 4.2, 4.3_

  - [x] 5.2 Write property test for registration details display
    - **Property 9: Registration details page displays all required fields**
    - **Validates: Requirements 4.2**

  - [x] 5.3 Write unit tests for RegistrationDetailsPage
    - Test all fields render correctly
    - Test back button navigation
    - Test loading and error states
    - _Requirements: 4.1, 4.2, 4.3_

- [x] 6. Implement RegistrationTypesListPage
  - [x] 6.1 Implement `packages/orgadmin-registrations/src/pages/RegistrationTypesListPage.tsx`
    - Fetch registration types from `/api/orgadmin/organisations/:orgId/registration-types`
    - Render list showing name, entity name, status, creation date
    - "Create Registration Type" button navigating to CreateRegistrationTypePage
    - Click row navigating to RegistrationTypeDetailsPage
    - _Requirements: 2.1, 2.2, 2.5_

  - [x] 6.2 Write property test for registration type list display
    - **Property 2: Registration type list displays all required fields**
    - **Validates: Requirements 2.1**

  - [x] 6.3 Write unit tests for RegistrationTypesListPage
    - Test list renders all required columns
    - Test create button navigation
    - Test row click navigation
    - Test loading and empty states
    - _Requirements: 2.1, 2.2, 2.5_

- [x] 7. Implement RegistrationTypeDetailsPage
  - [x] 7.1 Implement `packages/orgadmin-registrations/src/pages/RegistrationTypeDetailsPage.tsx`
    - Fetch registration type from `/api/orgadmin/registration-types/:id`
    - Display all configuration details
    - Edit button navigating to CreateRegistrationTypePage in edit mode
    - Delete button with confirmation dialog sending DELETE request
    - _Requirements: 2.5, 2.6, 2.8_

  - [x] 7.2 Write unit tests for RegistrationTypeDetailsPage
    - Test all fields render correctly
    - Test edit button navigation
    - Test delete confirmation dialog flow
    - Test loading and error states
    - _Requirements: 2.5, 2.6, 2.8_

- [x] 8. Implement CreateRegistrationTypePage
  - [x] 8.1 Implement `packages/orgadmin-registrations/src/pages/CreateRegistrationTypePage.tsx`
    - Render RegistrationTypeForm component
    - In create mode: empty form, POST to `/api/orgadmin/registration-types`
    - In edit mode: fetch existing data, pre-populate form, PUT to `/api/orgadmin/registration-types/:id`
    - Navigate back to list (create) or details (edit) on success
    - Preserve form data on API error
    - _Requirements: 2.2, 2.3, 2.4, 2.6, 2.7, 2.9_

  - [x] 8.2 Write property test for form submission HTTP method
    - **Property 3: Registration type form submission sends correct HTTP method**
    - **Validates: Requirements 2.4, 2.7**

  - [x] 8.3 Write property test for edit form pre-population
    - **Property 4: Edit form pre-population round trip**
    - **Validates: Requirements 2.6**

  - [x] 8.4 Write property test for API error form preservation
    - **Property 5: API error preserves form data**
    - **Validates: Requirements 2.9**

  - [x] 8.5 Write unit tests for CreateRegistrationTypePage
    - Test create mode renders empty form
    - Test edit mode pre-populates form
    - Test successful create navigates to list
    - Test successful edit navigates to details
    - Test error preserves form data
    - _Requirements: 2.2, 2.3, 2.4, 2.6, 2.7, 2.9_

- [x] 9. Implement RegistrationTypeForm component
  - [x] 9.1 Implement `packages/orgadmin-registrations/src/components/RegistrationTypeForm.tsx`
    - Fields: name, description, entity name, registration form selector, status (open/closed), validity model (rolling/fixed), validity parameters, automatic approval toggle, registration labels, payment methods, T&Cs toggle + rich text editor
    - Validation: required fields, conditional fields
    - _Requirements: 2.3_

  - [x] 9.2 Write unit tests for RegistrationTypeForm
    - Test all fields render
    - Test conditional field visibility (T&Cs text, validity parameters)
    - Test validation errors
    - Test form submission
    - _Requirements: 2.3_

- [x] 10. Implement BatchOperationsDialog component
  - [x] 10.1 Implement `packages/orgadmin-registrations/src/components/BatchOperationsDialog.tsx`
    - Handle mark processed/unprocessed (immediate API call)
    - Handle add/remove labels (label selection then API call)
    - Clear selection on success
    - _Requirements: 5.2, 5.3, 5.4, 5.5, 5.6_

  - [x] 10.2 Write property test for batch mark processed/unprocessed
    - **Property 11: Batch mark processed/unprocessed sends correct request**
    - **Validates: Requirements 5.2, 5.3**

  - [x] 10.3 Write property test for batch add/remove labels
    - **Property 12: Batch add/remove labels sends correct request**
    - **Validates: Requirements 5.4, 5.5**

  - [x] 10.4 Write property test for batch operation clears selection
    - **Property 13: Batch operation completion clears selection**
    - **Validates: Requirements 5.6**

  - [x] 10.5 Write unit tests for BatchOperationsDialog
    - Test mark processed API call
    - Test mark unprocessed API call
    - Test add labels dialog and API call
    - Test remove labels dialog and API call
    - Test selection cleared on success
    - _Requirements: 5.2, 5.3, 5.4, 5.5, 5.6_

- [x] 11. Implement CreateCustomFilterDialog component
  - [x] 11.1 Implement `packages/orgadmin-registrations/src/components/CreateCustomFilterDialog.tsx`
    - Form for defining filter criteria: status, date ranges, labels, registration types
    - Validation: filter name required, at least one criterion, date range validation
    - _Requirements: 3.5_

  - [x] 11.2 Write unit tests for CreateCustomFilterDialog
    - Test form renders all filter criteria
    - Test validation errors
    - Test save creates filter
    - _Requirements: 3.5_

- [x] 12. Implement registration creation flow
  - [x] 12.1 Add registration creation logic to RegistrationsDatabasePage
    - When one type exists: auto-select and navigate to form
    - When multiple types exist: show type selector
    - Submit creates FormSubmission + Registration
    - Status set based on automaticApproval setting
    - _Requirements: 6.2, 6.3, 6.4, 6.5, 6.6_

  - [x] 12.2 Write property test for registration type auto-selection
    - **Property 15: Registration type auto-selection based on count**
    - **Validates: Requirements 6.2, 6.3**

  - [x] 12.3 Write property test for automatic approval status
    - **Property 16: New registration status follows automatic approval setting**
    - **Validates: Requirements 6.5, 6.6**

  - [x] 12.4 Write unit tests for registration creation flow
    - Test auto-selection with single type
    - Test type selector with multiple types
    - Test status set to active when auto-approve enabled
    - Test status set to pending when auto-approve disabled
    - _Requirements: 6.2, 6.3, 6.4, 6.5, 6.6_

- [x] 13. Landing page integration and capability gating
  - [x] 13.1 Verify module registration with shell
    - Ensure card displays on landing page when `registrations` capability is enabled
    - Ensure card hidden when capability is disabled
    - Ensure navigation to `/registrations` on card click
    - _Requirements: 1.1, 1.2, 1.3_

  - [x] 13.2 Write property test for capability-gated card visibility
    - **Property 1: Capability-gated card visibility**
    - **Validates: Requirements 1.1, 1.3**

  - [x] 13.3 Write property test for discount route capability gating
    - **Property 21: Discount route capability gating**
    - **Validates: Requirements 10.1, 10.9**

  - [x] 13.4 Write property test for discounts sub-menu capability gating
    - **Property 22: Discounts sub-menu capability gating**
    - **Validates: Requirements 1.5, 1.6**

  - [x] 13.5 Write unit tests for landing page integration
    - Test card visibility with capability enabled/disabled
    - Test card click navigation
    - Test discount sub-menu visibility with capability
    - _Requirements: 1.1, 1.2, 1.3, 1.5, 1.6_

- [x] 14. Internationalisation
  - [x] 14.1 Add translation keys for all registrations module strings
    - Page titles, button labels, table headers, status labels, form labels, error messages, success notifications
    - Include discount-related translation keys
    - _Requirements: 9.1_

  - [x] 14.2 Write property test for translation key coverage
    - **Property 19: All user-visible text uses translation keys**
    - **Validates: Requirements 9.1**

  - [x] 14.3 Write property test for date formatting
    - **Property 20: Date formatting respects locale**
    - **Validates: Requirements 9.2**

- [x] 15. Discount API module type consistency
  - [x] 15.1 Write property test for discount API module type
    - **Property 24: Discount API module type consistency**
    - For any discount fetch in the registrations module, the request should use "registrations" module type and all returned discounts should have `moduleType: 'registrations'`
    - **Validates: Requirements 10.4, 10.6**

  - [x] 15.2 Write property test for discount IDs persistence round trip
    - **Property 25: Discount IDs persistence round trip**
    - For any registration type saved with discount IDs, retrieving it should return the same discount IDs
    - **Validates: Requirements 10.7**

- [x] 16. Final checkpoint - Integration testing
  - [x] 16.1 Test end-to-end registration type CRUD workflow
    - Create registration type, verify in list, view details, edit, delete
    - _Requirements: 2.1-2.9_

  - [x] 16.2 Test end-to-end discount integration workflow
    - Navigate to discounts via sub-menu
    - Create discount from registrations module
    - Associate discount with registration type
    - Verify discount appears in registration type form
    - _Requirements: 10.1-10.9_

  - [x] 16.3 Test batch operations workflow
    - Select registrations, mark processed, verify update
    - Select registrations, add labels, verify update
    - _Requirements: 5.1-5.6_

  - [x] 16.4 Ensure all tests pass
    - Run all unit tests
    - Run all property-based tests
    - Verify no regressions in existing modules
