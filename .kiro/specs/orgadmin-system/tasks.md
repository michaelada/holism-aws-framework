# Implementation Plan: Organisation Admin System (ItsPlainSailing)

## Overview

This implementation plan breaks down the ItsPlainSailing Organisation Admin System into discrete, incremental phases. The system follows a modular architecture where each functional area is a separate workspace package, with capability-driven UI that dynamically loads modules based on organisation capabilities.

**Application Branding:**
- Application Name: ItsPlainSailing
- Small Logo: https://itsplainsailing.com/admin//logos/ips-logo-sails-transparent-64.png
- Large Logo: https://itsplainsailing.com/admin/logos/ips-logo-sails-darker-text-transparent-128.png

The implementation follows this structure:
1. **Phase 1: Shell Foundation** - Authentication, routing, and module registration system
2. **Phase 2: Core Modules** - Always-available modules (Dashboard, Forms, Settings, Payments, Reporting, Users)
3. **Phase 3: Capability Modules** - Feature modules that load based on capabilities (Events, Members, Merchandise, Calendar, Registrations, Tickets)
4. **Phase 4: Backend Services** - API services for all modules
5. **Phase 5: Integration & Testing** - End-to-end integration and comprehensive testing
6. **Phase 6: AWS Infrastructure** - CloudFront CDN and S3 file storage setup

## Tasks

### Phase 1: Shell Foundation

- [x] 1. Create orgadmin-shell package structure
  - [x] 1.1 Initialize orgadmin-shell workspace package
    - Create `packages/orgadmin-shell` directory
    - Initialize package.json with dependencies (React, React Router, MUI, Keycloak)
    - Configure TypeScript and Vite build setup
    - Add workspace reference in root package.json
    - _Requirements: 3.1.1, 3.1.2_
  
  - [x] 1.2 Create module registration type definitions
    - Create `src/types/module.types.ts` with ModuleRegistration interface
    - Add `title` and `description` fields to ModuleRegistration
    - Define ModuleRoute, MenuItem, and ModuleCard interfaces
    - Export types for use by feature modules
    - _Requirements: 3.1.2_
  
  - [x] 1.3 Implement CapabilityContext
    - Create `src/context/CapabilityContext.tsx`
    - Implement capability loading from backend API
    - Provide hasCapability() helper function
    - Handle loading and error states
    - _Requirements: 2.1.4, 3.2.2_
  
  - [x] 1.4 Implement OrganisationContext
    - Create `src/context/OrganisationContext.tsx`
    - Provide organisation data to all components
    - Include organisation details (name, currency, language, status)
    - _Requirements: 2.1.3_
  
  - [x] 1.5 Implement Keycloak authentication integration
    - Create `src/hooks/useAuth.ts` hook
    - Initialize Keycloak client with configuration
    - Implement login/logout flows
    - Fetch user's organisation on successful authentication
    - Verify user has org-admin role
    - _Requirements: 2.1.1, 2.1.2, 2.1.6, 3.2.1_
  
  - [x] 1.6 Write unit tests for authentication and context
    - Test CapabilityContext capability filtering
    - Test OrganisationContext data provision
    - Test useAuth hook authentication flows
    - _Requirements: 3.5.1_

- [x] 2. Create shell layout and navigation
  - [x] 2.1 Implement Layout component
    - Create `src/components/Layout.tsx` with responsive drawer
    - Implement AppBar with ItsPlainSailing branding and logo
    - Create navigation drawer with dynamic menu items
    - Add mobile-responsive drawer toggle
    - Include logout button in drawer
    - _Requirements: 2.2.1, 3.4.1, 1.2_
  
  - [x] 2.2 Implement DashboardCard component
    - Create `src/components/DashboardCard.tsx`
    - Display card with icon, title, and description
    - Add hover effects and click navigation
    - Apply neumorphic theme styling
    - _Requirements: 2.2.2, 2.2.3, 3.4.2_
  
  - [x] 2.3 Implement DashboardPage (landing page)
    - Create `src/pages/DashboardPage.tsx`
    - Display grid of DashboardCards for available modules
    - Use module.title and module.description from registrations
    - Filter cards based on enabled capabilities
    - Show welcome message with organisation name
    - Sort cards by module order
    - _Requirements: 2.2.1, 2.2.4, 2.2.5, 2.2.6, 3.1.2_
  
  - [x] 2.4 Implement module loader and routing
    - Create `src/components/ModuleLoader.tsx` for lazy loading
    - Implement dynamic route generation from module registrations
    - Add Suspense boundaries with loading indicators
    - Handle 404 for unknown routes
    - _Requirements: 3.1.3_
  
  - [x] 2.5 Write unit tests for layout components
    - Test Layout renders navigation correctly
    - Test DashboardCard navigation on click
    - Test DashboardPage filters modules by capability
    - _Requirements: 3.5.1_

- [x] 3. Implement main App component and routing
  - [x] 3.1 Create App.tsx with module registration
    - Import all core and capability module registrations
    - Filter modules based on user's capabilities
    - Set up BrowserRouter with /orgadmin basename
    - Wrap app with OrganisationProvider and CapabilityProvider
    - Implement loading screen during authentication
    - _Requirements: 2.1.4, 2.1.5, 3.1.2, 3.1.3_
  
  - [x] 3.2 Configure Vite build and development server
    - Create vite.config.ts with proper base path
    - Configure proxy for backend API calls
    - Set up code splitting for optimal bundle sizes
    - Configure environment variables
    - _Requirements: 3.6.2_
  
  - [x] 3.3 Write integration tests for shell routing
    - Test module filtering based on capabilities
    - Test route navigation between modules
    - Test authentication redirect flows
    - _Requirements: 3.5.2_

- [x] 4. Checkpoint - Shell foundation complete
  - Verify authentication flow works end-to-end
  - Verify capability-based module filtering
  - Verify navigation and routing
  - Ensure all tests pass
  - Ask user if questions arise

### Phase 2: Core Modules (Always Available)

- [x] 5. Create orgadmin-core package structure
  - [x] 5.1 Initialize orgadmin-core workspace package
    - Create `packages/orgadmin-core` directory
    - Initialize package.json with dependencies
    - Configure TypeScript build
    - Create subdirectories for each core module
    - _Requirements: 3.1.1_
  
  - [x] 5.2 Set up shared utilities and hooks
    - Create `src/hooks/useApi.ts` for API calls
    - Create `src/utils/validation.ts` for form validation
    - Create `src/utils/formatting.ts` for data formatting
    - _Requirements: 3.1.1_

- [x] 6. Implement Dashboard module
  - [x] 6.1 Create dashboard module registration
    - Create `src/dashboard/index.ts` with module registration
    - Define routes and menu items
    - Set order to 1 (first in menu)
    - _Requirements: 2.2.1, 3.1.2_
  
  - [x] 6.2 Implement DashboardPage with metrics
    - Create `src/dashboard/pages/DashboardPage.tsx`
    - Display metric cards (events, members, revenue, payments)
    - Fetch dashboard data from backend API
    - Show loading and error states
    - _Requirements: 2.12.2_
  
  - [x] 6.3 Write unit tests for dashboard
    - Test dashboard data fetching
    - Test metric card rendering
    - _Requirements: 3.5.1_

- [x] 7. Implement Forms module (Form Builder)
  - [x] 7.1 Create forms module registration
    - Create `src/forms/index.ts` with module registration
    - Include title and description fields
    - Define routes for list, create, edit, preview
    - _Requirements: 2.9.8, 3.1.2_
  
  - [x] 7.2 Implement FormsListPage
    - Create `src/forms/pages/FormsListPage.tsx`
    - Display table of application forms with name, status, created date
    - Add search and filter functionality
    - Include "Create Form" button
    - _Requirements: 2.9.2_
  
  - [x] 7.3 Implement FormBuilderPage (reuse existing UI patterns)
    - Create `src/forms/pages/FormBuilderPage.tsx`
    - Reuse MetadataForm component from shared components
    - Reuse MetadataWizard component for multi-step forms
    - Reuse FieldRenderer for field display
    - Support field types: text, email, number, select, checkbox, date, document_upload
    - Implement field grouping using existing patterns
    - Implement wizard configuration using existing patterns
    - Save form as draft or publish
    - _Requirements: 2.9.2, 2.9.3, 2.9.4, 2.9.5, 2.9.6_
  
  - [x] 7.4 Implement FormPreviewPage
    - Create `src/forms/pages/FormPreviewPage.tsx`
    - Render form with all fields including document_upload
    - Show how form will appear to end users
    - Use existing FieldRenderer component
    - _Requirements: 2.9.2_
  
  - [x] 7.5 Write unit tests for forms module
    - Test form list rendering and filtering
    - Test form builder field operations
    - Test form validation rules
    - Test document_upload field configuration
    - _Requirements: 3.5.1_

- [x] 8. Implement Settings module
  - [x] 8.1 Create settings module registration
    - Create `src/settings/index.ts` with module registration
    - Define routes for different settings sections
    - _Requirements: 2.10.6, 3.1.2_
  
  - [x] 8.2 Implement SettingsPage with tabs
    - Create `src/settings/pages/SettingsPage.tsx`
    - Add tabs for: Organisation Details, Payment Settings, Email Templates, Branding
    - _Requirements: 2.10.2, 2.10.3, 2.10.4, 2.10.5_
  
  - [x] 8.3 Implement OrganisationDetailsTab
    - Create form for organisation name, address, contact info
    - Implement save functionality
    - _Requirements: 2.10.2_
  
  - [x] 8.4 Implement PaymentSettingsTab
    - Create form for Stripe configuration
    - Add currency and payment method settings
    - _Requirements: 2.10.3_
  
  - [x] 8.5 Implement BrandingTab
    - Add logo upload component
    - Add colour picker for theme colours
    - Show preview of branding
    - _Requirements: 2.10.5_
  
  - [x] 8.6 Write unit tests for settings module
    - Test settings form validation
    - Test settings save operations
    - _Requirements: 3.5.1_

- [x] 9. Implement Payments module
  - [x] 9.1 Create payments module registration
    - Create `src/payments/index.ts` with module registration
    - Define routes for payments list and details
    - _Requirements: 2.11.6, 3.1.2_
  
  - [x] 9.2 Implement PaymentsListPage
    - Create `src/payments/pages/PaymentsListPage.tsx`
    - Display table of payments with date, amount, status, type
    - Add filters for date range, status, payment method
    - Include export to CSV button
    - _Requirements: 2.11.2, 2.11.5_
  
  - [x] 9.3 Implement PaymentDetailsPage
    - Create `src/payments/pages/PaymentDetailsPage.tsx`
    - Show full payment details
    - Display related transaction (event, membership, etc.)
    - Add refund button with confirmation dialog
    - _Requirements: 2.11.2, 2.11.4_
  
  - [x] 9.4 Implement LodgementsPage
    - Create `src/payments/pages/LodgementsPage.tsx`
    - Display lodgement history
    - Show breakdown by payment method
    - _Requirements: 2.11.3_
  
  - [x] 9.5 Write unit tests for payments module
    - Test payment list filtering
    - Test payment details rendering
    - Test refund flow
    - _Requirements: 3.5.1_

