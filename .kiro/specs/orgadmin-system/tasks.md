# Implementation Plan: Organisation Admin System

## Overview

This implementation plan breaks down the Organisation Admin System into discrete, incremental phases. The system follows a modular architecture where each functional area is a separate workspace package, with capability-driven UI that dynamically loads modules based on organisation capabilities.

The implementation follows this structure:
1. **Phase 1: Shell Foundation** - Authentication, routing, and module registration system
2. **Phase 2: Core Modules** - Always-available modules (Dashboard, Forms, Settings, Payments, Reporting, Users)
3. **Phase 3: Capability Modules** - Feature modules that load based on capabilities (Events, Members, Merchandise, Calendar, Registrations, Tickets)
4. **Phase 4: Backend Services** - API services for all modules
5. **Phase 5: Integration & Testing** - End-to-end integration and comprehensive testing

## Tasks

### Phase 1: Shell Foundation

- [ ] 1. Create orgadmin-shell package structure
  - [ ] 1.1 Initialize orgadmin-shell workspace package
    - Create `packages/orgadmin-shell` directory
    - Initialize package.json with dependencies (React, React Router, MUI, Keycloak)
    - Configure TypeScript and Vite build setup
    - Add workspace reference in root package.json
    - _Requirements: 3.1.1, 3.1.2_
  
  - [ ] 1.2 Create module registration type definitions
    - Create `src/types/module.types.ts` with ModuleRegistration interface
    - Define ModuleRoute, MenuItem, and ModuleCard interfaces
    - Export types for use by feature modules
    - _Requirements: 3.1.2_
  
  - [ ] 1.3 Implement CapabilityContext
    - Create `src/context/CapabilityContext.tsx`
    - Implement capability loading from backend API
    - Provide hasCapability() helper function
    - Handle loading and error states
    - _Requirements: 2.1.4, 3.2.2_
  
  - [ ] 1.4 Implement OrganisationContext
    - Create `src/context/OrganisationContext.tsx`
    - Provide organisation data to all components
    - Include organisation details (name, currency, language, status)
    - _Requirements: 2.1.3_
  
  - [ ] 1.5 Implement Keycloak authentication integration
    - Create `src/hooks/useAuth.ts` hook
    - Initialize Keycloak client with configuration
    - Implement login/logout flows
    - Fetch user's organisation on successful authentication
    - Verify user has org-admin role
    - _Requirements: 2.1.1, 2.1.2, 2.1.6, 3.2.1_
  
  - [ ]* 1.6 Write unit tests for authentication and context
    - Test CapabilityContext capability filtering
    - Test OrganisationContext data provision
    - Test useAuth hook authentication flows
    - _Requirements: 3.5.1_

- [ ] 2. Create shell layout and navigation
  - [ ] 2.1 Implement Layout component
    - Create `src/components/Layout.tsx` with responsive drawer
    - Implement AppBar with organisation name
    - Create navigation drawer with dynamic menu items
    - Add mobile-responsive drawer toggle
    - Include logout button in drawer
    - _Requirements: 2.2.1, 3.4.1_
  
  - [ ] 2.2 Implement DashboardCard component
    - Create `src/components/DashboardCard.tsx`
    - Display card with icon, title, and description
    - Add hover effects and click navigation
    - Apply neumorphic theme styling
    - _Requirements: 2.2.2, 2.2.3, 3.4.2_
  
  - [ ] 2.3 Implement DashboardPage (landing page)
    - Create `src/pages/DashboardPage.tsx`
    - Display grid of DashboardCards for available modules
    - Filter cards based on enabled capabilities
    - Show welcome message with organisation name
    - Sort cards by module order
    - _Requirements: 2.2.1, 2.2.4, 2.2.5, 2.2.6_
  
  - [ ] 2.4 Implement module loader and routing
    - Create `src/components/ModuleLoader.tsx` for lazy loading
    - Implement dynamic route generation from module registrations
    - Add Suspense boundaries with loading indicators
    - Handle 404 for unknown routes
    - _Requirements: 3.1.3_
  
  - [ ]* 2.5 Write unit tests for layout components
    - Test Layout renders navigation correctly
    - Test DashboardCard navigation on click
    - Test DashboardPage filters modules by capability
    - _Requirements: 3.5.1_

