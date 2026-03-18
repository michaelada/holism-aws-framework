# Requirements Document

## Introduction

This specification covers the full implementation of the Merchandise Administration module, connecting the existing scaffolded frontend UI (in `packages/orgadmin-merchandise/`) to the existing backend services and database schema. The module enables organisations with the 'merchandise' capability to create merchandise types with configurable options, pricing, stock management, delivery rules, and order management. It integrates with the established discount, payment method, handling fee, terms and conditions, and application form patterns already used by Memberships, Events, and Registrations modules.

## Glossary

- **Merchandise_Module**: The org-admin module that provides merchandise administration functionality, consisting of frontend pages/components in `packages/orgadmin-merchandise/` and backend services/routes in `packages/backend/`
- **Merchandise_Type**: A product definition created by an organisation admin, containing name, description, images, option types, stock settings, delivery configuration, quantity rules, payment configuration, and application form linkage
- **Option_Type**: A named dimension of variation for a Merchandise_Type (e.g. "Size", "Color", "Pack")
- **Option_Value**: A specific choice within an Option_Type (e.g. "Small", "Medium", "Large") with its own price and optional SKU and stock quantity
- **Delivery_Rule**: A quantity-range-based rule that determines the delivery fee for a given order quantity
- **Merchandise_Order**: A customer order record containing selected options, quantity, pricing breakdown, payment status, order status, and optional form submission
- **Order_Status**: The fulfilment state of a Merchandise_Order: pending, processing, shipped, delivered, or cancelled
- **Payment_Status**: The payment state of a Merchandise_Order: pending, paid, or refunded
- **Stock_Tracking**: An optional feature per Merchandise_Type that tracks inventory at the Option_Value level with low-stock alerts and out-of-stock behavior
- **Price_Calculator**: The utility module (`priceCalculator.ts`) that computes unit price, subtotal, delivery fee, and total price for merchandise orders
- **Org_Admin**: An authenticated user with administrative access to an organisation's merchandise settings
- **API_Hook**: The `useApi` hook from `@aws-web-framework/orgadmin-core` that provides authenticated HTTP request execution
- **Discount_Selector**: The shared `DiscountSelector` component from `@aws-web-framework/components` used to associate discounts with merchandise types
- **Capability_System**: The system that gates module access; merchandise requires the 'merchandise' capability on the organisation

## Requirements

### Requirement 1: Merchandise Types List Page API Integration

**User Story:** As an Org_Admin, I want the merchandise types list page to load real data from the backend, so that I can see all merchandise types configured for my organisation.

#### Acceptance Criteria

1. WHEN the MerchandiseTypesListPage loads, THE Merchandise_Module SHALL replace the local mock `useApi` with the real `useApi` hook from `@aws-web-framework/orgadmin-core`
2. WHEN the MerchandiseTypesListPage mounts, THE Merchandise_Module SHALL call `GET /api/orgadmin/organisations/{organisationId}/merchandise-types` to fetch all merchandise types
3. WHILE the API request is in progress, THE Merchandise_Module SHALL display a loading indicator
4. IF the API request fails, THEN THE Merchandise_Module SHALL display an error message to the Org_Admin
5. WHEN merchandise types are returned, THE Merchandise_Module SHALL display each Merchandise_Type with its name, status, option count, and image thumbnail
6. WHEN the Org_Admin clicks the delete action on a Merchandise_Type, THE Merchandise_Module SHALL call `DELETE /api/orgadmin/merchandise-types/{id}` and refresh the list on success

### Requirement 2: Create and Edit Merchandise Type API Integration

**User Story:** As an Org_Admin, I want to create and edit merchandise types with all configuration sections persisted to the backend, so that my merchandise catalogue is stored and retrievable.

#### Acceptance Criteria

1. WHEN the Org_Admin submits the create form, THE Merchandise_Module SHALL call `POST /api/orgadmin/merchandise-types` with the complete MerchandiseTypeFormData payload including organisationId
2. WHEN the Org_Admin navigates to edit a Merchandise_Type, THE Merchandise_Module SHALL call `GET /api/orgadmin/merchandise-types/{id}` and populate all form fields with the returned data
3. WHEN the Org_Admin submits the edit form, THE Merchandise_Module SHALL call `PUT /api/orgadmin/merchandise-types/{id}` with the updated MerchandiseTypeFormData payload
4. IF the create or update API call fails with a validation error, THEN THE Merchandise_Module SHALL display the error message from the API response
5. WHEN the save operation succeeds, THE Merchandise_Module SHALL navigate the Org_Admin back to the merchandise types list page
6. THE Merchandise_Module SHALL validate that the name field is non-empty and at least one image is uploaded before enabling the save button

