# Implementation Plan: Membership Discount Integration

## Overview

This implementation integrates the existing discount management system into the Memberships module by reusing discount pages, extending the membership types database schema, and adding discount selection capabilities to membership type forms. The approach minimizes new code by leveraging existing discount infrastructure with module-scoped filtering.

## Tasks

- [x] 1. Database migration for membership type discount association
  - Create migration file to add discount_ids JSONB column to membership_types table
  - Set default value to empty JSON array '[]'
  - Add GIN index on discount_ids for efficient lookups
  - Ensure migration is idempotent and preserves existing data
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6_

- [x] 1.1 Write property test for migration idempotency
  - **Property 20: Migration Idempotency**
  - **Validates: Requirements 7.5**

- [x] 1.2 Write property test for migration data preservation
  - **Property 21: Migration Data Preservation**
  - **Validates: Requirements 7.6**

- [x] 2. Extend backend TypeScript types for discount association
  - Add discountIds field to MembershipType interface
  - Add discountIds to CreateMembershipTypeDto
  - Add discountIds to UpdateMembershipTypeDto
  - Create DiscountValidationResult interface
  - _Requirements: 3.2, 8.1, 8.2_

- [x] 3. Implement discount validation in membership service
  - [x] 3.1 Create validateDiscountIds method in membership service
    - Validate discount existence using batch query
    - Validate organization ownership
    - Validate moduleType is 'memberships'
    - Return detailed validation errors with discount ID and reason
    - _Requirements: 3.6, 3.7, 9.1, 9.2, 9.3, 9.4, 9.5, 9.6_

  - [x] 3.2 Write property test for discount ID existence validation
    - **Property 4: Discount ID Existence Validation**
    - **Validates: Requirements 9.1**

  - [x] 3.3 Write property test for organization ownership validation
    - **Property 5: Discount Organization Ownership Validation**
    - **Validates: Requirements 9.2**

  - [x] 3.4 Write property test for module type validation
    - **Property 6: Discount Module Type Validation**
    - **Validates: Requirements 9.3**

  - [x] 3.5 Write property test for validation error message completeness
    - **Property 7: Validation Error Message Completeness**
    - **Validates: Requirements 9.5**

- [x] 4. Update membership service CRUD operations
  - [x] 4.1 Extend createMembershipType to handle discountIds
    - Accept discountIds in CreateMembershipTypeDto
    - Call validateDiscountIds before saving
    - Serialize discountIds array to JSON for database storage
    - _Requirements: 3.3, 8.1, 8.3_

  - [x] 4.2 Extend updateMembershipType to handle discountIds
    - Accept discountIds in UpdateMembershipTypeDto
    - Call validateDiscountIds before updating
    - Serialize discountIds array to JSON for database storage
    - _Requirements: 3.4, 8.2, 8.4_

  - [x] 4.3 Update getMembershipTypeById to deserialize discountIds
    - Parse discount_ids JSONB column to string array
    - Handle invalid JSON by returning empty array
    - Handle null values by returning empty array
    - _Requirements: 3.5, 8.5, 8.6_

  - [x] 4.4 Write property test for discountIds serialization round trip
    - **Property 3: Discount IDs Serialization Round Trip**
    - **Validates: Requirements 3.5**

  - [x] 4.5 Write property test for API parameter acceptance on create
    - **Property 22: API Parameter Acceptance for Create**
    - **Validates: Requirements 3.3**

  - [x] 4.6 Write property test for API parameter acceptance on update
    - **Property 23: API Parameter Acceptance for Update**
    - **Validates: Requirements 3.4**

  - [x] 4.7 Write property test for default empty array behavior
    - **Property 19: Default Empty Array for New Membership Types**
    - **Validates: Requirements 7.3**

  - [x] 4.8 Write unit tests for membership service discount handling
    - Test creating membership type with valid discountIds
    - Test updating membership type with new discountIds
    - Test validation error scenarios
    - Test empty discountIds array handling
    - Test invalid JSON handling
    - _Requirements: 3.3, 3.4, 3.5, 8.3, 8.4, 8.5, 8.6_