- [ ] 3. Implement main App component and routing
  - [ ] 3.1 Create App.tsx with module registration
    - Import all core and capability module registrations
    - Filter modules based on user's capabilities
    - Set up BrowserRouter with /orgadmin basename
    - Wrap app with OrganisationProvider and CapabilityProvider
    - Implement loading screen during authentication
    - _Requirements: 2.1.4, 2.1.5, 3.1.2, 3.1.3_
  
  - [ ] 3.2 Configure Vite build and development server
    - Create vite.config.ts with proper base path
    - Configure proxy for backend API calls
    - Set up code splitting for optimal bundle sizes
    - Configure environment variables
    - _Requirements: 3.6.2_
  
  - [ ]* 3.3 Write integration tests for shell routing
    - Test module filtering based on capabilities
    - Test route navigation between modules
    - Test authentication redirect flows
    - _Requirements: 3.5.2_

- [ ] 4. Checkpoint - Shell foundation complete
  - Verify authentication flow works end-to-end
  - Verify capability-based module filtering
  - Verify navigation and routing
  - Ensure all tests pass
  - Ask user if questions arise

### Phase 2: Core Modules (Always Available)

- [ ] 5. Create orgadmin-core package structure
  - [ ] 5.1 Initialize orgadmin-core workspace package
    - Create `packages/orgadmin-core` directory
    - Initialize package.json with dependencies
    - Configure TypeScript build
    - Create subdirectories for each core module
    - _Requirements: 3.1.1_
  
  - [ ] 5.2 Set up shared utilities and hooks
    - Create `src/hooks/useApi.ts` for API calls
    - Create `src/utils/validation.ts` for form validation
    - Create `src/utils/formatting.ts` for data formatting
    - _Requirements: 3.1.1_

- [ ] 6. Implement Dashboard module
  - [ ] 6.1 Create dashboard module registration
    - Create `src/dashboard/index.ts` with module registration
    - Define routes and menu items
    - Set order to 1 (first in menu)
    - _Requirements: 2.2.1, 3.1.2_
  
  - [ ] 6.2 Implement DashboardPage with metrics
    - Create `src/dashboard/pages/DashboardPage.tsx`
    - Display metric cards (events, members, revenue, payments)
    - Fetch dashboard data from backend API
    - Show loading and error states
    - _Requirements: 2.12.2_
  
  - [ ]* 6.3 Write unit tests for dashboard
    - Test dashboard data fetching
    - Test metric card rendering
    - _Requirements: 3.5.1_

- [ ] 7. Implement Forms module (Form Builder)
  - [ ] 7.1 Create forms module registration
    - Create `src/forms/index.ts` with module registration
    - Define routes for list, create, edit, preview
    - _Requirements: 2.9.6, 3.1.2_
  
  - [ ] 7.2 Implement FormsListPage
    - Create `src/forms/pages/FormsListPage.tsx`
    - Display table of forms with name, status, created date
    - Add search and filter functionality
    - Include "Create Form" button
    - _Requirements: 2.9.2_
  
  - [ ] 7.3 Implement FormBuilderPage
    - Create `src/forms/pages/FormBuilderPage.tsx`
    - Use OrgFormBuilder component from shared components
    - Allow adding/removing/reordering fields
    - Support field types: text, email, number, select, checkbox, date
    - Implement field validation rules
    - Save form as draft or publish
    - _Requirements: 2.9.2, 2.9.3, 2.9.4_
  
  - [ ] 7.4 Implement FormPreviewPage
    - Create `src/forms/pages/FormPreviewPage.tsx`
    - Render form with all fields
    - Show how form will appear to end users
    - _Requirements: 2.9.2_
  
  - [ ]* 7.5 Write unit tests for forms module
    - Test form list rendering and filtering
    - Test form builder field operations
    - Test form validation rules
    - _Requirements: 3.5.1_

