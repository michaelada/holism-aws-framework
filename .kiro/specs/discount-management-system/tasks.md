# Implementation Plan: Discount Management System

## Overview

This implementation plan breaks down the discount management system into discrete, incremental tasks. The approach follows a bottom-up strategy: database → backend services → API routes → frontend components → module integration. Each task builds on previous work, with testing integrated throughout.

The implementation is divided into two main phases:
- **Phase 1**: Core infrastructure (database, backend services, API)
- **Phase 2**: Events module integration (UI and discount application)

## Tasks

- [x] 1. Database schema and migrations
  - Create migration file with discounts, discount_applications, and discount_usage tables
  - Add all indexes for performance optimization
  - Add constraints for data integrity (unique codes, valid date ranges, valid percentages)
  - Add new discount capabilities to capabilities table
  - _Requirements: 15.1, 15.2, 15.3, 15.4, 15.5, 15.6, 15.7, 15.8, 15.9, 15.10_

- [x] 2. Backend type definitions
  - Create packages/backend/src/types/discount.types.ts
  - Define all TypeScript interfaces: Discount, CreateDiscountDto, UpdateDiscountDto, DiscountApplication, DiscountUsage, UsageStats
  - Define enums: ModuleType, DiscountType, ApplicationScope, DiscountStatus
  - Define calculation result interfaces: DiscountResult, AppliedDiscount, ValidationResult
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 3. Discount Calculator Service
  - [x] 3.1 Create packages/backend/src/services/discount-calculator.service.ts
    - Implement calculateItemDiscount for percentage and fixed discounts
    - Implement calculateQuantityDiscount for quantity-based rules
    - Implement applyMultipleDiscounts with priority sorting and combination rules
    - Implement calculateCartDiscounts for cart-level discounts
    - Add monetary rounding to 2 decimal places for all calculations
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 13.10_
  
  - [x] 3.2 Write property test for percentage discount calculation
    - **Property 18: Percentage Discount Calculation**
    - **Validates: Requirements 13.1**
  
  - [x] 3.3 Write property test for fixed amount discount calculation
    - **Property 19: Fixed Amount Discount Calculation**
    - **Validates: Requirements 13.2**
  
  - [x] 3.4 Write property test for non-negative final price invariant
    - **Property 17: Non-Negative Final Price Invariant**
    - **Validates: Requirements 8.6, 13.6**
  
  - [x] 3.5 Write property test for maximum discount cap
    - **Property 21: Maximum Discount Cap**
    - **Validates: Requirements 13.5**
  
  - [x] 3.6 Write property test for monetary rounding
    - **Property 22: Monetary Value Rounding**
    - **Validates: Requirements 13.10**
  
  - [x] 3.7 Write property test for priority-based ordering
    - **Property 14: Priority-Based Ordering**
    - **Validates: Requirements 8.3**
  
  - [x] 3.8 Write property test for sequential discount application
    - **Property 16: Sequential Discount Application**
    - **Validates: Requirements 8.5**
  
  - [x] 3.9 Write unit tests for quantity-based discounts
    - Test "buy 2 get 1 free" scenario
    - Test "every 3rd item free" scenario
    - Test minimum quantity not met
    - _Requirements: 13.3_

- [x] 4. Discount Validator Service
  - [x] 4.1 Create packages/backend/src/services/discount-validator.service.ts
    - Implement validateCode to look up discount by code
    - Implement validateEligibility to check membership types, user groups, minimum purchase
    - Implement validateUsageLimits to check total and per-user limits
    - Implement validateValidity to check date range and status
    - Implement comprehensive validateDiscount method
    - _Requirements: 4.2, 5.2, 5.3, 6.3, 6.5, 7.2, 7.3, 7.4, 7.5_
  
  - [x] 4.2 Write property test for eligibility validation
    - **Property 13: Eligibility Validation**
    - **Validates: Requirements 7.2, 7.3, 7.4, 7.5**
  
  - [x] 4.3 Write property test for usage limit enforcement
    - **Property 11: Usage Limit Enforcement**
    - **Validates: Requirements 6.3, 6.5**
  
  - [x] 4.4 Write unit tests for validation error messages
    - Test expired discount error
    - Test usage limit reached error
    - Test eligibility not met error
    - Test minimum purchase not met error
    - _Requirements: 18.2, 18.3, 18.4, 18.5_

