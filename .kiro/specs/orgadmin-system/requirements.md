# Organisation Admin System - Requirements

## 1. Overview

### 1.1 Purpose
Create a capability-driven organisation administration system that allows organisation administrators to manage various aspects of their organisation based on enabled capabilities.

### 1.2 Application Branding
- **Application Name**: ItsPlainSailing
- **Small Logo**: https://itsplainsailing.com/admin//logos/ips-logo-sails-transparent-64.png
- **Large Logo**: https://itsplainsailing.com/admin/logos/ips-logo-sails-darker-text-transparent-128.png
- All UI components and documentation should reference ItsPlainSailing branding

### 1.3 Scope
- Organisation Administrator UI (orgadmin) - capability-based modular interface
- Account User UI (accountuser) - for regular organisation members (future phase)
- Backend services supporting both interfaces
- Integration with existing organisation, role, and capability management
- AWS CloudFront CDN deployment for orgadmin UI
- AWS S3 storage for file uploads

### 1.4 Key Principles
- **Capability-Driven**: UI modules only appear if organisation has the capability enabled
- **Modular Architecture**: Each functional area is a separate workspace package
- **Card-Based Navigation**: Landing page shows available areas as interactive cards
- **URL-Based Routing**: Each area has unique URL prefix for clear separation
- **Reusable Components**: Leverage existing form, wizard, and table components
- **Role-Based Access**: Uses existing organisation roles and permissions

## 2. User Stories

### 2.1 Organisation Administrator Authentication

**As an** organisation administrator  
**I want to** log in to the organisation admin portal  
**So that** I can manage my organisation's settings and features

**Acceptance Criteria:**
- 2.1.1 User authenticates via Keycloak
- 2.1.2 System identifies user as organisation administrator
- 2.1.3 System loads user's organisation details
- 2.1.4 System fetches organisation's enabled capabilities
- 2.1.5 System fetches user's assigned roles and permissions
- 2.1.6 Non-admin users are denied access to orgadmin interface

### 2.2 Dashboard/Landing Page

**As an** organisation administrator  
**I want to** see a dashboard with cards for each available area  
**So that** I can quickly navigate to the functionality I need

**Acceptance Criteria:**
- 2.2.1 Landing page displays cards for all available areas
- 2.2.2 Cards show title, description, and icon
- 2.2.3 Only areas with enabled capabilities are shown
- 2.2.4 Core areas (Forms, Settings, Payments, Reporting, Users) always visible
- 2.2.5 Cards are clickable and navigate to respective areas
- 2.2.6 Visual indication of which areas are available vs unavailable

### 2.3 Event Management (Capability: event-management)

**As an** organisation administrator  
**I want to** manage events and activities  
**So that** people can register and pay for events

**Acceptance Criteria:**
- 2.3.1 Only visible if organisation has 'event-management' capability
- 2.3.2 Can create, edit, and delete events with comprehensive attributes
- 2.3.3 Can add activities to events with detailed configuration
- 2.3.4 Can set pricing and payment options per activity
- 2.3.5 Can view and manage event entries in tabular format
- 2.3.6 Can download all entries as formatted Excel file
- 2.3.7 Can drill down to view full entry details
- 2.3.8 Routes use `/orgadmin/events/*` prefix

**Event Attributes:**
- Event Name (public display name)
- Description (detailed event information)
- Event Owner (defaults to creating org admin, editable)
- Email Notifications (comma-separated list for entry notifications)
- Event Start Date
- Event End Date (defaults to start date, can be multi-day)
- Open Date Entries (when entries open)
- Entries Closing Date (when entries close)
- Limit Number Of Event Entries (yes/no with limit field)
- Add Message To Confirmation Email (yes/no with message field)

**Event Activity Attributes:**
- Name (public display name)
- Description (activity-specific details)
- Show Publicly (yes/no visibility toggle)
- Application Form (select from Form Builder forms)
- Limit Number of Applicants (yes/no with limit field)
- Allow Specify Quantity (yes/no, allows ordering multiple entries)
- Use Terms and Conditions (yes/no)
- Terms and Conditions (rich text editor for T&Cs)
- Fee (entry fee, 0.00 for free)
- Allowed Payment Method (card, cheque/offline, or both)
- Handling Fee Included (yes/no for card payments)
- Cheque/Offline Payment Instructions (text for payment details)

**Event Entries Management:**
- Tabular view of all entries for an event
- Columns: Event Activity, First Name, Last Name, Entry Date/Time, Actions
- Filters: Event Activity dropdown, Name search
- "Download All Entries" button - exports formatted Excel with separate tables per activity
- Drill-down to view full entry details (all form fields)

### 2.4 Membership Management (Capability: memberships)