- [ ] 8. Implement Settings module
  - [ ] 8.1 Create settings module registration
    - Create `src/settings/index.ts` with module registration
    - Define routes for different settings sections
    - _Requirements: 2.10.6, 3.1.2_
  
  - [ ] 8.2 Implement SettingsPage with tabs
    - Create `src/settings/pages/SettingsPage.tsx`
    - Add tabs for: Organisation Details, Payment Settings, Email Templates, Branding
    - _Requirements: 2.10.2, 2.10.3, 2.10.4, 2.10.5_
  
  - [ ] 8.3 Implement OrganisationDetailsTab
    - Create form for organisation name, address, contact info
    - Implement save functionality
    - _Requirements: 2.10.2_
  
  - [ ] 8.4 Implement PaymentSettingsTab
    - Create form for Stripe configuration
    - Add currency and payment method settings
    - _Requirements: 2.10.3_
  
  - [ ] 8.5 Implement BrandingTab
    - Add logo upload component
    - Add colour picker for theme colours
    - Show preview of branding
    - _Requirements: 2.10.5_
  
  - [ ]* 8.6 Write unit tests for settings module
    - Test settings form validation
    - Test settings save operations
    - _Requirements: 3.5.1_

- [ ] 9. Implement Payments module
  - [ ] 9.1 Create payments module registration
    - Create `src/payments/index.ts` with module registration
    - Define routes for payments list and details
    - _Requirements: 2.11.6, 3.1.2_
  
  - [ ] 9.2 Implement PaymentsListPage
    - Create `src/payments/pages/PaymentsListPage.tsx`
    - Display table of payments with date, amount, status, type
    - Add filters for date range, status, payment method
    - Include export to CSV button
    - _Requirements: 2.11.2, 2.11.5_
  
  - [ ] 9.3 Implement PaymentDetailsPage
    - Create `src/payments/pages/PaymentDetailsPage.tsx`
    - Show full payment details
    - Display related transaction (event, membership, etc.)
    - Add refund button with confirmation dialog
    - _Requirements: 2.11.2, 2.11.4_
  
  - [ ] 9.4 Implement LodgementsPage
    - Create `src/payments/pages/LodgementsPage.tsx`
    - Display lodgement history
    - Show breakdown by payment method
    - _Requirements: 2.11.3_
  
  - [ ]* 9.5 Write unit tests for payments module
    - Test payment list filtering
    - Test payment details rendering
    - Test refund flow
    - _Requirements: 3.5.1_

- [ ] 10. Implement Reporting module
  - [ ] 10.1 Create reporting module registration
    - Create `src/reporting/index.ts` with module registration
    - Define routes for different report types
    - _Requirements: 2.12.6, 3.1.2_
  
  - [ ] 10.2 Implement ReportingDashboardPage
    - Create `src/reporting/pages/ReportingDashboardPage.tsx`
    - Display high-level metrics with charts
    - Show events, members, revenue trends
    - Add date range selector
    - _Requirements: 2.12.2, 2.12.5_
  
  - [ ] 10.3 Implement EventsReportPage
    - Create `src/reporting/pages/EventsReportPage.tsx`
    - Show event attendance and revenue
    - Add filters and export functionality
    - _Requirements: 2.12.3, 2.12.4_
  
  - [ ] 10.4 Implement MembersReportPage
    - Create `src/reporting/pages/MembersReportPage.tsx`
    - Show membership growth and retention
    - Add filters and export functionality
    - _Requirements: 2.12.3, 2.12.4_
  
  - [ ] 10.5 Implement RevenueReportPage
    - Create `src/reporting/pages/RevenueReportPage.tsx`
    - Show revenue breakdown by source
    - Add charts and export functionality
    - _Requirements: 2.12.3, 2.12.4_
  
  - [ ]* 10.6 Write unit tests for reporting module
    - Test report data fetching
    - Test date range filtering
    - Test export functionality
    - _Requirements: 3.5.1_

