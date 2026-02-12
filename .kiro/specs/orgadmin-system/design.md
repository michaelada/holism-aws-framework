# Organisation Admin System - Design Document

## 1. System Architecture

### 1.1 Application Branding

**ItsPlainSailing** is the branded name for this organization administration system.

- **Application Name**: ItsPlainSailing
- **Small Logo URL**: https://itsplainsailing.com/admin//logos/ips-logo-sails-transparent-64.png
- **Large Logo URL**: https://itsplainsailing.com/admin/logos/ips-logo-sails-darker-text-transparent-128.png
- Logo displayed in AppBar and login screens
- Branding colors and theme consistent with ItsPlainSailing identity

### 1.2 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Browser / Client                         │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       │ HTTPS
                       ↓
┌──────────────────────────────────────────────────────────────┐
│              AWS CloudFront CDN (Global)                     │
│  - Edge locations worldwide                                  │
│  - HTTPS/TLS termination                                     │
│  - Gzip/Brotli compression                                   │
│  - Caching static assets                                     │
└──────────────────────┬──────────────────────────────────────┘
                       │
┌──────────────────────┴──────────────────────────────────────┐
│                  Organisation Admin UI                       │
│  ┌────────────────────────────────────────────────────────┐ │
│  │              orgadmin-shell (Shell)                    │ │
│  │  - Authentication                                      │ │
│  │  - Capability Loading                                  │ │
│  │  - Module Registration                                 │ │
│  │  - Layout & Navigation                                 │ │
│  │  - ItsPlainSailing Branding                           │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │ Core Modules│  │   Capability  │  │    Shared        │  │
│  │             │  │    Modules    │  │  Components      │  │
│  │ - Dashboard │  │ - Events      │  │ - Forms          │  │
│  │ - Forms     │  │ - Members     │  │ - Tables         │  │
│  │ - Settings  │  │ - Merchandise │  │ - Wizards        │  │
│  │ - Payments  │  │ - Calendar    │  │ - Dialogs        │  │
│  │ - Reporting │  │ - Registr.    │  │ - FileUpload     │  │
│  │ - Users     │  │ - Tickets     │  │                  │  │
│  └─────────────┘  └──────────────┘  └──────────────────┘  │
└──────────────────────┬──────────────────────────────────────┘
                       │ REST API
┌──────────────────────┴──────────────────────────────────────┐
│                    Backend Services                          │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Existing Services:                                    │ │
│  │  - Organisation Service                                │ │
│  │  - Capability Service                                  │ │
│  │  - User Service                                        │ │
│  │  - Role Service                                        │ │
│  └────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  New Services:                                         │ │
│  │  - Event Service                                       │ │
│  │  - EventEntry Service                                  │ │
│  │  - Membership Service                                  │ │
│  │  - Merchandise Service                                 │ │
│  │  - Calendar Service                                    │ │
│  │  - Registration Service                                │ │
│  │  - Ticketing Service                                   │ │
│  │  - ApplicationForm Service (separate from Metadata)   │ │
│  │  - FormSubmission Service (unified across contexts)   │ │
│  │  - FileUpload Service (S3)                            │ │
│  │  - Payment Service                                     │ │
│  │  - Reporting Service                                   │ │
│  │  - OrgAdminUser Service                                │ │
│  │  - AccountUser Service                                 │ │
│  └────────────────────────────────────────────────────────┘ │
└──────────────────────┬──────────────────────────────────────┘
                       │
        ┌──────────────┴──────────────┐
        │                             │