### Requirement 3: Merchandise Type Details Page API Integration

**User Story:** As an Org_Admin, I want to view the full details of a merchandise type including options, pricing, stock, and delivery configuration, so that I can review the product setup.

#### Acceptance Criteria

1. WHEN the MerchandiseTypeDetailsPage loads, THE Merchandise_Module SHALL call `GET /api/orgadmin/merchandise-types/{id}` to fetch the complete Merchandise_Type
2. WHEN the Merchandise_Type is loaded, THE Merchandise_Module SHALL display all Option_Types with their Option_Values and prices
3. WHEN the Merchandise_Type is loaded, THE Merchandise_Module SHALL display the delivery configuration (type, fee, or rules)
4. WHEN the Merchandise_Type is loaded, THE Merchandise_Module SHALL display stock tracking status and out-of-stock behavior if Stock_Tracking is enabled
5. WHEN the Org_Admin clicks the delete button, THE Merchandise_Module SHALL show a confirmation dialog and call `DELETE /api/orgadmin/merchandise-types/{id}` upon confirmation
6. IF the Merchandise_Type is not found, THEN THE Merchandise_Module SHALL display a "not found" message

### Requirement 4: Options and Pricing Configuration

**User Story:** As an Org_Admin, I want to define multiple option types with values and individual pricing for each merchandise type, so that customers can choose from different product variations.

#### Acceptance Criteria

1. THE Merchandise_Module SHALL allow the Org_Admin to create zero or more Option_Types per Merchandise_Type
2. THE Merchandise_Module SHALL allow the Org_Admin to add one or more Option_Values to each Option_Type with a name and price
3. WHEN an Option_Value is created, THE Merchandise_Module SHALL accept an optional SKU identifier
4. THE Merchandise_Module SHALL calculate the unit price as the sum of prices from the selected Option_Values across all Option_Types
5. WHEN the Org_Admin reorders Option_Types or Option_Values, THE Merchandise_Module SHALL persist the display order via the backend API
6. THE Price_Calculator SHALL compute the total price as (unit price × quantity) + delivery fee

### Requirement 5: Stock Management

**User Story:** As an Org_Admin, I want to optionally track stock levels for merchandise options and receive low-stock alerts, so that I can manage inventory effectively.

#### Acceptance Criteria

1. THE Merchandise_Module SHALL provide a toggle to enable or disable Stock_Tracking per Merchandise_Type
2. WHILE Stock_Tracking is enabled, THE Merchandise_Module SHALL display stock quantity fields for each Option_Value
3. WHEN Stock_Tracking is enabled, THE Merchandise_Module SHALL allow the Org_Admin to set a low-stock alert threshold
4. WHEN Stock_Tracking is enabled, THE Merchandise_Module SHALL allow the Org_Admin to select an out-of-stock behavior: "hide" or "show as unavailable"
5. WHEN an order is placed, THE Merchandise_Module SHALL decrement the stock quantity for the selected Option_Values
6. THE Merchandise_Module SHALL allow manual stock level adjustments via `POST /api/orgadmin/merchandise-types/{id}/stock/adjust`

### Requirement 6: Delivery Configuration

**User Story:** As an Org_Admin, I want to configure flexible delivery options including free delivery, fixed fees, and quantity-based rules, so that delivery costs are calculated correctly for each order.

#### Acceptance Criteria

1. THE Merchandise_Module SHALL support three delivery types: free, fixed fee, and quantity-based
2. WHEN the delivery type is "fixed", THE Merchandise_Module SHALL require the Org_Admin to enter a delivery fee amount
3. WHEN the delivery type is "quantity_based", THE Merchandise_Module SHALL allow the Org_Admin to define one or more Delivery_Rules with min quantity, optional max quantity, and delivery fee
4. THE Merchandise_Module SHALL validate that Delivery_Rules do not have overlapping quantity ranges
5. THE Merchandise_Module SHALL validate that Delivery_Rules do not have gaps between consecutive quantity ranges
6. WHEN calculating the delivery fee for an order, THE Price_Calculator SHALL find the Delivery_Rule whose quantity range contains the order quantity and return its delivery fee
7. IF no Delivery_Rule matches the order quantity, THEN THE Price_Calculator SHALL return a delivery fee of zero

### Requirement 7: Order Quantity Rules

**User Story:** As an Org_Admin, I want to set minimum and maximum order quantities and quantity increments for each merchandise type, so that orders conform to my business rules.

#### Acceptance Criteria