- [ ] 11. Implement Users module
  - [ ] 11.1 Create users module registration
    - Create `src/users/index.ts` with module registration
    - Define routes for users list and management
    - _Requirements: 2.13.6, 3.1.2_
  
  - [ ] 11.2 Implement UsersListPage
    - Create `src/users/pages/UsersListPage.tsx`
    - Display table of admin users with name, email, roles
    - Add "Invite User" button
    - Use existing backend user management services
    - _Requirements: 2.13.2, 2.13.5_
  
  - [ ] 11.3 Implement UserDetailsPage
    - Create `src/users/pages/UserDetailsPage.tsx`
    - Show user details and assigned roles
    - Allow editing roles
    - Add deactivate/delete user functionality
    - _Requirements: 2.13.3, 2.13.4_
  
  - [ ] 11.4 Implement InviteUserDialog
    - Create `src/users/components/InviteUserDialog.tsx`
    - Form for email and initial role assignment
    - Send invitation email
    - _Requirements: 2.13.3_
  
  - [ ]* 11.5 Write unit tests for users module
    - Test user list rendering
    - Test role assignment
    - Test user invitation flow
    - _Requirements: 3.5.1_

- [ ] 12. Checkpoint - Core modules complete
  - Verify all core modules are accessible
  - Verify navigation between core modules
  - Ensure all tests pass
  - Ask user if questions arise

### Phase 3: Capability Modules

- [ ] 13. Create Events module (event-management capability)
  - [ ] 13.1 Initialize orgadmin-events workspace package
    - Create `packages/orgadmin-events` directory
    - Initialize package.json with dependencies
    - Configure TypeScript build
    - _Requirements: 3.1.1_
  
  - [ ] 13.2 Create events module registration
    - Create `src/index.ts` with module registration
    - Set capability requirement to 'event-management'
    - Define routes for list, create, edit, details
    - _Requirements: 2.3.6, 3.1.2_
  
  - [ ] 13.3 Implement EventsListPage
    - Create `src/pages/EventsListPage.tsx`
    - Display table of events with name, dates, status, capacity
    - Add search and filter functionality
    - Include "Create Event" button
    - _Requirements: 2.3.1, 2.3.2_
  
  - [ ] 13.4 Implement CreateEventPage
    - Create `src/pages/CreateEventPage.tsx`
    - Form for event name, description, dates, location, capacity
    - Add activities section
    - Link to form builder for registration forms
    - Save as draft or publish
    - _Requirements: 2.3.2, 2.3.3, 2.3.4_
  
  - [ ] 13.5 Implement EventDetailsPage
    - Create `src/pages/EventDetailsPage.tsx`
    - Show event details and activities
    - Display registrations list
    - Add edit and delete buttons
    - _Requirements: 2.3.5_
  
  - [ ]* 13.6 Write unit tests for events module
    - Test event list rendering and filtering
    - Test event creation form validation
    - Test event details display
    - _Requirements: 3.5.1_

- [ ] 14. Create Memberships module (memberships capability)
  - [ ] 14.1 Initialize orgadmin-memberships workspace package
    - Create `packages/orgadmin-memberships` directory
    - Initialize package.json with dependencies
    - Configure TypeScript build
    - _Requirements: 3.1.1_
  
  - [ ] 14.2 Create memberships module registration
    - Create `src/index.ts` with module registration
    - Set capability requirement to 'memberships'
    - Define routes for types, members, renewals
    - _Requirements: 2.4.6, 3.1.2_
  
  - [ ] 14.3 Implement MembershipTypesPage
    - Create `src/pages/MembershipTypesPage.tsx`
    - Display table of membership types with name, price, duration
    - Add "Create Type" button
    - _Requirements: 2.4.1, 2.4.2_
  
  - [ ] 14.4 Implement CreateMembershipTypePage
    - Create `src/pages/CreateMembershipTypePage.tsx`
    - Form for name, description, price, duration, renewal type
    - Link to form builder for application forms
    - _Requirements: 2.4.2, 2.4.3_
  
  - [ ] 14.5 Implement MembersListPage
    - Create `src/pages/MembersListPage.tsx`
    - Display table of members with name, type, status, expiry
    - Add filters for status and membership type
    - Show renewal reminders
    - _Requirements: 2.4.4, 2.4.5_
  
  - [ ]* 14.6 Write unit tests for memberships module
    - Test membership type creation
    - Test member list filtering
    - Test renewal logic
    - _Requirements: 3.5.1_

