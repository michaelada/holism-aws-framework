# Requirements Document

## Introduction

The Registrations Module provides entity registration management for organisations. While the existing Memberships module handles people-based memberships, the Registrations module handles the registration of things — horses, vehicles, boats, equipment, or any entity that needs to be registered for a defined period. The module mirrors the Memberships module in structure and UX patterns but uses registration-specific terminology and a simplified data model (no group registrations). An existing backend service, API routes, and frontend package scaffold (`packages/orgadmin-registrations`) are already in place and need to be completed with full frontend pages, navigation integration, and feature parity with the memberships module's core workflows.

## Glossary

- **Registrations_Module**: The frontend package (`packages/orgadmin-registrations`) and associated backend services that manage entity registrations
- **Registration_Type**: A configuration template that defines how a category of entities is registered (e.g. "2026 Horse Registration"), including form, validity period, labels, payment methods, and terms
- **Registration**: A single record representing one registered entity, linked to a Registration_Type, an account user (owner), and a form submission
- **Registration_Number**: An auto-generated unique identifier assigned to each Registration
- **Entity_Name**: The name or identifier of the thing being registered (e.g. a horse name, vehicle plate number)
- **Registration_Status**: The lifecycle state of a Registration: "pending" (awaiting approval), "active" (approved and valid), or "elapsed" (expired)
- **Registration_Type_Status**: Whether a Registration_Type is "open" (accepting new registrations) or "closed" (visible but not accepting)
- **Registrations_Database_Page**: The main list view showing all registrations with search, filtering, batch operations, and export
- **Registration_Details_Page**: A read-only view of a single Registration's full details
- **Registration_Types_List_Page**: The list view showing all configured Registration_Types
- **Registration_Type_Details_Page**: A read-only view of a single Registration_Type's configuration
- **Create_Registration_Type_Page**: The form page for creating or editing a Registration_Type
- **Landing_Page**: The organisation admin dashboard where module cards are displayed
- **Shell**: The orgadmin-shell application that hosts module routing, navigation, and the Landing_Page
- **Capability**: An organisation-level feature flag; the registrations module requires the "registrations" capability
- **Batch_Operation**: An action applied to multiple selected registrations at once (mark processed/unprocessed, add/remove labels)
- **Custom_Filter**: A saved set of filter criteria that an admin can reuse when searching registrations
- **Discount**: A reusable discount definition (percentage or fixed amount) that can be associated with a Registration_Type to offer promotional pricing
- **Discount_Selector**: A shared UI component (`DiscountSelector` from `@aws-web-framework/components`) used to select and associate discounts with a Registration_Type
- **Discounts_List_Page**: The page listing all discounts configured for the registrations module
- **Create_Discount_Page**: The wizard page for creating or editing a discount for the registrations module
- **Form_Submission**: The data submitted through an application form when creating a registration
- **Rolling_Registration**: A registration validity model where the period starts from the date of registration and lasts a configured number of months
- **Fixed_Period_Registration**: A registration validity model where all registrations expire on a specific date

## Requirements

### Requirement 1: Module Registration and Landing Page Integration

**User Story:** As an organisation administrator, I want to see a Registrations card on the landing page when my organisation has the registrations capability enabled, so that I can access the registrations module.

#### Acceptance Criteria

1. WHILE the organisation has the "registrations" capability enabled, THE Registrations_Module SHALL display a card on the Landing_Page with a title, description, icon, and colour distinct from the memberships card
2. WHEN an administrator clicks the Registrations card on the Landing_Page, THE Shell SHALL navigate to the Registrations_Database_Page at the `/registrations` route
3. WHILE the organisation does not have the "registrations" capability enabled, THE Shell SHALL hide the Registrations card from the Landing_Page
4. THE Registrations_Module SHALL register sub-menu navigation items for "Registrations Database" (`/registrations`), "Registration Types" (`/registrations/types`), and "Discounts" (`/registrations/discounts`)
5. WHILE the organisation has the "registration-discounts" capability enabled, THE Shell SHALL display the "Discounts" sub-menu item in the Registrations_Module navigation
6. WHILE the organisation does not have the "registration-discounts" capability enabled, THE Shell SHALL hide the "Discounts" sub-menu item from the Registrations_Module navigation

### Requirement 2: Registration Types Management

**User Story:** As an organisation administrator, I want to create and manage registration types, so that I can define different categories of entity registrations my organisation offers.

#### Acceptance Criteria