**As an** organisation administrator  
**I want to** manage membership types and members  
**So that** people can sign up and pay for membership

**Acceptance Criteria:**
- 2.4.1 Only visible if organisation has 'memberships' capability
- 2.4.2 Can create, edit, and delete membership types
- 2.4.3 Can set membership pricing and duration
- 2.4.4 Can view current members
- 2.4.5 Can manage member renewals
- 2.4.6 Routes use `/orgadmin/members/*` prefix

### 2.5 Merchandise Management (Capability: merchandise)

**As an** organisation administrator  
**I want to** manage merchandise items  
**So that** people can purchase organisation merchandise

**Acceptance Criteria:**
- 2.5.1 Only visible if organisation has 'merchandise' capability
- 2.5.2 Can create, edit, and delete merchandise items
- 2.5.3 Can set pricing, inventory, and variants
- 2.5.4 Can upload product images
- 2.5.5 Can view merchandise orders
- 2.5.6 Routes use `/orgadmin/merchandise/*` prefix

### 2.6 Calendar Bookings (Capability: calendar-bookings)

**As an** organisation administrator  
**I want to** manage bookable calendars and time slots  
**So that** people can book appointments or facilities

**Acceptance Criteria:**
- 2.6.1 Only visible if organisation has 'calendar-bookings' capability
- 2.6.2 Can create, edit, and delete calendars
- 2.6.3 Can define available time slots
- 2.6.4 Can set booking rules and pricing
- 2.6.5 Can view and manage bookings
- 2.6.6 Routes use `/orgadmin/calendar/*` prefix

### 2.7 Registration Management (Capability: registrations)

**As an** organisation administrator  
**I want to** manage registration types  
**So that** people can register and pay for programmes or courses

**Acceptance Criteria:**
- 2.7.1 Only visible if organisation has 'registrations' capability
- 2.7.2 Can create, edit, and delete registration types
- 2.7.3 Can set registration periods and pricing
- 2.7.4 Can define registration forms
- 2.7.5 Can view registrations
- 2.7.6 Routes use `/orgadmin/registrations/*` prefix

### 2.8 Event Ticketing (Capability: event-ticketing)

**As an** organisation administrator  
**I want to** manage ticketed events  
**So that** people can purchase tickets for events

**Acceptance Criteria:**
- 2.8.1 Only visible if organisation has 'event-ticketing' capability
- 2.8.2 Can create, edit, and delete ticketed events
- 2.8.3 Can define ticket types and pricing
- 2.8.4 Can set capacity limits
- 2.8.5 Can view ticket sales
- 2.8.6 Routes use `/orgadmin/tickets/*` prefix

### 2.9 Form Builder (Core - Always Available)

**As an** organisation administrator  
**I want to** design custom application forms  
**So that** I can collect specific information for events, memberships, etc.

**Acceptance Criteria:**
- 2.9.1 Always available to all organisation administrators
- 2.9.2 Can create, edit, and delete forms
- 2.9.3 Can add various field types (text, dropdown, checkbox, etc.)
- 2.9.4 Can set field validation rules
- 2.9.5 Forms can be linked to events, memberships, registrations, etc.
- 2.9.6 Routes use `/orgadmin/forms/*` prefix

### 2.10 Settings Management (Core - Always Available)

**As an** organisation administrator  
**I want to** manage organisation settings  
**So that** I can configure how my organisation operates

**Acceptance Criteria:**
- 2.10.1 Always available to all organisation administrators
- 2.10.2 Can update organisation details
- 2.10.3 Can configure payment settings
- 2.10.4 Can manage email templates
- 2.10.5 Can set branding (logo, colours)
- 2.10.6 Routes use `/orgadmin/settings/*` prefix

### 2.11 Payment Management (Core - Always Available)

**As an** organisation administrator  
**I want to** view and manage payments  
**So that** I can track revenue and process refunds

**Acceptance Criteria:**
- 2.11.1 Always available to all organisation administrators
- 2.11.2 Can view all payments (Stripe, etc.)
- 2.11.3 Can view lodgements
- 2.11.4 Can request refunds
- 2.11.5 Can export payment data
- 2.11.6 Routes use `/orgadmin/payments/*` prefix

### 2.12 Reporting (Core - Always Available)

**As an** organisation administrator  
**I want to** view reports and analytics  
**So that** I can understand my organisation's performance

**Acceptance Criteria:**
- 2.12.1 Always available to all organisation administrators
- 2.12.2 Shows high-level dashboard metrics (events, members, revenue)
- 2.12.3 Can generate specific reports
- 2.12.4 Can export reports to CSV/PDF
- 2.12.5 Can filter reports by date range
- 2.12.6 Routes use `/orgadmin/reporting/*` prefix