- [x] 10. Implement Reporting module
  - [x] 10.1 Create reporting module registration
    - Create `src/reporting/index.ts` with module registration
    - Define routes for different report types
    - _Requirements: 2.12.6, 3.1.2_
  
  - [x] 10.2 Implement ReportingDashboardPage
    - Create `src/reporting/pages/ReportingDashboardPage.tsx`
    - Display high-level metrics with charts
    - Show events, members, revenue trends
    - Add date range selector
    - _Requirements: 2.12.2, 2.12.5_
  
  - [x] 10.3 Implement EventsReportPage
    - Create `src/reporting/pages/EventsReportPage.tsx`
    - Show event attendance and revenue
    - Add filters and export functionality
    - _Requirements: 2.12.3, 2.12.4_
  
  - [x] 10.4 Implement MembersReportPage
    - Create `src/reporting/pages/MembersReportPage.tsx`
    - Show membership growth and retention
    - Add filters and export functionality
    - _Requirements: 2.12.3, 2.12.4_
  
  - [x] 10.5 Implement RevenueReportPage
    - Create `src/reporting/pages/RevenueReportPage.tsx`
    - Show revenue breakdown by source
    - Add charts and export functionality
    - _Requirements: 2.12.3, 2.12.4_
  
  - [x] 10.6 Write unit tests for reporting module
    - Test report data fetching
    - Test date range filtering
    - Test export functionality
    - _Requirements: 3.5.1_

- [x] 11. Implement Users module
  - [x] 11.1 Create users module registration
    - Create `src/users/index.ts` with module registration
    - Include title and description fields
    - Define routes for admin users and account users
    - _Requirements: 2.13.9, 3.1.2_
  
  - [x] 11.2 Implement OrgAdminUsersListPage
    - Create `src/users/pages/OrgAdminUsersListPage.tsx`
    - Display table of org admin users with name, email, roles
    - Add "Invite Admin User" button
    - Use existing backend user management services
    - _Requirements: 2.13.3, 2.13.8_
  
  - [x] 11.3 Implement AccountUsersListPage
    - Create `src/users/pages/AccountUsersListPage.tsx`
    - Display table of account users with name, email, status
    - Add "Create Account User" button
    - Show user capabilities (events, merchandise, bookings, registrations)
    - _Requirements: 2.13.6, 2.13.7_
  
  - [x] 11.4 Implement UserDetailsPage
    - Create `src/users/pages/UserDetailsPage.tsx`
    - Show user details and assigned roles (for admin users)
    - Allow editing roles
    - Add deactivate/delete user functionality
    - Support both admin and account user types
    - _Requirements: 2.13.4, 2.13.5_
  
  - [x] 11.5 Implement InviteUserDialog
    - Create `src/users/components/InviteUserDialog.tsx`
    - Form for email and initial role assignment
    - Send invitation email
    - Support inviting both admin and account users
    - _Requirements: 2.13.4_
  
  - [x] 11.6 Write unit tests for users module
    - Test user list rendering for both types
    - Test role assignment for admin users
    - Test user invitation flow
    - _Requirements: 3.5.1_

- [x] 12. Checkpoint - Core modules complete
  - Verify all core modules are accessible
  - Verify navigation between core modules
  - Ensure all tests pass
  - Ask user if questions arise

### Phase 3: Capability Modules

- [x] 13. Create Events module (event-management capability)
  - [x] 13.1 Initialize orgadmin-events workspace package
    - Create `packages/orgadmin-events` directory
    - Initialize package.json with dependencies
    - Configure TypeScript build
    - _Requirements: 3.1.1_
  
  - [x] 13.2 Create events module registration
    - Create `src/index.ts` with module registration
    - Include title and description fields
    - Set capability requirement to 'event-management'
    - Define routes for list, create, edit, details, entries
    - _Requirements: 2.3.8, 3.1.2_
  
  - [x] 13.3 Implement EventsListPage
    - Create `src/pages/EventsListPage.tsx`
    - Display table of events with name, dates, status, capacity
    - Add search and filter functionality
    - Include "Create Event" button
    - _Requirements: 2.3.1, 2.3.2_
  
  - [x] 13.4 Implement CreateEventPage with enhanced attributes
    - Create `src/pages/CreateEventPage.tsx`
    - Form for Event Name, Description, Event Owner
    - Email Notifications field (comma-separated)
    - Event Start Date and End Date (defaults to start date)
    - Open Date Entries and Entries Closing Date
    - Limit Number Of Event Entries (yes/no with limit)
    - Add Message To Confirmation Email (yes/no with message)
    - Add activities section
    - Save as draft or publish
    - _Requirements: 2.3.2, 2.3.3_
  
  - [x] 13.5 Implement EventActivityForm with enhanced attributes
    - Create `src/components/EventActivityForm.tsx`
    - Form for Activity Name and Description
    - Show Publicly toggle
    - Application Form selector (from Form Builder)
    - Limit Number of Applicants (yes/no with limit)
    - Allow Specify Quantity toggle
    - Use Terms and Conditions (yes/no with rich text editor)
    - Fee field (0.00 for free)
    - Allowed Payment Method (card, cheque/offline, both)
    - Handling Fee Included toggle
    - Cheque/Offline Payment Instructions text area
    - _Requirements: 2.3.3, 2.3.4_
  
  - [x] 13.6 Implement EventEntriesPage
    - Create `src/pages/EventEntriesPage.tsx`
    - Tabular view with columns: Event Activity, First Name, Last Name, Entry Date/Time, Actions
    - Event Activity dropdown filter
    - Name search filter
    - "Download All Entries" button for Excel export
    - Drill-down action to view full entry details
    - _Requirements: 2.3.5, 2.3.6, 2.3.7_
  
  - [x] 13.7 Implement EventEntryDetailsDialog
    - Create `src/components/EventEntryDetailsDialog.tsx`
    - Display all form fields from submission
    - Show payment status and method
    - Display uploaded files with download links
    - _Requirements: 2.3.7_
  
  - [x] 13.8 Implement EventDetailsPage
    - Create `src/pages/EventDetailsPage.tsx`
    - Show event details and all attributes
    - Display activities list with enhanced attributes
    - Link to entries page
    - Add edit and delete buttons
    - _Requirements: 2.3.5_
  
  - [x] 13.9 Write unit tests for events module
    - Test event list rendering and filtering
    - Test event creation form validation with all attributes
    - Test activity form validation
    - Test entries table filtering
    - Test Excel export functionality
    - _Requirements: 3.5.1_

- [x] 14. Create Memberships module (memberships capability)
  - [x] 14.1 Initialize orgadmin-memberships workspace package
    - Create `packages/orgadmin-memberships` directory
    - Initialize package.json with dependencies
    - Configure TypeScript build
    - _Requirements: 3.1.1_
  
  - [x] 14.2 Create memberships module registration
    - Create `src/index.ts` with module registration
    - Include title and description fields
    - Set capability requirement to 'memberships'
    - Define routes for membership types, members database, member details
    - _Requirements: 2.4.9, 3.1.2_
  
  - [x] 14.3 Implement MembershipTypesListPage
    - Create `src/pages/MembershipTypesListPage.tsx`
    - Display table of membership types with name, status, type (single/group), pricing
    - Add search and filter functionality
    - Include "Create Membership Type" button with dropdown (Single/Group)
    - Show status badges (Open/Closed)
    - _Requirements: 2.4.1, 2.4.2_
  
  - [x] 14.4 Implement CreateSingleMembershipTypePage
    - Create `src/pages/CreateSingleMembershipTypePage.tsx`
    - Form for Name, Description
    - Membership Form selector (from Form Builder)
    - Membership Status dropdown (Open/Closed)
    - Is Rolling Membership toggle
    - Conditional fields: Valid Until (if not rolling) or Number Of Months (if rolling)
    - Automatically Approve Application toggle
    - Add Member Labels multi-select with tag input
    - Supported Payment Methods multi-select from Payments module
    - Use Terms and Conditions toggle
    - Conditional Terms and Conditions rich text editor
    - Save and Publish buttons
    - _Requirements: 2.4.2, 2.4.3, 2.4.10_
  
  - [x] 14.5 Implement CreateGroupMembershipTypePage
    - Create `src/pages/CreateGroupMembershipTypePage.tsx`
    - All fields from Single Membership Type
    - Additional fields: Max Number of People, Min Number of People
    - Person Configuration section:
      - For each person slot (1 to Max): optional Title and Labels
      - Field Configuration table showing all form fields
      - Toggle for each field: Common to all / Unique for each person
    - Save and Publish buttons
    - _Requirements: 2.4.2, 2.4.3, 2.4.10_
  
  - [x] 14.6 Implement MembershipTypeDetailsPage
    - Create `src/pages/MembershipTypeDetailsPage.tsx`
    - Display all membership type attributes
    - Show field configuration for group memberships
    - Show person titles and labels for group memberships
    - Link to edit page
    - Add delete button with confirmation
    - _Requirements: 2.4.2_
  
  - [x] 14.7 Implement MembersDatabasePage
    - Create `src/pages/MembersDatabasePage.tsx`
    - Tabular view with columns: Membership Type, First Name, Last Name, Membership Number, Date Last Renewed, Status, Valid Until, Labels, Processed Status, Actions
    - Default filter buttons: Current (default), Elapsed, All
    - Search field for name search
    - Custom filter dropdown selector
    - Batch operation buttons: Mark Processed, Mark Unprocessed, Add Labels, Remove Labels
    - Row selection checkboxes
    - Excel Export button
    - Action icons: View, Edit, Mark Processed/Unprocessed toggle
    - _Requirements: 2.4.4, 2.4.6, 2.4.7, 2.4.8_
  
  - [x] 14.8 Implement MemberDetailsPage
    - Create `src/pages/MemberDetailsPage.tsx`
    - Display all member information from application form
    - Show membership type, number, status, dates
    - Display payment status and method
    - Show uploaded files with download links
    - Status change controls (dropdown with Pending/Active/Elapsed)
    - Label management (add/remove labels)
    - Processed status toggle
    - Edit button
    - _Requirements: 2.4.4, 2.4.5_
  
  - [x] 14.9 Implement CreateCustomFilterDialog
    - Create `src/components/CreateCustomFilterDialog.tsx`
    - Form for filter name
    - Member Status multi-select (Active, Pending, Elapsed)
    - Date Last Renewed filters: Before date, After date, or date range
    - Valid Until filters: Before date, After date, or date range
    - Member Labels multi-select
    - Save button to create named filter
    - _Requirements: 2.4.7_
  
  - [x] 14.10 Implement BatchOperationsDialog
    - Create `src/components/BatchOperationsDialog.tsx`
    - Dialog for Mark Processed/Unprocessed operations
    - Dialog for Add Labels operation with label multi-select
    - Dialog for Remove Labels operation with label multi-select
    - Confirmation and progress indicators
    - _Requirements: 2.4.6_
  
  - [x] 14.11 Implement MembershipTypeForm component
    - Create `src/components/MembershipTypeForm.tsx`
    - Reusable form component for both single and group types
    - Handles conditional field display based on Is Rolling Membership
    - Handles conditional T&Cs editor
    - Handles group-specific fields (person configuration)
    - Field validation
    - _Requirements: 2.4.2, 2.4.3_
  
  - [x] 14.12 Implement FieldConfigurationTable component
    - Create `src/components/FieldConfigurationTable.tsx`
    - Display all fields from selected membership form
    - Toggle for each field: Common to all / Unique for each person
    - Only shown for group membership types
    - _Requirements: 2.4.2_
  
  - [x] 14.13 Implement PersonConfigurationSection component
    - Create `src/components/PersonConfigurationSection.tsx`
    - For each person slot (1 to Max Number):
      - Optional title input
      - Optional labels multi-select
    - Dynamic based on Max Number of People
    - Only shown for group membership types
    - _Requirements: 2.4.2_
  
  - [x] 14.14 Write unit tests for memberships module
    - Test membership type list rendering and filtering
    - Test single membership type creation form validation
    - Test group membership type creation with person configuration
    - Test members database filtering (default and custom filters)
    - Test batch operations (mark processed, add/remove labels)
    - Test Excel export functionality
    - Test member details view and status changes
    - _Requirements: 3.5.1_

