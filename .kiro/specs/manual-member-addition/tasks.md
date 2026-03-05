# Implementation Plan: Manual Member Addition

## Overview

This implementation plan breaks down the manual member addition feature into discrete coding tasks. The feature enables Organization Administrators to manually create member records through a dedicated interface with dynamic form fields based on the selected membership type's form definition.

The implementation follows this approach:
1. Backend API endpoint for member creation
2. Frontend components for the member creation workflow
3. Integration with existing form and membership systems
4. Comprehensive property-based testing for all correctness properties

## Tasks

- [x] 1. Create backend API endpoint for member creation
  - [x] 1.1 Implement POST /api/orgadmin/members endpoint
    - Add route handler in `packages/backend/src/routes/membership.routes.ts`
    - Implement authentication and authorization middleware
    - Add request validation for CreateMemberDto
    - _Requirements: 4.1, 4.2, 7.2, 7.3_
  
  - [x] 1.2 Write property test for member creation endpoint
    - **Property 10: Member Record Creation with Form Submission Link**
    - **Validates: Requirements 4.2**
  
  - [x] 1.3 Implement membership number generation logic
    - Add `generateMembershipNumber()` method to MembershipService
    - Implement format: {ORG_PREFIX}-{YEAR}-{SEQUENCE}
    - Ensure uniqueness through database constraints
    - _Requirements: 4.3_
  
  - [x] 1.4 Write property test for unique membership number generation
    - **Property 11: Unique Membership Number Generation**
    - **Validates: Requirements 4.3**
  
  - [x] 1.5 Implement member status assignment logic
    - Add conditional status logic based on automaticallyApprove flag
    - Calculate valid until date based on membership type configuration
    - _Requirements: 4.4_
  
  - [x] 1.6 Write property test for conditional status assignment
    - **Property 12: Conditional Member Status Assignment**
    - **Validates: Requirements 4.4**
  
  - [x] 1.7 Implement server-side validation
    - Validate membership type exists
    - Validate form submission exists
    - Validate required fields (firstName, lastName)
    - Add referential integrity checks
    - _Requirements: 8.5, 8.6_
  
  - [x] 1.8 Write property test for referential integrity validation
    - **Property 17: Referential Integrity Validation**
    - **Validates: Requirements 8.5, 8.6**
  
  - [x] 1.9 Write unit tests for member creation service
    - Test successful member creation
    - Test error handling for missing membership type
    - Test error handling for missing form submission
    - Test error handling for invalid data
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.7_

- [x] 2. Checkpoint - Verify backend endpoint
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 3. Enhance MembersDatabasePage with Add Member button
  - [x] 3.1 Add membership type count state and loading logic
    - Add state for `membershipTypeCount` and `loadingTypes`
    - Implement `loadMembershipTypeCount()` method
    - Fetch membership types on component mount
    - _Requirements: 1.3_
  
  - [x] 3.2 Implement Add Member button with conditional visibility
    - Add button component above members table
    - Show button only when `membershipTypeCount > 0`
    - Position below page title, above search/filter controls
    - _Requirements: 1.1, 1.2, 1.4_
  
  - [x] 3.3 Write property test for button visibility
    - **Property 1: Add Member Button Visibility Based on Membership Type Count**
    - **Validates: Requirements 1.1, 1.2**
  
  - [x] 3.4 Implement navigation logic based on membership type count
    - Navigate directly to create page if count = 1
    - Navigate to type selector if count > 1
    - Pass typeId as query parameter when auto-selecting
    - _Requirements: 2.1, 2.2, 6.1_
  
  - [x] 3.5 Write property test for automatic membership type selection
    - **Property 2: Automatic Membership Type Selection**
    - **Validates: Requirements 2.2**
  
  - [x] 3.6 Write property test for navigation based on type count
    - **Property 4: Navigation Based on Membership Type Count**
    - **Validates: Requirements 2.1, 6.1**
  
  - [x] 3.7 Write unit tests for MembersDatabasePage enhancements
    - Test button visibility when types exist
    - Test button hidden when no types exist
    - Test navigation with single type
    - Test navigation with multiple types
    - _Requirements: 1.1, 1.2, 2.1, 2.2_

- [ ] 4. Create MembershipTypeSelector component
  - [x] 4.1 Implement MembershipTypeSelector dialog component
    - Create component in `packages/orgadmin-memberships/src/components/MembershipTypeSelector.tsx`
    - Display list of membership types with names and descriptions
    - Implement selection handler
    - Implement cancel handler
    - _Requirements: 2.1, 2.3, 2.4, 2.5_
  
  - [x] 4.2 Write property test for type selector display
    - **Property 3: Membership Type Selector Displays All Types**
    - **Validates: Requirements 2.3**
  
  - [x] 4.3 Write unit tests for MembershipTypeSelector
    - Test displays all membership types
    - Test selection handler
    - Test cancel handler
    - _Requirements: 2.3, 2.4, 2.5_

