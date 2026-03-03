# Requirements Document: Discount Management System

## Introduction

This document specifies the requirements for a comprehensive discount management system for the OrgAdmin platform. The system enables organizations to create, manage, and apply various types of discounts across multiple modules (Events, Memberships, Calendar, Merchandise, and Registrations). The discount system is capability-based, flexible, and designed to support complex discount scenarios including percentage discounts, fixed amount discounts, quantity-based discounts, and cart-level discounts.

## Glossary

- **Discount_System**: The complete discount management functionality including creation, application, validation, and tracking
- **Discount_Definition**: A reusable discount configuration that specifies type, value, scope, eligibility, and validity
- **Discount_Application**: The association between a discount definition and a target entity (event, activity, membership, etc.)
- **Target_Entity**: An item that can have discounts applied (event, event activity, membership type, calendar, merchandise, registration)
- **Module_Type**: One of the five supported modules: events, memberships, calendar, merchandise, registrations
- **Discount_Code**: An optional alphanumeric code that users can enter to activate a discount
- **Eligibility_Criteria**: Rules that determine whether a user or purchase qualifies for a discount
- **Usage_Limit**: Restrictions on how many times a discount can be used (total or per user)
- **Discount_Calculator**: The engine that computes final prices after applying one or more discounts
- **Cart**: A collection of items being purchased together
- **Organization_Admin**: A user with appropriate capability permissions to manage discounts
- **Account_User**: An end user who can apply discounts during checkout

## Requirements

### Requirement 1: Capability-Based Access Control

**User Story:** As a super admin, I want to control which organizations can use discount functionality per module, so that I can enable features based on their subscription tier.

#### Acceptance Criteria

1. THE Discount_System SHALL support five module-specific capabilities: entry-discounts, membership-discounts, calendar-discounts, merchandise-discounts, and registration-discounts
2. WHEN an organization has a discount capability enabled, THE Discount_System SHALL display the Discounts menu item in the corresponding module submenu
3. WHEN an organization does not have a discount capability enabled, THE Discount_System SHALL hide all discount functionality for that module
4. WHEN an Organization_Admin attempts to access discount functionality, THE Discount_System SHALL verify the user has the appropriate capability permission
5. THE Discount_System SHALL enforce capability checks at both the API level and UI level

### Requirement 2: Discount Definition Management

**User Story:** As an organization admin, I want to create and manage discount definitions, so that I can configure various promotional offers for my organization.

#### Acceptance Criteria

1. WHEN creating a Discount_Definition, THE Discount_System SHALL require name, module type, discount type, and discount value
2. THE Discount_System SHALL support two discount types: percentage and fixed amount
3. WHEN discount type is percentage, THE Discount_System SHALL validate that discount value is between 0 and 100
4. WHEN discount type is fixed amount, THE Discount_System SHALL validate that discount value is greater than 0
5. THE Discount_System SHALL allow optional fields: description, discount code, validity period, usage limits, eligibility criteria, and combination rules
6. THE Discount_System SHALL scope all Discount_Definitions to the creating organization
7. WHEN updating a Discount_Definition, THE Discount_System SHALL preserve the discount ID and creation metadata
8. WHEN deleting a Discount_Definition, THE Discount_System SHALL remove all associated Discount_Applications
9. THE Discount_System SHALL support active and inactive status for Discount_Definitions
10. WHEN a Discount_Definition is inactive, THE Discount_System SHALL prevent it from being applied to new Target_Entities

### Requirement 3: Discount Application Scopes

**User Story:** As an organization admin, I want to apply discounts at different scopes, so that I can create targeted promotional strategies.

#### Acceptance Criteria

1. THE Discount_System SHALL support four application scopes: item-level, category-level, cart-level, and quantity-based
2. WHEN application scope is item-level, THE Discount_System SHALL allow the discount to be applied to specific Target_Entities
3. WHEN application scope is category-level, THE Discount_System SHALL allow the discount to be applied to groups of Target_Entities
4. WHEN application scope is cart-level, THE Discount_System SHALL apply the discount to the entire cart total
5. WHEN application scope is quantity-based, THE Discount_System SHALL require minimum quantity and apply-to quantity rules
6. THE Discount_System SHALL validate that application scope is compatible with the module type