- [x] 15. Create Merchandise module (merchandise capability)
  - [x] 15.1 Initialize orgadmin-merchandise workspace package
    - Create `packages/orgadmin-merchandise` directory
    - Initialize package.json with dependencies
    - Configure TypeScript build
    - _Requirements: 3.1.1_
  
  - [x] 15.2 Create merchandise module registration
    - Create `src/index.ts` with module registration
    - Include title and description fields
    - Set capability requirement to 'merchandise'
    - Define routes for merchandise types, orders, order details
    - _Requirements: 2.5.10, 3.1.2_
  
  - [x] 15.3 Implement MerchandiseTypesListPage
    - Create `src/pages/MerchandiseTypesListPage.tsx`
    - Display table of merchandise types with name, status, price range, stock status
    - Add search and filter functionality (status, stock level)
    - Include "Create Merchandise Type" button
    - Show status badges (Active/Inactive)
    - Show stock indicators if tracking enabled
    - _Requirements: 2.5.1, 2.5.2_
  
  - [x] 15.4 Implement CreateMerchandiseTypePage with comprehensive configuration
    - Create `src/pages/CreateMerchandiseTypePage.tsx`
    - **Basic Information Section:**
      - Form for Name, Description
      - Status dropdown (Active/Inactive)
      - Multiple image upload component with preview
      - Drag-and-drop reordering for images
    - **Options Configuration Section:**
      - Add Option Type button (e.g., "Size", "Pack Type", "Color")
      - For each option type:
        - Option Type Name field
        - Add Option Value button
        - For each option value: Name, Price, SKU (optional)
        - Reorder option values
        - Delete option value
      - Support multiple option types
      - Preview of all option combinations with calculated prices
    - **Stock Management Section (Optional):**
      - Track Stock Levels toggle
      - Conditional fields if enabled:
        - Stock Quantity per option value
        - Low Stock Alert threshold
        - Out of Stock Behavior dropdown (Hide/Show as Unavailable)
    - **Delivery Configuration Section:**
      - Delivery Type dropdown (Free/Fixed/Quantity-Based)
      - Conditional fields based on type:
        - Fixed: Delivery Fee field
        - Quantity-Based: Delivery Rules table
          - Add Rule button
          - For each rule: Min Quantity, Max Quantity (optional), Delivery Fee
          - Reorder rules
          - Delete rule
    - **Order Quantity Rules Section:**
      - Min Order Quantity field (default 1)
      - Max Order Quantity field (optional)
      - Quantity Increments field (optional)
    - **Application Form Section:**
      - Require Application Form toggle
      - Conditional Application Form selector (from Form Builder)
    - **Payment Configuration Section:**
      - Supported Payment Methods multi-select
      - Use Terms and Conditions toggle
      - Conditional Terms and Conditions rich text editor
    - **Email Notifications Section:**
      - Admin Notification Emails field (comma-separated)
      - Custom Confirmation Message text area
    - Save and Publish buttons
    - Form validation for all required fields
    - _Requirements: 2.5.2, 2.5.3, 2.5.4, 2.5.5, 2.5.6, 2.5.7, 2.5.8_
  
  - [x] 15.5 Implement MerchandiseTypeDetailsPage
    - Create `src/pages/MerchandiseTypeDetailsPage.tsx`
    - Display all merchandise type attributes
    - Show image gallery with main image and additional views
    - Display options configuration with all option types and values
    - Show stock levels if tracking enabled
    - Display delivery configuration
    - Show order quantity rules
    - Display linked application form if required
    - Show payment configuration
    - Link to edit page
    - Add delete button with confirmation
    - Show order statistics (total orders, revenue)
    - _Requirements: 2.5.2_
  
  - [x] 15.6 Implement OptionsConfigurationSection component
    - Create `src/components/OptionsConfigurationSection.tsx`
    - Manage multiple option types (Size, Color, Pack, etc.)
    - Add/remove option types
    - Add/remove option values within each type
    - Set price for each option value
    - Optional SKU field
    - Reorder option types and values
    - Preview all combinations with calculated prices
    - Validation for required fields
    - _Requirements: 2.5.3_
  
  - [x] 15.7 Implement StockManagementSection component
    - Create `src/components/StockManagementSection.tsx`
    - Track Stock Levels toggle
    - Conditional stock quantity fields per option value
    - Low Stock Alert threshold field
    - Out of Stock Behavior selector
    - Stock level indicators (in stock, low stock, out of stock)
    - Manual stock adjustment controls
    - _Requirements: 2.5.5_
  
  - [x] 15.8 Implement DeliveryConfigurationSection component
    - Create `src/components/DeliveryConfigurationSection.tsx`
    - Delivery Type selector (Free/Fixed/Quantity-Based)
    - Conditional fields based on type:
      - Fixed: Single delivery fee field
      - Quantity-Based: Delivery rules table
        - Add/remove rules
        - Min/Max quantity fields
        - Delivery fee per rule
        - Rule ordering
    - Delivery fee calculator preview
    - Validation for overlapping quantity ranges
    - _Requirements: 2.5.6_
  
  - [x] 15.9 Implement OrderQuantityRulesSection component
    - Create `src/components/OrderQuantityRulesSection.tsx`
    - Min Order Quantity field with validation
    - Max Order Quantity field (optional)
    - Quantity Increments field (optional)
    - Preview of valid order quantities
    - Validation for logical rules (min < max, etc.)
    - _Requirements: 2.5.7_
  
  - [x] 15.10 Implement MerchandiseOrdersListPage
    - Create `src/pages/MerchandiseOrdersListPage.tsx`
    - Tabular view with columns: Order ID, Customer Name, Merchandise Type, Options, Quantity, Total Price, Payment Status, Order Status, Order Date, Actions
    - Filters above table:
      - Merchandise Type dropdown
      - Payment Status multi-select
      - Order Status multi-select
      - Date range filter
      - Customer name search
    - Batch operations:
      - Update order status for selected orders
      - Export selected orders to Excel
    - Row selection checkboxes
    - Excel Export button (top right)
    - Action icons: View Details, Update Status
    - Pagination for large datasets
    - _Requirements: 2.5.9_
  
  - [x] 15.11 Implement MerchandiseOrderDetailsPage
    - Create `src/pages/MerchandiseOrderDetailsPage.tsx`
    - Display all order information:
      - Order ID and date
      - Customer details (name, email)
      - Merchandise type with images
      - Selected options (e.g., Size: Large, Color: Blue)
      - Quantity ordered
      - Pricing breakdown:
        - Unit price (based on selected options)
        - Subtotal (quantity × unit price)
        - Delivery fee (with calculation explanation)
        - Total price
    - Display application form submission data if applicable
    - Show uploaded files with download links (if form has document_upload fields)
    - Order status update dropdown with save button
    - Payment status display
    - Admin notes text area with save button
    - Order history/audit trail section
    - Print order button
    - _Requirements: 2.5.9_
  
  - [x] 15.12 Implement OrderStatusUpdateDialog component
    - Create `src/components/OrderStatusUpdateDialog.tsx`
    - Order status dropdown (Pending/Processing/Shipped/Delivered/Cancelled)
    - Optional notes field for status change
    - Confirmation button
    - Option to send status update email to customer
    - _Requirements: 2.5.9_
  
  - [x] 15.13 Implement BatchOrderOperationsDialog component
    - Create `src/components/BatchOrderOperationsDialog.tsx`
    - Batch status update operation
    - Status dropdown for multiple orders
    - Optional notes field
    - Confirmation and progress indicators
    - Success/error reporting per order
    - _Requirements: 2.5.9_
  
  - [x] 15.14 Implement MerchandiseTypeForm component
    - Create `src/components/MerchandiseTypeForm.tsx`
    - Reusable form component for create/edit
    - Handles all sections (basic info, options, stock, delivery, quantity rules, form, payment, notifications)
    - Conditional field display based on toggles
    - Form validation
    - Image upload with preview
    - Rich text editor for T&Cs
    - _Requirements: 2.5.2, 2.5.3, 2.5.4, 2.5.5, 2.5.6, 2.5.7, 2.5.8_
  
  - [x] 15.15 Implement ImageGalleryUpload component
    - Create `src/components/ImageGalleryUpload.tsx`
    - Multiple image upload with drag-and-drop
    - Image preview thumbnails
    - Drag-and-drop reordering
    - Set main image
    - Delete images
    - Image size validation
    - Upload to S3
    - _Requirements: 2.5.4_
  
  - [x] 15.16 Implement PriceCalculator utility
    - Create `src/utils/priceCalculator.ts`
    - Calculate unit price based on selected options
    - Calculate subtotal (quantity × unit price)
    - Calculate delivery fee based on delivery type and quantity
    - Calculate total price (subtotal + delivery fee)
    - Validate quantity against rules (min, max, increments)
    - _Requirements: 2.5.3, 2.5.6, 2.5.7_
  
  - [x] 15.17 Write unit tests for merchandise module
    - Test merchandise type list rendering and filtering
    - Test merchandise type creation form validation with all sections
    - Test options configuration with multiple option types
    - Test stock management calculations
    - Test delivery fee calculation for all delivery types
    - Test order quantity rules validation
    - Test price calculator utility
    - Test orders list filtering and batch operations
    - Test order details view and status updates
    - Test Excel export functionality
    - _Requirements: 3.5.1_