- [ ] 15. Create Merchandise module (merchandise capability)
  - [ ] 15.1 Initialize orgadmin-merchandise workspace package
    - Create `packages/orgadmin-merchandise` directory
    - Initialize package.json with dependencies
    - Configure TypeScript build
    - _Requirements: 3.1.1_
  
  - [ ] 15.2 Create merchandise module registration
    - Create `src/index.ts` with module registration
    - Set capability requirement to 'merchandise'
    - Define routes for items, orders
    - _Requirements: 2.5.6, 3.1.2_
  
  - [ ] 15.3 Implement MerchandiseListPage
    - Create `src/pages/MerchandiseListPage.tsx`
    - Display table of items with name, price, inventory, status
    - Add "Create Item" button
    - _Requirements: 2.5.1, 2.5.2_
  
  - [ ] 15.4 Implement CreateMerchandisePage
    - Create `src/pages/CreateMerchandisePage.tsx`
    - Form for name, description, price, inventory
    - Add image upload component
    - Support variants (size, colour, etc.)
    - _Requirements: 2.5.2, 2.5.3, 2.5.4_
  
  - [ ] 15.5 Implement MerchandiseOrdersPage
    - Create `src/pages/MerchandiseOrdersPage.tsx`
    - Display table of orders with date, customer, items, status
    - Add filters and search
    - _Requirements: 2.5.5_
  
  - [ ]* 15.6 Write unit tests for merchandise module
    - Test item creation with variants
    - Test inventory management
    - Test order list filtering
    - _Requirements: 3.5.1_

- [ ] 16. Create Calendar module (calendar-bookings capability)
  - [ ] 16.1 Initialize orgadmin-calendar workspace package
    - Create `packages/orgadmin-calendar` directory
    - Initialize package.json with dependencies
    - Configure TypeScript build
    - _Requirements: 3.1.1_
  
  - [ ] 16.2 Create calendar module registration
    - Create `src/index.ts` with module registration
    - Set capability requirement to 'calendar-bookings'
    - Define routes for calendars, bookings
    - _Requirements: 2.6.6, 3.1.2_
  
  - [ ] 16.3 Implement CalendarsListPage
    - Create `src/pages/CalendarsListPage.tsx`
    - Display table of calendars with name, booking duration, status
    - Add "Create Calendar" button
    - _Requirements: 2.6.1, 2.6.2_
  
  - [ ] 16.4 Implement CreateCalendarPage
    - Create `src/pages/CreateCalendarPage.tsx`
    - Form for name, description, booking duration
    - Define available time slots
    - Set booking rules and pricing
    - _Requirements: 2.6.2, 2.6.3, 2.6.4_
  
  - [ ] 16.5 Implement BookingsPage
    - Create `src/pages/BookingsPage.tsx`
    - Display calendar view of bookings
    - Add filters for calendar and date range
    - Show booking details and status
    - _Requirements: 2.6.5_
  
  - [ ]* 16.6 Write unit tests for calendar module
    - Test calendar creation
    - Test time slot configuration
    - Test booking display
    - _Requirements: 3.5.1_

