# Design Document: Onboarding and Help System

## Overview

The onboarding and help system provides a comprehensive user guidance experience through three main components: a welcome dialog for first-time users, module-specific introduction dialogs, and a contextual help drawer. The system integrates with the existing React + TypeScript + MUI architecture, leveraging the current i18n system and module registration framework.

The design emphasizes non-intrusive UX, ensuring that guidance enhances rather than interrupts user workflows. All user preferences are persisted in the backend, and all content is fully internationalized across six languages.

## Architecture

### High-Level Component Structure

```
┌─────────────────────────────────────────────────────────────┐
│                        Application                           │
│  ┌───────────────────────────────────────────────────────┐  │
│  │                    Navbar                              │  │
│  │                              [Help Button]             │  │
│  └───────────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────┐  ┌──────────────────┐   │
│  │                               │  │                  │   │
│  │     Main Content Area         │  │   Help Drawer    │   │
│  │                               │  │   (slide-out)    │   │
│  │  ┌─────────────────────────┐  │  │                  │   │
│  │  │  Welcome Dialog         │  │  │  - Page Help     │   │
│  │  │  (first login)          │  │  │  - Module Help   │   │
│  │  └─────────────────────────┘  │  │  - Rich Content  │   │
│  │                               │  │                  │   │
│  │  ┌─────────────────────────┐  │  └──────────────────┘   │
│  │  │  Module Intro Dialog    │  │                         │
│  │  │  (first module visit)   │  │                         │
│  │  └─────────────────────────┘  │                         │
│  └───────────────────────────────┘                         │
└─────────────────────────────────────────────────────────────┘
```

### Component Hierarchy

```
orgadmin-shell/
├── OnboardingProvider (Context)
│   ├── State Management
│   ├── Preference Loading
│   └── Dialog Orchestration
├── WelcomeDialog
├── ModuleIntroductionDialog
├── HelpDrawer
└── HelpButton (Navbar Integration)

Backend API:
├── GET /api/user-preferences/onboarding
└── PUT /api/user-preferences/onboarding
```

## Components and Interfaces

### 1. OnboardingProvider (React Context)

The central state management component that orchestrates all onboarding functionality.

**Interface:**
```typescript
interface OnboardingContextValue {
  // State
  welcomeDialogOpen: boolean;
  moduleIntroDialogOpen: boolean;
  currentModule: ModuleId | null;
  helpDrawerOpen: boolean;
  
  // Actions
  dismissWelcomeDialog: (dontShowAgain: boolean) => Promise<void>;
  dismissModuleIntro: (moduleId: ModuleId) => Promise<void>;
  toggleHelpDrawer: () => void;
  checkModuleVisit: (moduleId: ModuleId) => void;
  
  // Preferences
  preferences: OnboardingPreferences;
  loading: boolean;
}

interface OnboardingPreferences {
  welcomeDismissed: boolean;
  modulesVisited: ModuleId[];
}

type ModuleId = 'dashboard' | 'users' | 'forms' | 'events' | 
                'memberships' | 'calendar' | 'payments';
```

**Responsibilities:**
- Load user preferences on mount from backend API
- Track which dialogs should be shown
- Manage dialog open/close state
- Persist preference changes to backend
- Provide context to all child components

**Lifecycle:**
1. On mount: Fetch user preferences from `/api/user-preferences/onboarding`
2. On first render after load: Check if welcome dialog should show
3. On route change: Check if module intro should show
4. On preference change: Update backend via PUT request

### 2. WelcomeDialog Component

A modal dialog shown on first login.

**Interface:**
```typescript
interface WelcomeDialogProps {
  open: boolean;
  onClose: (dontShowAgain: boolean) => void;
}
```

**Structure:**
- MUI Dialog component
- Title from i18n: `onboarding.welcome.title`
- Content from i18n: `onboarding.welcome.content` (supports markdown)
- Checkbox: "Don't show this again"
- Close button