- [x] 16. Create Calendar module (calendar-bookings capability)
  - [x] 16.1 Initialize orgadmin-calendar workspace package
    - Create `packages/orgadmin-calendar` directory
    - Initialize package.json with dependencies (React, MUI, date-fns, react-big-calendar)
    - Configure TypeScript build
    - Add workspace reference in root package.json
    - _Requirements: 3.1.1_
  
  - [x] 16.2 Create calendar module registration
    - Create `src/index.ts` with module registration
    - Include title and description fields
    - Set capability requirement to 'calendar-bookings'
    - Define routes for calendars list, create, edit, details, bookings views
    - _Requirements: 2.6.12, 3.1.2_
  
  - [x] 16.3 Create calendar types
    - Create `src/types/calendar.types.ts`
    - Define Calendar, TimeSlotConfiguration, DurationOption, BlockedPeriod interfaces
    - Define Booking, BookingHistory, ScheduleRule interfaces
    - Define CalendarSlotView for calendar display
    - Define form data types
    - Export all calendar-related types
    - _Requirements: 2.6.2, 2.6.5_
  
  - [x] 16.4 Implement CalendarsListPage
    - Create `src/pages/CalendarsListPage.tsx`
    - Display table of calendars with name, description, status, display colour indicator
    - Add search and filter functionality (status, name)
    - Include "Create Calendar" button
    - Show status badges (Open/Closed)
    - Show colour indicator for each calendar
    - Action buttons: View, Edit, Open/Close toggle
    - _Requirements: 2.6.1, 2.6.2, 2.6.3_
  
  - [x] 16.5 Implement CreateCalendarPage with comprehensive configuration
    - Create `src/pages/CreateCalendarPage.tsx`
    - **Basic Information Section:**
      - Form for Name, Description
      - Display Colour picker (hex colour selector)
      - Status dropdown (Open/Closed)
    - **Automated Opening/Closing Section:**
      - Enable Automated Schedule toggle
      - Schedule Rules table (conditional)
        - Add Rule button
        - For each rule: Start Date, End Date, Action (Open/Close), Time of Day, Reason
        - Delete rule button
    - **Booking Window Configuration Section:**
      - Minimum Days In Advance field (default 0)
      - Maximum Days In Advance field (default 90)
    - **Terms and Conditions Section:**
      - Use Terms and Conditions toggle
      - Conditional Terms and Conditions rich text editor
    - **Payment Configuration Section:**
      - Supported Payment Methods multi-select
    - **Cancellation Policy Section:**
      - Allow Cancellations toggle
      - Conditional fields:
        - Cancel Days In Advance field
        - Refund Payment Automatically toggle
    - **Email Notifications Section:**
      - Admin Notification Emails field (comma-separated)
      - Send Reminder Emails toggle
      - Reminder Hours Before field (conditional)
    - Save and Publish buttons
    - Form validation for all required fields
    - _Requirements: 2.6.2, 2.6.3, 2.6.4, 2.6.6, 2.6.7, 2.6.8_
  
  - [x] 16.6 Implement TimeSlotConfigurationSection component
    - Create `src/components/TimeSlotConfigurationSection.tsx`
    - Manage time slot configurations for calendar
    - Add/remove time slot configurations
    - For each configuration:
      - Days of Week multi-select (Mon-Sun)
      - Start Time picker
      - Effective Date Range (start and end dates)
      - Recurrence Weeks field (1=weekly, 2=bi-weekly, etc.)
      - Places Available field (default 1)
      - Minimum Places Required field (optional, only if Places Available > 1)
      - Duration Options section:
        - Add Duration Option button
        - For each option: Duration (minutes), Price, Label
        - Delete option button
        - Reorder options
    - Preview of generated time slots
    - Validation for overlapping configurations
    - _Requirements: 2.6.5_
  
  - [x] 16.7 Implement BlockedPeriodsSection component
    - Create `src/components/BlockedPeriodsSection.tsx`
    - Manage blocked periods for calendar
    - Add/remove blocked periods
    - Two types of blocks:
      - **Date Range Blocks**: Start Date, End Date, Reason
      - **Time Segment Blocks**: Days of Week, Start Time, End Time, Reason
    - Visual calendar preview showing blocked periods
    - Delete block button
    - _Requirements: 2.6.9_
  
  - [x] 16.8 Implement CalendarDetailsPage
    - Create `src/pages/CalendarDetailsPage.tsx`
    - Display all calendar attributes
    - Show time slot configurations with all details
    - Display blocked periods
    - Show booking statistics (total bookings, revenue, utilization rate)
    - Link to edit page
    - Add delete button with confirmation
    - Quick actions: Open/Close calendar, View bookings
    - _Requirements: 2.6.2_
  
  - [x] 16.9 Implement BookingsListPage (Tabular View)
    - Create `src/pages/BookingsListPage.tsx`
    - Tabular view with columns: Booking Reference, Calendar Name, Account User, Date, Time, Duration, Places Booked, Price, Payment Status, Booking Status, Booked Date, Actions
    - Filters above table:
      - Calendar dropdown (all or specific calendar)
      - Date range filter (from date, to date)
      - Booking Status multi-select (Confirmed, Cancelled, Pending Payment)
      - Payment Status multi-select (Paid, Pending, Refunded)
      - Account user name search
    - Action buttons:
      - View booking details
      - Cancel booking (with refund option)
      - Resend confirmation email
    - Excel Export button (top right)
    - Pagination for large datasets
    - _Requirements: 2.6.10, 2.6.11_
  
  - [x] 16.10 Implement BookingsCalendarPage (Calendar View)
    - Create `src/pages/BookingsCalendarPage.tsx`
    - Visual calendar display using react-big-calendar or similar
    - View modes: Month, Week, Day
    - Colour coding by calendar (using display colour)
    - Time slot grid showing:
      - Available slots with places remaining count
      - Fully booked slots
      - Partially booked slots (for multi-place slots)
      - Blocked periods
    - Click slot to see booking details or make admin booking
    - Calendar selector dropdown (view all or specific calendar)
    - Date navigation controls
    - Legend showing colour codes and status indicators
    - _Requirements: 2.6.10_
  
  - [x] 16.11 Implement BookingDetailsPage
    - Create `src/pages/BookingDetailsPage.tsx`
    - Display all booking information:
      - Booking reference number
      - Calendar name and description
      - Account user details (name, email, phone)
      - Date and time of booking
      - Duration and price breakdown
      - Number of places booked
      - Payment status and method
      - Booking status
      - Booked date/time
      - Cancellation details (if cancelled)
      - Admin notes
    - Admin actions:
      - Cancel booking with optional refund
      - Modify booking (change date/time if available)
      - Resend confirmation email
      - Add/edit admin notes
    - Booking history/audit trail section
    - Print booking button
    - _Requirements: 2.6.10_
  
  - [x] 16.12 Implement CancelBookingDialog component
    - Create `src/components/CancelBookingDialog.tsx`
    - Cancellation confirmation dialog
    - Optional refund checkbox (if payment was made)
    - Cancellation reason text field
    - Validation: Check if within cancellation window
    - Warning messages if refund not possible
    - Confirmation button
    - _Requirements: 2.6.8_
  
  - [x] 16.13 Implement ScheduleRulesSection component
    - Create `src/components/ScheduleRulesSection.tsx`
    - Manage automated opening/closing schedule rules
    - Add/remove schedule rules
    - For each rule:
      - Start Date and End Date
      - Action dropdown (Open/Close)
      - Time of Day picker
      - Reason text field
    - Rule ordering (execution order for overlapping rules)
    - Preview of upcoming scheduled actions
    - Validation for conflicting rules
    - _Requirements: 2.6.4_
  
  - [x] 16.14 Implement CalendarForm component
    - Create `src/components/CalendarForm.tsx`
    - Reusable form component for create/edit
    - Handles all sections (basic info, schedule, booking window, T&Cs, payment, cancellation, notifications)
    - Conditional field display based on toggles
    - Form validation
    - Colour picker integration
    - Rich text editor for T&Cs
    - _Requirements: 2.6.2, 2.6.3, 2.6.4, 2.6.6, 2.6.7, 2.6.8_
  
  - [x] 16.15 Implement SlotAvailabilityCalculator utility
    - Create `src/utils/slotAvailabilityCalculator.ts`
    - Calculate available slots based on time slot configurations
    - Apply blocked periods to remove unavailable slots
    - Calculate places remaining for each slot
    - Check minimum places requirement
    - Validate booking windows (min/max days in advance)
    - Generate CalendarSlotView objects for display
    - _Requirements: 2.6.5, 2.6.6, 2.6.7_
  
  - [x] 16.16 Implement CancellationValidator utility
    - Create `src/utils/cancellationValidator.ts`
    - Validate if booking can be cancelled
    - Check cancellation policy (Allow Cancellations setting)
    - Validate Cancel Days In Advance requirement
    - Calculate if refund should be processed
    - Generate validation messages for user feedback
    - _Requirements: 2.6.8_
  
  - [x] 16.17 Write unit tests for calendar module
    - Test calendar list rendering and filtering
    - Test calendar creation form validation with all sections
    - Test time slot configuration with multiple durations
    - Test blocked periods (date ranges and time segments)
    - Test schedule rules for automated opening/closing
    - Test bookings list filtering (tabular view)
    - Test calendar view rendering with colour coding
    - Test booking details view and cancellation
    - Test slot availability calculator:
      - Available slots generation
      - Blocked period application
      - Places remaining calculation
      - Minimum places threshold logic
      - Booking window validation
    - Test cancellation validator:
      - Policy validation
      - Days in advance calculation
      - Refund eligibility
    - Test Excel export functionality
    - _Requirements: 3.5.1_