- [ ] 17. Create Registrations module (registrations capability)
  - [ ] 17.1 Initialize orgadmin-registrations workspace package
    - Create `packages/orgadmin-registrations` directory
    - Initialize package.json with dependencies
    - Configure TypeScript build
    - _Requirements: 3.1.1_
  
  - [ ] 17.2 Create registrations module registration
    - Create `src/index.ts` with module registration
    - Set capability requirement to 'registrations'
    - Define routes for types, registrations
    - _Requirements: 2.7.6, 3.1.2_
  
  - [ ] 17.3 Implement RegistrationTypesPage
    - Create `src/pages/RegistrationTypesPage.tsx`
    - Display table of registration types with name, period, pricing
    - Add "Create Type" button
    - _Requirements: 2.7.1, 2.7.2_
  
  - [ ] 17.4 Implement CreateRegistrationTypePage
    - Create `src/pages/CreateRegistrationTypePage.tsx`
    - Form for name, description, registration period, pricing
    - Link to form builder for registration forms
    - _Requirements: 2.7.2, 2.7.3, 2.7.4_
  
  - [ ] 17.5 Implement RegistrationsListPage
    - Create `src/pages/RegistrationsListPage.tsx`
    - Display table of registrations with name, type, date, status
    - Add filters and search
    - _Requirements: 2.7.5_
  
  - [ ]* 17.6 Write unit tests for registrations module
    - Test registration type creation
    - Test registration list filtering
    - Test form linking
    - _Requirements: 3.5.1_

- [ ] 18. Create Ticketing module (event-ticketing capability)
  - [ ] 18.1 Initialize orgadmin-ticketing workspace package
    - Create `packages/orgadmin-ticketing` directory
    - Initialize package.json with dependencies
    - Configure TypeScript build
    - _Requirements: 3.1.1_
  
  - [ ] 18.2 Create ticketing module registration
    - Create `src/index.ts` with module registration
    - Set capability requirement to 'event-ticketing'
    - Define routes for events, tickets, sales
    - _Requirements: 2.8.6, 3.1.2_
  
  - [ ] 18.3 Implement TicketedEventsPage
    - Create `src/pages/TicketedEventsPage.tsx`
    - Display table of ticketed events with name, date, tickets sold
    - Add "Create Event" button
    - _Requirements: 2.8.1, 2.8.2_
  
  - [ ] 18.4 Implement CreateTicketedEventPage
    - Create `src/pages/CreateTicketedEventPage.tsx`
    - Form for event name, description, date, venue
    - Define ticket types with pricing and capacity
    - Set capacity limits
    - _Requirements: 2.8.2, 2.8.3, 2.8.4_
  
  - [ ] 18.5 Implement TicketSalesPage
    - Create `src/pages/TicketSalesPage.tsx`
    - Display ticket sales by event and ticket type
    - Show capacity and availability
    - Add filters and export
    - _Requirements: 2.8.5_
  
  - [ ]* 18.6 Write unit tests for ticketing module
    - Test event creation with ticket types
    - Test capacity management
    - Test sales reporting
    - _Requirements: 3.5.1_

- [ ] 19. Checkpoint - Capability modules complete
  - Verify all capability modules load correctly
  - Verify capability-based visibility
  - Ensure all tests pass
  - Ask user if questions arise

### Phase 4: Backend Services

- [ ] 20. Create database schema for new entities
  - [ ] 20.1 Create events and activities tables
    - Create migration for events table
    - Create migration for event_activities table
    - Add indexes for organisation_id and dates
    - _Requirements: 3.3.2_
  
  - [ ] 20.2 Create membership tables
    - Create migration for membership_types table
    - Create migration for members table
    - Add indexes for organisation_id and status
    - _Requirements: 3.3.2_
  
  - [ ] 20.3 Create merchandise tables
    - Create migration for merchandise_items table
    - Create migration for merchandise_variants table
    - Create migration for merchandise_orders table
    - Add indexes for organisation_id
    - _Requirements: 3.3.2_
  
  - [ ] 20.4 Create calendar and bookings tables
    - Create migration for calendars table
    - Create migration for bookings table
    - Add indexes for calendar_id and dates
    - _Requirements: 3.3.2_
  
  - [ ] 20.5 Create registration tables
    - Create migration for registration_types table
    - Create migration for registrations table
    - Add indexes for organisation_id
    - _Requirements: 3.3.2_
  
  - [ ] 20.6 Create ticketing tables
    - Create migration for ticketed_events table
    - Create migration for ticket_types table
    - Create migration for tickets table
    - Add indexes for event_id and status
    - _Requirements: 3.3.2_
  
  - [ ] 20.7 Create forms and payments tables
    - Create migration for forms table
    - Create migration for form_fields table
    - Create migration for payments table
    - Create migration for refunds table
    - Add indexes for organisation_id and form_id
    - _Requirements: 3.3.2_
  
  - [ ] 20.8 Create reports table
    - Create migration for reports table
    - Add indexes for organisation_id and report_type
    - _Requirements: 3.3.2_

