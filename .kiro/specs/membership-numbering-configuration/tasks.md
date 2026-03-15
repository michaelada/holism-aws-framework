# Implementation Plan: Membership Numbering Configuration

## Overview

This implementation plan breaks down the membership numbering configuration feature into discrete coding tasks. The feature adds configurable membership numbering rules at the Organization Type level, supporting both internal (system-generated) and external (user-provided) numbering modes.

Implementation follows a bottom-up approach: database schema → backend services → API endpoints → frontend UI → testing.

## Tasks

- [ ] 1. Database schema migration
  - [x] 1.1 Create migration script for organization_types table columns
    - Add `membership_numbering`, `membership_number_uniqueness`, and `initial_membership_number` columns
    - Add check constraints for valid enum values
    - Set default values for existing records
    - _Requirements: FR1, 6.1_
  
  - [x] 1.2 Create membership_number_sequences table
    - Create table with organization_type_id, organization_id, and next_number columns
    - Add foreign key constraints and unique constraint
    - Create indexes for performance optimization
    - _Requirements: FR1, 2.3_
  
  - [x] 1.3 Create sequence initialization logic
    - Write SQL to populate sequences for existing organizations with internal numbering
    - Extract highest membership number from existing members
    - Set next_number appropriately or use default (1000000)
    - _Requirements: 6.1, 6.2_
  
  - [x] 1.4 Create rollback migration script
    - Drop membership_number_sequences table
    - Remove columns from organization_types table
    - Ensure rollback preserves existing data
    - _Requirements: NFR4_

- [ ] 2. Backend type definitions and interfaces
  - [x] 2.1 Update organization type TypeScript interfaces
    - Add MembershipNumbering and MembershipNumberUniqueness type definitions
    - Extend OrganizationType interface with new fields
    - Update CreateOrganizationTypeDto and UpdateOrganizationTypeDto
    - _Requirements: FR1, 1.1, 1.2_
  
  - [x] 2.2 Update member creation DTO
    - Add optional membershipNumber field to CreateMemberDto
    - Add MembershipNumberConfig interface for internal service use
    - _Requirements: 3.1, 4.2_

- [ ] 3. Number generation service
  - [x] 3.1 Implement MembershipNumberGenerator class
    - Create generateNumber method with transaction-based atomic increment
    - Use SELECT FOR UPDATE to lock sequence records
    - Handle organization-level vs organization type-level scoping
    - Return generated number as string
    - _Requirements: 2.1, 2.2, 2.3, NFR2_
  
  - [x] 3.2 Add retry logic for deadlock handling
    - Implement generateWithRetry method with exponential backoff
    - Maximum 3 retry attempts for deadlock scenarios
    - Throw clear error after max retries exceeded
    - _Requirements: NFR2_
  
  - [ ]* 3.3 Write property test for sequential number generation
    - **Property 2: Sequential number generation**
    - **Validates: Requirements 2.3**
    - Generate random initial number and member count
    - Verify numbers are strictly sequential with no gaps
    - Verify no duplicate numbers generated
  
  - [ ]* 3.4 Write property test for atomic number generation
    - **Property 7: Atomic number generation**
    - **Validates: Requirements NFR2**
    - Create 10-50 concurrent member creation requests
    - Verify all numbers are unique with no collisions
    - Verify all numbers are in expected sequential range

- [ ] 4. Uniqueness validation service
  - [x] 4.1 Implement MembershipNumberValidator class
    - Create validateUniqueness method for external mode
    - Support organization-level and organization type-level validation
    - Return validation result with clear error messages
    - _Requirements: 3.1, 3.2, 4.3_
  
  - [ ]* 4.2 Write property test for uniqueness scope enforcement
    - **Property 3: Uniqueness scope enforcement**
    - **Validates: Requirements 2.1, 3.2**
    - Test both organization and organization type scopes
    - Verify duplicate rejection within scope
    - Verify duplicate acceptance across scopes (organization-level only)
  
  - [ ]* 4.3 Write property test for external number uniqueness validation
    - **Property 5: External number uniqueness validation**
    - **Validates: Requirements 3.2, 4.3**
    - Generate random membership numbers
    - Create first member successfully
    - Verify duplicate creation fails with clear error message