### 2.13 User Management (Core - Always Available)

**As an** organisation administrator  
**I want to** manage administrator users  
**So that** I can control who has access to the admin portal

**Acceptance Criteria:**
- 2.13.1 Always available to all organisation administrators
- 2.13.2 Can view all admin users for the organisation
- 2.13.3 Can create, edit, and delete admin users
- 2.13.4 Can assign roles to users
- 2.13.5 Uses existing backend user management services
- 2.13.6 Routes use `/orgadmin/users/*` prefix

## 3. Technical Requirements

### 3.1 Architecture

**3.1.1 Workspace Structure**
- Each functional area is a separate npm workspace package
- Shell package orchestrates all modules
- Shared components in existing `packages/components`
- Single backend in `packages/backend`

**3.1.2 Module Registration**
- Each module exports registration metadata
- Includes capability requirement, routes, and navigation info
- Shell dynamically loads modules based on capabilities

**3.1.3 Routing**
- Base URL: `/orgadmin`
- Each area has unique prefix: `/orgadmin/{area}/*`
- Lazy loading for performance

### 3.2 Authentication & Authorization

**3.2.1 Authentication**
- Keycloak-based authentication
- User must be in organisation's admin group
- Session management

**3.2.2 Authorization**
- Capability-based access control
- Role-based permissions within modules
- Backend API endpoints protected by capability checks

### 3.3 Data Model

**3.3.1 Existing Models (Reuse)**
- Organisation
- OrganisationType
- Capability
- OrganizationUser
- OrganizationAdminRole

**3.3.2 New Models (To Be Defined)**
- Event, EventActivity
- MembershipType, Member
- MerchandiseItem, MerchandiseOrder
- Calendar, Booking
- RegistrationType, Registration
- TicketedEvent, Ticket
- Form, FormField
- Payment, Refund
- Report

### 3.4 UI/UX Requirements

**3.4.1 Responsive Design**
- Mobile-first approach
- Works on tablets and desktops
- Touch-friendly interactions

**3.4.2 Consistent Theme**
- Uses existing neumorphic theme
- Material-UI components
- Consistent colour scheme and typography

**3.4.3 Accessibility**
- WCAG 2.1 AA compliance
- Keyboard navigation
- Screen reader support

### 3.5 Testing Requirements

**3.5.1 Unit Tests**
- All services have unit tests
- All components have unit tests
- Minimum 80% code coverage

**3.5.2 Integration Tests**
- Module integration tests
- API integration tests

**3.5.3 End-to-End Tests**
- Critical user journeys
- Cross-module workflows

### 3.6 Performance Requirements

**3.6.1 Load Time**
- Initial page load < 3 seconds
- Module lazy loading < 1 second
- API responses < 500ms

**3.6.2 Bundle Size**
- Shell bundle < 200KB
- Module bundles < 150KB each
- Code splitting for optimal loading

## 4. Non-Functional Requirements

### 4.1 Security
- All API endpoints require authentication
- Capability checks on all protected routes
- Input validation and sanitisation
- XSS and CSRF protection

### 4.2 Scalability
- Support 1000+ organisations
- Support 100+ concurrent users per organisation
- Efficient database queries with indexing

### 4.3 Maintainability
- Clear code structure and documentation
- Consistent coding standards
- Comprehensive error handling
- Logging and monitoring

### 4.4 Compatibility
- Modern browsers (Chrome, Firefox, Safari, Edge)
- Node.js 18+
- PostgreSQL 14+

## 5. Constraints

### 5.1 Technical Constraints
- Must use existing backend package
- Must integrate with Keycloak
- Must use existing organisation/capability model
- Must reuse existing components where possible

### 5.2 Timeline Constraints
- Phased delivery approach
- Shell and core modules first
- Capability modules incrementally

### 5.3 Resource Constraints
- Single development team
- Existing infrastructure
- Budget for third-party services (Stripe, etc.)

## 6. Assumptions

- Keycloak is properly configured
- Organisation and capability management is functional
- Payment processor (Stripe) integration will be handled separately
- Email service is available for notifications
- File storage is available for uploads

## 7. Dependencies

- Existing organisation management system
- Keycloak authentication
- PostgreSQL database
- Existing components package
- Material-UI library
- React Router
- Axios for API calls

## 8. Future Considerations

### 8.1 Account User Interface
- Separate interface for non-admin users
- Public-facing pages for events, memberships, etc.
- Shopping cart and checkout flow
- User profile management

### 8.2 Mobile Apps
- React Native mobile apps
- Native iOS/Android apps
- Offline capability

### 8.3 Advanced Features
- Multi-language support
- Advanced reporting and analytics
- Integration with third-party services
- Automated marketing campaigns
