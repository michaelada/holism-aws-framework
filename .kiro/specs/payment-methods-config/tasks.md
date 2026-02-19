# Implementation Plan: Payment Methods Configuration System

## Overview

This implementation plan breaks down the payment methods configuration system into discrete coding tasks. The approach follows a bottom-up strategy: database schema → backend services → API routes → frontend components. Each task builds on previous work and includes testing to validate functionality incrementally.

## Tasks

- [x] 1. Create database schema and migrations
  - [x] 1.1 Create payment_methods table migration
    - Write migration to create payment_methods table with all fields (id, name, display_name, description, requires_activation, is_active, timestamps)
    - Add indexes on is_active and name columns
    - Add unique constraint on name column
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 9.1, 9.6_
  
  - [x] 1.2 Create org_payment_method_data table migration
    - Write migration to create org_payment_method_data table with all fields (id, organization_id, payment_method_id, status, payment_data, timestamps)
    - Add foreign key constraints to organizations and payment_methods tables with CASCADE delete
    - Add unique constraint on (organization_id, payment_method_id)
    - Add indexes on organization_id and status columns
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 9.2, 9.3, 9.4, 9.5_
  
  - [x] 1.3 Create seed data migration for initial payment methods
    - Insert "pay-offline" payment method (requires_activation=false, is_active=true)
    - Insert "stripe" payment method (requires_activation=true, is_active=true)
    - Insert "helix-pay" payment method (requires_activation=true, is_active=true)
    - Include appropriate display names and descriptions
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_
  
  - [x] 1.4 Create migration to associate existing organizations with pay-offline
    - Query all existing organizations
    - Create org_payment_method_data entries for each organization with pay-offline method
    - Set status='active' and payment_data={}
    - _Requirements: 3.1, 3.2, 3.3_
  
  - [x] 1.5 Write unit tests for migration rollback
    - Test that down migrations properly clean up tables
    - Test that rollback removes seed data
    - _Requirements: 1.1, 2.1, 7.1_

- [x] 2. Create TypeScript types and interfaces
  - [x] 2.1 Create payment-method.types.ts file
    - Define PaymentMethod interface
    - Define CreatePaymentMethodDto interface
    - Define UpdatePaymentMethodDto interface
    - Define PaymentMethodStatus type ('inactive' | 'active')
    - Define OrgPaymentMethodData interface
    - Define CreateOrgPaymentMethodDataDto interface
    - Define UpdateOrgPaymentMethodDataDto interface
    - _Requirements: 1.1, 2.1, 2.2, 2.3_
  
  - [x] 2.2 Extend organization.types.ts
    - Add enabledPaymentMethods?: string[] to CreateOrganizationDto
    - Add enabledPaymentMethods?: string[] to UpdateOrganizationDto
    - Add paymentMethods?: OrgPaymentMethodData[] to Organization interface
    - _Requirements: 4.3, 4.4, 4.5_

- [x] 3. Implement PaymentMethodService
  - [x] 3.1 Create payment-method.service.ts with CRUD operations
    - Implement getAllPaymentMethods() - returns active payment methods
    - Implement getPaymentMethodById(id) - returns payment method or null
    - Implement getPaymentMethodByName(name) - returns payment method or null
    - Implement createPaymentMethod(data) - creates new payment method
    - Implement updatePaymentMethod(id, data) - updates payment method
    - Implement deactivatePaymentMethod(id) - sets is_active=false
    - Implement validatePaymentMethods(names) - validates array of names exist and are active
    - Include proper error handling for duplicates and not found cases
    - _Requirements: 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 6.1, 9.6, 10.1_
  
  - [x] 3.2 Write unit tests for PaymentMethodService
    - Test getAllPaymentMethods returns only active methods
    - Test getPaymentMethodById with valid and invalid IDs
    - Test getPaymentMethodByName with valid and invalid names
    - Test createPaymentMethod with valid data
    - Test createPaymentMethod with duplicate name fails
    - Test updatePaymentMethod updates fields correctly
    - Test deactivatePaymentMethod sets is_active=false
    - Test validatePaymentMethods with valid and invalid names
    - _Requirements: 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 9.6_
  
  - [x] 3.3 Write property test for payment method name uniqueness
    - **Property 1: Payment method name uniqueness**
    - **Validates: Requirements 1.2, 9.6**
  
  - [x] 3.4 Write property test for payment method data completeness
    - **Property 2: Payment method data completeness**
    - **Validates: Requirements 1.3, 1.4, 1.5, 1.6, 1.7**