### Requirement 4: Discount Code Management

**User Story:** As an organization admin, I want to create optional discount codes, so that I can distribute targeted promotions to specific user groups.

#### Acceptance Criteria

1. WHEN creating a Discount_Definition, THE Discount_System SHALL allow an optional alphanumeric Discount_Code
2. WHEN a Discount_Code is provided, THE Discount_System SHALL enforce uniqueness within the organization
3. THE Discount_System SHALL support Discount_Codes with minimum length of 3 characters and maximum length of 50 characters
4. WHEN a Discount_Definition has a Discount_Code, THE Discount_System SHALL require Account_Users to enter the code to activate the discount
5. WHEN a Discount_Definition has no Discount_Code, THE Discount_System SHALL automatically apply the discount if eligibility criteria are met

### Requirement 5: Validity Period Management

**User Story:** As an organization admin, I want to set validity periods for discounts, so that I can run time-limited promotions.

#### Acceptance Criteria

1. WHEN creating a Discount_Definition, THE Discount_System SHALL allow optional valid-from and valid-until dates
2. WHEN valid-from date is set, THE Discount_System SHALL prevent discount application before that date
3. WHEN valid-until date is set, THE Discount_System SHALL prevent discount application after that date
4. WHEN both dates are set, THE Discount_System SHALL validate that valid-from is before valid-until
5. WHEN valid-until date passes, THE Discount_System SHALL automatically update discount status to expired
6. WHEN no validity dates are set, THE Discount_System SHALL allow the discount to be used indefinitely while active

### Requirement 6: Usage Limit Enforcement

**User Story:** As an organization admin, I want to set usage limits on discounts, so that I can control the total cost of promotional campaigns.

#### Acceptance Criteria

1. WHEN creating a Discount_Definition, THE Discount_System SHALL allow optional total usage limit and per-user usage limit
2. WHEN total usage limit is set, THE Discount_System SHALL track the number of times the discount has been used
3. WHEN total usage limit is reached, THE Discount_System SHALL prevent further applications of the discount
4. WHEN per-user limit is set, THE Discount_System SHALL track usage per Account_User
5. WHEN per-user limit is reached for a user, THE Discount_System SHALL prevent that user from using the discount again
6. THE Discount_System SHALL increment usage counters atomically to prevent race conditions
7. WHEN no usage limits are set, THE Discount_System SHALL allow unlimited usage while the discount is active

### Requirement 7: Eligibility Criteria Validation

**User Story:** As an organization admin, I want to set eligibility criteria for discounts, so that I can target specific customer segments.

#### Acceptance Criteria

1. WHEN creating a Discount_Definition, THE Discount_System SHALL allow optional eligibility criteria including membership types, user groups, and minimum purchase amount
2. WHEN membership types are specified, THE Discount_System SHALL validate that the Account_User has one of the specified membership types
3. WHEN user groups are specified, THE Discount_System SHALL validate that the Account_User belongs to one of the specified groups
4. WHEN minimum purchase amount is specified, THE Discount_System SHALL validate that the cart total meets or exceeds the minimum
5. WHEN maximum discount amount is specified, THE Discount_System SHALL cap the calculated discount at that amount
6. WHEN multiple eligibility criteria are specified, THE Discount_System SHALL require all criteria to be met
7. WHEN no eligibility criteria are specified, THE Discount_System SHALL allow all Account_Users to use the discount

### Requirement 8: Discount Combination Rules

**User Story:** As an organization admin, I want to control whether discounts can be combined, so that I can prevent excessive discounting.

#### Acceptance Criteria

1. WHEN creating a Discount_Definition, THE Discount_System SHALL allow specification of whether the discount is combinable with other discounts
2. WHEN creating a Discount_Definition, THE Discount_System SHALL allow specification of a priority value for discount application order
3. WHEN multiple discounts apply to an item, THE Discount_System SHALL sort them by priority in descending order
4. WHEN a non-combinable discount is applied, THE Discount_System SHALL skip all lower-priority discounts
5. WHEN combinable discounts are applied, THE Discount_System SHALL apply each discount sequentially to the remaining amount
6. THE Discount_System SHALL ensure that combined discounts never result in a negative final price

### Requirement 9: Events Module Integration

