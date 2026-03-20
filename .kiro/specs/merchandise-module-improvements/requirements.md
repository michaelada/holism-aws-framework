# Requirements Document

## Introduction

This specification covers three improvements to the existing Merchandise Administration module to bring it to parity with other modules (Memberships, Events, Registrations):

1. Payment methods fetching should use the same pattern as other modules instead of falling back to hardcoded methods
2. Terms and Conditions editor should use ReactQuill rich text editor instead of a plain TextField
3. A Discounts sub-menu and dedicated discounts management page should be added to the merchandise navigation

## Glossary

- **Merchandise_Module**: The org-admin module at `packages/orgadmin-merchandise/` that provides merchandise administration functionality
- **CreateMerchandiseTypePage**: The page component at `packages/orgadmin-merchandise/src/pages/CreateMerchandiseTypePage.tsx` used for creating and editing merchandise types
- **Payment_Method**: A configured payment option (e.g. Pay Offline, Card Payment via Stripe, Helix Pay) available to an organisation, fetched from the backend
- **Payment_Methods_API**: The backend endpoint `GET /api/payment-methods` that returns all configured payment methods for the authenticated organisation
- **ReactQuill_Editor**: The `ReactQuill` rich text editor component with "snow" theme used across the platform for rich text content such as Terms and Conditions
- **Toolbar_Configuration**: The standard ReactQuill toolbar config used by MembershipTypeForm: headers (1, 2, 3), bold, italic, underline, ordered/bullet lists, and clean formatting
- **Module_Navigation**: The `subMenuItems` array and `routes` array in the module's `index.ts` that define the sidebar navigation links and routable pages
- **Discounts_Page**: A dedicated page for managing merchandise discounts, following the same pattern as `DiscountsListPage` in the memberships and events modules
- **Org_Admin**: An authenticated user with administrative access to an organisation's merchandise settings
- **Module_Registration**: The configuration object exported from `index.ts` that defines a module's routes, sub-menu items, capability requirements, and card display

## Requirements

### Requirement 1: Payment Methods Fetching Alignment

**User Story:** As an Org_Admin, I want the merchandise payment methods dropdown to show all payment methods configured for my organisation, so that I can select from the same options available in memberships and events.

#### Acceptance Criteria

1. WHEN the CreateMerchandiseTypePage loads, THE Merchandise_Module SHALL fetch payment methods from the Payment_Methods_API and display all returned methods in the payment methods dropdown
2. IF the Payment_Methods_API returns an empty array, THEN THE Merchandise_Module SHALL display an empty payment methods dropdown with no fallback to hardcoded methods
3. IF the Payment_Methods_API request fails, THEN THE Merchandise_Module SHALL display an error message and set the payment methods list to an empty array
4. THE Merchandise_Module SHALL remove the hardcoded fallback payment methods (`pay-offline` and `stripe`) from the `loadPaymentMethods` function
5. WHEN payment methods are loaded, THE Merchandise_Module SHALL pass them to the payment method selector using the same `Array<{ id: string; name: string }>` shape used by MembershipTypeForm

### Requirement 2: Rich Text Editor for Terms and Conditions

**User Story:** As an Org_Admin, I want to format Terms and Conditions content with headings, bold, italic, underline, and lists, so that the T&C content is readable and well-structured for customers.

#### Acceptance Criteria

1. WHEN the Org_Admin enables Terms and Conditions on the merchandise type form, THE Merchandise_Module SHALL render a ReactQuill_Editor with the "snow" theme for the terms content field
2. THE Merchandise_Module SHALL configure the ReactQuill_Editor with the same Toolbar_Configuration as MembershipTypeForm: headers (1, 2, 3, normal), bold, italic, underline, ordered list, bullet list, and clean formatting
3. THE Merchandise_Module SHALL remove the plain `TextField multiline` currently used for Terms and Conditions content
4. WHEN the Org_Admin edits content in the ReactQuill_Editor, THE Merchandise_Module SHALL update the `termsAndConditions` field in the form data with the HTML string value
5. WHEN editing an existing merchandise type, THE Merchandise_Module SHALL populate the ReactQuill_Editor with the previously saved `termsAndConditions` HTML content
6. THE Merchandise_Module SHALL import the ReactQuill CSS stylesheet (`react-quill/dist/quill.snow.css`) in the CreateMerchandiseTypePage component
7. THE Merchandise_Module SHALL display a label above the ReactQuill_Editor using `Typography variant="subtitle2"` with the translated `merchandise.fields.termsAndConditionsContent` key, matching the MembershipTypeForm layout

### Requirement 3: Discounts Sub-Menu and Navigation

**User Story:** As an Org_Admin, I want a Discounts section in the Merchandise navigation, so that I can manage merchandise discounts from a dedicated page alongside Merchandise Types and Merchandise Orders.

#### Acceptance Criteria

1. THE Module_Navigation SHALL include three sub-menu items: Merchandise Types, Discounts, and Merchandise Orders
2. THE Merchandise_Module SHALL add a "Discounts" sub-menu item with path `/merchandise/discounts`, a discount icon, and the `merchandise-discounts` capability requirement
3. THE Merchandise_Module SHALL add a "Merchandise Types" sub-menu item with path `/merchandise` and the MerchandiseIcon
4. THE Merchandise_Module SHALL add a "Merchandise Orders" sub-menu item with path `/merchandise/orders` and the MerchandiseIcon
5. WHEN the organisation has the `merchandise-discounts` capability, THE Module_Navigation SHALL display the Discounts sub-menu item
6. WHEN the organisation does not have the `merchandise-discounts` capability, THE Module_Navigation SHALL hide the Discounts sub-menu item
7. THE Merchandise_Module SHALL add routes for the discounts pages: list (`merchandise/discounts`), create (`merchandise/discounts/new`), and edit (`merchandise/discounts/:id/edit`), each gated by the `merchandise-discounts` capability
8. THE Merchandise_Module SHALL replace the single `menuItem` property with a `subMenuItems` array in the module registration, following the same pattern as the memberships module
9. THE Merchandise_Module SHALL use lazy-loaded page components for the discounts routes, importing `DiscountsListPage`, `CreateDiscountPage`, and `EditDiscountPage` from the pages directory