- [x] 4. Implement OrgPaymentMethodDataService
  - [x] 4.1 Create org-payment-method-data.service.ts with core operations
    - Implement getOrgPaymentMethods(organizationId) - returns all payment methods for org
    - Implement getOrgPaymentMethod(organizationId, paymentMethodId) - returns specific association or null
    - Implement createOrgPaymentMethod(data) - creates association with proper status initialization
    - Implement updateOrgPaymentMethod(organizationId, paymentMethodId, data) - updates association
    - Implement deleteOrgPaymentMethod(organizationId, paymentMethodId) - removes association
    - Include proper error handling for duplicates, foreign key violations, and not found cases
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 6.2, 9.3, 9.4, 9.5_
  
  - [x] 4.2 Implement syncOrgPaymentMethods method
    - Accept organizationId and array of payment method names
    - Query existing associations for the organization
    - Add new associations for selected methods not currently associated
    - Remove associations for methods no longer selected
    - Preserve existing associations that remain selected
    - Use database transaction for atomicity
    - _Requirements: 4.3, 4.4, 4.5, 6.5_
  
  - [x] 4.3 Implement initializeDefaultPaymentMethods method
    - Query "pay-offline" payment method by name
    - Create association with status='active' and payment_data={}
    - Handle case where pay-offline doesn't exist (log warning)
    - _Requirements: 3.1, 3.2, 3.3_
  
  - [x] 4.4 Write unit tests for OrgPaymentMethodDataService core operations
    - Test getOrgPaymentMethods returns all associations for org
    - Test getOrgPaymentMethod with valid and invalid IDs
    - Test createOrgPaymentMethod with valid data
    - Test createOrgPaymentMethod with duplicate fails
    - Test createOrgPaymentMethod with invalid org ID fails (foreign key)
    - Test createOrgPaymentMethod with invalid payment method ID fails (foreign key)
    - Test updateOrgPaymentMethod updates fields correctly
    - Test deleteOrgPaymentMethod removes association
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 9.3, 9.4, 9.5_
  
  - [x] 4.5 Write unit tests for syncOrgPaymentMethods
    - Test adding new payment methods creates associations
    - Test removing payment methods deletes associations
    - Test preserving existing associations
    - Test transaction rollback on error
    - _Requirements: 4.3, 4.4, 4.5, 6.5_
  
  - [x] 4.6 Write unit tests for initializeDefaultPaymentMethods
    - Test creates pay-offline association with correct status and data
    - Test handles missing pay-offline gracefully
    - _Requirements: 3.1, 3.2, 3.3_
  
  - [x] 4.7 Write property test for association creation
    - **Property 3: Organization-payment method association creation**
    - **Validates: Requirements 2.1**
  
  - [x] 4.8 Write property test for association uniqueness
    - **Property 4: Association uniqueness**
    - **Validates: Requirements 2.4, 9.5**
  
  - [x] 4.9 Write property test for association data completeness
    - **Property 5: Association data completeness**
    - **Validates: Requirements 2.2, 2.5**
  
  - [x] 4.10 Write property test for payment data JSON round-trip
    - **Property 6: Payment data JSON round-trip**
    - **Validates: Requirements 2.3, 5.3, 10.3**
  
  - [x] 4.11 Write property test for status initialization
    - **Property 7: Status initialization based on activation requirements**
    - **Validates: Requirements 2.6, 2.7, 2.8**
  
  - [x] 4.12 Write property test for default payment method initialization
    - **Property 8: Default payment method initialization**
    - **Validates: Requirements 3.1, 3.2, 3.3**

- [x] 5. Checkpoint - Ensure all backend service tests pass
  - Run all unit tests and property tests for PaymentMethodService and OrgPaymentMethodDataService
  - Verify migrations can be applied and rolled back successfully
  - Ensure all tests pass, ask the user if questions arise