- [ ] 5. Organization type service updates
  - [x] 5.1 Update organization type creation logic
    - Accept new numbering configuration fields in create method
    - Validate conditional requirements (uniqueness/initial only for internal mode)
    - Initialize sequence record for internal mode with organization type scope
    - _Requirements: 1.2, 4.1_
  
  - [x] 5.2 Update organization type update logic
    - Accept new numbering configuration fields in update method
    - Validate configuration changes don't conflict with existing members
    - Update sequence records if needed
    - _Requirements: 1.2, 4.1_
  
  - [ ]* 5.3 Write property test for configuration persistence
    - **Property 1: Configuration persistence and application**
    - **Validates: Requirements 1.2, FR1**
    - Generate random organization type configurations
    - Create organization type and retrieve it
    - Verify all configuration fields match exactly
  
  - [ ]* 5.4 Write property test for configuration round trip
    - **Property 8: Configuration round trip**
    - **Validates: Requirements FR1**
    - Generate random numbering configurations
    - Serialize to database and deserialize
    - Verify all fields preserved with no data loss

- [ ] 6. Member creation service updates
  - [x] 6.1 Update createMember method for internal mode
    - Fetch organization type configuration
    - Call MembershipNumberGenerator when mode is internal
    - Store generated number in member record
    - Return member with generated number
    - _Requirements: 2.1, 2.2, 2.3, 5.1_
  
  - [x] 6.2 Update createMember method for external mode
    - Validate membershipNumber field is provided and non-empty
    - Call MembershipNumberValidator to check uniqueness
    - Store provided number in member record
    - Return appropriate error for validation failures
    - _Requirements: 3.1, 3.2, 4.2, 4.3, 5.2_
  
  - [ ]* 6.3 Write property test for external number required validation
    - **Property 4: External number required validation**
    - **Validates: Requirements 4.2**
    - Test with undefined, null, and empty string values
    - Verify all cases reject with validation error
  
  - [ ]* 6.4 Write property test for external number storage
    - **Property 6: External number storage**
    - **Validates: Requirements 4.3**
    - Generate random membership numbers
    - Create member with external number
    - Verify stored number matches provided number exactly
    - Verify persistence after retrieval

- [x] 7. Checkpoint - Backend services complete
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 8. API endpoint updates
  - [x] 8.1 Update POST /api/organization-types endpoint
    - Accept membershipNumbering, membershipNumberUniqueness, and initialMembershipNumber in request body
    - Validate request body with conditional field requirements
    - Call updated organization type service
    - Return created organization type with new fields
    - _Requirements: FR2, 4.1_
  
  - [x] 8.2 Update PUT /api/organization-types/:id endpoint
    - Accept new numbering configuration fields in request body
    - Validate configuration changes
    - Call updated organization type service
    - Return updated organization type
    - _Requirements: FR2, 4.1_
  
  - [x] 8.3 Update POST /api/organizations/:orgId/members endpoint
    - Accept optional membershipNumber in request body
    - Determine mode from organization type configuration
    - Route to appropriate service method (internal vs external)
    - Return member with membership number
    - Handle validation errors with appropriate HTTP status codes
    - _Requirements: FR2, 5.1, 5.2_
  
  - [ ]* 8.4 Write integration tests for organization type endpoints
    - Test creating organization type with internal mode
    - Test creating organization type with external mode
    - Test updating organization type configuration
    - Test validation errors for invalid configurations
    - _Requirements: FR2, 4.1_
  
  - [ ]* 8.5 Write integration tests for member creation endpoint
    - Test member creation in internal mode (no number provided)
    - Test member creation in external mode (number provided)
    - Test validation error when number missing in external mode
    - Test uniqueness validation error for duplicate numbers
    - _Requirements: FR2, 5.1, 5.2_