- [x] 17. Create Registrations module (registrations capability)
  - [x] 17.1 Initialize orgadmin-registrations workspace package
    - Create `packages/orgadmin-registrations` directory
    - Initialize package.json with dependencies
    - Configure TypeScript build
    - Add workspace reference in root package.json
    - _Requirements: 3.1.1_
  
  - [x] 17.2 Create registrations module registration
    - Create `src/index.ts` with module registration
    - Include title and description fields
    - Set capability requirement to 'registrations'
    - Define routes for registration types, registrations database, registration details
    - _Requirements: 2.7.10, 3.1.2_
  
  - [x] 17.3 Implement RegistrationTypesListPage
    - Create `src/pages/RegistrationTypesListPage.tsx`
    - Display table of registration types with name, entity name, status, pricing
    - Add search and filter functionality
    - Include "Create Registration Type" button
    - Show status badges (Open/Closed)
    - _Requirements: 2.7.1, 2.7.2_
  
  - [x] 17.4 Implement CreateRegistrationTypePage
    - Create `src/pages/CreateRegistrationTypePage.tsx`
    - Form for Name, Description
    - Entity Name field (e.g., "Horse", "Boat", "Equipment")
    - Registration Form selector (from Form Builder)
    - Registration Status dropdown (Open/Closed)
    - Is Rolling Registration toggle
    - Conditional fields: Valid Until (if not rolling) or Number Of Months (if rolling)
    - Automatically Approve Application toggle
    - Add Registration Labels multi-select with tag input
    - Supported Payment Methods multi-select from Payments module
    - Use Terms and Conditions toggle
    - Conditional Terms and Conditions rich text editor
    - Save and Publish buttons
    - _Requirements: 2.7.2, 2.7.3, 2.7.4, 2.7.11_
  
  - [x] 17.5 Implement RegistrationTypeDetailsPage
    - Create `src/pages/RegistrationTypeDetailsPage.tsx`
    - Display all registration type attributes
    - Show entity name prominently
    - Link to edit page
    - Add delete button with confirmation
    - _Requirements: 2.7.2_
  
  - [x] 17.6 Implement RegistrationsDatabasePage
    - Create `src/pages/RegistrationsDatabasePage.tsx`
    - Tabular view with columns: Registration Type, Entity Name, Registration Number, Owner Name, Date Last Renewed, Status, Valid Until, Labels, Processed Status, Actions
    - Default filter buttons: Current (default), Elapsed, All
    - Search field for entity name or owner name search
    - Custom filter dropdown selector
    - Batch operation buttons: Mark Processed, Mark Unprocessed, Add Labels, Remove Labels
    - Row selection checkboxes
    - Excel Export button
    - Action icons: View, Edit, Mark Processed/Unprocessed toggle
    - _Requirements: 2.7.5, 2.7.7, 2.7.8, 2.7.9_
  
  - [x] 17.7 Implement RegistrationDetailsPage
    - Create `src/pages/RegistrationDetailsPage.tsx`
    - Display all registration information from application form
    - Show registration type, number, status, dates
    - Display entity name prominently
    - Show owner information
    - Display payment status and method
    - Show uploaded files with download links
    - Status change controls (dropdown with Pending/Active/Elapsed)
    - Label management (add/remove labels)
    - Processed status toggle
    - Edit button
    - _Requirements: 2.7.5, 2.7.6_
  
  - [x] 17.8 Implement CreateCustomFilterDialog
    - Create `src/components/CreateCustomFilterDialog.tsx`
    - Form for filter name
    - Registration Status multi-select (Active, Pending, Elapsed)
    - Date Last Renewed filters: Before date, After date, or date range
    - Valid Until filters: Before date, After date, or date range
    - Registration Labels multi-select
    - Registration Type multi-select
    - Save button to create named filter
    - _Requirements: 2.7.8_
  
  - [x] 17.9 Implement BatchOperationsDialog
    - Create `src/components/BatchOperationsDialog.tsx`
    - Dialog for Mark Processed/Unprocessed operations
    - Dialog for Add Labels operation with label multi-select
    - Dialog for Remove Labels operation with label multi-select
    - Confirmation and progress indicators
    - _Requirements: 2.7.7_
  
  - [x] 17.10 Implement RegistrationTypeForm component
    - Create `src/components/RegistrationTypeForm.tsx`
    - Reusable form component for create/edit
    - Handles conditional field display based on Is Rolling Registration
    - Handles conditional T&Cs editor
    - Entity Name field with validation
    - Field validation
    - _Requirements: 2.7.2, 2.7.3, 2.7.4_
  
  - [x] 17.11 Write unit tests for registrations module
    - Test registration type list rendering and filtering
    - Test registration type creation form validation
    - Test entity name field handling
    - Test registrations database filtering (default and custom filters)
    - Test batch operations (mark processed, add/remove labels)
    - Test Excel export functionality
    - Test registration details view and status changes
    - Test automatic status management (Active to Elapsed)
    - _Requirements: 3.5.1, 2.7.12_

- [x] 18. Create Ticketing module (event-ticketing capability)
  - [x] 18.1 Initialize orgadmin-ticketing workspace package
    - Create `packages/orgadmin-ticketing` directory
    - Initialize package.json with dependencies (React, MUI, QRCode generation library)
    - Configure TypeScript build
    - Add workspace reference in root package.json
    - _Requirements: 3.1.1_
  
  - [x] 18.2 Create ticketing module registration
    - Create `src/index.ts` with module registration
    - Include title and description fields
    - Set capability requirement to 'event-ticketing'
    - Define routes for ticketing dashboard, ticket details
    - _Requirements: 2.8.12, 3.1.2_
  
  - [x] 18.3 Implement TicketingDashboardPage
    - Create `src/pages/TicketingDashboardPage.tsx`
    - Display summary cards: Total Issued, Scanned, Not Scanned, Last Scan Time
    - Tabular view with columns: Ticket Reference, Event Name, Event Activity, Customer Name, Customer Email, Issue Date, Scan Status, Scan Date, Actions
    - Filters above table: Event dropdown, Event Activity dropdown, Scan Status multi-select, Date Range, Search field
    - Row selection checkboxes for batch operations
    - Batch operation buttons: Mark as Scanned, Mark as Not Scanned
    - Excel Export button (top right above table)
    - Real-time updates when tickets are scanned (polling or WebSocket)
    - _Requirements: 2.8.6, 2.8.7, 2.8.8, 2.8.9, 2.8.10, 2.8.11_
  
  - [x] 18.4 Implement TicketDetailsDialog
    - Create `src/components/TicketDetailsDialog.tsx`
    - Display full ticket information (reference, QR code, event details, customer info)
    - Show QR code prominently
    - Display scan history table if ticket has been scanned
    - Show booking details link
    - Manual scan status controls (Mark Scanned/Not Scanned buttons)
    - Resend ticket email button
    - Download ticket PDF button
    - _Requirements: 2.8.11, 2.8.14_
  
  - [x] 18.5 Implement BatchTicketOperationsDialog
    - Create `src/components/BatchTicketOperationsDialog.tsx`
    - Dialog for Mark as Scanned operation with confirmation
    - Dialog for Mark as Not Scanned operation with confirmation
    - Show count of selected tickets
    - Progress indicator for batch operations
    - Success/error messaging
    - _Requirements: 2.8.11_
  
  - [x] 18.6 Implement TicketingStatsCards component
    - Create `src/components/TicketingStatsCards.tsx`
    - Display summary statistics in card format
    - Total Tickets Issued card
    - Tickets Scanned card with percentage
    - Tickets Not Scanned card
    - Last Scan Time card with real-time indicator
    - Auto-refresh on data updates
    - _Requirements: 2.8.7_
  
  - [x] 18.7 Implement event ticketing configuration in Events module
    - Update `packages/orgadmin-events/src/pages/CreateEventPage.tsx`
    - Add "Ticketing Settings" section (conditional on event-ticketing capability)
    - Generate Electronic Tickets toggle
    - Conditional ticket settings fields:
      - Ticket Header Text (optional text area)
      - Ticket Instructions (optional text area)
      - Ticket Footer Text (optional text area)
      - Ticket Validity Period (optional number field in hours)
      - Include Event Logo toggle
      - Ticket Background Color (optional color picker)
    - Save ticketing configuration with event
    - _Requirements: 2.8.2, 2.8.5_
  
  - [x] 18.8 Implement ticket generation service integration
    - Create `src/services/ticketGeneration.ts` utility
    - Function to generate unique ticket reference (TKT-YYYY-NNNNNN format)
    - Function to generate unique QR code UUID
    - Function to render ticket PDF with QR code
    - Function to attach ticket to email
    - Integration with event booking confirmation flow
    - Support for multiple tickets per booking (quantity > 1)
    - _Requirements: 2.8.3, 2.8.4, 2.8.13, 2.8.14_
  
  - [x] 18.9 Write unit tests for ticketing module
    - Test ticketing dashboard rendering and filtering
    - Test ticket details display
    - Test batch operations (mark scanned/not scanned)
    - Test Excel export functionality
    - Test real-time updates (mock WebSocket/polling)
    - Test ticket generation utilities (reference, QR code)
    - Test event ticketing configuration form
    - _Requirements: 3.5.1_

- [x] 19. Checkpoint - Capability modules complete
  - Verify all capability modules load correctly
  - Verify capability-based visibility
  - Ensure all tests pass
  - Ask user if questions arise

### Phase 4: Backend Services