- [x] 6. Extend OrganizationService
  - [x] 6.1 Update createOrganization method
    - After creating organization, call initializeDefaultPaymentMethods
    - If enabledPaymentMethods is provided in DTO, call syncOrgPaymentMethods
    - Wrap payment method operations in try-catch to handle errors gracefully
    - Ensure backward compatibility - enabledPaymentMethods is optional
    - _Requirements: 3.1, 3.2, 3.3, 4.3, 4.5, 6.3, 6.4_
  
  - [x] 6.2 Update updateOrganization method
    - If enabledPaymentMethods is provided in DTO, call syncOrgPaymentMethods
    - Ensure backward compatibility - enabledPaymentMethods is optional
    - _Requirements: 4.4, 4.5, 6.3, 6.5_
  
  - [x] 6.3 Update getOrganizationById method
    - After fetching organization, call getOrgPaymentMethods to populate paymentMethods field
    - Include payment method details in response
    - _Requirements: 4.2_
  
  - [x] 6.4 Update existing OrganizationService unit tests
    - Ensure all existing tests still pass with new payment method logic
    - Mock OrgPaymentMethodDataService calls in existing tests
    - Add test data for payment methods where needed
    - _Requirements: All organization requirements_
  
  - [x] 6.5 Write unit tests for organization payment method integration
    - Test createOrganization initializes default payment methods
    - Test createOrganization with enabledPaymentMethods syncs correctly
    - Test updateOrganization with enabledPaymentMethods syncs correctly
    - Test getOrganizationById includes payment methods
    - _Requirements: 3.1, 3.2, 3.3, 4.3, 4.4, 4.5, 6.5_
  
  - [x] 6.6 Write property test for payment method selection creates association
    - **Property 9: Payment method selection creates association**
    - **Validates: Requirements 4.3**
  
  - [x] 6.7 Write property test for payment method deselection removes association
    - **Property 10: Payment method deselection removes association**
    - **Validates: Requirements 4.4**
  
  - [x] 6.8 Write property test for payment method selection persistence
    - **Property 11: Payment method selection persistence**
    - **Validates: Requirements 4.5**
  
  - [x] 6.9 Write property test for organization update synchronization
    - **Property 13: Organization update synchronization**
    - **Validates: Requirements 6.5**

- [x] 7. Create API routes for payment methods
  - [x] 7.1 Create payment-method.routes.ts
    - GET /api/payment-methods - get all active payment methods
    - GET /api/payment-methods/:id - get payment method by ID
    - POST /api/payment-methods - create payment method (super admin only)
    - PUT /api/payment-methods/:id - update payment method (super admin only)
    - DELETE /api/payment-methods/:id - deactivate payment method (super admin only)
    - Add authentication and authorization middleware
    - Add input validation middleware
    - _Requirements: 6.1, 10.1, 10.4_
  
  - [x] 7.2 Create organization payment method routes
    - GET /api/organizations/:orgId/payment-methods - get org payment methods
    - POST /api/organizations/:orgId/payment-methods - add payment method to org
    - PUT /api/organizations/:orgId/payment-methods/:methodId - update org payment method
    - DELETE /api/organizations/:orgId/payment-methods/:methodId - remove payment method from org
    - Add authentication and authorization middleware
    - Add input validation middleware
    - _Requirements: 2.1, 4.3, 4.4, 6.2_
  
  - [x] 7.3 Register routes in main application
    - Import and register payment-method.routes
    - Ensure routes are properly mounted
    - _Requirements: 6.1, 6.2_
  
  - [x] 7.4 Write integration tests for payment method API routes
    - Test GET /api/payment-methods returns seeded data
    - Test POST /api/payment-methods creates new method
    - Test PUT /api/payment-methods/:id updates method
    - Test DELETE /api/payment-methods/:id deactivates method
    - Test authorization (super admin only)
    - _Requirements: 6.1, 10.1, 10.4_
  
  - [x] 7.5 Write integration tests for organization payment method API routes
    - Test GET /api/organizations/:orgId/payment-methods
    - Test POST /api/organizations/:orgId/payment-methods
    - Test PUT /api/organizations/:orgId/payment-methods/:methodId
    - Test DELETE /api/organizations/:orgId/payment-methods/:methodId
    - Test authorization
    - _Requirements: 2.1, 4.3, 4.4, 6.2_

