# Implementation Plan: Merchandise Module

## Overview

Connect the scaffolded frontend UI in `packages/orgadmin-merchandise/` to the existing backend API. The primary work is replacing mock hooks with real `useApi`, wiring form submissions to backend endpoints, integrating shared platform features (discounts, payment methods, application forms), adding `discountIds` to types, and ensuring the price calculator is correct via property-based tests. Follow established patterns from memberships/events modules.

## Tasks

- [ ] 1. Update types and add discount support
  - [x] 1.1 Add `discountIds` to frontend types
    - In `packages/orgadmin-merchandise/src/types/merchandise.types.ts`, add `discountIds?: string[]` to both `MerchandiseType` and `MerchandiseTypeFormData` interfaces
    - _Requirements: 10.5_

  - [-] 1.2 Add `discountIds` to backend DTOs
    - In `packages/backend/src/services/merchandise.service.ts`, add `discountIds?: string[]` to `CreateMerchandiseTypeDto` and `UpdateMerchandiseTypeDto`
    - Update `rowToMerchandiseType()` to map `row.discount_ids` (JSONB column)
    - Update `createMerchandiseType()` and `updateMerchandiseType()` SQL to include `discount_ids` column with `JSON.stringify()`
    - _Requirements: 10.4, 10.5_

- [ ] 2. Merchandise Types List Page — replace mock with real API
  - [~] 2.1 Wire MerchandiseTypesListPage to real API
    - In `packages/orgadmin-merchandise/src/pages/MerchandiseTypesListPage.tsx`:
    - Remove the local mock `useApi` function
    - Import `useApi` from `@aws-web-framework/orgadmin-core` and `useOrganisation` for `organisationId`
    - Update `loadMerchandiseTypes` to call `GET /api/orgadmin/organisations/{organisationId}/merchandise-types`
    - Add error state and display MUI Alert on fetch failure
    - Display image thumbnail, name, status chip, and option count per row
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

  - [~] 2.2 Add delete action to list page
    - Add delete icon button per row with confirmation dialog
    - On confirm, call `DELETE /api/orgadmin/merchandise-types/{id}` and refresh the list
    - _Requirements: 1.6_

- [ ] 3. Create/Edit Merchandise Type Page — full API integration
  - [~] 3.1 Wire create form submission to POST endpoint
    - In `packages/orgadmin-merchandise/src/pages/CreateMerchandiseTypePage.tsx`:
    - Wire `handleSave` to call `POST /api/orgadmin/merchandise-types` with `MerchandiseTypeFormData` + `organisationId`
    - Display API validation errors inline or as top-level alert
    - Navigate to list page on success
    - _Requirements: 2.1, 2.4, 2.5_

  - [~] 3.2 Wire edit mode — load existing data and PUT on save
    - Detect edit mode from route params (e.g. `/merchandise/:id/edit`)
    - Call `GET /api/orgadmin/merchandise-types/{id}` on mount and populate all form fields
    - Wire save to call `PUT /api/orgadmin/merchandise-types/{id}` with updated payload
    - _Requirements: 2.2, 2.3, 2.4, 2.5_

  - [~] 3.3 Add form validation — name and images required
    - Disable save button when `name` is empty or `images` array is empty
    - _Requirements: 2.6, 14.5_

  - [~] 3.4 Integrate DiscountSelector component
    - Import `DiscountSelector` from `@aws-web-framework/components`
    - Conditionally render when organisation has discount capability
    - Fetch discounts from `GET /api/orgadmin/organisations/{organisationId}/discounts/merchandise`
    - Bind selected discount IDs to `formData.discountIds`
    - _Requirements: 10.1, 10.2, 10.3, 10.4_

  - [~] 3.5 Integrate application form selection
    - When `requireApplicationForm` toggle is enabled, fetch forms from `GET /api/orgadmin/organisations/{organisationId}/application-forms`
    - Populate select dropdown with available forms, bind to `formData.applicationFormId`
    - _Requirements: 8.1, 8.2, 8.3_

- [ ] 4. Checkpoint — Verify types, list page, and create/edit page
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 5. Merchandise Type Details Page — API integration
  - [~] 5.1 Wire MerchandiseTypeDetailsPage to real API
    - In `packages/orgadmin-merchandise/src/pages/MerchandiseTypeDetailsPage.tsx`:
    - Call `GET /api/orgadmin/merchandise-types/{id}` on mount
    - Render read-only sections: basic info, images gallery, options with prices, delivery config, stock status, quantity rules, payment config, email config
    - Show "not found" message for 404 responses
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.6_

  - [~] 5.2 Add delete with confirmation on details page
    - Add delete button with confirmation dialog
    - Call `DELETE /api/orgadmin/merchandise-types/{id}` on confirm, navigate to list
    - _Requirements: 3.5_

- [ ] 6. Orders List Page — API integration
  - [~] 6.1 Wire MerchandiseOrdersListPage to real API
    - In `packages/orgadmin-merchandise/src/pages/MerchandiseOrdersListPage.tsx`:
    - Import real `useApi` and `useOrganisation`
    - Call `GET /api/orgadmin/organisations/{organisationId}/merchandise-orders` on mount
    - Display order ID, customer name, merchandise type name, quantity, total price, payment status, order status per row
    - _Requirements: 11.1, 11.4_

  - [~] 6.2 Add order filtering
    - Pass filter params as query string: `merchandiseTypeId`, `paymentStatus`, `orderStatus`, `dateFrom`, `dateTo`, `customerName`
    - Re-fetch when filters change
    - _Requirements: 11.2, 11.3_

  - [~] 6.3 Add batch selection and export
    - Add checkbox selection for batch operations
    - Export button calls `GET /api/orgadmin/organisations/{organisationId}/merchandise-orders/export` and triggers file download
    - _Requirements: 11.5, 11.6_