- [x] 20. Create database schema for new entities
  - [x] 20.1 Create events and activities tables with enhanced schema
    - Create migration for events table with all new attributes
    - Create migration for event_activities table with enhanced attributes
    - Create migration for event_entries table
    - Add indexes for organisation_id and dates
    - _Requirements: 3.3.2_
  
  - [x] 20.2 Create membership tables
    - Create migration for membership_types table
    - Create migration for members table
    - Add indexes for organisation_id and status
    - _Requirements: 3.3.2_
  
  - [x] 20.3 Create merchandise tables with comprehensive schema
    - Create migration for merchandise_types table with all attributes:
      - Basic fields: id, organisation_id, name, description, images (array), status
      - Stock management: track_stock_levels, low_stock_alert, out_of_stock_behavior
      - Delivery: delivery_type, delivery_fee, delivery_rules (JSONB)
      - Quantity rules: min_order_quantity, max_order_quantity, quantity_increments
      - Form integration: require_application_form, application_form_id
      - Payment: supported_payment_methods (array), use_terms_and_conditions, terms_and_conditions
      - Notifications: admin_notification_emails, custom_confirmation_message
      - Timestamps: created_at, updated_at
    - Create migration for merchandise_option_types table:
      - id, merchandise_type_id, name, order
      - Timestamps: created_at, updated_at
    - Create migration for merchandise_option_values table:
      - id, option_type_id, name, price, sku, stock_quantity, order
      - Timestamps: created_at, updated_at
    - Create migration for delivery_rules table:
      - id, merchandise_type_id, min_quantity, max_quantity, delivery_fee, order
    - Create migration for merchandise_orders table:
      - id, organisation_id, merchandise_type_id, user_id
      - selected_options (JSONB), quantity, unit_price, subtotal, delivery_fee, total_price
      - form_submission_id, payment_status, payment_method
      - order_status, admin_notes
      - order_date, created_at, updated_at
    - Create migration for merchandise_order_history table:
      - id, order_id, user_id, previous_status, new_status, notes, created_at
    - Add indexes for organisation_id, merchandise_type_id, user_id, order_status, payment_status
    - Add foreign key constraints
    - _Requirements: 3.3.2, 2.5.2, 2.5.3, 2.5.5, 2.5.6, 2.5.7, 2.5.9_
  
  - [x] 20.4 Create calendar and bookings tables
    - Create migration for calendars table
    - Create migration for bookings table
    - Add indexes for calendar_id and dates
    - _Requirements: 3.3.2_
  
  - [x] 20.5 Create registration tables
    - Create migration for registration_types table with all attributes:
      - Basic fields: id, organisation_id, name, description, entity_name
      - Form: registration_form_id
      - Status: registration_status (open/closed)
      - Duration: is_rolling_registration, valid_until, number_of_months
      - Approval: automatically_approve
      - Labels: registration_labels (array)
      - Payment: supported_payment_methods (array), use_terms_and_conditions, terms_and_conditions
      - Timestamps: created_at, updated_at
    - Create migration for registrations table:
      - id, organisation_id, registration_type_id, user_id
      - registration_number (auto-generated unique identifier)
      - entity_name (name/identifier of registered entity)
      - owner_name (account user name)
      - form_submission_id
      - date_last_renewed, status (active/pending/elapsed), valid_until
      - labels (array), processed (boolean)
      - payment_status, payment_method
      - Timestamps: created_at, updated_at
    - Create migration for registration_filters table:
      - id, organisation_id, user_id, name
      - registration_status (array), date_last_renewed_before, date_last_renewed_after
      - valid_until_before, valid_until_after
      - registration_labels (array), registration_types (array)
      - Timestamps: created_at, updated_at
    - Add indexes for organisation_id, registration_type_id, user_id, status, registration_number
    - Add foreign key constraints
    - _Requirements: 3.3.2, 2.7.2, 2.7.5, 2.7.8_
  
  - [x] 20.6 Create ticketing tables
    - Create migration for ticketed_events table
    - Create migration for ticket_types table
    - Create migration for tickets table
    - Add indexes for event_id and status
    - _Requirements: 3.3.2_
  
  - [x] 20.7 Create application forms and unified submission tables
    - Create migration for application_forms table (similar to object_definitions)
    - Create migration for application_fields table (similar to field_definitions, includes "document_upload" datatype)
    - Create migration for application_form_fields table (similar to object_fields)
    - Create migration for form_submissions table (unified across all contexts)
    - Create migration for form_submission_files table (tracks S3 uploads)
    - Add indexes for organisation_id, form_id, submission_type, context_id, and s3_key
    - _Requirements: 3.3.2, 2.9.9, 2.9.10_
  
  - [x] 20.8 Create payments and refunds tables
    - Create migration for payments table
    - Create migration for refunds table
    - Add indexes for organisation_id and payment_status
    - _Requirements: 3.3.2_
  
  - [x] 20.9 Create user management tables
    - Create migration for org_admin_users table
    - Create migration for account_users table
    - Add indexes for organisation_id and email
    - _Requirements: 3.3.2, 2.13.2_
  
  - [x] 20.10 Create reports table
    - Create migration for reports table
    - Add indexes for organisation_id and report_type
    - _Requirements: 3.3.2_

- [x] 21. Implement Event Management service
  - [x] 21.1 Create EventService class with enhanced attributes
    - Create `packages/backend/src/services/event.service.ts`
    - Implement getEventsByOrganisation()
    - Implement createEvent() with all new attributes
    - Implement updateEvent()
    - Implement deleteEvent()
    - Implement getEventById()
    - _Requirements: 2.3.2, 2.3.3_
  
  - [x] 21.2 Create EventActivityService class with enhanced attributes
    - Create `packages/backend/src/services/event-activity.service.ts`
    - Implement getActivitiesByEvent()
    - Implement createActivity() with all new attributes
    - Implement updateActivity()
    - Implement deleteActivity()
    - _Requirements: 2.3.3, 2.3.4_
  
  - [x] 21.3 Create EventEntryService class
    - Create `packages/backend/src/services/event-entry.service.ts`
    - Implement getEntriesByEvent()
    - Implement getEntryById()
    - Implement exportEntriesToExcel() with separate tables per activity
    - Implement filterEntries() by activity and name
    - _Requirements: 2.3.5, 2.3.6, 2.3.7_
  
  - [x] 21.4 Create event routes
    - Create `packages/backend/src/routes/event.routes.ts`
    - Add authentication middleware
    - Add capability check middleware for 'event-management'
    - Define REST endpoints for events, activities, and entries
    - Add export endpoint for entries
    - _Requirements: 3.2.2, 5.2_
  
  - [x] 21.5 Write unit tests for event service
    - Test event CRUD operations with all attributes
    - Test activity management with enhanced attributes
    - Test entry retrieval and filtering
    - Test Excel export functionality
    - Test capability authorization
    - _Requirements: 3.5.1_

- [x] 22. Implement Membership Management service
  - [x] 22.1 Create MembershipService class
    - Create `packages/backend/src/services/membership.service.ts`
    - Implement getMembershipTypesByOrganisation()
    - Implement createMembershipType()
    - Implement updateMembershipType()
    - Implement deleteMembershipType()
    - Implement getMembersByOrganisation()
    - _Requirements: 2.4.2, 2.4.3, 2.4.4_
  
  - [x] 22.2 Create membership routes
    - Create `packages/backend/src/routes/membership.routes.ts`
    - Add authentication and capability check middleware
    - Define REST endpoints for membership types and members
    - _Requirements: 3.2.2, 5.3_
  
  - [x] 22.3 Write unit tests for membership service
    - Test membership type CRUD operations
    - Test member management
    - Test renewal logic
    - _Requirements: 3.5.1_

- [ ] 23. Implement Merchandise Management service
  - [ ] 23.1 Create MerchandiseService class with comprehensive functionality
    - Create `packages/backend/src/services/merchandise.service.ts`
    - Implement getMerchandiseTypesByOrganisation()
    - Implement createMerchandiseType() with all attributes (options, stock, delivery, quantity rules)
    - Implement updateMerchandiseType()
    - Implement deleteMerchandiseType()
    - Implement getMerchandiseTypeById()
    - Implement getOrdersByOrganisation() with filtering
    - Implement getOrderById()
    - Implement createOrder() with price calculation
    - Implement updateOrderStatus()
    - Implement exportOrdersToExcel()
    - Implement updateStockLevels() (decrement on order, manual adjustment)
    - Implement calculatePrice() (unit price, subtotal, delivery fee, total)
    - Implement validateQuantity() (min, max, increments)
    - _Requirements: 2.5.2, 2.5.3, 2.5.5, 2.5.6, 2.5.7, 2.5.9_
  
  - [ ] 23.2 Create MerchandiseOptionService class
    - Create `packages/backend/src/services/merchandise-option.service.ts`
    - Implement createOptionType()
    - Implement updateOptionType()
    - Implement deleteOptionType()
    - Implement createOptionValue()
    - Implement updateOptionValue()
    - Implement deleteOptionValue()
    - Implement reorderOptionTypes()
    - Implement reorderOptionValues()
    - Implement getAllCombinations() (generate all option combinations)
    - _Requirements: 2.5.3_
  
  - [ ] 23.3 Create DeliveryRuleService class
    - Create `packages/backend/src/services/delivery-rule.service.ts`
    - Implement createDeliveryRule()
    - Implement updateDeliveryRule()
    - Implement deleteDeliveryRule()
    - Implement calculateDeliveryFee() (based on quantity and rules)
    - Implement validateRules() (check for overlapping ranges)
    - _Requirements: 2.5.6_
  
  - [ ] 23.4 Create merchandise routes
    - Create `packages/backend/src/routes/merchandise.routes.ts`
    - Add authentication and capability check middleware
    - Define REST endpoints:
      - GET /api/orgadmin/merchandise-types
      - POST /api/orgadmin/merchandise-types
      - GET /api/orgadmin/merchandise-types/:id
      - PUT /api/orgadmin/merchandise-types/:id
      - DELETE /api/orgadmin/merchandise-types/:id
      - GET /api/orgadmin/merchandise-types/:id/options
      - POST /api/orgadmin/merchandise-types/:id/options
      - PUT /api/orgadmin/merchandise-types/:typeId/options/:optionId
      - DELETE /api/orgadmin/merchandise-types/:typeId/options/:optionId
      - GET /api/orgadmin/merchandise-orders
      - GET /api/orgadmin/merchandise-orders/:id
      - POST /api/orgadmin/merchandise-orders
      - PUT /api/orgadmin/merchandise-orders/:id/status
      - GET /api/orgadmin/merchandise-orders/export
      - POST /api/orgadmin/merchandise-types/:id/stock/adjust
    - _Requirements: 3.2.2_
  
  - [ ] 23.5 Write unit tests for merchandise services
    - Test merchandise type CRUD operations with all attributes
    - Test option type and value management
    - Test option combination generation
    - Test stock level tracking and updates
    - Test delivery fee calculation for all delivery types
    - Test quantity validation against rules
    - Test price calculation (unit, subtotal, delivery, total)
    - Test order creation and status updates
    - Test order filtering and export
    - Test delivery rule validation (overlapping ranges)
    - _Requirements: 3.5.1_

- [ ] 24. Implement Calendar Bookings service
  - [ ] 24.1 Create CalendarService class
    - Create `packages/backend/src/services/calendar.service.ts`
    - Implement getCalendarsByOrganisation()
    - Implement createCalendar()
    - Implement updateCalendar()
    - Implement deleteCalendar()
    - Implement getBookingsByCalendar()
    - Implement createBooking()
    - _Requirements: 2.6.2, 2.6.3, 2.6.5_
  
  - [ ] 24.2 Create calendar routes
    - Create `packages/backend/src/routes/calendar.routes.ts`
    - Add authentication and capability check middleware
    - Define REST endpoints for calendars and bookings
    - _Requirements: 3.2.2_
  
  - [ ] 24.3 Write unit tests for calendar service
    - Test calendar CRUD operations
    - Test booking management
    - Test time slot validation
    - _Requirements: 3.5.1_