**User Story:** As an organization admin with entry-discounts capability, I want to apply discounts to events and activities, so that I can offer promotional pricing for event entries.

#### Acceptance Criteria

1. WHEN entry-discounts capability is enabled, THE Discount_System SHALL add a Discounts menu item to the Events module submenu
2. THE Discount_System SHALL provide a discounts list page showing all event-related discounts
3. THE Discount_System SHALL provide a create/edit discount page with multi-step wizard for event discounts
4. WHEN creating an event on Step 1, THE Discount_System SHALL display a checkbox to enable discount selection if event discounts exist
5. WHEN the discount checkbox is enabled, THE Discount_System SHALL display a multi-select dropdown of applicable event-level discounts
6. WHEN creating activities on Step 4, THE Discount_System SHALL display a checkbox per activity to enable discount selection if event discounts exist
7. WHEN the activity discount checkbox is enabled, THE Discount_System SHALL display a multi-select dropdown of applicable activity-level discounts
8. THE Discount_System SHALL save selected discounts as Discount_Applications linked to the event or activity
9. WHEN displaying event details, THE Discount_System SHALL show all applied discounts
10. WHEN calculating event entry prices, THE Discount_Calculator SHALL apply all applicable discounts

### Requirement 10: Discount List Page

**User Story:** As an organization admin, I want to view all discounts for my module, so that I can manage my promotional campaigns.

#### Acceptance Criteria

1. THE Discount_System SHALL display a table view of all discounts for the current module and organization
2. THE Discount_System SHALL show columns: name, type, value, scope, status, usage count, and actions
3. THE Discount_System SHALL provide filters for status, discount type, and application scope
4. THE Discount_System SHALL provide search functionality by name or discount code
5. THE Discount_System SHALL provide actions: edit, activate/deactivate, delete, and view usage
6. WHEN clicking edit, THE Discount_System SHALL navigate to the edit discount page
7. WHEN clicking delete, THE Discount_System SHALL show a confirmation dialog
8. WHEN confirming delete, THE Discount_System SHALL remove the discount and all its applications
9. THE Discount_System SHALL display usage statistics including total uses and remaining uses

### Requirement 11: Create/Edit Discount Wizard

**User Story:** As an organization admin, I want a guided wizard to create discounts, so that I can configure all discount settings correctly.

#### Acceptance Criteria

1. THE Discount_System SHALL provide a multi-step wizard with five steps: Basic Information, Discount Configuration, Eligibility Criteria, Validity and Limits, and Review
2. WHEN on Step 1, THE Discount_System SHALL collect name, description, discount code, and status
3. WHEN on Step 2, THE Discount_System SHALL collect discount type, discount value, application scope, and quantity rules
4. WHEN on Step 3, THE Discount_System SHALL collect eligibility criteria including membership types, user groups, minimum purchase, and maximum discount
5. WHEN on Step 4, THE Discount_System SHALL collect validity dates, usage limits, combinable flag, and priority
6. WHEN on Step 5, THE Discount_System SHALL display a summary of all settings for review
7. THE Discount_System SHALL validate each step before allowing progression to the next step
8. THE Discount_System SHALL allow navigation back to previous steps to make changes
9. WHEN saving the discount, THE Discount_System SHALL create or update the Discount_Definition
10. WHEN saving fails, THE Discount_System SHALL display validation errors and remain on the current step

### Requirement 12: Discount Selector Component

**User Story:** As an organization admin, I want a reusable component to apply discounts to items, so that I have a consistent experience across modules.

#### Acceptance Criteria

1. THE Discount_System SHALL provide a reusable Discount_Selector component
2. THE Discount_Selector SHALL only display if discounts exist for the current module
3. THE Discount_Selector SHALL display a checkbox labeled "Apply Discounts"
4. WHEN the checkbox is checked, THE Discount_Selector SHALL display a multi-select dropdown
5. THE Discount_Selector SHALL load applicable discounts from the API based on module type
6. THE Discount_Selector SHALL display discount name, type, and value in the dropdown options
7. THE Discount_Selector SHALL show discount details on hover
8. THE Discount_Selector SHALL validate that selected discounts are compatible with the target entity
9. THE Discount_Selector SHALL emit selected discount IDs to the parent component
10. THE Discount_Selector SHALL support both single-select and multi-select modes