- [ ] 21. Implement Event Management service
  - [ ] 21.1 Create EventService class
    - Create `packages/backend/src/services/event.service.ts`
    - Implement getEventsByOrganisation()
    - Implement createEvent()
    - Implement updateEvent()
    - Implement deleteEvent()
    - Implement getEventById()
    - _Requirements: 2.3.2, 2.3.3_
  
  - [ ] 21.2 Create EventActivityService class
    - Create `packages/backend/src/services/event-activity.service.ts`
    - Implement getActivitiesByEvent()
    - Implement createActivity()
    - Implement updateActivity()
    - Implement deleteActivity()
    - _Requirements: 2.3.3_
  
  - [ ] 21.3 Create event routes
    - Create `packages/backend/src/routes/event.routes.ts`
    - Add authentication middleware
    - Add capability check middleware for 'event-management'
    - Define REST endpoints for events and activities
    - _Requirements: 3.2.2, 5.2_
  
  - [ ]* 21.4 Write unit tests for event service
    - Test event CRUD operations
    - Test activity management
    - Test capability authorization
    - _Requirements: 3.5.1_

- [ ] 22. Implement Membership Management service
  - [ ] 22.1 Create MembershipService class
    - Create `packages/backend/src/services/membership.service.ts`
    - Implement getMembershipTypesByOrganisation()
    - Implement createMembershipType()
    - Implement updateMembershipType()
    - Implement deleteMembershipType()
    - Implement getMembersByOrganisation()
    - _Requirements: 2.4.2, 2.4.3, 2.4.4_
  
  - [ ] 22.2 Create membership routes
    - Create `packages/backend/src/routes/membership.routes.ts`
    - Add authentication and capability check middleware
    - Define REST endpoints for membership types and members
    - _Requirements: 3.2.2, 5.3_
  
  - [ ]* 22.3 Write unit tests for membership service
    - Test membership type CRUD operations
    - Test member management
    - Test renewal logic
    - _Requirements: 3.5.1_

- [ ] 23. Implement Merchandise Management service
  - [ ] 23.1 Create MerchandiseService class
    - Create `packages/backend/src/services/merchandise.service.ts`
    - Implement getItemsByOrganisation()
    - Implement createItem()
    - Implement updateItem()
    - Implement deleteItem()
    - Implement getOrdersByOrganisation()
    - _Requirements: 2.5.2, 2.5.3, 2.5.5_
  
  - [ ] 23.2 Create merchandise routes
    - Create `packages/backend/src/routes/merchandise.routes.ts`
    - Add authentication and capability check middleware
    - Define REST endpoints for items and orders
    - _Requirements: 3.2.2_
  
  - [ ]* 23.3 Write unit tests for merchandise service
    - Test item CRUD operations
    - Test variant management
    - Test order management
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
  
  - [ ]* 24.3 Write unit tests for calendar service
    - Test calendar CRUD operations
    - Test booking management
    - Test time slot validation
    - _Requirements: 3.5.1_