- [ ] 5. Create CreateMemberPage component
  - [x] 5.1 Implement CreateMemberPage with basic structure
    - Create page in `packages/orgadmin-memberships/src/pages/CreateMemberPage.tsx`
    - Add page header with back button
    - Add state management for form data and errors
    - Implement loading states
    - _Requirements: 3.1, 9.4, 9.5_
  
  - [x] 5.2 Implement membership type and form definition loading
    - Load membership type by ID from query parameter
    - Fetch associated form definition
    - Handle loading and error states
    - _Requirements: 3.3_
  
  - [x] 5.3 Implement name field rendering
    - Add mandatory Name field
    - Implement validation for name field
    - Display validation errors
    - _Requirements: 3.2_
  
  - [x] 5.4 Implement dynamic form field rendering
    - Reuse FieldRenderer component from @aws-web-framework/components
    - Map form definition fields to appropriate input controls
    - Render fields in order based on field.order property
    - Support all field types (text, number, date, select, textarea, checkbox, radio, file)
    - _Requirements: 3.4, 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8_
  
  - [x] 5.5 Write property test for dynamic field rendering
    - **Property 5: Dynamic Form Field Rendering**
    - **Validates: Requirements 3.4, 5.1-5.8**
  
  - [x] 5.6 Implement field metadata display
    - Display field labels from form definition
    - Display help text/descriptions
    - Display validation messages
    - _Requirements: 3.6_
  
  - [x] 5.7 Write property test for field metadata display
    - **Property 7: Field Metadata Display**
    - **Validates: Requirements 3.6**
  
  - [x] 5.8 Write unit tests for CreateMemberPage rendering
    - Test page loads membership type
    - Test page loads form definition
    - Test name field renders
    - Test dynamic fields render
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 6. Implement form validation logic
  - [x] 6.1 Implement client-side validation
    - Validate name field (required, min/max length)
    - Validate mandatory fields based on form definition
    - Validate field formats (email, date, number)
    - Implement validation timing (on blur and on submit)
    - _Requirements: 3.5, 8.1, 8.2, 8.3, 8.4_
  
  - [x] 6.2 Write property test for mandatory field validation
    - **Property 6: Mandatory Field Validation Enforcement**
    - **Validates: Requirements 3.5, 8.1**
  
  - [x] 6.3 Write property test for validation error prevention
    - **Property 8: Validation Error Prevention**
    - **Validates: Requirements 3.7, 8.2, 8.3, 8.4**
  
  - [x] 6.4 Implement validation error display
    - Display field-specific errors below each field
    - Highlight invalid fields with red border
    - Show error summary if multiple errors exist
    - _Requirements: 3.7_
  
  - [x] 6.5 Write unit tests for validation logic
    - Test required field validation
    - Test format validation (email, date, number)
    - Test validation error display
    - Test validation timing
    - _Requirements: 3.5, 3.7, 8.1, 8.2, 8.3, 8.4_

- [x] 7. Checkpoint - Verify form rendering and validation
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Implement form submission logic
  - [x] 8.1 Implement form submission handler
    - Create form submission record via API
    - Create member record via API
    - Handle transaction consistency
    - _Requirements: 4.1, 4.2_
  
  - [x] 8.2 Write property test for form submission creation
    - **Property 9: Form Submission Creation**
    - **Validates: Requirements 4.1**
  
  - [x] 8.3 Implement success handling
    - Display success notification with member name
    - Navigate back to members database
    - Preserve filter state during navigation
    - _Requirements: 4.5, 4.6, 6.4, 9.1_
  
  - [x] 8.4 Write property test for success notification
    - **Property 18: Success Notification with Member Name**
    - **Validates: Requirements 9.1**
  
  - [x] 8.5 Implement error handling
    - Display error notification for server errors
    - Display field-specific errors for validation errors
    - Remain on form and preserve data on error
    - _Requirements: 4.7, 9.2, 9.3_
  
  - [x] 8.6 Write property test for error handling and form persistence
    - **Property 13: Error Handling and Form Persistence**
    - **Validates: Requirements 4.7**
  
  - [x] 8.7 Write property test for error notification display
    - **Property 19: Error Notification Display**
    - **Validates: Requirements 9.2, 9.3**
  
  - [x] 8.8 Write unit tests for form submission
    - Test successful submission
    - Test error handling
    - Test data preservation on error
    - Test success notification
    - Test error notification
    - _Requirements: 4.1, 4.2, 4.5, 4.6, 4.7, 9.1, 9.2, 9.3_