- [x] 5. Checkpoint - Ensure backend tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Implement discount deletion impact checking
  - [x] 6.1 Create getMembershipTypesUsingDiscount method in discount service
    - Query membership_types table for records containing discount ID in discount_ids array
    - Return array of membership type IDs
    - _Requirements: 10.1, 10.4_

  - [x] 6.2 Update discount deletion logic to check associations
    - Call getMembershipTypesUsingDiscount before deleting
    - Return 409 error if discount is in use
    - Include count of affected membership types in error message
    - _Requirements: 10.1, 10.2, 10.3_

  - [x] 6.3 Implement force delete endpoint for discounts
    - Create DELETE /api/orgadmin/discounts/:id/force endpoint
    - Remove discount ID from all membership types' discountIds arrays
    - Delete discount record
    - Wrap in transaction for atomicity
    - _Requirements: 10.5, 10.6_

  - [x] 6.4 Write property test for discount deletion association check
    - **Property 14: Discount Deletion Association Check**
    - **Validates: Requirements 10.1**

  - [x] 6.5 Write property test for in-use discount deletion prevention
    - **Property 15: In-Use Discount Deletion Prevention**
    - **Validates: Requirements 10.2**

  - [x] 6.6 Write property test for deletion error message count accuracy
    - **Property 16: Deletion Error Message Count Accuracy**
    - **Validates: Requirements 10.3**

  - [x] 6.7 Write property test for discount association retrieval
    - **Property 17: Discount Association Retrieval**
    - **Validates: Requirements 10.4**

  - [x] 6.8 Write property test for force delete cleanup completeness
    - **Property 18: Force Delete Cleanup Completeness**
    - **Validates: Requirements 10.5, 10.6**

  - [x] 6.9 Write unit tests for discount deletion workflows
    - Test normal deletion with no associations
    - Test deletion prevention when in use
    - Test force delete with multiple associations
    - Test error message formatting
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6_

- [x] 7. Extend discount API endpoints for module type filtering
  - [x] 7.1 Update GET /api/orgadmin/organisations/:organisationId/discounts/:moduleType
    - Ensure moduleType parameter filters discounts correctly
    - Support 'memberships' as valid moduleType value
    - _Requirements: 2.6, 6.3, 6.4_

  - [x] 7.2 Update POST /api/orgadmin/discounts to set moduleType from context
    - Accept moduleType in request body or derive from route context
    - Set moduleType to 'memberships' when created from memberships module
    - _Requirements: 6.2, 6.6_

  - [x] 7.3 Create GET /api/orgadmin/discounts/:id/membership-types endpoint
    - Return list of membership type IDs using the discount
    - Include count in response
    - _Requirements: 10.4_

  - [x] 7.4 Write property test for module type filtering consistency
    - **Property 1: Module Type Filtering Consistency**
    - **Validates: Requirements 2.6, 6.3, 6.4**

  - [x] 7.5 Write property test for module type assignment by context
    - **Property 2: Module Type Assignment by Context**
    - **Validates: Requirements 6.2, 6.6, 6.7**

  - [x] 7.6 Write unit tests for discount API endpoints
    - Test filtering by moduleType
    - Test creating discount with moduleType
    - Test membership types association endpoint
    - _Requirements: 2.6, 6.2, 6.3, 6.4, 6.6, 6.7, 10.4_

- [x] 8. Checkpoint - Ensure backend implementation complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. Create DiscountSelector component
  - [x] 9.1 Implement DiscountSelector component in packages/components
    - Accept props: selectedDiscountIds, onChange, organisationId, moduleType
    - Fetch active discounts filtered by moduleType
    - Display discounts with search functionality
    - Support multi-select with removable chips
    - Show discount name, type, and value
    - Only display active discounts
    - _Requirements: 4.3, 4.4, 4.5, 4.6_

  - [x] 9.2 Write property test for multi-selection behavior
    - **Property 9: Discount Selector Multi-Selection Behavior**
    - **Validates: Requirements 4.4, 4.5, 4.6**

  - [x] 9.3 Write property test for active discounts filtering
    - **Property 10: Active Discounts Filtering in Selector**
    - **Validates: Requirements 4.3**

  - [x] 9.4 Write unit tests for DiscountSelector component
    - Test rendering with no discounts
    - Test selecting and deselecting discounts
    - Test chip display and removal
    - Test search functionality
    - Test moduleType filtering
    - _Requirements: 4.3, 4.4, 4.5, 4.6_

- [-] 10. Add discount selection to membership type forms
  - [x] 10.1 Update CreateSingleMembershipTypePage to include DiscountSelector
    - Add discountIds field to form state
    - Render DiscountSelector component with moduleType='memberships'
    - Conditionally render based on 'entry-discounts' capability
    - Update form submission to include discountIds
    - _Requirements: 4.1, 4.4, 4.7_

  - [x] 10.2 Update CreateGroupMembershipTypePage to include DiscountSelector
    - Add discountIds field to form state
    - Render DiscountSelector component with moduleType='memberships'
    - Conditionally render based on 'entry-discounts' capability
    - Update form submission to include discountIds
    - _Requirements: 4.2, 4.4, 4.7_

  - [x] 10.3 Write property test for capability-based visibility
    - **Property 8: Capability-Based Component Visibility**
    - **Validates: Requirements 1.4, 4.7**

  - [x] 10.4 Write unit tests for membership type forms with discount selection
    - Test form rendering with DiscountSelector
    - Test form submission with discountIds
    - Test capability-based visibility
    - Test validation error display
    - _Requirements: 4.1, 4.2, 4.4, 4.7_