### Requirement 13: Discount Calculation Engine

**User Story:** As a system, I want to accurately calculate discounted prices, so that customers are charged the correct amount.

#### Acceptance Criteria

1. WHEN calculating a percentage discount, THE Discount_Calculator SHALL multiply the item price by the discount value divided by 100
2. WHEN calculating a fixed amount discount, THE Discount_Calculator SHALL subtract the discount value from the item price
3. WHEN calculating quantity-based discounts, THE Discount_Calculator SHALL apply the discount to the specified quantity of items
4. WHEN applying multiple discounts, THE Discount_Calculator SHALL sort by priority and apply sequentially
5. WHEN a maximum discount amount is specified, THE Discount_Calculator SHALL cap the discount at that amount
6. THE Discount_Calculator SHALL ensure the final price is never negative
7. WHEN the discount exceeds the item price, THE Discount_Calculator SHALL set the final price to zero
8. THE Discount_Calculator SHALL return original amount, discount amount, and final amount for each calculation
9. THE Discount_Calculator SHALL handle cart-level discounts by applying them to the cart subtotal
10. THE Discount_Calculator SHALL round all monetary values to two decimal places

### Requirement 14: Discount Usage Tracking

**User Story:** As an organization admin, I want to track discount usage, so that I can analyze the effectiveness of my promotions.

#### Acceptance Criteria

1. WHEN a discount is applied to a completed transaction, THE Discount_System SHALL record a usage entry
2. THE Discount_System SHALL store user ID, transaction type, transaction ID, original amount, discount amount, and final amount
3. THE Discount_System SHALL increment the discount's usage counter atomically
4. THE Discount_System SHALL increment the user's usage counter for that discount atomically
5. THE Discount_System SHALL provide an API endpoint to retrieve usage statistics for a discount
6. THE Discount_System SHALL provide an API endpoint to retrieve usage history for a discount
7. THE Discount_System SHALL calculate total discount amount given across all uses
8. THE Discount_System SHALL calculate average discount amount per use
9. THE Discount_System SHALL identify top users of each discount
10. THE Discount_System SHALL support filtering usage history by date range and user

### Requirement 15: Database Schema

**User Story:** As a system, I want a robust database schema, so that discount data is stored reliably and efficiently.

#### Acceptance Criteria

1. THE Discount_System SHALL create a discounts table with columns for all Discount_Definition properties
2. THE Discount_System SHALL create a discount_applications table to link discounts to Target_Entities
3. THE Discount_System SHALL create a discount_usage table to track all discount applications
4. THE Discount_System SHALL enforce foreign key constraints to maintain referential integrity
5. THE Discount_System SHALL create indexes on organisation_id, module_type, code, and status columns
6. THE Discount_System SHALL create indexes on discount_id and target_id in the applications table
7. THE Discount_System SHALL create indexes on discount_id and user_id in the usage table
8. THE Discount_System SHALL use JSONB columns for complex data structures like quantity rules and eligibility criteria
9. THE Discount_System SHALL enforce unique constraint on discount code per organization
10. THE Discount_System SHALL use CASCADE delete for discount_applications when a discount is deleted

### Requirement 16: Backend API Endpoints

**User Story:** As a frontend application, I want RESTful API endpoints, so that I can perform all discount operations.

#### Acceptance Criteria

1. THE Discount_System SHALL provide GET endpoint to list all discounts for an organization and module
2. THE Discount_System SHALL provide GET endpoint to retrieve a single discount by ID
3. THE Discount_System SHALL provide POST endpoint to create a new discount
4. THE Discount_System SHALL provide PUT endpoint to update an existing discount
5. THE Discount_System SHALL provide DELETE endpoint to delete a discount
6. THE Discount_System SHALL provide POST endpoint to apply a discount to a target entity
7. THE Discount_System SHALL provide DELETE endpoint to remove a discount from a target entity
8. THE Discount_System SHALL provide GET endpoint to retrieve all discounts for a target entity
9. THE Discount_System SHALL provide POST endpoint to validate a discount for a user and amount
10. THE Discount_System SHALL provide POST endpoint to calculate discounted prices
11. THE Discount_System SHALL provide GET endpoint to retrieve usage statistics for a discount
12. THE Discount_System SHALL require authentication for all endpoints
13. THE Discount_System SHALL require appropriate capability permission for all endpoints