- [ ] 25. Implement Registration Management service
  - [ ] 25.1 Create RegistrationService class
    - Create `packages/backend/src/services/registration.service.ts`
    - Implement getRegistrationTypesByOrganisation()
    - Implement createRegistrationType() with all attributes (entity name, rolling/fixed period, labels)
    - Implement updateRegistrationType()
    - Implement deleteRegistrationType()
    - Implement getRegistrationTypeById()
    - Implement getRegistrationsByOrganisation() with filtering
    - Implement getRegistrationById()
    - Implement updateRegistrationStatus() (Pending → Active, Active → Elapsed)
    - Implement addLabelsToRegistrations() (batch operation)
    - Implement removeLabelsFromRegistrations() (batch operation)
    - Implement markRegistrationsProcessed() (batch operation)
    - Implement markRegistrationsUnprocessed() (batch operation)
    - Implement exportRegistrationsToExcel() with filtering
    - Implement getCustomFilters() and saveCustomFilter()
    - Implement automaticStatusUpdate() (nightly job: Active → Elapsed for expired registrations)
    - _Requirements: 2.7.2, 2.7.3, 2.7.5, 2.7.6, 2.7.7, 2.7.8, 2.7.9, 2.7.12_
  
  - [ ] 25.2 Create registration routes
    - Create `packages/backend/src/routes/registration.routes.ts`
    - Add authentication and capability check middleware
    - Define REST endpoints:
      - GET /api/orgadmin/registration-types
      - POST /api/orgadmin/registration-types
      - GET /api/orgadmin/registration-types/:id
      - PUT /api/orgadmin/registration-types/:id
      - DELETE /api/orgadmin/registration-types/:id
      - GET /api/orgadmin/registrations
      - GET /api/orgadmin/registrations/:id
      - PUT /api/orgadmin/registrations/:id/status
      - POST /api/orgadmin/registrations/batch/add-labels
      - POST /api/orgadmin/registrations/batch/remove-labels
      - POST /api/orgadmin/registrations/batch/mark-processed
      - POST /api/orgadmin/registrations/batch/mark-unprocessed
      - GET /api/orgadmin/registrations/export
      - GET /api/orgadmin/registrations/filters
      - POST /api/orgadmin/registrations/filters
    - _Requirements: 3.2.2_
  
  - [ ] 25.3 Write unit tests for registration service
    - Test registration type CRUD operations with all attributes
    - Test entity name field handling
    - Test rolling vs fixed-period registration logic
    - Test registration status management (Pending/Active/Elapsed)
    - Test batch operations (labels, processed status)
    - Test custom filter creation and application
    - Test Excel export with filtering
    - Test automatic status update (nightly job)
    - _Requirements: 3.5.1, 2.7.12_


- [ ] 26. Implement Event Ticketing service
  - [ ] 26.1 Create TicketingService class
    - Create `packages/backend/src/services/ticketing.service.ts`
    - Implement getTicketedEventsByOrganisation()
    - Implement createTicketedEvent()
    - Implement updateTicketedEvent()
    - Implement deleteTicketedEvent()
    - Implement getTicketSalesByEvent()
    - _Requirements: 2.8.2, 2.8.3, 2.8.5_
  
  - [ ] 26.2 Create ticketing routes
    - Create `packages/backend/src/routes/ticketing.routes.ts`
    - Add authentication and capability check middleware
    - Define REST endpoints for ticketed events and sales
    - _Requirements: 3.2.2_
  
  - [ ] 26.3 Write unit tests for ticketing service
    - Test ticketed event CRUD operations
    - Test ticket type management
    - Test capacity validation
    - _Requirements: 3.5.1_

- [ ] 27. Implement Application Form services (separate from Metadata)
  - [ ] 27.1 Create ApplicationFormService class
    - Create `packages/backend/src/services/application-form.service.ts`
    - Implement getApplicationFormsByOrganisation()
    - Implement createApplicationForm() with document_upload field support
    - Implement updateApplicationForm()
    - Implement deleteApplicationForm()
    - Implement getApplicationFormById()
    - Similar to MetadataService but for application forms
    - _Requirements: 2.9.2, 2.9.9_
  
  - [ ] 27.2 Create FormSubmissionService class (unified across contexts)
    - Create `packages/backend/src/services/form-submission.service.ts`
    - Implement getSubmissionsByOrganisation() with filters (submission_type, context_id, status)
    - Implement createSubmission() for all contexts (event_entry, membership_application, calendar_booking, merchandise_order, registration)
    - Implement updateSubmission()
    - Implement deleteSubmission()
    - Implement getSubmissionById()
    - Handle JSONB submission_data column
    - Link to FormSubmissionFile for uploaded documents
    - _Requirements: 2.9.10_
  
  - [ ] 27.3 Create application form routes
    - Create `packages/backend/src/routes/application-form.routes.ts`
    - Add authentication middleware
    - Define REST endpoints for application forms, fields, and submissions
    - Separate from metadata routes
    - _Requirements: 5.4_
  
  - [ ] 27.4 Write unit tests for application form services
    - Test application form CRUD operations
    - Test field management including document_upload fields
    - Test form validation
    - Test unified submission retrieval across contexts
    - Test submission filtering by type and context
    - _Requirements: 3.5.1_

- [ ] 27a. Implement File Upload service (S3 integration)
  - [ ] 27a.1 Create FileUploadService class
    - Create `packages/backend/src/services/file-upload.service.ts`
    - Implement uploadFile() with S3 SDK
    - Generate S3 key: /org-id/form-id/field-id/filename
    - Implement getFileUrl() with signed URLs
    - Implement deleteFile() from S3
    - Implement file validation (type, size, virus scan)
    - _Requirements: 2.9.7, 5.5_
  
  - [ ] 27a.2 Configure AWS S3 client
    - Create `packages/backend/src/config/aws.config.ts`
    - Initialize S3 client with credentials
    - Configure bucket name and region
    - Set up CORS for file uploads
    - _Requirements: 2.9.7_
  
  - [ ] 27a.3 Create file upload routes
    - Create `packages/backend/src/routes/file-upload.routes.ts`
    - Add authentication middleware
    - POST /api/orgadmin/files/upload (multipart)
    - GET /api/orgadmin/files/:fileId (signed URL)
    - DELETE /api/orgadmin/files/:fileId
    - _Requirements: 5.5_
  
  - [ ] 27a.4 Write unit tests for file upload service
    - Test file upload to S3
    - Test S3 key generation with org segregation
    - Test signed URL generation
    - Test file deletion
    - Test file validation
    - _Requirements: 3.5.1_

- [ ] 28. Implement Payment Management service
  - [ ] 28.1 Create PaymentService class
    - Create `packages/backend/src/services/payment.service.ts`
    - Implement getPaymentsByOrganisation()
    - Implement getPaymentById()
    - Implement requestRefund()
    - Implement exportPayments()
    - Implement getLodgementsByOrganisation()
    - _Requirements: 2.11.2, 2.11.3, 2.11.4, 2.11.5_
  
  - [ ] 28.2 Create payment routes
    - Create `packages/backend/src/routes/payment.routes.ts`
    - Add authentication middleware
    - Define REST endpoints for payments, refunds, lodgements
    - _Requirements: 5.5_
  
  - [ ] 28.3 Write unit tests for payment service
    - Test payment retrieval
    - Test refund processing
    - Test export functionality
    - _Requirements: 3.5.1_

- [ ] 29. Implement Reporting service
  - [ ] 29.1 Create ReportingService class
    - Create `packages/backend/src/services/reporting.service.ts`
    - Implement getDashboardMetrics()
    - Implement getEventsReport()
    - Implement getMembersReport()
    - Implement getRevenueReport()
    - Implement exportReport()
    - _Requirements: 2.12.2, 2.12.3, 2.12.4_
  
  - [ ] 29.2 Create reporting routes
    - Create `packages/backend/src/routes/reporting.routes.ts`
    - Add authentication middleware
    - Define REST endpoints for reports
    - _Requirements: 5.8_
  
  - [ ] 29.3 Write unit tests for reporting service
    - Test metric calculations
    - Test report generation
    - Test export functionality
    - _Requirements: 3.5.1_