- [x] 5. Discount Service (CRUD operations)
  - [x] 5.1 Create packages/backend/src/services/discount.service.ts
    - Implement getByOrganisation with optional module type filter
    - Implement getById with organization ownership check
    - Implement create with input validation
    - Implement update with invariant preservation
    - Implement delete with cascade to discount_applications
    - Add pagination support with default page size of 50
    - _Requirements: 2.1, 2.6, 2.7, 2.8, 16.1, 16.2, 16.3, 16.4, 16.5_
  
  - [x] 5.2 Write property test for required field validation
    - **Property 2: Required Field Validation**
    - **Validates: Requirements 2.1**
  
  - [x] 5.3 Write property test for discount value validation
    - **Property 3: Discount Value Range Validation**
    - **Validates: Requirements 2.3, 2.4**
  
  - [x] 5.4 Write property test for organization scoping
    - **Property 4: Organization Scoping**
    - **Validates: Requirements 2.6**
  
  - [x] 5.5 Write property test for update invariant preservation
    - **Property 5: Update Invariant Preservation**
    - **Validates: Requirements 2.7**
  
  - [x] 5.6 Write property test for cascade deletion
    - **Property 6: Cascade Deletion**
    - **Validates: Requirements 2.8**
  
  - [x] 5.7 Write property test for code uniqueness
    - **Property 8: Discount Code Uniqueness**
    - **Validates: Requirements 4.2**
  
  - [x] 5.8 Write property test for code length validation
    - **Property 9: Discount Code Length Validation**
    - **Validates: Requirements 4.3**
  
  - [x] 5.9 Write property test for date range validation
    - **Property 10: Date Range Validation**
    - **Validates: Requirements 5.4**

- [x] 6. Discount Service (Application operations)
  - [x] 6.1 Add application methods to discount.service.ts
    - Implement applyToTarget to create discount_application record
    - Implement removeFromTarget to delete discount_application record
    - Implement getForTarget to retrieve all discounts for a target entity
    - Add validation to prevent applying inactive discounts
    - _Requirements: 2.10, 16.6, 16.7, 16.8_
  
  - [x] 6.2 Write property test for inactive discount prevention
    - **Property 7: Inactive Discount Prevention**
    - **Validates: Requirements 2.10**
  
  - [x] 6.3 Write unit tests for discount application
    - Test applying discount to event
    - Test applying discount to activity
    - Test removing discount from target
    - Test retrieving discounts for target
    - _Requirements: 16.6, 16.7, 16.8_

- [x] 7. Discount Service (Usage tracking)
  - [x] 7.1 Add usage tracking methods to discount.service.ts
    - Implement recordUsage to create discount_usage record
    - Implement atomic counter increment for total usage
    - Implement atomic counter increment for per-user usage
    - Implement getUsageStats to calculate statistics
    - Implement getUserUsageCount to get user's usage count
    - Use PostgreSQL transactions for atomic operations
    - _Requirements: 6.2, 6.4, 6.6, 14.1, 14.2, 14.3, 14.4, 14.5, 14.6, 14.7, 14.8, 14.9_
  
  - [x] 7.2 Write property test for atomic usage tracking
    - **Property 12: Atomic Usage Tracking**
    - **Validates: Requirements 6.2, 6.4, 6.6, 14.3, 14.4**
  
  - [x] 7.3 Write property test for usage recording
    - **Property 23: Usage Recording**
    - **Validates: Requirements 14.1**
  
  - [x] 7.4 Write property test for usage data completeness
    - **Property 24: Usage Data Completeness**
    - **Validates: Requirements 14.2**
  
  - [x] 7.5 Write unit tests for usage statistics
    - Test total discount amount calculation
    - Test average discount amount calculation
    - Test top users identification
    - Test date range filtering
    - _Requirements: 14.7, 14.8, 14.9, 14.10_