**Behavior:**
- Opens automatically if `!preferences.welcomeDismissed` and user just logged in
- Closes when user clicks close or outside dialog
- Calls `onClose(dontShowAgain)` with checkbox state
- Renders markdown content using a markdown renderer (react-markdown)

### 3. ModuleIntroductionDialog Component

A modal dialog shown on first visit to each module.

**Interface:**
```typescript
interface ModuleIntroductionDialogProps {
  open: boolean;
  moduleId: ModuleId;
  onClose: () => void;
}
```

**Structure:**
- MUI Dialog component
- Title from i18n: `onboarding.modules.{moduleId}.title`
- Content from i18n: `onboarding.modules.{moduleId}.content` (supports markdown)
- Close button ("Got it" or similar)

**Behavior:**
- Opens automatically when user navigates to a module not in `preferences.modulesVisited`
- Closes when user clicks close button
- Calls `onClose()` which triggers preference update
- Renders markdown content

### 4. HelpDrawer Component

A slide-out drawer from the right side showing contextual help.

**Interface:**
```typescript
interface HelpDrawerProps {
  open: boolean;
  onClose: () => void;
  pageId: string; // Current page identifier
  moduleId: ModuleId; // Current module
}
```

**Structure:**
- MUI Drawer component with `anchor="right"`
- Width: 400px (configurable)
- Header with close button
- Scrollable content area
- Content from i18n: `help.{moduleId}.{pageId}` with fallback to `help.{moduleId}.overview`

**Behavior:**
- Opens/closes via `toggleHelpDrawer()` from context
- Does not obscure main content (pushes it left or overlays with backdrop)
- Displays page-specific help based on current route
- Falls back to module-level help if page-specific help not available
- Falls back to en-GB if translation missing for current language
- Renders markdown content with rich formatting

**Content Resolution:**
1. Try: `help.{moduleId}.{pageId}.{language}`
2. Fallback: `help.{moduleId}.overview.{language}`
3. Fallback: `help.{moduleId}.{pageId}.en-GB`
4. Fallback: `help.{moduleId}.overview.en-GB`

### 5. HelpButton Component

A button in the navbar that toggles the help drawer.

**Interface:**
```typescript
interface HelpButtonProps {
  onClick: () => void;
  active: boolean; // Whether help drawer is open
}
```

**Structure:**
- MUI IconButton with HelpOutline or Help icon
- Tooltip: i18n `help.button.tooltip`
- Visual indication when active (different color/background)

**Behavior:**
- Positioned in top-right of navbar
- Calls `toggleHelpDrawer()` on click
- Shows active state when drawer is open

### 6. useOnboarding Hook

A custom hook to access onboarding context.

**Interface:**
```typescript
function useOnboarding(): OnboardingContextValue;
```

**Usage:**
```typescript
const { checkModuleVisit, helpDrawerOpen, toggleHelpDrawer } = useOnboarding();

// In module component
useEffect(() => {
  checkModuleVisit('dashboard');
}, []);
```

### 7. usePageHelp Hook

A custom hook to register page-specific help content.

**Interface:**
```typescript
function usePageHelp(pageId: string): void;
```

**Usage:**
```typescript
// In any page component
usePageHelp('users-list');
```

**Behavior:**
- Updates context with current page ID
- Help drawer uses this to determine which content to show

## Data Models

### OnboardingPreferences (Backend)

```typescript
interface OnboardingPreferences {
  userId: string;
  welcomeDismissed: boolean;
  modulesVisited: ModuleId[];
  lastUpdated: Date;
}
```

**Storage:** Database table or document store associated with user account

**API Endpoints:**

```typescript
// GET /api/user-preferences/onboarding
Response: {
  welcomeDismissed: boolean;
  modulesVisited: string[];
}

// PUT /api/user-preferences/onboarding
Request: {
  welcomeDismissed?: boolean;
  modulesVisited?: string[];
}
Response: {
  success: boolean;
}
```

### I18n Content Structure

Translation files organized by language with the following structure:

```json
{
  "onboarding": {
    "welcome": {
      "title": "Welcome to OrgAdmin",
      "content": "# Getting Started\n\nWelcome to OrgAdmin...",
      "dontShowAgain": "Don't show this again"
    },
    "modules": {
      "dashboard": {
        "title": "Dashboard Overview",
        "content": "# Dashboard\n\nThe dashboard provides..."
      },
      "users": {
        "title": "User Management",
        "content": "# Users Module\n\nManage your users..."
      }
      // ... other modules
    }
  },
  "help": {
    "button": {
      "tooltip": "Get help"
    },
    "dashboard": {
      "overview": "# Dashboard Help\n\nThe dashboard shows...",
      "widgets": "# Widget Configuration\n\nCustomize your widgets..."
    },
    "users": {
      "overview": "# User Management Help",
      "list": "# User List\n\nView and manage all users...",
      "create": "# Create User\n\nAdd a new user..."
    }
    // ... other modules and pages
  }
}
```

### Route to Page ID Mapping

```typescript
interface PageMapping {
  route: string;
  pageId: string;
  moduleId: ModuleId;
}

const pageMappings: PageMapping[] = [
  { route: '/dashboard', pageId: 'overview', moduleId: 'dashboard' },
  { route: '/users', pageId: 'list', moduleId: 'users' },
  { route: '/users/create', pageId: 'create', moduleId: 'users' },
  { route: '/forms', pageId: 'list', moduleId: 'forms' },
  { route: '/forms/:id/edit', pageId: 'edit', moduleId: 'forms' },
  // ... other routes
];
```

## Correctness Properties


*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Content Language Consistency

*For any* onboarding or help content (welcome dialog, module intro, help drawer) and any supported language (en-GB, fr-FR, es-ES, it-IT, de-DE, pt-PT), when that language is selected, the system should display all content in that language.

**Validates: Requirements 1.2, 2.2, 3.2, 5.4**

### Property 2: Preference Persistence

*For any* dialog dismissal action (welcome dialog with "don't show again", module introduction dialog), the system should persist the dismissal preference to the backend and the API should be called with the correct user and preference data.

**Validates: Requirements 1.3, 2.3, 4.1**

### Property 3: Dismissed Dialogs Remain Dismissed

*For any* dialog that has been dismissed (welcome or module intro), when the user returns to the application or revisits the module, the dialog should not appear again.

**Validates: Requirements 1.5, 2.4, 6.4**

### Property 4: First Module Visit Triggers Introduction

*For any* module that has not been visited before (not in `modulesVisited` array), when the user navigates to that module, the module introduction dialog should appear.

**Validates: Requirements 2.1**

### Property 5: Preference Data Integrity

*For any* set of onboarding preferences (welcome dismissed, modules visited), when stored and then retrieved, the retrieved data should match the stored data exactly, maintaining separate tracking for each dialog type.

**Validates: Requirements 4.3, 4.4**

### Property 6: Universal Dialog Dismissibility

*For any* dialog (welcome or module intro), the user should be able to dismiss it immediately without completing any required actions.

**Validates: Requirements 6.1**

### Property 7: Single Dialog Display

*For any* combination of simultaneous onboarding events (e.g., first login + first module visit), the system should display at most one dialog at a time, with welcome dialog taking precedence over module intros.

**Validates: Requirements 6.3**

### Property 8: Help Content Resolution

*For any* valid route or page identifier, the help drawer should display content that matches either the specific page or falls back to the module-level overview, ensuring content is always available.

**Validates: Requirements 8.2**

### Property 9: Markdown Rendering

*For any* help content containing markdown syntax (headings, lists, links, bold, italic), the system should render it as properly formatted HTML in the help drawer.

**Validates: Requirements 8.4, 11.4**

### Property 10: User Data Isolation

*For any* authenticated user, when retrieving onboarding preferences, the system should return only that user's preferences and never expose another user's preference data.

**Validates: Requirements 9.4**

## Error Handling

### Frontend Error Handling