1. THE Merchandise_Module SHALL allow the Org_Admin to set an optional minimum order quantity (default: 1)
2. THE Merchandise_Module SHALL allow the Org_Admin to set an optional maximum order quantity
3. THE Merchandise_Module SHALL allow the Org_Admin to set an optional quantity increment (e.g. multiples of 5)
4. WHEN a quantity is submitted, THE Price_Calculator SHALL validate that the quantity meets the minimum, does not exceed the maximum, and is a multiple of the increment
5. IF the quantity validation fails, THEN THE Price_Calculator SHALL return an invalid result with descriptive error messages

### Requirement 8: Application Form Integration

**User Story:** As an Org_Admin, I want to require customers to fill out a specific application form when ordering certain merchandise types, so that I can collect additional information with orders.

#### Acceptance Criteria

1. THE Merchandise_Module SHALL provide a toggle to enable or disable application form requirement per Merchandise_Type
2. WHILE the application form requirement is enabled, THE Merchandise_Module SHALL allow the Org_Admin to select an application form from the organisation's available forms
3. WHEN the application form requirement is enabled, THE Merchandise_Module SHALL load the list of available forms from `GET /api/orgadmin/organisations/{organisationId}/application-forms`
4. WHEN an order is created with a required application form, THE Merchandise_Module SHALL store the form submission ID on the Merchandise_Order

### Requirement 9: Payment Configuration and Handling Fees

**User Story:** As an Org_Admin, I want to configure supported payment methods and handling fees for merchandise types, following the same patterns used in memberships and events, so that payment processing is consistent across the platform.

#### Acceptance Criteria

1. THE Merchandise_Module SHALL load available payment methods from `GET /api/payment-methods` and display them as selectable options
2. THE Merchandise_Module SHALL allow the Org_Admin to select one or more supported payment methods per Merchandise_Type
3. WHEN a card-based payment method is selected, THE Merchandise_Module SHALL display the handling fee checkbox option
4. WHEN the Org_Admin deselects all card-based payment methods, THE Merchandise_Module SHALL automatically uncheck the handling fee option
5. THE Merchandise_Module SHALL allow the Org_Admin to enable terms and conditions with a text field for the terms content
6. THE Merchandise_Module SHALL persist the supportedPaymentMethods, handlingFeeIncluded, useTermsAndConditions, and termsAndConditions fields to the backend

### Requirement 10: Discount Integration

**User Story:** As an Org_Admin, I want to associate discounts with merchandise types using the same discount system used for memberships and events, so that I can offer promotions on merchandise.

#### Acceptance Criteria

1. WHEN the organisation has the discount capability, THE Merchandise_Module SHALL display the Discount_Selector component on the create/edit merchandise type form
2. THE Merchandise_Module SHALL fetch available discounts from `GET /api/orgadmin/organisations/{organisationId}/discounts/merchandise`
3. THE Merchandise_Module SHALL allow the Org_Admin to select zero or more discounts to associate with a Merchandise_Type
4. WHEN the Merchandise_Type is saved, THE Merchandise_Module SHALL persist the selected discount IDs via the backend API
5. THE Merchandise_Module SHALL add a `discountIds` field to the MerchandiseTypeFormData type and the backend CreateMerchandiseTypeDto and UpdateMerchandiseTypeDto interfaces


### Requirement 11: Orders List Page API Integration

**User Story:** As an Org_Admin, I want to view and filter all merchandise orders for my organisation, so that I can manage order fulfilment.

#### Acceptance Criteria

1. WHEN the MerchandiseOrdersListPage loads, THE Merchandise_Module SHALL call `GET /api/orgadmin/organisations/{organisationId}/merchandise-orders` to fetch all orders
2. THE Merchandise_Module SHALL allow the Org_Admin to filter orders by merchandise type, payment status, order status, date range, and customer name
3. WHEN filters are applied, THE Merchandise_Module SHALL pass the filter parameters as query string parameters to the API
4. THE Merchandise_Module SHALL display each Merchandise_Order with order ID, customer name, merchandise type name, quantity, total price, payment status, and order status
5. THE Merchandise_Module SHALL allow the Org_Admin to select multiple orders using checkboxes for batch operations
6. WHEN the Org_Admin clicks the export button, THE Merchandise_Module SHALL call `GET /api/orgadmin/organisations/{organisationId}/merchandise-orders/export` and trigger a file download of the Excel spreadsheet

### Requirement 12: Order Details Page API Integration

**User Story:** As an Org_Admin, I want to view complete order details including pricing breakdown, customer information, and order history, so that I can manage individual orders.

#### Acceptance Criteria