- [x] 8. Checkpoint - Backend services complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. Discount API routes
  - [x] 9.1 Create packages/backend/src/routes/discount.routes.ts
    - Implement GET /organisations/:organisationId/discounts with filters
    - Implement GET /organisations/:organisationId/discounts/:moduleType
    - Implement POST /discounts with validation
    - Implement GET /discounts/:id with ownership check
    - Implement PUT /discounts/:id with validation
    - Implement DELETE /discounts/:id with cascade
    - Add authenticateToken middleware to all routes
    - Add requireOrgAdminCapability middleware with module-specific capability
    - _Requirements: 16.1, 16.2, 16.3, 16.4, 16.5, 16.12, 16.13_
  
  - [x] 9.2 Write integration tests for discount CRUD endpoints
    - Test create discount with valid data
    - Test create discount with invalid data
    - Test get discount by ID
    - Test update discount
    - Test delete discount
    - Test list discounts with filters
    - _Requirements: 16.1, 16.2, 16.3, 16.4, 16.5_

- [x] 10. Discount application API routes
  - [x] 10.1 Add application routes to discount.routes.ts
    - Implement POST /discounts/:id/apply
    - Implement DELETE /discounts/:id/apply/:targetType/:targetId
    - Implement GET /discounts/target/:targetType/:targetId
    - Add validation for target type and ID
    - _Requirements: 16.6, 16.7, 16.8_
  
  - [x] 10.2 Write integration tests for application endpoints
    - Test applying discount to target
    - Test removing discount from target
    - Test getting discounts for target
    - _Requirements: 16.6, 16.7, 16.8_

- [x] 11. Discount validation and calculation API routes
  - [x] 11.1 Add validation and calculation routes to discount.routes.ts
    - Implement POST /discounts/validate
    - Implement POST /discounts/validate-code
    - Implement POST /discounts/calculate
    - Implement POST /discounts/calculate-cart
    - Add rate limiting to validation endpoints
    - _Requirements: 16.9, 16.10, 17.9_
  
  - [x] 11.2 Write integration tests for validation endpoints
    - Test discount validation with valid data
    - Test discount validation with invalid data
    - Test code validation
    - Test discount calculation
    - Test cart calculation
    - _Requirements: 16.9, 16.10_

- [x] 12. Discount usage API routes
  - [x] 12.1 Add usage routes to discount.routes.ts
    - Implement GET /discounts/:id/usage with pagination
    - Implement GET /discounts/:id/stats
    - Add query parameter support for date filtering
    - _Requirements: 16.11, 14.10_
  
  - [x] 12.2 Write integration tests for usage endpoints
    - Test getting usage history
    - Test getting usage statistics
    - Test date range filtering
    - _Requirements: 16.11_

- [x] 13. Register discount routes in backend
  - Update packages/backend/src/index.ts to import and register discount routes
  - Add route registration after existing module routes
  - _Requirements: 16.1_

- [x] 14. Checkpoint - Backend API complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 15. Frontend discount types
  - Create packages/orgadmin-events/src/types/discount.types.ts (or shared location)
  - Define frontend interfaces matching backend types
  - Add API client types for requests and responses
  - _Requirements: 2.1, 2.2, 2.3_

- [x] 16. Discount API client
  - [x] 16.1 Create packages/orgadmin-events/src/services/discount.service.ts
    - Implement getDiscounts(organisationId, moduleType, filters)
    - Implement getDiscountById(id)
    - Implement createDiscount(data)
    - Implement updateDiscount(id, data)
    - Implement deleteDiscount(id)
    - Implement applyDiscount(discountId, targetType, targetId)
    - Implement removeDiscount(discountId, targetType, targetId)
    - Implement getDiscountsForTarget(targetType, targetId)
    - Use axios for HTTP requests
    - Add error handling and response transformation
    - _Requirements: 16.1, 16.2, 16.3, 16.4, 16.5, 16.6, 16.7, 16.8_

- [x] 17. Discount Selector component
  - [x] 17.1 Create packages/components/src/discount/DiscountSelector.tsx
    - Accept props: moduleType, selectedDiscounts, onChange, multiSelect, disabled
    - Render checkbox "Apply Discounts" that shows/hides dropdown
    - Load discounts from API when checkbox is checked
    - Render multi-select dropdown with discount options
    - Display discount name, type, and value in options
    - Show discount details on hover using Tooltip
    - Emit selected discount IDs via onChange callback
    - Only render if discounts exist for module
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6, 12.7, 12.8, 12.9, 12.10_
  
  - [x] 17.2 Write component tests for DiscountSelector
    - Test rendering with no discounts (should not render)
    - Test rendering with discounts
    - Test checkbox toggle
    - Test dropdown selection
    - Test multi-select mode
    - Test onChange callback