- [x] 8. Checkpoint - Ensure all backend tests pass
  - Run full backend test suite including new API route tests
  - Verify all existing organization tests still pass
  - Test API endpoints manually using Postman or curl
  - Ensure all tests pass, ask the user if questions arise

- [x] 9. Create frontend types and API client
  - [x] 9.1 Create payment-method types in frontend
    - Create packages/admin/src/types/payment-method.types.ts
    - Define PaymentMethod interface matching backend
    - Define OrgPaymentMethodData interface matching backend
    - _Requirements: 1.1, 2.1_
  
  - [x] 9.2 Add payment method API client functions
    - Add getPaymentMethods() to organizationApi.ts or create paymentMethodApi.ts
    - Add getOrgPaymentMethods(orgId) function
    - Add updateOrgPaymentMethods(orgId, methodIds) function
    - Use axios for HTTP requests
    - Include proper error handling
    - _Requirements: 6.1, 6.2, 10.4_

- [x] 10. Create PaymentMethodSelector component
  - [x] 10.1 Create PaymentMethodSelector.tsx component
    - Accept props: paymentMethods, selectedPaymentMethods, onChange, disabled
    - Render checkbox for each payment method
    - Display payment method display name and description
    - Indicate which methods require activation (chip or badge)
    - Follow similar pattern to CapabilitySelector component
    - Use Material-UI components for consistency
    - _Requirements: 8.1, 8.4, 8.5, 8.6_
  
  - [x] 10.2 Write unit tests for PaymentMethodSelector
    - Test renders all provided payment methods
    - Test indicates selected payment methods
    - Test onChange callback when checkbox toggled
    - Test disabled state
    - Test displays activation requirement indicator
    - _Requirements: 8.4, 8.5_
  
  - [x] 10.3 Write property test for UI renders all payment methods
    - **Property 17: UI renders all available payment methods**
    - **Validates: Requirements 8.4**
  
  - [x] 10.4 Write property test for UI indicates selected methods
    - **Property 18: UI indicates selected payment methods**
    - **Validates: Requirements 8.5**

- [x] 11. Integrate PaymentMethodSelector into CreateOrganizationPage
  - [x] 11.1 Update CreateOrganizationPage component
    - Add state for paymentMethods list
    - Load payment methods via API in useEffect
    - Initialize selectedPaymentMethods with "pay-offline" by default
    - Add PaymentMethodSelector component to form
    - Pass selectedPaymentMethods in CreateOrganizationDto
    - _Requirements: 3.1, 4.1, 4.3, 8.2_
  
  - [x] 11.2 Write integration test for CreateOrganizationPage with payment methods
    - Test payment methods are loaded and displayed
    - Test "pay-offline" is selected by default
    - Test selecting/deselecting payment methods
    - Test form submission includes selected payment methods
    - _Requirements: 3.1, 4.1, 4.3, 8.2_

- [x] 12. Integrate PaymentMethodSelector into EditOrganizationPage
  - [x] 12.1 Update EditOrganizationPage component
    - Add state for paymentMethods list
    - Load payment methods via API in useEffect
    - Load current organization payment methods
    - Initialize selectedPaymentMethods with current associations
    - Add PaymentMethodSelector component to form
    - Pass selectedPaymentMethods in UpdateOrganizationDto
    - _Requirements: 4.2, 4.4, 4.5, 8.3_
  
  - [x] 12.2 Write integration test for EditOrganizationPage with payment methods
    - Test payment methods are loaded and displayed
    - Test current payment methods are pre-selected
    - Test selecting/deselecting payment methods
    - Test form submission includes updated payment methods
    - _Requirements: 4.2, 4.4, 4.5, 8.3_

- [x] 13. Final checkpoint - Full system verification
  - Run complete test suite (backend + frontend)
  - Verify all existing tests still pass
  - Test end-to-end flow: create organization with payment methods
  - Test end-to-end flow: edit organization payment methods
  - Verify database migrations work correctly
  - Ensure all tests pass, ask the user if questions arise

## Notes

- All tasks are required for complete implementation
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation and catch issues early
- Property tests validate universal correctness properties with minimum 100 iterations
- Unit tests validate specific examples and edge cases
- All existing unit tests must continue to pass - backward compatibility is critical
- The enabledPaymentMethods field is optional in DTOs to maintain backward compatibility
