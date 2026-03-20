# Implementation Plan: Merchandise Module Improvements

## Overview

Three targeted improvements to bring the merchandise module to parity with memberships/events: (1) remove hardcoded payment method fallbacks, (2) replace plain TextField with ReactQuill for T&C, (3) add discounts sub-menu with capability-gated routes and thin wrapper pages. All changes are frontend-only in `packages/orgadmin-merchandise/`.

## Tasks

- [x] 1. Payment Methods Fetching Alignment
  - [x] 1.1 Remove hardcoded fallback payment methods in `loadPaymentMethods`
    - In `packages/orgadmin-merchandise/src/pages/CreateMerchandiseTypePage.tsx`, modify the `loadPaymentMethods` function
    - Remove the hardcoded fallback array `[{ id: 'pay-offline', name: 'Pay Offline' }, { id: 'stripe', name: 'Card Payment (Stripe)' }]` from both the success path and the catch block
    - On success with empty/null response, set payment methods to an empty array: `setPaymentMethods((response as PaymentMethod[]) || [])`
    - On failure, set payment methods to empty array, log the error with `console.error`, and set a user-facing error message via the existing error state using translation key `merchandise.errors.paymentMethodsLoadFailed`
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

  - [ ]* 1.2 Write property test: payment methods display matches API response
    - Test file: `packages/orgadmin-merchandise/src/pages/__tests__/CreateMerchandiseTypePage.payment-methods.property.test.tsx`
    - Generate random arrays of `{ id: string, name: string }` payment method objects using `fc.array(fc.record({ id: fc.uuid(), name: fc.string({ minLength: 1 }) }), { maxLength: 10 })`
    - Mock the API to return the generated array, render the page, verify the dropdown contains exactly those methods and no hardcoded fallbacks
    - **Property 1: Payment methods display matches API response**
    - **Validates: Requirements 1.1, 1.2, 1.5**

- [x] 2. Rich Text Editor for Terms and Conditions
  - [x] 2.1 Replace plain TextField with ReactQuill editor
    - In `packages/orgadmin-merchandise/src/pages/CreateMerchandiseTypePage.tsx`:
    - Add imports: `import ReactQuill from 'react-quill'` and `import 'react-quill/dist/quill.snow.css'`
    - Remove the existing `TextField multiline` used for Terms and Conditions content
    - Add a `Typography variant="subtitle2" gutterBottom` label above the editor using translation key `merchandise.fields.termsAndConditionsContent`
    - Add `ReactQuill` with `theme="snow"`, `value={formData.termsAndConditions || ''}`, and `onChange={(value) => handleFieldChange('termsAndConditions', value)}`
    - Configure toolbar modules matching MembershipTypeForm exactly: `[[{ header: [1, 2, 3, false] }], ['bold', 'italic', 'underline'], [{ list: 'ordered' }, { list: 'bullet' }], ['clean']]`
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7_

  - [ ]* 2.2 Write property test: Terms and Conditions content round-trip
    - Test file: `packages/orgadmin-merchandise/src/pages/__tests__/CreateMerchandiseTypePage.termsAndConditions.property.test.tsx`
    - Generate random HTML strings using `fc.oneof(fc.constant('<p>text</p>'), fc.constant('<h1>heading</h1>'), fc.string())`
    - Set generated string as `termsAndConditions` on a merchandise type, load the edit form, verify the ReactQuill value matches the input
    - **Property 2: Terms and Conditions content round-trip**
    - **Validates: Requirements 2.4, 2.5**

- [x] 3. Checkpoint — Verify payment methods and ReactQuill changes
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Add translation keys for all three improvements
  - [x] 4.1 Add translation keys to all 6 locale files
    - In `packages/orgadmin-shell/src/locales/{locale}/translation.json` for each locale (en-GB, de-DE, fr-FR, es-ES, it-IT, pt-PT):
    - Add `modules.merchandise.menu.merchandiseTypes` — "Merchandise Types" (translate per locale)
    - Add `modules.merchandise.menu.discounts` — "Discounts" (translate per locale)
    - Add `modules.merchandise.menu.merchandiseOrders` — "Merchandise Orders" (translate per locale)
    - Add `merchandise.fields.termsAndConditionsContent` — "Terms and Conditions Content" (translate per locale)
    - Add `merchandise.errors.paymentMethodsLoadFailed` — "Failed to load payment methods" (translate per locale)
    - _Requirements: 1.3, 2.7, 3.1, 3.2, 3.3, 3.4_

- [x] 5. Discounts Sub-Menu and Navigation
  - [x] 5.1 Update module types to support sub-menu items and route capabilities
    - In `packages/orgadmin-merchandise/src/types/module.types.ts`:
    - Add optional `capability?: string` field to `ModuleRoute` interface
    - Add optional `capability?: string` field to `MenuItem` interface
    - Add optional `subMenuItems?: MenuItem[]` field to `ModuleRegistration` interface
    - _Requirements: 3.2, 3.5, 3.6, 3.7, 3.8_

  - [x] 5.2 Create discount page wrapper components
    - Create `packages/orgadmin-merchandise/src/pages/DiscountsListPage.tsx` — thin wrapper rendering `<EventsDiscountsListPage moduleType="merchandise" />` imported from `@aws-web-framework/orgadmin-events`
    - Create `packages/orgadmin-merchandise/src/pages/CreateDiscountPage.tsx` — thin wrapper rendering `<EventsCreateDiscountPage moduleType="merchandise" />` imported from `@aws-web-framework/orgadmin-events`
    - Create `packages/orgadmin-merchandise/src/pages/EditDiscountPage.tsx` — thin wrapper rendering `<EventsCreateDiscountPage moduleType="merchandise" />` imported from `@aws-web-framework/orgadmin-events`
    - _Requirements: 3.9_

  - [x] 5.3 Update module registration with sub-menu items and discount routes
    - In `packages/orgadmin-merchandise/src/index.ts`:
    - Import `LocalOffer as DiscountIcon` from `@mui/icons-material`
    - Replace the single `menuItem` property with a `subMenuItems` array containing three items:
      - Merchandise Types: path `/merchandise`, icon `MerchandiseIcon`, label `modules.merchandise.menu.merchandiseTypes`
      - Discounts: path `/merchandise/discounts`, icon `DiscountIcon`, label `modules.merchandise.menu.discounts`, capability `merchandise-discounts`
      - Merchandise Orders: path `/merchandise/orders`, icon `MerchandiseIcon`, label `modules.merchandise.menu.merchandiseOrders`
    - Add three lazy-loaded discount routes to the `routes` array, all gated by `capability: 'merchandise-discounts'`:
      - `merchandise/discounts` → `DiscountsListPage`
      - `merchandise/discounts/new` → `CreateDiscountPage`
      - `merchandise/discounts/:id/edit` → `EditDiscountPage`
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9_

- [x] 6. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Property tests use `fast-check` and validate universal correctness properties from the design document
- All changes are frontend-only — no backend modifications required
- Follow patterns from `packages/orgadmin-memberships/` for ReactQuill, payment methods, and sub-menu items
- Navigation paths do not include the `/orgadmin` prefix