- [x] 9. Implement navigation and routing
  - [x] 9.1 Add route for CreateMemberPage
    - Add route `/orgadmin/memberships/members/create` to routing configuration
    - Support optional `typeId` query parameter
    - _Requirements: 6.2_
  
  - [x] 9.2 Implement cancel navigation
    - Navigate back to members database on cancel
    - Preserve filter state
    - _Requirements: 6.3_
  
  - [x] 9.3 Implement filter state preservation
    - Use React Router location.state to pass navigation context
    - Preserve search term, status filter, custom filter, page number
    - _Requirements: 6.5_
  
  - [x] 9.4 Write property test for filter state preservation
    - **Property 14: Filter State Preservation**
    - **Validates: Requirements 6.5**
  
  - [x] 9.5 Write integration tests for navigation flows
    - Test complete member creation flow
    - Test cancel flow
    - Test filter state preservation
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

- [x] 10. Implement authorization and permissions
  - [x] 10.1 Implement role-based button visibility
    - Show Add Member button only to Organization Administrators
    - Use existing role checking logic
    - _Requirements: 7.1_
  
  - [x] 10.2 Write property test for role-based button visibility
    - **Property 15: Role-Based Button Visibility**
    - **Validates: Requirements 7.1**
  
  - [x] 10.3 Implement authorization enforcement
    - Verify permissions before creating member
    - Return 403 Forbidden for unauthorized users
    - Add middleware to protect endpoint
    - _Requirements: 7.2, 7.3_
  
  - [x] 10.4 Write property test for authorization enforcement
    - **Property 16: Authorization Enforcement**
    - **Validates: Requirements 7.2, 7.3**
  
  - [x] 10.5 Write integration tests for authorization
    - Test admin user can create members
    - Test non-admin user cannot see button
    - Test non-admin user gets 403 on direct access
    - _Requirements: 7.1, 7.2, 7.3_

- [x] 11. Checkpoint - Verify authorization and permissions
  - Ensure all tests pass, ask the user if questions arise.

- [x] 12. Implement integration with existing member features
  - [x] 12.1 Verify manual members appear in members database
    - Test member appears in table after creation
    - Test member is included in search results
    - Test member is included in filter results
    - _Requirements: 10.1, 10.2, 10.3_
  
  - [x] 12.2 Verify manual members work with batch operations
    - Test member can be selected for batch operations
    - Test member can be exported in Excel exports
    - _Requirements: 10.4, 10.5_
  
  - [x] 12.3 Verify manual members work with member details page
    - Test member details are viewable
    - Test all member data displays correctly
    - _Requirements: 10.6_
  
  - [x] 12.4 Write property test for manual member integration
    - **Property 20: Manual Member Integration**
    - **Validates: Requirements 10.1, 10.2, 10.3, 10.4, 10.5, 10.6**
  
  - [x] 12.5 Write integration tests for member features
    - Test end-to-end member creation flow
    - Test member appears in all views
    - Test member works with all operations
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6_

- [x] 13. Add loading states and user feedback
  - [x] 13.1 Implement loading indicators
    - Show spinner while loading membership types
    - Show skeleton loader while loading form definition
    - Disable submit button while creating member
    - Show "Creating..." text on submit button during submission
    - _Requirements: 9.4, 9.5_
  
  - [x] 13.2 Implement error state displays
    - Display network error messages
    - Display API error messages
    - Provide retry options for network errors
    - _Requirements: 9.2, 9.3_
  
  - [x] 13.3 Write unit tests for loading states
    - Test loading indicators display
    - Test button disabled during submission
    - Test error states display
    - _Requirements: 9.2, 9.3, 9.4, 9.5_

- [-] 14. Final integration testing
  - [x] 14.1 Write end-to-end integration tests
    - Test complete member creation flow with single membership type
    - Test complete member creation flow with multiple membership types
    - Test validation error flow
    - Test cancel flow
    - Test authorization flow
    - _Requirements: All requirements_
  
  - [-] 14.2 Verify all correctness properties
    - Run all property-based tests
    - Verify all 20 properties pass
    - Fix any failing properties
    - _Requirements: All requirements_

- [x] 15. Final checkpoint - Complete feature verification
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties (minimum 100 iterations each)
- Unit tests validate specific examples and edge cases
- Integration tests validate end-to-end flows
- The implementation reuses existing components (FieldRenderer) and follows established patterns
- All 20 correctness properties from the design document are covered by property-based tests