- [x] 18. Discount Summary component
  - [x] 18.1 Create packages/components/src/discount/DiscountSummary.tsx
    - Accept props: discounts, originalAmount, finalAmount, appliedDiscounts
    - Display list of applied discounts with names and amounts
    - Show original price, total discount, and final price
    - Show breakdown of each discount's contribution
    - Add visual indication of savings (e.g., green text, percentage saved)
    - _Requirements: 13.8_
  
  - [x] 18.2 Write component tests for DiscountSummary
    - Test rendering with no discounts
    - Test rendering with single discount
    - Test rendering with multiple discounts
    - Test price calculations display

- [x] 19. Discounts List Page
  - [x] 19.1 Create packages/orgadmin-events/src/pages/DiscountsListPage.tsx
    - Create table with columns: name, type, value, scope, status, usage count, actions
    - Add filters for status, discount type, and application scope
    - Add search input for name or code
    - Implement pagination with 50 items per page
    - Add action buttons: Edit, Activate/Deactivate, Delete, View Usage
    - Implement delete confirmation dialog
    - Load discounts from API on mount
    - Handle loading and error states
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7, 10.8, 10.9_
  
  - [x] 19.2 Write component tests for DiscountsListPage
    - Test table rendering
    - Test filters
    - Test search
    - Test pagination
    - Test action buttons
    - Test delete confirmation

- [x] 20. Create Discount Page - Step 1 (Basic Information)
  - [x] 20.1 Create packages/orgadmin-events/src/pages/CreateDiscountPage.tsx with wizard structure
    - Set up multi-step wizard with 5 steps
    - Implement Step 1: Basic Information
    - Add fields: name (required), description, discount code, status
    - Add validation for required fields
    - Add validation for code length (3-50 characters)
    - Add "Next" button to proceed to Step 2
    - Store form data in component state
    - _Requirements: 11.1, 11.2, 4.3_

- [x] 21. Create Discount Page - Step 2 (Discount Configuration)
  - [x] 21.1 Implement Step 2 in CreateDiscountPage.tsx
    - Add discount type radio buttons (Percentage / Fixed Amount)
    - Add discount value input with validation
    - Add application scope dropdown (Item / Category / Cart / Quantity-based)
    - Add quantity rules fields (shown when scope is quantity-based)
    - Add validation for discount value based on type
    - Add "Back" and "Next" buttons
    - _Requirements: 11.3, 2.3, 2.4, 3.5_

- [x] 22. Create Discount Page - Step 3 (Eligibility Criteria)
  - [x] 22.1 Implement Step 3 in CreateDiscountPage.tsx
    - Add checkbox "Requires code entry"
    - Add multi-select for membership types
    - Add multi-select for user groups
    - Add minimum purchase amount input
    - Add maximum discount amount input
    - Add "Back" and "Next" buttons
    - _Requirements: 11.4, 7.1, 7.2, 7.3, 7.4, 7.5_

- [x] 23. Create Discount Page - Step 4 (Validity & Limits)
  - [x] 23.1 Implement Step 4 in CreateDiscountPage.tsx
    - Add valid-from date picker
    - Add valid-until date picker
    - Add total usage limit input
    - Add per-user usage limit input
    - Add combinable checkbox
    - Add priority number input
    - Add validation for date range (valid-from < valid-until)
    - Add "Back" and "Next" buttons
    - _Requirements: 11.5, 5.1, 5.2, 5.3, 5.4, 6.1, 6.2, 8.1, 8.2_