1. WHEN an administrator navigates to the Registration_Types_List_Page, THE Registrations_Module SHALL display all Registration_Types for the organisation in a list showing name, entity name, status, and creation date
2. WHEN an administrator clicks "Create Registration Type", THE Registrations_Module SHALL navigate to the Create_Registration_Type_Page
3. THE Create_Registration_Type_Page SHALL collect the following fields: name, description, entity name, registration form, registration type status (open/closed), validity model (rolling or fixed period), validity parameters (number of months or valid-until date), automatic approval toggle, registration labels, supported payment methods, terms and conditions toggle, and terms and conditions text
4. WHEN an administrator submits a valid registration type form, THE Registrations_Module SHALL send a POST request to the `/api/orgadmin/registration-types` endpoint and navigate back to the Registration_Types_List_Page on success
5. WHEN an administrator clicks on a Registration_Type in the list, THE Registrations_Module SHALL navigate to the Registration_Type_Details_Page showing all configuration details
6. WHEN an administrator clicks "Edit" on a Registration_Type, THE Registrations_Module SHALL navigate to the Create_Registration_Type_Page pre-populated with the existing values
7. WHEN an administrator submits an edited registration type form, THE Registrations_Module SHALL send a PUT request to the `/api/orgadmin/registration-types/{id}` endpoint and navigate back to the Registration_Type_Details_Page on success
8. WHEN an administrator clicks "Delete" on a Registration_Type, THE Registrations_Module SHALL display a confirmation dialog before sending a DELETE request to the `/api/orgadmin/registration-types/{id}` endpoint
9. IF the API returns an error during registration type creation or update, THEN THE Registrations_Module SHALL display the error message to the administrator without losing form data

### Requirement 3: Registrations Database

**User Story:** As an organisation administrator, I want to view, search, and filter all registrations, so that I can manage registered entities efficiently.

#### Acceptance Criteria

1. WHEN an administrator navigates to the Registrations_Database_Page, THE Registrations_Module SHALL load and display all registrations for the organisation in a table showing registration type name, entity name, owner name, registration number, date last renewed, status, valid until, labels, and processed flag
2. WHEN an administrator types in the search field, THE Registrations_Module SHALL filter the displayed registrations by entity name, owner name, or registration number
3. WHEN an administrator selects a status toggle (current, elapsed, or all), THE Registrations_Module SHALL filter registrations accordingly where "current" includes active and pending statuses
4. WHEN an administrator selects a Custom_Filter from the dropdown, THE Registrations_Module SHALL apply the saved filter criteria to the registrations list
5. WHEN an administrator clicks "Create Filter", THE Registrations_Module SHALL open a dialog to define and save a new Custom_Filter with criteria for status, date ranges, labels, and registration types
6. THE Registrations_Module SHALL provide an "Export to Excel" button that downloads the currently filtered registrations as an Excel file

### Requirement 4: Registration Details and Viewing

**User Story:** As an organisation administrator, I want to view the full details of a registration, so that I can review the registered entity's information and form submission data.

#### Acceptance Criteria

1. WHEN an administrator clicks the view action on a registration row, THE Registrations_Module SHALL navigate to the Registration_Details_Page at `/registrations/{id}`
2. THE Registration_Details_Page SHALL display the registration number, entity name, owner name, registration type, status, valid until date, date last renewed, labels, processed flag, payment status, and the full form submission data
3. WHEN an administrator clicks "Back" on the Registration_Details_Page, THE Registrations_Module SHALL navigate back to the Registrations_Database_Page preserving the previous filter state

### Requirement 5: Batch Operations

**User Story:** As an organisation administrator, I want to perform actions on multiple registrations at once, so that I can efficiently manage large numbers of registrations.

#### Acceptance Criteria

1. WHEN an administrator selects one or more registrations using checkboxes, THE Registrations_Module SHALL display batch operation buttons for "Mark Processed", "Mark Unprocessed", "Add Labels", and "Remove Labels"
2. WHEN an administrator triggers a "Mark Processed" batch operation, THE Registrations_Module SHALL send a POST request to `/api/orgadmin/registrations/batch/mark-processed` with the selected registration IDs and refresh the list on success
3. WHEN an administrator triggers a "Mark Unprocessed" batch operation, THE Registrations_Module SHALL send a POST request to `/api/orgadmin/registrations/batch/mark-unprocessed` with the selected registration IDs and refresh the list on success
4. WHEN an administrator triggers an "Add Labels" batch operation, THE Registrations_Module SHALL open a dialog to select labels, then send a POST request to `/api/orgadmin/registrations/batch/add-labels` with the selected registration IDs and labels
5. WHEN an administrator triggers a "Remove Labels" batch operation, THE Registrations_Module SHALL open a dialog to select labels, then send a POST request to `/api/orgadmin/registrations/batch/remove-labels` with the selected registration IDs and labels
6. WHEN a batch operation completes, THE Registrations_Module SHALL clear the selection and display a success notification