- [ ] 9. Super Admin UI - Organization Type form
  - [x] 9.1 Add Membership Numbering dropdown field
    - Add Select component with "Internal" and "External" options
    - Set default value to "internal"
    - Update form state on selection change
    - _Requirements: 4.1, 4.2_
  
  - [x] 9.2 Add conditional Membership Number Uniqueness field
    - Add Select component with "Organization Type" and "Organization" options
    - Show only when Membership Numbering is "Internal"
    - Hide/show dynamically based on numbering mode
    - Set default value to "organization"
    - _Requirements: 4.1, 4.2_
  
  - [x] 9.3 Add conditional Initial Membership Number field
    - Add TextField component with number input type
    - Show only when Membership Numbering is "Internal"
    - Hide/show dynamically based on numbering mode
    - Set default value to 1000000
    - Add validation for positive integers
    - _Requirements: 4.1, 4.2_
  
  - [-] 9.4 Update form submission logic
    - Include new fields in form data
    - Only send uniqueness and initial number when mode is internal
    - Handle API response and display success/error messages
    - _Requirements: 4.1_
  
  - [ ]* 9.5 Write unit tests for conditional field display
    - Test fields show when "Internal" selected
    - Test fields hide when "External" selected
    - Test dynamic show/hide on mode change
    - Test default values populated correctly
  
  - [ ]* 9.6 Write unit tests for form validation
    - Test positive integer validation for initial number
    - Test required field validation
    - Test form submission with valid data
    - Test error message display

- [ ] 10. Org Admin UI - Add Member form
  - [x] 10.1 Fetch organization type configuration
    - Load organization type data including numbering configuration
    - Store configuration in component state or context
    - _Requirements: 5.1, 5.2_
  
  - [x] 10.2 Add conditional Membership Number field
    - Add TextField component for membership number input
    - Show only when organization type uses "External" mode
    - Mark as required field
    - Add helper text explaining external number entry
    - _Requirements: 5.2_
  
  - [x] 10.3 Update form submission logic for internal mode
    - Do not include membershipNumber in request body
    - Display generated number in success message after creation
    - _Requirements: 5.1_
  
  - [x] 10.4 Update form submission logic for external mode
    - Include membershipNumber in request body
    - Validate field is not empty before submission
    - Handle uniqueness validation errors from API
    - Display clear error message for duplicate numbers
    - _Requirements: 5.2_
  
  - [ ]* 10.5 Write unit tests for conditional field display
    - Test membership number field shows in external mode
    - Test membership number field hidden in internal mode
    - Test required field validation in external mode
  
  - [ ]* 10.6 Write unit tests for form submission
    - Test successful submission in internal mode
    - Test successful submission in external mode
    - Test error handling for duplicate numbers
    - Test error handling for missing number in external mode

- [x] 11. Checkpoint - UI components complete
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 12. End-to-end integration tests
  - [ ]* 12.1 Test internal numbering workflow
    - Super Admin creates organization type with internal mode
    - Org Admin creates multiple members
    - Verify sequential numbers generated
    - Verify numbers follow configured uniqueness scope
    - _Requirements: 1.1, 2.1, 2.2, 2.3_
  
  - [ ]* 12.2 Test external numbering workflow
    - Super Admin creates organization type with external mode
    - Org Admin creates member with custom number
    - Verify number stored correctly
    - Attempt to create duplicate number
    - Verify uniqueness validation error displayed
    - _Requirements: 1.1, 3.1, 3.2_
  
  - [ ]* 12.3 Test organization type-level uniqueness
    - Create organization type with organization type-level uniqueness
    - Create multiple organizations of that type
    - Create members in different organizations
    - Verify numbers unique across all organizations
    - _Requirements: 2.1_
  
  - [ ]* 12.4 Test organization-level uniqueness
    - Create organization type with organization-level uniqueness
    - Create multiple organizations of that type
    - Create members with same numbers in different organizations
    - Verify numbers can be reused across organizations
    - _Requirements: 2.1_
  
  - [ ]* 12.5 Test concurrent member creation
    - Create organization type with internal numbering
    - Simulate 20+ concurrent member creation requests
    - Verify no duplicate numbers generated
    - Verify all numbers in sequential range
    - _Requirements: NFR2_

- [ ] 13. Performance validation
  - [ ]* 13.1 Validate number generation performance
    - Measure time for number generation operations
    - Test with different initial numbers and scopes
    - Verify < 500ms completion time (NFR1)
    - _Requirements: NFR1_
  
  - [ ]* 13.2 Validate uniqueness validation performance
    - Measure time for uniqueness check operations
    - Test with varying database sizes (100, 1000, 10000 members)
    - Verify < 200ms completion time (NFR1)
    - _Requirements: NFR1_

- [x] 14. Final checkpoint - All implementation complete
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Property-based tests use fast-check library with minimum 100 iterations
- Database migration must be tested with both forward and rollback scenarios
- All concurrent operations must use proper locking mechanisms to prevent race conditions
- Error messages must be clear and actionable for end users
- UI conditional fields must update smoothly without page reload