- [x] 24. Create Discount Page - Step 5 (Review & Confirm)
  - [x] 24.1 Implement Step 5 in CreateDiscountPage.tsx
    - Display summary of all settings from previous steps
    - Group settings by category (Basic, Configuration, Eligibility, Validity)
    - Add "Back" and "Save" buttons
    - Implement save functionality to call API
    - Handle success (redirect to list page)
    - Handle errors (display validation errors, stay on current step)
    - _Requirements: 11.6, 11.9, 11.10_
  
  - [x] 24.2 Write component tests for CreateDiscountPage
    - Test wizard navigation
    - Test form validation on each step
    - Test data persistence across steps
    - Test save functionality
    - Test error handling

- [x] 25. Edit Discount Page
  - [x] 25.1 Update CreateDiscountPage.tsx to support edit mode
    - Accept discountId prop for edit mode
    - Load existing discount data on mount when in edit mode
    - Pre-populate all form fields with existing data
    - Update page title to "Edit Discount"
    - Update save button to call update API instead of create
    - _Requirements: 11.7, 11.8, 2.7_

- [x] 26. Checkpoint - Discount pages complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 27. Events module - Add Discounts menu item
  - [x] 27.1 Update packages/orgadmin-events/src/index.ts
    - Add Discounts route to module registration
    - Add Discounts submenu item (only shown when entry-discounts capability enabled)
    - Register DiscountsListPage and CreateDiscountPage routes
    - _Requirements: 1.2, 9.1, 9.2_

- [x] 28. Events module - Update CreateEventPage Step 1
  - [x] 28.1 Update packages/orgadmin-events/src/pages/CreateEventPage.tsx
    - Add DiscountSelector component after venue selection
    - Pass moduleType="events" and targetType="event"
    - Store selected discount IDs in form state
    - Include discount IDs in event creation API call
    - _Requirements: 9.4, 9.5, 9.6_
  
  - [x] 28.2 Write integration tests for event creation with discounts
    - Test creating event with discounts
    - Test creating event without discounts
    - Test discount selector visibility

- [x] 29. Events module - Update CreateEventPage Step 4 (Activities)
  - [x] 29.1 Update activity form in CreateEventPage.tsx Step 4
    - Add DiscountSelector component for each activity
    - Pass moduleType="events" and targetType="event_activity"
    - Store selected discount IDs per activity in form state
    - Include discount IDs in activity creation API call
    - _Requirements: 9.7, 9.8_
  
  - [x] 29.2 Write integration tests for activity creation with discounts
    - Test creating activity with discounts
    - Test creating activity without discounts
    - Test multiple activities with different discounts

- [x] 30. Events module - Update EventDetailsPage
  - [x] 30.1 Update packages/orgadmin-events/src/pages/EventDetailsPage.tsx
    - Load applied discounts for the event
    - Display applied discounts in event details section
    - Load applied discounts for each activity
    - Display applied discounts in activity details
    - Use DiscountSummary component to show discount information
    - _Requirements: 9.9_

- [x] 31. Events module - Update EventsListPage
  - [x] 31.1 Update packages/orgadmin-events/src/pages/EventsListPage.tsx (optional)
    - Add "Has Discounts" indicator column
    - Show icon or badge if event has discounts applied
    - _Requirements: 9.9_

- [x] 32. Translations for discount system
  - [x] 32.1 Update packages/orgadmin-shell/src/locales/en-GB/translation.json
    - Add discount module translations
    - Add form field labels (name, description, code, type, value, scope, etc.)
    - Add validation error messages
    - Add success messages (created, updated, deleted)
    - Add confirmation messages (delete confirmation)
    - Add discount type labels (percentage, fixed)
    - Add application scope labels (item, category, cart, quantity-based)
    - Add status labels (active, inactive, expired)
    - _Requirements: 19.1, 19.2, 19.3, 19.4, 19.5, 19.6, 19.7, 19.8, 19.9_

- [x] 33. Final checkpoint - Events module integration complete
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional property-based and unit tests
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation at major milestones
- Property tests validate universal correctness properties with 100+ iterations
- Unit tests validate specific examples, edge cases, and error conditions
- The implementation follows the established pattern from Event Types and Venues
- Phase 2 (Events module) can be replicated for other modules (Memberships, Calendar, Merchandise, Registrations)
- All discount operations require appropriate capability permissions
- All monetary calculations are rounded to 2 decimal places
- Usage counters use atomic operations to prevent race conditions