**API Communication Errors:**
- If preference loading fails on mount, show welcome dialog by default (fail-safe approach)
- If preference saving fails, log error to console but allow user to continue
- Display non-intrusive error notification if backend is unreachable
- Retry failed preference saves on next user action

**Missing Translation Errors:**
- Fall back to en-GB if translation missing for selected language
- Log warning to console for missing translation keys
- Display key name if even en-GB translation is missing (development aid)

**Invalid State Errors:**
- If preferences contain invalid module IDs, filter them out
- If preferences are malformed, reset to default (empty) state
- Log errors for debugging but don't block user

### Backend Error Handling

**Authentication Errors:**
- Return 401 if user token is invalid or missing
- Return 403 if user tries to access another user's preferences

**Validation Errors:**
- Return 400 if preference data is malformed
- Validate module IDs against known module list
- Validate boolean values for welcomeDismissed

**Database Errors:**
- Return 500 if database operation fails
- Log detailed error for debugging
- Implement retry logic for transient failures

**Concurrent Update Handling:**
- Use optimistic locking or last-write-wins strategy
- Preferences are additive (modules visited grows, welcome dismissed is one-way)
- No conflict resolution needed for typical use cases

## Testing Strategy

### Dual Testing Approach

The onboarding and help system requires both unit tests and property-based tests for comprehensive coverage:

**Unit Tests** focus on:
- Specific examples of dialog behavior (first login shows welcome dialog)
- Edge cases (missing translations, API failures)
- Integration points (navbar button integration, route change detection)
- UI interactions (clicking buttons, closing drawers)

**Property-Based Tests** focus on:
- Universal properties across all inputs (any language shows correct content)
- Preference persistence across any dialog type
- Content resolution for any route
- Data integrity for any preference combination

### Property-Based Testing Configuration

**Library Selection:**
- **TypeScript/JavaScript**: Use `fast-check` library for property-based testing
- Minimum 100 iterations per property test
- Each test tagged with: `Feature: onboarding-and-help-system, Property {N}: {description}`

**Test Organization:**
- Property tests in separate files: `*.property.test.ts`
- Unit tests in standard files: `*.test.ts`
- Integration tests for full user flows

### Unit Test Coverage

**Component Tests:**
- WelcomeDialog: renders correctly, checkbox works, close behavior
- ModuleIntroductionDialog: renders for each module, close behavior
- HelpDrawer: opens/closes, displays content, scrolling works
- HelpButton: renders in navbar, tooltip appears, click toggles drawer
- OnboardingProvider: loads preferences, manages state, orchestrates dialogs

**Integration Tests:**
- First login flow: welcome dialog appears, can be dismissed, preference saved
- Module visit flow: intro appears on first visit, not on subsequent visits
- Help drawer flow: opens from button, shows correct content, closes properly
- Language switching: all content updates when language changes
- Cross-device: preferences persist across sessions

**Edge Case Tests:**
- API failure during preference load
- API failure during preference save
- Missing translation keys
- Invalid preference data from backend
- Concurrent dialog events
- Rapid navigation between modules
- Help drawer with very long content

### Mock Strategy

**API Mocks:**
- Mock GET `/api/user-preferences/onboarding` to return test preferences
- Mock PUT `/api/user-preferences/onboarding` to verify save calls
- Simulate API failures for error handling tests

**Router Mocks:**
- Mock route changes to test module visit detection
- Mock current route for help content resolution

**I18n Mocks:**
- Mock useTranslation hook to return test translations
- Test fallback behavior with missing keys

### Test Data

**Sample Preferences:**
```typescript
const emptyPreferences = {
  welcomeDismissed: false,
  modulesVisited: []
};

const partialPreferences = {
  welcomeDismissed: true,
  modulesVisited: ['dashboard', 'users']
};

const fullPreferences = {
  welcomeDismissed: true,
  modulesVisited: ['dashboard', 'users', 'forms', 'events', 
                   'memberships', 'calendar', 'payments']
};
```

**Sample Content:**
```typescript
const sampleMarkdown = `
# Welcome to OrgAdmin