- [ ] 29a. Implement User Management services
  - [ ] 29a.1 Create OrgAdminUserService class
    - Create `packages/backend/src/services/org-admin-user.service.ts`
    - Implement getAdminUsersByOrganisation()
    - Implement createAdminUser()
    - Implement updateAdminUser()
    - Implement deleteAdminUser()
    - Implement assignRoles()
    - _Requirements: 2.13.3, 2.13.4, 2.13.5_
  
  - [ ] 29a.2 Create AccountUserService class
    - Create `packages/backend/src/services/account-user.service.ts`
    - Implement getAccountUsersByOrganisation()
    - Implement createAccountUser()
    - Implement updateAccountUser()
    - Implement deleteAccountUser()
    - _Requirements: 2.13.6, 2.13.7_
  
  - [ ] 29a.3 Create user management routes
    - Create `packages/backend/src/routes/user-management.routes.ts`
    - Add authentication middleware
    - Define REST endpoints for admin users and account users
    - Separate routes: /api/orgadmin/users/admins/* and /api/orgadmin/users/accounts/*
    - _Requirements: 5.6_
  
  - [ ] 29a.4 Write unit tests for user management services
    - Test admin user CRUD operations
    - Test account user CRUD operations
    - Test role assignment for admin users
    - _Requirements: 3.5.1_

- [ ] 30. Checkpoint - Backend services complete
  - Verify all API endpoints are functional
  - Verify authentication and authorization
  - Ensure all tests pass
  - Ask user if questions arise

### Phase 5: Shared Components Enhancement

- [ ] 31. Enhance components package with org-specific components
  - [ ] 31.1 Create OrgDataTable component
    - Create `packages/components/src/components/OrgDataTable/OrgDataTable.tsx`
    - Support sorting, filtering, pagination
    - Add search functionality
    - Include export to CSV
    - Make responsive for mobile
    - _Requirements: 3.4.1_
  
  - [ ] 31.2 Verify MetadataForm and MetadataWizard work for application forms
    - Test existing MetadataForm component with application form data
    - Test existing MetadataWizard component with multi-step application forms
    - Test existing FieldRenderer with document_upload field type
    - Ensure field grouping works for application forms
    - Ensure wizard configuration works for application forms
    - No new components needed - reuse existing patterns
    - _Requirements: 2.9.2, 2.9.5, 2.9.6_
  
  - [ ] 31.3 Create OrgPaymentWidget components
    - Create `packages/components/src/components/OrgPaymentWidget/PaymentList.tsx`
    - Create `packages/components/src/components/OrgPaymentWidget/PaymentDetails.tsx`
    - Create `packages/components/src/components/OrgPaymentWidget/RefundDialog.tsx`
    - Support multiple payment methods
    - _Requirements: 2.11.2, 2.11.4_
  
  - [ ] 31.4 Create OrgDatePicker components
    - Create `packages/components/src/components/OrgDatePicker/DateRangePicker.tsx`
    - Create `packages/components/src/components/OrgDatePicker/TimeSlotPicker.tsx`
    - Support timezone handling
    - _Requirements: 2.6.3_
  
  - [ ] 31.5 Create OrgFileUpload components
    - Create `packages/components/src/components/OrgFileUpload/FileUpload.tsx`
    - Create `packages/components/src/components/OrgFileUpload/ImageUpload.tsx`
    - Support drag-and-drop
    - Add image preview and cropping
    - Implement file size validation
    - _Requirements: 2.5.4, 2.10.5_
  
  - [ ] 31.6 Write unit tests for shared components
    - Test OrgDataTable sorting and filtering
    - Test MetadataForm with application form data
    - Test MetadataWizard with multi-step forms
    - Test FieldRenderer with document_upload field
    - Test file upload validation
    - _Requirements: 3.5.1_

### Phase 6: Integration & Testing

- [ ] 32. Implement end-to-end integration
  - [ ] 32.1 Wire shell to all modules
    - Update shell App.tsx to import all module registrations
    - Verify lazy loading works for all modules
    - Test navigation between all modules
    - _Requirements: 3.1.2, 3.1.3_
  
  - [ ] 32.2 Connect frontend to backend APIs
    - Implement API client in each module
    - Add error handling and retry logic
    - Implement loading states
    - Add success/error notifications
    - _Requirements: 3.6.1_
  
  - [ ] 32.3 Implement authentication flow end-to-end
    - Configure Keycloak client in shell
    - Test login/logout flows
    - Verify token refresh
    - Test role-based access control
    - _Requirements: 2.1.1, 2.1.2, 2.1.6, 3.2.1_
  
  - [ ] 32.4 Configure capability-based access control
    - Implement capability check middleware in backend
    - Test module visibility based on capabilities
    - Verify API endpoint protection
    - _Requirements: 2.2.4, 3.2.2_

- [ ] 33. Implement comprehensive testing
  - [ ] 33.1 Write integration tests for core workflows
    - Test event creation and management workflow
    - Test membership signup and renewal workflow
    - Test payment and refund workflow
    - Test form builder and submission workflow
    - _Requirements: 3.5.2_
  
  - [ ] 33.2 Write end-to-end tests for critical paths
    - Test admin login and dashboard access
    - Test creating event with activities
    - Test creating membership type and viewing members
    - Test payment viewing and refund request
    - _Requirements: 3.5.3_
  
  - [ ] 33.3 Perform accessibility testing
    - Test keyboard navigation
    - Test screen reader compatibility
    - Verify WCAG 2.1 AA compliance
    - _Requirements: 3.4.3_

- [ ] 34. Performance optimization
  - [ ] 34.1 Optimize bundle sizes
    - Analyze bundle sizes with webpack-bundle-analyzer
    - Implement code splitting for large modules
    - Remove unused dependencies
    - Verify shell bundle < 200KB and module bundles < 150KB
    - _Requirements: 3.6.2_
  
  - [ ] 34.2 Optimize API performance
    - Add database indexes for frequently queried fields
    - Implement pagination for large datasets
    - Add caching for organisation and capability data
    - Verify API responses < 500ms
    - _Requirements: 3.6.1_
  
  - [ ] 34.3 Optimize initial load time
    - Implement lazy loading for all modules
    - Preload critical resources
    - Optimize images and assets
    - Verify initial page load < 3 seconds
    - _Requirements: 3.6.1_

- [ ] 35. Security hardening
  - [ ] 35.1 Implement input validation
    - Add validation to all form inputs
    - Sanitize user input on backend
    - Implement rate limiting on API endpoints
    - _Requirements: 4.1_
  
  - [ ] 35.2 Implement XSS and CSRF protection
    - Add Content Security Policy headers
    - Implement CSRF tokens
    - Sanitize HTML output
    - _Requirements: 4.1_
  
  - [ ] 35.3 Audit authentication and authorization
    - Review all protected routes
    - Verify capability checks on all endpoints
    - Test with different user roles
    - _Requirements: 3.2.1, 3.2.2_

- [ ] 36. Documentation and deployment
  - [ ] 36.1 Write deployment documentation
    - Document build process
    - Document environment variables
    - Document Keycloak configuration
    - Document database migrations
    - _Requirements: 4.3_
  
  - [ ] 36.2 Create Docker configuration
    - Create Dockerfile for shell and modules
    - Create docker-compose.yml for local development
    - Document container orchestration
    - _Requirements: 4.3_
  
  - [ ] 36.3 Set up CI/CD pipeline
    - Configure build pipeline
    - Add automated testing
    - Configure deployment to staging and production
    - _Requirements: 4.3_
  
  - [ ] 36.4 Write user documentation
    - Create admin user guide
    - Document each module's functionality
    - Create troubleshooting guide
    - _Requirements: 4.3_

- [ ] 37. Final checkpoint - System complete
  - Verify all modules are functional
  - Verify all tests pass
  - Verify performance requirements met
  - Verify security requirements met
  - Conduct user acceptance testing
  - Ask user if questions arise

### Phase 6: AWS Infrastructure Setup

- [ ] 38. Set up AWS S3 for file storage
  - [ ] 38.1 Create Terraform module for S3 bucket
    - Create `terraform/modules/s3-file-storage/main.tf`
    - Define S3 bucket with versioning enabled
    - Configure server-side encryption (AES256)
    - Set up public access block
    - Add lifecycle policy for old versions
    - Configure CORS for file uploads
    - _Requirements: 2.9.7, 4.1_
  
  - [ ] 38.2 Create IAM roles and policies for S3 access
    - Create `terraform/modules/iam-s3-access/main.tf`
    - Define IAM role for backend EC2/ECS instances
    - Create policy for S3 operations (PutObject, GetObject, DeleteObject, ListBucket)
    - Attach policy to backend role
    - _Requirements: 2.9.7, 4.1_
  
  - [ ] 38.3 Configure S3 bucket in backend
    - Update backend environment variables with bucket name
    - Test file upload to S3
    - Test file download with signed URLs
    - Test file deletion
    - _Requirements: 2.9.7_
  
  - [ ] 38.4 Write integration tests for S3 operations
    - Test upload with organization segregation
    - Test download with signed URLs
    - Test deletion
    - Test CORS configuration
    - _Requirements: 3.5.2_

- [ ] 39. Set up AWS CloudFront for UI delivery
  - [ ] 39.1 Create Terraform module for CloudFront distribution
    - Create `terraform/modules/cloudfront-ui/main.tf`
    - Define CloudFront distribution
    - Configure S3 origin for UI assets
    - Set up origin access identity
    - Configure default cache behavior with compression
    - Add custom error response for SPA routing (404 -> 200 /index.html)
    - Configure SSL certificate (ACM)
    - _Requirements: 3.6.3_
  
  - [ ] 39.2 Create S3 bucket for UI hosting
    - Create `terraform/modules/s3-ui-hosting/main.tf`
    - Define S3 bucket for static website hosting
    - Configure bucket policy for CloudFront access
    - Set up versioning for rollback capability
    - _Requirements: 3.6.3_
  
  - [ ] 39.3 Configure deployment pipeline for CloudFront
    - Update CI/CD pipeline to deploy to S3
    - Add CloudFront cache invalidation step
    - Test deployment process
    - Verify UI loads from CloudFront
    - _Requirements: 3.6.3_
  
  - [ ] 39.4 Configure custom domain and SSL
    - Request ACM certificate for custom domain
    - Configure Route53 DNS records
    - Update CloudFront distribution with custom domain
    - Test HTTPS access
    - _Requirements: 3.6.3, 4.1_
  
  - [ ] 39.5 Write deployment verification tests
    - Test UI loads from CloudFront
    - Test cache behavior
    - Test SPA routing with custom error response
    - Test HTTPS and SSL certificate
    - _Requirements: 3.5.2_

- [ ] 40. Configure monitoring and logging for AWS resources
  - [ ] 40.1 Set up CloudWatch for S3 and CloudFront
    - Enable S3 access logging
    - Enable CloudFront access logs
    - Create CloudWatch dashboards for metrics
    - Set up alarms for errors and high latency
    - _Requirements: 4.3_
  
  - [ ] 40.2 Configure cost monitoring
    - Set up AWS Cost Explorer
    - Create budget alerts
    - Monitor S3 storage costs
    - Monitor CloudFront data transfer costs
    - _Requirements: 4.3_
  
  - [ ] 40.3 Document AWS infrastructure
    - Document Terraform modules
    - Document deployment process
    - Document monitoring and alerting
    - Create runbook for common operations
    - _Requirements: 4.3_

- [ ] 41. Final checkpoint - AWS infrastructure complete
  - Verify S3 file uploads work end-to-end
  - Verify CloudFront delivers UI correctly
  - Verify monitoring and logging
  - Verify cost controls
  - Ask user if questions arise

## Notes

- Tasks marked with `*` are optional testing tasks that can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation throughout implementation
- The modular architecture allows parallel development of different modules
- Core modules should be completed before capability modules
- Backend services can be developed in parallel with frontend modules
- AWS infrastructure (Phase 6) can be set up early or in parallel with development

## Implementation Order Rationale

1. **Shell First**: Establishes the foundation for all modules with ItsPlainSailing branding
2. **Core Modules**: Provides always-available functionality including enhanced Forms with file upload
3. **Capability Modules**: Adds feature-specific functionality incrementally, starting with enhanced Events
4. **Backend Services**: Can be developed alongside frontend modules, includes S3 file upload service
5. **Integration**: Brings everything together
6. **Testing & Optimization**: Ensures quality and performance
7. **AWS Infrastructure**: Sets up CloudFront CDN and S3 storage for production deployment

## Estimated Timeline

- Phase 1 (Shell): 1-2 weeks
- Phase 2 (Core Modules): 3-4 weeks (includes file upload support)
- Phase 3 (Capability Modules): 4-5 weeks (enhanced Events module is more complex)
- Phase 4 (Backend Services): 3-4 weeks (parallel with Phase 3, includes S3 integration)
- Phase 5 (Shared Components): 1 week
- Phase 6 (Integration & Testing): 2 weeks
- Phase 7 (AWS Infrastructure): 1-2 weeks

Total: 15-20 weeks for complete implementation including AWS infrastructure

## Key Changes from Original Spec

1. **Application Branding**: ItsPlainSailing branding throughout
2. **Module Registration**: Added title and description fields used on dashboard cards
3. **Form Builder Architecture**: 
   - Reuses existing MetadataForm, MetadataWizard, and FieldRenderer components
   - Separate database tables (application_forms, application_fields, application_form_fields)
   - Unified submission data model across all contexts (form_submissions table)
   - Document upload field type with S3 storage and organization segregation
4. **Separate Services**:
   - ApplicationFormService (separate from MetadataService)
   - FormSubmissionService (unified across all contexts)
   - FileUploadService (handles S3 operations)
5. **Enhanced Event Management**: Comprehensive event attributes, activity configuration, and entries management
6. **Split User Management**: Separate Org Admin Users and Account Users
7. **AWS CloudFront**: CDN deployment for global UI delivery
8. **AWS S3**: Secure file storage with organization-level segregation
9. **Terraform Infrastructure**: Infrastructure as code for AWS resources