- [ ] 25. Implement Registration Management service
  - [ ] 25.1 Create RegistrationService class
    - Create `packages/backend/src/services/registration.service.ts`
    - Implement getRegistrationTypesByOrganisation()
    - Implement createRegistrationType()
    - Implement updateRegistrationType()
    - Implement deleteRegistrationType()
    - Implement getRegistrationsByOrganisation()
    - _Requirements: 2.7.2, 2.7.3, 2.7.5_
  
  - [ ] 25.2 Create registration routes
    - Create `packages/backend/src/routes/registration.routes.ts`
    - Add authentication and capability check middleware
    - Define REST endpoints for registration types and registrations
    - _Requirements: 3.2.2_
  
  - [ ]* 25.3 Write unit tests for registration service
    - Test registration type CRUD operations
    - Test registration management
    - _Requirements: 3.5.1_

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
  
  - [ ]* 26.3 Write unit tests for ticketing service
    - Test ticketed event CRUD operations
    - Test ticket type management
    - Test capacity validation
    - _Requirements: 3.5.1_

- [ ] 27. Implement Form Builder service
  - [ ] 27.1 Create FormBuilderService class
    - Create `packages/backend/src/services/form-builder.service.ts`
    - Implement getFormsByOrganisation()
    - Implement createForm()
    - Implement updateForm()
    - Implement deleteForm()
    - Implement getFormById()
    - _Requirements: 2.9.2_
  
  - [ ] 27.2 Create form builder routes
    - Create `packages/backend/src/routes/form-builder.routes.ts`
    - Add authentication middleware
    - Define REST endpoints for forms and fields
    - _Requirements: 5.4_
  
  - [ ]* 27.3 Write unit tests for form builder service
    - Test form CRUD operations
    - Test field management
    - Test form validation
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
  
  - [ ]* 28.3 Write unit tests for payment service
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
    - _Requirements: 5.6_
  
  - [ ]* 29.3 Write unit tests for reporting service
    - Test metric calculations
    - Test report generation
    - Test export functionality
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
  
  - [ ] 31.2 Create OrgFormBuilder component
    - Create `packages/components/src/components/OrgFormBuilder/FormBuilder.tsx`
    - Support drag-and-drop field ordering
    - Include field type selector
    - Add validation rule editor
    - Implement form preview
    - _Requirements: 2.9.3, 2.9.4_
  
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
  
  - [ ]* 31.6 Write unit tests for shared components
    - Test OrgDataTable sorting and filtering
    - Test OrgFormBuilder field operations
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
  - [ ]* 33.1 Write integration tests for core workflows
    - Test event creation and management workflow
    - Test membership signup and renewal workflow
    - Test payment and refund workflow
    - Test form builder and submission workflow
    - _Requirements: 3.5.2_
  
  - [ ]* 33.2 Write end-to-end tests for critical paths
    - Test admin login and dashboard access
    - Test creating event with activities
    - Test creating membership type and viewing members
    - Test payment viewing and refund request
    - _Requirements: 3.5.3_
  
  - [ ]* 33.3 Perform accessibility testing
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

## Notes

- Tasks marked with `*` are optional testing tasks that can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation throughout implementation
- The modular architecture allows parallel development of different modules
- Core modules should be completed before capability modules
- Backend services can be developed in parallel with frontend modules

## Implementation Order Rationale

1. **Shell First**: Establishes the foundation for all modules
2. **Core Modules**: Provides always-available functionality
3. **Capability Modules**: Adds feature-specific functionality incrementally
4. **Backend Services**: Can be developed alongside frontend modules
5. **Integration**: Brings everything together
6. **Testing & Optimization**: Ensures quality and performance

## Estimated Timeline

- Phase 1 (Shell): 1-2 weeks
- Phase 2 (Core Modules): 2-3 weeks
- Phase 3 (Capability Modules): 3-4 weeks
- Phase 4 (Backend Services): 2-3 weeks (parallel with Phase 3)
- Phase 5 (Shared Components): 1 week
- Phase 6 (Integration & Testing): 2 weeks

Total: 11-15 weeks for complete implementation