### Requirement 17: Input Validation and Security

**User Story:** As a system, I want comprehensive input validation, so that invalid or malicious data is rejected.

#### Acceptance Criteria

1. WHEN receiving discount data, THE Discount_System SHALL validate all required fields are present
2. WHEN receiving discount data, THE Discount_System SHALL validate data types match the schema
3. WHEN receiving discount code, THE Discount_System SHALL sanitize the input to prevent injection attacks
4. WHEN receiving discount value, THE Discount_System SHALL validate it is within acceptable ranges
5. WHEN receiving dates, THE Discount_System SHALL validate they are valid ISO 8601 format
6. WHEN receiving JSON data, THE Discount_System SHALL validate it against the expected schema
7. THE Discount_System SHALL return descriptive error messages for validation failures
8. THE Discount_System SHALL log all validation failures for security monitoring
9. THE Discount_System SHALL rate-limit discount validation requests to prevent abuse
10. THE Discount_System SHALL verify organization ownership before allowing any discount operations

### Requirement 18: Error Handling

**User Story:** As a user, I want clear error messages, so that I understand what went wrong and how to fix it.

#### Acceptance Criteria

1. WHEN a discount code is not found, THE Discount_System SHALL return a 404 error with message "Discount code not found"
2. WHEN a discount has expired, THE Discount_System SHALL return a 400 error with message "Discount has expired"
3. WHEN usage limit is reached, THE Discount_System SHALL return a 400 error with message "Discount usage limit reached"
4. WHEN eligibility criteria are not met, THE Discount_System SHALL return a 400 error with specific criteria that failed
5. WHEN attempting to delete a discount in use, THE Discount_System SHALL return a 409 error with message "Cannot delete discount that is currently applied to items"
6. WHEN validation fails, THE Discount_System SHALL return a 400 error with field-specific error messages
7. WHEN authentication fails, THE Discount_System SHALL return a 401 error
8. WHEN capability check fails, THE Discount_System SHALL return a 403 error with message "Insufficient permissions"
9. WHEN a database error occurs, THE Discount_System SHALL return a 500 error and log the full error details
10. THE Discount_System SHALL never expose sensitive system information in error messages

### Requirement 19: Internationalization

**User Story:** As an organization in a non-English speaking country, I want discount UI in my language, so that my staff can use the system effectively.

#### Acceptance Criteria

1. THE Discount_System SHALL support translation keys for all UI text
2. THE Discount_System SHALL provide English translations as the default language
3. THE Discount_System SHALL load translations from the organization's configured language
4. THE Discount_System SHALL translate discount type labels (percentage, fixed amount)
5. THE Discount_System SHALL translate application scope labels (item, category, cart, quantity-based)
6. THE Discount_System SHALL translate status labels (active, inactive, expired)
7. THE Discount_System SHALL translate all form field labels and placeholders
8. THE Discount_System SHALL translate all validation error messages
9. THE Discount_System SHALL translate all success and confirmation messages
10. THE Discount_System SHALL format currency values according to the organization's locale

### Requirement 20: Performance and Scalability

**User Story:** As a system, I want efficient discount operations, so that the system remains responsive under load.

#### Acceptance Criteria

1. WHEN loading the discount list page, THE Discount_System SHALL return results within 500ms for up to 1000 discounts
2. WHEN calculating discounts for a cart, THE Discount_Calculator SHALL complete within 100ms for up to 50 items
3. WHEN validating a discount code, THE Discount_System SHALL respond within 200ms
4. THE Discount_System SHALL use database connection pooling to handle concurrent requests
5. THE Discount_System SHALL use indexes to optimize discount lookup queries
6. THE Discount_System SHALL cache frequently accessed discount definitions for 5 minutes
7. THE Discount_System SHALL use atomic operations for usage counter updates to prevent race conditions
8. THE Discount_System SHALL paginate discount list results with a default page size of 50
9. THE Discount_System SHALL support filtering and searching without loading all discounts into memory
10. THE Discount_System SHALL log slow queries that exceed 1 second for performance monitoring