- [x] 11. Add discount display to membership type views
  - [x] 11.1 Update MembershipTypesListPage to show discount count
    - Add discount count column to table
    - Display number of associated discounts for each membership type
    - Handle zero discounts gracefully
    - _Requirements: 5.1_

  - [x] 11.2 Update MembershipTypeDetailsPage to show discount details
    - Fetch discount details for each discount ID
    - Display discount name, type (percentage/fixed), and value
    - Show "No discounts" when discountIds is empty
    - Show "Discount not found" for invalid discount IDs
    - Handle loading and error states
    - _Requirements: 5.2, 5.3, 5.4, 5.5, 5.6_

  - [x] 11.3 Write property test for discount count display accuracy
    - **Property 11: Discount Count Display Accuracy**
    - **Validates: Requirements 5.1**

  - [x] 11.4 Write property test for discount details display completeness
    - **Property 12: Discount Details Display Completeness**
    - **Validates: Requirements 5.2, 5.5**

  - [x] 11.5 Write property test for discount details fetching behavior
    - **Property 13: Discount Details Fetching Behavior**
    - **Validates: Requirements 5.4**

  - [x] 11.6 Write unit tests for membership type display components
    - Test discount count column rendering
    - Test discount details section rendering
    - Test "No discounts" empty state
    - Test "Discount not found" error state
    - Test loading states
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_

- [x] 12. Add discounts navigation to memberships module
  - [x] 12.1 Update memberships module navigation configuration
    - Add "Discounts" submenu item in packages/orgadmin-memberships/src/index.ts
    - Position after "Members Database" and "Membership Types"
    - Route to /memberships/discounts
    - Conditionally render based on 'entry-discounts' capability
    - _Requirements: 1.1, 1.2, 1.3, 1.4_

  - [x] 12.2 Create discount routes in memberships module
    - Route /memberships/discounts to DiscountsListPage with moduleType='memberships'
    - Route /memberships/discounts/create to CreateDiscountPage with moduleType='memberships'
    - Route /memberships/discounts/:id/edit to EditDiscountPage with moduleType='memberships'
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

  - [x] 12.3 Write integration tests for discount navigation
    - Test navigation from memberships to discounts list
    - Test moduleType context propagation
    - Test capability-based menu visibility
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.4, 2.5_

- [x] 13. Update discount pages to support module context
  - [x] 13.1 Modify DiscountsListPage to accept moduleType prop
    - Pass moduleType to API calls for filtering
    - Update breadcrumbs based on module context
    - _Requirements: 2.1, 2.5, 2.6_

  - [x] 13.2 Modify CreateDiscountPage to accept moduleType prop
    - Set moduleType in form submission
    - Update breadcrumbs based on module context
    - _Requirements: 2.2, 2.5, 6.6, 6.7_

  - [x] 13.3 Modify EditDiscountPage to accept moduleType prop
    - Update breadcrumbs based on module context
    - _Requirements: 2.3, 2.5_

  - [x] 13.4 Write unit tests for discount pages with module context
    - Test DiscountsListPage with moduleType='memberships'
    - Test CreateDiscountPage with moduleType='memberships'
    - Test EditDiscountPage with moduleType='memberships'
    - Test API calls include correct moduleType
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

- [x] 14. Final checkpoint - Integration testing
  - [x] 14.1 Test end-to-end discount association workflow
    - Create discount from memberships module
    - Create membership type with that discount
    - Verify discount appears in membership type details
    - Update membership type to remove discount
    - Verify discount no longer appears
    - _Requirements: All_

  - [x] 14.2 Test cross-module isolation
    - Create discount in events module
    - Attempt to associate with membership type
    - Verify validation rejects wrong moduleType
    - _Requirements: 6.2, 6.3, 6.4, 9.3_

  - [x] 14.3 Test discount deletion workflow
    - Create membership type with discounts
    - Attempt to delete associated discount
    - Verify 409 error with correct count
    - Force delete discount
    - Verify membership type no longer references it
    - _Requirements: 10.1, 10.2, 10.3, 10.5, 10.6_

  - [x] 14.4 Ensure all tests pass
    - Run all unit tests
    - Run all property-based tests
    - Run all integration tests
    - Ask the user if questions arise

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- The implementation reuses existing discount infrastructure to minimize new code
- Property tests validate universal correctness properties across all inputs
- Unit tests validate specific examples and edge cases
- Module type filtering ensures isolation between events and memberships discounts