┌───────┴────────┐          ┌─────────┴────────┐
│  PostgreSQL    │          │    AWS S3        │
│   Database     │          │  File Storage    │
│                │          │  /org-id/        │
│  - Orgs, Users │          │  /form-id/       │
│  - Events      │          │  /field-id/      │
│  - Entries     │          │  /filename       │
└────────────────┘          └──────────────────┘
```

### 1.3 Package Structure

```
packages/
├── backend/                          # Existing - enhanced
├── components/                       # Existing - enhanced
├── admin/                            # Existing - super admin
│
├── orgadmin-shell/                   # NEW - Shell application
│   ├── src/
│   │   ├── App.tsx
│   │   ├── components/
│   │   │   ├── Layout.tsx
│   │   │   ├── DashboardCard.tsx
│   │   │   └── ModuleLoader.tsx
│   │   ├── context/
│   │   │   ├── AuthContext.tsx
│   │   │   ├── OrganisationContext.tsx
│   │   │   └── CapabilityContext.tsx
│   │   ├── pages/
│   │   │   └── DashboardPage.tsx
│   │   └── types/
│   │       └── module.types.ts
│   └── package.json
│
├── orgadmin-core/                    # NEW - Core modules
│   ├── src/
│   │   ├── forms/                    # Form builder
│   │   ├── settings/                 # Settings management
│   │   ├── payments/                 # Payment management
│   │   ├── reporting/                # Reporting & analytics
│   │   └── users/                    # User management
│   └── package.json
│
├── orgadmin-events/                  # NEW - Event management
├── orgadmin-memberships/             # NEW - Membership management
├── orgadmin-merchandise/             # NEW - Merchandise management
├── orgadmin-calendar/                # NEW - Calendar bookings
├── orgadmin-registrations/           # NEW - Registration management
└── orgadmin-ticketing/               # NEW - Event ticketing
```

### 1.4 URL Structure

```
/orgadmin                             # Dashboard (landing page)
/orgadmin/events/*                    # Event management
/orgadmin/members/*                   # Membership management
/orgadmin/merchandise/*               # Merchandise management
/orgadmin/calendar/*                  # Calendar bookings
/orgadmin/registrations/*             # Registration management
/orgadmin/tickets/*                   # Event ticketing
/orgadmin/forms/*                     # Form builder
/orgadmin/settings/*                  # Settings
/orgadmin/payments/*                  # Payment management
/orgadmin/reporting/*                 # Reporting
/orgadmin/users/*                     # User management
```

## 2. Module Registration System

### 2.1 Module Registration Interface

```typescript
// packages/orgadmin-shell/src/types/module.types.ts

export interface ModuleCard {
  title: string;
  description: string;
  icon: ComponentType;
  color?: string;
  path: string;
}

export interface ModuleRoute {
  path: string;
  component: LazyExoticComponent<ComponentType<any>>;
}

export interface ModuleRegistration {
  id: string;
  name: string;
  title: string;                       // NEW - Used on dashboard card
  description: string;                 // NEW - Used on dashboard card
  capability?: string;                 // undefined = always available
  card: ModuleCard;
  routes: ModuleRoute[];
  order?: number;
}
```

### 2.2 Example Module Registration

```typescript
// packages/orgadmin-events/src/index.ts

import { lazy } from 'react';
import { Event as EventIcon } from '@mui/icons-material';
import { ModuleRegistration } from '@orgadmin/shell';

export const eventsModule: ModuleRegistration = {
  id: 'events',
  name: 'Events',
  title: 'Event Management',                    // NEW - Displayed on card
  description: 'Manage events, activities, and entries for your organisation',  // NEW
  capability: 'event-management',
  order: 1,
  card: {
    title: 'Event Management',                  // Uses module.title
    description: 'Manage events, activities, and entries for your organisation',  // Uses module.description
    icon: EventIcon,
    color: '#1976d2',
    path: '/orgadmin/events',
  },
  routes: [
    {
      path: '/orgadmin/events',
      component: lazy(() => import('./pages/EventsListPage')),
    },
    {
      path: '/orgadmin/events/new',
      component: lazy(() => import('./pages/CreateEventPage')),
    },
    {
      path: '/orgadmin/events/:id',
      component: lazy(() => import('./pages/EventDetailsPage')),
    },
    {
      path: '/orgadmin/events/:id/edit',
      component: lazy(() => import('./pages/EditEventPage')),
    },
    {
      path: '/orgadmin/events/:id/entries',
      component: lazy(() => import('./pages/EventEntriesPage')),
    },
  ],
};
```

## 3. Component Design

### 3.1 Shell Application

#### 3.1.1 App Component

```typescript
// packages/orgadmin-shell/src/App.tsx

const App: React.FC = () => {
  const { user, organisation, capabilities, loading } = useAuth();
  
  // Filter modules based on capabilities
  const availableModules = ALL_MODULES.filter(module =>
    !module.capability || capabilities.includes(module.capability)
  );

  if (loading) return <LoadingScreen />;
  if (!user || !organisation) return <Navigate to="/login" />;

  return (
    <BrowserRouter basename="/orgadmin">
      <OrganisationProvider organisation={organisation}>
        <CapabilityProvider capabilities={capabilities}>
          <Routes>
            <Route path="/" element={<DashboardPage modules={availableModules} />} />
            {availableModules.flatMap(module =>
              module.routes.map(route => (
                <Route
                  key={route.path}
                  path={route.path.replace('/orgadmin', '')}
                  element={<Suspense fallback={<LoadingScreen />}>
                    <route.component />
                  </Suspense>}
                />
              ))
            )}
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </CapabilityProvider>
      </OrganisationProvider>
    </BrowserRouter>
  );
};
```

#### 3.1.2 Dashboard Page (Landing Page)

```typescript
// packages/orgadmin-shell/src/pages/DashboardPage.tsx

export const DashboardPage: React.FC<{ modules: ModuleRegistration[] }> = ({ modules }) => {
  const { organisation } = useOrganisation();
  const sortedModules = [...modules].sort((a, b) => (a.order || 999) - (b.order || 999));

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Welcome to {organisation.displayName}
      </Typography>
      <Typography variant="body1" color="textSecondary" paragraph>
        Select an area below to get started
      </Typography>

      <Grid container spacing={3} sx={{ mt: 2 }}>
        {sortedModules.map(module => (
          <Grid item xs={12} sm={6} md={4} key={module.id}>
            <DashboardCard module={module} />
          </Grid>
        ))}
      </Grid>
    </Box>
  );
};
```

#### 3.1.3 Dashboard Card Component

```typescript
// packages/orgadmin-shell/src/components/DashboardCard.tsx

export const DashboardCard: React.FC<{ module: ModuleRegistration }> = ({ module }) => {
  const navigate = useNavigate();
  const { card } = module;

  return (
    <Card
      sx={{
        height: '100%',
        cursor: 'pointer',
        transition: 'transform 0.2s, box-shadow 0.2s',
        '&:hover': {
          transform: 'translateY(-4px)',
          boxShadow: 4,
        },
      }}
      onClick={() => navigate(card.path)}
    >
      <CardContent>
        <Box display="flex" alignItems="center" mb={2}>
          <Avatar
            sx={{
              bgcolor: card.color || 'primary.main',
              width: 56,
              height: 56,
            }}
          >
            <card.icon fontSize="large" />
          </Avatar>
        </Box>
        <Typography variant="h6" gutterBottom>
          {card.title}
        </Typography>
        <Typography variant="body2" color="textSecondary">
          {card.description}
        </Typography>
      </CardContent>
    </Card>
  );
};
```

### 3.2 Shared Components (Enhanced)

#### 3.2.1 Enhanced Components Package

```
packages/components/src/
├── components/
│   ├── FieldRenderer/              # Existing
│   ├── MetadataForm/               # Existing
│   ├── MetadataTable/              # Existing
│   ├── MetadataWizard/             # Existing
│   │
│   ├── OrgDataTable/               # NEW - Enhanced data table
│   │   ├── OrgDataTable.tsx
│   │   ├── useTableState.ts
│   │   └── TableFilters.tsx
│   │
│   ├── OrgFormBuilder/             # NEW - Form builder
│   │   ├── FormBuilder.tsx
│   │   ├── FieldEditor.tsx
│   │   └── FormPreview.tsx
│   │
│   ├── OrgPaymentWidget/           # NEW - Payment components
│   │   ├── PaymentList.tsx
│   │   ├── PaymentDetails.tsx
│   │   └── RefundDialog.tsx
│   │
│   ├── OrgDatePicker/              # NEW - Date/time pickers
│   │   ├── DateRangePicker.tsx
│   │   └── TimeSlotPicker.tsx
│   │
│   └── OrgFileUpload/              # NEW - File upload
│       ├── FileUpload.tsx
│       └── ImageUpload.tsx
```

## 4. Data Models

### 4.1 Event Management

```typescript
interface Event {
  id: string;
  organisationId: string;
  name: string;                        // Event Name (public display)
  description: string;                 // Detailed event information
  eventOwner: string;                  // User ID, defaults to creator
  emailNotifications: string;          // Comma-separated email list
  startDate: Date;                     // Event Start Date
  endDate: Date;                       // Event End Date (defaults to startDate)
  openDateEntries: Date;               // When entries open
  entriesClosingDate: Date;            // When entries close
  limitEntries: boolean;               // Limit Number Of Event Entries
  entriesLimit?: number;               // Entry limit if limitEntries is true
  addConfirmationMessage: boolean;     // Add Message To Confirmation Email
  confirmationMessage?: string;        // Message text if addConfirmationMessage is true
  status: 'draft' | 'published' | 'cancelled' | 'completed';
  createdAt: Date;
  updatedAt: Date;
}

interface EventActivity {
  id: string;
  eventId: string;
  name: string;                        // Activity Name (public display)
  description: string;                 // Activity-specific details
  showPublicly: boolean;               // Show Publicly toggle
  applicationFormId?: string;          // Link to Form Builder form
  limitApplicants: boolean;            // Limit Number of Applicants
  applicantsLimit?: number;            // Limit if limitApplicants is true
  allowSpecifyQuantity: boolean;       // Allow ordering multiple entries
  useTermsAndConditions: boolean;      // Use Terms and Conditions
  termsAndConditions?: string;         // Rich text T&Cs
  fee: number;                         // Entry fee (0.00 for free)
  allowedPaymentMethod: 'card' | 'cheque' | 'both';  // Payment methods
  handlingFeeIncluded: boolean;        // For card payments
  chequePaymentInstructions?: string;  // Instructions for cheque/offline
  createdAt: Date;
  updatedAt: Date;
}

interface EventEntry {
  id: string;
  eventId: string;
  eventActivityId: string;
  userId: string;                      // Account user who submitted
  firstName: string;
  lastName: string;
  email: string;
  formSubmissionId?: string;           // Link to form submission data
  quantity: number;                    // If allowSpecifyQuantity is true
  paymentStatus: 'pending' | 'paid' | 'refunded';
  paymentMethod?: 'card' | 'cheque';
  entryDate: Date;
  createdAt: Date;
  updatedAt: Date;
}
```

### 4.2 User Management

```typescript
interface OrgAdminUser {
  id: string;
  organisationId: string;
  email: string;
  firstName: string;
  lastName: string;
  roles: string[];                     // Admin role IDs
  status: 'active' | 'inactive';
  lastLogin?: Date;
  createdAt: Date;
  updatedAt: Date;
}

interface AccountUser {
  id: string;
  organisationId: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  status: 'active' | 'inactive';
  lastLogin?: Date;
  createdAt: Date;
  updatedAt: Date;
}
```

### 4.3 Membership Management

```typescript
interface MembershipType {
  id: string;
  organisationId: string;
  name: string;                        // Display name (e.g., "Adult Membership")
  description: string;                 // Detailed description for members
  membershipFormId: string;            // Link to ApplicationForm
  membershipStatus: 'open' | 'closed'; // Open = accepting, Closed = visible but not accepting
  isRollingMembership: boolean;        // true = rolling, false = fixed period
  validUntil?: Date;                   // For fixed period (isRollingMembership = false)
  numberOfMonths?: number;             // For rolling (isRollingMembership = true)
  automaticallyApprove: boolean;       // true = auto Active, false = Pending
  memberLabels: string[];              // Tags automatically assigned to members
  supportedPaymentMethods: string[];   // Payment method IDs from Payments module
  useTermsAndConditions: boolean;      // Include T&Cs in application
  termsAndConditions?: string;         // Rich text T&Cs
  membershipTypeCategory: 'single' | 'group'; // Single person or group
  // Group-specific fields
  maxPeopleInApplication?: number;     // For group memberships
  minPeopleInApplication?: number;     // For group memberships
  personTitles?: string[];             // Custom titles for each person slot
  personLabels?: string[][];           // Labels for each person slot
  fieldConfiguration?: Record<string, 'common' | 'unique'>; // Field sharing config
  createdAt: Date;
  updatedAt: Date;
}

interface Member {
  id: string;
  organisationId: string;
  membershipTypeId: string;
  userId: string;                      // Account user who applied
  membershipNumber: string;            // Auto-generated unique identifier
  firstName: string;
  lastName: string;
  formSubmissionId: string;            // Link to FormSubmission
  dateLastRenewed: Date;               // Application or renewal date
  status: 'active' | 'pending' | 'elapsed'; // Membership status
  validUntil: Date;                    // Expiry date
  labels: string[];                    // Tags assigned to this member
  processed: boolean;                  // Admin review flag
  paymentStatus: 'pending' | 'paid' | 'refunded';
  paymentMethod?: string;
  // Group membership fields
  groupMembershipId?: string;          // Links group members together
  personSlot?: number;                 // Position in group (1, 2, 3, etc.)
  createdAt: Date;
  updatedAt: Date;
}

interface MemberFilter {
  id: string;
  organisationId: string;
  userId: string;                      // Admin user who created filter
  name: string;                        // Display name
  memberStatus: ('active' | 'pending' | 'elapsed')[];
  dateLastRenewedBefore?: Date;
  dateLastRenewedAfter?: Date;
  validUntilBefore?: Date;
  validUntilAfter?: Date;
  memberLabels: string[];
  createdAt: Date;
  updatedAt: Date;
}
```

### 4.4 Merchandise Management

```typescript
interface MerchandiseType {
  id: string;
  organisationId: string;
  name: string;                        // Display name (e.g., "Club T-Shirt")
  description: string;                 // Detailed product description
  images: string[];                    // S3 URLs for product images (min 1)
  status: 'active' | 'inactive';       // Active = available, Inactive = hidden
  
  // Options configuration
  optionTypes: MerchandiseOptionType[]; // e.g., Size, Pack Type, Color
  
  // Stock management (optional)
  trackStockLevels: boolean;           // Enable stock tracking
  lowStockAlert?: number;              // Threshold for low stock notifications
  outOfStockBehavior?: 'hide' | 'show_unavailable'; // How to handle out of stock
  
  // Delivery configuration
  deliveryType: 'free' | 'fixed' | 'quantity_based';
  deliveryFee?: number;                // For 'fixed' type
  deliveryRules?: DeliveryRule[];      // For 'quantity_based' type
  
  // Order quantity rules
  minOrderQuantity?: number;           // Minimum items per order (default 1)
  maxOrderQuantity?: number;           // Maximum items per order (optional)
  quantityIncrements?: number;         // Must order in multiples (optional)
  
  // Application form integration
  requireApplicationForm: boolean;     // Require additional info
  applicationFormId?: string;          // Link to ApplicationForm
  
  // Payment configuration
  supportedPaymentMethods: string[];   // Payment method IDs
  useTermsAndConditions: boolean;      // Include T&Cs
  termsAndConditions?: string;         // Rich text T&Cs
  
  // Email notifications
  adminNotificationEmails?: string;    // Comma-separated emails for order notifications
  customConfirmationMessage?: string;  // Custom text in confirmation emails
  
  createdAt: Date;
  updatedAt: Date;
}

interface MerchandiseOptionType {
  id: string;
  merchandiseTypeId: string;
  name: string;                        // e.g., "Size", "Pack Type", "Color"
  order: number;                       // Display order
  optionValues: MerchandiseOptionValue[];
  createdAt: Date;
  updatedAt: Date;
}

interface MerchandiseOptionValue {
  id: string;
  optionTypeId: string;
  name: string;                        // e.g., "Small", "Medium", "Large"
  price: number;                       // Price for this option
  sku?: string;                        // Stock keeping unit
  stockQuantity?: number;              // If trackStockLevels enabled
  order: number;                       // Display order
  createdAt: Date;
  updatedAt: Date;
}

interface DeliveryRule {
  id: string;
  merchandiseTypeId: string;
  minQuantity: number;                 // Minimum items for this rule
  maxQuantity?: number;                // Maximum items (null = no upper limit)
  deliveryFee: number;                 // Fee for this quantity range
  order: number;                       // Rule evaluation order
}

interface MerchandiseOrder {
  id: string;
  organisationId: string;
  merchandiseTypeId: string;
  userId: string;                      // Account user who placed order
  
  // Order details
  selectedOptions: Record<string, string>; // JSONB: { "Size": "Large", "Color": "Blue" }
  quantity: number;                    // Number of items ordered
  unitPrice: number;                   // Price per item based on selected options
  subtotal: number;                    // quantity × unitPrice
  deliveryFee: number;                 // Calculated delivery fee
  totalPrice: number;                  // subtotal + deliveryFee
  
  // Form submission
  formSubmissionId?: string;           // Link to FormSubmission if form required
  
  // Payment
  paymentStatus: 'pending' | 'paid' | 'refunded';
  paymentMethod?: string;              // Payment method used
  
  // Order status
  orderStatus: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  
  // Admin notes
  adminNotes?: string;                 // Internal notes for order processing
  
  // Timestamps
  orderDate: Date;                     // When order was placed
  createdAt: Date;
  updatedAt: Date;
}

interface MerchandiseOrderHistory {
  id: string;
  orderId: string;
  userId: string;                      // Admin user who made change
  previousStatus: string;
  newStatus: string;
  notes?: string;
  createdAt: Date;
}
```

**Key Design Principles:**
- **Flexible Options**: Support multiple option types (size, color, pack) with independent pricing
- **Optional Stock Management**: Organizations can choose whether to track inventory
- **Flexible Delivery**: Three delivery models (free, fixed, quantity-based) to suit different needs
- **Quantity Rules**: Control minimum, maximum, and increment requirements
- **Form Integration**: Optional application forms for collecting additional information
- **Order Tracking**: Comprehensive order status workflow with history
- **Price Calculation**: Automatic calculation of unit price, subtotal, delivery fee, and total
- **Email Notifications**: Automatic confirmations and admin notifications

### 4.5 Calendar Bookings

```typescript
// Calendar status and configuration types
export type CalendarStatus = 'open' | 'closed';
export type BookingStatus = 'confirmed' | 'cancelled' | 'pending_payment';
export type PaymentStatus = 'pending' | 'paid' | 'refunded';

// Main Calendar entity
interface Calendar {
  id: string;
  organisationId: string;
  
  // Basic Information
  name: string;                        // Display name (e.g., "Tennis Court 1")
  description: string;                 // Detailed information about the resource
  displayColour: string;               // Hex colour code for calendar view
  status: CalendarStatus;              // Open or Closed
  
  // Automated Opening/Closing
  enableAutomatedSchedule: boolean;    // Enable automatic status changes
  scheduleRules?: ScheduleRule[];      // Rules for automatic opening/closing
  
  // Booking Window Configuration
  minDaysInAdvance?: number;           // Minimum days before timeslot that bookings allowed (default 0)
  maxDaysInAdvance?: number;           // Maximum days in future that bookings allowed (default 90)
  
  // Terms and Conditions
  useTermsAndConditions: boolean;      // Require T&C acceptance
  termsAndConditions?: string;         // Rich text T&Cs
  
  // Payment Configuration
  supportedPaymentMethods: string[];   // Payment method IDs from Payments module
  
  // Cancellation Policy
  allowCancellations: boolean;         // Enable self-service cancellations (default false)
  cancelDaysInAdvance?: number;        // Days before timeslot that cancellations allowed
  refundPaymentAutomatically: boolean; // Auto-refund on cancellation (default false)
  
  // Email Notifications
  adminNotificationEmails?: string;    // Comma-separated emails for booking notifications
  sendReminderEmails: boolean;         // Send reminder emails before bookings
  reminderHoursBefore?: number;        // Hours before booking to send reminder
  
  createdAt: Date;
  updatedAt: Date;
}

// Schedule rule for automated opening/closing
interface ScheduleRule {
  id: string;
  calendarId: string;
  startDate: Date;                     // When this rule starts applying
  endDate?: Date;                      // When this rule stops (null = indefinite)
  action: 'open' | 'close';            // What to do
  timeOfDay?: string;                  // Time to execute action (HH:MM format)
  reason?: string;                     // Description (e.g., "Winter break")
  order: number;                       // Execution order for overlapping rules
  createdAt: Date;
  updatedAt: Date;
}

// Time slot configuration - defines available booking slots
interface TimeSlotConfiguration {
  id: string;
  calendarId: string;
  
  // Schedule
  daysOfWeek: number[];                // 0=Sunday, 1=Monday, etc. (multi-select)
  startTime: string;                   // HH:MM format
  effectiveDateStart: Date;            // When this configuration starts
  effectiveDateEnd?: Date;             // When this configuration ends (null = indefinite)
  recurrenceWeeks: number;             // 1=every week, 2=every 2 weeks, etc.
  
  // Capacity
  placesAvailable: number;             // Number of bookings allowed (default 1)
  minPlacesRequired?: number;          // Minimum bookings before slot considered "booked"
  
  // Duration and Pricing Options
  durationOptions: DurationOption[];   // Multiple duration/price combinations
  
  order: number;                       // Display order
  createdAt: Date;
  updatedAt: Date;
}

// Duration option - allows multiple durations/prices for same timeslot
interface DurationOption {
  id: string;
  timeSlotConfigurationId: string;
  duration: number;                    // Minutes
  price: number;                       // Cost for this duration
  label: string;                       // Display name (e.g., "Half Hour", "Full Hour")
  order: number;                       // Display order
  createdAt: Date;
  updatedAt: Date;
}

// Blocked period - prevents bookings during specific times
interface BlockedPeriod {
  id: string;
  calendarId: string;
  blockType: 'date_range' | 'time_segment'; // Type of block
  
  // For date_range blocks
  startDate?: Date;                    // Start of blocked period
  endDate?: Date;                      // End of blocked period
  
  // For time_segment blocks
  daysOfWeek?: number[];               // Which days this block applies to
  startTime?: string;                  // HH:MM format
  endTime?: string;                    // HH:MM format
  
  reason?: string;                     // Why this period is blocked
  createdAt: Date;
  updatedAt: Date;
}

// Booking entity - represents an actual booking
interface Booking {
  id: string;
  bookingReference: string;            // Unique reference for user (e.g., "BK-2024-001234")
  calendarId: string;
  userId: string;                      // Account user who made booking
  
  // Booking Details
  bookingDate: Date;                   // Date of the booking
  startTime: string;                   // HH:MM format
  duration: number;                    // Minutes
  endTime: string;                     // Calculated: HH:MM format
  placesBooked: number;                // Number of places booked (default 1)
  
  // Pricing
  pricePerPlace: number;               // Price for each place
  totalPrice: number;                  // placesBooked × pricePerPlace
  
  // Status
  bookingStatus: BookingStatus;        // Confirmed, Cancelled, Pending Payment
  paymentStatus: PaymentStatus;        // Pending, Paid, Refunded
  paymentMethod?: string;              // Payment method used
  
  // Form Submission (if calendar requires additional info)
  formSubmissionId?: string;           // Link to FormSubmission
  
  // Cancellation Details
  cancelledAt?: Date;                  // When booking was cancelled
  cancelledBy?: string;                // User ID who cancelled (user or admin)
  cancellationReason?: string;         // Why it was cancelled
  refundProcessed: boolean;            // Whether refund was completed
  refundedAt?: Date;                   // When refund was processed
  
  // Admin Notes
  adminNotes?: string;                 // Internal notes
  
  // Timestamps
  bookedAt: Date;                      // When booking was made
  createdAt: Date;
  updatedAt: Date;
  
  // Populated fields (from joins)
  calendar?: Calendar;
  userName?: string;
  userEmail?: string;
  userPhone?: string;
}

// Booking history for audit trail
interface BookingHistory {
  id: string;
  bookingId: string;
  userId: string;                      // Who made the change
  action: string;                      // What changed (e.g., "status_changed", "cancelled", "refunded")
  previousValue?: string;              // Old value
  newValue?: string;                   // New value
  notes?: string;                      // Additional context
  createdAt: Date;
}

// View model for calendar display
interface CalendarSlotView {
  date: Date;
  startTime: string;
  duration: number;
  endTime: string;
  placesAvailable: number;
  placesBooked: number;
  placesRemaining: number;
  price: number;
  isAvailable: boolean;                // Can be booked
  isBlocked: boolean;                  // Blocked period
  isFull: boolean;                     // All places booked
  isMinimumMet: boolean;               // Minimum places requirement met (if applicable)
  bookings: Booking[];                 // Existing bookings for this slot
}

// Form data types for creating/editing
interface CalendarFormData {
  name: string;
  description: string;
  displayColour: string;
  status: CalendarStatus;
  
  enableAutomatedSchedule: boolean;
  scheduleRules: {
    startDate: Date;
    endDate?: Date;
    action: 'open' | 'close';
    timeOfDay?: string;
    reason?: string;
  }[];
  
  minDaysInAdvance?: number;
  maxDaysInAdvance?: number;
  
  useTermsAndConditions: boolean;
  termsAndConditions?: string;
  
  supportedPaymentMethods: string[];
  
  allowCancellations: boolean;
  cancelDaysInAdvance?: number;
  refundPaymentAutomatically: boolean;
  
  adminNotificationEmails?: string;
  sendReminderEmails: boolean;
  reminderHoursBefore?: number;
}

interface TimeSlotConfigurationFormData {
  daysOfWeek: number[];
  startTime: string;
  effectiveDateStart: Date;
  effectiveDateEnd?: Date;
  recurrenceWeeks: number;
  placesAvailable: number;
  minPlacesRequired?: number;
  durationOptions: {
    duration: number;
    price: number;
    label: string;
  }[];
}
```

**Key Design Principles:**
- **Flexible Time Slot Configuration**: Support varying durations, prices, and capacities
- **Multi-Place Bookings**: Allow group sessions with minimum thresholds
- **Automated Management**: Schedule-based opening/closing reduces manual work
- **Self-Service Cancellations**: Optional user-initiated cancellations with automatic refunds
- **Booking Windows**: Control how far in advance bookings can be made
- **Blocked Periods**: Prevent bookings during maintenance or holidays
- **Audit Trail**: Complete history of all booking changes
- **Calendar View Support**: Data structure optimized for both tabular and calendar displays


### 4.5a Registration Management

```typescript
interface RegistrationType {
  id: string;
  organisationId: string;
  name: string;                        // Display name (e.g., "2026 Horse Registration")
  description: string;                 // Detailed description for account users
  entityName: string;                  // Name of thing being registered (e.g., "Horse", "Boat")
  registrationFormId: string;          // Link to ApplicationForm
  registrationStatus: 'open' | 'closed'; // Open = accepting, Closed = visible but not accepting
  isRollingRegistration: boolean;      // true = rolling, false = fixed period
  validUntil?: Date;                   // For fixed period (isRollingRegistration = false)
  numberOfMonths?: number;             // For rolling (isRollingRegistration = true)
  automaticallyApprove: boolean;       // true = auto Active, false = Pending
  registrationLabels: string[];        // Tags automatically assigned to registrations
  supportedPaymentMethods: string[];   // Payment method IDs from Payments module
  useTermsAndConditions: boolean;      // Include T&Cs in application
  termsAndConditions?: string;         // Rich text T&Cs
  createdAt: Date;
  updatedAt: Date;
}

interface Registration {
  id: string;
  organisationId: string;
  registrationTypeId: string;
  userId: string;                      // Account user who owns this registration
  registrationNumber: string;          // Auto-generated unique identifier
  entityName: string;                  // Name/identifier of the registered entity
  ownerName: string;                   // Name of the account user
  formSubmissionId: string;            // Link to FormSubmission
  dateLastRenewed: Date;               // Application or renewal date
  status: 'active' | 'pending' | 'elapsed'; // Registration status
  validUntil: Date;                    // Expiry date
  labels: string[];                    // Tags assigned to this registration
  processed: boolean;                  // Admin review flag
  paymentStatus: 'pending' | 'paid' | 'refunded';
  paymentMethod?: string;
  createdAt: Date;
  updatedAt: Date;
}

interface RegistrationFilter {
  id: string;
  organisationId: string;
  userId: string;                      // Admin user who created filter
  name: string;                        // Display name
  registrationStatus: ('active' | 'pending' | 'elapsed')[];
  dateLastRenewedBefore?: Date;
  dateLastRenewedAfter?: Date;
  validUntilBefore?: Date;
  validUntilAfter?: Date;
  registrationLabels: string[];
  registrationTypes: string[];         // Filter by registration type IDs
  createdAt: Date;
  updatedAt: Date;
}
```

**Key Design Principles:**
- **Entity-Focused**: Registrations are for things (entities), not people
- **Entity Name Field**: Identifies what is being registered (horse, boat, equipment)
- **No Group Registrations**: Each entity is registered individually (simpler than Memberships)
- **Similar to Memberships**: Uses same patterns for status management, labels, filters, batch operations
- **Automatic Status Management**: Nightly job updates expired registrations from Active to Elapsed
- **Flexible Duration**: Supports both rolling and fixed-period registrations

### 4.5b Event Ticketing

Event Ticketing extends the Events module by adding electronic ticket generation with QR codes. Tickets are automatically generated when bookings are made for events with ticketing enabled.

```typescript
// Ticket status types
export type TicketStatus = 'issued' | 'scanned' | 'cancelled' | 'expired';
export type TicketScanStatus = 'not_scanned' | 'scanned';

// Event ticketing configuration (extends Event model)
interface EventTicketingConfig {
  eventId: string;
  generateElectronicTickets: boolean;  // Enable/disable ticketing for this event
  
  // Ticket customization
  ticketHeaderText?: string;           // Text at top of ticket
  ticketInstructions?: string;         // Instructions for ticket holders
  ticketFooterText?: string;           // Text at bottom of ticket
  ticketValidityPeriod?: number;       // Hours before event that ticket becomes valid
  
  // Ticket template settings
  includeEventLogo: boolean;           // Show organisation logo on ticket
  ticketBackgroundColor?: string;      // Hex color for ticket background
  
  createdAt: Date;
  updatedAt: Date;
}

// Electronic Ticket entity
interface ElectronicTicket {
  id: string;
  ticketReference: string;             // Unique human-readable reference (e.g., "TKT-2024-001234")
  qrCode: string;                      // Unique UUID for QR code validation
  
  // Event and booking linkage
  eventId: string;                     // Link to Event
  eventActivityId?: string;            // Link to EventActivity (if applicable)
  eventEntryId: string;                // Link to EventEntry (booking)
  
  // Customer information
  userId: string;                      // Account user who booked
  customerName: string;                // Full name for display on ticket
  customerEmail: string;               // Email for ticket delivery
  
  // Ticket details
  issueDate: Date;                     // When ticket was generated
  validFrom?: Date;                    // When ticket becomes valid (based on validity period)
  validUntil: Date;                    // Event end date/time
  
  // Scan tracking
  scanStatus: TicketScanStatus;        // not_scanned or scanned
  scanDate?: Date;                     // When ticket was scanned
  scanLocation?: string;               // Location/device that scanned (from scanning app)
  scanCount: number;                   // Number of times scanned (for audit)
  
  // Status
  status: TicketStatus;                // issued, scanned, cancelled, expired
  
  // Metadata
  ticketData: Record<string, any>;     // JSONB: Additional ticket data (event details snapshot)
  
  createdAt: Date;
  updatedAt: Date;
}

// Ticket scan history for audit trail
interface TicketScanHistory {
  id: string;
  ticketId: string;
  scanDate: Date;
  scanLocation?: string;               // Device/location identifier from scanning app
  scannedBy?: string;                  // User ID of person who scanned (from scanning app)
  scanResult: 'valid' | 'invalid' | 'already_scanned' | 'expired';
  notes?: string;                      // Any notes from scanning process
  createdAt: Date;
}

// Ticketing dashboard statistics
interface TicketingDashboardStats {
  eventId?: string;                    // Filter by specific event (optional)
  totalTicketsIssued: number;
  ticketsScanned: number;
  ticketsNotScanned: number;
  scanPercentage: number;
  lastScanTime?: Date;
  ticketsByEvent: Array<{
    eventId: string;
    eventName: string;
    totalTickets: number;
    scannedTickets: number;
  }>;
  ticketsByActivity: Array<{
    eventActivityId: string;
    activityName: string;
    totalTickets: number;
    scannedTickets: number;
  }>;
  recentScans: Array<{
    ticketReference: string;
    customerName: string;
    eventName: string;
    scanDate: Date;
  }>;
}
```

**Key Design Principles:**
- **Automatic Generation**: Tickets generated automatically on booking confirmation
- **Unique QR Codes**: Each ticket has UUID-based QR code for security
- **Event Integration**: Tickets link to existing Event and EventEntry entities
- **Scan Tracking**: Complete audit trail of all scan attempts
- **Real-Time Dashboard**: Live statistics for monitoring event entry
- **Customizable Content**: Per-event customization of ticket text
- **Email Delivery**: Tickets automatically attached to booking confirmation emails
- **Multiple Tickets**: Support for multiple tickets per booking (quantity > 1)
- **Scan History**: Full audit trail for compliance and troubleshooting
- **Status Management**: Track ticket lifecycle from issued to scanned/expired

**Ticket Generation Workflow:**
1. User books event with ticketing enabled
2. System creates EventEntry record
3. System generates ElectronicTicket with unique QR code
4. System renders ticket PDF with QR code and custom text
5. System attaches ticket PDF to booking confirmation email
6. System sends email to customer
7. Ticket appears in ticketing dashboard as "issued"

**Ticket Scanning Workflow (via mobile app - out of scope):**
1. Scanning app scans QR code
2. App sends QR code to backend API for validation
3. Backend validates ticket (checks status, event date, etc.)
4. Backend updates ticket scan status and creates scan history record
5. Backend returns validation result to app
6. App displays result (valid/invalid) to scanner
7. Dashboard updates in real-time to show scan

**Integration Points:**
- **Events Module**: Ticketing settings in event edit form
- **Event Entries**: Tickets generated from event bookings
- **Email System**: Tickets delivered via email
- **Payments Module**: Ticket purchases tracked as payments
- **Reporting Module**: Ticket statistics in reports

### 4.6 Form Builder (Application Forms)

#### 4.6.1 Application Form Tables (Separate from Metadata)

```typescript
interface ApplicationForm {
  id: string;
  organisationId: string;
  name: string;
  description: string;
  status: 'draft' | 'published';
  createdAt: Date;
  updatedAt: Date;
}

interface ApplicationField {
  id: string;
  organisationId: string;
  name: string;
  label: string;
  datatype: 'text' | 'email' | 'number' | 'select' | 'checkbox' | 'date' | 'document_upload';
  required: boolean;
  validation?: Record<string, any>;
  options?: string[];                  // for select/checkbox
  // Document upload specific fields
  allowedFileTypes?: string[];         // e.g., ['pdf', 'jpg', 'png']
  maxFileSize?: number;                // in bytes
  createdAt: Date;
  updatedAt: Date;
}

interface ApplicationFormField {
  id: string;
  formId: string;
  fieldId: string;
  order: number;
  groupName?: string;                  // For field grouping
  groupOrder?: number;                 // Order within group
  wizardStep?: number;                 // For multi-step wizards
  wizardStepTitle?: string;
  createdAt: Date;
  updatedAt: Date;
}
```

#### 4.6.2 Unified Form Submission Model

```typescript
interface FormSubmission {
  id: string;
  formId: string;
  organisationId: string;
  userId: string;                      // Account user who submitted
  submissionType: 'event_entry' | 'membership_application' | 'calendar_booking' | 'merchandise_order' | 'registration';
  contextId: string;                   // Links to specific context (event_id, membership_type_id, etc.)
  submissionData: Record<string, any>; // JSONB column for variable form data
  status: 'pending' | 'approved' | 'rejected';
  submittedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

interface FormSubmissionFile {
  id: string;
  submissionId: string;
  fieldId: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  s3Key: string;                       // S3 path: /org-id/form-id/field-id/filename
  s3Bucket: string;
  uploadedAt: Date;
}
```

**Key Design Principles:**
- Application forms are conceptually the same as object definitions but stored separately
- Reuse existing MetadataForm, MetadataWizard, and FieldRenderer components
- All form submissions (events, memberships, bookings, etc.) use the same unified data model
- JSONB column allows flexible form structures without schema changes
- File uploads tracked separately with S3 links
- Organization segregation enforced at S3 path level

## 4.7 Service Architecture

### 4.7.1 Application Form Services

**ApplicationFormService**
- Manages application forms (separate from object definitions)
- CRUD operations for application forms
- Similar to MetadataService but for application-specific forms
- Handles form publishing and draft management

**FormSubmissionService**
- Unified service for ALL form submissions across contexts
- Handles submissions for: events, memberships, calendar bookings, merchandise, registrations
- Queries by submission_type and context_id
- Manages submission status workflow (pending → approved/rejected)
- Links to FormSubmissionFile for uploaded documents

**FileUploadService**
- Handles S3 file uploads with organization segregation
- Generates S3 keys: /org-id/form-id/field-id/filename
- Provides signed URLs for secure file downloads
- Implements file validation (type, size, virus scanning)
- Manages file deletion from S3

### 4.7.2 Service Separation Principles

- **Separation of Concerns**: Application forms are separate from object definitions
  - Different tables: `application_forms` vs `object_definitions`
  - Different services: `ApplicationFormService` vs `MetadataService`
  - Same UI patterns: Reuse MetadataForm, MetadataWizard components

- **Unified Submissions**: All form submissions use the same data model
  - Single `form_submissions` table
  - Single `FormSubmissionService`
  - Differentiated by `submission_type` field
  - Context-specific via `context_id` field

- **File Management**: Dedicated service for S3 operations
  - `FileUploadService` handles all file operations
  - Organization-level segregation in S3 paths
  - Secure signed URLs for downloads
  - Separate `form_submission_files` table for tracking

## 5. API Design

### 5.1 Authentication Endpoints

```
POST   /api/orgadmin/auth/login
POST   /api/orgadmin/auth/logout
GET    /api/orgadmin/auth/me
GET    /api/orgadmin/auth/capabilities
```

### 5.2 Event Management Endpoints

```
GET    /api/orgadmin/events
POST   /api/orgadmin/events
GET    /api/orgadmin/events/:id
PUT    /api/orgadmin/events/:id
DELETE /api/orgadmin/events/:id
GET    /api/orgadmin/events/:id/activities
POST   /api/orgadmin/events/:id/activities
PUT    /api/orgadmin/events/:eventId/activities/:activityId
DELETE /api/orgadmin/events/:eventId/activities/:activityId
GET    /api/orgadmin/events/:id/entries
GET    /api/orgadmin/events/:id/entries/export
GET    /api/orgadmin/events/:eventId/entries/:entryId
```

### 5.3 Membership Management Endpoints

```
GET    /api/orgadmin/membership-types
POST   /api/orgadmin/membership-types
GET    /api/orgadmin/membership-types/:id
PUT    /api/orgadmin/membership-types/:id
DELETE /api/orgadmin/membership-types/:id
GET    /api/orgadmin/members
```

### 5.4 Form Builder Endpoints (Application Forms)

```
# Application Forms
GET    /api/orgadmin/application-forms
POST   /api/orgadmin/application-forms
GET    /api/orgadmin/application-forms/:id
PUT    /api/orgadmin/application-forms/:id
DELETE /api/orgadmin/application-forms/:id

# Application Fields
GET    /api/orgadmin/application-fields
POST   /api/orgadmin/application-fields
GET    /api/orgadmin/application-fields/:id
PUT    /api/orgadmin/application-fields/:id
DELETE /api/orgadmin/application-fields/:id

# Form Submissions (Unified across all contexts)
GET    /api/orgadmin/form-submissions
  - Query params: submissionType, contextId, status, dateRange
POST   /api/orgadmin/form-submissions
GET    /api/orgadmin/form-submissions/:id
PUT    /api/orgadmin/form-submissions/:id
DELETE /api/orgadmin/form-submissions/:id
```

### 5.5 File Upload Endpoints

```
POST   /api/orgadmin/files/upload
  - Multipart form data
  - Returns S3 key and URL
  - Path: /org-id/form-id/field-id/filename
  
GET    /api/orgadmin/files/:fileId
  - Returns signed S3 URL for download
  
DELETE /api/orgadmin/files/:fileId
  - Removes file from S3
  - Requires admin permission
```

### 5.6 User Management Endpoints

```
# Org Admin Users
GET    /api/orgadmin/users/admins
POST   /api/orgadmin/users/admins
GET    /api/orgadmin/users/admins/:id
PUT    /api/orgadmin/users/admins/:id
DELETE /api/orgadmin/users/admins/:id

# Account Users
GET    /api/orgadmin/users/accounts
POST   /api/orgadmin/users/accounts
GET    /api/orgadmin/users/accounts/:id
PUT    /api/orgadmin/users/accounts/:id
DELETE /api/orgadmin/users/accounts/:id
```

### 5.7 Payment Endpoints

```
GET    /api/orgadmin/payments
GET    /api/orgadmin/payments/:id
POST   /api/orgadmin/payments/:id/refund
GET    /api/orgadmin/payments/export
```

### 5.8 Reporting Endpoints

```
GET    /api/orgadmin/reports/dashboard
GET    /api/orgadmin/reports/events
GET    /api/orgadmin/reports/members
GET    /api/orgadmin/reports/revenue
POST   /api/orgadmin/reports/export
```

## 6. Security Design

### 6.1 Authentication Flow

```
1. User navigates to /orgadmin
2. Keycloak redirects to login if not authenticated
3. User logs in with credentials
4. Keycloak returns JWT token
5. Frontend stores token in secure cookie
6. Frontend fetches user's organisation and capabilities
7. Frontend loads appropriate modules
```

### 6.2 Authorization Checks

```typescript
// Backend middleware
export const requireCapability = (capability: string) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const user = req.user;
    const org = await getOrganisation(user.organisationId);
    
    if (!org.enabledCapabilities.includes(capability)) {
      return res.status(403).json({ error: 'Capability not enabled' });
    }
    
    next();
  };
};

// Usage
router.post('/events',
  authenticateToken(),
  requireCapability('event-management'),
  createEvent
);
```

### 6.3 Role-Based Permissions

```typescript
// Check user's role permissions
export const requirePermission = (capability: string, level: 'read' | 'write' | 'admin') => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const user = req.user;
    const roles = await getUserRoles(user.id, user.organisationId);
    
    const hasPermission = roles.some(role =>
      role.capabilityPermissions[capability] &&
      checkPermissionLevel(role.capabilityPermissions[capability], level)
    );
    
    if (!hasPermission) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    
    next();
  };
};
```

## 7. Testing Strategy

### 7.1 Unit Tests

```typescript
// Example: Module registration test
describe('Module Registration', () => {
  it('should filter modules based on capabilities', () => {
    const capabilities = ['event-management', 'memberships'];
    const filtered = filterModules(ALL_MODULES, capabilities);
    
    expect(filtered).toContainEqual(eventsModule);
    expect(filtered).toContainEqual(membershipsModule);
    expect(filtered).not.toContainEqual(merchandiseModule);
  });
});

// Example: Component test
describe('DashboardCard', () => {
  it('should navigate when clicked', () => {
    const navigate = jest.fn();
    render(<DashboardCard module={eventsModule} />);
    
    fireEvent.click(screen.getByText('Events'));
    expect(navigate).toHaveBeenCalledWith('/orgadmin/events');
  });
});
```

### 7.2 Integration Tests

```typescript
// Example: API integration test
describe('Event API', () => {
  it('should create event with valid data', async () => {
    const response = await request(app)
      .post('/api/orgadmin/events')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Test Event',
        startDate: '2024-06-01',
        endDate: '2024-06-02',
      });
    
    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty('id');
  });
});
```

## 8. Performance Optimizations

### 8.1 Code Splitting

- Shell bundle: ~200KB
- Each module lazy-loaded on demand
- Shared components in separate chunk

### 8.2 Caching Strategy

- Organisation data cached for session
- Capabilities cached for session
- API responses cached with appropriate TTL

### 8.3 Database Optimization

- Indexes on frequently queried fields
- Pagination for large datasets
- Efficient joins and queries

## 9. Deployment Strategy

### 9.1 AWS Infrastructure

#### 9.1.1 CloudFront CDN Configuration

```hcl
# Terraform configuration for CloudFront distribution

resource "aws_cloudfront_distribution" "orgadmin_ui" {
  enabled             = true
  is_ipv6_enabled     = true
  comment             = "ItsPlainSailing OrgAdmin UI Distribution"
  default_root_object = "index.html"
  price_class         = "PriceClass_100"  # US, Canada, Europe

  origin {
    domain_name = aws_s3_bucket.orgadmin_ui.bucket_regional_domain_name
    origin_id   = "S3-orgadmin-ui"

    s3_origin_config {
      origin_access_identity = aws_cloudfront_origin_access_identity.orgadmin_ui.cloudfront_access_identity_path
    }
  }

  default_cache_behavior {
    allowed_methods  = ["GET", "HEAD", "OPTIONS"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "S3-orgadmin-ui"

    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }

    viewer_protocol_policy = "redirect-to-https"
    min_ttl                = 0
    default_ttl            = 3600
    max_ttl                = 86400
    compress               = true
  }

  # Custom error response for SPA routing
  custom_error_response {
    error_code         = 404
    response_code      = 200
    response_page_path = "/index.html"
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    acm_certificate_arn      = var.acm_certificate_arn
    ssl_support_method       = "sni-only"
    minimum_protocol_version = "TLSv1.2_2021"
  }

  tags = {
    Name        = "ItsPlainSailing OrgAdmin UI"
    Environment = var.environment
  }
}
```

#### 9.1.2 S3 Bucket for File Uploads

```hcl
# Terraform configuration for S3 file storage

resource "aws_s3_bucket" "orgadmin_files" {
  bucket = "itsplainsailing-orgadmin-files-${var.environment}"

  tags = {
    Name        = "ItsPlainSailing OrgAdmin Files"
    Environment = var.environment
  }
}

resource "aws_s3_bucket_versioning" "orgadmin_files" {
  bucket = aws_s3_bucket.orgadmin_files.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "orgadmin_files" {
  bucket = aws_s3_bucket.orgadmin_files.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "orgadmin_files" {
  bucket = aws_s3_bucket.orgadmin_files.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Lifecycle policy for file cleanup
resource "aws_s3_bucket_lifecycle_configuration" "orgadmin_files" {
  bucket = aws_s3_bucket.orgadmin_files.id

  rule {
    id     = "delete-old-versions"
    status = "Enabled"

    noncurrent_version_expiration {
      noncurrent_days = 90
    }
  }
}

# CORS configuration for file uploads
resource "aws_s3_bucket_cors_configuration" "orgadmin_files" {
  bucket = aws_s3_bucket.orgadmin_files.id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET", "PUT", "POST", "DELETE"]
    allowed_origins = var.allowed_origins
    expose_headers  = ["ETag"]
    max_age_seconds = 3000
  }
}
```

#### 9.1.3 IAM Roles and Policies

```hcl
# IAM role for backend to access S3
resource "aws_iam_role" "orgadmin_backend" {
  name = "itsplainsailing-orgadmin-backend-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ec2.amazonaws.com"
        }
      }
    ]
  })
}

# Policy for S3 file operations
resource "aws_iam_role_policy" "orgadmin_s3_access" {
  name = "s3-file-access"
  role = aws_iam_role.orgadmin_backend.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:PutObject",
          "s3:GetObject",
          "s3:DeleteObject",
          "s3:ListBucket"
        ]
        Resource = [
          aws_s3_bucket.orgadmin_files.arn,
          "${aws_s3_bucket.orgadmin_files.arn}/*"
        ]
      }
    ]
  })
}
```

### 9.2 Build Process

```bash
# Build all packages
npm run build:shell
npm run build:core
npm run build:events
npm run build:memberships
# ... etc

# Or build all at once
npm run build:orgadmin
```

### 9.3 Docker Configuration

```dockerfile
FROM node:18 AS builder
WORKDIR /app
COPY package*.json ./
COPY packages/orgadmin-shell ./packages/orgadmin-shell
COPY packages/orgadmin-core ./packages/orgadmin-core
# ... copy other packages
RUN npm ci
RUN npm run build:orgadmin

FROM nginx:alpine
COPY --from=builder /app/packages/orgadmin-shell/dist /usr/share/nginx/html/orgadmin
COPY nginx.conf /etc/nginx/nginx.conf
```

### 9.4 Deployment Pipeline

```yaml
# GitHub Actions / CI/CD pipeline
name: Deploy OrgAdmin UI

on:
  push:
    branches: [main]
    paths:
      - 'packages/orgadmin-**/**'

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Build packages
        run: npm run build:orgadmin
      
      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v2
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: us-east-1
      
      - name: Deploy to S3
        run: |
          aws s3 sync packages/orgadmin-shell/dist s3://orgadmin-ui-bucket/ --delete
      
      - name: Invalidate CloudFront cache
        run: |
          aws cloudfront create-invalidation \
            --distribution-id ${{ secrets.CLOUDFRONT_DISTRIBUTION_ID }} \
            --paths "/*"
```

## 10. Migration Strategy

### 10.1 Phase 1: Foundation
- Create shell package
- Implement authentication
- Create dashboard with cards
- Deploy to staging with CloudFront

### 10.2 Phase 2: Core Modules
- Implement Forms module with file upload support
- Implement Settings module
- Implement Users module (split admin/account users)
- Deploy to staging

### 10.3 Phase 3: Capability Modules (Incremental)
- Implement Events module with enhanced features
- Implement one capability module at a time
- Test thoroughly
- Deploy to production incrementally

### 10.4 Phase 4: Remaining Modules
- Complete all capability modules
- Implement Payments module
- Implement Reporting module
- Full production deployment via CloudFront

## 11. Monitoring & Logging

### 11.1 Frontend Monitoring
- Error tracking (Sentry)
- Performance monitoring
- User analytics
- CloudFront access logs

### 11.2 Backend Monitoring
- API response times
- Error rates
- Database query performance
- S3 upload/download metrics

### 11.3 Logging
- Structured logging
- Log levels (debug, info, warn, error)
- Centralized log aggregation
- CloudWatch integration for AWS resources