### Requirement 6: Registration Creation via Form Submission

**User Story:** As an organisation administrator, I want to create a registration for an entity by filling out the registration type's form, so that I can register entities on behalf of account users.

#### Acceptance Criteria

1. WHILE at least one Registration_Type exists and the administrator has an admin role, THE Registrations_Module SHALL display an "Add Registration" button on the Registrations_Database_Page
2. WHEN only one Registration_Type exists and the administrator clicks "Add Registration", THE Registrations_Module SHALL navigate directly to the registration creation form pre-selecting that Registration_Type
3. WHEN multiple Registration_Types exist and the administrator clicks "Add Registration", THE Registrations_Module SHALL display a Registration_Type selector before showing the creation form
4. WHEN an administrator submits the registration creation form, THE Registrations_Module SHALL create a Form_Submission and a Registration record, assign a Registration_Number, and navigate back to the Registrations_Database_Page with a success notification
5. IF the registration type has automatic approval enabled, THEN THE Registrations_Module SHALL set the new Registration status to "active"
6. IF the registration type does not have automatic approval enabled, THEN THE Registrations_Module SHALL set the new Registration status to "pending"

### Requirement 7: Processed Flag Toggle

**User Story:** As an organisation administrator, I want to toggle the processed flag on individual registrations, so that I can track which registrations have been reviewed.

#### Acceptance Criteria

1. WHEN an administrator clicks the processed icon on a registration row, THE Registrations_Module SHALL toggle the processed flag by sending a PATCH request to the registration update endpoint
2. THE Registrations_Module SHALL display a filled check icon for processed registrations and an empty circle icon for unprocessed registrations

### Requirement 8: Automatic Status Expiry

**User Story:** As an organisation administrator, I want registrations to automatically transition to "elapsed" status when they expire, so that the registrations database reflects current validity.

#### Acceptance Criteria

1. WHEN the current date passes a Registration's valid-until date, THE Registrations_Module backend SHALL update the Registration status from "active" to "elapsed"
2. WHILE a Registration has status "elapsed", THE Registrations_Database_Page SHALL display the Registration under the "elapsed" status filter

### Requirement 9: Internationalisation Support

**User Story:** As an organisation administrator using a non-English locale, I want the registrations module to display all labels and messages in my configured language, so that I can use the module in my preferred language.

#### Acceptance Criteria

1. THE Registrations_Module SHALL use translation keys for all user-visible text including page titles, button labels, table headers, status labels, form labels, error messages, and success notifications
2. THE Registrations_Module SHALL format dates according to the user's configured locale

### Requirement 10: Discount Management for Registrations

**User Story:** As an organisation administrator, I want to view, create, and apply discounts to registration types, so that I can offer promotional pricing for entity registrations.

#### Acceptance Criteria

1. WHILE the organisation has the "registration-discounts" capability enabled, THE Registrations_Module SHALL provide a Discounts_List_Page at `/registrations/discounts` showing all discounts for the registrations module
2. WHEN an administrator clicks "Create Discount" on the Discounts_List_Page, THE Registrations_Module SHALL navigate to the Create_Discount_Page at `/registrations/discounts/new`
3. WHEN an administrator clicks "Edit" on a discount, THE Registrations_Module SHALL navigate to the Create_Discount_Page at `/registrations/discounts/:id/edit` pre-populated with the existing discount values
4. THE Registrations_Module SHALL fetch discounts from the `/api/orgadmin/organisations/:orgId/discounts/registrations` endpoint using the "registrations" module type
5. WHILE the organisation has the "registration-discounts" capability enabled and the administrator is editing or creating a Registration_Type, THE Create_Registration_Type_Page SHALL display a Discount_Selector component allowing the administrator to associate discounts with the Registration_Type
6. THE Discount_Selector SHALL load applicable discounts for the "registrations" module type and display discount name, type, and value for selection
7. WHEN an administrator saves a Registration_Type with selected discounts, THE Registrations_Module SHALL persist the associated discount IDs with the Registration_Type
8. WHILE the organisation does not have the "registration-discounts" capability enabled, THE Create_Registration_Type_Page SHALL hide the discount selection section
9. THE Registrations_Module SHALL gate all discount routes (`/registrations/discounts`, `/registrations/discounts/new`, `/registrations/discounts/:id/edit`) behind the "registration-discounts" capability
