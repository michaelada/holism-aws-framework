# Requirements Document

## Introduction

This feature integrates the existing discount management system from the Events module into the Memberships module. The integration will allow organization administrators to create and manage discounts from both the Events and Memberships sections, and associate discounts with Membership Types in the same way they are currently associated with Events.

## Glossary

- **Discount_System**: The existing discount management functionality currently implemented in the Events module (packages/orgadmin-events)
- **Membership_Module**: The memberships capability module (packages/orgadmin-memberships) that manages membership types and members
- **Events_Module**: The events capability module (packages/orgadmin-events) that manages events and activities
- **Membership_Type**: A membership category entity that defines membership characteristics (single or group, rolling or fixed-period, payment methods, etc.)
- **Discount**: An entity that defines a price reduction with specific rules (percentage or fixed amount, eligibility criteria, validity period, usage limits)
- **Discount_Association**: The relationship between a Discount and an entity (Event or Membership_Type) via a discountIds array field
- **Org_Admin**: An organization administrator user who has permission to manage discounts and membership types
- **Backend_API**: The REST API service layer that handles discount and membership type operations
- **Frontend_UI**: The React-based user interface components for managing discounts and membership types
- **Database_Schema**: The PostgreSQL database structure storing membership types and discounts

## Requirements

### Requirement 1: Add Discounts Navigation to Memberships Module

**User Story:** As an org admin, I want to access discount management from the Memberships section, so that I can manage membership-related discounts without switching to the Events section.

#### Acceptance Criteria

1. THE Membership_Module SHALL include a "Discounts" submenu item in its navigation
2. WHEN an org admin clicks the Discounts submenu item, THE Frontend_UI SHALL navigate to the discounts list page within the memberships context
3. THE Discounts submenu item SHALL appear after the existing "Members Database" and "Membership Types" menu items
4. THE Discounts submenu item SHALL only be visible if the organisation has the 'entry-discounts' capability enabled

### Requirement 2: Reuse Discount Pages in Memberships Module

**User Story:** As an org admin, I want to use the same discount management interface in both Events and Memberships sections, so that I have a consistent experience across modules.

#### Acceptance Criteria

1. THE Membership_Module SHALL reuse the existing DiscountsListPage component from the Events_Module
2. THE Membership_Module SHALL reuse the existing CreateDiscountPage component from the Events_Module
3. THE Membership_Module SHALL reuse the existing EditDiscountPage component from the Events_Module
4. WHEN discount pages are rendered in the Memberships context, THE Frontend_UI SHALL set the moduleType parameter to 'memberships'
5. WHEN discount pages are rendered in the Events context, THE Frontend_UI SHALL set the moduleType parameter to 'events'
6. THE Backend_API SHALL filter discounts by moduleType when retrieving discounts for a specific module

### Requirement 3: Add Discount Association to Membership Types

**User Story:** As an org admin, I want to associate one or more discounts with a Membership Type, so that members can receive discounts when purchasing that membership type.

#### Acceptance Criteria

1. THE Database_Schema SHALL include a discount_ids column in the membership_types table of type JSONB
2. THE Membership_Type interface SHALL include a discountIds field of type string array
3. WHEN creating a Membership_Type, THE Backend_API SHALL accept a discountIds array parameter
4. WHEN updating a Membership_Type, THE Backend_API SHALL accept a discountIds array parameter
5. WHEN retrieving a Membership_Type, THE Backend_API SHALL parse the discount_ids JSONB column into a string array
6. THE Backend_API SHALL validate that all discount IDs in the discountIds array exist and belong to the organisation
7. IF a discount ID does not exist or does not belong to the organisation, THEN THE Backend_API SHALL return a validation error

### Requirement 4: Add Discount Selector to Membership Type Forms

**User Story:** As an org admin, I want to select discounts when creating or editing a Membership Type, so that I can configure which discounts apply to that membership type.

#### Acceptance Criteria

1. THE CreateSingleMembershipTypePage SHALL include a discount selector component
2. THE CreateGroupMembershipTypePage SHALL include a discount selector component
3. THE discount selector component SHALL display all active discounts with moduleType 'memberships'
4. WHEN an org admin selects discounts, THE Frontend_UI SHALL update the discountIds field in the form data
5. THE discount selector component SHALL support selecting multiple discounts
6. THE discount selector component SHALL display selected discounts as removable chips
7. THE discount selector component SHALL only be visible if the organisation has the 'entry-discounts' capability enabled

### Requirement 5: Display Associated Discounts in Membership Type Views

**User Story:** As an org admin, I want to see which discounts are associated with a Membership Type, so that I can understand the pricing structure at a glance.

#### Acceptance Criteria