1. WHEN the MerchandiseOrderDetailsPage loads, THE Merchandise_Module SHALL call `GET /api/orgadmin/merchandise-orders/{id}` to fetch the complete order
2. THE Merchandise_Module SHALL display the order information including order date, customer name, customer email, order status, and payment status
3. THE Merchandise_Module SHALL display the pricing breakdown including unit price, subtotal, delivery fee, and total price
4. THE Merchandise_Module SHALL display the selected options for the order
5. THE Merchandise_Module SHALL allow the Org_Admin to add and save admin notes on the order
6. IF the order is not found, THEN THE Merchandise_Module SHALL display a "not found" message

### Requirement 13: Order Status Management

**User Story:** As an Org_Admin, I want to update order statuses individually and in batch, including marking orders as processed/dispatched, so that I can track fulfilment progress.

#### Acceptance Criteria

1. WHEN the Org_Admin clicks "Update Status" on an order, THE Merchandise_Module SHALL open the OrderStatusUpdateDialog with the current status pre-selected
2. THE Merchandise_Module SHALL allow the Org_Admin to select a new Order_Status from: pending, processing, shipped, delivered, cancelled
3. THE Merchandise_Module SHALL allow the Org_Admin to add optional notes with the status change
4. THE Merchandise_Module SHALL allow the Org_Admin to choose whether to send a status update email to the customer
5. WHEN the status update is confirmed, THE Merchandise_Module SHALL call `PUT /api/orgadmin/merchandise-orders/{id}/status` with the new status, user ID, and notes
6. WHEN the Org_Admin selects multiple orders and clicks the batch operations button, THE Merchandise_Module SHALL open the BatchOrderOperationsDialog
7. WHEN the batch status update is confirmed, THE Merchandise_Module SHALL call the status update API for each selected order and display progress

### Requirement 14: Image Gallery Upload

**User Story:** As an Org_Admin, I want to upload multiple images for a merchandise type with preview and reordering, so that customers can see the product from different angles.

#### Acceptance Criteria

1. THE Merchandise_Module SHALL allow the Org_Admin to upload one or more images for a Merchandise_Type
2. THE Merchandise_Module SHALL display uploaded images as a gallery with preview thumbnails
3. THE Merchandise_Module SHALL allow the Org_Admin to remove individual images from the gallery
4. THE Merchandise_Module SHALL store image references as an array of URLs in the images field of the Merchandise_Type
5. THE Merchandise_Module SHALL require at least one image before allowing the Merchandise_Type to be saved

### Requirement 15: Email Notification Configuration

**User Story:** As an Org_Admin, I want to configure admin notification emails and custom confirmation messages for merchandise orders, so that the right people are notified and customers receive appropriate confirmations.

#### Acceptance Criteria

1. THE Merchandise_Module SHALL allow the Org_Admin to enter one or more admin notification email addresses (comma-separated) per Merchandise_Type
2. THE Merchandise_Module SHALL allow the Org_Admin to enter a custom confirmation message per Merchandise_Type
3. WHEN the Merchandise_Type is saved, THE Merchandise_Module SHALL persist the adminNotificationEmails and customConfirmationMessage fields to the backend

### Requirement 16: Price Calculator Correctness

**User Story:** As a developer, I want the price calculator to correctly compute prices, delivery fees, and validate quantities, so that order totals are accurate.

#### Acceptance Criteria

1. FOR ALL valid Merchandise_Types and selected options, THE Price_Calculator SHALL compute the unit price as the sum of prices from the selected Option_Values
2. FOR ALL valid quantities and Merchandise_Types, THE Price_Calculator SHALL compute the subtotal as unit price multiplied by quantity
3. FOR ALL valid Merchandise_Types with delivery type "free", THE Price_Calculator SHALL return a delivery fee of zero
4. FOR ALL valid Merchandise_Types with delivery type "fixed", THE Price_Calculator SHALL return the configured delivery fee regardless of quantity
5. FOR ALL valid Merchandise_Types with quantity-based delivery, THE Price_Calculator SHALL return the fee from the matching Delivery_Rule
6. FOR ALL Delivery_Rule sets, THE Price_Calculator SHALL detect overlapping quantity ranges and report validation errors
7. FOR ALL Delivery_Rule sets, THE Price_Calculator SHALL detect gaps between consecutive quantity ranges and report validation errors
8. THE Price_Calculator SHALL satisfy the invariant: totalPrice equals subtotal plus deliveryFee for all valid calculations
9. FOR ALL quantities below the minimum, above the maximum, or not matching the increment, THE Price_Calculator SHALL return an invalid result with appropriate error messages