- [ ] 7. Order Details Page — API integration
  - [~] 7.1 Wire MerchandiseOrderDetailsPage to real API
    - In `packages/orgadmin-merchandise/src/pages/MerchandiseOrderDetailsPage.tsx`:
    - Call `GET /api/orgadmin/merchandise-orders/{id}` on mount
    - Display order date, customer name/email, order status, payment status
    - Display pricing breakdown: unit price, subtotal, delivery fee, total
    - Display selected options
    - Show "not found" for 404
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.6_

  - [~] 7.2 Add admin notes save functionality
    - Admin notes text field with save button
    - Persist notes via API
    - _Requirements: 12.5_

- [ ] 8. Order Status Management — dialogs and batch operations
  - [~] 8.1 Wire OrderStatusUpdateDialog to API
    - In `packages/orgadmin-merchandise/src/components/OrderStatusUpdateDialog.tsx`:
    - On confirm, call `PUT /api/orgadmin/merchandise-orders/{id}/status` with `{ status, userId, notes }`
    - Support "send email" checkbox option
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5_

  - [~] 8.2 Wire BatchOrderOperationsDialog to API
    - In `packages/orgadmin-merchandise/src/components/BatchOrderOperationsDialog.tsx`:
    - Iterate over selected order IDs, call status update API for each
    - Show progress indicator during batch operation
    - _Requirements: 13.6, 13.7_

- [ ] 9. Checkpoint — Verify all pages and order management
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 10. Price calculator property tests
  - [ ]* 10.1 Write property test: unit price equals sum of selected option prices
    - Test file: `packages/orgadmin-merchandise/src/utils/__tests__/priceCalculator.property.test.ts`
    - Generate random option types with random prices and a valid selection of one value per type
    - Assert `calculateUnitPrice` returns the sum of selected option value prices
    - **Property 1: Unit price equals sum of selected option value prices**
    - **Validates: Requirements 4.4, 16.1**

  - [ ]* 10.2 Write property test: price calculation invariant
    - Test file: `packages/orgadmin-merchandise/src/utils/__tests__/priceCalculator.property.test.ts`
    - Generate valid merchandise type, options, and quantity
    - Assert `subtotal === unitPrice * quantity` and `totalPrice === subtotal + deliveryFee`
    - **Property 2: Price calculation invariant**
    - **Validates: Requirements 4.6, 16.2, 16.8**

  - [ ]* 10.3 Write property test: delivery fee calculation correctness
    - Test file: `packages/orgadmin-merchandise/src/utils/__tests__/priceCalculator.property.test.ts`
    - Generate merchandise types with each delivery type (free, fixed, quantity_based) and random quantities
    - Assert correct fee for each delivery type scenario
    - **Property 3: Delivery fee calculation correctness**
    - **Validates: Requirements 6.6, 6.7, 16.3, 16.4, 16.5**

  - [ ]* 10.4 Write property test: delivery rule validation detects overlaps and gaps
    - Test file: `packages/orgadmin-merchandise/src/utils/__tests__/priceCalculator.property.test.ts`
    - Generate rule sets with known overlaps, known gaps, and valid sets
    - Assert `validateDeliveryRules` correctly detects overlaps and gaps
    - **Property 4: Delivery rule validation detects overlaps and gaps**
    - **Validates: Requirements 6.4, 6.5, 16.6, 16.7**

  - [ ]* 10.5 Write property test: quantity validation correctness
    - Test file: `packages/orgadmin-merchandise/src/utils/__tests__/priceCalculator.property.test.ts`
    - Generate quantity rules (min, max, increment) and random quantities
    - Assert correct valid/invalid classification with appropriate error messages
    - **Property 5: Quantity validation correctness**
    - **Validates: Requirements 7.4, 7.5, 16.9**

- [ ] 11. Form validation property tests
  - [ ]* 11.1 Write property test: save button disabled when form incomplete
    - Test file: `packages/orgadmin-merchandise/src/pages/__tests__/CreateMerchandiseTypePage.validation.property.test.ts`
    - Generate form states with random name and images values
    - Assert save button disabled iff `name` is empty or `images` has length zero
    - **Property 6: Save button disabled when form is incomplete**
    - **Validates: Requirements 2.6, 14.5**

  - [ ]* 11.2 Write property test: handling fee visibility tied to card payment methods
    - Test file: `packages/orgadmin-merchandise/src/pages/__tests__/CreateMerchandiseTypePage.validation.property.test.ts`
    - Generate payment method sets with random card/non-card mix
    - Assert handling fee checkbox visible iff at least one selected method is card-based
    - Assert `handlingFeeIncluded` resets to false when all card methods deselected
    - **Property 7: Handling fee visibility tied to card payment methods**
    - **Validates: Requirements 9.3, 9.4**

- [ ] 12. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Property tests validate universal correctness properties from the design document using `fast-check`
- The backend API and routes already exist — this plan focuses on frontend integration
- Follow patterns from memberships/events modules for payment methods, discounts, and handling fees