This is a **comprehensive** platform for:
- User management
- Form building
- Event coordination

[Learn more](https://example.com)
`;
```

## Implementation Notes

### Integration with Existing Systems

**Module Registration:**
- Extend ModuleRegistration interface to include optional `introductionKey` field
- Modules can opt-in to introduction dialogs by providing translation key
- Backward compatible - modules without introductionKey work normally

**I18n Integration:**
- Add new namespace: `onboarding` for all onboarding content
- Use existing `useTranslation` hook throughout
- Follow existing translation file structure in each package

**Navbar Integration:**
- Add HelpButton as a new navbar action item
- Position in top-right area alongside existing actions
- Use existing navbar styling and spacing

### Performance Considerations

**Lazy Loading:**
- Lazy load markdown renderer (react-markdown) only when needed
- Lazy load help content for each module
- Preload preferences on app mount to avoid delays

**Caching:**
- Cache loaded preferences in context (no repeated API calls)
- Cache resolved help content for current session
- Use React.memo for dialog components to prevent unnecessary re-renders

**Bundle Size:**
- Keep markdown renderer lightweight (use react-markdown, not full editor)
- Split help content by module (code splitting)
- Minimize translation file size with concise content

### Accessibility

**Keyboard Navigation:**
- All dialogs closeable with Escape key
- Help drawer accessible via keyboard shortcut (e.g., Shift+?)
- Focus management when dialogs open/close

**Screen Readers:**
- Proper ARIA labels on all interactive elements
- Announce dialog opening to screen readers
- Semantic HTML in rendered markdown content

**Visual Accessibility:**
- Sufficient color contrast for all text
- Focus indicators on interactive elements
- Respect user's reduced motion preferences

### Migration Strategy

**Phase 1: Core Infrastructure**
- Implement OnboardingProvider and context
- Create backend API endpoints
- Set up preference storage

**Phase 2: Welcome Dialog**
- Implement WelcomeDialog component
- Add welcome content translations
- Test first-login flow

**Phase 3: Module Introductions**
- Implement ModuleIntroductionDialog component
- Add module intro content for all modules
- Integrate with module navigation

**Phase 4: Help System**
- Implement HelpDrawer and HelpButton
- Add help content for all pages
- Integrate with navbar

**Phase 5: Polish and Testing**
- Complete all translations
- Comprehensive testing
- Performance optimization
- Accessibility audit

### Content Specifications

This section provides sample content for all onboarding dialogs and help pages. Content should be stored in i18n translation files and can be edited without code changes.

#### Welcome Dialog Content

**Key:** `onboarding.welcome.title`
```
Welcome to OrgAdmin
```

**Key:** `onboarding.welcome.content`
```markdown
# Welcome to OrgAdmin

OrgAdmin is your comprehensive platform for managing your organization's operations. Here's what you can do:

## Core Features

**User Management** - Create and manage user accounts, assign roles, and control permissions across your organization.

**Forms & Data Collection** - Build custom forms to collect information from members, with flexible field types and validation.

**Event Management** - Create and manage events, track registrations, and communicate with attendees.

**Membership Management** - Handle membership subscriptions, renewals, and member data.

**Calendar & Bookings** - Manage bookable resources, appointments, and scheduling.

**Payment Processing** - Accept payments, track transactions, and manage financial records.

## Getting Started

Each module has its own introduction that will appear the first time you visit it. You can also access help at any time by clicking the help button (?) in the top right corner.

Ready to get started? Close this dialog and explore your dashboard!
```

#### Module Introduction Content

**Dashboard Module**

**Key:** `onboarding.modules.dashboard.title`
```
Dashboard Overview
```

**Key:** `onboarding.modules.dashboard.content`
```markdown
# Dashboard

Your dashboard provides a quick overview of your organization's key metrics and recent activity.

## What You'll See

- **Quick Stats** - Member counts, upcoming events, recent form submissions
- **Recent Activity** - Latest actions and updates across all modules
- **Shortcuts** - Quick access to common tasks
- **Notifications** - Important alerts and reminders

## Customization

You can customize which widgets appear on your dashboard and arrange them to suit your workflow.

Click "Got it" to start exploring your dashboard!
```

**Users Module**

**Key:** `onboarding.modules.users.title`
```
User Management
```

**Key:** `onboarding.modules.users.content`
```markdown
# User Management

The Users module helps you manage all user accounts in your organization.

## Key Features

- **View All Users** - Browse and search your complete user directory
- **Create Users** - Add new users manually or invite them via email
- **Assign Roles** - Control what users can access and do
- **Manage Permissions** - Fine-tune capabilities for each role
- **User Profiles** - View and edit detailed user information

## Getting Started

Start by browsing your existing users or create a new user account. You can assign roles to control access levels.
```

**Forms Module**

**Key:** `onboarding.modules.forms.title`
```
Form Builder
```

**Key:** `onboarding.modules.forms.content`
```markdown
# Forms Module

Create custom forms to collect information from your members and the public.

## What You Can Do

- **Build Forms** - Create forms with various field types (text, numbers, dates, dropdowns, etc.)
- **Field Validation** - Ensure data quality with built-in validation rules
- **Conditional Logic** - Show or hide fields based on user responses
- **Submissions** - View and manage all form submissions
- **Export Data** - Download submission data for analysis

## Form Types

Create registration forms, surveys, applications, feedback forms, and more. Forms can be embedded on your website or shared via direct links.
```

**Events Module**

**Key:** `onboarding.modules.events.title`
```
Event Management
```

**Key:** `onboarding.modules.events.content`
```markdown
# Events Module

Plan, promote, and manage events for your organization.

## Core Capabilities

- **Create Events** - Set up events with dates, locations, and descriptions
- **Registration** - Accept event registrations with custom forms
- **Capacity Management** - Set attendance limits and waitlists
- **Communication** - Send updates and reminders to attendees
- **Check-in** - Track attendance on event day
- **Reporting** - Analyze registration and attendance data

## Event Types

Manage meetings, workshops, conferences, social gatherings, and any other type of event your organization hosts.
```

**Memberships Module**

**Key:** `onboarding.modules.memberships.title`
```
Membership Management
```

**Key:** `onboarding.modules.memberships.content`
```markdown
# Memberships Module

Manage your organization's membership program and member relationships.

## Key Features

- **Membership Types** - Define different membership tiers and benefits
- **Subscriptions** - Handle recurring memberships with automatic renewals
- **Member Records** - Maintain detailed member profiles and history
- **Renewals** - Track expiration dates and send renewal reminders
- **Member Portal** - Give members access to their own information
- **Reporting** - Analyze membership trends and retention

## Getting Started

Set up your membership types, then start adding members or allow them to self-register through your website.
```

**Calendar Module**

**Key:** `onboarding.modules.calendar.title`
```
Calendar & Bookings
```

**Key:** `onboarding.modules.calendar.content`
```markdown
# Calendar & Bookings

Manage bookable resources, appointments, and scheduling for your organization.

## What You Can Do

- **Create Calendars** - Set up calendars for rooms, equipment, staff, or services
- **Define Availability** - Set when resources are available for booking
- **Accept Bookings** - Let users book time slots online
- **Manage Appointments** - View, edit, and cancel bookings
- **Prevent Conflicts** - Automatic conflict detection and prevention
- **Notifications** - Send booking confirmations and reminders

## Use Cases

Perfect for meeting room bookings, equipment rentals, appointment scheduling, class registrations, and more.
```

**Payments Module**

**Key:** `onboarding.modules.payments.title`
```
Payment Processing
```

**Key:** `onboarding.modules.payments.content`
```markdown
# Payments Module

Accept and manage payments for memberships, events, and other services.

## Core Features

- **Payment Collection** - Accept credit cards, bank transfers, and other payment methods
- **Transaction History** - View all payment transactions
- **Invoicing** - Generate and send invoices
- **Refunds** - Process refunds when needed
- **Reporting** - Financial reports and reconciliation
- **Security** - PCI-compliant payment processing

## Integration

Payments are integrated throughout OrgAdmin - collect fees during event registration, membership signup, and more.
```

#### Help Drawer Content

**Dashboard Help**

**Key:** `help.dashboard.overview`
```markdown
# Dashboard Help

## Overview

Your dashboard is the central hub for monitoring your organization's activity. It provides at-a-glance insights into key metrics and recent changes.

## Widgets

The dashboard displays various widgets showing:
- Member statistics
- Upcoming events
- Recent form submissions
- Payment activity
- System notifications

## Customization

To customize your dashboard:
1. Click the settings icon in the top right
2. Choose which widgets to display
3. Drag widgets to rearrange them
4. Save your layout

## Quick Actions

Use the quick action buttons to jump directly to common tasks like creating a new user, event, or form.

## Need More Help?

Visit specific modules for detailed help on each feature area.
```

**Users Module Help**

**Key:** `help.users.overview`
```markdown
# User Management Help

## Managing Users

The Users module is your central location for managing all user accounts in your organization.

## Common Tasks

### Creating a New User
1. Click "Create User" button
2. Fill in user details (name, email, etc.)
3. Assign a role
4. Save the user

### Inviting Users
1. Click "Invite User"
2. Enter email address
3. Select role
4. User receives invitation email

### Editing Users
1. Find user in the list
2. Click on their name
3. Update information
4. Save changes

### Managing Roles
Roles control what users can access and do. Common roles include:
- **Admin** - Full system access
- **Manager** - Can manage content and users
- **Member** - Basic access to member features

## Search and Filters

Use the search bar to find users by name or email. Apply filters to view users by role, status, or other criteria.
```

**Key:** `help.users.list`
```markdown
# User List Help

## User List View

This page displays all users in your organization.

## Columns

- **Name** - User's full name
- **Email** - Contact email
- **Role** - Assigned role(s)
- **Status** - Active, Inactive, or Pending
- **Last Login** - Most recent login date

## Actions

Click on any user to view their full profile and edit details. Use the action menu (⋮) for quick actions like:
- Reset password
- Change role
- Deactivate account
- Send email

## Bulk Actions

Select multiple users to perform bulk operations like role assignment or sending group emails.
```

**Key:** `help.users.create`
```markdown
# Create User Help

## Adding a New User

Use this form to create a new user account.

## Required Fields

- **Email** - Must be unique, used for login
- **First Name** - User's given name
- **Last Name** - User's family name
- **Role** - Determines permissions

## Optional Fields

- **Phone** - Contact number
- **Organization** - Department or team
- **Notes** - Internal notes about the user

## Password

You can either:
- Set an initial password (user should change it)
- Send an invitation email (user sets their own password)

## After Creation

Once created, the user can log in immediately. You can edit their profile or permissions at any time.
```

**Forms Module Help**

**Key:** `help.forms.overview`
```markdown
# Forms Module Help

## Building Forms

The Forms module lets you create custom forms for data collection.

## Form Components

### Fields
Add various field types:
- Text (single line or multi-line)
- Numbers
- Dates and times
- Dropdowns and radio buttons
- Checkboxes
- File uploads

### Validation
Set rules to ensure data quality:
- Required fields
- Format validation (email, phone, etc.)
- Min/max values
- Custom patterns

### Conditional Logic
Show or hide fields based on other responses to create dynamic forms.

## Publishing Forms

Once created, you can:
- Embed forms on your website
- Share direct links
- Integrate with events or memberships

## Viewing Submissions

Access all form submissions from the form detail page. Export data to CSV for analysis.
```

**Events Module Help**

**Key:** `help.events.overview`
```markdown
# Events Module Help

## Managing Events

Create and manage all types of events for your organization.

## Event Setup

### Basic Information
- Event name and description
- Date and time
- Location (physical or virtual)
- Capacity limits

### Registration
- Enable/disable registration
- Set registration deadlines
- Collect additional information via forms
- Manage waitlists

### Communication
- Send event announcements
- Reminder emails
- Post-event follow-ups

## Event Status

Events can be:
- **Draft** - Not yet published
- **Published** - Open for registration
- **Full** - Capacity reached
- **Closed** - Registration ended
- **Completed** - Event has occurred

## Attendee Management

View registrations, check in attendees, and manage cancellations from the event detail page.
```

**Memberships Module Help**

**Key:** `help.memberships.overview`
```markdown
# Memberships Module Help

## Membership Management

Handle all aspects of your membership program.

## Membership Types

Define different membership tiers:
- Individual vs. family memberships
- Student, regular, and premium tiers
- Annual vs. monthly subscriptions

Each type can have:
- Different pricing
- Specific benefits
- Custom duration

## Member Lifecycle

### New Members
- Manual addition by admins
- Self-registration via website
- Bulk import from CSV

### Renewals
- Automatic renewal reminders
- Online renewal process
- Grace periods for expired memberships

### Cancellations
- Member-initiated or admin-initiated
- Refund processing if applicable
- Exit surveys

## Reporting

Track membership metrics:
- Total active members
- New members this month
- Renewal rates
- Revenue from memberships
```

**Calendar Module Help**

**Key:** `help.calendar.overview`
```markdown
# Calendar & Bookings Help

## Managing Bookable Resources

The Calendar module handles all scheduling and booking needs.

## Setting Up Calendars

### Create a Calendar
1. Define what's being booked (room, equipment, service)
2. Set availability (days and hours)
3. Configure booking rules (duration, advance notice)
4. Publish for bookings

### Availability Rules
- Regular weekly schedule
- Special hours for holidays
- Blocked time for maintenance
- Buffer time between bookings

## Accepting Bookings

Users can:
- View available time slots
- Select date and time
- Provide booking details
- Receive confirmation

## Managing Bookings

Admins can:
- View all bookings in calendar view
- Edit or cancel bookings
- Handle conflicts
- Generate booking reports

## Notifications

Automatic emails for:
- Booking confirmations
- Reminders before appointments
- Cancellation notices
```

**Payments Module Help**

**Key:** `help.payments.overview`
```markdown
# Payments Module Help

## Processing Payments

Accept and manage payments securely through OrgAdmin.

## Payment Methods

Supported payment types:
- Credit/debit cards
- Bank transfers
- Digital wallets
- Cash (manual recording)

## Transaction Management

### Viewing Transactions
See all payment history with:
- Transaction date and amount
- Payment method
- Associated member or event
- Status (completed, pending, refunded)

### Issuing Refunds
1. Find the transaction
2. Click "Refund"
3. Enter refund amount (full or partial)
4. Confirm refund

Refunds typically process within 5-10 business days.

## Invoicing

Generate invoices for:
- Membership fees
- Event registrations
- Custom charges

Invoices can be sent via email or downloaded as PDF.

## Financial Reports

Access reports for:
- Revenue by time period
- Payment method breakdown
- Outstanding invoices
- Refund history

## Security

All payment processing is PCI-compliant. Card details are never stored on our servers.
```

### Content Organization in Translation Files

Content should be organized in translation files as follows:

```
packages/orgadmin-shell/src/i18n/locales/
├── en-GB/
│   ├── onboarding.json
│   └── help.json
├── fr-FR/
│   ├── onboarding.json
│   └── help.json
├── es-ES/
│   ├── onboarding.json
│   └── help.json
├── it-IT/
│   ├── onboarding.json
│   └── help.json
├── de-DE/
│   ├── onboarding.json
│   └── help.json
└── pt-PT/
    ├── onboarding.json
    └── help.json
```

Each module package can also contribute its own help content for module-specific pages.

### Future Enhancements

**Potential Future Features:**
- Interactive tours (step-by-step walkthroughs)
- Video tutorials embedded in help drawer
- Search functionality in help content
- User feedback on help content usefulness
- Analytics on which help content is most accessed
- Admin panel to edit help content without code changes
- Progressive disclosure (show more advanced help after basic usage)
