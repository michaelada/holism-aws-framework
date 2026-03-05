# Implementation Plan: Document Management Capability Consolidation

## Overview

This implementation consolidates three separate document management capabilities into a single unified capability and implements capability-based visibility for file upload field types. The work includes database migration, backend validation, frontend filtering, and comprehensive testing to ensure data integrity and proper capability enforcement.

## Tasks

- [x] 1. Create database migration for capability consolidation
  - [x] 1.1 Create up migration SQL file
    - Create new `document-management` capability record
    - Migrate organization enabled capabilities (add new, remove old)
    - Migrate organization type default capabilities (add new, remove old)
    - Remove old capability records
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 7.2, 7.3, 7.4, 7.5_
  
  - [x] 1.2 Create down migration SQL file for rollback support
    - Restore three original capability records
    - Migrate organization capabilities back to original state
    - Migrate organization type default capabilities back
    - Remove `document-management` capability
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7_
  
  - [x] 1.3 Write property test for migration capability consolidation
    - **Property 1: Migration Adds New Capability for Any Old Capability**
    - **Property 2: Migration Adds New Capability Exactly Once**
    - **Property 3: Migration Removes All Old Capabilities from Organizations**
    - **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7**
  
  - [x] 1.4 Write property test for rollback migration
    - **Property 13: Rollback Restores Organization Capabilities**
    - **Property 14: Rollback Removes New Capability from Organizations**
    - **Validates: Requirements 6.5, 6.6**
  
  - [x] 1.5 Write property test for organization type migration
    - **Property 16: Migration Updates Organization Type Defaults**
    - **Property 17: Migration Removes Old Capabilities from Organization Types**
    - **Validates: Requirements 7.2, 7.3, 7.4, 7.5**
  
  - [x] 1.6 Write integration test for migration execution
    - Test full migration on test database with realistic data
    - Verify all data transformations complete successfully
    - Test rollback and verify restoration
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 2.1-2.7, 6.1-6.7, 7.2-7.5_

- [x] 2. Implement backend capability validation
  - [x] 2.1 Create field capability validation middleware
    - Create `validateFieldCapability` middleware function
    - Check if datatype is 'file' or 'image'
    - Verify organization has 'document-management' capability
    - Return HTTP 403 with descriptive error for missing capability
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.9_
  
  - [x] 2.2 Add validation to metadata routes
    - Apply middleware to POST /api/metadata/fields endpoint
    - Apply middleware to PUT /api/metadata/fields/:shortName endpoint
    - Ensure `loadOrganisationCapabilities` middleware runs before validation
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8_
  
  - [x] 2.3 Write property test for backend validation rejection
    - **Property 9: Backend Rejects Document Fields Without Capability**
    - **Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.9**
  
  - [x] 2.4 Write property test for backend validation acceptance
    - **Property 10: Backend Allows Document Fields With Capability**
    - **Validates: Requirements 4.5, 4.6, 4.7, 4.8**
  
  - [x] 2.5 Write unit tests for validation middleware
    - Test middleware with various datatype/capability combinations
    - Verify correct HTTP status codes (403 vs success)
    - Verify error message format and content
    - _Requirements: 4.1-4.9_