1. THE MembershipTypesListPage SHALL display a discount count column showing the number of associated discounts
2. THE MembershipTypeDetailsPage SHALL display a list of associated discounts with their names and values
3. WHEN a Membership_Type has no associated discounts, THE Frontend_UI SHALL display "No discounts" or an empty state
4. WHEN displaying discount information, THE Frontend_UI SHALL fetch discount details from the Backend_API using the discount IDs
5. THE discount display SHALL show discount name, type (percentage or fixed), and value
6. IF a discount ID in discountIds no longer exists, THEN THE Frontend_UI SHALL display "Discount not found" for that entry

### Requirement 6: Shared Discount Management Across Modules

**User Story:** As an org admin, I want discounts created in either Events or Memberships to be available in both modules, so that I can reuse discounts across different contexts.

#### Acceptance Criteria

1. THE Backend_API SHALL store all discounts in a single discounts table
2. THE Backend_API SHALL use the moduleType field to distinguish between 'events' and 'memberships' discounts
3. WHEN retrieving discounts for the Events_Module, THE Backend_API SHALL filter by moduleType = 'events'
4. WHEN retrieving discounts for the Membership_Module, THE Backend_API SHALL filter by moduleType = 'memberships'
5. THE Backend_API SHALL use the same discount service and routes for both modules
6. WHEN creating a discount from the Memberships section, THE Backend_API SHALL set moduleType to 'memberships'
7. WHEN creating a discount from the Events section, THE Backend_API SHALL set moduleType to 'events'

### Requirement 7: Database Migration for Membership Type Discount Association

**User Story:** As a system administrator, I want the database schema to support discount associations for Membership Types, so that the feature can store and retrieve discount relationships.

#### Acceptance Criteria

1. THE Database_Schema SHALL include a migration script to add the discount_ids column to membership_types table
2. THE discount_ids column SHALL be of type JSONB
3. THE discount_ids column SHALL default to an empty JSON array '[]'
4. THE discount_ids column SHALL allow NULL values for backward compatibility
5. THE migration script SHALL be idempotent and safe to run multiple times
6. THE migration script SHALL not modify existing membership type records

### Requirement 8: Backend Service Updates for Discount Association

**User Story:** As a developer, I want the membership service to handle discount associations, so that the backend can properly manage the relationship between membership types and discounts.

#### Acceptance Criteria

1. THE MembershipService createMembershipType method SHALL accept discountIds in the CreateMembershipTypeDto
2. THE MembershipService updateMembershipType method SHALL accept discountIds in the UpdateMembershipTypeDto
3. WHEN creating a Membership_Type with discountIds, THE MembershipService SHALL serialize the array to JSON and store it in the discount_ids column
4. WHEN updating a Membership_Type with discountIds, THE MembershipService SHALL serialize the array to JSON and update the discount_ids column
5. WHEN retrieving a Membership_Type, THE MembershipService SHALL deserialize the discount_ids JSONB column to a string array
6. IF the discount_ids column contains invalid JSON, THEN THE MembershipService SHALL return an empty array
7. THE MembershipService SHALL validate discount IDs by calling the discount service to verify they exist

### Requirement 9: Discount Validation for Membership Types

**User Story:** As an org admin, I want the system to validate discount associations, so that I cannot associate invalid or deleted discounts with membership types.

#### Acceptance Criteria

1. WHEN saving a Membership_Type with discountIds, THE Backend_API SHALL validate each discount ID exists
2. WHEN saving a Membership_Type with discountIds, THE Backend_API SHALL validate each discount belongs to the same organisation
3. WHEN saving a Membership_Type with discountIds, THE Backend_API SHALL validate each discount has moduleType 'memberships'
4. IF any discount validation fails, THEN THE Backend_API SHALL return a 400 error with a descriptive message
5. THE validation error message SHALL specify which discount ID failed validation and why
6. THE Backend_API SHALL allow saving a Membership_Type with an empty discountIds array

### Requirement 10: Discount Deletion Impact on Membership Types

**User Story:** As an org admin, I want to understand the impact of deleting a discount, so that I can make informed decisions about discount management.

#### Acceptance Criteria

1. WHEN deleting a discount, THE Backend_API SHALL check if it is associated with any Membership_Type
2. IF a discount is associated with one or more Membership_Types, THEN THE Backend_API SHALL return a 409 error indicating the discount is in use
3. THE error message SHALL include the count of affected Membership_Types
4. THE Backend_API SHALL provide an endpoint to retrieve all Membership_Types associated with a specific discount
5. THE Org_Admin SHALL be able to force delete a discount, which removes it from all associated Membership_Types
6. WHEN force deleting a discount, THE Backend_API SHALL update all affected Membership_Types to remove the discount ID from their discountIds arrays