- [x] 3. Checkpoint - Ensure backend validation works
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Implement frontend field type filtering
  - [x] 4.1 Create useFilteredFieldTypes hook
    - Import useCapabilities hook
    - Define all available field types array
    - Filter out 'file' and 'image' if 'document-management' capability not present
    - Return filtered field types array
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.9, 3.10_
  
  - [x] 4.2 Update CreateFieldPage to use filtered field types
    - Import and use useFilteredFieldTypes hook
    - Replace hardcoded FIELD_TYPES constant with filtered types
    - Ensure dropdown renders filtered options
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.9_
  
  - [x] 4.3 Update EditFieldPage to use filtered field types
    - Import and use useFilteredFieldTypes hook
    - Replace hardcoded FIELD_TYPES constant with filtered types
    - Add logic to handle existing document fields without capability
    - Disable datatype dropdown for existing document fields if capability missing
    - _Requirements: 3.5, 3.6, 3.7, 3.8, 3.10, 5.3, 5.4_
  
  - [x] 4.4 Write property test for CreateFieldPage field type visibility
    - **Property 4: CreateFieldPage Shows Document Types With Capability**
    - **Property 5: CreateFieldPage Hides Document Types Without Capability**
    - **Property 8: Non-Document Field Types Always Visible**
    - **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.9**
  
  - [x] 4.5 Write property test for EditFieldPage field type visibility
    - **Property 6: EditFieldPage Shows Document Types With Capability**
    - **Property 7: EditFieldPage Hides Document Types Without Capability**
    - **Property 8: Non-Document Field Types Always Visible**
    - **Validates: Requirements 3.5, 3.6, 3.7, 3.8, 3.10**
  
  - [x] 4.6 Write unit tests for useFilteredFieldTypes hook
    - Test hook with capability present
    - Test hook with capability absent
    - Verify non-document types always included
    - _Requirements: 3.1-3.10_
  
  - [x] 4.7 Write unit tests for CreateFieldPage rendering
    - Test component renders with document-management capability
    - Test component renders without document-management capability
    - Verify dropdown options match expected filtered types
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.9_
  
  - [x] 4.8 Write unit tests for EditFieldPage rendering
    - Test component with capability and document field
    - Test component without capability and document field
    - Verify datatype dropdown disabled when appropriate
    - _Requirements: 3.5, 3.6, 3.7, 3.8, 3.10, 5.3, 5.4_

- [x] 5. Checkpoint - Ensure frontend filtering works
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Implement data preservation and edge case handling
  - [x] 6.1 Add migration verification queries
    - Create SQL queries to verify existing document fields preserved
    - Add queries to check capability migration correctness
    - Document verification steps in migration file
    - _Requirements: 5.1, 5.2_
  
  - [x] 6.2 Write property test for field preservation
    - **Property 11: Migration Preserves Existing Document Fields**
    - **Validates: Requirements 5.1, 5.2**
  
  - [x] 6.3 Write property test for EditFieldPage with existing fields
    - **Property 12: EditFieldPage Allows Full Editing With Capability**
    - **Validates: Requirements 5.4**
  
  - [x] 6.4 Write example test for existing field without capability
    - Create organization with document field
    - Remove document-management capability
    - Verify EditFieldPage allows viewing but prevents datatype changes
    - _Requirements: 5.3_

- [x] 7. Implement organization type capability inheritance
  - [x] 7.1 Write property test for organization type inheritance
    - **Property 15: Organization Type Inheritance**
    - **Validates: Requirements 7.1**
  
  - [x] 7.2 Write integration test for new organization creation
    - Create organization type with document-management in defaults
    - Create new organization with that type
    - Verify new organization has document-management capability
    - _Requirements: 7.1_

- [x] 8. Integration testing and error handling
  - [x] 8.1 Write integration test for complete field creation flow
    - Test full user flow from dashboard to field creation
    - Test with and without document-management capability
    - Verify capability-based UI changes and API responses
    - _Requirements: 3.1-3.4, 4.1-4.9_
  
  - [x] 8.2 Write integration test for field update flow
    - Test field update with capability checks
    - Test updating existing document fields
    - Verify error responses for missing capabilities
    - _Requirements: 3.5-3.8, 4.3, 4.4, 5.3, 5.4_
  
  - [x] 8.3 Write error handling tests
    - Test frontend capability loading failure
    - Test API validation error display
    - Test migration error scenarios
    - _Requirements: 4.9_

- [x] 9. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Migration must be tested thoroughly before deployment due to data modification
- Rollback migration provides safety net for production deployment
- Property tests validate universal correctness properties across randomized inputs
- Integration tests ensure end-to-end workflows function correctly
- The implementation uses TypeScript for both frontend and backend code
